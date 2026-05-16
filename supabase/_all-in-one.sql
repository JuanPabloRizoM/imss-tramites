-- Migración inicial del proyecto tramites-imss.
-- Crea las tres tablas del modelo de datos descrito en la Parte 4 del documento
-- de arquitectura: tramite_types (catálogo), tramites (trámites en curso) y
-- documents (documentos escaneados con su extracción).
--
-- Diseño deliberado:
--   * Sin login. Hoy no hay relación con auth.users.
--   * `field_schema` y `field_values` son JSONB para soportar el motor genérico:
--     agregar un trámite nuevo es solo agregar una fila en tramite_types.
--   * `claimed_by` / `claimed_at` permiten marcar un trámite "en proceso" para
--     que dos personas no trabajen el mismo (Principio 1.4).

-- Extensiones --------------------------------------------------------------
create extension if not exists "pgcrypto";

-- Tabla: tramite_types -----------------------------------------------------
create table if not exists public.tramite_types (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  apartado     int  not null check (apartado between 1 and 4),
  output_type  text not null check (output_type in ('pdf', 'extension', 'copy')),
  field_schema jsonb not null default '[]'::jsonb,
  source_docs  jsonb not null default '[]'::jsonb,
  portal_url   text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists tramite_types_apartado_idx
  on public.tramite_types (apartado)
  where active;

-- Tabla: tramites ----------------------------------------------------------
create table if not exists public.tramites (
  id              uuid primary key default gen_random_uuid(),
  tramite_type_id uuid not null references public.tramite_types(id) on delete restrict,
  status          text not null default 'nuevo'
                    check (status in ('nuevo', 'en_proceso', 'revisado', 'completado')),
  field_values    jsonb not null default '{}'::jsonb,
  claimed_by      text,
  claimed_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists tramites_status_idx       on public.tramites (status);
create index if not exists tramites_type_idx         on public.tramites (tramite_type_id);
create index if not exists tramites_updated_at_idx   on public.tramites (updated_at desc);

-- Trigger: mantener updated_at -------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tramites_set_updated_at on public.tramites;
create trigger tramites_set_updated_at
  before update on public.tramites
  for each row
  execute function public.set_updated_at();

-- Tabla: documents ---------------------------------------------------------
create table if not exists public.documents (
  id                 uuid primary key default gen_random_uuid(),
  tramite_id         uuid references public.tramites(id) on delete cascade,
  storage_path       text not null,
  doc_type           text,
  extracted_data     jsonb,
  extraction_status  text not null default 'pendiente'
                       check (extraction_status in ('pendiente', 'procesando', 'listo', 'error')),
  extraction_error   text,
  created_at         timestamptz not null default now()
);

create index if not exists documents_tramite_idx  on public.documents (tramite_id);
create index if not exists documents_status_idx   on public.documents (extraction_status);

-- Realtime -----------------------------------------------------------------
-- Publica los cambios de tramites y documents para que el cliente se suscriba
-- desde la vista de computadora (Principio 1.2).
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end$$;

alter publication supabase_realtime add table public.tramites;
alter publication supabase_realtime add table public.documents;
-- Bucket de Storage para imágenes y PDFs subidos desde el celular.
-- Acceso privado: solo se accede a través del cliente con la anon key o la
-- service role, no por URL pública.

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;
-- RLS y políticas para el modo "sistema compartido sin cuentas" (Principio 1.4).
--
-- Hoy no hay login: las ~3 personas comparten un mismo espacio. Esto se hace
-- abriendo lectura y escritura a la clave anónima en las tres tablas. Cuando
-- se introduzcan cuentas (decisión futura, ver 1.4 del documento) se reemplazan
-- estas políticas por unas basadas en auth.uid().
--
-- Para Storage se permite a anon subir, leer y borrar SOLO dentro del bucket
-- "documentos". El bucket es privado (no URLs públicas).

-- Tablas ---------------------------------------------------------------------
alter table public.tramite_types enable row level security;
alter table public.tramites      enable row level security;
alter table public.documents     enable row level security;

drop policy if exists "anon_all_tramite_types" on public.tramite_types;
create policy "anon_all_tramite_types"
  on public.tramite_types
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "anon_all_tramites" on public.tramites;
create policy "anon_all_tramites"
  on public.tramites
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "anon_all_documents" on public.documents;
create policy "anon_all_documents"
  on public.documents
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Storage: bucket "documentos" ----------------------------------------------
drop policy if exists "anon_select_documentos" on storage.objects;
create policy "anon_select_documentos"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'documentos');

drop policy if exists "anon_insert_documentos" on storage.objects;
create policy "anon_insert_documentos"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'documentos');

drop policy if exists "anon_update_documentos" on storage.objects;
create policy "anon_update_documentos"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'documentos')
  with check (bucket_id = 'documentos');

drop policy if exists "anon_delete_documentos" on storage.objects;
create policy "anon_delete_documentos"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'documentos');
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
