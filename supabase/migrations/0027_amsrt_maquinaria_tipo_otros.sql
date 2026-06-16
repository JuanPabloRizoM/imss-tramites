-- 0027: IV.3/IV.4 Maquinaria del AM-SRT — agrega "OTROS" al select de tipo
-- (columna "No motorizados / Motorizados no automatizados / Automatizados /
-- Otros"). El encabezado de la forma incluye "Otros" pero el select no lo
-- ofrecía. Se anexa al final de las options existentes.
--
-- Idempotente: la guarda @> evita anexarlo dos veces.

update public.tramite_types t
set field_schema = (
  select jsonb_agg(
    case
      when e->>'id' = 'maquinaria_tipo'
        then jsonb_set(e, '{options}', (e->'options') || '["OTROS"]'::jsonb)
      else e
    end
    order by ord
  )
  from jsonb_array_elements(t.field_schema) with ordinality as x(e, ord)
)
where code = 'am-srt'
  and not (field_schema @> '[{"id":"maquinaria_tipo","options":["OTROS"]}]');
