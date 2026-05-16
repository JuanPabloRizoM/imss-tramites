-- Seed inicial del catálogo de trámites (Principio 1.1: motor genérico).
--
-- Agregar un trámite nuevo es solo INSERT en esta tabla. No se toca código.
-- Cada `field_schema` es la lista de campos del formato oficial — el form
-- dinámico de /apartado-1 los renderiza tal cual y los agrupa por sección.

-- =========================================================================
-- Escrito "A quien corresponda" — plantilla genérica para cualquier escrito
-- dirigido a una autoridad.
-- =========================================================================
insert into public.tramite_types (code, name, apartado, output_type, field_schema, source_docs)
values (
  'escrito-generico',
  'Escrito a quien corresponda',
  1,
  'pdf',
  '[
    {"id":"lugar",          "label":"Lugar de emisión",       "type":"text", "required":true,  "section":"Encabezado"},
    {"id":"fecha",          "label":"Fecha",                  "type":"date", "required":true,  "section":"Encabezado"},
    {"id":"destinatario",   "label":"Destinatario",           "type":"text", "required":true,  "section":"Destinatario", "source_doc":null},
    {"id":"cargo",          "label":"Cargo del destinatario", "type":"text", "required":false, "section":"Destinatario"},
    {"id":"dependencia",    "label":"Dependencia",            "type":"text", "required":false, "section":"Destinatario"},
    {"id":"asunto",         "label":"Asunto",                 "type":"text", "required":true,  "section":"Cuerpo"},
    {"id":"cuerpo",         "label":"Cuerpo del escrito",     "type":"textarea", "required":true, "section":"Cuerpo"},
    {"id":"despedida",      "label":"Despedida",              "type":"text", "required":false, "section":"Cierre"},
    {"id":"firmante",       "label":"Nombre de quien firma",  "type":"text", "required":true,  "section":"Cierre"},
    {"id":"cargo_firmante", "label":"Cargo de quien firma",   "type":"text", "required":false, "section":"Cierre"}
  ]'::jsonb,
  '[]'::jsonb
)
on conflict (code) do update
  set name         = excluded.name,
      apartado     = excluded.apartado,
      output_type  = excluded.output_type,
      field_schema = excluded.field_schema,
      source_docs  = excluded.source_docs,
      active       = true;

-- =========================================================================
-- AFIL-01 — Aviso de Inscripción Patronal (alta patronal).
-- Campos extraídos de los numerales del formato oficial del IMSS.
-- =========================================================================
insert into public.tramite_types (code, name, apartado, output_type, field_schema, source_docs)
values (
  'afil-01',
  'AFIL-01 · Aviso de Inscripción Patronal',
  1,
  'pdf',
  '[
    {"id":"registro_patronal", "label":"Registro patronal (si aplica)", "type":"text", "required":false, "section":"Identificación", "source_doc":"tip"},
    {"id":"rfc",               "label":"RFC con homoclave",             "type":"text", "required":true,  "section":"Identificación", "source_doc":"cedula_rfc"},
    {"id":"tipo_persona",      "label":"Tipo de persona",               "type":"select", "options":["Persona física","Persona moral"], "required":true, "section":"Identificación"},

    {"id":"razon_social",      "label":"Denominación o razón social",   "type":"text", "required":true,  "section":"Datos del patrón", "source_doc":"acta_constitutiva"},
    {"id":"nombre",            "label":"Nombre(s)",                     "type":"text", "required":false, "section":"Datos del patrón", "source_doc":"ine"},
    {"id":"apellido_paterno",  "label":"Apellido paterno",              "type":"text", "required":false, "section":"Datos del patrón", "source_doc":"ine"},
    {"id":"apellido_materno",  "label":"Apellido materno",              "type":"text", "required":false, "section":"Datos del patrón", "source_doc":"ine"},
    {"id":"curp",              "label":"CURP",                          "type":"text", "required":false, "section":"Datos del patrón", "source_doc":"ine"},

    {"id":"calle",             "label":"Calle",                         "type":"text", "required":true,  "section":"Domicilio del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"numero_exterior",   "label":"Número exterior",               "type":"text", "required":true,  "section":"Domicilio del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"numero_interior",   "label":"Número interior",               "type":"text", "required":false, "section":"Domicilio del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"colonia",           "label":"Colonia",                       "type":"text", "required":true,  "section":"Domicilio del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"municipio",         "label":"Municipio o alcaldía",          "type":"text", "required":true,  "section":"Domicilio del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"entidad",           "label":"Entidad federativa",            "type":"text", "required":true,  "section":"Domicilio del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"codigo_postal",     "label":"Código postal",                 "type":"text", "required":true,  "section":"Domicilio del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"telefono",          "label":"Teléfono",                      "type":"text", "required":false, "section":"Domicilio del centro de trabajo"},
    {"id":"correo",            "label":"Correo electrónico",            "type":"text", "required":false, "section":"Domicilio del centro de trabajo"},

    {"id":"actividad",         "label":"Actividad económica",           "type":"text", "required":true,  "section":"Actividad"},
    {"id":"clase_riesgo",      "label":"Clase de riesgo",               "type":"select", "options":["I","II","III","IV","V"], "required":true, "section":"Actividad"},
    {"id":"fecha_inicio",      "label":"Fecha de inicio de operaciones","type":"date", "required":true,  "section":"Actividad"},

    {"id":"representante",     "label":"Nombre del representante legal","type":"text", "required":false, "section":"Representación", "source_doc":"acta_constitutiva"},
    {"id":"numero_escritura",  "label":"Número de escritura",           "type":"text", "required":false, "section":"Representación", "source_doc":"acta_constitutiva"},
    {"id":"numero_notaria",    "label":"Número de notaría",             "type":"text", "required":false, "section":"Representación", "source_doc":"acta_constitutiva"}
  ]'::jsonb,
  '["cedula_rfc","ine","acta_constitutiva","comprobante_domicilio","tip"]'::jsonb
)
on conflict (code) do update
  set name         = excluded.name,
      apartado     = excluded.apartado,
      output_type  = excluded.output_type,
      field_schema = excluded.field_schema,
      source_docs  = excluded.source_docs,
      active       = true;
