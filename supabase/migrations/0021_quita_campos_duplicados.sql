-- 0021: quita ids duplicados accidentales detectados por la verificación
-- de schemas. SOLO los duplicados dentro de la misma sección — los bloques
-- repetidos entre secciones IV.3/IV.4 del AM-SRT (la "grilla" que espeja el
-- papel) NO se tocan.
--
-- am-srt: division/grupo/fraccion_descripcion estaban 2 veces en
-- "Clasificación actual" (la segunda copia entró con 0012). Se conserva la
-- primera aparición — queda junto a division/grupo/fraccion, que es donde
-- el autollenado por código de fracción la escribe.
--
-- afil-01: causa_c_domicilio_anterior estaba 2 veces. Se elimina la copia
-- vieja SIN show_if (se mostraba siempre, aun sin elegir causa C); se
-- conserva la refinada de 0013 (show_if causa_aviso=C + placeholder).

update public.tramite_types t
set field_schema = (
  select jsonb_agg(elem order by ord)
  from (
    select elem, ord,
           row_number() over (partition by elem->>'id' order by ord) as rn
    from jsonb_array_elements(t.field_schema) with ordinality as e(elem, ord)
  ) s
  where elem->>'id' not in ('division_descripcion','grupo_descripcion','fraccion_descripcion')
     or rn = 1
)
where code = 'am-srt';

update public.tramite_types t
set field_schema = (
  select jsonb_agg(elem order by ord)
  from jsonb_array_elements(t.field_schema) with ordinality as e(elem, ord)
  where not (elem->>'id' = 'causa_c_domicilio_anterior' and not elem ? 'show_if')
)
where code = 'afil-01';
