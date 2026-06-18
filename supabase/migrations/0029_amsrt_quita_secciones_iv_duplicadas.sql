-- 0029: AM-SRT — elimina las secciones IV duplicadas (restos de 0012).
--
-- El field_schema tenía 22 campos repetidos: cada uno aparecía una vez en las
-- secciones "buenas" (numeradas con punto: "IV.3. Maquinaria y equipo
-- utilizado [excepto equipo de transporte]", "IV.4. Cuenta con equipo de
-- transporte", "IV.5. Equipo de transporte utilizado", "IV.6. Procesos de
-- trabajo", "IV.7. Personal", "IV.8. Actividades complementarias a la
-- principal" y "IV. Actividad declarada") y otra vez en las secciones viejas
-- de la migración 0012 (sin punto). La forma agrupa por sección y NO deduplica
-- por id, así que el apartado IV se renderizaba DOS veces.
--
-- Las copias buenas son las que se han venido manteniendo (p.ej. 0027 les
-- agregó "OTROS" a maquinaria_tipo). Las viejas quedaron obsoletas. Como todo
-- se referencia por id (overlay PDF, extracción, coords), quitar las copias no
-- pierde datos ni rompe el render: cada id sigue existiendo una vez.
--
-- Esto reemplaza la cautela de 0021 ("los bloques IV.3/IV.4 NO se tocan"): ya
-- no espejan el papel — son duplicados muertos que las secciones con punto
-- sustituyen por completo.
--
-- Idempotente: si las secciones viejas ya no existen, no quita nada.

update public.tramite_types t
set field_schema = (
  select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
  from jsonb_array_elements(t.field_schema) with ordinality as e(elem, ord)
  where elem->>'section' not in (
    'IV. Productos, materias y procesos',
    'IV.4 Maquinaria y equipo',
    'IV.5 Equipo de transporte',
    'IV.6 Procesos de trabajo',
    'IV.7 Personal',
    'IV.8 Actividades complementarias'
  )
)
where code = 'am-srt';
