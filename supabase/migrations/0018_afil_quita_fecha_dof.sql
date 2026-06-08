-- 0018: quita `fecha_publicacion_dof` del field_schema de AFIL-02/03/04.
--
-- Ese campo era la fecha en que el IMSS publicó el formato en el DOF (no
-- la fecha del trámite del patrón). El patrón nunca debe llenarla — es un
-- marcador editorial que viene pre-impreso por el IMSS en el PDF base.
-- Se elimina del form para no pedir captura innecesaria.

update public.tramite_types
set field_schema = (
  select jsonb_agg(c order by ord)
  from jsonb_array_elements(field_schema) with ordinality as t(c, ord)
  where c->>'id' <> 'fecha_publicacion_dof'
)
where code in ('afil-02', 'afil-03', 'afil-04');
