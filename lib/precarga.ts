// Matching de datos extraídos contra el field_schema del trámite destino.
//
// El problema: cuando "llevas" un documento desde /apartado-3 a un trámite,
// los IDs de los doc_types no siempre coinciden 1:1 con los del field_schema.
// Casos que cubrimos:
//
//   (a) Aliases de vocabulario: el doc_type dice `numero_notaria` pero el
//       form dice `no_notaria`; `objeto_social` vs `giro`; `clase_rt` vs
//       `clase`/`clase_riesgo`. Mismo dato, distinta llave.
//
//   (b) Sufijos calificadores: AFIL-02/03/04 usan `curp_trabajador` /
//       `curp_patron`; las prealtas usan `calle_fiscal`; cert-digital usa
//       `curp_rep`. El doc_type extrae la base sin sufijo (`curp`, `calle`).
//       Si el schema tiene UN solo lado, no hay ambigüedad → match. Si
//       tiene ambos (curp_trabajador Y curp_patron), desempatamos con el
//       tag `source_doc` del campo: si el campo declara que viene de este
//       tipo de documento (p.ej. curp_trabajador declara source_doc:"ine"
//       y lo subido ES un INE), ese gana y el otro queda vacío.
//
//   (c) Sufijos equivalentes: `_rep` en los schemas ≡ `_representante` en
//       los doc_types (curp_rep ← curp_representante).
//
// Si nada coincide, el campo queda vacío y el usuario lo llena a mano
// (o sube otro documento con el widget de SubirDocumentoTramite en la
// misma pantalla).
//
// La auditoría de cobertura vive en scripts/auditoria-cobertura.ts —
// córrela después de tocar este archivo o los DOC_TYPES.

import type { CampoSchema } from "./tramites";

type DatoExtraido = { valor: string | null; confianza?: string };

// Aliases: schemaId → ids alternos bajo los que el dato puede venir en la
// extracción. Solo equivalencias REALES — nada ambiguo.
const ALIASES: Record<string, string[]> = {
  // Domicilio
  estado: ["entidad"],
  entidad: ["estado"],
  cp: ["codigo_postal"],
  telefono: ["telefono_1", "telefono_fijo"],
  telefono_1: ["telefono"],
  correo: ["correo_electronico", "email"],
  // Acta constitutiva — vocabulario notarial
  no_notaria: ["numero_notaria"],
  no_acta: ["numero_escritura", "numero_acta"],
  fecha_acta: ["fecha_escritura"],
  giro: ["objeto_social", "actividad_economica", "actividad"],
  actividad_giro: ["actividad", "giro", "objeto_social", "actividad_economica"],
  // Riesgos de trabajo — el doc_type usa _rt, los schemas no
  clase: ["clase_rt"],
  clase_riesgo: ["clase_rt", "clase"],
  fraccion: ["fraccion_rt"],
  prima: ["prima_rt"],
  prima_srt: ["prima_rt", "prima"],
  tipo_persona_patron: ["tipo_persona"],
  // Reanudación AFIL-01: el registro de la TIP vieja ES el registro anterior
  causa_b_registro_anterior: ["registro_patronal"],
  // "Nombre(s)" del representante: preferir el de pila sobre el completo
  nombre_rep: ["nombres_representante"],
};

// Sufijos calificadores que aparecen en los field_schemas.
const SUFIJOS = [
  "_trabajador",
  "_patron",
  "_representante",
  "_rep",
  "_fiscal",
];

// Sufijos que significan lo mismo en schema vs doc_type.
const SUFIJOS_EQUIVALENTES: Record<string, string[]> = {
  _rep: ["_representante"],
  _representante: ["_rep"],
};

function quitarSufijo(id: string): { base: string; sufijo: string } | null {
  for (const suf of SUFIJOS) {
    if (id.endsWith(suf)) return { base: id.slice(0, -suf.length), sufijo: suf };
  }
  return null;
}

// Para cada campo del schema, intenta encontrar un valor en `extraido`.
// `docTypeId` (opcional) es el doc_type del documento del que vienen los
// datos — se usa para desempatar ambigüedades vía el tag source_doc.
// Devuelve Record<id, string> solo con los campos que sí matchearon.
export function precargarValores(
  schema: CampoSchema[],
  extraido: Record<string, unknown> | null | undefined,
  docTypeId?: string | null
): Record<string, string> {
  if (!extraido) return {};
  const out: Record<string, string> = {};
  const schemaIds = new Set(schema.map((c) => c.id));

  for (const campo of schema) {
    const valor = encontrarValor(campo, extraido, schemaIds, docTypeId);
    if (valor !== null) out[campo.id] = valor;
  }
  return out;
}

function encontrarValor(
  campo: CampoSchema,
  extraido: Record<string, unknown>,
  schemaIds: Set<string>,
  docTypeId?: string | null
): string | null {
  const schemaId = campo.id;

  // 1) Match directo.
  const directo = leerValor(extraido[schemaId]);
  if (directo !== null) return directo;

  // 2) Aliases del id completo.
  for (const alias of ALIASES[schemaId] ?? []) {
    const v = leerValor(extraido[alias]);
    if (v !== null) return v;
  }

  const partes = quitarSufijo(schemaId);

  if (partes) {
    const { base, sufijo } = partes;

    // 3) Sufijo equivalente: curp_rep ← curp_representante. Sin ambigüedad
    //    posible (el sufijo califica igual en ambos lados).
    for (const eq of SUFIJOS_EQUIVALENTES[sufijo] ?? []) {
      const v = leerValor(extraido[base + eq]);
      if (v !== null) return v;
    }

    // 4) Base sin sufijo en el extraído (curp_trabajador ← curp).
    //    Ambiguo si el schema tiene la base pelona u otro sufijo para la
    //    misma base (¿de quién es el dato?). Desempate: si ESTE campo
    //    declara source_doc igual al doc_type del documento, gana.
    const hayHermanos =
      schemaIds.has(base) ||
      SUFIJOS.some((s) => s !== sufijo && schemaIds.has(base + s));
    const declaraFuente =
      docTypeId != null && campo.source_doc === docTypeId;
    if (!hayHermanos || declaraFuente) {
      const v = leerValor(extraido[base]);
      if (v !== null) return v;
      // …y los aliases de la base (cp_fiscal → cp → codigo_postal).
      for (const alias of ALIASES[base] ?? []) {
        const va = leerValor(extraido[alias]);
        if (va !== null) return va;
      }
    }
    return null;
  }

  // 5) Espejo: el schema pide la base pelona (`curp`) y el extraído viene
  //    calificado (`curp_trabajador`). Solo si el schema NO usa sufijos
  //    para esa base (si los usa, cada lado ya se resuelve arriba).
  for (const suf of SUFIJOS) {
    if (schemaIds.has(schemaId + suf)) continue;
    const v = leerValor(extraido[schemaId + suf]);
    if (v !== null) return v;
  }

  return null;
}

// Los datos extraídos vienen como {valor, confianza} envuelto. Sacamos
// el string crudo si existe y no está vacío.
function leerValor(raw: unknown): string | null {
  if (raw && typeof raw === "object" && "valor" in raw) {
    const v = (raw as DatoExtraido).valor;
    return typeof v === "string" && v.length > 0 ? v : null;
  }
  if (typeof raw === "string" && raw.length > 0) return raw;
  return null;
}
