-- 0026: IV.8 del AM-SRT — "¿Presta servicios de instalación, reparación o
-- mantenimiento a terceros?" deja de ofrecer "NO".
--
-- La forma oficial solo tiene UNA casilla (la de SI). En el coords, SI y NO
-- apuntaban a la misma (x,y), así que elegir NO marcaba la misma X que SI
-- — llenaba el campo cuando no debía. Ahora la única opción es "SI"; si el
-- patrón no presta esos servicios se deja vacío y no se marca nada.
-- (El coords ya quedó con solo la opción SI; ver am-srt.coords.json.)

update public.tramite_types t
set field_schema = (
  select jsonb_agg(
    case
      when e->>'id' = 'servicios_terceros'
        then jsonb_set(e, '{options}', '["SI"]'::jsonb)
      else e
    end
    order by ord
  )
  from jsonb_array_elements(t.field_schema) with ordinality as x(e, ord)
)
where code = 'am-srt'
  and field_schema @> '[{"id":"servicios_terceros"}]';
