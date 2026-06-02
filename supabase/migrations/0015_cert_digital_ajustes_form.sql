-- 0015: ajustes al field_schema de cert-digital según el portal real del IDSE.
--
-- Tres correcciones reportadas tras probar contra
-- https://idse.imss.gob.mx/certificacion/jsp/representante/requerimiento/captura.jsp:
--
--   1) RFC: el portal trae un solo input para los 13 caracteres (con
--      homoclave). El schema tenía `rfc` (RFCA, sin homoclave) y
--      `homoclave_rfc` (RFCB) separados — se elimina `homoclave_rfc` y se
--      cambia el label de `rfc` a "RFC completo (con homoclave)". El
--      portal_selector sigue apuntando a [name="RFCA"] que acepta los 13
--      chars (el campo legacy RFCB queda sin llenar — el portal lo ignora).
--
--   2) Fax: no existe en la pantalla actual. Se elimina.
--
--   3) Sección "Solicitante": los labels venían como "Nombre(s) del
--      representante", "CURP del representante", etc. — pero el solicitante
--      puede ser el propio patrón también. Se renombra la sección a
--      "Solicitante (representante o patrón)" y se hacen los labels neutros.
--
-- Regla AGENTS.md: se apoya en el schema actual con jsonb_agg + case (no
-- re-seedea desde 0006).

update public.tramite_types
set field_schema = (
  select jsonb_agg(
    case
      -- RFC: pasa a ser el RFC completo de 13 chars
      when c->>'id' = 'rfc'
        then c || '{"label":"RFC completo (con homoclave)"}'::jsonb

      -- Sección renombrada + labels neutros (aplican al patrón o al rep. legal)
      when c->>'id' = 'rol_solicitante'
        then c || '{"section":"Solicitante (representante o patrón)"}'::jsonb
      when c->>'id' = 'nombre_rep'
        then c || '{"label":"Nombre(s)","section":"Solicitante (representante o patrón)"}'::jsonb
      when c->>'id' = 'apellido_paterno_rep'
        then c || '{"label":"Apellido paterno","section":"Solicitante (representante o patrón)"}'::jsonb
      when c->>'id' = 'apellido_materno_rep'
        then c || '{"label":"Apellido materno","section":"Solicitante (representante o patrón)"}'::jsonb
      when c->>'id' = 'curp_rep'
        then c || '{"label":"CURP","section":"Solicitante (representante o patrón)"}'::jsonb
      when c->>'id' = 'rfc_rep'
        then c || '{"label":"RFC","section":"Solicitante (representante o patrón)"}'::jsonb

      else c
    end
    order by ord
  )
  from jsonb_array_elements(field_schema) with ordinality as t(c, ord)
  where c->>'id' not in ('homoclave_rfc', 'fax')
)
where code = 'cert-digital';
