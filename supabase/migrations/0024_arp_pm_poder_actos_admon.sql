-- 0024: checkbox "Poder para: actos de administración" en ARP-PM.
--
-- El portal SAPI de persona moral lo exige (#chkIndActAdmon, required) en
-- la sección del representante legal. En la práctica de mostrador siempre
-- va marcado, así que entra con default "true" — el usuario puede
-- desmarcarlo en el caso raro. La extensión lo palomea en el portal como
-- cualquier checkbox (valor "true").
--
-- Requiere soporte de `default` en CampoSchema (lib/tramites.ts).

update public.tramite_types t
set field_schema = (
  select jsonb_agg(e order by ord)
  from (
    select elem as e, ord * 2 as ord
    from jsonb_array_elements(t.field_schema) with ordinality as x(elem, ord)
    union all
    select
      '{"id":"poder_actos_administracion","label":"Poder para: actos de administración","type":"checkbox","required":false,"section":"Representante legal","portal_selector":"#chkIndActAdmon","default":"true"}'::jsonb,
      (
        select ord * 2 + 1
        from jsonb_array_elements(t.field_schema) with ordinality as y(elem, ord)
        where elem->>'id' = 'correo_rep'
      )
  ) s
)
where code = 'arp-pm'
  and not (field_schema @> '[{"id":"poder_actos_administracion"}]');
