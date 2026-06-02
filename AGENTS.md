<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Calibración de overlays PDF (`assets/formatos/*.coords.json`)

Estos archivos están calibrados iterativamente desde el feedback del usuario ("este campo queda muy abajo", "súbelo 2 puntos", etc.). El historial de Git muestra v1 → v7 → v8 → v15 → v17 — cada versión es un ajuste fino sobre la anterior.

**Regla:** cuando el usuario pida mover/ajustar un campo del overlay:

1. Lee el JSON **tal como está hoy en disco**. NO derives coordenadas "limpias" desde el PDF base.
2. Modifica **solo** el campo que pidió. Deja el resto intacto.
3. Muestra el diff antes de commitear para que el usuario confirme que nada más se movió.
4. Si quieres recalibrar todo desde cero, pídele permiso explícito primero.

El equivalente para el `field_schema` (en `supabase/migrations/`): cada migration nueva debe apoyarse en la última aplicada, no rebobinar al original.

# Regla de mayúsculas (IMSS)

**TODO el texto que va al PDF de un formato del IMSS va en MAYÚSCULAS.** Sin excepciones para etiquetas, ejemplos, placeholders, `options` de selects o de textareas con chips, ni valores hardcoded para pruebas. Cuando agregues un nuevo `options: [...]` al schema, ya van en mayúsculas — no dejes que el usuario me lo recuerde.

(`lib/tramites.ts::normalizarParaSalida` ya hace el upcase para campos `text` en el momento de generar PDF, pero NO para `textarea` ni para opciones de chips — esas las tengo que poner ya en mayúsculas yo desde el schema.)
