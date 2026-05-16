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
