// Motor de extracción de datos por IA.
//
// Soporta dos tipos de campos:
//   1) Campos planos: "razón social", "RFC", "fecha", etc. → un valor.
//   2) Tabla (opcional): lista de filas con N columnas, ej. para reportes
//      del SUA/EMA/EBA donde hay un trabajador por fila.
//
// Los formatos estructurados (NSS, registro patronal, CURP, RFC, prima RT,
// etc.) viven en lib/formatos-imss.ts — el prompt builder inyecta esas
// pistas automáticamente para cualquier campo cuyo id matchee, incluyendo
// los target_fields que vienen del field_schema de un trámite.

import { hintFormatoPara } from "./formatos-imss";

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
      { id: "rfc", label: "RFC de la persona moral", hint: "Puede no estar — algunas actas se firman antes del RFC." },
      { id: "numero_escritura", label: "Número de escritura pública (número de acta)" },
      { id: "fecha_escritura", label: "Fecha de la escritura" },
      { id: "numero_notaria", label: "Número de notaría o correduría" },
      { id: "titular_notaria", label: "Nombre del notario o corredor titular" },
      { id: "ciudad_notaria", label: "Ciudad y estado de la notaría" },
      { id: "no_libro", label: "Número de libro del protocolo", hint: "Suele venir junto al número de escritura: 'libro X'." },
      { id: "no_foja", label: "Número de foja", hint: "'foja' o 'fojas' del protocolo, si aparece." },
      { id: "registro_publico", label: "Datos de inscripción en el Registro Público", hint: "Número de inscripción, volumen/libro y fecha de registro en el RPC o RPP, si el testimonio trae la boleta." },
      { id: "lugar_constitucion", label: "Lugar de constitución (ciudad, estado)" },
      { id: "fecha_constitucion", label: "Fecha de constitución de la sociedad" },
      { id: "lugar_fecha_constitucion", label: "Lugar y fecha de constitución en una sola frase", hint: "Ej. 'GUADALAJARA, JALISCO, A 15 DE MARZO DE 2019'." },
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
      { id: "estado", label: "Entidad federativa (estado)" },
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
      "El bloque 'NOMBRE' viene en TRES líneas con este orden vertical: " +
      "línea 1 (arriba) = apellido paterno, línea 2 (en medio) = apellido " +
      "materno, línea 3 (abajo) = nombre(s) de pila. Extráelos por separado " +
      "respetando ese orden — NO asumas que la primera línea es el nombre.",
    campos: [
      { id: "nombre", label: "Nombre(s)", hint: "Sin apellidos. Ej. 'JUAN CARLOS'." },
      { id: "apellido_paterno", label: "Apellido paterno" },
      { id: "apellido_materno", label: "Apellido materno" },
      { id: "curp", label: "CURP", hint: "Aparece bajo 'CURP' en el anverso." },
      { id: "clave_elector", label: "Clave de elector" },
      { id: "fecha_nacimiento", label: "Fecha de nacimiento" },
      { id: "sexo", label: "Sexo (H/M)" },
      { id: "domicilio", label: "Domicilio completo", hint: "Calle, número, colonia, CP, municipio, entidad — tal como aparece, en una sola cadena." },
      { id: "estado", label: "Entidad federativa del domicilio", hint: "Estado, ej. 'JALISCO'." },
      { id: "municipio", label: "Municipio o alcaldía" },
      { id: "localidad", label: "Localidad" },
      { id: "seccion", label: "Sección electoral" },
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
      { id: "nombres_representante", label: "Nombre(s) de pila del representante (sin apellidos)" },
      { id: "apellido_paterno_representante", label: "Apellido paterno del representante" },
      { id: "apellido_materno_representante", label: "Apellido materno del representante" },
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
      "patronal (11 posiciones: letra + 10 dígitos, el último es " +
      "verificador), RFC, nombre o razón social, domicilio fiscal del " +
      "patrón, actividad económica, clasificación de riesgo (división, " +
      "grupo, fracción, clase) con su prima, fecha de alta patronal, y " +
      "delegación/subdelegación IMSS de adscripción. " +
      "El registro patronal es el dato crítico — siempre debe extraerse. " +
      "DISTINGUE el tipo de patrón: si el titular es una sociedad (SA de " +
      "CV, S de RL, etc.) es persona MORAL → llena razon_social y deja " +
      "nombre/apellidos null. Si es una persona con nombre y apellidos es " +
      "persona FÍSICA → llena nombre/apellido_paterno/apellido_materno por " +
      "separado Y TAMBIÉN razon_social con el nombre completo.",
    campos: [
      { id: "registro_patronal", label: "Registro patronal del IMSS" },
      { id: "rfc", label: "RFC del patrón" },
      { id: "tipo_persona", label: "Tipo de persona del patrón", hint: "'FISICA' o 'MORAL'. Moral si el titular es una sociedad (SA, S DE RL, AC...)." },
      { id: "razon_social", label: "Razón social o nombre completo del patrón" },
      { id: "nombre", label: "Nombre(s) de pila del patrón (solo persona física)" },
      { id: "apellido_paterno", label: "Apellido paterno del patrón (solo persona física)" },
      { id: "apellido_materno", label: "Apellido materno del patrón (solo persona física)" },
      { id: "domicilio", label: "Domicilio fiscal del patrón (completo)" },
      { id: "actividad", label: "Actividad económica declarada" },
      { id: "division", label: "División de la actividad (clasificación RT)", hint: "1 dígito del catálogo de actividades." },
      { id: "grupo", label: "Grupo de la actividad (clasificación RT)", hint: "2 dígitos del catálogo de actividades." },
      { id: "fraccion_rt", label: "Fracción de la actividad (clasificación RT)" },
      { id: "clase_rt", label: "Clase de riesgo de trabajo" },
      { id: "prima_rt", label: "Prima de riesgo de trabajo (%)" },
      { id: "fecha_alta_patronal", label: "Fecha de alta patronal en el IMSS" },
      { id: "delegacion_imss", label: "Delegación IMSS" },
      { id: "subdelegacion_imss", label: "Subdelegación IMSS" },
    ],
  },
  // Alta patronal ya tramitada: AFIL-01 sellado, acuse de inscripción
  // patronal (IDSE/escritorio virtual) o documento equivalente. Es el
  // documento más completo sobre el patrón — debe salir TODO.
  alta_patronal: {
    id: "alta_patronal",
    label: "Alta patronal / acuse de inscripción (AFIL-01 lleno)",
    descripcion_para_ia:
      "Aviso de inscripción patronal del IMSS ya llenado (formato AFIL-01 " +
      "sellado, acuse del IDSE o del Escritorio Virtual). Contiene TODOS " +
      "los datos del patrón: registro patronal, RFC, CURP (si es persona " +
      "física), nombre o razón social, domicilio completo desglosado, " +
      "actividad económica con su clasificación de riesgo (división, " +
      "grupo, fracción, clase, prima), delegación/subdelegación, fecha de " +
      "inicio de actividades y datos del representante legal. " +
      "Este documento es la fuente más completa — extrae TODO lo que veas. " +
      "DISTINGUE persona física (nombre + apellidos separados) de persona " +
      "moral (razón social).",
    campos: [
      { id: "registro_patronal", label: "Registro patronal del IMSS" },
      { id: "rfc", label: "RFC del patrón" },
      { id: "curp", label: "CURP del patrón (solo persona física)" },
      { id: "tipo_persona", label: "Tipo de persona", hint: "'FISICA' o 'MORAL'." },
      { id: "razon_social", label: "Razón social o nombre completo del patrón" },
      { id: "nombre", label: "Nombre(s) de pila (solo persona física)" },
      { id: "apellido_paterno", label: "Apellido paterno (solo persona física)" },
      { id: "apellido_materno", label: "Apellido materno (solo persona física)" },
      { id: "calle", label: "Calle del domicilio" },
      { id: "numero_exterior", label: "Número exterior" },
      { id: "numero_interior", label: "Número interior" },
      { id: "colonia", label: "Colonia" },
      { id: "codigo_postal", label: "Código postal" },
      { id: "localidad", label: "Localidad" },
      { id: "municipio", label: "Municipio o alcaldía" },
      { id: "estado", label: "Entidad federativa (estado)" },
      { id: "telefono", label: "Teléfono" },
      { id: "correo", label: "Correo electrónico" },
      { id: "actividad", label: "Actividad económica / giro declarado" },
      { id: "division", label: "División (clasificación RT)" },
      { id: "grupo", label: "Grupo (clasificación RT)" },
      { id: "fraccion_rt", label: "Fracción (clasificación RT)" },
      { id: "clase_rt", label: "Clase de riesgo de trabajo" },
      { id: "prima_rt", label: "Prima de riesgo de trabajo (%)" },
      { id: "fecha_inicio_actividades", label: "Fecha de inicio de actividades / alta" },
      { id: "delegacion_imss", label: "Delegación IMSS" },
      { id: "subdelegacion_imss", label: "Subdelegación IMSS" },
      { id: "nombre_representante", label: "Nombre completo del representante legal" },
      { id: "curp_representante", label: "CURP del representante legal" },
      { id: "folio", label: "Folio o número de acuse" },
      { id: "fecha", label: "Fecha de sello o emisión del acuse" },
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
      { id: "rfc", label: "RFC" },
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
      { id: "estado", label: "Entidad federativa (estado)" },
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
      { id: "estado", label: "Entidad federativa (estado)" },
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
      { id: "rfc", label: "RFC" },
      { id: "curp", label: "CURP" },
      { id: "nss", label: "NSS — Número de Seguridad Social" },
      { id: "fecha_nacimiento", label: "Fecha de nacimiento" },
      { id: "domicilio", label: "Domicilio completo" },
      { id: "codigo_postal", label: "Código postal" },
      { id: "municipio", label: "Municipio o alcaldía" },
      { id: "estado", label: "Entidad federativa (estado)" },
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
  // El hint local del campo (ubicación en el doc) se combina con el hint
  // de formato del catálogo central (estructura exacta del dato).
  const conHints = (c: { id: string; label: string; hint?: string }) => {
    const partes = [c.hint, hintFormatoPara(c.id)].filter(Boolean);
    const hint = partes.length > 0 ? ` — pista: ${partes.join(" ")}` : "";
    return `- ${c.id} — ${c.label}${hint}`;
  };
  const camposListados = camposParaPrompt.map(conHints).join("\n");

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
Cada fila representa una entrada distinta. Sus columnas (identificador — etiqueta — pista opcional):
${docType.tabla.columnas.map(conHints).join("\n")}

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
6. Cuando la pista de un campo indique un formato exacto (longitud, patrón,
   estructura), VERIFICA que lo extraído lo cumpla antes de responder. Si no
   lo cumple, vuelve a mirar esa zona del documento; si sigue sin cumplir,
   devuelve lo que leíste pero con confianza "bajo".
6b. NOMBRES DE PERSONA — convención mexicana. Para separar nombre(s) y
   apellidos: si el documento los etiqueta o los pone en líneas separadas
   (INE: paterno arriba, materno en medio, nombre abajo), usa eso. Si solo
   hay una línea corrida, los documentos oficiales suelen ir APELLIDOS
   PRIMERO ("PEREZ LOPEZ JUAN CARLOS" = paterno PEREZ, materno LOPEZ,
   nombres JUAN CARLOS). Con una CURP a la vista, úsala para confirmar la
   separación (sus iniciales codifican paterno, materno y nombre). Con solo
   2 palabras: 1 nombre + 1 apellido paterno, apellido materno null — NUNCA
   lo inventes. Con 3 palabras SIN etiquetas ni CURP, la división es
   ambigua (¿2 nombres + 1 apellido o 1 nombre + 2 apellidos?): elige la
   más probable y baja la confianza de los tres campos a "medio" como
   máximo para que el usuario lo revise.
7. No agregues claves planas que no estén en la lista.
8. Si el documento tiene tabla, lista TODAS las filas que veas — no inventes
   filas. Si el documento no tiene tabla aunque te pidan una, devuelve un
   array vacío [].
${incluyeTabla ? `
9. Para la tabla "${docType.tabla!.id}", cada fila es un objeto con las
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
