-- 0014: setea portal_url para cert-digital.
--
-- El INSERT original (0006_seed_apartado_2.sql) no incluyó portal_url para
-- cert-digital — por eso el popup de la extensión y el bloque "Cómo se usa"
-- del form mostraban "URL del portal — pendiente". Ahora apunta a la pantalla
-- real de captura del IDSE.
--
-- Junto con esto, el manifest.json de la extensión (v0.2.0) ya inyecta el
-- content script en idse.imss.gob.mx/* así que la extensión sí va a operar
-- en esa pantalla.

update public.tramite_types
set portal_url = 'https://idse.imss.gob.mx/certificacion/jsp/representante/requerimiento/captura.jsp'
where code = 'cert-digital';
