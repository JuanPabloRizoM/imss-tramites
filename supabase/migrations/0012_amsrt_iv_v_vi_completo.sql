-- AM-SRT: agrega al field_schema los campos faltantes de los apartados
-- IV (productos, materias, maquinaria, transporte, procesos, personal,
-- distribución/servicios), V (empresa sustituida/fusionada — persona moral,
-- persona física y clasificación) y VI (bienes objeto de compra/enajenación/
-- arrendamiento/comodato/fideicomiso).
--
-- Reglas del repo (AGENTS.md):
--   - Se apoya en el schema actual con `field_schema || '[...]'`. NO re-seedea.
--   - Todos los textos/opciones ya van en MAYÚSCULAS (regla IMSS), excepto los
--     `id` (snake_case) y los `options` técnicos de tipo_modificacion.
--
-- Coordenadas: las que ya están calibradas (IV.1-IV.8) siguen en
-- assets/formatos/am-srt.coords.json. V y VI todavía no tienen coords —
-- el render por overlay ignora campos sin entrada en coords sin fallar, así
-- que se pueden capturar desde el form aunque por ahora no se pinten en el
-- PDF. Una vez calibradas, aparecerán.

update public.tramite_types
set field_schema = field_schema || '[
    {"id":"division_descripcion",  "label":"Descripción de la División",       "type":"text",    "required":false, "section":"Clasificación actual"},
    {"id":"grupo_descripcion",     "label":"Descripción del Grupo",            "type":"text",    "required":false, "section":"Clasificación actual"},
    {"id":"fraccion_descripcion",  "label":"Descripción de la Fracción",       "type":"text",    "required":false, "section":"Clasificación actual"},

    {"id":"productos_elaborados",  "label":"IV.1 Productos elaborados o servicios prestados (uno por línea)", "type":"textarea", "required":false, "section":"IV. Productos, materias y procesos"},
    {"id":"materias_primas",       "label":"IV.2 Materias primas y materiales (separadas por coma)",          "type":"textarea", "required":false, "section":"IV. Productos, materias y procesos"},

    {"id":"maquinaria_unidades",   "label":"IV.4 Maquinaria — Unidades (una por línea)",          "type":"textarea", "required":false, "section":"IV.4 Maquinaria y equipo"},
    {"id":"maquinaria_nombre",     "label":"IV.4 Maquinaria — Nombre (uno por línea)",            "type":"textarea", "required":false, "section":"IV.4 Maquinaria y equipo"},
    {"id":"maquinaria_uso",        "label":"IV.4 Maquinaria — Uso (uno por línea)",               "type":"textarea", "required":false, "section":"IV.4 Maquinaria y equipo"},
    {"id":"maquinaria_tipo",       "label":"IV.4 Maquinaria — Tipo (uno por línea)",              "type":"textarea", "required":false, "section":"IV.4 Maquinaria y equipo",
      "options":["MOTORIZADOS NO AUTOMATIZADOS","AUTOMATIZADOS","NO MOTORIZADOS","HERRAMIENTAS MANUALES"]},
    {"id":"maquinaria_capacidad",  "label":"IV.4 Maquinaria — Capacidad (una por línea)",         "type":"textarea", "required":false, "section":"IV.4 Maquinaria y equipo"},

    {"id":"cuenta_equipo_transporte", "label":"IV.5 ¿Cuenta con equipo de transporte?",           "type":"select",   "required":false, "section":"IV.5 Equipo de transporte", "options":["SI","NO"]},
    {"id":"transporte_unidades",   "label":"IV.5 Transporte — Unidades (una por línea)",          "type":"textarea", "required":false, "section":"IV.5 Equipo de transporte"},
    {"id":"transporte_nombre",     "label":"IV.5 Transporte — Nombre (uno por línea)",            "type":"textarea", "required":false, "section":"IV.5 Equipo de transporte"},
    {"id":"transporte_uso",        "label":"IV.5 Transporte — Uso (uno por línea)",               "type":"textarea", "required":false, "section":"IV.5 Equipo de transporte"},
    {"id":"transporte_combustible","label":"IV.5 Transporte — Combustible (uno por línea)",       "type":"textarea", "required":false, "section":"IV.5 Equipo de transporte",
      "options":["GASOLINA","DIESEL","GAS LP","ELÉCTRICO","HÍBRIDO"]},
    {"id":"transporte_capacidad",  "label":"IV.5 Transporte — Capacidad (una por línea)",         "type":"textarea", "required":false, "section":"IV.5 Equipo de transporte"},

    {"id":"procesos_principales",  "label":"IV.6 Procesos PRINCIPALES (párrafo, ~5 renglones)",   "type":"textarea", "required":false, "section":"IV.6 Procesos de trabajo"},
    {"id":"procesos_intermedios",  "label":"IV.6 Procesos INTERMEDIOS (párrafo, ~5 renglones)",   "type":"textarea", "required":false, "section":"IV.6 Procesos de trabajo"},
    {"id":"procesos_finales",      "label":"IV.6 Procesos FINALES (párrafo, ~5 renglones)",       "type":"textarea", "required":false, "section":"IV.6 Procesos de trabajo"},

    {"id":"personal_num_izq",      "label":"IV.7 Columna izquierda — No. de trabajadores (uno por línea, 6 filas)", "type":"textarea", "required":false, "section":"IV.7 Personal"},
    {"id":"personal_oficio_izq",   "label":"IV.7 Columna izquierda — Oficio u ocupación (uno por línea, 6 filas)",  "type":"textarea", "required":false, "section":"IV.7 Personal"},
    {"id":"personal_num_der",      "label":"IV.7 Columna derecha — No. de trabajadores (uno por línea, 6 filas)",   "type":"textarea", "required":false, "section":"IV.7 Personal"},
    {"id":"personal_oficio_der",   "label":"IV.7 Columna derecha — Oficio u ocupación (uno por línea, 6 filas)",    "type":"textarea", "required":false, "section":"IV.7 Personal"},

    {"id":"distribucion_mercancias","label":"IV.8 Distribución o entrega de mercancías",          "type":"select",   "required":false, "section":"IV.8 Actividades complementarias",
      "options":["CON TRANSPORTE PROPIO","CON TRANSPORTE AJENO","NO DISTRIBUYE NI ENTREGA"]},
    {"id":"servicios_terceros",    "label":"IV.8 ¿Presta servicios de instalación, reparación o mantenimiento a terceros?", "type":"select", "required":false, "section":"IV.8 Actividades complementarias", "options":["SI","NO"]},

    {"id":"sustituida_razon_social","label":"V.1 Denominación o razón social (persona moral sustituida o fusionada)", "type":"text", "required":false, "section":"V. Empresa sustituida o fusionada"},

    {"id":"sustituida_nombre",          "label":"V.2 Nombre(s) (persona física sustituida o fusionada)", "type":"text", "required":false, "section":"V. Empresa sustituida o fusionada"},
    {"id":"sustituida_apellido_paterno","label":"V.2 Primer apellido",                                   "type":"text", "required":false, "section":"V. Empresa sustituida o fusionada"},
    {"id":"sustituida_apellido_materno","label":"V.2 Segundo apellido",                                  "type":"text", "required":false, "section":"V. Empresa sustituida o fusionada"},
    {"id":"sustituida_curp",            "label":"V.2 CURP",                                              "type":"text", "required":false, "section":"V. Empresa sustituida o fusionada"},

    {"id":"sustituida_registro_patronal","label":"V.3 Registro Patronal (empresa sustituida o fusionada)", "type":"text",   "required":false, "section":"V.3 Clasificación de la sustituida o fusionada"},
    {"id":"sustituida_rfc",              "label":"V.3 RFC con homoclave",                                 "type":"text",   "required":false, "section":"V.3 Clasificación de la sustituida o fusionada"},
    {"id":"sustituida_division",         "label":"V.3 División",                                          "type":"text",   "required":false, "section":"V.3 Clasificación de la sustituida o fusionada"},
    {"id":"sustituida_grupo",            "label":"V.3 Grupo",                                             "type":"text",   "required":false, "section":"V.3 Clasificación de la sustituida o fusionada"},
    {"id":"sustituida_fraccion",         "label":"V.3 Fracción",                                          "type":"text",   "required":false, "section":"V.3 Clasificación de la sustituida o fusionada"},
    {"id":"sustituida_clase",            "label":"V.3 Clase",                                             "type":"select", "required":false, "section":"V.3 Clasificación de la sustituida o fusionada", "options":["I","II","III","IV","V"]},
    {"id":"sustituida_prima_srt",        "label":"V.3 Prima SRT",                                         "type":"text",   "required":false, "section":"V.3 Clasificación de la sustituida o fusionada"},

    {"id":"bienes_cantidad",     "label":"VI.1 Cantidad de los bienes (una por línea, hasta 4)",     "type":"textarea", "required":false, "section":"VI. Bienes objeto de compra/enajenación/arrendamiento/comodato/fideicomiso"},
    {"id":"bienes_descripcion",  "label":"VI.1 Descripción de los bienes (una por línea, hasta 4)",  "type":"textarea", "required":false, "section":"VI. Bienes objeto de compra/enajenación/arrendamiento/comodato/fideicomiso"},
    {"id":"bienes_uso",          "label":"VI.2 Uso que se le daba o dará a los bienes (párrafo)",    "type":"textarea", "required":false, "section":"VI. Bienes objeto de compra/enajenación/arrendamiento/comodato/fideicomiso"},
    {"id":"bienes_afectacion",   "label":"VI.3 Afectación directa o indirecta al desarrollo de la actividad manifestada (párrafo)", "type":"textarea", "required":false, "section":"VI. Bienes objeto de compra/enajenación/arrendamiento/comodato/fideicomiso"}
  ]'::jsonb
where code = 'am-srt';
