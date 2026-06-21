-- 0031: límite de caracteres (maxlength) en los campos de RFC.
--
-- RFC: máximo 13 caracteres.
--   - Persona física: 13 (4 letras + 6 dígitos AAMMDD + 3 de homoclave).
--   - Persona moral:  12 (3 letras + 6 dígitos + 3 de homoclave).
-- El input se capa a 13 (el máximo); la pista de formato para la IA ya está en
-- lib/formatos-imss.ts (PF 13 / PM 12) y la validación usa el mismo regex.
--
-- Aplica a TODOS los campos cuyo id sea de la familia rfc (rfc, rfc_trabajador,
-- rfc_patron, sustituida_rfc, rfc_rep) en cualquier apartado.
--
-- Idempotente: el `||` sobre-escribe maxlength con el mismo valor.

update public.tramite_types t
set field_schema = (
  select jsonb_agg(
    case when e->>'id' ~ '(^|_)rfc($|_)'
      then e || '{"maxlength":13}'::jsonb
      else e end
    order by ord
  )
  from jsonb_array_elements(t.field_schema) with ordinality as x(e, ord)
)
where active = true
  and exists (
    select 1
    from jsonb_array_elements(t.field_schema) e
    where e->>'id' ~ '(^|_)rfc($|_)'
  );
