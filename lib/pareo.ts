// Utilidades compartidas del flujo de pareo celular ↔ computadora.
// Server-safe (no toca window). El código de pestaña vive en sessionStorage,
// gestionado en `lib/pareo-cliente.tsx`.

// Caracteres permitidos del código: sin ambigüedad visual (no 0/O/1/I/L).
// 31 caracteres × 4 posiciones ≈ 923 449 códigos posibles.
export const ALFABETO_PAREO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LARGO_CODIGO = 4;
export const REGEX_CODIGO = /^[A-HJKMNP-Z2-9]{4}$/;

// Generación criptográficamente uniforme. Rechaza valores de Uint32Array que
// caigan en el "tail" no múltiplo de 31 para evitar sesgo.
export function generarCodigo(): string {
  const N = ALFABETO_PAREO.length;
  const limite = Math.floor(2 ** 32 / N) * N;
  let salida = "";
  while (salida.length < LARGO_CODIGO) {
    const buf = new Uint32Array(LARGO_CODIGO);
    crypto.getRandomValues(buf);
    for (const n of buf) {
      if (n >= limite) continue;
      salida += ALFABETO_PAREO[n % N];
      if (salida.length === LARGO_CODIGO) break;
    }
  }
  return salida;
}

export function codigoValido(s: string): boolean {
  return REGEX_CODIGO.test(s.toUpperCase());
}

export function normalizarCodigo(s: string): string {
  return s.toUpperCase().replace(/[^A-HJKMNP-Z2-9]/g, "");
}

// Trámite al que apunta una sesión de pareo (apartado 1 o 2). Cuando está
// presente, el celular sube la foto SIN extraer — la computadora hace una
// sola extracción dirigida. Ver migración 0025.
export type TargetTramite = {
  code: string;
  name: string;
};

export type SesionResumen = {
  id: string;
  code: string;
  target_tramite?: TargetTramite | null;
};
