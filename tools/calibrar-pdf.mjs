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
  codigo_postal: "44100", calle: "AV. VALLARTA",
  numero_exterior: "1234", numero_interior: "5", colonia: "CENTRO",
  localidad: "GUADALAJARA", municipio: "GUADALAJARA", estado: "JALISCO",
  telefono: "33-3333-3333", correo: "papeleria@example.com",
  no_notaria: "23", no_acta: "5,432", no_libro: "12", no_foja: "108",
  registro_publico: "RPP-2024-001", informacion_adicional: "—",
  lugar_fecha_constitucion: "Guadalajara, Jalisco, 15 de marzo de 2024",
  causa_b_nombre_anterior: "MUEBLES ANTERIORES SA DE CV",
  causa_b_registro_anterior: "Y11-1111-11",
  causa_c_domicilio_anterior:
    "HIDALGO 100-A, COL. REFORMA, ZAPOPAN, JAL., C.P. 44200",
  causa_d_nombre_anterior: "RAZON SOCIAL ANTERIOR SA",
  causa_e_nombre_sustituido: "PATRON ANTERIOR SA DE CV",
  causa_e_registro_sustituido: "Y22-2222-22",
  causa_f_registro_1: "Y33-3333-33", causa_f_registro_2: "Y44-4444-44",
  causa_g_motivo: "Cese de operaciones por jubilación del titular.",
  // ── AM-SRT ── (CONSTRUCTORA TEST — datos coherentes del form en vivo)
  fecha_presentacion: "2026-05-16", fecha_modificacion: "2026-05-01",
  razon_social: "CONSTRUCTORA TEST SA DE CV",
  division: "4", grupo: "41", fraccion: "4101", clase: "V", prima_srt: "7.58875",
  // III.1 descripciones (mirror via `from`).
  // Clase NO lleva descripción — solo el romano (I-V) ya va en `clase`.
  division_descripcion: "INDUSTRIA DE LA CONSTRUCCIÓN",
  grupo_descripcion: "CONSTRUCCIÓN, RECONSTRUCCIÓN Y ENSAMBLE",
  fraccion_descripcion: "CONSTRUCCIÓN DE EDIFICIOS Y CASAS",
  tipo_modificacion: "cambio_actividad",
  delegacion_baja: "Jal-1", subdelegacion_baja: "02", fecha_baja: "2026-04-30",
  entre_calles: "López Cotilla", calle_posterior: "Vallarta",
  telefono_1: "33-3333-3333", telefono_2: "33-4444-4444",
  giro: "CONSTRUCCIÓN DE CASAS HABITACIÓN",
  presta_servicios_personal: "no",
  // IV.1 / IV.2
  productos_elaborados:
    "CASAS HABITACION\nEDIFICIOS RESIDENCIALES\nOFICINAS\nBODEGAS INDUSTRIALES\nCENTROS COMERCIALES\nESCUELAS\nCLINICAS Y HOSPITALES\nCONJUNTOS HABITACIONALES\nDEPARTAMENTOS\nLOCALES COMERCIALES",
  materias_primas:
    "CEMENTO, ARENA, GRAVA, VARILLA, BLOCK, AGUA, ALAMBRE, MADERA, YESO, PINTURA",
  // IV.4 — Maquinaria y equipo
  maquinaria_unidades: "2\n1\n3\n5\n1",
  maquinaria_nombre:
    "REVOLVEDORA\nTORRE GRUA\nVIBRADOR\nMARTILLO ELECTRICO\nSOLDADORA",
  maquinaria_uso:
    "MEZCLAR CONCRETO\nIZAJE DE CARGA\nCOMPACTAR CONCRETO\nDEMOLICION\nUNIR PIEZAS METALICAS",
  maquinaria_tipo:
    "MOTORIZADOS NO AUTOMATIZADOS\nAUTOMATIZADOS\nMOTORIZADOS NO AUTOMATIZADOS\nMOTORIZADOS NO AUTOMATIZADOS\nMOTORIZADOS NO AUTOMATIZADOS",
  maquinaria_capacidad: "1 M3\n5 TON\n2 HP\n1500 W\n200 AMP",
  // IV.5 — Equipo de transporte
  cuenta_equipo_transporte: "SI",
  transporte_unidades: "1\n2\n1\n3\n1",
  transporte_nombre:
    "CAMIONETA PICK-UP\nMONTACARGAS\nCAMION DE VOLTEO\nGRUA HIDRAULICA\nMOTOCICLETA",
  transporte_uso:
    "TRANSPORTE DE MATERIAL\nCARGA Y DESCARGA\nTRANSPORTE DE GRAVA\nIZAJE\nMENSAJERIA",
  transporte_combustible: "GASOLINA\nDIESEL\nDIESEL\nDIESEL\nGASOLINA",
  transporte_capacidad: "1 TON\n3 TON\n7 M3\n10 TON\n150 CC",
  // IV.6 — Procesos
  procesos_principales:
    "SE LLEGA A LA CASA SE INSPECCIONA LOS ARREGLOS QUE HAY QUE HACER Y SE COTIZA AL CLIENTE. SE LE EXPLICA AL DUEÑO QUÉ MATERIALES SE OCUPAN Y SE ACUERDA UNA FECHA DE INICIO. SE FIRMA UN CONTRATO BREVE Y SE COMPRAN LOS INSUMOS.",
  procesos_intermedios:
    "SE MANEJAN LOS HORARIOS PARA TRABAJAR Y NO INVADIR MUCHO LAS HABITACIONES OCUPADAS. SE HACEN LAS REPARACIONES A LA CASA SIGUIENDO EL ORDEN DE LO MÁS URGENTE A LO MENOS. SE PROTEGEN LOS MUEBLES Y SE LIMPIA CADA DÍA DESPUÉS DEL TURNO.",
  procesos_finales:
    "SE ENTREGAN LOS ARREGLOS Y SE REVISAN LOS ACABADOS JUNTO CON EL CLIENTE. SE COBRA EL SALDO PENDIENTE Y SE LE ENTREGA UN COMPROBANTE. SE OFRECE UNA GARANTÍA DE 30 DÍAS POR CUALQUIER DETALLE.",
  // IV.7 — Personal por oficio
  personal_num_izq: "5\n3\n2\n1\n4\n2",
  personal_oficio_izq: "ALBAÑIL\nELECTRICISTA\nPLOMERO\nINGENIERO\nAYUDANTE\nSOLDADOR",
  personal_num_der: "2\n1\n1\n3\n1\n1",
  personal_oficio_der: "CARPINTERO\nPINTOR\nSUPERVISOR\nALMACENISTA\nCHOFER\nAUXILIAR",
  // IV.8
  distribucion_mercancias: "CON TRANSPORTE PROPIO",
  servicios_terceros: "NO",
  // V — Empresa sustituida o fusionada
  sustituida_razon_social: "CONSTRUCTORA ANTERIOR SA DE CV",
  sustituida_nombre: "PEDRO",
  sustituida_apellido_paterno: "RAMÍREZ",
  sustituida_apellido_materno: "LÓPEZ",
  sustituida_curp: "RALP800101HJCMPD05",
  sustituida_registro_patronal: "Y11-1111-11",
  sustituida_rfc: "RAL800101ABC",
  sustituida_division: "4", sustituida_grupo: "41", sustituida_fraccion: "4101",
  sustituida_clase: "V", sustituida_prima_srt: "7.58875",
  // ── AFIL-02 / AFIL-03 / AFIL-04 — trabajador + patrón ──
  fecha_publicacion_dof: "2015-07-31",
  fecha_solicitud: "2026-06-05",
  umf: "045",
  nss: "12345678901",
  curp_trabajador: "RIZO850101HJCABC09",
  rfc_trabajador: "RIZO850101AB1",
  // nombre/apellido_paterno/apellido_materno: ya están arriba (AFIL-01)
  sexo: "1",
  fecha_nacimiento: "1985-01-01",
  lugar_nacimiento: "JALISCO",
  ocupacion: "OBRERO GENERAL",
  horario_reducido: "L-V 8:00 A 14:00",
  salario_base: "350.00",
  salario_base_anterior: "300.00",
  fecha_modificacion: "2026-06-01",
  tipo_contratacion: "1",
  tipo_salario: "0",
  fecha_ingreso: "2026-05-15",
  fecha_baja: "2026-05-30",
  causa_baja: "TERMINO DE OBRA",
  fecha_reingreso: "2026-06-01",
  nombre_padre: "JOSE RIZO HERNANDEZ",
  nombre_madre: "MARIA MACIAS LOPEZ",
  codigo_postal_trabajador: "44600",
  calle_trabajador: "CALLE DEL SOL",
  numero_exterior_trabajador: "456",
  numero_interior_trabajador: "B",
  colonia_trabajador: "REFORMA",
  localidad_trabajador: "GUADALAJARA",
  municipio_trabajador: "GUADALAJARA",
  estado_trabajador: "JALISCO",
  rfc_patron: "MHR240101ABC",
  curp_patron: "RIZO850101HJCABC09",
  codigo_postal_ct: "44100",
  calle_ct: "AV VALLARTA",
  numero_exterior_ct: "1234",
  numero_interior_ct: "5",
  colonia_ct: "CENTRO",
  localidad_ct: "GUADALAJARA",
  municipio_ct: "GUADALAJARA",
  estado_ct: "JALISCO",
  // VI — Bienes
  bienes_cantidad: "1\n3\n10\n2",
  bienes_descripcion:
    "REVOLVEDORA INDUSTRIAL DE 1 M3\nTORRES GRÚA DE 5 TON\nMARTILLOS DEMOLEDORES ELÉCTRICOS\nSOLDADORAS DE ARCO 200 AMP",
  bienes_uso:
    "ESTOS BIENES SE UTILIZAN DENTRO DE LA OPERACIÓN DIARIA DE LA OBRA PARA MEZCLAR CONCRETO EN VOLÚMENES PEQUEÑOS Y MEDIANOS, MOVER CARGAS PESADAS DE ACERO Y BLOCK ENTRE NIVELES, DEMOLER MUROS Y LOSAS DURANTE REMODELACIONES, Y EJECUTAR LOS TRABAJOS DE SOLDADURA ESTRUCTURAL.",
  bienes_afectacion:
    "LA INCORPORACIÓN DE ESTOS BIENES NO AFECTA NEGATIVAMENTE LA ACTIVIDAD MANIFESTADA; AL CONTRARIO, AMPLÍA LA CAPACIDAD INSTALADA Y PERMITE ATENDER OBRAS DE MAYOR ENVERGADURA SIN SUBCONTRATAR EQUIPO. NO CAMBIA EL GIRO NI LA CLASIFICACIÓN DE RIESGO.",
};

async function generar(conGrilla) {
  const doc = await PDFDocument.load(pdfBytes);
  // Mismo recorte que el server (lib/pdf-overlay.ts) — solo deja las
  // primeras N páginas si el coords lo indica.
  if (coords._max_paginas && coords._max_paginas > 0) {
    const total = doc.getPageCount();
    for (let i = total - 1; i >= coords._max_paginas; i--) doc.removePage(i);
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const C = rgb(0.08, 0.08, 0.12);
  const G = rgb(0.85, 0.20, 0.20);

  // Tapar áreas pre-impresas (mismo comportamiento que el server).
  if (coords._tapar) {
    const pgs = doc.getPages();
    for (const r of coords._tapar) {
      const page = pgs[r.page ?? 0];
      if (!page) continue;
      const [cr, cg, cb] = r.color ?? [1, 1, 1];
      page.drawRectangle({ x: r.x, y: r.y, width: r.width, height: r.height, color: rgb(cr, cg, cb) });
    }
  }

  const flat = { ...valoresMuestra };
  for (const [k, v] of Object.entries(valoresMuestra)) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
    if (m) { flat[k+"_dd"]=m[3]; flat[k+"_mm"]=m[2]; flat[k+"_aaaa"]=m[1]; }
  }

  const pages = doc.getPages();
  const defaultSize = coords._default_size ?? 9;

  const truncar = (texto, size, ancho) => {
    if (!ancho || ancho <= 0) return texto;
    if (font.widthOfTextAtSize(texto, size) <= ancho) return texto;
    let cur = texto;
    while (cur.length > 1 && font.widthOfTextAtSize(cur + "…", size) > ancho) {
      cur = cur.slice(0, -1);
    }
    return cur + "…";
  };

  // 1) Datos. Mirror exacto de lib/pdf-overlay.ts (from, text-wrap, table-cells, checkbox-grid, texto).
  for (const [id, conf] of Object.entries(coords.campos)) {
    const valueKey = conf.from ?? id;

    if (conf.type === "checkbox-grid") {
      // En el PDF de calibración pintamos X sobre TODAS las opciones a la vez
      // para verificar que cada coordenada cae dentro de su casilla. El
      // overlay real (lib/pdf-overlay.ts) sí elige solo una.
      for (const opt of Object.values(conf.options)) {
        pages[opt.page ?? conf.page ?? 0].drawText("X", {
          x: opt.x, y: opt.y, size: opt.size ?? 10, font: fontBold, color: C
        });
      }
      continue;
    }

    if (conf.type === "text-wrap") {
      const valor = (flat[valueKey] ?? "").toString().trim();
      if (!valor) continue;
      const palabras = valor.replace(/\s+/g, " ").split(" ");
      let idx = 0;
      for (const cell of conf.cells) {
        if (idx >= palabras.length) break;
        const page = pages[cell.page ?? 0]; if (!page) continue;
        const size = cell.size ?? defaultSize;
        const ancho = cell.ancho_max ?? 540;
        let linea = "";
        while (idx < palabras.length) {
          const cand = linea ? `${linea} ${palabras[idx]}` : palabras[idx];
          if (font.widthOfTextAtSize(cand, size) > ancho) {
            if (!linea) { linea = truncar(palabras[idx], size, ancho); idx++; }
            break;
          }
          linea = cand; idx++;
        }
        if (linea) page.drawText(linea, { x: cell.x, y: cell.y, size, font, color: C });
      }
      continue;
    }

    if (conf.type === "table-cells") {
      const valor = (flat[valueKey] ?? "").toString();
      if (!valor.trim()) continue;
      const items = valor.split(/[,\n]/g).map((s) => s.trim()).filter(Boolean);
      for (let i = 0; i < Math.min(items.length, conf.cells.length); i++) {
        const cell = conf.cells[i];
        const page = pages[cell.page ?? 0]; if (!page) continue;
        const size = cell.size ?? defaultSize;
        const texto = truncar(items[i], size, cell.ancho_max);
        page.drawText(texto, { x: cell.x, y: cell.y, size, font, color: C });
      }
      continue;
    }

    const v = flat[valueKey]; if (v == null || String(v).trim() === "") continue;
    const size = conf.size ?? defaultSize;
    const texto = truncar(String(v), size, conf.ancho_max);
    pages[conf.page ?? 0].drawText(texto, {
      x: conf.x, y: conf.y, size, font, color: C
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
