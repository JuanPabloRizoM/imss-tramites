// Catálogo de actividades del RACERF art. 196 — indexado por código de fracción.
//
// Usado para auto-llenar el bloque de clasificación (División, Grupo, Clase y
// sus descripciones) cuando el usuario escribe el código de fracción en el
// formulario de AM-SRT (y eventualmente AFIL-01).
//
// Importa el JSON tal cual; tsc lo embebe en el bundle.

import catalogo from "@/assets/catalogos/imss-actividades.json";

export type Fraccion = {
  codigo: string;
  titulo: string;
  clase: string;
  descripcion: string;
};

export type Grupo = {
  codigo: string;
  nombre: string;
  fracciones: Fraccion[];
};

export type Division = {
  codigo: string;
  nombre: string;
  grupos: Grupo[];
};

type RawCatalogo = {
  divisiones: Division[];
};

// Mapa Clase Romana → nombre corto (Riesgo Mínimo, Bajo, Mediano, Alto, Máximo).
const NOMBRE_CLASE: Record<string, string> = {
  I: "Riesgo mínimo",
  II: "Riesgo bajo",
  III: "Riesgo mediano",
  IV: "Riesgo alto",
  V: "Riesgo máximo",
};

// El RACERF (texto legal) usa códigos de 3 dígitos (grupo 2 + fracción 1)
// para grupos con menos de 10 fracciones, y 4 dígitos para los demás. El
// sistema IMSS (Alta Patronal, AM-SRT, etc.) SIEMPRE usa 4 dígitos: 2 del
// grupo + 2 de la fracción interna. Para convertir un código RACERF de 3
// dígitos al formato IMSS basta insertar "0" en la 3ra posición.
//   "141"  → "1401" (grupo 14 · fracción 01)
//   "011"  → "0101" (grupo 01 · fracción 01)
//   "2010" → "2010" (ya 4 dígitos, queda igual)
function aFormatoImss(racerf: string): string {
  if (racerf.length === 4) return racerf;
  if (racerf.length === 3) return racerf.slice(0, 2) + "0" + racerf.slice(2);
  return racerf;
}

const indice = new Map<
  string,
  { division: Division; grupo: Grupo; fraccion: Fraccion; imssCodigo: string }
>();
for (const division of (catalogo as RawCatalogo).divisiones) {
  for (const grupo of division.grupos) {
    for (const fraccion of grupo.fracciones) {
      const imss = aFormatoImss(fraccion.codigo);
      const entry = { division, grupo, fraccion, imssCodigo: imss };
      // Registrar AMBOS formatos para que el lookup acepte cualquiera.
      indice.set(fraccion.codigo, entry);
      indice.set(imss, entry);
    }
  }
}

export type ResultadoFraccion = {
  divisionCodigo: string;
  divisionNombre: string;
  grupoCodigo: string;
  grupoNombre: string;
  fraccionCodigo: string; // formato IMSS de 4 dígitos
  fraccionRacerf: string; // formato corto del RACERF (3 o 4 dígitos)
  fraccionTitulo: string;
  fraccionDescripcionLegal: string;
  claseCodigo: string;
  claseNombre: string;
};

export function buscarFraccion(input: string): ResultadoFraccion | null {
  const codigo = (input ?? "").trim();
  if (!codigo) return null;
  const hit = indice.get(codigo);
  if (!hit) return null;

  // Divisiones 2 y 3 comparten grupos en el RACERF — desambiguar por grupo:
  // grupo 2X → división 2, grupo 3X → división 3.
  let divisionCodigo = hit.division.codigo;
  if (divisionCodigo === "2-3") {
    divisionCodigo = hit.grupo.codigo.startsWith("3") ? "3" : "2";
  }

  return {
    divisionCodigo,
    divisionNombre: hit.division.nombre,
    grupoCodigo: hit.grupo.codigo,
    grupoNombre: hit.grupo.nombre,
    // El form siempre guarda el código IMSS de 4 dígitos (es lo que el PDF
    // del IMSS espera ver). El RACERF original queda en fraccionRacerf.
    fraccionCodigo: hit.imssCodigo,
    fraccionRacerf: hit.fraccion.codigo,
    fraccionTitulo: hit.fraccion.titulo,
    fraccionDescripcionLegal: hit.fraccion.descripcion,
    claseCodigo: hit.fraccion.clase,
    claseNombre: NOMBRE_CLASE[hit.fraccion.clase] ?? hit.fraccion.clase,
  };
}
