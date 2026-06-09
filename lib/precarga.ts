// Matching de datos extraídos contra el field_schema del trámite destino.
//
// El problema: cuando "llevas" un documento desde /apartado-3 a un trámite,
// los IDs de los doc_types no siempre coinciden 1:1 con los del field_schema.
// Casos:
//
//   (a) Aliases simples: el doc_type dice `entidad` pero el form dice
//       `estado`. Mismo dato.
//
//   (b) Sufijos por rol: AFIL-02/03/04 usan `curp_trabajador`,
//       `curp_patron`. El doc_type extrae `curp` (sin sufijo). Si el
//       schema tiene SOLO `curp_trabajador` (no `_patron`), no hay
//       ambigüedad → match. Si tiene ambos, no matcheamos para evitar
//       meter el dato en el lado equivocado.
//
//   (c) Variantes numeradas: el form dice `telefono_1` y el doc dice
//       `telefono`. Match al primer slot.
//
// Si nada coincide, el campo queda vacío y el usuario lo llena a mano
// (o sube otro documento con el widget de SubirDocumentoTramite en la
// misma pantalla).

import type { CampoSchema } from "./tramites";

type DatoExtraido = { valor: string | null; confianza?: string };

// Aliases bidireccionales: si extracted tiene "A", también busca como "B".
// Solo metemos aliases REALMENTE equivalentes — no aliases ambiguos.
const ALIASES: Record<string, string[]> = {
  estado: ["entidad"],
  entidad: ["estado"],
  telefono: ["telefono_1", "telefono_fijo"],
  telefono_1: ["telefono"],
  correo: ["correo_electronico", "email"],
};

// Sufijos de rol que aparecen en field_schemas de AFIL-02/03/04.
const SUFIJOS_ROL = ["_trabajador", "_patron", "_representante"];

function quitarSufijoRol(id: string): string | null {
  for (const suf of SUFIJOS_ROL) {
    if (id.endsWith(suf)) return id.slice(0, -suf.length);
  }
  return null;
}

// Para cada campo del schema, intenta encontrar un valor en `extraido`
// usando: match directo, aliases, o sufijo de rol sin ambigüedad.
// Devuelve un Record<id, string> con los campos que sí se pudieron
// precargar (los que no, no aparecen — el caller los inicializa vacíos).
export function precargarValores(
  schema: CampoSchema[],
  extraido: Record<string, unknown> | null | undefined
): Record<string, string> {
  if (!extraido) return {};
  const out: Record<string, string> = {};

  // Set de todos los IDs del schema — para saber si un sufijo es ambiguo.
  const schemaIds = new Set(schema.map((c) => c.id));

  for (const campo of schema) {
    const valor = encontrarValor(campo.id, extraido, schemaIds);
    if (valor !== null) out[campo.id] = valor;
  }
  return out;
}

function encontrarValor(
  schemaId: string,
  extraido: Record<string, unknown>,
  schemaIds: Set<string>
): string | null {
  // 1) Match directo.
  const directo = leerValor(extraido[schemaId]);
  if (directo !== null) return directo;

  // 2) Match por alias.
  for (const alias of ALIASES[schemaId] ?? []) {
    const v = leerValor(extraido[alias]);
    if (v !== null) return v;
  }

  // 3) Match por sufijo de rol: schemaId es `<base>_<rol>` y existe
  //    `<base>` en extracted, PERO solo si en este schema no hay otro
  //    `<base>_<rol_distinto>` (eso sería ambiguo — ¿de quién es?).
  const base = quitarSufijoRol(schemaId);
  if (base) {
    const tieneOtroRol = SUFIJOS_ROL.some((suf) => {
      const otro = `${base}${suf}`;
      return otro !== schemaId && schemaIds.has(otro);
    });
    if (!tieneOtroRol) {
      const v = leerValor(extraido[base]);
      if (v !== null) return v;
    }
  }

  // 4) Caso espejo del (3): schemaId es `<base>` (sin sufijo) y extracted
  //    tiene `<base>_<sufijo>` específico. Si el schema NO usa sufijos
  //    para ese base, tomamos cualquiera del extracted.
  for (const suf of SUFIJOS_ROL) {
    const conSuf = `${schemaId}${suf}`;
    if (schemaIds.has(conSuf)) continue; // si el schema usa sufijos, no.
    const v = leerValor(extraido[conSuf]);
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
