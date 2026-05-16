-- Seed del Apartado 4 — captura genérica de datos.
--
-- Es el comodín del sistema: para trámites sin módulo propio (altas/bajas
-- por nombre y NSS, modificaciones simples) y para que un cliente capture
-- sus datos en una pantalla aparte mientras el personal atiende otra cosa.

insert into public.tramite_types (code, name, apartado, output_type, field_schema, source_docs)
values (
  'captura-rapida',
  'Captura rápida de datos',
  4,
  'copy',
  '[
    {"id":"nombre",            "label":"Nombre(s)",          "type":"text", "required":true,  "section":"Persona", "source_doc":"ine"},
    {"id":"apellido_paterno",  "label":"Apellido paterno",   "type":"text", "required":true,  "section":"Persona", "source_doc":"ine"},
    {"id":"apellido_materno",  "label":"Apellido materno",   "type":"text", "required":false, "section":"Persona", "source_doc":"ine"},
    {"id":"curp",              "label":"CURP",               "type":"text", "required":false, "section":"Persona", "source_doc":"ine"},
    {"id":"rfc",               "label":"RFC",                "type":"text", "required":false, "section":"Persona", "source_doc":"cedula_rfc"},
    {"id":"nss",               "label":"NSS (Número de Seguridad Social)", "type":"text", "required":false, "section":"Persona"},
    {"id":"fecha_nacimiento",  "label":"Fecha de nacimiento","type":"date", "required":false, "section":"Persona"},
    {"id":"telefono",          "label":"Teléfono",           "type":"text", "required":false, "section":"Contacto"},
    {"id":"correo",            "label":"Correo electrónico", "type":"text", "required":false, "section":"Contacto"},
    {"id":"domicilio",         "label":"Domicilio completo", "type":"textarea", "required":false, "section":"Contacto", "source_doc":"comprobante_domicilio"},
    {"id":"notas",             "label":"Notas",              "type":"textarea", "required":false, "section":"Observaciones"}
  ]'::jsonb,
  '[]'::jsonb
)
on conflict (code) do update
  set name         = excluded.name,
      apartado     = excluded.apartado,
      output_type  = excluded.output_type,
      field_schema = excluded.field_schema,
      active       = true;
