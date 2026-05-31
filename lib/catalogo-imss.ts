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

const indice = new Map<
  string,
  { division: Division; grupo: Grupo; fraccion: Fraccion }
>();
for (const division of (catalogo as RawCatalogo).divisiones) {
  for (const grupo of division.grupos) {
    for (const fraccion of grupo.fracciones) {
      indice.set(fraccion.codigo, { division, grupo, fraccion });
    }
  }
}

export type ResultadoFraccion = {
  divisionCodigo: string;
  divisionNombre: string;
  grupoCodigo: string;
  grupoNombre: string;
  fraccionCodigo: string;
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
    fraccionCodigo: hit.fraccion.codigo,
    fraccionTitulo: hit.fraccion.titulo,
    fraccionDescripcionLegal: hit.fraccion.descripcion,
    claseCodigo: hit.fraccion.clase,
    claseNombre: NOMBRE_CLASE[hit.fraccion.clase] ?? hit.fraccion.clase,
  };
}
