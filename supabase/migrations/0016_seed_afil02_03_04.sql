-- 0016: agrega AFIL-02, AFIL-03 y AFIL-04 al catálogo de trámite_types.
--
-- Tres avisos del Apartado 1 (Llenado de formatos), todos formato oficial
-- en assets/formatos/afil-0X.pdf con sus respectivos .coords.json.
--
--   AFIL-02 — Aviso de Inscripción del Trabajador (alta)
--   AFIL-03 — Aviso de Reingreso del Trabajador
--   AFIL-04 — Aviso de Baja del Trabajador
--
-- Tres trámites separados — comparten muchos campos (NSS, CURP, RFC del
-- trabajador, datos del patrón, ubicación) pero cada uno tiene su propia
-- razón de ser. No usan `cases` (un solo flujo por trámite, sin sub-causas).
--
-- Source docs: las constancias y identificaciones de las que la IA puede
-- extraer los datos del trabajador (ine, nss, curp_constancia) y del patrón
-- (tip, cedula_rfc).

-- ============================================================================
-- AFIL-02 — Aviso de Inscripción del Trabajador
-- ============================================================================
insert into public.tramite_types (code, name, apartado, output_type, field_schema, source_docs)
values (
  'afil-02',
  'AFIL-02 · Aviso de Inscripción del Trabajador',
  1,
  'pdf',
  '[
    {"id":"fecha_publicacion_dof", "label":"Fecha de publicación del formato en el DOF (opcional)", "type":"date", "required":false, "section":"Encabezado"},
    {"id":"umf",                   "label":"UMF (Unidad de Medicina Familiar)",                     "type":"text", "required":false, "section":"Encabezado"},
    {"id":"fecha_solicitud",       "label":"Fecha de solicitud del trámite",                        "type":"date", "required":true,  "section":"Encabezado"},

    {"id":"nss",               "label":"Número de Seguridad Social",        "type":"text", "required":true,  "section":"Datos del trabajador"},
    {"id":"curp_trabajador",   "label":"CURP del trabajador",               "type":"text", "required":true,  "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"rfc_trabajador",    "label":"RFC del trabajador (opcional)",     "type":"text", "required":false, "section":"Datos del trabajador"},
    {"id":"nombre",            "label":"Nombre(s) del trabajador",          "type":"text", "required":true,  "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"apellido_paterno",  "label":"Primer apellido del trabajador",    "type":"text", "required":true,  "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"apellido_materno",  "label":"Segundo apellido del trabajador",   "type":"text", "required":false, "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"sexo",              "label":"Sexo",                              "type":"select","required":true, "section":"Datos del trabajador", "options":["1","2"], "placeholder":"1=Hombre · 2=Mujer"},
    {"id":"fecha_nacimiento",  "label":"Fecha de nacimiento",               "type":"date", "required":true,  "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"lugar_nacimiento",  "label":"Lugar de nacimiento (estado)",      "type":"text", "required":false, "section":"Datos del trabajador"},
    {"id":"ocupacion",         "label":"Ocupación del trabajador",          "type":"text", "required":true,  "section":"Datos del trabajador"},
    {"id":"horario_reducido",  "label":"Días u horario reducido (si aplica)","type":"text","required":false, "section":"Datos del trabajador"},
    {"id":"salario_base",      "label":"Salario base de cotización",        "type":"text", "required":true,  "section":"Datos del trabajador"},
    {"id":"tipo_contratacion", "label":"Tipo de contratación",              "type":"select","required":true, "section":"Datos del trabajador",
      "options":["1","2","3"], "placeholder":"1=Permanente · 2=Eventual · 3=Eventual Construcción"},
    {"id":"tipo_salario",      "label":"Tipo de salario",                   "type":"select","required":true, "section":"Datos del trabajador",
      "options":["0","1","2"], "placeholder":"0=Fijo · 1=Variable · 2=Mixto"},
    {"id":"fecha_ingreso",     "label":"Fecha de ingreso al trabajo",       "type":"date", "required":true,  "section":"Datos del trabajador"},
    {"id":"nombre_padre",      "label":"Nombre del padre (aún finado)",     "type":"text", "required":false, "section":"Datos del trabajador"},
    {"id":"nombre_madre",      "label":"Nombre de la madre (aún finada)",   "type":"text", "required":false, "section":"Datos del trabajador"},

    {"id":"codigo_postal_trabajador",   "label":"CP — domicilio del trabajador",         "type":"text", "required":true,  "section":"Domicilio del trabajador", "source_doc":"comprobante_domicilio"},
    {"id":"calle_trabajador",           "label":"Calle — domicilio del trabajador",      "type":"text", "required":true,  "section":"Domicilio del trabajador", "source_doc":"comprobante_domicilio"},
    {"id":"numero_exterior_trabajador", "label":"No. exterior — domicilio trabajador",   "type":"text", "required":true,  "section":"Domicilio del trabajador", "source_doc":"comprobante_domicilio"},
    {"id":"numero_interior_trabajador", "label":"No. interior — domicilio trabajador",   "type":"text", "required":false, "section":"Domicilio del trabajador", "source_doc":"comprobante_domicilio"},
    {"id":"colonia_trabajador",         "label":"Colonia — domicilio del trabajador",    "type":"text", "required":true,  "section":"Domicilio del trabajador", "source_doc":"comprobante_domicilio"},
    {"id":"localidad_trabajador",       "label":"Localidad (opcional) — trabajador",     "type":"text", "required":false, "section":"Domicilio del trabajador", "source_doc":"comprobante_domicilio"},
    {"id":"municipio_trabajador",       "label":"Municipio — domicilio del trabajador",  "type":"text", "required":true,  "section":"Domicilio del trabajador", "source_doc":"comprobante_domicilio"},
    {"id":"estado_trabajador",          "label":"Estado — domicilio del trabajador",     "type":"text", "required":true,  "section":"Domicilio del trabajador", "source_doc":"comprobante_domicilio"},

    {"id":"registro_patronal",  "label":"Número de Registro Patronal",      "type":"text", "required":true,  "section":"Datos del patrón", "source_doc":"tip"},
    {"id":"curp_patron",        "label":"CURP (solo persona física)",       "type":"text", "required":false, "section":"Datos del patrón"},
    {"id":"rfc_patron",         "label":"RFC del patrón con homoclave",     "type":"text", "required":true,  "section":"Datos del patrón", "source_doc":"cedula_rfc"},
    {"id":"razon_social",       "label":"Nombre, denominación o razón social del patrón", "type":"text", "required":true, "section":"Datos del patrón", "source_doc":"acta_constitutiva"},

    {"id":"codigo_postal_ct",   "label":"CP — centro de trabajo",          "type":"text", "required":true,  "section":"Ubicación del centro de trabajo"},
    {"id":"calle_ct",           "label":"Calle — centro de trabajo",       "type":"text", "required":true,  "section":"Ubicación del centro de trabajo"},
    {"id":"numero_exterior_ct", "label":"No. exterior — centro de trabajo","type":"text", "required":true,  "section":"Ubicación del centro de trabajo"},
    {"id":"numero_interior_ct", "label":"No. interior — centro de trabajo","type":"text", "required":false, "section":"Ubicación del centro de trabajo"},
    {"id":"colonia_ct",         "label":"Colonia — centro de trabajo",     "type":"text", "required":true,  "section":"Ubicación del centro de trabajo"},
    {"id":"localidad_ct",       "label":"Localidad — centro de trabajo",   "type":"text", "required":false, "section":"Ubicación del centro de trabajo"},
    {"id":"municipio_ct",       "label":"Municipio — centro de trabajo",   "type":"text", "required":true,  "section":"Ubicación del centro de trabajo"},
    {"id":"estado_ct",          "label":"Estado — centro de trabajo",      "type":"text", "required":true,  "section":"Ubicación del centro de trabajo"}
  ]'::jsonb,
  '["ine","comprobante_domicilio","tip","cedula_rfc","acta_constitutiva"]'::jsonb
)
on conflict (code) do update
  set name=excluded.name, apartado=excluded.apartado, output_type=excluded.output_type,
      field_schema=excluded.field_schema, source_docs=excluded.source_docs, active=true;

-- ============================================================================
-- AFIL-03 — Aviso de Reingreso del Trabajador
-- ============================================================================
insert into public.tramite_types (code, name, apartado, output_type, field_schema, source_docs)
values (
  'afil-03',
  'AFIL-03 · Aviso de Reingreso del Trabajador',
  1,
  'pdf',
  '[
    {"id":"fecha_publicacion_dof", "label":"Fecha de publicación del formato en el DOF (opcional)", "type":"date", "required":false, "section":"Encabezado"},
    {"id":"umf",                   "label":"UMF (Unidad de Medicina Familiar)",                     "type":"text", "required":false, "section":"Encabezado"},
    {"id":"fecha_solicitud",       "label":"Fecha de solicitud del trámite",                        "type":"date", "required":true,  "section":"Encabezado"},

    {"id":"nss",              "label":"Número de Seguridad Social",     "type":"text", "required":true,  "section":"Datos del trabajador"},
    {"id":"curp_trabajador",  "label":"CURP del trabajador",            "type":"text", "required":true,  "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"rfc_trabajador",   "label":"RFC del trabajador (opcional)",  "type":"text", "required":false, "section":"Datos del trabajador"},
    {"id":"nombre",           "label":"Nombre(s) del trabajador",       "type":"text", "required":true,  "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"apellido_paterno", "label":"Primer apellido del trabajador", "type":"text", "required":true,  "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"apellido_materno", "label":"Segundo apellido del trabajador","type":"text", "required":false, "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"sexo",             "label":"Sexo",                           "type":"select","required":true, "section":"Datos del trabajador", "options":["1","2"], "placeholder":"1=Hombre · 2=Mujer"},
    {"id":"fecha_reingreso",  "label":"Fecha de reingreso al trabajo",  "type":"date", "required":true,  "section":"Datos del trabajador"},
    {"id":"salario_base",     "label":"Salario base de cotización",     "type":"text", "required":true,  "section":"Datos del trabajador"},
    {"id":"tipo_salario",     "label":"Tipo de salario",                "type":"select","required":true, "section":"Datos del trabajador",
      "options":["0","1","2"], "placeholder":"0=Fijo · 1=Variable · 2=Mixto"},
    {"id":"ocupacion",        "label":"Ocupación del trabajador",       "type":"text", "required":false, "section":"Datos del trabajador"},

    {"id":"registro_patronal",  "label":"Número de Registro Patronal",   "type":"text", "required":true,  "section":"Datos del patrón", "source_doc":"tip"},
    {"id":"curp_patron",        "label":"CURP (solo persona física)",    "type":"text", "required":false, "section":"Datos del patrón"},
    {"id":"rfc_patron",         "label":"RFC del patrón con homoclave",  "type":"text", "required":true,  "section":"Datos del patrón", "source_doc":"cedula_rfc"},
    {"id":"razon_social",       "label":"Nombre, denominación o razón social del patrón", "type":"text", "required":true, "section":"Datos del patrón", "source_doc":"acta_constitutiva"},

    {"id":"codigo_postal",   "label":"Código postal — centro de trabajo", "type":"text", "required":true,  "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"calle",           "label":"Calle — centro de trabajo",         "type":"text", "required":true,  "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"numero_exterior", "label":"No. exterior",                      "type":"text", "required":true,  "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"numero_interior", "label":"No. interior (opcional)",           "type":"text", "required":false, "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"colonia",         "label":"Colonia",                           "type":"text", "required":true,  "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"localidad",       "label":"Localidad (opcional)",              "type":"text", "required":false, "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"municipio",       "label":"Municipio o Alcaldía",              "type":"text", "required":true,  "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"estado",          "label":"Estado",                            "type":"text", "required":true,  "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"}
  ]'::jsonb,
  '["ine","comprobante_domicilio","tip","cedula_rfc","acta_constitutiva"]'::jsonb
)
on conflict (code) do update
  set name=excluded.name, apartado=excluded.apartado, output_type=excluded.output_type,
      field_schema=excluded.field_schema, source_docs=excluded.source_docs, active=true;

-- ============================================================================
-- AFIL-04 — Aviso de Baja del Trabajador
-- ============================================================================
insert into public.tramite_types (code, name, apartado, output_type, field_schema, source_docs)
values (
  'afil-04',
  'AFIL-04 · Aviso de Baja del Trabajador',
  1,
  'pdf',
  '[
    {"id":"fecha_publicacion_dof", "label":"Fecha de publicación del formato en el DOF (opcional)", "type":"date", "required":false, "section":"Encabezado"},
    {"id":"umf",                   "label":"UMF (Unidad de Medicina Familiar)",                     "type":"text", "required":false, "section":"Encabezado"},
    {"id":"fecha_solicitud",       "label":"Fecha de solicitud del trámite",                        "type":"date", "required":true,  "section":"Encabezado"},

    {"id":"nss",              "label":"Número de Seguridad Social",        "type":"text", "required":true,  "section":"Datos del trabajador"},
    {"id":"curp_trabajador",  "label":"CURP del trabajador",               "type":"text", "required":true,  "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"rfc_trabajador",   "label":"RFC del trabajador (opcional)",     "type":"text", "required":false, "section":"Datos del trabajador"},
    {"id":"nombre",           "label":"Nombre(s) del trabajador",          "type":"text", "required":true,  "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"apellido_paterno", "label":"Primer apellido del trabajador",    "type":"text", "required":true,  "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"apellido_materno", "label":"Segundo apellido del trabajador",   "type":"text", "required":false, "section":"Datos del trabajador", "source_doc":"ine"},
    {"id":"sexo",             "label":"Sexo",                              "type":"select","required":true, "section":"Datos del trabajador", "options":["1","2"], "placeholder":"1=Hombre · 2=Mujer"},
    {"id":"fecha_baja",       "label":"Fecha de baja del trabajador (último día de salario devengado)", "type":"date", "required":true, "section":"Datos del trabajador"},
    {"id":"causa_baja",       "label":"Causa de la baja",                  "type":"textarea","required":true, "section":"Datos del trabajador"},

    {"id":"registro_patronal", "label":"Número de Registro Patronal",      "type":"text", "required":true,  "section":"Datos del patrón", "source_doc":"tip"},
    {"id":"curp_patron",       "label":"CURP (solo persona física)",       "type":"text", "required":false, "section":"Datos del patrón"},
    {"id":"rfc_patron",        "label":"RFC del patrón con homoclave",     "type":"text", "required":true,  "section":"Datos del patrón", "source_doc":"cedula_rfc"},
    {"id":"razon_social",      "label":"Nombre, denominación o razón social del patrón", "type":"text", "required":true, "section":"Datos del patrón", "source_doc":"acta_constitutiva"},

    {"id":"codigo_postal",   "label":"Código postal — centro de trabajo", "type":"text", "required":true,  "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"calle",           "label":"Calle — centro de trabajo",         "type":"text", "required":true,  "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"numero_exterior", "label":"No. exterior",                      "type":"text", "required":true,  "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"numero_interior", "label":"No. interior (opcional)",           "type":"text", "required":false, "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"colonia",         "label":"Colonia",                           "type":"text", "required":true,  "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"localidad",       "label":"Localidad (opcional)",              "type":"text", "required":false, "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"municipio",       "label":"Municipio o Alcaldía",              "type":"text", "required":true,  "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"},
    {"id":"estado",          "label":"Estado",                            "type":"text", "required":true,  "section":"Ubicación del centro de trabajo", "source_doc":"comprobante_domicilio"}
  ]'::jsonb,
  '["ine","comprobante_domicilio","tip","cedula_rfc","acta_constitutiva"]'::jsonb
)
on conflict (code) do update
  set name=excluded.name, apartado=excluded.apartado, output_type=excluded.output_type,
      field_schema=excluded.field_schema, source_docs=excluded.source_docs, active=true;
