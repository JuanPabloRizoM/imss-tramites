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
  portal_selector?: string | null;
  options?: string[];
  placeholder?: string;
};

export type TramiteType = {
  id: string;
  code: string;
  name: string;
  apartado: number;
  output_type: "pdf" | "extension" | "copy";
  field_schema: CampoSchema[];
  source_docs: string[];
  portal_url: string | null;
  active: boolean;
};

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
