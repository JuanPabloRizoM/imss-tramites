-- 0020: source_docs faltantes detectados por scripts/auditoria-cobertura.ts
--
-- 1. cert-digital: su campo razon_social declara source_doc
--    "acta_constitutiva" pero el trámite no lo listaba como fuente.
-- 2. captura-rapida: sus campos declaran ine / cedula_rfc /
--    comprobante_domicilio y el trámite no listaba ninguna fuente.
-- 3. afil-01 y am-srt: las emisiones (EMA/EBA), la propuesta de cédula y
--    el alta patronal sellada traen casi toda la cabecera del patrón
--    (registro, RFC, prima, clase, fracción…) — se agregan como fuentes
--    válidas. La "nota manuscrita" (papelito con datos dictados) se
--    agrega a am-srt: es el flujo real de mostrador.

update public.tramite_types
set source_docs = source_docs || '["acta_constitutiva"]'::jsonb
where code = 'cert-digital'
  and not source_docs ? 'acta_constitutiva';

update public.tramite_types
set source_docs = '["ine","cedula_rfc","comprobante_domicilio"]'::jsonb
where code = 'captura-rapida'
  and source_docs = '[]'::jsonb;

update public.tramite_types
set source_docs = source_docs || '["sua_ema_eba","propuesta_cedula","alta_patronal"]'::jsonb
where code = 'afil-01'
  and not source_docs ? 'alta_patronal';

update public.tramite_types
set source_docs = source_docs || '["sua_ema_eba","propuesta_cedula","alta_patronal","nota_manuscrita"]'::jsonb
where code = 'am-srt'
  and not source_docs ? 'nota_manuscrita';
