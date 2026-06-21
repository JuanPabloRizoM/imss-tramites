-- 0030: límite de caracteres (maxlength) en los campos de Registro Patronal.
--
-- El Registro Patronal del IMSS son 11 caracteres: 1 letra + 9 dígitos (el NRP)
-- + 1 dígito verificador (el carácter 11).
--
-- Apartado 1 (PDF afil-01/02/03/04, am-srt): el registro va en UNA casilla,
-- completo → maxlength 11. Aplica a todos los campos NRP (incluye anterior/
-- sustituido/fusión), NO a registro_publico (es folio del RPP, otra cosa).
--
-- Apartado 2 (cert-digital): el portal separa NRP y verificador en dos casillas
-- → registro_patronal a 10 y digito_verificador a 1. La separación del 11º
-- dígito al escanear/precargar la hace lib/precarga.ts::separarRegistroPatronal.
--
-- Idempotente: el `||` sobre-escribe la clave maxlength con el mismo valor.

-- Apartado 1: NRP completo (11).
update public.tramite_types t
set field_schema = (
  select jsonb_agg(
    case when e->>'id' in (
      'registro_patronal',
      'causa_b_registro_anterior',
      'causa_e_registro_sustituido',
      'causa_f_registro_1',
      'causa_f_registro_2',
      'sustituida_registro_patronal'
    ) then e || '{"maxlength":11}'::jsonb else e end
    order by ord
  )
  from jsonb_array_elements(t.field_schema) with ordinality as x(e, ord)
)
where apartado = 1
  and field_schema @> '[{"id":"registro_patronal"}]';

-- Apartado 2 cert-digital: NRP 10 + dígito verificador 1.
update public.tramite_types t
set field_schema = (
  select jsonb_agg(
    case
      when e->>'id' = 'registro_patronal'  then e || '{"maxlength":10}'::jsonb
      when e->>'id' = 'digito_verificador' then e || '{"maxlength":1}'::jsonb
      else e end
    order by ord
  )
  from jsonb_array_elements(t.field_schema) with ordinality as x(e, ord)
)
where code = 'cert-digital';
