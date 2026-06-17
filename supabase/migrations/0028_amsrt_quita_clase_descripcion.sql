-- 0028: AM-SRT — quita el campo "clase_descripcion" (Descripción de Clase)
-- de la "Clasificación actual".
--
-- La Clase del IMSS es un código romano (I–V), no una rúbrica con texto: a
-- diferencia de División/Grupo/Fracción, no tiene una "descripción" en el
-- catálogo del art. 196 RACERF. El campo salía siempre vacío (el autollenado
-- por código de fracción ni siquiera lo escribía, ver VistaTramite) y solo
-- agregaba ruido al form.
--
-- Idempotente: filtra el id si existe. La entrada de overlay huérfana
-- (clase_descripcion_iii1) se elimina por separado en am-srt.coords.json.

update public.tramite_types t
set field_schema = (
  select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
  from jsonb_array_elements(t.field_schema) with ordinality as e(elem, ord)
  where elem->>'id' <> 'clase_descripcion'
)
where code = 'am-srt';
