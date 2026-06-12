-- 0023: el centro de trabajo se oculta cuando "mismo domicilio" está
-- marcado (prealtas ARP).
--
-- usar_mismo_domicilio es un checkbox (en el portal es #chkCopiarDomicilio,
-- que copia el domicilio fiscal al CT). En la app, los 13 campos del
-- centro de trabajo ahora llevan show_if {distinto:"true"} sobre ese
-- checkbox: marcado → se ocultan, no bloquean required, y sus valores
-- no viajan a la extensión (el portal los copia solo).
--
-- Requiere el operador `distinto` de show_if (lib/tramites.ts::debeMostrar).

update public.tramite_types t
set field_schema = (
  select jsonb_agg(
    case
      when elem->>'id' = any(array[
        'cp_ct','estado_ct','municipio_ct','localidad_ct','colonia_ct',
        'calle_ct','numero_exterior_ct','numero_interior_ct',
        'entre_calle_1_ct','entre_calle_2_ct','lada_ct','telefono_ct','correo_ct'
      ])
      then elem || '{"show_if":{"campo":"usar_mismo_domicilio","distinto":"true"}}'::jsonb
      else elem
    end
    order by ord
  )
  from jsonb_array_elements(t.field_schema) with ordinality as e(elem, ord)
)
where code in ('arp-pm', 'arp-pf');
