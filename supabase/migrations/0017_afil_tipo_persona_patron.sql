-- 0017: tipo de persona del patrón en AFIL-02 / AFIL-03 / AFIL-04.
--
-- Cuando el patrón es persona MORAL se llena `razon_social` y NO la CURP.
-- Cuando es persona FÍSICA se llena la CURP del patrón y NO la razon_social
-- (en su lugar nombres + apellidos, pero AFIL-02/03/04 los recolecta en el
-- mismo bloque general — solo cambia la presencia de la CURP).
--
-- Mecánica: se agrega un campo `tipo_persona_patron` (select moral/fisica)
-- y se ponen `show_if` en razon_social y curp_patron para que el form solo
-- muestre el que aplica. Esto evita capturas redundantes y ahorra el
-- ruido visual de campos que no van.

update public.tramite_types
set field_schema = (
  select jsonb_agg(
    case
      when c->>'id' = 'razon_social'
        then c || '{"show_if":{"campo":"tipo_persona_patron","igual":"moral"}}'::jsonb
      when c->>'id' = 'curp_patron'
        then c || '{"show_if":{"campo":"tipo_persona_patron","igual":"fisica"}}'::jsonb
      else c
    end
    order by ord
  )
  from jsonb_array_elements(field_schema) with ordinality as t(c, ord)
) || '[
  {"id":"tipo_persona_patron",
   "label":"¿El patrón es persona moral o física?",
   "type":"select",
   "required":true,
   "section":"Datos del patrón",
   "options":["moral","fisica"]}
]'::jsonb
where code in ('afil-02', 'afil-03', 'afil-04');
