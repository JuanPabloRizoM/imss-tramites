// Motor de extracción de datos por IA.
//
// Soporta dos tipos de campos:
//   1) Campos planos: "razón social", "RFC", "fecha", etc. → un valor.
//   2) Tabla (opcional): lista de filas con N columnas, ej. para reportes
//      del SUA/EMA/EBA donde hay un trabajador por fila.

export type CampoExtraccion = {
  id: string;
  label: string;
  // Pista para la IA: ejemplo de formato, dónde aparece, qué confundir
  // evitar. Va al prompt. La diferencia entre 5 campos y 15 es la diferencia
  // entre "saca nombre y CURP" y "saca todo lo que aparece en la mica".
  hint?: string;
};

export type ColumnaTabla = {
  id: string;
  label: string;
  hint?: string;
};

export type DocType = {
  id: string;
  label: string;
  // Descripción para la IA: qué es el documento, dónde está la info
  // (anverso/reverso/zonas), qué señales buscar. Hace una diferencia
  // enorme en la calidad de la extracción.
  descripcion_para_ia?: string;
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
    descripcion_para_ia:
      "Acta constitutiva mexicana de persona moral (S.A. de C.V., S. de R.L. " +
      "de C.V., S.A.P.I., etc.) emitida ante notario o corredor público. " +
      "Suele tener varias páginas. Los datos clave normalmente están en las " +
      "primeras páginas (encabezado del acta + declaraciones) y al final " +
      "(testimonio / inscripción en RPC). Revisa TODO el documento.",
    campos: [
      { id: "razon_social", label: "Denominación o razón social", hint: "Nombre completo de la sociedad, ej. 'INDUSTRIAS DEL NORTE SA DE CV'." },
      { id: "tipo_sociedad", label: "Tipo de sociedad", hint: "S.A. de C.V., S. de R.L. de C.V., S.A.P.I., S.C., A.C., etc." },
      { id: "rfc", label: "RFC de la persona moral", hint: "12 caracteres alfanuméricos. Puede no estar — algunas actas se firman antes del RFC." },
      { id: "numero_escritura", label: "Número de escritura pública" },
      { id: "fecha_escritura", label: "Fecha de la escritura" },
      { id: "numero_notaria", label: "Número de notaría o correduría" },
      { id: "titular_notaria", label: "Nombre del notario o corredor titular" },
      { id: "ciudad_notaria", label: "Ciudad y estado de la notaría" },
      { id: "lugar_constitucion", label: "Lugar de constitución (ciudad, estado)" },
      { id: "fecha_constitucion", label: "Fecha de constitución de la sociedad" },
      { id: "folio_mercantil", label: "Folio mercantil electrónico (FME) del RPC" },
      { id: "duracion", label: "Duración de la sociedad", hint: "Ej. '99 años', 'indefinida'." },
      { id: "capital_social", label: "Capital social", hint: "Monto en pesos mexicanos." },
      { id: "nombre_representante", label: "Nombre del representante legal / administrador único" },
      { id: "objeto_social", label: "Objeto social / giro", hint: "Resumen de las actividades principales declaradas." },
      { id: "domicilio_social", label: "Domicilio social declarado" },
      { id: "socios", label: "Socios o accionistas", hint: "Nombres separados por comas. Solo si están claramente listados." },
    ],
  },
  comprobante_domicilio: {
    id: "comprobante_domicilio",
    label: "Comprobante de domicilio",
    descripcion_para_ia:
      "Recibo de servicios (CFE, Telmex, agua, gas, predial) o estado de " +
      "cuenta bancario donde aparece un domicilio. El domicilio del titular " +
      "está claramente impreso. Distingue entre el domicilio del titular " +
      "(lo que pedimos) y la dirección de la empresa emisora (NO lo que " +
      "pedimos).",
    campos: [
      { id: "titular", label: "Nombre del titular del servicio" },
      { id: "calle", label: "Calle" },
      { id: "numero_exterior", label: "Número exterior" },
      { id: "numero_interior", label: "Número interior (depto, casa)" },
      { id: "colonia", label: "Colonia o fraccionamiento" },
      { id: "localidad", label: "Localidad" },
      { id: "municipio", label: "Municipio o alcaldía" },
      { id: "entidad", label: "Entidad federativa (estado)" },
      { id: "codigo_postal", label: "Código postal (5 dígitos)" },
      { id: "tipo_comprobante", label: "Tipo de comprobante", hint: "CFE / Telmex / agua / predial / banco / etc." },
      { id: "fecha_emision", label: "Fecha de emisión del comprobante" },
      { id: "periodo", label: "Periodo facturado", hint: "Para servicios. Ej. 'ene-feb 2025'." },
    ],
  },
  ine: {
    id: "ine",
    label: "INE / identificación oficial",
    descripcion_para_ia:
      "Credencial para Votar del INE (antes IFE), formato vigente o anterior. " +
      "ANVERSO: foto, nombre, domicilio, clave de elector, CURP, año de " +
      "registro, sección, sexo, fecha de nacimiento, vigencia. " +
      "REVERSO: número OCR/IDMEX largo en el margen inferior. " +
      "El nombre suele venir en tres líneas: apellido paterno, apellido " +
      "materno, nombre(s) — extráelos por separado, no concatenes. " +
      "Para la CURP busca exactamente 18 caracteres alfanuméricos. " +
      "Para la clave de elector busca exactamente 18 caracteres " +
      "alfanuméricos distintos del CURP.",
    campos: [
      { id: "nombre", label: "Nombre(s)", hint: "Sin apellidos. Ej. 'JUAN CARLOS'." },
      { id: "apellido_paterno", label: "Apellido paterno" },
      { id: "apellido_materno", label: "Apellido materno" },
      { id: "curp", label: "CURP", hint: "18 caracteres alfanuméricos. Aparece bajo 'CURP'." },
      { id: "clave_elector", label: "Clave de elector", hint: "18 caracteres alfanuméricos, distinto del CURP. Aparece bajo 'CLAVE DE ELECTOR'." },
      { id: "fecha_nacimiento", label: "Fecha de nacimiento", hint: "Formato DD/MM/AAAA." },
      { id: "sexo", label: "Sexo (H/M)" },
      { id: "domicilio", label: "Domicilio completo", hint: "Calle, número, colonia, CP, municipio, entidad — tal como aparece, en una sola cadena." },
      { id: "entidad", label: "Entidad federativa del domicilio", hint: "Estado, ej. 'JALISCO'." },
      { id: "municipio", label: "Municipio o alcaldía" },
      { id: "localidad", label: "Localidad" },
      { id: "seccion", label: "Sección electoral", hint: "Número de 4 dígitos." },
      { id: "año_registro", label: "Año de registro" },
      { id: "vigencia", label: "Vigencia", hint: "Año hasta el cual es válida la credencial." },
      { id: "emision", label: "Año de emisión" },
      { id: "numero_ocr", label: "Número OCR / IDMEX del reverso", hint: "Cadena larga en el margen inferior del reverso." },
    ],
  },
  ine_representante: {
    id: "ine_representante",
    label: "INE del representante legal",
    descripcion_para_ia:
      "Igual que un INE normal, pero se va a usar como identificación del " +
      "representante legal de una persona moral. Mantén la nomenclatura " +
      "'_representante' al regresar los datos clave.",
    campos: [
      { id: "nombre_representante", label: "Nombre completo del representante (nombre + apellidos)" },
      { id: "curp_representante", label: "CURP del representante" },
      { id: "clave_elector_representante", label: "Clave de elector del representante" },
      { id: "fecha_nacimiento_representante", label: "Fecha de nacimiento del representante" },
      { id: "domicilio_representante", label: "Domicilio del representante" },
    ],
  },
  tip: {
    id: "tip",
    label: "Tarjeta de Identificación Patronal (TIP)",
    descripcion_para_ia:
      "Tarjeta de Identificación Patronal del IMSS. Trae el registro " +
      "patronal (formato AAA0000000-0 — 10 caracteres + dígito verificador), " +
      "RFC, razón social, domicilio fiscal del patrón, actividad económica, " +
      "clase de riesgo, prima de riesgo, fecha de alta patronal, y " +
      "delegación/subdelegación IMSS de adscripción. " +
      "El registro patronal es el dato crítico — siempre debe extraerse.",
    campos: [
      { id: "registro_patronal", label: "Registro patronal del IMSS", hint: "10 caracteres + dígito verificador. Ej. 'C1234567893'." },
      { id: "rfc", label: "RFC del patrón" },
      { id: "razon_social", label: "Razón social o nombre del patrón" },
      { id: "domicilio", label: "Domicilio fiscal del patrón (completo)" },
      { id: "actividad", label: "Actividad económica declarada" },
      { id: "clase_rt", label: "Clase de riesgo de trabajo", hint: "I, II, III, IV o V." },
      { id: "fraccion_rt", label: "Fracción de la clase de RT" },
      { id: "prima_rt", label: "Prima de riesgo de trabajo (%)", hint: "Decimal, ej. 0.50000." },
      { id: "fecha_alta_patronal", label: "Fecha de alta patronal en el IMSS" },
      { id: "delegacion_imss", label: "Delegación IMSS" },
      { id: "subdelegacion_imss", label: "Subdelegación IMSS" },
    ],
  },
  cedula_rfc: {
    id: "cedula_rfc",
    label: "Cédula RFC / Constancia de Situación Fiscal",
    descripcion_para_ia:
      "Constancia de Situación Fiscal del SAT (formato moderno, 1-2 páginas) " +
      "o Cédula de Identificación Fiscal (formato anterior). " +
      "Trae RFC, razón social/nombre, fecha de inicio de operaciones, régimen " +
      "fiscal, domicilio fiscal completo (calle, número, colonia, CP, " +
      "municipio, entidad), código de actividad económica y obligaciones. " +
      "Puede traer más de un régimen — pónlos separados por coma en 'regimen'.",
    campos: [
      { id: "rfc", label: "RFC", hint: "12 o 13 caracteres alfanuméricos." },
      { id: "razon_social", label: "Razón social o nombre completo" },
      { id: "regimen", label: "Régimen fiscal (puede haber más de uno)" },
      { id: "actividad_economica", label: "Actividad económica principal" },
      { id: "fecha_inicio_operaciones", label: "Fecha de inicio de operaciones" },
      { id: "calle", label: "Calle del domicilio fiscal" },
      { id: "numero_exterior", label: "Número exterior" },
      { id: "numero_interior", label: "Número interior" },
      { id: "colonia", label: "Colonia" },
      { id: "codigo_postal", label: "Código postal" },
      { id: "municipio", label: "Municipio o alcaldía" },
      { id: "entidad", label: "Entidad federativa" },
      { id: "domicilio_fiscal", label: "Domicilio fiscal completo en una sola cadena (como respaldo)" },
      { id: "telefono", label: "Teléfono" },
      { id: "correo", label: "Correo electrónico" },
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

  // Propuesta de Cédula de Determinación de Cuotas IMSS — mensual. Comparte
  // estructura con EMA/EBA (cabecera + DETALLE DE TRABAJADORES) pero la
  // cabecera trae datos propios (propuesta IMSS, prima RT, UMA, cotizantes,
  // totales patronal/obrera, fecha límite de pago) y la tabla viene MUY
  // detallada por cuota (cuota fija, excedente, prestaciones, RT, IV, etc.).
  // Se usa para extraer la lista de trabajadores → exportar a Excel →
  // pegar en IDSE para altas/bajas masivas.
  propuesta_cedula: {
    id: "propuesta_cedula",
    label: "Propuesta de Cédula IMSS (mensual)",
    descripcion_para_ia:
      "Propuesta de Cédula de Determinación de Cuotas IMSS. Documento " +
      "mensual emitido por el IMSS al patrón. Cabecera: registro patronal, " +
      "razón social, delegación/subdelegación, periodo (MM-AAAA), número de " +
      "propuesta, prima y clase de RT, UMA vigente, totales patronal/obrera/" +
      "suma, fecha límite de pago. Cuerpo: tabla 'DETALLE DE TRABAJADORES' " +
      "con una fila por trabajador-movimiento, columnas con NSS, nombre, " +
      "CURP, origen/clave del movimiento, fecha, días, salario y desglose " +
      "de cuotas por concepto.",
    campos: [
      { id: "registro_patronal", label: "Registro patronal" },
      { id: "razon_social", label: "Nombre o razón social del patrón" },
      { id: "delegacion_imss", label: "Delegación IMSS" },
      { id: "subdelegacion_imss", label: "Subdelegación IMSS" },
      { id: "periodo", label: "Periodo (MM-AAAA)" },
      { id: "propuesta_imss", label: "Número de propuesta IMSS" },
      { id: "prima_rt", label: "Prima de Riesgo de Trabajo" },
      { id: "clase_rt", label: "Clase de Riesgo de Trabajo" },
      { id: "smv", label: "Salario Mínimo Vigente (S.M.V.)" },
      { id: "uma", label: "U.M.A. vigente" },
      { id: "cotizantes", label: "Total de cotizantes" },
      { id: "dias_cot", label: "Total de días cotizados" },
      { id: "importe_total_patronal", label: "Importe total patronal ($)" },
      { id: "importe_total_obrera", label: "Importe total obrera ($)" },
      { id: "importe_total_suma", label: "Importe total ($) — patronal + obrera" },
      { id: "fecha_limite_pago", label: "Fecha límite de pago" },
    ],
    tabla: {
      id: "trabajadores",
      label: "Detalle de trabajadores",
      descripcion:
        "Una fila por trabajador-movimiento del periodo. Si una columna no aparece, deja el valor null.",
      columnas: [
        { id: "nss", label: "Número de Seguridad Social (NSS)" },
        { id: "nombre", label: "Apellidos y nombre(s)" },
        { id: "curp", label: "CURP" },
        { id: "origen", label: "Origen del movimiento" },
        { id: "clave", label: "Clave de movimiento" },
        { id: "fecha", label: "Fecha del movimiento" },
        { id: "dias", label: "Días cotizados en el periodo" },
        { id: "salario_diario", label: "Salario diario" },
        { id: "cuota_fija", label: "Cuota fija ($)" },
        { id: "excedente_pat", label: "Excedente patronal ($)" },
        { id: "excedente_obr", label: "Excedente obrera ($)" },
        { id: "prest_dinero_pat", label: "Prestaciones en dinero patronal ($)" },
        { id: "prest_dinero_obr", label: "Prestaciones en dinero obrera ($)" },
        { id: "gastos_med_pat", label: "Gastos médicos pensionados patronal ($)" },
        { id: "gastos_med_obr", label: "Gastos médicos pensionados obrera ($)" },
        { id: "riesgos_trabajo", label: "Riesgos de trabajo ($)" },
        { id: "invalidez_vida_pat", label: "Invalidez y vida patronal ($)" },
        { id: "invalidez_vida_obr", label: "Invalidez y vida obrera ($)" },
        { id: "guarderias_prest_soc", label: "Guarderías y prestaciones sociales ($)" },
        { id: "suma", label: "Suma total fila ($)" },
      ],
    },
  },

  generico: {
    id: "generico",
    label: "Documento (tipo no especificado)",
    descripcion_para_ia:
      "El usuario no especificó qué tipo de documento es. PRIMERO identifica " +
      "el tipo de documento (INE, acta constitutiva, comprobante de " +
      "domicilio, TIP, CSF, recibo, etc.) y mencionalo en tipo_documento. " +
      "Después extrae TODOS los datos relevantes que veas — no te limites a " +
      "los campos listados si hay más información útil obvia.",
    campos: [
      { id: "tipo_documento", label: "Tipo de documento identificado", hint: "Ej. 'INE', 'Acta constitutiva', 'CSF del SAT', 'Recibo CFE'." },
      { id: "nombre", label: "Nombre completo" },
      { id: "apellido_paterno", label: "Apellido paterno (si aplica)" },
      { id: "apellido_materno", label: "Apellido materno (si aplica)" },
      { id: "rfc", label: "RFC", hint: "12 o 13 caracteres alfanuméricos." },
      { id: "curp", label: "CURP", hint: "18 caracteres alfanuméricos." },
      { id: "nss", label: "NSS — Número de Seguridad Social", hint: "11 dígitos." },
      { id: "fecha_nacimiento", label: "Fecha de nacimiento" },
      { id: "domicilio", label: "Domicilio completo" },
      { id: "codigo_postal", label: "Código postal" },
      { id: "municipio", label: "Municipio o alcaldía" },
      { id: "entidad", label: "Entidad federativa" },
      { id: "razon_social", label: "Razón social (si es persona moral)" },
      { id: "registro_patronal", label: "Registro patronal IMSS (si aparece)" },
      { id: "fecha", label: "Fecha principal del documento" },
      { id: "folio", label: "Folio o número de referencia" },
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
export function construirPromptSistema(
  docType: DocType,
  // Si se pasa `targetCampos`, sobre-escribe la lista de campos a extraer.
  // Lo usa el flujo "extracción dirigida por trámite": el frontend manda los
  // campos del field_schema del trámite que estás llenando, y la IA solo
  // busca esos en el documento — los que no encuentre quedan en null sin
  // ensuciar otros campos del form.
  targetCampos?: ColumnaTabla[]
): string {
  const camposParaPrompt = targetCampos ?? docType.campos;
  // Incluimos el hint en cada línea cuando existe — le da al modelo señales
  // específicas (formato esperado, dónde mirar, ambigüedades a evitar).
  const camposListados = camposParaPrompt
    .map((c) => {
      const hint = "hint" in c && c.hint ? ` — pista: ${c.hint}` : "";
      return `- ${c.id} — ${c.label}${hint}`;
    })
    .join("\n");

  // Descripción del tipo de documento solo aplica cuando NO hay
  // targetCampos (extracción libre). En extracción dirigida por trámite,
  // el field_schema ya es suficientemente específico.
  const descripcionDoc =
    !targetCampos && docType.descripcion_para_ia
      ? `\n\nContexto del documento:\n${docType.descripcion_para_ia}`
      : "";

  // La tabla solo se pide cuando NO hay targetCampos — la extracción dirigida
  // por trámite no toma tablas (los formatos del apartado 1 son campos planos).
  const seccionTabla = !targetCampos && docType.tabla
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
  const incluyeTabla = !targetCampos && !!docType.tabla;

  return `Eres un extractor de datos de documentos oficiales mexicanos.
Tu tarea: leer el documento adjunto y devolver únicamente sus datos en JSON.
El documento puede ser TEXTO IMPRESO o ESCRITURA MANUSCRITA (el cliente puede
haber anotado los datos a mano sobre el papel).

Tipo de documento: ${docType.label}.${descripcionDoc}

REVISA TODO el documento (anverso, reverso, todas las páginas, todas las
zonas — incluyendo esquinas, márgenes, sellos y zonas OCR). Es común que
los datos clave estén en ubicaciones diferentes al cuerpo central — no
te quedes solo con lo más visible.

Campos planos a extraer (identificador — etiqueta — pista opcional):
${camposListados}
${seccionTabla}

Reglas estrictas:
1. Responde EXCLUSIVAMENTE con un objeto JSON. Nada de texto antes o después.
   Nada de explicaciones. Nada de markdown ni de \`\`\`.
2. Cada campo plano es un objeto con dos claves: "valor" (string o null) y
   "confianza" ("alto" | "medio" | "bajo").
3. Para CADA campo de la lista, debes incluir su clave en la respuesta —
   aunque sea null. No omitas campos.
4. Si un campo plano no aparece en el documento o no se puede leer con
   seguridad, "valor" debe ser null y "confianza" debe ser "bajo".
   NUNCA inventes datos.
5. Para fechas usa el formato DD/MM/AAAA si es posible. Si solo se ve parcial,
   devuélvela tal como aparece.
6. No agregues claves planas que no estén en la lista.
7. Si el documento tiene tabla, lista TODAS las filas que veas — no inventes
   filas. Si el documento no tiene tabla aunque te pidan una, devuelve un
   array vacío [].
${incluyeTabla ? `
8. Para la tabla "${docType.tabla!.id}", cada fila es un objeto con las
   columnas listadas. Devuelve un array (aunque haya solo una fila).
` : ""}
Ejemplo de forma (los valores son ilustrativos):
{"rfc":{"valor":"ABCD010101AAA","confianza":"alto"}${incluyeTabla ? `,"${docType.tabla!.id}":[{"nss":{"valor":"12345678901","confianza":"alto"},"nombre":{"valor":"JUAN PEREZ","confianza":"alto"}}]` : ""}}`;
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
