// Genera un PDF de prueba para calibrar coordenadas de overlay.
//
// Uso:
//   node tools/calibrar-pdf.mjs afil-01
//   node tools/calibrar-pdf.mjs am-srt
//
// Produce dos archivos en /tmp:
//   /tmp/<codigo>-prueba.pdf         — overlay con datos de muestra encima del PDF base.
//   /tmp/<codigo>-grilla.pdf         — overlay con grilla numerada cada 20 pt (X y Y) y los datos.
//
// Workflow para calibrar:
//   1) Genera el PDF de grilla.
//   2) Ábrelo. Identifica para cada campo en qué (x, y) caería bien (los números
//      están sobre los ejes — léelos directamente).
//   3) Edita assets/formatos/<codigo>.coords.json con esas (x, y).
//   4) Vuelve a generar; repite hasta que quede bien.

import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const codigo = process.argv[2];
if (!codigo) {
  console.error("Uso: node tools/calibrar-pdf.mjs <codigo>");
  console.error("Códigos disponibles: afil-01, am-srt");
  process.exit(1);
}

const ROOT = "assets/formatos";
const pdfPath = path.join(ROOT, `${codigo}.pdf`);
const coordsPath = path.join(ROOT, `${codigo}.coords.json`);

const pdfBytes = await fs.readFile(pdfPath);
const coords = JSON.parse(await fs.readFile(coordsPath, "utf8"));

const valoresMuestra = {
  // ── AFIL-01 ──
  fecha_solicitud: "2026-05-16", causa_aviso: "A",
  razon_social: "MUEBLERIA HERMANOS RIZO S.A. DE C.V.",
  rfc: "MHR240101ABC", curp: "RIZO850101HJCABC09",
  nombre: "JUAN", apellido_paterno: "RIZO", apellido_materno: "MACÍAS",
  clase_riesgo: "II", registro_patronal: "Y12-34567-10",
  fraccion: "458", actividad_giro: "Comercio de muebles",
  prima: "0.50625", fecha_causa: "2026-05-01",
  codigo_postal: "44100", calle: "Av. Vallarta",
  numero_exterior: "1234", numero_interior: "5", colonia: "Centro",
  localidad: "Guadalajara", municipio: "Guadalajara", estado: "Jalisco",
  telefono: "33-3333-3333", correo: "papeleria@example.com",
  no_notaria: "23", no_acta: "5,432", no_libro: "12", no_foja: "108",
  registro_publico: "RPP-2024-001", informacion_adicional: "—",
  lugar_fecha_constitucion: "Guadalajara, Jalisco, 15 de marzo de 2024",
  causa_b_nombre_anterior: "MUEBLES ANTERIORES SA DE CV",
  causa_b_registro_anterior: "Y11-1111-11",
  causa_c_cp_anterior: "44200", causa_c_calle_anterior: "Hidalgo",
  causa_c_num_ext_int_anterior: "100-A", causa_c_colonia_anterior: "Reforma",
  causa_c_municipio_anterior: "Zapopan", causa_c_estado_anterior: "JAL",
  causa_d_nombre_anterior: "RAZON SOCIAL ANTERIOR SA",
  causa_e_nombre_sustituido: "PATRON ANTERIOR SA DE CV",
  causa_e_registro_sustituido: "Y22-2222-22",
  causa_f_registro_1: "Y33-3333-33", causa_f_registro_2: "Y44-4444-44",
  causa_g_motivo: "Cese de operaciones por jubilación del titular.",
  // ── AM-SRT ──
  fecha_presentacion: "2026-05-16", fecha_modificacion: "2026-05-01",
  division: "5", grupo: "55", clase: "II", prima_srt: "0.50625",
  tipo_modificacion: "cambio_actividad",
  delegacion_baja: "Jal-1", subdelegacion_baja: "02", fecha_baja: "2026-04-30",
  entre_calles: "López Cotilla", calle_posterior: "Vallarta",
  telefono_1: "33-3333-3333", telefono_2: "33-4444-4444",
  giro: "Comercio de muebles para el hogar",
  presta_servicios_personal: "no",
};

async function generar(conGrilla) {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const C = rgb(0.08, 0.08, 0.12);
  const G = rgb(0.85, 0.20, 0.20);

  const flat = { ...valoresMuestra };
  for (const [k, v] of Object.entries(valoresMuestra)) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
    if (m) { flat[k+"_dd"]=m[3]; flat[k+"_mm"]=m[2]; flat[k+"_aaaa"]=m[1]; }
  }

  const pages = doc.getPages();

  // 1) Datos.
  for (const [id, conf] of Object.entries(coords.campos)) {
    if (conf.type === "checkbox-grid") {
      const v = flat[id]; if (!v) continue;
      const opt = conf.options[v]; if (!opt) continue;
      pages[opt.page ?? conf.page ?? 0].drawText("X", {
        x: opt.x, y: opt.y, size: opt.size ?? 10, font: fontBold, color: C
      });
      continue;
    }
    const v = flat[id]; if (!v) continue;
    pages[conf.page ?? 0].drawText(String(v), {
      x: conf.x, y: conf.y, size: conf.size ?? 9, font, color: C
    });
  }

  // 2) Grilla de calibración (opcional).
  if (conGrilla) {
    for (const page of pages) {
      const w = page.getWidth(), h = page.getHeight();
      for (let x = 0; x <= w; x += 20) {
        page.drawLine({
          start: { x, y: 0 }, end: { x, y: h },
          thickness: x % 100 === 0 ? 0.4 : 0.15,
          color: G, opacity: 0.35,
        });
        if (x % 40 === 0) {
          page.drawText(String(x), { x: x + 1, y: h - 8, size: 5, font, color: G });
          page.drawText(String(x), { x: x + 1, y: 4,       size: 5, font, color: G });
        }
      }
      for (let y = 0; y <= h; y += 20) {
        page.drawLine({
          start: { x: 0, y }, end: { x: w, y },
          thickness: y % 100 === 0 ? 0.4 : 0.15,
          color: G, opacity: 0.35,
        });
        if (y % 40 === 0) {
          page.drawText(String(y), { x: 2,       y: y + 1, size: 5, font, color: G });
          page.drawText(String(y), { x: w - 18,  y: y + 1, size: 5, font, color: G });
        }
      }
    }
  }

  return doc.save();
}

const a = await generar(false);
const b = await generar(true);
await fs.writeFile(`/tmp/${codigo}-prueba.pdf`, a);
await fs.writeFile(`/tmp/${codigo}-grilla.pdf`, b);
console.log(`OK
  /tmp/${codigo}-prueba.pdf   — overlay limpio para ver cómo queda
  /tmp/${codigo}-grilla.pdf   — overlay con grilla cada 20 pt (lee X y Y directo)`);
