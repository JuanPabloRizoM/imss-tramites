import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  agruparPorSeccion,
  type CampoSchema,
  type TramiteType,
} from "@/lib/tramites";
import { existePdfBase, generarOverlay } from "@/lib/pdf-overlay";

// Tamaños base en puntos (1 pt = 1/72 in). Carta = 612 × 792.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 56;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 64;

const COLOR_INK = rgb(0.1, 0.12, 0.18);
const COLOR_INK_2 = rgb(0.32, 0.34, 0.4);
const COLOR_INK_3 = rgb(0.5, 0.52, 0.58);
const COLOR_LINE = rgb(0.82, 0.83, 0.86);
const COLOR_ACCENT = rgb(0.62, 0.32, 0.22);

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  cursorY: number;
  sans: PDFFont;
  sansBold: PDFFont;
  serif: PDFFont;
  serifItalic: PDFFont;
};

async function nuevoCtx(): Promise<Ctx> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  return {
    doc,
    page,
    cursorY: PAGE_H - MARGIN_TOP,
    sans,
    sansBold,
    serif,
    serifItalic,
  };
}

function nuevaPagina(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.cursorY = PAGE_H - MARGIN_TOP;
}

function asegurarEspacio(ctx: Ctx, alto: number) {
  if (ctx.cursorY - alto < MARGIN_BOTTOM) nuevaPagina(ctx);
}

function dibujarTexto(
  ctx: Ctx,
  texto: string,
  opts: { size: number; font: PDFFont; color?: ReturnType<typeof rgb>; x?: number }
) {
  const { size, font, color = COLOR_INK, x = MARGIN_X } = opts;
  asegurarEspacio(ctx, size + 4);
  ctx.page.drawText(texto, {
    x,
    y: ctx.cursorY - size,
    size,
    font,
    color,
  });
  ctx.cursorY -= size + 6;
}

function dibujarLineaH(ctx: Ctx, color = COLOR_LINE) {
  asegurarEspacio(ctx, 12);
  ctx.cursorY -= 8;
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.cursorY },
    end: { x: PAGE_W - MARGIN_X, y: ctx.cursorY },
    thickness: 0.5,
    color,
  });
  ctx.cursorY -= 8;
}

function wrapTexto(texto: string, font: PDFFont, size: number, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split("\n")) {
    const palabras = parrafo.split(/\s+/);
    let linea = "";
    for (const palabra of palabras) {
      const tentativa = linea ? `${linea} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(tentativa, size) <= ancho) {
        linea = tentativa;
      } else {
        if (linea) lineas.push(linea);
        linea = palabra;
      }
    }
    if (linea) lineas.push(linea);
    lineas.push(""); // separador entre párrafos
  }
  if (lineas.at(-1) === "") lineas.pop();
  return lineas;
}

function dibujarParrafo(
  ctx: Ctx,
  texto: string,
  opts: { size: number; font: PDFFont; color?: ReturnType<typeof rgb>; lineHeight?: number }
) {
  const { size, font, color = COLOR_INK, lineHeight = 1.5 } = opts;
  const ancho = PAGE_W - MARGIN_X * 2;
  for (const linea of wrapTexto(texto, font, size, ancho)) {
    asegurarEspacio(ctx, size * lineHeight);
    ctx.page.drawText(linea, {
      x: MARGIN_X,
      y: ctx.cursorY - size,
      size,
      font,
      color,
    });
    ctx.cursorY -= size * lineHeight;
  }
}

// =============================================================================
// Generador del escrito "A quien corresponda"
// =============================================================================
async function generarEscritoGenerico(
  values: Record<string, string>
): Promise<Uint8Array> {
  const ctx = await nuevoCtx();

  const lugar = values.lugar ?? "";
  const fecha = formatearFecha(values.fecha);
  if (lugar || fecha) {
    dibujarTexto(ctx, `${lugar}${lugar && fecha ? ", a " : ""}${fecha}`.trim(), {
      size: 11,
      font: ctx.sans,
      color: COLOR_INK_2,
      x: PAGE_W - MARGIN_X - 220,
    });
    ctx.cursorY -= 18;
  }

  const dest = values.destinatario;
  if (dest) {
    dibujarTexto(ctx, dest.toUpperCase(), { size: 12, font: ctx.sansBold });
    if (values.cargo) dibujarTexto(ctx, values.cargo, { size: 11, font: ctx.sans });
    if (values.dependencia)
      dibujarTexto(ctx, values.dependencia, { size: 11, font: ctx.sans, color: COLOR_INK_2 });
    ctx.cursorY -= 14;
  }

  dibujarTexto(ctx, "P R E S E N T E.", { size: 11, font: ctx.sansBold });
  ctx.cursorY -= 18;

  if (values.asunto) {
    dibujarTexto(ctx, `Asunto: ${values.asunto}`, {
      size: 11,
      font: ctx.sansBold,
      color: COLOR_ACCENT,
    });
    ctx.cursorY -= 10;
  }

  if (values.cuerpo) {
    dibujarParrafo(ctx, values.cuerpo, { size: 11, font: ctx.serif, lineHeight: 1.55 });
    ctx.cursorY -= 16;
  }

  if (values.despedida)
    dibujarParrafo(ctx, values.despedida, { size: 11, font: ctx.serif });

  ctx.cursorY -= 60;
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.cursorY },
    end: { x: MARGIN_X + 220, y: ctx.cursorY },
    thickness: 0.6,
    color: COLOR_INK_3,
  });
  ctx.cursorY -= 14;
  if (values.firmante)
    dibujarTexto(ctx, values.firmante, { size: 11, font: ctx.sansBold });
  if (values.cargo_firmante)
    dibujarTexto(ctx, values.cargo_firmante, {
      size: 10,
      font: ctx.sans,
      color: COLOR_INK_2,
    });

  return ctx.doc.save();
}

// =============================================================================
// Generador genérico de "ficha de captura" — útil para AFIL-01 hasta que se
// implemente overlay sobre el PDF oficial. Lista los campos agrupados por
// sección con sus valores. Es legible y permite revisar/imprimir.
// =============================================================================
async function generarFichaCampos(
  tipo: TramiteType,
  values: Record<string, string>
): Promise<Uint8Array> {
  const ctx = await nuevoCtx();

  // Encabezado.
  dibujarTexto(ctx, tipo.code.toUpperCase(), {
    size: 10,
    font: ctx.sansBold,
    color: COLOR_INK_3,
  });
  dibujarTexto(ctx, tipo.name, { size: 18, font: ctx.serifItalic });
  dibujarLineaH(ctx);

  for (const { seccion, campos } of agruparPorSeccion(tipo.field_schema)) {
    asegurarEspacio(ctx, 60);
    dibujarTexto(ctx, seccion.toUpperCase(), {
      size: 9,
      font: ctx.sansBold,
      color: COLOR_INK_3,
    });
    ctx.cursorY -= 4;

    for (const campo of campos) {
      const valor = values[campo.id]?.trim();
      dibujarParCampoValor(ctx, campo, valor);
    }
    ctx.cursorY -= 10;
  }

  // Pie de página con timestamp.
  const pieY = MARGIN_BOTTOM / 2;
  ctx.page.drawText(
    `Generado por tramites-imss · ${new Date().toLocaleString("es-MX")}`,
    {
      x: MARGIN_X,
      y: pieY,
      size: 8,
      font: ctx.sans,
      color: COLOR_INK_3,
    }
  );

  return ctx.doc.save();
}

function dibujarParCampoValor(ctx: Ctx, campo: CampoSchema, valor: string | undefined) {
  asegurarEspacio(ctx, 28);
  ctx.page.drawText(campo.label.toUpperCase(), {
    x: MARGIN_X,
    y: ctx.cursorY - 9,
    size: 8,
    font: ctx.sansBold,
    color: COLOR_INK_3,
  });
  ctx.cursorY -= 12;

  const texto = valor || "—";
  ctx.page.drawText(texto, {
    x: MARGIN_X,
    y: ctx.cursorY - 11,
    size: 11,
    font: valor ? ctx.serif : ctx.sans,
    color: valor ? COLOR_INK : COLOR_INK_3,
  });
  ctx.cursorY -= 14;

  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.cursorY },
    end: { x: PAGE_W - MARGIN_X, y: ctx.cursorY },
    thickness: 0.3,
    color: COLOR_LINE,
  });
  ctx.cursorY -= 10;
}

function formatearFecha(iso: string | undefined | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const meses = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre",
  ];
  return `${parseInt(d, 10)} de ${meses[parseInt(mo, 10) - 1]} de ${y}`;
}

// Punto de entrada — elige el generador correcto según el código.
//
// Prioridad:
//   1) Si existe assets/formatos/<code>.pdf + .coords.json → overlay sobre
//      el PDF oficial del IMSS (caso ideal, queda imprimible y entregable).
//   2) "escrito-generico" → carta formateada desde plantilla.
//   3) Cualquier otro → "ficha de captura" agrupada (legible, pero no es el
//      formato oficial; útil mientras se calibran coordenadas).
export async function generarPDF(
  tipo: TramiteType,
  values: Record<string, string>
): Promise<Uint8Array> {
  if (await existePdfBase(tipo.code)) {
    return generarOverlay(tipo.code, values);
  }
  if (tipo.code === "escrito-generico") {
    return generarEscritoGenerico(values);
  }
  return generarFichaCampos(tipo, values);
}
