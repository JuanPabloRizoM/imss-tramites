-- 0034: agrega el doc_type "amsrt_lleno" a las fuentes del trámite am-srt.
--
-- Permite escanear un AM-SRT YA LLENO (foto del formato anterior) y que la
-- extracción lea las casillas marcadas con X (tipo de modificación, clase,
-- SI/NO de transporte/personal/terceros, distribución) además de los datos de
-- texto. El doc_type vive en lib/extraccion.ts::DOC_TYPES.amsrt_lleno.
--
-- Idempotente: solo lo agrega si no está ya en la lista.

update public.tramite_types
set source_docs = coalesce(source_docs, '[]'::jsonb) || '["amsrt_lleno"]'::jsonb
where code = 'am-srt'
  and not (coalesce(source_docs, '[]'::jsonb) @> '["amsrt_lleno"]');
