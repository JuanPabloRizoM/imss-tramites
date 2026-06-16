-- 0025: marca de "esta sesión apunta a un trámite" para captura dirigida
-- desde el celular.
--
-- Flujo: la computadora, dentro de un trámite (apartado 1 o 2), genera un
-- código de pareo y guarda en la sesión a qué trámite apunta. El celular,
-- al conectarse a ese código, ve que la sesión es "para un trámite" y por
-- eso SUBE la foto SIN extraer — deja que la computadora haga UNA sola
-- extracción dirigida (target_fields del schema, filtrada por caso/contexto).
-- Así no se gastan tokens dos veces.
--
-- Cuando es null, la sesión es la normal del apartado 3 (el celular extrae
-- genérico al subir, como siempre).
--
-- Forma del jsonb: { "code": "afil-01", "name": "AFIL-01 · Alta patronal" }

alter table public.sessions
  add column if not exists target_tramite jsonb;
