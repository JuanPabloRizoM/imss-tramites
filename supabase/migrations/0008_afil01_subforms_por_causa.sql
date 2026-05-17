-- AFIL-01: agrega sub-formularios condicionales por causa (página 2 del PDF).
--
-- Cada causa A-H tiene una fila distinta en "Instrucciones para el patrón"
-- con sus propios campos. Marcamos cada campo con show_if = { causa_aviso: X }
-- para que el form los muestre solo cuando la causa elegida sea la que aplica.
-- Campos del acta constitutiva (no_notaria, etc.) ya estaban — se marcan como
-- show_if A,B,D,E porque solo aplican para esas causas.

update public.tramite_types
set field_schema = '[
  {"id":"fecha_solicitud",   "label":"Fecha de solicitud del trámite",     "type":"date",     "required":true,  "section":"Encabezado"},

  {"id":"causa_aviso",       "label":"Causa de presentación del aviso",     "type":"select",   "required":true,  "section":"Encabezado",
    "options":["A","B","C","D","E","F","G","H"],
    "placeholder":"A=Alta · B=Reanudación · C=Cambio domicilio · D=Cambio nombre · E=Sustitución · F=Duplicidad · G=Baja · H=Huelga"},

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

  {"id":"no_notaria",        "label":"No. de notaría",                       "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},
  {"id":"no_acta",           "label":"No. de acta",                          "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},
  {"id":"no_libro",          "label":"No. de libro",                         "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},
  {"id":"no_foja",           "label":"No. de foja",                          "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},
  {"id":"registro_publico",  "label":"Registro Público de la Propiedad",     "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},
  {"id":"informacion_adicional","label":"Información adicional",             "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},
  {"id":"lugar_fecha_constitucion","label":"Lugar y fecha de constitución",  "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},

  {"id":"causa_b_nombre_anterior",   "label":"Nombre, denominación o razón social del patrón o sujeto obligado", "type":"text", "required":false, "section":"Causa B · Reanudación de actividades", "show_if":{"campo":"causa_aviso","igual":"B"}},
  {"id":"causa_b_registro_anterior", "label":"Número de registro patronal", "type":"text", "required":false, "section":"Causa B · Reanudación de actividades", "source_doc":"tip", "show_if":{"campo":"causa_aviso","igual":"B"}},

  {"id":"causa_c_cp_anterior",        "label":"Código postal anterior",       "type":"text", "required":false, "section":"Causa C · Cambio de domicilio o circunscripción", "show_if":{"campo":"causa_aviso","igual":"C"}},
  {"id":"causa_c_calle_anterior",     "label":"Calle anterior",               "type":"text", "required":false, "section":"Causa C · Cambio de domicilio o circunscripción", "show_if":{"campo":"causa_aviso","igual":"C"}},
  {"id":"causa_c_num_ext_int_anterior","label":"Número exterior e interior anterior","type":"text","required":false,"section":"Causa C · Cambio de domicilio o circunscripción","show_if":{"campo":"causa_aviso","igual":"C"}},
  {"id":"causa_c_colonia_anterior",   "label":"Colonia anterior",             "type":"text", "required":false, "section":"Causa C · Cambio de domicilio o circunscripción", "show_if":{"campo":"causa_aviso","igual":"C"}},
  {"id":"causa_c_municipio_anterior", "label":"Municipio o alcaldía anterior","type":"text", "required":false, "section":"Causa C · Cambio de domicilio o circunscripción", "show_if":{"campo":"causa_aviso","igual":"C"}},
  {"id":"causa_c_estado_anterior",    "label":"Estado anterior",              "type":"text", "required":false, "section":"Causa C · Cambio de domicilio o circunscripción", "show_if":{"campo":"causa_aviso","igual":"C"}},

  {"id":"causa_d_nombre_anterior",    "label":"Nombre, denominación o razón social anterior", "type":"text", "required":false, "section":"Causa D · Cambio de nombre o razón social", "show_if":{"campo":"causa_aviso","igual":"D"}},

  {"id":"causa_e_nombre_sustituido",  "label":"Nombre, denominación o razón social del patrón sustituido", "type":"text", "required":false, "section":"Causa E · Sustitución patronal", "show_if":{"campo":"causa_aviso","igual":"E"}},
  {"id":"causa_e_registro_sustituido","label":"Número de registro patronal del patrón sustituido", "type":"text", "required":false, "section":"Causa E · Sustitución patronal", "show_if":{"campo":"causa_aviso","igual":"E"}},

  {"id":"causa_f_registro_1", "label":"Registro 1", "type":"text", "required":false, "section":"Causa F · Duplicidad", "show_if":{"campo":"causa_aviso","igual":"F"}},
  {"id":"causa_f_registro_2", "label":"Registro 2", "type":"text", "required":false, "section":"Causa F · Duplicidad", "show_if":{"campo":"causa_aviso","igual":"F"}},

  {"id":"causa_g_motivo",     "label":"Motivo de la baja", "type":"textarea", "required":false, "section":"Causa G · Baja", "show_if":{"campo":"causa_aviso","igual":"G"}}
]'::jsonb,
  source_docs = '["cedula_rfc","acta_constitutiva","ine","comprobante_domicilio","tip"]'::jsonb
where code = 'afil-01';
