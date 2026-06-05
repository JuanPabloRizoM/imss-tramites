// Catálogo de delegaciones/subdelegaciones del IMSS a las que la papelería
// envía escritos. Hardcoded por ahora — si crecen mucho movemos a una tabla
// en Supabase con su propia migration.
//
// Cada delegación pre-llena el campo `dependencia` del escrito-generico
// (apartado 1). El usuario puede editar destinatario, cargo, etc. en el form.
//
// Los nombres y direcciones son una primera aproximación — corregir contra
// los datos reales de la papelería cuando los tengas.

export type Delegacion = {
  id: string;
  nombre: string;
  dependencia: string; // valor que se pre-llena en el campo `dependencia` del escrito
  direccion?: string;  // referencia visible en el picker
  destinatario_default?: string; // opcional: titular conocido
  cargo_default?: string;        // opcional: cargo del titular
};

export const DELEGACIONES: Delegacion[] = [
  {
    id: "jalisco",
    nombre: "Delegación Jalisco",
    dependencia: "Instituto Mexicano del Seguro Social — Delegación Estatal Jalisco",
    direccion: "Calzada Independencia, Guadalajara, Jalisco",
  },
  {
    id: "juarez",
    nombre: "Subdelegación Juárez",
    dependencia: "Instituto Mexicano del Seguro Social — Subdelegación Juárez",
    direccion: "Av. 16 de Septiembre, Guadalajara, Jalisco",
  },
  {
    id: "hidalgo",
    nombre: "Subdelegación Hidalgo",
    dependencia: "Instituto Mexicano del Seguro Social — Subdelegación Hidalgo",
    direccion: "Av. Manuel Ávila Camacho, Guadalajara, Jalisco",
  },
];

export function buscarDelegacion(id: string | null | undefined): Delegacion | null {
  if (!id) return null;
  return DELEGACIONES.find((d) => d.id === id) ?? null;
}

// True para los códigos de tramite_types que son escritos (no formatos
// oficiales). Convención: el code arranca con "escrito-".
export function esEscrito(code: string): boolean {
  return code.startsWith("escrito-");
}
