# Prompt para agregar un escrito nuevo al sistema

Usa este prompt cuando tengas un machote de escrito y quieras que una IA lo
integre al proyecto. Pega TODO esto en una sola conversación con la IA junto
con el machote (en texto, foto, PDF o Word — la IA lo lee).

---

## PROMPT PARA COPIAR Y PEGAR ↓↓↓

Voy a darte el machote de un escrito que se usa en una papelería de trámites
del IMSS. Necesito que lo integres al proyecto **tramites-imss** (Next.js +
Supabase). El proyecto ya tiene la infraestructura para escritos genéricos —
solo necesitas agregar este nuevo trámite siguiendo el patrón existente.

### Contexto del proyecto

- **Stack**: Next.js 16 (App Router, TypeScript), Supabase, Tailwind, pdf-lib.
- **Repo**: `https://github.com/JuanPabloRizoM/imss-tramites`.
- **Apartado 1** (`/apartado-1`) lista los escritos disponibles. Cada uno es
  una fila en la tabla `tramite_types` de Supabase con `apartado = 1` y
  `output_type = 'pdf'`.
- El motor es **genérico**: el form se renderiza desde el `field_schema`
  (JSON con los campos del trámite). NO se toca código frontend para
  agregar un escrito — solo se agrega una fila en DB y, si es un escrito
  formateado, una función de generación en `lib/pdf.ts`.

### Lo que voy a pegarte después de este prompt

El **machote del escrito** — el texto con los lugares donde van los datos.
Los datos variables están marcados con `{{NOMBRE_DEL_CAMPO}}` o con espacios
en blanco / líneas (`____`) o entre paréntesis.

### Lo que necesito que hagas

**1. Identifica los campos variables** del machote.

   Para cada uno define:
   - `id`: snake_case en inglés/español sin acentos, ej. `nombre_patron`,
     `numero_credito`, `fecha_solicitud`.
   - `label`: la etiqueta que verá el usuario en el form (en español, con
     acentos, ej. "Nombre del patrón").
   - `type`: usa esta tabla de decisión:
     - `text` — dato corto (nombres, RFC, registro patronal, calles, etc.).
     - `textarea` — descripción/justificación/motivo/notas largas.
     - `date` — fechas.
     - `number` — solo números (montos, cantidades).
     - `select` — opciones cerradas. Añade `options: ["A", "B", ...]`.
     - `checkbox` — booleano (sí/no).
   - `required`: `true` si el escrito no se puede generar sin ese dato,
     `false` si es opcional.
   - `section`: agrupa los campos por sección lógica para el form, ej.
     "Datos del patrón", "Motivo de la solicitud", "Firma". Usa máximo 4-5
     secciones.
   - `source_doc` (opcional): si el campo se puede precargar desde un
     documento extraído del Apartado 3, indica cuál. Valores válidos:
     `acta_constitutiva`, `comprobante_domicilio`, `ine`, `tip`,
     `cedula_rfc`, `sua_ema_eba`.

**2. Crea una migración SQL** en `supabase/migrations/`. Numerala con el
siguiente número disponible (mira los archivos existentes). Estructura:

```sql
-- 00XX_seed_escrito_<codigo>.sql
insert into public.tramite_types (code, name, apartado, output_type, field_schema, source_docs)
values (
  'escrito-<codigo-corto>',
  'Escrito · <Nombre legible>',
  1,
  'pdf',
  '[
    { "id": "...", "label": "...", "type": "text", "required": true, "section": "..." },
    ...
  ]'::jsonb,
  '["acta_constitutiva", "ine"]'::jsonb  -- documentos fuente que aplican
)
on conflict (code) do update
  set name = excluded.name,
      apartado = excluded.apartado,
      output_type = excluded.output_type,
      field_schema = excluded.field_schema,
      source_docs = excluded.source_docs,
      active = true;
```

**3. Agrega un generador de PDF** en `lib/pdf.ts`. Hay dos opciones:

   **Opción A (recomendada para escritos simples)**: agrega una función
   nueva `generarEscrito<Nombre>(values)` que produce el PDF desde plantilla
   de texto. Mira `generarEscritoGenerico` como ejemplo: usa los helpers
   `dibujarTexto`, `dibujarParrafo`, `dibujarLineaH` y `nuevoCtx`. Layout
   típico:
   - Lugar y fecha arriba a la derecha
   - Destinatario en mayúsculas
   - "P R E S E N T E."
   - Asunto en acento (si el escrito lo tiene)
   - Cuerpo en serif con line-height 1.55
   - Línea de firma + nombre + cargo abajo

   **Opción B (si el escrito tiene formato específico oficial)**: pon el PDF
   oficial en `assets/formatos/<code>.pdf` y crea
   `assets/formatos/<code>.coords.json` con las coordenadas de cada campo
   (origen abajo-izquierda, página tamaño carta = 612×792 pt). El motor de
   overlay (`lib/pdf-overlay.ts`) lo detecta automáticamente — no tocas
   `lib/pdf.ts`.

   Para Opción A, en `lib/pdf.ts` busca la función `generarPDF` y agrega un
   caso al `switch (tipo.code)`:
   ```ts
   case "escrito-<codigo-corto>":
     return generarEscrito<Nombre>(values);
   ```

**4. Reglas de presentación del IMSS** (ya implementadas en
`lib/tramites.ts > normalizarParaSalida`):
- Los campos `text` se transforman a MAYÚSCULAS al generar el PDF.
- Los campos `textarea` se preservan tal cual (importante para cuerpos
  largos del escrito, descripciones, motivos).
- `date`, `select`, `number`, `checkbox` se preservan.

  **No hagas la transformación tú** en el generador — ya viene normalizada
  desde `/api/generar-pdf/route.ts`. Solo asume que `values["nombre_patron"]`
  ya está en MAYÚSCULAS cuando lo recibes.

**5. NO hagas estas cosas**:
- No agregues lógica en el frontend específica para este escrito. El motor
  genérico ya renderiza el form desde `field_schema`.
- No modifiques `lib/extraccion.ts` (eso es solo para extracción de docs
  fuente, no para escritos).
- No crees páginas nuevas en `app/`. La ruta `/apartado-1/<code>` ya existe
  dinámicamente.

**6. Entregables esperados** (en este orden):

a. **Análisis**: lista de los campos detectados con id, label, type,
   required, section. Si tienes dudas sobre algún campo (¿es text o
   textarea?, ¿es opcional?), pregúntame antes de continuar.

b. **Archivos generados o modificados**:
   - `supabase/migrations/00XX_seed_escrito_<codigo>.sql` (nuevo)
   - `lib/pdf.ts` (si Opción A) — agregaste la función y el case.
   - O `assets/formatos/<code>.pdf` + `<code>.coords.json` (si Opción B).

c. **Instrucciones para aplicar**:
   - El usuario debe correr la migración SQL en el dashboard de Supabase
     (https://supabase.com/dashboard/project/.../sql/new).
   - El frontend toma el cambio automáticamente al refrescar
     `/apartado-1`.

d. **Comando de commit sugerido**, en este formato:
   ```
   apartado-1: agregar escrito <nombre legible>
   ```

### Estilo y convenciones del proyecto

- **Comentarios en español**, código limpio.
- **No emojis** en el código a menos que el usuario los pida explícitamente.
- **Migraciones idempotentes**: usa `on conflict (code) do update` para que
  re-correrlas no rompa nada.
- **Naming**: el `code` del trámite va en kebab-case con prefijo, ej.
  `escrito-baja-trabajador`, `escrito-aclaracion-cuotas`. Para formatos
  oficiales el code es el nombre del formato sin guiones (ej. `afil-01`,
  `am-srt`).

### Si te paso varios machotes a la vez

Trátalos como trámites separados. Un archivo de migración por cada uno (o
todos en uno con varios `insert`). Una función `generarEscrito*` por cada
uno en `lib/pdf.ts`.

---

### EL MACHOTE

A continuación pego el contenido del escrito. Identifica los campos y
procede:

[AQUÍ PEGA EL CONTENIDO DEL MACHOTE — texto, foto o PDF]

## ↑↑↑ FIN DEL PROMPT

---

## Cómo usarlo

1. **Copia todo** lo que está entre las dos líneas de `↓↓↓` y `↑↑↑` arriba.
2. **Pega en una conversación nueva** con Claude / ChatGPT / Gemini / lo
   que sea.
3. **Pega o adjunta el machote** al final, donde dice
   `[AQUÍ PEGA EL CONTENIDO DEL MACHOTE]`.
4. Cuando la IA te entregue los archivos, **revísalos** y aplícalos:
   - Migración SQL → pegar en https://supabase.com/dashboard/project/ctoonlmnvoxotaztwbdn/sql/new
   - Cambios de código → commit + push a GitHub.

## Por qué este prompt funciona aun con IAs "tontas"

- **No asume contexto** del proyecto — toda la info técnica que necesita
  está aquí.
- **Tabla de decisión** explícita para `type` (text vs textarea vs date…),
  no la dejas a interpretación.
- **Reglas concretas** (MAYÚSCULAS, qué NO tocar) en lugar de "haz bien las
  cosas".
- **Entregables numerados** — la IA sabe qué te tiene que devolver al final.
- **Convenciones de naming** y commit explícitas — el resultado entra al
  repo sin retoques.
