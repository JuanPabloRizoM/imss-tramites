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
