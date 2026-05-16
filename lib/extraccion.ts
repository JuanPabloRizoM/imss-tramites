// Motor de extracción de datos por IA.
//
// Define:
//   - El catálogo de tipos de documento que sabemos extraer (Parte 3, Apartado 3).
//   - Para cada tipo, la lista exacta de campos esperados (id + etiqueta).
//   - El builder del prompt de extracción (estructura descrita en 5.2).
//
// El prompt es cerrado y explícito: rol, tipo de documento (si se conoce), lista
// de campos con id y etiqueta, JSON puro como salida, null para faltantes,
// nunca inventar, y un campo `confianza` por dato.

export type CampoExtraccion = {
  id: string;
  label: string;
};

export type DocType = {
  id: string;
  label: string;
  campos: CampoExtraccion[];
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

// Prompt del sistema para la API de Anthropic. Estructura cerrada para
// minimizar respuestas con texto extra (5.2 del documento).
export function construirPromptSistema(docType: DocType): string {
  const camposListados = docType.campos
    .map((c) => `- ${c.id} — ${c.label}`)
    .join("\n");

  return `Eres un extractor de datos de documentos oficiales mexicanos.
Tu tarea: leer el documento adjunto y devolver únicamente sus datos en JSON.

Tipo de documento: ${docType.label}.

Campos a extraer (identificador — etiqueta):
${camposListados}

Reglas estrictas:
1. Responde EXCLUSIVAMENTE con un objeto JSON. Nada de texto antes o después.
   Nada de explicaciones. Nada de markdown ni de \`\`\`.
2. El objeto tiene una clave por cada identificador listado arriba. Cada valor
   es otro objeto con dos claves: "valor" (string o null) y "confianza"
   ("alto" | "medio" | "bajo").
3. Si un campo no aparece en el documento o no se puede leer con seguridad,
   "valor" debe ser null y "confianza" debe ser "bajo". Nunca inventes.
4. Para fechas usa el formato DD/MM/AAAA si es posible. Si solo se ve parcial,
   devuélvela tal como aparece.
5. No agregues claves que no estén en la lista.

Ejemplo de forma (los valores son ilustrativos):
{"rfc":{"valor":"ABCD010101AAA","confianza":"alto"},"nombre":{"valor":null,"confianza":"bajo"}}`;
}

// Tipo de la respuesta esperada de la IA, ya parseada.
export type DatoExtraido = {
  valor: string | null;
  confianza: "alto" | "medio" | "bajo";
};

export type ExtraccionParseada = Record<string, DatoExtraido>;

export function parsearRespuestaIA(
  texto: string,
  docType: DocType
): ExtraccionParseada {
  // Tolerancia mínima: por si el modelo envuelve en ``` a pesar de la regla.
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const obj = JSON.parse(limpio) as Record<string, unknown>;

  const resultado: ExtraccionParseada = {};
  for (const campo of docType.campos) {
    const raw = obj[campo.id];
    if (
      raw &&
      typeof raw === "object" &&
      "valor" in raw &&
      "confianza" in raw
    ) {
      const r = raw as { valor: unknown; confianza: unknown };
      resultado[campo.id] = {
        valor: typeof r.valor === "string" ? r.valor : null,
        confianza:
          r.confianza === "alto" || r.confianza === "medio" || r.confianza === "bajo"
            ? r.confianza
            : "bajo",
      };
    } else {
      resultado[campo.id] = { valor: null, confianza: "bajo" };
    }
  }
  return resultado;
}
