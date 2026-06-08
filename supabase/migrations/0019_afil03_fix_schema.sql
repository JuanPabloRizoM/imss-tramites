-- 0019: corrige el schema de AFIL-03 al formato real del PDF.
--
-- Originalmente sembrado como "Aviso de Reingreso del Trabajador" pero el
-- PDF oficial publicado es "Aviso de Modificación de Salario del Trabajador".
-- Diferencias contra la versión anterior:
--   - name → "AFIL-03 · Aviso de Modificación de Salario del Trabajador"
--   - fecha_reingreso → fecha_modificacion (renombra el campo)
--   - +salario_base_anterior (campo nuevo, requerido para registrar el
--     salario previo a la modificación)

-- Rename fecha_reingreso → fecha_modificacion + agregar salario_base_anterior.
update public.tramite_types
set
  name = 'AFIL-03 · Aviso de Modificación de Salario del Trabajador',
  field_schema = (
    select jsonb_agg(
      case
        when c->>'id' = 'fecha_reingreso'
          then jsonb_set(
            jsonb_set(c, '{id}', '"fecha_modificacion"'),
            '{label}', '"Fecha de la modificación del salario"'
          )
        else c
      end
      order by ord
    )
    from jsonb_array_elements(field_schema) with ordinality as t(c, ord)
  ) || '[
    {"id":"salario_base_anterior",
     "label":"Salario base de cotización anterior",
     "type":"text",
     "required":true,
     "section":"Datos del trabajador"}
  ]'::jsonb
where code = 'afil-03';
