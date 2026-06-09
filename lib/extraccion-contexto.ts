import type { CampoSchema } from "./tramites";

// Algunos doc_types son inequívocos sobre a quién pertenecen los datos
// (TIP → patrón, Acta → patrón, INE del representante → patrón). En esos
// casos no preguntamos y filtramos automáticamente target_fields al lado
// correcto. En los demás (INE, Cédula RFC, comprobante, genérico) los datos
// pueden ser del trabajador o del patrón — preguntamos antes de subir.
export const CONTEXTO_FORZADO_POR_DOC_TYPE: Record<
  string,
  "patron" | "trabajador" | "representante"
> = {
  tip: "patron",
  acta_constitutiva: "patron",
  ine_representante: "representante",
};

export type Contexto = "trabajador" | "patron" | "ambos";

// Decide si un campo cae del lado del trabajador o del patrón según el
// nombre de su section. Encabezado (fechas, UMF, etc.) se incluye en ambos.
export function pertenecePara(
  campo: CampoSchema,
  contexto: Contexto
): boolean {
  if (contexto === "ambos") return true;
  const sec = (campo.section ?? "").toLowerCase();
  // Encabezado / sin sección: aplica a ambos.
  if (sec === "" || sec.includes("encabezado")) return true;
  if (contexto === "trabajador") {
    return sec.includes("trabajador") || sec.includes("domicilio");
  }
  // contexto === "patron"
  return (
    sec.includes("patr") ||
    sec.includes("centro de trabajo") ||
    sec.includes("ubicaci")
  );
}

// Helper: si el doc_type fuerza un contexto (TIP, Acta, INE rep), lo devuelve
// como "trabajador" | "patron"; si no, devuelve el contexto que el usuario
// haya elegido. "representante" se mapea a "patron" para fines de filtrado
// de campos.
export function contextoEfectivo(
  docType: string,
  contextoElegido: Contexto
): Contexto {
  const forzado = CONTEXTO_FORZADO_POR_DOC_TYPE[docType];
  if (forzado === "representante") return "patron";
  return forzado ?? contextoElegido;
}

export function requierePreguntarContexto(docType: string): boolean {
  return CONTEXTO_FORZADO_POR_DOC_TYPE[docType] === undefined;
}
