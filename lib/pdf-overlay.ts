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
    }
  | {
      page?: number;
      type: "checkbox-grid";
      options: Record<string, { page?: number; x: number; y: number; size?: number }>;
    };

type CoordSchema = {
  _dimensiones?: { ancho: number; alto: number };
  _default_size?: number;
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
    if ("type" in conf && conf.type === "checkbox-grid") {
      const elegido = (flat[campoId] ?? "").toString().trim();
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
    const valor = flat[campoId];
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
