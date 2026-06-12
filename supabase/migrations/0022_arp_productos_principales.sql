-- 0022: campo estructurado "productos_principales" en las prealtas ARP.
--
-- Primer paso para automatizar la tabla dinámica "Productos" del portal
-- SAPI (hoy se teclea a mano desde el panel flotante). El campo es un
-- textarea con UN PRODUCTO POR RENGLÓN:
--   - La extracción dirigida lo llena desde el acta / CSF / papelito
--     (la IA ve el label en los target_fields).
--   - La extensión (próxima versión) partirá los renglones en filas y
--     las agregará a la tabla del portal con su botón "Agregar".
--   - Mientras eso llega, portal_show_in_panel lo muestra en el panel
--     flotante para copiar a mano (portal_skip).
--
-- Se inserta justo después de "giro" en la sección Actividad.

update public.tramite_types t
set field_schema = (
  select jsonb_agg(e order by ord)
  from (
    select elem as e, ord * 2 as ord
    from jsonb_array_elements(t.field_schema) with ordinality as x(elem, ord)
    union all
    select
      '{"id":"productos_principales","label":"Principales productos o servicios","type":"textarea","required":false,"section":"Actividad","portal_skip":true,"portal_show_in_panel":true,"placeholder":"UNO POR RENGLÓN. EJ.: VENTA DE ABARROTES AL POR MAYOR"}'::jsonb,
      (
        select ord * 2 + 1
        from jsonb_array_elements(t.field_schema) with ordinality as y(elem, ord)
        where elem->>'id' = 'giro'
      )
  ) s
)
where code in ('arp-pm', 'arp-pf')
  and not (field_schema @> '[{"id":"productos_principales"}]');
