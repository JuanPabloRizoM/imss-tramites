-- Bucket de Storage para imágenes y PDFs subidos desde el celular.
-- Acceso privado: solo se accede a través del cliente con la anon key o la
-- service role, no por URL pública.

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;
