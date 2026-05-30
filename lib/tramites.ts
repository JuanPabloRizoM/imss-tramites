// Tipos compartidos del motor genérico (Principio 1.1).
//
// Un trámite es: una lista de campos (field_schema) + una lista de documentos
// fuente. El form, la generación de PDF y el llenado de la extensión leen
// todos desde la misma estructura.

export type CampoTipo = "text" | "textarea" | "date" | "number" | "select" | "checkbox";

export type CampoSchema = {
  id: string;
  label: string;
  type: CampoTipo;
  required?: boolean;
  section?: string;
  source_doc?: string | null;
  options?: string[];
  placeholder?: string;
  // Selector CSS del campo en el portal externo (p. ej. "#txtRfc" o
  // '[name="DN_O"]'). Lo lee la extensión de navegador.
  portal_selector?: string | null;
  // Si el portal usa el texto visible de las options (vs. su value),
  // "text" hace que la extensión busque por textContent. Default: "value".
  portal_option_match?: "text" | "value";
  // Para selects dependientes que se popula vía DWR cuando cambia el padre.
  portal_chain?: { parent: string };
  // Datepicker de jQuery: setear value + disparar change.
  portal_datepicker?: boolean;
  // No inyectar este campo al portal — solo guardarlo o mostrarlo en el panel.
  portal_skip?: boolean;
  // Mostrar este texto en el panel flotante de la extensión como nota.
  portal_show_in_panel?: boolean;
  // Condición de visibilidad: solo mostrar este campo si el campo `campo`
  // tiene un valor que coincide con `igual` (string) o está en `en` (array).
  // Útil para sub-formularios que dependen de una causa/tipo elegido.
  show_if?: { campo: string; igual?: string; en?: string[] };
};

export function debeMostrar(
  campo: CampoSchema,
  valores: Record<string, string | null | undefined>
): boolean {
  if (!campo.show_if) return true;
  const v = (valores[campo.show_if.campo] ?? "").toString().trim();
  if (campo.show_if.igual != null) return v === campo.show_if.igual;
  if (campo.show_if.en) return campo.show_if.en.includes(v);
  return true;
}

// Algunos trámites (AFIL-01, AM-SRT) tienen CASOS: subtipos del mismo trámite
// con diferentes campos y diferentes documentos fuente. El usuario elige el
// caso ANTES de capturar nada. Si `cases` es null/[], el trámite no tiene
// casos y se comporta como antes (un solo flujo lineal con todos los campos).
export type CasoTramite = {
  id: string; // Ej. "A", "C"
  label: string;
  description?: string;
  // IDs de campos del field_schema que SI aplican a este caso. Si vacío:
  // todos. Si presente: solo estos se muestran/validan/incluyen en el PDF.
  required_fields: string[];
  // IDs de doc types (de DOC_TYPES) que este caso necesita extraer.
  required_source_docs: string[];
};

export type TramiteType = {
  id: string;
  code: string;
  name: string;
  apartado: number;
  output_type: "pdf" | "extension" | "copy";
  field_schema: CampoSchema[];
  source_docs: string[];
  cases: CasoTramite[] | null;
  portal_url: string | null;
  active: boolean;
};

// Devuelve solo los campos del schema que el caso requiere. Si caso es null,
// regresa todo el schema sin filtrar (trámite sin casos).
export function camposDelCaso(
  schema: CampoSchema[],
  caso: CasoTramite | null
): CampoSchema[] {
  if (!caso || caso.required_fields.length === 0) return schema;
  const setIds = new Set(caso.required_fields);
  return schema.filter((c) => setIds.has(c.id));
}

export function tieneCasos(t: Pick<TramiteType, "cases">): boolean {
  return Array.isArray(t.cases) && t.cases.length > 0;
}

export type Tramite = {
  id: string;
  tramite_type_id: string;
  status: "nuevo" | "en_proceso" | "revisado" | "completado";
  field_values: Record<string, string | null>;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

// Regla de presentación: el IMSS y los formatos oficiales se llenan en
// MAYÚSCULAS. Aplicamos la regla al momento de SALIDA (PDF, portal vía
// extensión, copy-paste), no mientras el usuario tipea.
//
//   text   → MAYÚSCULAS
//   number → preservar (números, sin caso)
//   date   → preservar (formato fecha)
//   select → preservar (corresponde a un código del catálogo, ej. "A", "II",
//            "reanudacion" — no se debe alterar)
//   checkbox → preservar
//   textarea → preservar (notas, descripciones, cuerpo de escritos, giro
//              detallado, etc. — texto largo donde el caso original importa)
export function normalizarParaSalida(
  schema: CampoSchema[],
  values: Record<string, string | null | undefined>
): Record<string, string> {
  const porId = new Map(schema.map((c) => [c.id, c]));
  const out: Record<string, string> = {};

  for (const [id, raw] of Object.entries(values)) {
    const valor = (raw ?? "").toString();
    if (valor === "") {
      out[id] = "";
      continue;
    }
    const campo = porId.get(id);
    const preservar =
      !campo ||
      campo.type === "textarea" ||
      campo.type === "date" ||
      campo.type === "number" ||
      campo.type === "select" ||
      campo.type === "checkbox";
    out[id] = preservar ? valor : valor.trim().toUpperCase();
  }
  return out;
}

// Agrupa los campos en su orden original, conservando el orden de aparición
// de las secciones.
export function agruparPorSeccion(
  schema: CampoSchema[]
): { seccion: string; campos: CampoSchema[] }[] {
  const grupos = new Map<string, CampoSchema[]>();
  for (const c of schema) {
    const sec = c.section?.trim() || "Datos";
    const lista = grupos.get(sec) ?? [];
    lista.push(c);
    grupos.set(sec, lista);
  }
  return Array.from(grupos.entries()).map(([seccion, campos]) => ({
    seccion,
    campos,
  }));
}
