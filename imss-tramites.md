# Sistema de Trámites IMSS — Documento de Arquitectura y Plan de Construcción

> **Nombre de trabajo del proyecto:** `tramites-imss`
> Cámbialo si tienes uno definitivo. Aparece en: nombre de carpeta, nombre de base de datos y prompts.

> **Propósito de este documento.** Es el plano completo del proyecto. Sirve para dos cosas:
> 1. Que tú entiendas qué se va a construir y por qué, sin tener que recordar la conversación.
> 2. Que lo uses como fuente de verdad al construir con Claude Code: los prompts de la Parte 9 están escritos para pegarse tal cual, en orden.
>
> **Cómo leerlo.** Las Partes 1 a 8 son el diseño. La Parte 9 son los prompts de construcción. La Parte 10 son advertencias de costo y decisiones pendientes. Léelo completo una vez antes de tocar Claude Code.

---

## PARTE 0 — Resumen en una página

**Qué es.** Una aplicación web interna para una papelería que tramita asuntos del IMSS. La usan ~3 personas hoy (hasta ~10 en el futuro) y atiende ~1000-2000 clientes al mes. No se vende; es herramienta de uso interno.

**El problema que resuelve.** Llenar formatos del IMSS (prealtas patronales, AFIL, certificado digital, escritos) es lento porque hay que transcribir a mano datos desde actas constitutivas, comprobantes de domicilio, tarjetas patronales e identificaciones. Y el portal del IMSS es tedioso de capturar.

**La idea central.** El celular es la cámara: se fotografía el documento fuente. El sistema extrae los datos con IA. La computadora es la mesa de trabajo: ahí se revisan, corrigen y se usan para producir el resultado (un PDF lleno, o el pegado automático en el portal del IMSS vía extensión de navegador).

**Los cuatro apartados de la app:**
1. **Escritos y llenado de formatos** → produce PDF lleno y modificable (AFIL-01, AM-SRT, AFIL-02/03/04, escritos, etc.).
2. **Altas patronales, prealtas y certificado digital** → extensión de navegador (Edge) que pega los datos en el portal real del IMSS.
3. **Extracción de datos** → escáner "suelto": subes un documento, te devuelve los datos extraídos.
4. **Genérico / formulario para cliente** → copiar-y-pegar para trámites sin módulo propio, y modo para que el cliente capture sus datos.

**Stack:** Next.js (App Router) + Supabase (Postgres, Storage, Realtime) + API de Anthropic (modelo Haiku para extracción) + extensión de navegador Chromium (funciona en Edge).

**Costo de operar:** ~9 USD/mes para 2000 documentos (modelo Haiku, precios mayo 2026). Costo de *construir*: bastante mayor, ver Parte 10.

**Orden de construcción:** Fase 0 (cimientos) → Apartado 3 (extracción) → Apartado 1 (formatos a PDF) → Apartado 4 (genérico) → Apartado 2 (extensión). Razón: el motor de extracción es la base de la que dependen los demás; la extensión es lo más difícil y necesita inspeccionar el portal contigo.

---

## PARTE 1 — Principios de diseño del sistema

Estos principios son la columna vertebral. Todo lo demás se deriva de aquí. Si en algún momento de la construcción una decisión contradice un principio, gana el principio.

### 1.1 Principio del motor genérico: "trámite = campos + documentos fuente"

El error más fácil y más caro sería programar el sistema alrededor de formatos específicos ("código para llenar el AFIL-01"). Eso hace el sistema rígido: cada formato nuevo obligaría a reprogramar.

En cambio, **todo trámite del IMSS se modela como dos listas**:

- **Una lista de campos de salida** — lo que el trámite necesita (ej. `razon_social`, `rfc`, `curp_representante`, `calle`, `numero_escritura`...). Cada campo tiene: identificador, etiqueta legible, tipo (texto/fecha/número/selección), si es obligatorio, y a qué sección pertenece.
- **Una lista de documentos fuente** — de dónde salen esos campos (ej. acta constitutiva, comprobante de domicilio, INE del representante, tarjeta patronal).

El sistema tiene **un solo motor** que: recibe documentos fuente → extrae todos los datos posibles → los mapea a los campos del trámite elegido. **Agregar un trámite nuevo es solo crear su definición de campos en la base de datos. No se toca código.**

Esto es lo que hace el sistema escalable a "todos los trámites del IMSS" sin reescribirlo.

### 1.2 Principio de separación de dispositivos

- **El celular es la cámara.** Su única función: tomar/subir foto del documento y decir a qué trámite pertenece. Interfaz mínima.
- **La computadora es la mesa de trabajo.** Ahí se revisa, corrige y se produce el resultado.
- **El puente es Supabase.** El celular sube; la computadora escucha en tiempo real y muestra lo que llega.

### 1.3 Principio de revisión humana obligatoria

La IA **nunca** produce un resultado final sin revisión. Siempre: extraer → **mostrar al humano para verificar/corregir** → producir. La IA propone; la persona confirma. Esto no es opcional: es la diferencia entre una herramienta confiable y uno que mete errores en trámites legales.

### 1.4 Principio de sistema compartido sin cuentas (por ahora)

No hay login. Las ~3 personas comparten un solo espacio y ven los mismos datos. Es más simple y suficiente para empezar. Única protección necesaria: marcar una captura como "en proceso" cuando alguien la abre, para que dos personas no trabajen la misma. (Ver 4.3.)

> **Decisión futura, no ahora:** si crecen a 10 personas y quieren historial por usuario, se añaden cuentas. El diseño de la base de datos (Parte 4) deja espacio para esto sin rehacer nada.

### 1.5 Principio de presupuesto consciente

El modelo de IA por defecto es **Haiku** (el más barato que sirve para extracción). Las imágenes se redimensionan antes de enviarse a la API para no pagar de más. El costo de operación objetivo es < 20 USD/mes.

### 1.6 Principio de diseño: herramienta de trabajo, no escaparate

La interfaz es minimalista y funcional. Esto es una **herramienta interna** que usan ~3 personas todos los días, no una página de marketing. El criterio de diseño no es "impactar", es: rapidez, claridad, cero fricción y cero errores de captura.

> **Nota honesta sobre tus skills de diseño.** Tus skills `ui-ux-brain` y `bd-web-design` están orientadas a landing pages y sitios de marketing (hablan de "conversión", "una CTA principal", "tono editorial/brutalist/luxury"). Esa parte **no aplica** a este proyecto y no debe usarse aquí — forzar un "tono de marca" en una herramienta de trabajo interna es un error. Lo que **sí** se toma de esas skills, y es exactamente lo que este sistema necesita:
> - Sistema de espaciado base-4 (múltiplos de 4: 4/8/12/16/24/32/48...).
> - Jerarquía visual por tamaño, peso y color.
> - Cada componente con todos sus estados: normal, vacío, carga, error, éxito, deshabilitado.
> - Accesibilidad WCAG AA: contraste ≥ 4.5:1, focus visible, labels en todos los inputs.
> - Targets táctiles ≥ 44px en la vista de celular.
> - Formularios con label siempre visible (no solo placeholder) y errores descriptivos con solución.
> - Una sola tipografía sans-serif; tamaños de app/dashboard (rara vez > 24px).
>
> La skill `responsive-audit` no se usa para construir — se usa para **revisar** la app terminada en la Fase 5.

---

## PARTE 2 — Alcance: qué se construye y qué NO

Ser explícito sobre lo que queda fuera es tan importante como lo que queda dentro. Evita que el sistema se desvíe.

### 2.1 Dentro del alcance

- Los cuatro apartados descritos en la Parte 3.
- Extracción de datos por IA desde foto/escaneo de documentos.
- Generación de PDF lleno y editable para formatos.
- Una extensión de navegador para pegar datos en el portal del IMSS.
- Flujo celular → computadora en tiempo real.
- Catálogo de trámites ampliable sin programar.

### 2.2 Fuera del alcance (decidido a propósito)

- **SIPARE:** no se "llena". SIPARE solo recibe un archivo generado por el SUA y devuelve una línea de captura. No hay formulario que automatizar. → Fuera.
- **Semanas cotizadas / consulta de NSS:** son consultas, no llenados. Solo requieren CURP o NSS. → Fuera (a lo mucho, un enlace directo en el Apartado 4).
- **SUA:** software de escritorio del IMSS, complejo, requiere entrar a varios apartados. → Fuera, explícitamente descartado por el usuario.
- **Expedientes de clientes / base de datos de clientes:** el usuario decidió no implementarlos. Cada trámite es independiente. → Fuera.
- **Cuentas de usuario / login:** fuera por ahora (ver 1.4).
- **Que el sistema "se meta solo" al portal sin extensión:** imposible técnicamente (los navegadores prohíben que una web toque otra web). La única vía es la extensión. → Por eso el Apartado 2 ES una extensión.

### 2.3 Limitación técnica conocida

La extensión del Apartado 2 necesita los **nombres internos de los campos HTML** del portal del IMSS (`altapatronalpresencial.imss.gob.mx`). Eso no se puede adivinar ni yo puedo inspeccionarlo remotamente. Se obtiene contigo, con el portal abierto, en la fase del Apartado 2 (instrucciones en el Prompt 9.F).

---

## PARTE 3 — Los cuatro apartados en detalle

La pantalla de inicio es el **"quiz"**: una sola pregunta — *"¿Qué trámite vas a hacer?"* — con cuatro opciones grandes que llevan a cada apartado.

### Apartado 1 — Escritos y llenado de formatos

**Qué hace.** Produce un PDF lleno y modificable de un formato del IMSS o de un escrito.

**Flujo:**
1. La persona elige el formato (AFIL-01, AM-SRT, AFIL-02/03/04, escrito "a quien corresponda", etc.).
2. El sistema muestra los campos de ese formato (definición del catálogo, ver Parte 4).
3. Los campos se pueden llenar a mano, **o** alimentarse desde el Apartado 3 (extracción).
4. La persona revisa y corrige.
5. El sistema genera el PDF: para formatos oficiales, superpone los datos sobre el formato real; para escritos, genera el documento desde plantilla.
6. El PDF se puede volver a abrir y modificar (los datos quedan guardados en Supabase).

**Formatos iniciales sugeridos:** empezar con **AFIL-01** y **escrito genérico "a quien corresponda"** (los más simples y usados). Luego AM-SRT, ARP-PM, ARP-PF, AFIL-02/03/04, uno por uno.

**Resultado:** archivo PDF descargable e imprimible.

### Apartado 2 — Altas patronales, prealtas y certificado digital

**Qué hace.** Es una **extensión de navegador** (Chromium → funciona en Edge) que pega datos en el portal real del IMSS.

**Por qué es extensión y no PDF:** el portal de prealtas (`altapatronalpresencial.imss.gob.mx`) no recibe PDFs; se capturan campos en su sitio web. Solo una extensión puede escribir en esos campos.

**Trámites de este apartado:**
- Prealta patronal **persona moral** (formato ARP-PM / portal `initCapturaMoral`).
- Prealta patronal **persona física** (formato ARP-PF / portal `initCapturaFisica`).
- **Certificado digital** (formulario "Solicitud de Certificado Digital").

**Flujo:**
1. En la app, la persona elige el trámite y revisa que todos los datos extraídos estén completos y correctos (los datos vienen del Apartado 3).
2. Abre el portal del IMSS en Edge.
3. Activa la extensión: la extensión lee los datos guardados en el sistema y los **pega campo por campo, de forma controlada**, en el portal.
4. La persona verifica visualmente, resuelve el CAPTCHA a mano y envía.

**Por qué "de forma controlada" resuelve el problema de las páginas que se traban:** la extensión llena los campos uno por uno con pequeñas pausas, respetando el ritmo del portal — más estable que un humano apurado o que un pegado masivo.

**Estructura interna del Apartado 2 (dos piezas que trabajan juntas):**
- **Tu sistema web** (Supabase) — guarda qué campos lleva cada trámite y los datos extraídos. Es el "catálogo" y la "memoria".
- **La extensión** — pieza ligera; su único trabajo es leer del sistema y pegar en el portal.

**Pendiente obligatorio:** mapear los nombres internos de los campos del portal (Prompt 9.F).

### Apartado 3 — Extracción de datos

**Qué hace.** El escáner "suelto". Subes un documento, te dice qué datos sacó. Es el **motor** que también alimenta a los Apartados 1 y 2.

**Flujo:**
1. La persona (normalmente desde el celular) toma foto o sube el documento.
2. Opcionalmente indica qué tipo de documento es (acta, comprobante de domicilio, INE, tarjeta patronal) — ayuda a la extracción pero no es obligatorio.
3. El sistema redimensiona la imagen, la envía a la API de Anthropic (Haiku) con una instrucción de extracción estructurada.
4. La IA devuelve los datos en formato estructurado (JSON).
5. Se muestran en pantalla, en campos editables, con la imagen al lado para comparar.

**Uso doble:** standalone (solo extraer y ver), o como paso 1 de un trámite de los Apartados 1 y 2.

**Documentos fuente típicos y qué se saca de cada uno:**
- **Acta constitutiva:** razón social, tipo de sociedad, RFC, número de escritura, número de notaría/correduría, lugar y fecha de constitución, folio mercantil, nombre del representante legal, objeto social/giro. (~8-9 campos.)
- **Comprobante de domicilio:** calle, número exterior/interior, colonia, localidad, municipio, entidad, código postal.
- **INE / identificación:** nombre, apellidos, CURP, domicilio.
- **Tarjeta de Identificación Patronal (TIP):** registro patronal, RFC, razón social, domicilio. (Documento de formato fijo → extracción muy confiable.)
- **Cédula RFC / Constancia de Situación Fiscal:** RFC, razón social/nombre, régimen, domicilio fiscal.

### Apartado 4 — Genérico / formulario para cliente

**Qué hace.** Dos funciones en un apartado:

**4a. Copiar y pegar genérico.** Para cualquier trámite que aún no tiene módulo propio (ej. altas y bajas de trabajador con nombre + NSS). Muestra los datos en campos con botón de "copiar" en cada uno. La persona los pega manualmente donde haga falta. Es el comodín que garantiza que el sistema sirve aunque el trámite no esté formalizado.

**4b. Formulario para cliente.** Si se pone una computadora para que el cliente capture sus propios datos mientras el personal atiende otra cosa: un formulario simple, claro, que el cliente llena solo. Esos datos quedan disponibles para que el personal los retome.

**Resultado:** datos estructurados, listos para copiar o para retomar.

---

## PARTE 4 — Modelo de datos (Supabase / PostgreSQL)

Diseño de tablas. Es deliberadamente simple. Los nombres están en inglés por convención técnica; las etiquetas visibles van en español.

### 4.1 Tabla `tramite_types` — catálogo de trámites

El corazón del motor genérico. Cada fila es un tipo de trámite.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | Identificador. |
| `code` | text | Código corto único, ej. `afil-01`, `arp-pm`, `cert-digital`. |
| `name` | text | Nombre legible, ej. "Prealta Patronal Persona Moral". |
| `apartado` | int | A qué apartado pertenece (1, 2, 3 o 4). |
| `output_type` | text | `pdf`, `extension`, o `copy`. |
| `field_schema` | jsonb | La lista de campos (ver 4.2). |
| `source_docs` | jsonb | Lista de documentos fuente esperados. |
| `portal_url` | text | (Solo apartado 2) URL del portal. |
| `active` | bool | Si está disponible en la app. |
| `created_at` | timestamptz | — |

### 4.2 Estructura de `field_schema` (JSON dentro de `tramite_types`)

Cada campo es un objeto. Ejemplo de un campo:

```json
{
  "id": "razon_social",
  "label": "Denominación o Razón Social",
  "type": "text",
  "required": true,
  "section": "Datos del patrón",
  "source_doc": "acta_constitutiva",
  "portal_selector": null
}
```

- `type`: `text` | `date` | `number` | `select` | `checkbox`.
- `section`: agrupa campos en la interfaz (igual que las secciones del formato oficial).
- `source_doc`: de qué documento se extrae (ayuda al mapeo automático).
- `portal_selector`: (apartado 2) el nombre/selector del campo en el portal del IMSS. Se llena en la fase 9.F.

### 4.3 Tabla `tramites` — cada trámite en curso

Una fila por cada caso que se está trabajando.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | Identificador. |
| `tramite_type_id` | uuid | Referencia a `tramite_types`. |
| `status` | text | `nuevo`, `en_proceso`, `revisado`, `completado`. |
| `field_values` | jsonb | Los datos: `{ "razon_social": "...", "rfc": "..." }`. |
| `claimed_by` | text | Nombre de quién lo tiene abierto (para evitar choques, ver 1.4). |
| `claimed_at` | timestamptz | Cuándo se marcó "en proceso". |
| `created_at` | timestamptz | — |
| `updated_at` | timestamptz | — |

### 4.4 Tabla `documents` — documentos escaneados

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | Identificador. |
| `tramite_id` | uuid | A qué trámite pertenece (puede ser null si es extracción suelta). |
| `storage_path` | text | Ruta del archivo en Supabase Storage. |
| `doc_type` | text | `acta`, `comprobante_domicilio`, `ine`, `tip`, etc. |
| `extracted_data` | jsonb | Lo que la IA sacó de este documento. |
| `extraction_status` | text | `pendiente`, `procesando`, `listo`, `error`. |
| `created_at` | timestamptz | — |

### 4.5 Supabase Storage

Un bucket llamado `documentos`. Guarda las imágenes/PDFs subidos. Acceso privado (no público).

### 4.6 Supabase Realtime

La vista de computadora se suscribe a cambios en las tablas `tramites` y `documents`. Cuando el celular sube algo o la IA termina de extraer, la computadora se actualiza sola, sin recargar.

---

## PARTE 5 — Flujo técnico de la extracción con IA

Esta es la pieza que más cuida el presupuesto y la calidad. Detalle paso a paso.

### 5.1 El recorrido de un documento

1. **Captura.** El celular sube la imagen. Antes de subir, se redimensiona en el navegador a un máximo razonable (lado largo ~1600 px, calidad JPEG ~80%). Esto baja el costo de tokens sin perder legibilidad.
2. **Almacenamiento.** La imagen va a Supabase Storage; se crea una fila en `documents` con `extraction_status = pendiente`.
3. **Procesamiento.** Una función de servidor (API route de Next.js) toma la imagen, la convierte a base64 y la envía a la API de Anthropic.
4. **Extracción.** Se usa el modelo **Haiku**. El mensaje incluye la imagen + una instrucción que pide los campos específicos en JSON y nada más.
5. **Guardado.** La respuesta JSON se valida y se guarda en `documents.extracted_data`; `extraction_status = listo`.
6. **Mapeo.** Si el documento pertenece a un trámite, los datos extraídos se vuelcan a `tramites.field_values`, emparejando por `id` de campo.
7. **Revisión.** La computadora muestra los datos en campos editables.

### 5.2 Cómo se le pide a la IA (estructura del prompt de extracción)

El prompt del sistema para la API debe ser explícito y cerrado. Estructura:

- Indica el rol: "extraes datos de documentos oficiales mexicanos".
- Indica el tipo de documento (si se conoce).
- Da la lista exacta de campos a extraer, con su identificador.
- Ordena: devolver **solo** un objeto JSON, sin texto adicional, sin explicaciones, sin ```.
- Ordena: si un campo no aparece en el documento, devolverlo como `null` — nunca inventar.
- Pide opcionalmente un campo `confianza` por dato (alto/medio/bajo) para resaltar en la interfaz lo que conviene revisar con más cuidado.

### 5.3 Manejo de errores

- Si la API falla o devuelve algo que no es JSON válido: `extraction_status = error`, y la interfaz lo muestra para reintentar.
- Nunca se bloquea la interfaz esperando: el usuario ve "procesando..." y el resultado aparece cuando está listo (vía Realtime).

### 5.4 Control de costo

- Modelo Haiku siempre para extracción.
- Imágenes redimensionadas antes de enviar.
- No reintentar automáticamente en bucle (un reintento manual, no infinito).
- Estimado: ~9 USD/mes a 2000 documentos. Ver Parte 10 para el detalle y los riesgos.

---

## PARTE 6 — Arquitectura de la extensión de navegador (Apartado 2)

### 6.1 Qué es y qué no es

- **Es** una extensión Chromium (Manifest V3). Se instala en Microsoft Edge igual que en Chrome — mismo motor, mismo código, sin cambios.
- **No es** Internet Explorer (descontinuado, sin extensiones modernas — no se usa).
- **Su único trabajo:** leer los datos de un trámite desde el sistema y escribirlos en los campos del portal del IMSS.

### 6.2 Piezas de la extensión

- **Popup:** una ventana pequeña al hacer clic en el icono. Muestra la lista de trámites listos para pegar y un botón "Llenar formulario".
- **Content script:** el código que corre dentro de la página del portal del IMSS y escribe en los campos.
- **Conexión con el sistema:** la extensión consulta los datos del trámite desde Supabase (lectura).

### 6.3 Cómo pega los datos

1. La persona abre el portal del IMSS en Edge y va a la página de captura.
2. Hace clic en la extensión, elige el trámite.
3. El content script localiza cada campo del portal usando su `portal_selector` (guardado en `field_schema`) y escribe el valor, campo por campo, con pausas cortas.
4. Para listas desplegables (entidad, municipio, función): selecciona la opción correcta.
5. La persona revisa, hace el CAPTCHA y envía manualmente.

### 6.4 El paso pendiente: mapeo de campos del portal

Para que el content script sepa dónde escribir, necesita el nombre/selector HTML de cada campo del portal. Eso se obtiene así (instrucciones completas en el Prompt 9.F):
- Abrir el portal en Edge, ir a la página de captura.
- Abrir las herramientas de desarrollador (tecla F12).
- Inspeccionar cada campo y anotar su atributo `name` o `id`.
- Esos nombres se cargan en el `portal_selector` de cada campo en `tramite_types`.

Esto se hace **una vez por cada portal** (moral, física, certificado). Después la extensión funciona sola.

### 6.5 Límite honesto

Si el IMSS cambia su portal, los selectores cambian y hay que volver a mapear. Es mantenimiento normal de cualquier extensión que depende de un sitio externo. No es un defecto del diseño; es la naturaleza de automatizar un sitio ajeno.

---

## PARTE 7 — Stack técnico y estructura de archivos

### 7.1 Tecnologías

| Componente | Tecnología | Por qué |
|---|---|---|
| Aplicación web | Next.js (App Router) | Maneja front y back en un solo proyecto; API routes para hablar con la IA. |
| Base de datos | Supabase (PostgreSQL) | Decisión ya tomada por el usuario; incluye Realtime y Storage. |
| Almacenamiento de archivos | Supabase Storage | Imágenes y PDFs. |
| Tiempo real | Supabase Realtime | Conecta celular y computadora sin recargar. |
| Extracción IA | API de Anthropic, modelo Haiku | Más barato adecuado para extracción. |
| Generación de PDF | Librería de PDF en el servidor | Para el Apartado 1. |
| Extensión | Manifest V3 (Chromium/Edge) | Para el Apartado 2. |
| Estilos | Tailwind CSS, guiado por las reglas de diseño de 1.6 | Aplica los tokens base-4, jerarquía y accesibilidad de tus skills (la parte de "herramienta", no la de "marketing"). |

### 7.2 Estructura de carpetas (orientativa)

```
tramites-imss/
├── app/                      # Páginas (Next.js App Router)
│   ├── page.tsx              # Pantalla inicio: el "quiz"
│   ├── apartado-1/           # Escritos y formatos
│   ├── apartado-2/           # Altas/prealtas/certificado
│   ├── apartado-3/           # Extracción de datos
│   ├── apartado-4/           # Genérico / formulario cliente
│   ├── movil/                # Vista de celular (captura)
│   └── api/
│       ├── extraer/          # Llama a la API de Anthropic
│       └── generar-pdf/      # Genera PDF del Apartado 1
├── lib/
│   ├── supabase.ts           # Conexión a Supabase
│   ├── extraccion.ts         # Lógica de extracción y prompts
│   └── tramites.ts           # Lógica del motor genérico
├── components/               # Componentes de interfaz reutilizables
├── extension/                # La extensión de navegador (Apartado 2)
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   └── content.js
├── .env.local                # Claves (NUNCA se sube a Git)
└── README.md
```

### 7.3 Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
```

> **Seguridad:** `.env.local` va en `.gitignore` desde el primer commit. La `ANTHROPIC_API_KEY` y la `SERVICE_ROLE_KEY` **solo** se usan en el servidor (API routes), nunca en el navegador. Si una clave se expone, hay que rotarla.

---

## PARTE 8 — Plan de construcción por fases

Orden y razón. No saltarse fases: cada una se apoya en la anterior.

| Fase | Qué se construye | Por qué en este orden |
|---|---|---|
| **Fase 0** | Cimientos: proyecto Next.js, conexión Supabase, tablas, pantalla "quiz" vacía. | Sin esto no hay dónde construir lo demás. |
| **Fase 1** | Apartado 3 — extracción de datos. | Es el motor. Los Apartados 1 y 2 lo necesitan. |
| **Fase 2** | Apartado 1 — formatos a PDF (empezar con AFIL-01 + escrito genérico). | Usa el motor de la Fase 1. Es el corazón visible. |
| **Fase 3** | Apartado 4 — genérico y formulario para cliente. | Lo más simple; cierra rápido el grueso de la app. |
| **Fase 4** | Apartado 2 — extensión de navegador. | Lo más difícil; necesita inspección del portal contigo. Se deja al final a propósito. |
| **Fase 5** | Pulido: vista de celular, tiempo real, marca "en proceso", manejo de errores. | Ajuste final con todo ya funcionando. |

Cada fase debe quedar **funcionando y probada** antes de pasar a la siguiente. Es la regla que evita terminar con muchas cosas a medias.

---

## PARTE 9 — Prompts de construcción para Claude Code

> **Cómo usar esta parte.** Cada prompt es un bloque que pegas en Claude Code, en orden. No pegues el siguiente hasta que el anterior funcione. Antes de pegar el Prompt A, lee la nota de costo de la Parte 10.
>
> **Sobre tus skills.** Copia tus tres skills a la carpeta `.claude/skills/` del proyecto (cada una en su subcarpeta). Así Claude Code puede leerlas. Los prompts ya le dicen a Claude Code que las consulte. Donde diga `[TUS DATOS]` pon el dato real.
>
> **Importante sobre el diseño:** los prompts instruyen a Claude Code a usar tus skills de diseño **solo en lo que aplica a una herramienta interna** (espaciado base-4, jerarquía, estados de componentes, accesibilidad, formularios) y a **ignorar** la parte de landing pages / tono de marca / conversión. Ver el principio 1.6. No borres esa instrucción de los prompts.

### Prompt 9.A — Fase 0: Cimientos

```
Vamos a construir una aplicación web llamada "tramites-imss". Es una herramienta
interna para una papelería que hace trámites del IMSS.

Stack: Next.js con App Router, TypeScript, y Supabase (PostgreSQL + Storage + Realtime).

En esta primera fase quiero SOLO los cimientos:
1. Inicializa el proyecto Next.js con App Router y TypeScript.
2. Instala y configura el cliente de Supabase. Las claves van en .env.local;
   crea un .env.local.example con los nombres de las variables vacías. Asegúrate
   de que .env.local esté en .gitignore.
3. Crea un archivo lib/supabase.ts con la conexión.
4. Crea la pantalla de inicio (app/page.tsx): una sola pregunta grande,
   "¿Qué trámite vas a hacer?", con cuatro botones grandes que por ahora solo
   navegan a /apartado-1, /apartado-2, /apartado-3, /apartado-4 (páginas vacías
   con un título cada una).
5. Crea las migraciones SQL para estas tablas en Supabase: tramite_types,
   tramites, documents. Usa exactamente esta estructura: [PEGAR AQUÍ LA PARTE 4
   DE ESTE DOCUMENTO].

Para el diseño visual: consulta las skills en .claude/skills/ (ui-ux-brain y
bd-web-design), pero aplica SOLO lo relativo a una herramienta de trabajo
interna: sistema de espaciado base-4, jerarquía visual, accesibilidad WCAG AA,
formularios con labels visibles, targets de 44px en móvil, y todos los estados
de cada componente (normal/vacío/carga/error/éxito). IGNORA todo lo que esas
skills dicen sobre landing pages, tono de marca, conversión o "una CTA
principal": este no es un sitio de marketing.

Sigue también las buenas prácticas de Git descritas en la Parte 11 de este
documento: inicializa Git, crea un .gitignore correcto desde el primer commit,
y haz commits pequeños con mensajes claros.

No construyas nada de los apartados todavía. Solo los cimientos. Al terminar,
dime cómo correr el proyecto localmente y cómo aplicar las migraciones.
```

### Prompt 9.B — Fase 1: Apartado 3 (extracción)

```
Ahora vamos a construir el Apartado 3: extracción de datos con IA.

Contexto: el motor genérico trata cada trámite como "campos + documentos fuente".
Este apartado es el motor que extrae datos de un documento escaneado.

Construye:
1. La vista de celular en app/movil: una interfaz mínima para tomar/subir foto
   de un documento. Antes de subir, redimensiona la imagen en el navegador
   (lado largo máximo 1600px, JPEG calidad 80%). Sube la imagen a Supabase
   Storage (bucket "documentos") y crea una fila en la tabla documents con
   extraction_status = 'pendiente'.
2. Una API route en app/api/extraer que: toma la imagen, la convierte a base64,
   y llama a la API de Anthropic con el modelo claude-haiku-4-5. El prompt debe
   pedir los datos en JSON puro (sin texto extra, sin ```), con null para campos
   ausentes, y nunca inventar. Guarda el resultado en documents.extracted_data
   y pon extraction_status = 'listo'. Si falla, extraction_status = 'error'.
3. La vista de computadora en app/apartado-3: muestra los documentos que van
   llegando (suscripción Realtime a la tabla documents), con la imagen al lado
   de los datos extraídos en campos editables.
4. La ANTHROPIC_API_KEY se usa SOLO en la API route del servidor, nunca en el
   navegador.

Para el prompt de extracción de la IA, sigue la estructura descrita aquí:
[PEGAR AQUÍ LA SECCIÓN 5.2 DE ESTE DOCUMENTO].

Diseño: consulta las skills de .claude/skills/ aplicando SOLO lo relativo a una
herramienta interna (base-4, jerarquía, accesibilidad WCAG AA, formularios con
labels visibles, estados normal/vacío/carga/error/éxito, 44px en móvil); ignora
lo de landing pages y tono de marca. Git: commits pequeños y claros, respeta el
.gitignore (Parte 11).

Pruébalo con una imagen de ejemplo antes de decir que terminaste.
```

### Prompt 9.C — Fase 2: Apartado 1 (formatos a PDF)

```
Ahora el Apartado 1: llenado de formatos y escritos, con salida en PDF.

Construye:
1. En app/apartado-1, una pantalla que lista los trámites disponibles del
   apartado 1 (lee de la tabla tramite_types donde apartado = 1).
2. Al elegir un trámite, muestra sus campos (del field_schema) agrupados por
   sección, en un formulario editable. Los campos se pueden llenar a mano o
   precargarse desde un documento ya extraído en el Apartado 3.
3. Una API route en app/api/generar-pdf que produce el PDF lleno. Para escritos,
   genera el documento desde una plantilla de texto. Para formatos oficiales,
   superpone los valores sobre el formato.
4. El PDF generado se puede descargar. Los datos quedan guardados en
   tramites.field_values para poder reabrir y modificar después.

Para empezar, carga en tramite_types DOS trámites: "AFIL-01" y un escrito
genérico "A quien corresponda". Te paso el field_schema de cada uno: [TUS DATOS:
LISTA DE CAMPOS — ver Parte 4.2 para el formato].

Diseño: consulta las skills de .claude/skills/ aplicando SOLO lo relativo a una
herramienta interna (base-4, jerarquía, accesibilidad WCAG AA, formularios con
labels visibles, estados normal/vacío/carga/error/éxito, 44px en móvil); ignora
lo de landing pages y tono de marca. Git: commits pequeños y claros, respeta el
.gitignore (Parte 11).
```

### Prompt 9.D — Fase 3: Apartado 4 (genérico)

```
Ahora el Apartado 4: genérico y formulario para cliente.

Construye dos modos dentro de app/apartado-4:
1. Modo "copiar y pegar": un formulario simple donde se capturan datos
   (ej. nombre y NSS para altas/bajas de trabajador) y cada campo tiene un
   botón de copiar al portapapeles.
2. Modo "formulario para cliente": una pantalla simple y clara para que un
   cliente capture sus propios datos. Los datos quedan guardados en la tabla
   tramites para que el personal los retome.

Diseño: consulta las skills de .claude/skills/ aplicando SOLO lo relativo a una
herramienta interna (base-4, jerarquía, accesibilidad WCAG AA, formularios con
labels visibles, estados normal/vacío/carga/error/éxito, 44px en móvil); ignora
lo de landing pages y tono de marca. Git: commits pequeños y claros, respeta el
.gitignore (Parte 11).
```

### Prompt 9.E — Fase 5: Pulido (hacer ANTES de la extensión)

```
Antes de la extensión, pulamos lo que ya existe:
1. Verifica que la vista de celular y la de computadora se sincronizan en
   tiempo real (Supabase Realtime) en todos los apartados.
2. Implementa la marca "en proceso": cuando alguien abre un trámite, se escribe
   claimed_by y claimed_at en la tabla tramites; si otra persona lo abre, ve un
   aviso de que ya está en uso.
3. Revisa el manejo de errores: extracción fallida, imagen ilegible, API caída.
   Que nada bloquee la interfaz y siempre se pueda reintentar manualmente.
4. Revisa que la app se vea y funcione bien tanto en celular como en computadora.

Diseño: aplica las reglas de las skills relativas a herramienta interna
(coherencia, accesibilidad, estados de componente). Para esta fase de pulido,
usa además la skill responsive-audit de .claude/skills/ para auditar la app
en varios anchos de pantalla y corregir lo que reporte.
```

### Prompt 9.F — Fase 4: Apartado 2 (extensión) — PASO DE PREPARACIÓN

> **Este prompt NO es para Claude Code. Es para ti.** Antes de construir la extensión hay que mapear el portal. Haz esto:
>
> 1. Abre Microsoft Edge.
> 2. Entra a `https://altapatronalpresencial.imss.gob.mx/sapi/plantillaPatrones.do?method=initCapturaMoral` (y luego al de `initCapturaFisica`, y al de certificado digital).
> 3. Llega a la pantalla de captura de datos.
> 4. Pulsa la tecla **F12** para abrir las herramientas de desarrollador.
> 5. Usa el icono de "seleccionar elemento" (flecha arriba a la izquierda del panel) y haz clic en cada campo del formulario.
> 6. Por cada campo, anota: la etiqueta visible (ej. "Registro Patronal") y su atributo `name` o `id` (aparece resaltado en el HTML, algo como `name="rfcPatron"`).
> 7. Arma una lista: etiqueta → name/id, para cada campo de cada portal.
>
> Esa lista es lo que falta. Cuando la tengas, pásamela y te genero el Prompt 9.G con los selectores reales ya incrustados.

### Prompt 9.G — Fase 4: Apartado 2 (extensión) — CONSTRUCCIÓN

> **Este prompt se completa DESPUÉS de tener el mapeo de 9.F.** Plantilla:

```
Ahora construye el Apartado 2: una extensión de navegador (Manifest V3,
compatible con Microsoft Edge) que pega datos en el portal del IMSS.

La extensión va en la carpeta extension/ y tiene:
1. manifest.json (Manifest V3).
2. popup.html + popup.js: un popup que lista los trámites del apartado 2 que
   están marcados como 'revisado' en la tabla tramites, y un botón "Llenar
   formulario".
3. content.js: el script que corre en el portal del IMSS y escribe los datos
   en los campos, uno por uno, con pausas cortas de unos 150ms entre campos
   para no saturar el portal. Para los desplegables, selecciona la opción
   correcta.

Los campos del portal y sus selectores son: [TUS DATOS: LISTA DEL MAPEO 9.F].

La extensión lee los datos del trámite desde Supabase (solo lectura).

Diseño del popup: minimalista y funcional, siguiendo las reglas de herramienta
interna de las skills de .claude/skills/ (jerarquía, estados, accesibilidad).
```

---

## PARTE 10 — Advertencias honestas y decisiones pendientes

### 10.1 Sobre el costo de CONSTRUIR (lee esto antes de gastar)

Hay dos costos distintos y no hay que confundirlos:

- **Operar el sistema terminado:** ~9 USD/mes para 2000 documentos con Haiku. Barato. Sin problema.
- **Construir el sistema:** mucho más caro. Un proyecto de este tamaño (cuatro apartados + extensión + base de datos) consume, en herramientas tipo Claude Code con API de Anthropic, fácilmente decenas de dólares, posiblemente más de cien, según cuántas correcciones haga falta.

**Con 5 USD no se termina de construir esto.** Es honesto decírtelo de frente. Opciones reales:
- Conseguir más saldo de API.
- Usar Claude Code con suscripción Pro (Claude Code oficial entra en la tarifa plana de la suscripción; Claude Code no — Claude Code cobra por token aparte).
- Construir por fases, evaluando el gasto al final de cada una.

Estos prompts bien detallados **reducen** el gasto (menos vueltas, menos correcciones), pero no lo eliminan.

### 10.2 Sobre usar un "modelo gratuito" si se acaba el saldo

Tentador, pero cuidado: un modelo débil construyendo un proyecto complejo produce código roto que después cuesta más (en tiempo y dinero) arreglar. Es mejor avanzar por partes pequeñas con un buen modelo que hacer todo de golpe con uno flojo. La estructura de este documento ayuda, pero no convierte un modelo flojo en uno capaz.

### 10.3 Decisiones que siguen pendientes

1. **Nombre definitivo del proyecto.** Ahora dice `tramites-imss`. Cámbialo si quieres.
2. **Mapeo de los campos del portal del IMSS** (Prompt 9.F). Obligatorio antes de la extensión. Solo lo puedes hacer tú, con el portal abierto.
3. **Tus tres skills ya están integradas** en los prompts (`ui-ux-brain`, `bd-web-design`, `responsive-audit`). Solo debes copiarlas a la carpeta `.claude/skills/` del proyecto para que Claude Code las lea. Los prompts ya le indican qué usar de ellas y qué ignorar.
4. **El field_schema exacto de cada formato.** El documento define el *formato* de la lista de campos (Parte 4.2); los campos concretos de AFIL-01, ARP-PM, ARP-PF, certificado digital se arman a partir de los PDFs que ya tienes (los numerales de cada formato son, literalmente, la lista de campos).

### 10.4 Riesgo a vigilar: dispersión

Observación honesta y directa: a lo largo del diseño de este proyecto la tendencia fue agregar piezas (extensión, OCR, tablet, SUA, SIPARE, skills...). El documento ya acotó el alcance a lo que de verdad resuelve el problema. **Al construir, respeta el orden de fases y no metas piezas nuevas hasta terminar la fase actual.** Terminar el Apartado 3 funcionando vale más que tener los cuatro a medias.

### 10.5 Qué hacer ahora, en concreto

1. Lee este documento completo una vez.
2. Decide el nombre del proyecto.
3. Ten listas tus tres skills para pegarlas en los marcadores.
4. Evalúa el presupuesto real de construcción (10.1) antes de gastar.
5. Empieza por el Prompt 9.A. No avances al siguiente hasta que el anterior funcione.
6. Cuando llegues a la Fase 4, haz primero el mapeo del portal (9.F) y pásamelo para completar 9.G.

---

## PARTE 11 — Buenas prácticas de Git para este proyecto

Git es el control de versiones. Usarlo bien evita perder trabajo, permite deshacer errores y mantiene el proyecto ordenado. Estas son las reglas para este proyecto.

### 11.1 Inicializar desde el primer momento

En la Fase 0, antes de escribir código real: `git init`. El primer commit debe ser el proyecto base ya con el `.gitignore` puesto. **Nunca** hacer el primer commit sin `.gitignore` — si se sube algo sensible una vez, queda en el historial aunque después se borre.

### 11.2 El `.gitignore` — qué NUNCA se sube

El archivo `.gitignore` le dice a Git qué ignorar. Para este proyecto debe incluir, como mínimo:

```gitignore
# Claves y secretos — CRÍTICO, nunca subir
.env
.env.local
.env*.local

# Dependencias (se reinstalan, no se versionan)
node_modules/

# Compilados y caché de Next.js
.next/
out/
build/
dist/

# Archivos del sistema operativo
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Editor
.vscode/
.idea/

# Archivos temporales
*.tmp
```

**Lo más importante de toda esta sección:** el archivo `.env.local` contiene la `ANTHROPIC_API_KEY` y las claves de Supabase. **Si se sube a Git, esas claves quedan expuestas.** Por eso `.env.local` está en `.gitignore` desde el inicio. En su lugar se versiona un `.env.local.example` con los nombres de las variables pero **sin valores**, para que cualquiera sepa qué claves hacen falta.

> **Recordatorio del proyecto:** en el pasado se expusieron claves de API por accidente. Este `.gitignore` y la regla de usar `.env.local.example` existen precisamente para que no vuelva a pasar. Si alguna clave llega a exponerse, hay que **rotarla** (generar una nueva y desactivar la vieja) — no basta con borrar el archivo.

### 11.3 Commits: pequeños, frecuentes y con mensaje claro

- **Un commit por unidad de trabajo terminada**, no un commit gigante al final del día. Ejemplo: "agregar tabla documents", "crear vista de captura del celular", "conectar API de extracción".
- **Mensajes en presente y descriptivos.** Bien: `agregar pantalla de inicio con los cuatro apartados`. Mal: `cambios`, `arreglos`, `update`.
- Hacer commit cada vez que algo **funciona**. Así siempre hay un punto seguro al cual volver.

### 11.4 Ramas para trabajar seguro

- La rama principal (`main`) siempre debe tener código que **funciona**.
- Para construir algo nuevo o arriesgado, crear una rama aparte: `git checkout -b fase-2-formatos-pdf`. Si sale mal, se descarta la rama sin afectar lo que ya servía.
- Cuando la rama está probada y funciona, se integra a `main`.
- Esto es especialmente importante para la Fase 4 (extensión): es lo más delicado, conviene hacerla en su propia rama.

### 11.5 Cada fase = al menos un punto seguro

Al terminar cada fase del plan (Parte 8), hacer commit a `main` con un mensaje claro tipo `fase 1 completa: extracción de datos funcionando`. Así, si una fase posterior rompe algo, se puede volver exactamente al estado de la fase anterior.

### 11.6 Qué hacer si algo se rompe

- `git status` — ver qué cambió.
- `git diff` — ver exactamente qué líneas cambiaron.
- Si los cambios sin guardar rompieron todo: `git checkout .` los descarta y vuelve al último commit.
- Por eso importan los commits frecuentes: cada commit es una red de seguridad.

### 11.7 Resumen accionable

1. `git init` y `.gitignore` en el primer commit de la Fase 0.
2. `.env.local` NUNCA se sube; se versiona `.env.local.example` sin valores.
3. Commits pequeños, frecuentes, con mensajes claros en presente.
4. Trabajo arriesgado en ramas aparte; `main` siempre funciona.
5. Commit a `main` al cerrar cada fase.
6. Si una clave se expone: rotarla, no solo borrarla.

---

*Fin del documento. Versión 2 — plano completo del Sistema de Trámites IMSS, con skills de diseño y prácticas de Git integradas.*
