-- Casos de trámite (flexible document intake).
--
-- Algunos trámites (AFIL-01, AM-SRT) tienen subtipos llamados "casos". Cada
-- caso pide su propio subset de campos y de documentos fuente. El usuario
-- elige el caso antes de capturar nada.
--
-- Esta migration:
--   1) Agrega tramite_types.cases (jsonb nullable). Si null o vacío, el
--      trámite no usa casos y se comporta igual que antes.
--   2) Migra AFIL-01: define 8 casos (A–H) con sus required_fields y
--      required_source_docs. El field_schema se simplifica eliminando los
--      show_if y el campo causa_aviso del form (la causa ahora vive en
--      `cases`). Conservamos `causa_aviso` como campo oculto del schema
--      para que el generador de PDF siga sabiendo qué casilla marcar.

alter table public.tramite_types
  add column if not exists cases jsonb;

-- =========================================================================
-- AFIL-01: schema sin show_if + 8 casos
-- =========================================================================
update public.tramite_types
set
  field_schema = '[
    {"id":"fecha_solicitud",   "label":"Fecha de solicitud del trámite",     "type":"date",     "required":true,  "section":"Encabezado"},

    {"id":"causa_aviso",       "label":"Causa de presentación del aviso",     "type":"select",   "required":false, "section":"Encabezado", "options":["A","B","C","D","E","F","G","H"], "portal_skip":true},

    {"id":"razon_social",      "label":"Nombre, denominación o razón social", "type":"text",     "required":false, "section":"Datos generales", "source_doc":"acta_constitutiva"},
    {"id":"nombre",            "label":"Nombre(s) (solo persona física)",     "type":"text",     "required":false, "section":"Datos generales", "source_doc":"ine"},
    {"id":"apellido_paterno",  "label":"Primer apellido (solo persona física)","type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},
    {"id":"apellido_materno",  "label":"Segundo apellido (solo persona física)","type":"text",   "required":false, "section":"Datos generales", "source_doc":"ine"},
    {"id":"rfc",               "label":"RFC con homoclave",                    "type":"text",    "required":true,  "section":"Datos generales", "source_doc":"cedula_rfc"},
    {"id":"curp",              "label":"CURP (solo persona física)",           "type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},
    {"id":"clase_riesgo",      "label":"Clase de riesgo manifestada",          "type":"select",  "required":false, "section":"Datos generales", "options":["I","II","III","IV","V"]},
    {"id":"registro_patronal", "label":"Número de registro patronal (si aplica)","type":"text",  "required":false, "section":"Datos generales", "source_doc":"tip"},
    {"id":"fraccion",          "label":"Fracción",                             "type":"text",    "required":false, "section":"Datos generales"},
    {"id":"actividad_giro",    "label":"Actividad o giro de la empresa",       "type":"text",    "required":false, "section":"Datos generales"},
    {"id":"prima",             "label":"Prima",                                "type":"text",    "required":false, "section":"Datos generales"},
    {"id":"fecha_causa",       "label":"Fecha de la causa del aviso",          "type":"date",    "required":false, "section":"Datos generales"},

    {"id":"codigo_postal",     "label":"Código postal",                        "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"calle",             "label":"Calle",                                "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"numero_exterior",   "label":"Número exterior",                      "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"numero_interior",   "label":"Número interior",                      "type":"text",    "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"colonia",           "label":"Colonia",                              "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"localidad",         "label":"Localidad (opcional)",                 "type":"text",    "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"municipio",         "label":"Municipio o alcaldía",                 "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"estado",            "label":"Estado",                               "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"telefono",          "label":"Teléfono fijo (lada y número, opcional)","type":"text",  "required":false, "section":"Domicilio"},
    {"id":"correo",            "label":"Correo electrónico (opcional)",        "type":"text",    "required":false, "section":"Domicilio"},

    {"id":"no_notaria",        "label":"No. de notaría",                       "type":"text",    "required":false, "section":"Acta constitutiva", "source_doc":"acta_constitutiva"},
    {"id":"no_acta",           "label":"No. de acta",                          "type":"text",    "required":false, "section":"Acta constitutiva", "source_doc":"acta_constitutiva"},
    {"id":"no_libro",          "label":"No. de libro",                         "type":"text",    "required":false, "section":"Acta constitutiva", "source_doc":"acta_constitutiva"},
    {"id":"no_foja",           "label":"No. de foja",                          "type":"text",    "required":false, "section":"Acta constitutiva", "source_doc":"acta_constitutiva"},
    {"id":"registro_publico",  "label":"Registro Público de la Propiedad",     "type":"text",    "required":false, "section":"Acta constitutiva", "source_doc":"acta_constitutiva"},
    {"id":"informacion_adicional","label":"Información adicional",             "type":"text",    "required":false, "section":"Acta constitutiva"},
    {"id":"lugar_fecha_constitucion","label":"Lugar y fecha de constitución",  "type":"text",    "required":false, "section":"Acta constitutiva", "source_doc":"acta_constitutiva"},

    {"id":"causa_b_nombre_anterior",   "label":"Nombre o razón social anterior", "type":"text", "required":false, "section":"Reanudación (B)"},
    {"id":"causa_b_registro_anterior", "label":"Número de registro patronal anterior", "type":"text", "required":false, "section":"Reanudación (B)", "source_doc":"tip"},

    {"id":"causa_c_cp_anterior",        "label":"Código postal anterior",       "type":"text", "required":false, "section":"Cambio de domicilio (C)"},
    {"id":"causa_c_calle_anterior",     "label":"Calle anterior",               "type":"text", "required":false, "section":"Cambio de domicilio (C)"},
    {"id":"causa_c_num_ext_int_anterior","label":"Número exterior e interior anterior","type":"text","required":false,"section":"Cambio de domicilio (C)"},
    {"id":"causa_c_colonia_anterior",   "label":"Colonia anterior",             "type":"text", "required":false, "section":"Cambio de domicilio (C)"},
    {"id":"causa_c_municipio_anterior", "label":"Municipio o alcaldía anterior","type":"text", "required":false, "section":"Cambio de domicilio (C)"},
    {"id":"causa_c_estado_anterior",    "label":"Estado anterior",              "type":"text", "required":false, "section":"Cambio de domicilio (C)"},

    {"id":"causa_d_nombre_anterior",    "label":"Nombre o razón social anterior", "type":"text", "required":false, "section":"Cambio de nombre (D)"},

    {"id":"causa_e_nombre_sustituido",  "label":"Nombre o razón social del patrón sustituido", "type":"text", "required":false, "section":"Sustitución (E)"},
    {"id":"causa_e_registro_sustituido","label":"Registro patronal del patrón sustituido", "type":"text", "required":false, "section":"Sustitución (E)"},

    {"id":"causa_f_registro_1", "label":"Registro 1", "type":"text", "required":false, "section":"Duplicidad (F)"},
    {"id":"causa_f_registro_2", "label":"Registro 2", "type":"text", "required":false, "section":"Duplicidad (F)"},

    {"id":"causa_g_motivo",     "label":"Motivo de la baja", "type":"textarea", "required":false, "section":"Baja (G)"}
  ]'::jsonb,
  cases = '[
    {
      "id":"A",
      "label":"Alta Patronal",
      "description":"Inscripción inicial de un patrón al IMSS.",
      "required_fields":[
        "fecha_solicitud","causa_aviso",
        "razon_social","nombre","apellido_paterno","apellido_materno","rfc","curp",
        "clase_riesgo","fraccion","actividad_giro","prima","fecha_causa",
        "codigo_postal","calle","numero_exterior","numero_interior","colonia","localidad","municipio","estado","telefono","correo",
        "no_notaria","no_acta","no_libro","no_foja","registro_publico","informacion_adicional","lugar_fecha_constitucion"
      ],
      "required_source_docs":["cedula_rfc","acta_constitutiva","ine_representante","comprobante_domicilio"]
    },
    {
      "id":"B",
      "label":"Reanudación de actividades",
      "description":"Patrón que vuelve a operar después de una baja.",
      "required_fields":[
        "fecha_solicitud","causa_aviso",
        "razon_social","nombre","apellido_paterno","apellido_materno","rfc","curp",
        "registro_patronal","fecha_causa",
        "codigo_postal","calle","numero_exterior","numero_interior","colonia","localidad","municipio","estado","telefono","correo",
        "no_notaria","no_acta","no_libro","no_foja","registro_publico","informacion_adicional","lugar_fecha_constitucion",
        "causa_b_nombre_anterior","causa_b_registro_anterior"
      ],
      "required_source_docs":["cedula_rfc","acta_constitutiva","comprobante_domicilio","tip"]
    },
    {
      "id":"C",
      "label":"Cambio de domicilio o circunscripción",
      "description":"Domicilio fiscal del patrón cambia.",
      "required_fields":[
        "fecha_solicitud","causa_aviso",
        "razon_social","rfc",
        "registro_patronal","fecha_causa",
        "codigo_postal","calle","numero_exterior","numero_interior","colonia","localidad","municipio","estado","telefono","correo",
        "causa_c_cp_anterior","causa_c_calle_anterior","causa_c_num_ext_int_anterior","causa_c_colonia_anterior","causa_c_municipio_anterior","causa_c_estado_anterior"
      ],
      "required_source_docs":["cedula_rfc","comprobante_domicilio","tip"]
    },
    {
      "id":"D",
      "label":"Cambio de nombre o Razón Social",
      "description":"Cambia la denominación legal del patrón.",
      "required_fields":[
        "fecha_solicitud","causa_aviso",
        "razon_social","rfc",
        "registro_patronal","fecha_causa",
        "no_notaria","no_acta","no_libro","no_foja","registro_publico","informacion_adicional","lugar_fecha_constitucion",
        "causa_d_nombre_anterior"
      ],
      "required_source_docs":["cedula_rfc","acta_constitutiva","tip"]
    },
    {
      "id":"E",
      "label":"Sustitución Patronal",
      "description":"Un patrón asume las obligaciones de otro.",
      "required_fields":[
        "fecha_solicitud","causa_aviso",
        "razon_social","rfc",
        "registro_patronal","fecha_causa",
        "no_notaria","no_acta","no_libro","no_foja","registro_publico","informacion_adicional","lugar_fecha_constitucion",
        "causa_e_nombre_sustituido","causa_e_registro_sustituido"
      ],
      "required_source_docs":["cedula_rfc","acta_constitutiva","tip"]
    },
    {
      "id":"F",
      "label":"Duplicidad",
      "description":"Existe más de un registro patronal y hay que consolidar.",
      "required_fields":[
        "fecha_solicitud","causa_aviso",
        "razon_social","rfc",
        "causa_f_registro_1","causa_f_registro_2"
      ],
      "required_source_docs":["tip"]
    },
    {
      "id":"G",
      "label":"Baja",
      "description":"Patrón deja de operar.",
      "required_fields":[
        "fecha_solicitud","causa_aviso",
        "razon_social","rfc",
        "registro_patronal","fecha_causa",
        "causa_g_motivo"
      ],
      "required_source_docs":["cedula_rfc","tip"]
    },
    {
      "id":"H",
      "label":"Huelga",
      "description":"Aviso por huelga reconocida.",
      "required_fields":[
        "fecha_solicitud","causa_aviso",
        "razon_social","rfc",
        "registro_patronal","fecha_causa"
      ],
      "required_source_docs":["tip"]
    }
  ]'::jsonb,
  source_docs = '["cedula_rfc","acta_constitutiva","ine","ine_representante","comprobante_domicilio","tip"]'::jsonb
where code = 'afil-01';
