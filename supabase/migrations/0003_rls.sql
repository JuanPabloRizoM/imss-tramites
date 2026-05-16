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
