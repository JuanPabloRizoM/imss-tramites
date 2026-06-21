-- 0033: escrito de solicitud a la Subdelegación (apartado 1).
--
-- Carta formal dirigida a la Subdelegación del IMSS. El render lo hace
-- lib/pdf.ts::generarEscritoSubdelegacion (code "escrito-subdeleg"): lugar/
-- fecha arriba-derecha, destinatario a la izquierda, cuerpo con los datos del
-- patrón + el trámite solicitado, y bloque de firma centrado.
--
-- Los escritos NO se fuerzan a MAYÚSCULAS (ver app/api/generar-pdf): los
-- defaults van en title case para que la carta se vea bien.

insert into public.tramite_types (code, name, apartado, output_type, field_schema, source_docs)
values (
  'escrito-subdeleg',
  'Escrito · Solicitud a la Subdelegación',
  1,
  'pdf',
  '[
    { "id": "lugar",        "label": "Lugar",                 "type": "text", "required": false, "section": "Lugar y fecha", "default": "Guadalajara, Jalisco" },
    { "id": "fecha",        "label": "Fecha",                 "type": "date", "required": true,  "section": "Lugar y fecha" },

    { "id": "delegacion",    "label": "Delegación",            "type": "text", "required": false, "section": "Destinatario", "default": "Delegación Estatal Jalisco" },
    { "id": "subdelegacion", "label": "Subdelegación",         "type": "text", "required": false, "section": "Destinatario", "default": "Subdelegación Hidalgo" },

    { "id": "tipo_persona",     "label": "Tipo de persona",                       "type": "select", "required": false, "section": "Datos del patrón", "options": ["Física", "Moral"], "default": "Física" },
    { "id": "nombre_patron",    "label": "Nombre del patrón o razón social",      "type": "text",   "required": true,  "section": "Datos del patrón", "source_doc": "tip" },
    { "id": "registro_patronal","label": "Registro patronal",                     "type": "text",   "required": false, "section": "Datos del patrón", "source_doc": "tip", "maxlength": 11 },
    { "id": "rfc",              "label": "RFC con homoclave",                     "type": "text",   "required": false, "section": "Datos del patrón", "source_doc": "cedula_rfc", "maxlength": 13 },

    { "id": "tramite_solicitado", "label": "Trámite que se solicita / motivo (redáctalo como va en la carta)", "type": "textarea", "required": true, "section": "Trámite" },

    { "id": "firmante", "label": "Nombre de quien firma (patrón o representante legal)", "type": "text", "required": true,  "section": "Firma" },
    { "id": "empresa",  "label": "Nombre de la empresa (si es persona moral)",          "type": "text", "required": false, "section": "Firma" }
  ]'::jsonb,
  '["tip", "cedula_rfc", "ine", "acta_constitutiva"]'::jsonb
)
on conflict (code) do update
  set name = excluded.name,
      apartado = excluded.apartado,
      output_type = excluded.output_type,
      field_schema = excluded.field_schema,
      source_docs = excluded.source_docs;
