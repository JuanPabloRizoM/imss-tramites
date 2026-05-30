// Motor de extracción de datos por IA.
//
// Soporta dos tipos de campos:
//   1) Campos planos: "razón social", "RFC", "fecha", etc. → un valor.
//   2) Tabla (opcional): lista de filas con N columnas, ej. para reportes
//      del SUA/EMA/EBA donde hay un trabajador por fila.

export type CampoExtraccion = {
  id: string;
  label: string;
};

export type ColumnaTabla = {
  id: string;
  label: string;
  hint?: string;
};

export type DocType = {
  id: string;
  label: string;
  campos: CampoExtraccion[];
  tabla?: {
    id: string;
    label: string;
    descripcion?: string;
    columnas: ColumnaTabla[];
  };
};

export const DOC_TYPES: Record<string, DocType> = {
  acta_constitutiva: {
    id: "acta_constitutiva",
    label: "Acta constitutiva",
    campos: [
      { id: "razon_social", label: "Denominación o razón social" },
      { id: "tipo_sociedad", label: "Tipo de sociedad" },
      { id: "rfc", label: "RFC de la persona moral" },
      { id: "numero_escritura", label: "Número de escritura" },
      { id: "numero_notaria", label: "Número de notaría o correduría" },
      { id: "lugar_constitucion", label: "Lugar de constitución" },
      { id: "fecha_constitucion", label: "Fecha de constitución" },
      { id: "folio_mercantil", label: "Folio mercantil electrónico" },
      { id: "nombre_representante", label: "Nombre del representante legal" },
      { id: "objeto_social", label: "Objeto social / giro" },
    ],
  },
  comprobante_domicilio: {
    id: "comprobante_domicilio",
    label: "Comprobante de domicilio",
    campos: [
      { id: "calle", label: "Calle" },
      { id: "numero_exterior", label: "Número exterior" },
      { id: "numero_interior", label: "Número interior" },
      { id: "colonia", label: "Colonia" },
      { id: "localidad", label: "Localidad" },
      { id: "municipio", label: "Municipio o alcaldía" },
      { id: "entidad", label: "Entidad federativa" },
      { id: "codigo_postal", label: "Código postal" },
    ],
  },
  ine: {
    id: "ine",
    label: "INE / identificación oficial",
    campos: [
      { id: "nombre", label: "Nombre(s)" },
      { id: "apellido_paterno", label: "Apellido paterno" },
      { id: "apellido_materno", label: "Apellido materno" },
      { id: "curp", label: "CURP" },
      { id: "domicilio", label: "Domicilio completo" },
    ],
  },
  ine_representante: {
    id: "ine_representante",
    label: "INE del representante legal",
    campos: [
      { id: "nombre_representante", label: "Nombre completo del representante" },
      { id: "curp_representante", label: "CURP del representante" },
    ],
  },
  tip: {
    id: "tip",
    label: "Tarjeta de Identificación Patronal (TIP)",
    campos: [
      { id: "registro_patronal", label: "Registro patronal" },
      { id: "rfc", label: "RFC" },
      { id: "razon_social", label: "Razón social" },
      { id: "domicilio", label: "Domicilio fiscal" },
    ],
  },
  cedula_rfc: {
    id: "cedula_rfc",
    label: "Cédula RFC / Constancia de Situación Fiscal",
    campos: [
      { id: "rfc", label: "RFC" },
      { id: "razon_social", label: "Razón social o nombre" },
      { id: "regimen", label: "Régimen fiscal" },
      { id: "domicilio_fiscal", label: "Domicilio fiscal" },
    ],
  },

  // Reporte del SUA / EMA / EBA — los tres comparten cabecera + tabla de
  // trabajadores. Diseñado flexible: si una columna no aparece en el doc,
  // queda null. Acepta texto impreso O manuscrito (cuando el cliente lo
  // anota a mano en el papel que se le entrega).
  sua_ema_eba: {
    id: "sua_ema_eba",
    label: "Reporte SUA / EMA / EBA (lista de trabajadores)",
    campos: [
      { id: "registro_patronal", label: "Registro patronal" },
      { id: "rfc_patron", label: "RFC del patrón" },
      { id: "razon_social", label: "Nombre o razón social del patrón" },
      { id: "periodo", label: "Periodo / bimestre o mes de proceso" },
      { id: "actividad", label: "Actividad" },
      { id: "domicilio", label: "Domicilio del patrón" },
      { id: "codigo_postal", label: "Código postal" },
      { id: "entidad", label: "Entidad federativa" },
      { id: "delegacion_imss", label: "Delegación IMSS" },
      { id: "subdelegacion_imss", label: "Subdelegación IMSS" },
      { id: "aportacion_patronal_pct", label: "Aportación patronal (%)" },
    ],
    tabla: {
      id: "trabajadores",
      label: "Trabajadores listados en el documento",
      descripcion:
        "Una fila por trabajador. Si la columna no aparece para esa fila, deja el valor como null.",
      columnas: [
        { id: "nss", label: "Número de Seguridad Social (NSS)" },
        { id: "nombre", label: "Nombre completo del trabajador" },
        { id: "rfc_curp", label: "RFC o CURP" },
        { id: "movimiento", label: "Tipo de movimiento (Alta / Baja / M-S / etc.)" },
        { id: "fecha", label: "Fecha del movimiento" },
        { id: "dias", label: "Días trabajados / cotizados" },
        { id: "sdi", label: "Salario Diario Integrado (SDI)" },
        { id: "cuotas_patronal", label: "Cuotas patronal ($)" },
        { id: "cuotas_obrera", label: "Cuotas obrera ($)" },
        { id: "cuotas_suma", label: "Suma de cuotas IMSS ($)" },
        { id: "aportacion_vivienda", label: "Aportación INFONAVIT / vivienda ($)" },
        { id: "credito_vivienda", label: "Número de crédito de vivienda (si aplica)" },
      ],
    },
  },

  generico: {
    id: "generico",
    label: "Documento (tipo no especificado)",
    campos: [
      { id: "nombre", label: "Nombre" },
      { id: "rfc", label: "RFC" },
      { id: "curp", label: "CURP" },
      { id: "nss", label: "NSS" },
      { id: "domicilio", label: "Domicilio" },
      { id: "razon_social", label: "Razón social" },
      { id: "fecha", label: "Fecha" },
      { id: "telefono", label: "Teléfono" },
      { id: "correo", label: "Correo electrónico" },
    ],
  },
};

export function listarDocTypes(): DocType[] {
  return Object.values(DOC_TYPES);
}

export function obtenerDocType(id: string | null | undefined): DocType {
  if (id && DOC_TYPES[id]) return DOC_TYPES[id];
  return DOC_TYPES.generico;
}

// =============================================================================
// Prompt builder
// =============================================================================
export function construirPromptSistema(docType: DocType): string {
  const camposListados = docType.campos
    .map((c) => `- ${c.id} — ${c.label}`)
    .join("\n");

  const seccionTabla = docType.tabla
    ? `

Adicionalmente, este documento contiene una tabla llamada "${docType.tabla.label}".
${docType.tabla.descripcion ?? ""}
Cada fila representa una entrada distinta. Sus columnas (identificador — etiqueta):
${docType.tabla.columnas.map((c) => `- ${c.id} — ${c.label}`).join("\n")}

Devuelve la tabla en la clave "${docType.tabla.id}" como un ARRAY de objetos. Cada objeto representa una fila y tiene las claves ${docType.tabla.columnas
        .map((c) => `"${c.id}"`)
        .join(", ")}, cada una con su {"valor", "confianza"} como los campos
de arriba. Si una columna no aparece para una fila, "valor" = null y "confianza" = "bajo".`
    : "";

  return `Eres un extractor de datos de documentos oficiales mexicanos.
Tu tarea: leer el documento adjunto y devolver únicamente sus datos en JSON.
El documento puede ser TEXTO IMPRESO o ESCRITURA MANUSCRITA (el cliente puede
haber anotado los datos a mano sobre el papel).

Tipo de documento: ${docType.label}.

Campos planos a extraer (identificador — etiqueta):
${camposListados}
${seccionTabla}

Reglas estrictas:
1. Responde EXCLUSIVAMENTE con un objeto JSON. Nada de texto antes o después.
   Nada de explicaciones. Nada de markdown ni de \`\`\`.
2. Cada campo plano es un objeto con dos claves: "valor" (string o null) y
   "confianza" ("alto" | "medio" | "bajo").
3. Si un campo plano no aparece en el documento o no se puede leer con
   seguridad, "valor" debe ser null y "confianza" debe ser "bajo".
   NUNCA inventes.
4. Para fechas usa el formato DD/MM/AAAA si es posible. Si solo se ve parcial,
   devuélvela tal como aparece.
5. No agregues claves planas que no estén en la lista.
6. Si el documento tiene tabla, lista TODAS las filas que veas — no inventes
   filas. Si el documento no tiene tabla aunque te pidan una, devuelve un
   array vacío [].
${docType.tabla ? `
7. Para la tabla "${docType.tabla.id}", cada fila es un objeto con las
   columnas listadas. Devuelve un array (aunque haya solo una fila).
` : ""}
Ejemplo de forma (los valores son ilustrativos):
{"rfc":{"valor":"ABCD010101AAA","confianza":"alto"}${docType.tabla ? `,"${docType.tabla.id}":[{"nss":{"valor":"12345678901","confianza":"alto"},"nombre":{"valor":"JUAN PEREZ","confianza":"alto"}}]` : ""}}`;
}

// =============================================================================
// Tipos de salida
// =============================================================================
export type DatoExtraido = {
  valor: string | null;
  confianza: "alto" | "medio" | "bajo";
};

export type FilaExtraida = Record<string, DatoExtraido>;

// Una extracción puede tener campos planos y, opcionalmente, arrays de filas
// (uno por cada tabla definida en el doc_type).
export type ExtraccionParseada = Record<
  string,
  DatoExtraido | FilaExtraida[]
>;

export function esFilaArray(v: unknown): v is FilaExtraida[] {
  return Array.isArray(v);
}

// =============================================================================
// Parser
// =============================================================================
export function parsearRespuestaIA(
  texto: string,
  docType: DocType
): ExtraccionParseada {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const obj = JSON.parse(limpio) as Record<string, unknown>;

  const resultado: ExtraccionParseada = {};

  // 1) Campos planos.
  for (const campo of docType.campos) {
    const raw = obj[campo.id];
    resultado[campo.id] = parseDato(raw);
  }

  // 2) Tabla (opcional).
  if (docType.tabla) {
    const rawTabla = obj[docType.tabla.id];
    const filas: FilaExtraida[] = Array.isArray(rawTabla)
      ? rawTabla.map((raw) => parseFila(raw, docType.tabla!.columnas))
      : [];
    resultado[docType.tabla.id] = filas;
  }

  return resultado;
}

function parseDato(raw: unknown): DatoExtraido {
  if (
    raw &&
    typeof raw === "object" &&
    "valor" in raw &&
    "confianza" in raw
  ) {
    const r = raw as { valor: unknown; confianza: unknown };
    return {
      valor: typeof r.valor === "string" ? r.valor : null,
      confianza:
        r.confianza === "alto" || r.confianza === "medio" || r.confianza === "bajo"
          ? r.confianza
          : "bajo",
    };
  }
  // El modelo a veces manda string directo en lugar de {valor, confianza}.
  if (typeof raw === "string") {
    return { valor: raw, confianza: "medio" };
  }
  return { valor: null, confianza: "bajo" };
}

function parseFila(raw: unknown, columnas: ColumnaTabla[]): FilaExtraida {
  if (!raw || typeof raw !== "object") {
    const fila: FilaExtraida = {};
    for (const c of columnas) fila[c.id] = { valor: null, confianza: "bajo" };
    return fila;
  }
  const obj = raw as Record<string, unknown>;
  const fila: FilaExtraida = {};
  for (const c of columnas) {
    fila[c.id] = parseDato(obj[c.id]);
  }
  return fila;
}
