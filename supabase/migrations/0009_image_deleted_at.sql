-- documents.image_deleted_at: marca cuándo se borró la imagen del Storage.
--
-- La idea: el storage cuesta. Una vez extraídos los datos del documento, el
-- usuario puede liberar la foto sin perder los campos. storage_path se queda
-- apuntando al objeto borrado (NOT NULL), pero image_deleted_at != null
-- indica que el objeto físico ya no existe y la UI no debe pedir signedUrl.

alter table public.documents
  add column if not exists image_deleted_at timestamptz;
