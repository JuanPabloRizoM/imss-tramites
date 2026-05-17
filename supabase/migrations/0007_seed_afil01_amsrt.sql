-- Actualiza AFIL-01 al field_schema que matchea el PDF oficial (assets/formatos/afil-01.pdf)
-- y agrega AM-SRT (assets/formatos/am-srt.pdf). Ambos generan PDF mediante overlay
-- sobre el PDF base + JSON de coordenadas — calibrar coords sin tocar código.

-- =========================================================================
-- AFIL-01 — Aviso de Inscripción Patronal o de Modificación en su Registro
-- =========================================================================
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

  {"id":"no_notaria",        "label":"No. de notaría",                       "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva"},
  {"id":"no_acta",           "label":"No. de acta",                          "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva"},
  {"id":"no_libro",          "label":"No. de libro",                         "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva"},
  {"id":"no_foja",           "label":"No. de foja",                          "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva"},
  {"id":"registro_publico",  "label":"Registro Público de la Propiedad",     "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva"},
  {"id":"informacion_adicional","label":"Información adicional",             "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)"},
  {"id":"lugar_fecha_constitucion","label":"Lugar y fecha de constitución",  "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva"}
]'::jsonb,
  source_docs = '["cedula_rfc","acta_constitutiva","ine","comprobante_domicilio","tip"]'::jsonb,
  name = 'AFIL-01 · Aviso de Inscripción Patronal o de Modificación',
  output_type = 'pdf'
where code = 'afil-01';

-- =========================================================================
-- AM-SRT — Aviso de modificación de empresas para el Seguro de Riesgos de Trabajo
-- =========================================================================
insert into public.tramite_types (code, name, apartado, output_type, field_schema, source_docs)
values (
  'am-srt',
  'AM-SRT · Aviso de modificación · Seguro de Riesgos de Trabajo',
  1,
  'pdf',
  '[
    {"id":"fecha_presentacion", "label":"Fecha de presentación de este aviso",  "type":"date",    "required":true,  "section":"Encabezado"},
    {"id":"fecha_modificacion", "label":"Fecha a partir de la cual surte efecto","type":"date",    "required":true,  "section":"Encabezado"},

    {"id":"razon_social",       "label":"Denominación o razón social (persona moral)","type":"text","required":false,"section":"Datos generales", "source_doc":"acta_constitutiva"},
    {"id":"nombre",             "label":"Nombre(s) (persona física)",           "type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},
    {"id":"apellido_paterno",   "label":"Primer apellido (persona física)",     "type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},
    {"id":"apellido_materno",   "label":"Segundo apellido (persona física)",    "type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},
    {"id":"curp",               "label":"CURP (persona física)",                "type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},

    {"id":"registro_patronal",  "label":"Registro patronal actual",             "type":"text",    "required":true,  "section":"Clasificación actual", "source_doc":"tip"},
    {"id":"rfc",                "label":"RFC con homoclave",                    "type":"text",    "required":true,  "section":"Clasificación actual", "source_doc":"cedula_rfc"},
    {"id":"division",           "label":"División",                             "type":"text",    "required":false, "section":"Clasificación actual"},
    {"id":"grupo",              "label":"Grupo",                                "type":"text",    "required":false, "section":"Clasificación actual"},
    {"id":"fraccion",           "label":"Fracción",                             "type":"text",    "required":false, "section":"Clasificación actual"},
    {"id":"clase",              "label":"Clase",                                "type":"select",  "required":false, "section":"Clasificación actual", "options":["I","II","III","IV","V"]},
    {"id":"prima_srt",          "label":"Prima SRT",                            "type":"text",    "required":false, "section":"Clasificación actual"},

    {"id":"tipo_modificacion",  "label":"Tipo de modificación",                 "type":"select",  "required":true,  "section":"Tipo de modificación",
      "options":["reanudacion","cambio_domicilio","cambio_actividad","cambio_ley_racerf","incorporacion_actividades","escision","sustitucion_patronal","fusion","compra_activos","comodato","enajenacion","arrendamiento","fideicomiso"]},
    {"id":"delegacion_baja",    "label":"Delegación de la baja (si aplica)",    "type":"text",    "required":false, "section":"Datos de la baja"},
    {"id":"subdelegacion_baja", "label":"Subdelegación de la baja (si aplica)", "type":"text",    "required":false, "section":"Datos de la baja"},
    {"id":"fecha_baja",         "label":"Fecha de la baja (si aplica)",         "type":"date",    "required":false, "section":"Datos de la baja"},

    {"id":"calle",              "label":"Calle del nuevo domicilio",            "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"numero_exterior",    "label":"Número exterior",                      "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"numero_interior",    "label":"Número interior",                      "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"entre_calles",       "label":"Entre qué calles",                     "type":"text",    "required":false, "section":"Cambio de domicilio"},
    {"id":"calle_posterior",    "label":"Calle posterior",                      "type":"text",    "required":false, "section":"Cambio de domicilio"},
    {"id":"colonia",            "label":"Colonia",                              "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"localidad",          "label":"Localidad (opcional)",                 "type":"text",    "required":false, "section":"Cambio de domicilio"},
    {"id":"municipio",          "label":"Municipio o alcaldía",                 "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"estado",             "label":"Estado",                               "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"codigo_postal",      "label":"Código postal",                        "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"telefono_1",         "label":"Teléfono fijo 1 (lada+número)",        "type":"text",    "required":false, "section":"Cambio de domicilio"},
    {"id":"telefono_2",         "label":"Teléfono fijo 2 (lada+número)",        "type":"text",    "required":false, "section":"Cambio de domicilio"},
    {"id":"correo",             "label":"Correo electrónico",                   "type":"text",    "required":false, "section":"Cambio de domicilio"},

    {"id":"giro",               "label":"Especificar giro / actividad",         "type":"textarea","required":false, "section":"Actividad declarada", "source_doc":"acta_constitutiva"},
    {"id":"presta_servicios_personal", "label":"¿Presta servicios de personal?","type":"select", "required":false, "section":"Actividad declarada", "options":["si","no"]}
  ]'::jsonb,
  '["tip","cedula_rfc","acta_constitutiva","ine","comprobante_domicilio"]'::jsonb
)
on conflict (code) do update
  set name = excluded.name,
      apartado = excluded.apartado,
      output_type = excluded.output_type,
      field_schema = excluded.field_schema,
      source_docs = excluded.source_docs,
      active = true;
