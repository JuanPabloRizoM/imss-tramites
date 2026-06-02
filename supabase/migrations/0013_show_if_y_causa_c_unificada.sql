-- 0013: dos cambios independientes sobre el field_schema.
--
-- (A) AFIL-01: unifica los 6 sub-campos de "Causa C · Cambio de domicilio"
--     (cp/calle/num/colonia/municipio/estado anteriores) en un solo campo
--     `causa_c_domicilio_anterior`, que es lo que ya espera el coord overlay.
--     Conserva `show_if: causa_aviso=C` para que solo aparezca con esa causa.
--
-- (B) AM-SRT: agrega visibilidad condicional (`show_if`) a los campos según
--     `tipo_modificacion` y `cuenta_equipo_transporte`, y vuelve obligatoria
--     la pregunta 38 (distribución de mercancías).
--
-- Reglas del repo:
--   - AGENTS.md: cada migration nueva se apoya en la última aplicada, no
--     rebobina al original. Aquí se modifica el array `field_schema` con
--     `jsonb_array_elements` + `jsonb_agg` (parche por campo) o se combina
--     con `||` para agregar. NO re-seedea.
--   - Mapeo de tipo_modificacion → secciones según indicación del usuario:
--       reanudacion, cambio_actividad, cambio_ley_racerf,
--       incorporacion_actividades, escision → III, IV (sin V, sin VI, sin II)
--       cambio_domicilio                    → II, III, IV
--       sustitucion_patronal, fusion        → III, IV, V
--       compra_activos, comodato, enajenacion,
--         arrendamiento, fideicomiso        → III, IV, VI
--     III y IV son siempre visibles (todos los tipos las requieren).
--     "Datos de la baja" (delegación/subdelegación/fecha_baja) solo se ven
--     cuando tipo_modificacion = reanudacion (es lo único que la requiere).

-- ============================================================================
-- (A) AFIL-01 — Causa C unificada
-- ============================================================================

update public.tramite_types
set field_schema = (
    select jsonb_agg(c order by ord)
    from jsonb_array_elements(field_schema) with ordinality as t(c, ord)
    where c->>'id' not in (
      'causa_c_cp_anterior',
      'causa_c_calle_anterior',
      'causa_c_num_ext_int_anterior',
      'causa_c_colonia_anterior',
      'causa_c_municipio_anterior',
      'causa_c_estado_anterior'
    )
  ) || '[
    {"id":"causa_c_domicilio_anterior",
     "label":"Domicilio anterior completo",
     "placeholder":"Calle, número, colonia, municipio, estado y CP",
     "type":"text",
     "required":false,
     "section":"Causa C · Cambio de domicilio o circunscripción",
     "show_if":{"campo":"causa_aviso","igual":"C"}}
  ]'::jsonb
where code = 'afil-01';

-- ============================================================================
-- (B) AM-SRT — show_if condicional + IV.8 pregunta 38 obligatoria
-- ============================================================================

update public.tramite_types
set field_schema = (
  select jsonb_agg(
    case
      -- Sección II (Cambio de domicilio): solo si tipo_modificacion = cambio_domicilio
      when c->>'id' in (
        'calle','numero_exterior','numero_interior','entre_calles','calle_posterior',
        'colonia','localidad','municipio','estado','codigo_postal',
        'telefono_1','telefono_2','correo'
      )
        then c || '{"show_if":{"campo":"tipo_modificacion","igual":"cambio_domicilio"}}'::jsonb

      -- Sección V (persona moral / persona física / clasificación sustituida):
      -- solo si tipo_modificacion ∈ {sustitucion_patronal, fusion}
      when c->>'id' in (
        'sustituida_razon_social',
        'sustituida_nombre','sustituida_apellido_paterno','sustituida_apellido_materno','sustituida_curp',
        'sustituida_registro_patronal','sustituida_rfc',
        'sustituida_division','sustituida_grupo','sustituida_fraccion','sustituida_clase','sustituida_prima_srt'
      )
        then c || '{"show_if":{"campo":"tipo_modificacion","en":["sustitucion_patronal","fusion"]}}'::jsonb

      -- Sección VI (bienes):
      -- solo si tipo_modificacion ∈ {compra_activos, comodato, enajenacion, arrendamiento, fideicomiso}
      when c->>'id' in ('bienes_cantidad','bienes_descripcion','bienes_uso','bienes_afectacion')
        then c || '{"show_if":{"campo":"tipo_modificacion","en":["compra_activos","comodato","enajenacion","arrendamiento","fideicomiso"]}}'::jsonb

      -- IV.5 detalle de transporte: solo si cuenta_equipo_transporte = SI
      when c->>'id' in ('transporte_unidades','transporte_nombre','transporte_uso','transporte_combustible','transporte_capacidad')
        then c || '{"show_if":{"campo":"cuenta_equipo_transporte","igual":"SI"}}'::jsonb

      -- Datos de la baja (delegación, subdelegación, fecha): solo reanudación
      when c->>'id' in ('delegacion_baja','subdelegacion_baja','fecha_baja')
        then c || '{"show_if":{"campo":"tipo_modificacion","igual":"reanudacion"}}'::jsonb

      -- IV.8 pregunta 38 (distribución de mercancías): obligatoria — 1 de 3
      when c->>'id' = 'distribucion_mercancias'
        then c || '{"required":true}'::jsonb

      else c
    end
    order by ord
  )
  from jsonb_array_elements(field_schema) with ordinality as t(c, ord)
)
where code = 'am-srt';
