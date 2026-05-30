-- Pareo celular ↔ computadora (Fase 2.6).
--
-- Hoy un upload del celular aparece en TODAS las computadoras conectadas a
-- la realtime de documents. Cuando varias personas trabajan en paralelo
-- esto satura la vista. Solución: cada computadora abre una sesión con un
-- código corto, el celular entra el código, y los uploads quedan
-- amarrados a esa sesión. La computadora solo ve sus propios documentos
-- (más los que vengan sin sesión, como fallback).
--
-- Diseño:
--   - sessions vive lo que dure la pestaña (sessionStorage del navegador).
--     No hay limpieza automática server-side; el `active = true` flag y
--     last_seen_at quedan para una limpieza futura si llega a haber falta
--     de espacio.
--   - documents.session_id queda nullable. Si una sesión muere antes de
--     que llegue el upload, el FK ON DELETE SET NULL convierte el
--     documento en visible para todos (fallback).
--   - El código se restringe a 31 caracteres sin ambigüedad visual:
--     A-H, J, K, M, N, P-Z, 2-9. Sin 0/O/1/I/L.

-- =========================================================================
-- Tabla sessions
-- =========================================================================
create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique
                 check (code ~ '^[A-HJKMNP-Z2-9]{4}$'),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active       boolean not null default true
);

create index if not exists sessions_code_active_idx
  on public.sessions (code)
  where active;

-- =========================================================================
-- documents.session_id
-- =========================================================================
alter table public.documents
  add column if not exists session_id uuid
    references public.sessions(id) on delete set null;

create index if not exists documents_session_idx
  on public.documents (session_id);

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.sessions enable row level security;

drop policy if exists "anon_all_sessions" on public.sessions;
create policy "anon_all_sessions"
  on public.sessions
  for all
  using (true)
  with check (true);
