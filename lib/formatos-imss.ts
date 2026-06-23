// Catálogo central de formatos de campos IMSS / SAT / INE.
//
// Dos usos:
//   1) PROMPT — `hintFormatoPara(id)` devuelve la pista de formato para la
//      IA ("11 dígitos: 2 subdelegación + 2 año alta + ..."). Se inyecta en
//      construirPromptSistema para CUALQUIER campo cuyo id matchee, incluso
//      los target_fields que vienen del field_schema de un trámite.
//   2) POST-VALIDACIÓN — `validarValor(id, valor)` normaliza (quita espacios,
//      guiones, upcase) y valida (regex + dígito verificador donde aplica).
//      Si lo extraído no cumple el formato, la confianza se baja a "bajo"
//      para que el campo se pinte rojo y el usuario lo revise.
//
// Investigación (jun 2026):
//   - Registro patronal: 11 posiciones — letra + 2 dígitos (clave de
//     municipio), 5 dígitos progresivos, 2 de modalidad de aseguramiento,
//     1 dígito verificador. Ej. impreso: "B55 10768 10 8".
//   - NSS: 11 dígitos — 2 subdelegación de afiliación, 2 año de alta,
//     2 año de nacimiento, 4 progresivo, 1 verificador (Luhn).
//     Ej. impreso: "11 78 58 3763 1".
//   - CURP: 18 — 4 letras, 6 fecha (AAMMDD), H/M, 2 entidad, 3 consonantes,
//     1 homoclave (dígito si nació <2000, letra si ≥2000), 1 verificador.
//   - RFC: PF 13 (4 letras + AAMMDD + 3 homoclave) / PM 12 (3 letras + ...).
//   - Clave de elector: 18 — 6 letras + 8 dígitos + H/M + 3 dígitos.
//   - Prima RT: decimal con 5 decimales, rango 0.50000 – 15.00000.
//   - Fracción: formato IMSS de 4 dígitos (2 grupo + 2 fracción interna);
//     el RACERF legal usa 3-4 (ver lib/catalogo-imss.ts::aFormatoImss).
//
// Ver docs/formatos-imss.md para la referencia completa con fuentes.

export type FormatoCampo = {
  // Pista de formato que va al prompt de la IA.
  hint: string;
  // Regex sobre el valor YA normalizado.
  regex: RegExp;
  // Limpieza previa a validar/guardar. Default: trim + upcase + quitar
  // espacios/guiones/puntos internos.
  normalizar?: (v: string) => string;
  // Validación extra (dígito verificador). Corre sobre el normalizado y
  // solo si la regex ya pasó.
  verificar?: (v: string) => boolean;
};

// Luhn módulo 10 — el dígito final de NSS lo usa como verificador.
function luhnValido(digitos: string): boolean {
  let suma = 0;
  let doblar = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = digitos.charCodeAt(i) - 48;
    if (doblar) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doblar = !doblar;
  }
  return suma % 10 === 0;
}

// Dígito verificador de la CURP (posición 18): suma ponderada de las
// primeras 17 posiciones con la tabla 0-9 A-Z (con Ñ), módulo 10.
function curpVerificadorValido(curp: string): boolean {
  const tabla = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    const v = tabla.indexOf(curp[i]);
    if (v < 0) return false;
    suma += v * (18 - i);
  }
  const dv = (10 - (suma % 10)) % 10;
  return dv === curp.charCodeAt(17) - 48;
}

const normalizarCompacto = (v: string) =>
  v.toUpperCase().replace(/[\s.\-–]/g, "");

const soloDigitos = (v: string) => v.replace(/\D/g, "");

// Códigos de entidad federativa válidos en la CURP.
const ENTIDADES_CURP =
  "AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE";

export const FORMATOS_IMSS: Record<string, FormatoCampo> = {
  nss: {
    hint:
      "Exactamente 11 dígitos. Estructura: 2 dígitos de subdelegación de " +
      "afiliación + 2 del año de alta al IMSS + 2 del año de nacimiento + " +
      "4 progresivos + 1 dígito verificador. Suele imprimirse con espacios " +
      "('11 78 58 3763 1') — júntalos. Si ves solo 10 dígitos probablemente " +
      "falta el verificador: repórtalo tal cual con confianza 'medio'.",
    regex: /^\d{10,11}$/,
    normalizar: soloDigitos,
    verificar: (v) => (v.length === 11 ? luhnValido(v) : true),
  },
  registro_patronal: {
    hint:
      "11 posiciones (a veces 10 si falta el verificador). REGLA CLAVE: SOLO el " +
      "PRIMER carácter puede ser letra; del 2º en adelante SIEMPRE son dígitos. " +
      "Algunos registros empiezan con dígito (no con letra). Estructura: " +
      "[letra o dígito] + 9 dígitos + 1 dígito verificador. Suele imprimirse con " +
      "espacios o guiones ('B55 10768 10 8') — júntalos. " +
      "OJO CON LA LECTURA: si crees ver una LETRA después de la 1ª posición, es " +
      "un dígito mal leído — corrígelo: I/l/T→1, O→0, B→8, S→5, Z→2, G→6, D→0. " +
      "Cuenta los dígitos con cuidado (no te comas ninguno): deben dar 10 u 11 " +
      "en total. Si dudas de algún carácter o el conteo no cuadra, baja la " +
      "confianza a 'bajo' para que se revise. NO lo confundas con RFC ni NSS.",
    regex: /^[A-Z0-9]\d{9,10}$/,
    normalizar: normalizarCompacto,
  },
  curp: {
    hint:
      "Exactamente 18 caracteres: 4 letras + 6 dígitos de fecha (AAMMDD) + " +
      "H o M + 2 letras de entidad (JC=Jalisco, DF=CDMX...) + 3 consonantes " +
      "+ 1 homoclave + 1 dígito verificador. Sin espacios.",
    regex: new RegExp(
      `^[A-Z][AEIOUX][A-Z]{2}\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])[HM](${ENTIDADES_CURP})[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]\\d$`
    ),
    normalizar: normalizarCompacto,
    verificar: curpVerificadorValido,
  },
  rfc: {
    hint:
      "Persona física: 13 caracteres (4 letras + 6 dígitos AAMMDD + 3 de " +
      "homoclave). Persona moral: 12 (3 letras + 6 dígitos + 3 homoclave). " +
      "Puede contener Ñ o &. Sin espacios ni guiones.",
    regex: /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/,
    normalizar: normalizarCompacto,
  },
  clave_elector: {
    hint:
      "Exactamente 18 caracteres: 6 letras + 8 dígitos + H o M + 3 dígitos. " +
      "Aparece bajo 'CLAVE DE ELECTOR' en el anverso del INE. NO es la CURP.",
    regex: /^[A-Z]{6}\d{8}[HM]\d{3}$/,
    normalizar: normalizarCompacto,
  },
  seccion: {
    hint: "4 dígitos. Aparece como 'SECCIÓN' en el anverso del INE.",
    regex: /^\d{4}$/,
    normalizar: soloDigitos,
  },
  codigo_postal: {
    hint: "Exactamente 5 dígitos.",
    regex: /^\d{5}$/,
    normalizar: soloDigitos,
  },
  telefono: {
    hint: "10 dígitos (lada incluida). Quita espacios, guiones y paréntesis.",
    regex: /^\d{10}$/,
    normalizar: soloDigitos,
  },
  prima_rt: {
    hint:
      "Porcentaje decimal con 5 decimales, entre 0.50000 y 15.00000. " +
      "Ej. '0.50000', '2.59840'. Reporta solo el número, sin el signo %.",
    regex: /^\d{1,2}\.\d{1,5}$/,
    normalizar: (v) => v.replace(/[%\s]/g, ""),
    verificar: (v) => {
      const n = parseFloat(v);
      return n >= 0.5 && n <= 15;
    },
  },
  clase_rt: {
    hint: "Número romano: I, II, III, IV o V.",
    regex: /^(I|II|III|IV|V)$/,
    normalizar: (v) => v.toUpperCase().trim(),
  },
  fraccion: {
    hint:
      "Código de actividad del catálogo IMSS: 4 dígitos (2 de grupo + 2 de " +
      "fracción interna), ej. '1012'. El texto legal a veces usa 3 dígitos.",
    regex: /^\d{3,4}$/,
    normalizar: soloDigitos,
  },
  correo: {
    hint: "Correo electrónico válido (usuario@dominio).",
    regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    normalizar: (v) => v.trim().toLowerCase(),
  },
  fecha: {
    hint: "Formato DD/MM/AAAA. Si en el documento viene distinto, conviértela.",
    regex: /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(19|20)\d{2}$/,
    normalizar: (v) => v.trim().replace(/[-.]/g, "/"),
  },
};

// Resolución de id de campo → formato canónico. Acepta ids calificados
// (curp_trabajador, rfc_patron, nss_1) quitando sufijos de rol/numeración,
// y prefijos compuestos conocidos.
const SUFIJOS = /_(trabajador|patron|representante|\d+)$/;

const ALIAS_FORMATO: Record<string, string> = {
  rfc_curp: "curp", // columna mixta de EMA/EBA — el hint de CURP cubre ambos
  fraccion_rt: "fraccion",
  telefono_fijo: "telefono",
  correo_electronico: "correo",
  email: "correo",
};

function idCanonico(fieldId: string): string | null {
  const limpio = fieldId.toLowerCase();
  if (FORMATOS_IMSS[limpio]) return limpio;
  if (ALIAS_FORMATO[limpio]) return ALIAS_FORMATO[limpio];
  const sinSufijo = limpio.replace(SUFIJOS, "");
  if (FORMATOS_IMSS[sinSufijo]) return sinSufijo;
  if (ALIAS_FORMATO[sinSufijo]) return ALIAS_FORMATO[sinSufijo];
  // Cualquier campo fecha_* usa el formato de fecha.
  if (limpio.startsWith("fecha_") || sinSufijo.startsWith("fecha_")) {
    return "fecha";
  }
  return null;
}

// Pista de formato para el prompt, o null si el campo no tiene formato
// conocido (razón social, calle, etc. — texto libre).
export function hintFormatoPara(fieldId: string): string | null {
  const id = idCanonico(fieldId);
  return id ? FORMATOS_IMSS[id].hint : null;
}

export type ResultadoValidacion = {
  normalizado: string;
  valido: boolean;
};

// Normaliza y valida un valor extraído contra el formato del campo.
// Devuelve null si el campo no tiene formato conocido (no validar).
export function validarValor(
  fieldId: string,
  valor: string
): ResultadoValidacion | null {
  const id = idCanonico(fieldId);
  if (!id) return null;
  const f = FORMATOS_IMSS[id];
  const normalizado = (f.normalizar ?? ((v: string) => v.trim()))(valor);
  const valido =
    f.regex.test(normalizado) &&
    (f.verificar ? f.verificar(normalizado) : true);
  return { normalizado, valido };
}
