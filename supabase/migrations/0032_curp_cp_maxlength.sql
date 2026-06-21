-- 0032: maxlength en CURP y Código Postal.
--
-- CURP: 18 caracteres (solo personas físicas). Aplica a curp, curp_trabajador,
--   curp_patron, sustituida_curp, curp_rep.
-- Código postal: 5 dígitos. Aplica a codigo_postal* y cp_* (fiscal, ct, etc.).
--
-- Las pistas de formato para la IA ya existen en lib/formatos-imss.ts
-- (curp = 18 + verificador; codigo_postal = 5 dígitos) — esto solo capa el
-- input. Idempotente.

-- CURP → 18
update public.tramite_types t
set field_schema = (
  select jsonb_agg(
    case when e->>'id' ~ '(^|_)curp($|_)'
      then e || '{"maxlength":18}'::jsonb else e end
    order by ord
  )
  from jsonb_array_elements(t.field_schema) with ordinality as x(e, ord)
)
where active = true
  and exists (
    select 1 from jsonb_array_elements(t.field_schema) e
    where e->>'id' ~ '(^|_)curp($|_)'
  );

-- Código postal → 5
update public.tramite_types t
set field_schema = (
  select jsonb_agg(
    case when e->>'id' ~ '(^|_)(codigo_postal|cp)($|_)'
      then e || '{"maxlength":5}'::jsonb else e end
    order by ord
  )
  from jsonb_array_elements(t.field_schema) with ordinality as x(e, ord)
)
where active = true
  and exists (
    select 1 from jsonb_array_elements(t.field_schema) e
    where e->>'id' ~ '(^|_)(codigo_postal|cp)($|_)'
  );
