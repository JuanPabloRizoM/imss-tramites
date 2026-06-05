import "server-only";

import { promises as fs } from "fs";
import path from "path";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Motor de overlay sobre PDFs oficiales.
//
// Carga el PDF base (assets/formatos/<codigo>.pdf), lee el JSON de coordenadas
// (<codigo>.coords.json) y escribe cada valor en su (x, y) calibrado, en su
// página correspondiente. Para checkboxes pinta una "X" en la opción que
// matchea con `field_values[<id_del_checkbox>]`.
//
// Coordenadas: origen en esquina inferior izquierda (pdf-lib).
// Ajustar el JSON no requiere recompilar nada — al siguiente generar-pdf
// el server lo lee del disco.

type CoordCampo =
  | {
      page: number;
      x: number;
      y: number;
      size?: number;
      ancho_max?: number;
      // Si está, copia el valor de otro campo (útil para que el mismo dato
      // aparezca en varias secciones del PDF — ej. clase en I.3 y en III.1).
      from?: string;
    }
  | {
      page?: number;
      type: "checkbox-grid";
      from?: string;
      options: Record<string, { page?: number; x: number; y: number; size?: number }>;
    }
  | {
      type: "table-cells";
      from?: string;
      // Cada celda es una posición (x,y) — el valor se split por comas/saltos
      // y cada item va en su celda. Si hay más items que celdas, se truncan.
      cells: Array<{
        page?: number;
        x: number;
        y: number;
        size?: number;
        ancho_max?: number;
      }>;
    }
  | {
      type: "text-wrap";
      from?: string;
      // Texto continuo que se word-wrap a lo ancho de cada celda. Cuando una
      // celda se llena, salta a la siguiente. Si se acaban las celdas, lo
      // demás se descarta. Útil para escribir párrafos en tablas-renglón.
      cells: Array<{
        page?: number;
        x: number;
        y: number;
        size?: number;
        ancho_max?: number;
      }>;
    };

type CoordSchema = {
  _dimensiones?: { ancho: number; alto: number };
  _default_size?: number;
  // Si está, recorta el PDF base a las primeras N páginas antes de pintar
  // los campos. Útil para formatos cuyo IMSS publica páginas finales con
  // instructivo, generalidades, etc. — solo se imprime lo capturable.
  _max_paginas?: number;
  campos: Record<string, CoordCampo>;
};

const ROOT = path.join(process.cwd(), "assets", "formatos");
const COLOR = rgb(0.08, 0.08, 0.12);

export async function existePdfBase(codigo: string): Promise<boolean> {
  try {
    await fs.access(path.join(ROOT, `${codigo}.pdf`));
    await fs.access(path.join(ROOT, `${codigo}.coords.json`));
    return true;
  } catch {
    return false;
  }
}

export async function generarOverlay(
  codigo: string,
  values: Record<string, string>
): Promise<Uint8Array> {
  const [pdfBytes, coordsRaw] = await Promise.all([
    fs.readFile(path.join(ROOT, `${codigo}.pdf`)),
    fs.readFile(path.join(ROOT, `${codigo}.coords.json`), "utf8"),
  ]);

  const coords = JSON.parse(coordsRaw) as CoordSchema;
  const doc = await PDFDocument.load(pdfBytes);

  // Recortar páginas si el coords lo indica (ej. AM-SRT: solo páginas 1-5,
  // las posteriores son instructivo/generalidades que no se entregan).
  // Borrar del final hacia el principio para no invalidar índices.
  if (coords._max_paginas && coords._max_paginas > 0) {
    const total = doc.getPageCount();
    for (let i = total - 1; i >= coords._max_paginas; i--) {
      doc.removePage(i);
    }
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  const defaultSize = coords._default_size ?? 9;

  // Pre-procesamiento: expandir campos compuestos (fechas → dd/mm/aaaa).
  const flat: Record<string, string> = { ...values };
  for (const [key, val] of Object.entries(values)) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val ?? "");
    if (m) {
      const [, aaaa, mm, dd] = m;
      flat[`${key}_dd`] = dd;
      flat[`${key}_mm`] = mm;
      flat[`${key}_aaaa`] = aaaa;
    }
  }

  for (const [campoId, conf] of Object.entries(coords.campos)) {
    // Si la coord tiene `from`, toma el valor de ese campo en vez del id propio.
    const valueKey = (conf as { from?: string }).from ?? campoId;

    // Texto largo word-wrap a través de celdas: cuando una se llena, salta.
    if ("type" in conf && conf.type === "text-wrap") {
      const valor = (flat[valueKey] ?? "").toString().trim();
      if (!valor) continue;
      // Normalizar saltos de línea a espacios — el wrap es uniforme.
      const palabras = valor.replace(/\s+/g, " ").split(" ");
      let palabraIdx = 0;
      for (const cell of conf.cells) {
        if (palabraIdx >= palabras.length) break;
        const page = pages[cell.page ?? 0];
        if (!page) continue;
        const size = cell.size ?? defaultSize;
        const ancho = cell.ancho_max ?? 540;
        // Acumular palabras hasta que la siguiente no entre.
        let linea = "";
        while (palabraIdx < palabras.length) {
          const candidata = linea ? `${linea} ${palabras[palabraIdx]}` : palabras[palabraIdx];
          if (font.widthOfTextAtSize(candidata, size) > ancho) {
            if (!linea) {
              // Una sola palabra que no cabe: truncar y avanzar.
              linea = truncarParaCabe(palabras[palabraIdx], font, size, ancho);
              palabraIdx++;
            }
            break;
          }
          linea = candidata;
          palabraIdx++;
        }
        if (linea) {
          page.drawText(linea, { x: cell.x, y: cell.y, size, font, color: COLOR });
        }
      }
      continue;
    }

    // Tabla de celdas: split por coma o salto de línea, una entrada por celda.
    if ("type" in conf && conf.type === "table-cells") {
      const valor = (flat[valueKey] ?? "").toString();
      if (!valor.trim()) continue;
      const items = valor
        .split(/[,\n]/g)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (let i = 0; i < Math.min(items.length, conf.cells.length); i++) {
        const cell = conf.cells[i];
        const page = pages[cell.page ?? 0];
        if (!page) continue;
        const size = cell.size ?? defaultSize;
        const texto = truncarParaCabe(items[i], font, size, cell.ancho_max);
        page.drawText(texto, { x: cell.x, y: cell.y, size, font, color: COLOR });
      }
      continue;
    }

    if ("type" in conf && conf.type === "checkbox-grid") {
      const elegido = (flat[valueKey] ?? "").toString().trim();
      if (!elegido) continue;
      const norm = elegido.toLowerCase();
      const opt =
        conf.options[elegido] ||
        conf.options[norm] ||
        conf.options[norm.replace(/\s+/g, "_")];
      if (!opt) continue;
      const page = pages[opt.page ?? conf.page ?? 0];
      if (!page) continue;
      page.drawText("X", {
        x: opt.x,
        y: opt.y,
        size: opt.size ?? 10,
        font: fontBold,
        color: COLOR,
      });
      continue;
    }

    // Campo de texto en (x,y).
    const c = conf as Extract<CoordCampo, { x: number }>;
    const valor = flat[valueKey];
    if (valor == null || String(valor).trim() === "") continue;
    const page = pages[c.page ?? 0];
    if (!page) continue;
    const size = c.size ?? defaultSize;
    const texto = truncarParaCabe(String(valor), font, size, c.ancho_max);
    page.drawText(texto, {
      x: c.x,
      y: c.y,
      size,
      font,
      color: COLOR,
    });
  }

  return doc.save();
}

function truncarParaCabe(
  texto: string,
  font: PDFFont,
  size: number,
  anchoMax?: number
): string {
  if (!anchoMax || anchoMax <= 0) return texto;
  if (font.widthOfTextAtSize(texto, size) <= anchoMax) return texto;
  // Trunca palabra a palabra y termina en "…".
  let cur = texto;
  while (cur.length > 1 && font.widthOfTextAtSize(cur + "…", size) > anchoMax) {
    cur = cur.slice(0, -1);
  }
  return cur + "…";
}

// Helper genérico opcional usado desde lib/pdf.ts.
export { rgb, type PDFPage, type PDFFont };
