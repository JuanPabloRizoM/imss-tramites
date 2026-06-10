// Tests del pipeline de extracción — todo lo determinista:
//
//   1. parsearRespuestaIA — respuestas del modelo (fences, strings sueltos,
//      campos faltantes, tablas, target_fields).
//   2. validarValor — formatos IMSS (Luhn del NSS, DV de CURP, normalización).
//   3. construirPromptSistema — hints de formato inyectados, reglas clave.
//   4. precargarValores contra el catálogo VIVO — escenarios documento →
//      trámite (INE→AFIL-02, TIP→AM-SRT, EMA→AFIL-01, papelito→AM-SRT…).
//
// Correr:  npx tsx scripts/test-extraccion.ts
// Sale con código 1 si algo falla — sirve de gate antes de commitear
// cambios a lib/extraccion.ts, lib/precarga.ts o lib/formatos-imss.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DOC_TYPES,
  construirPromptSistema,
  esFilaArray,
  parsearRespuestaIA,
  type FilaExtraida,
} from "../lib/extraccion";
import { validarValor } from "../lib/formatos-imss";
import { precargarValores } from "../lib/precarga";
import type { CampoSchema, TramiteType } from "../lib/tramites";

let pasaron = 0;
let fallaron = 0;

function ok(nombre: string, cond: boolean, detalle?: string) {
  if (cond) {
    pasaron++;
  } else {
    fallaron++;
    console.error(`  ❌ ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  }
}

function seccion(titulo: string) {
  console.log(`\n━━━ ${titulo}`);
}

// ============================================================================
// 1. Parser de respuestas del modelo
// ============================================================================
seccion("parsearRespuestaIA");
{
  const ine = DOC_TYPES.ine;

  // Respuesta con fences de markdown (el modelo a veces los pone).
  const conFences =
    '```json\n{"nombre":{"valor":"JUAN CARLOS","confianza":"alto"},"curp":{"valor":"X","confianza":"medio"}}\n```';
  const r1 = parsearRespuestaIA(conFences, ine);
  ok(
    "tolera fences ```json",
    (r1.nombre as { valor: string | null }).valor === "JUAN CARLOS"
  );

  // String suelto en lugar de {valor, confianza} → confianza media.
  const r2 = parsearRespuestaIA('{"nombre":"MARIA"}', ine);
  const d2 = r2.nombre as { valor: string | null; confianza: string };
  ok("string suelto → valor con confianza media", d2.valor === "MARIA" && d2.confianza === "medio");

  // Campo no presente en la respuesta → null/bajo (nunca undefined).
  const d3 = r2.curp as { valor: string | null; confianza: string };
  ok("campo faltante → null + bajo", d3.valor === null && d3.confianza === "bajo");

  // target_fields: parsear contra los campos pedidos, no los del doc_type.
  const targets = [
    { id: "curp_trabajador", label: "CURP del trabajador" },
    { id: "salario", label: "Salario" },
  ];
  const docTypeEfectivo = { ...ine, campos: targets, tabla: undefined };
  const r4 = parsearRespuestaIA(
    '{"curp_trabajador":{"valor":"ABC","confianza":"alto"},"salario":{"valor":"500.00","confianza":"alto"}}',
    docTypeEfectivo
  );
  ok(
    "target_fields se conservan al parsear",
    (r4.curp_trabajador as { valor: string | null }).valor === "ABC" &&
      (r4.salario as { valor: string | null }).valor === "500.00"
  );

  // Tabla: filas parseadas; basura no-array → [].
  const ema = DOC_TYPES.sua_ema_eba;
  const r5 = parsearRespuestaIA(
    '{"registro_patronal":{"valor":"B5510768108","confianza":"alto"},"trabajadores":[{"nss":{"valor":"11785837631","confianza":"alto"},"nombre":{"valor":"PEREZ LOPEZ JUAN","confianza":"alto"}}]}',
    ema
  );
  const filas = r5.trabajadores as FilaExtraida[];
  ok("tabla → array de filas", esFilaArray(filas) && filas.length === 1);
  ok("celda de tabla parseada", filas[0]?.nss?.valor === "11785837631");

  const r6 = parsearRespuestaIA(
    '{"registro_patronal":{"valor":"X","confianza":"alto"},"trabajadores":"no hay"}',
    ema
  );
  ok("tabla basura → []", esFilaArray(r6.trabajadores) && (r6.trabajadores as FilaExtraida[]).length === 0);
}

// ============================================================================
// 2. Formatos IMSS
// ============================================================================
seccion("validarValor (formatos IMSS)");
{
  // NSS — el del screenshot real de la cédula del usuario.
  ok("NSS válido con espacios", validarValor("nss", "11 78 58 3763 1")?.valido === true);
  ok("NSS normalizado compacto", validarValor("nss", "11 78 58 3763 1")?.normalizado === "11785837631");
  ok("NSS con Luhn malo → inválido", validarValor("nss", "11785837632")?.valido === false);
  ok("NSS de 10 (sin verificador) → tolerado", validarValor("nss", "1178583763")?.valido === true);
  ok("NSS de 9 → inválido", validarValor("nss", "117858376")?.valido === false);

  // Registro patronal.
  ok("RP con espacios válido", validarValor("registro_patronal", "B55 10768 10 8")?.valido === true);
  ok("RP normalizado", validarValor("registro_patronal", "B55 10768 10 8")?.normalizado === "B5510768108");
  ok("RP no se confunde con RFC", validarValor("registro_patronal", "GOML850101AB3")?.valido === false);

  // CURP — DV calculado con la tabla RENAPO.
  ok("CURP con DV correcto", validarValor("curp", "GORS850101HJCMRL01")?.valido === true);
  ok("CURP con DV alterado → inválida", validarValor("curp", "GORS850101HJCMRL09")?.valido === false);
  ok("CURP entidad inválida → inválida", validarValor("curp", "GORS850101HXXMRL01")?.valido === false);
  ok("CURP por id calificado (curp_trabajador)", validarValor("curp_trabajador", "GORS850101HJCMRL01")?.valido === true);

  // RFC.
  ok("RFC moral 12", validarValor("rfc", "ABC010101AB9")?.valido === true);
  ok("RFC física 13", validarValor("rfc", "GOML8501012H7")?.valido === true);
  ok("RFC con Ñ/&", validarValor("rfc", "Ñ&A010101AB9")?.valido === true);
  ok("RFC corto → inválido", validarValor("rfc", "ABC0101")?.valido === false);

  // Prima / clase / fracción.
  ok("prima 0.50000", validarValor("prima_rt", "0.50000")?.valido === true);
  ok("prima con % se normaliza", validarValor("prima_rt", "0.50000 %")?.normalizado === "0.50000");
  ok("prima 22 fuera de rango", validarValor("prima_rt", "22.00000")?.valido === false);
  ok("clase iii → III", validarValor("clase_rt", "iii")?.normalizado === "III");
  ok("fracción 4 dígitos", validarValor("fraccion", "1012")?.valido === true);

  // Otros.
  ok("teléfono con formato", validarValor("telefono", "(33) 1234-5678")?.normalizado === "3312345678");
  ok("CP 5 dígitos", validarValor("codigo_postal", "44330")?.valido === true);
  ok("fecha con guiones → diagonales", validarValor("fecha_alta", "01-02-2024")?.normalizado === "01/02/2024");
  ok("campo libre → null (no valida)", validarValor("razon_social", "ACME SA DE CV") === null);
}

// ============================================================================
// 3. Construcción de prompts
// ============================================================================
seccion("construirPromptSistema");
{
  // Extracción dirigida: los target_fields reciben hint de formato aunque
  // vengan del field_schema sin hints propios.
  const prompt = construirPromptSistema(DOC_TYPES.generico, [
    { id: "curp_trabajador", label: "CURP del trabajador" },
    { id: "nss", label: "NSS" },
    { id: "razon_social", label: "Razón social" },
  ]);
  ok("target curp_trabajador recibe hint de formato", prompt.includes("18 caracteres"));
  ok("target nss recibe hint de formato", prompt.includes("11 dígitos"));
  ok("regla de nombres mexicanos presente", prompt.includes("convención mexicana"));
  ok("regla de verificación de formato presente", prompt.includes("VERIFICA"));

  // Extracción libre: la descripción del documento entra al prompt.
  const promptIne = construirPromptSistema(DOC_TYPES.ine);
  ok("descripción del INE en extracción libre", promptIne.includes("apellido paterno"));
  ok("orden de líneas del INE explicado", promptIne.includes("línea 1"));

  const promptEma = construirPromptSistema(DOC_TYPES.sua_ema_eba);
  ok("EMA pide tabla de trabajadores", promptEma.includes("trabajadores"));
  ok("EMA distingue mensual/bimestral", promptEma.includes("EBA"));
}

// ============================================================================
// 4. Precarga contra el catálogo vivo — escenarios documento → trámite
// ============================================================================
function leerEnv(clave: string): string {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  const linea = env.split("\n").find((l) => l.startsWith(`${clave}=`));
  if (!linea) throw new Error(`Falta ${clave} en .env.local`);
  return linea.slice(clave.length + 1).trim();
}

// Simula un documento extraído con TODOS los campos del doc_type llenos.
function extraccionCompleta(docTypeId: string): Record<string, unknown> {
  const dt = DOC_TYPES[docTypeId];
  const out: Record<string, unknown> = {};
  for (const c of dt.campos) out[c.id] = { valor: `<${c.id}>`, confianza: "alto" };
  return out;
}

async function escenarios() {
  const url = leerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = leerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const res = await fetch(
    `${url}/rest/v1/tramite_types?select=code,field_schema&active=eq.true`,
    { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }
  );
  const tramites = (await res.json()) as Pick<TramiteType, "code" | "field_schema">[];
  const schemaDe = (code: string): CampoSchema[] => {
    const t = tramites.find((x) => x.code === code);
    if (!t) throw new Error(`Trámite ${code} no está en el catálogo`);
    return t.field_schema as CampoSchema[];
  };

  // Cada escenario: documento → trámite, campos que DEBEN llenarse y
  // campos que NO deben llenarse (protección contra cruces).
  const casos: {
    nombre: string;
    doc: string;
    tramite: string;
    deben: string[];
    noDeben?: string[];
  }[] = [
    {
      nombre: "INE → AFIL-02 (trabajador, no patrón)",
      doc: "ine",
      tramite: "afil-02",
      deben: ["curp_trabajador", "nombre", "apellido_paterno", "apellido_materno"],
      noDeben: ["curp_patron", "rfc_patron"],
    },
    {
      nombre: "Cédula RFC → AFIL-02 (patrón)",
      doc: "cedula_rfc",
      tramite: "afil-02",
      deben: ["rfc_patron"],
      noDeben: ["rfc_trabajador", "curp_trabajador"],
    },
    {
      nombre: "TIP → AM-SRT (clasificación completa)",
      doc: "tip",
      tramite: "am-srt",
      deben: ["registro_patronal", "rfc", "division", "grupo", "fraccion", "clase", "prima_srt", "giro"],
    },
    {
      nombre: "EMA/EBA → AFIL-01 (cabecera del patrón)",
      doc: "sua_ema_eba",
      tramite: "afil-01",
      deben: ["registro_patronal", "rfc", "prima", "clase_riesgo", "fraccion", "actividad_giro", "codigo_postal", "estado"],
      noDeben: ["curp"], // la emisión no trae CURP — se queda para el INE
    },
    {
      nombre: "Propuesta de Cédula → AFIL-01",
      doc: "propuesta_cedula",
      tramite: "afil-01",
      deben: ["registro_patronal", "razon_social", "prima", "clase_riesgo"],
    },
    {
      nombre: "EMA/EBA → AM-SRT",
      doc: "sua_ema_eba",
      tramite: "am-srt",
      deben: ["registro_patronal", "rfc", "prima_srt", "clase", "fraccion", "giro", "codigo_postal"],
    },
    {
      nombre: "Papelito (nota manuscrita) → AM-SRT",
      doc: "nota_manuscrita",
      tramite: "am-srt",
      deben: ["registro_patronal", "rfc", "curp", "nombre", "apellido_paterno", "apellido_materno", "giro", "calle", "colonia", "codigo_postal", "municipio", "estado"],
    },
    {
      nombre: "Papelito → ARP-PF (prealta persona física)",
      doc: "nota_manuscrita",
      tramite: "arp-pf",
      deben: ["curp", "rfc", "nombre", "apellido_paterno", "apellido_materno", "giro"],
    },
    {
      nombre: "Alta patronal → AM-SRT (sustitución: fuente más completa)",
      doc: "alta_patronal",
      tramite: "am-srt",
      deben: ["registro_patronal", "rfc", "division", "grupo", "fraccion", "clase", "prima_srt", "giro", "nombre", "apellido_paterno"],
    },
    {
      nombre: "Comprobante → ARP-PF (domicilio _fiscal)",
      doc: "comprobante_domicilio",
      tramite: "arp-pf",
      deben: ["calle_fiscal", "numero_exterior_fiscal", "colonia_fiscal", "cp_fiscal", "municipio_fiscal", "estado_fiscal"],
    },
    {
      nombre: "INE → Cert. digital (representante _rep)",
      doc: "ine",
      tramite: "cert-digital",
      deben: ["nombre_rep", "apellido_paterno_rep", "apellido_materno_rep", "curp_rep"],
    },
    {
      nombre: "TIP → AFIL-01 reanudación (registro anterior)",
      doc: "tip",
      tramite: "afil-01",
      deben: ["registro_patronal", "causa_b_registro_anterior", "prima", "clase_riesgo", "fraccion"],
    },
  ];

  seccion("precarga: escenarios documento → trámite (catálogo vivo)");
  for (const caso of casos) {
    const schema = schemaDe(caso.tramite);
    const schemaIds = new Set(schema.map((c) => c.id));
    const extraido = extraccionCompleta(caso.doc);
    const precargados = precargarValores(schema, extraido, caso.doc);

    for (const id of caso.deben) {
      if (!schemaIds.has(id)) {
        ok(`${caso.nombre}: "${id}" existe en el schema`, false, "el id esperado no está en el field_schema — corrige el test o el schema");
        continue;
      }
      ok(`${caso.nombre}: llena ${id}`, id in precargados, `quedó vacío`);
    }
    for (const id of caso.noDeben ?? []) {
      ok(`${caso.nombre}: NO llena ${id}`, !(id in precargados), `se llenó con "${precargados[id]}" — cruce indebido`);
    }
  }
}

escenarios()
  .then(() => {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`${pasaron} pasaron · ${fallaron} fallaron`);
    process.exit(fallaron > 0 ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
