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
  image_deleted_at   timestamptz,
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
-- Seed del Apartado 2 — trámites que se pegan en el portal del IMSS vía
-- extensión de navegador. Cada campo lleva su `portal_selector` (CSS) y, si
-- aplica, `portal_chain` (selects dependientes via DWR del portal).
--
-- Notas del portal:
--   * El portal usa Bootstrap + jQuery + DWR. Los inputs de tipo "datepicker"
--     son readonly; se llenan seteando value + disparando change.
--   * Las cadenas Estado → Municipio → Localidad → Colonia se procesan en
--     orden: la extensión espera (~600 ms) entre setear cada nivel para que
--     DWR cargue las opciones del siguiente.
--   * Los campos `_nota` y los datos sin destino automático (tablas dinámicas
--     de personas autorizadas, productos, maquinaria, transporte, personal)
--     NO se inyectan al portal — la extensión los muestra en un panel
--     flotante para que la persona los pegue manualmente.

-- =========================================================================
-- ARP-PM — Aviso de Inscripción Patronal (Persona Moral)
-- Portal: initCapturaMoral
-- =========================================================================
insert into public.tramite_types (code, name, apartado, output_type, portal_url, field_schema, source_docs)
values (
  'arp-pm',
  'ARP-PM · Prealta patronal · Persona Moral',
  2,
  'extension',
  'https://altapatronalpresencial.imss.gob.mx/sapi/plantillaPatrones.do?method=initCapturaMoral',
  '[
    {"id":"fecha_surte_efectos",  "label":"Fecha a partir de la cual surte efectos",     "type":"date",     "required":true,  "section":"Identificación", "portal_selector":"#txtFecSurEfect", "portal_datepicker":true},
    {"id":"rfc",                  "label":"RFC con homoclave",                            "type":"text",     "required":true,  "section":"Identificación", "source_doc":"cedula_rfc", "portal_selector":"#txtRfc"},
    {"id":"razon_social",         "label":"Denominación o razón social (sin siglas)",     "type":"text",     "required":true,  "section":"Identificación", "source_doc":"acta_constitutiva", "portal_selector":"#txtNombreORazonSocial"},
    {"id":"tipo_sociedad",        "label":"Tipo de sociedad",                             "type":"select",   "required":true,  "section":"Identificación", "portal_selector":"#slcTipoSociedad",
      "options":["SA","S DE RL","SAS","SAPI","SC","AC","SC DE RL","SCS","SNC","S EN C","ABP","S DE RL DE CV","SA DE CV","Otro"]},
    {"id":"nombre_comercial",     "label":"Nombre comercial",                             "type":"text",     "required":false, "section":"Identificación", "portal_selector":"#txtNomNombreComercial"},

    {"id":"cp_fiscal",            "label":"Código postal",                                "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#txtCP"},
    {"id":"estado_fiscal",        "label":"Estado",                                       "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#slcEstado", "portal_option_match":"text"},
    {"id":"municipio_fiscal",     "label":"Municipio o alcaldía",                         "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#slcMunicipDeleg", "portal_option_match":"text", "portal_chain":{"parent":"estado_fiscal"}},
    {"id":"localidad_fiscal",     "label":"Localidad",                                    "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#slcLocalidad", "portal_option_match":"text", "portal_chain":{"parent":"municipio_fiscal"}},
    {"id":"colonia_fiscal",       "label":"Colonia",                                      "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#slcColonia", "portal_option_match":"text", "portal_chain":{"parent":"localidad_fiscal"}},
    {"id":"calle_fiscal",         "label":"Calle",                                        "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#txtDomCalleF"},
    {"id":"numero_exterior_fiscal","label":"Número exterior",                             "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#txtRefNoExt"},
    {"id":"numero_interior_fiscal","label":"Número interior",                             "type":"text",     "required":false, "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#txtRefNoInt"},
    {"id":"entre_calle_1_fiscal", "label":"Entre la calle de",                            "type":"text",     "required":true,  "section":"Domicilio fiscal", "portal_selector":"#txtDomEntreCalle1"},
    {"id":"entre_calle_2_fiscal", "label":"Y la calle de",                                "type":"text",     "required":true,  "section":"Domicilio fiscal", "portal_selector":"#txtDomEntreCalle2"},
    {"id":"lada_fiscal",          "label":"Lada",                                         "type":"text",     "required":true,  "section":"Domicilio fiscal", "portal_selector":"#txtLadaTelFijo1"},
    {"id":"telefono_fiscal",      "label":"Teléfono fijo",                                "type":"text",     "required":true,  "section":"Domicilio fiscal", "portal_selector":"#txtNumTelFijo1"},
    {"id":"correo_fiscal",        "label":"Correo electrónico",                           "type":"text",     "required":false, "section":"Domicilio fiscal", "portal_selector":"#txtDomCorreoElec"},

    {"id":"numero_escritura",     "label":"Número de escritura",                          "type":"text",     "required":true,  "section":"Acta constitutiva", "source_doc":"acta_constitutiva", "portal_selector":"#txtNumEscritura"},
    {"id":"numero_notaria",       "label":"Número de notaría o correduría",               "type":"text",     "required":true,  "section":"Acta constitutiva", "source_doc":"acta_constitutiva", "portal_selector":"#txtNumNotaria"},
    {"id":"folio_mercantil",      "label":"Folio mercantil electrónico",                  "type":"text",     "required":false, "section":"Acta constitutiva", "source_doc":"acta_constitutiva", "portal_selector":"#txtNumFolioMerc"},
    {"id":"estado_acta",          "label":"Estado de expedición del acta",                "type":"text",     "required":true,  "section":"Acta constitutiva", "portal_selector":"#slcLugarFechaExpeEC", "portal_option_match":"text"},
    {"id":"municipio_acta",       "label":"Municipio de expedición del acta",             "type":"text",     "required":true,  "section":"Acta constitutiva", "portal_selector":"#slcMunicipDelegFE", "portal_option_match":"text", "portal_chain":{"parent":"estado_acta"}},
    {"id":"fecha_acta",           "label":"Fecha de expedición del acta",                 "type":"date",     "required":false, "section":"Acta constitutiva", "source_doc":"acta_constitutiva", "portal_selector":"#txtLugarFechaExpeEC", "portal_datepicker":true},

    {"id":"curp_rep",             "label":"CURP",                                         "type":"text",     "required":true,  "section":"Representante legal", "source_doc":"ine", "portal_selector":"#txtCurpRL"},
    {"id":"rfc_rep",              "label":"RFC",                                          "type":"text",     "required":false, "section":"Representante legal", "portal_selector":"#txtRFCRL"},
    {"id":"nombre_rep",           "label":"Nombre(s)",                                    "type":"text",     "required":true,  "section":"Representante legal", "source_doc":"ine", "portal_selector":"#txtNombreRL"},
    {"id":"apellido_paterno_rep", "label":"Primer apellido",                              "type":"text",     "required":true,  "section":"Representante legal", "source_doc":"ine", "portal_selector":"#txtApPaternoRL"},
    {"id":"apellido_materno_rep", "label":"Segundo apellido",                             "type":"text",     "required":false, "section":"Representante legal", "source_doc":"ine", "portal_selector":"#txtApMaternoRL"},
    {"id":"correo_rep",           "label":"Correo electrónico",                           "type":"text",     "required":false, "section":"Representante legal", "portal_selector":"#txtDomCorreoElecRL"},

    {"id":"usar_mismo_domicilio", "label":"El centro de trabajo es el mismo que el domicilio fiscal", "type":"checkbox", "required":false, "section":"Centro de trabajo", "portal_selector":"#chkCopiarDomicilio"},
    {"id":"cp_ct",                "label":"Código postal",                                "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtCPCT"},
    {"id":"estado_ct",            "label":"Estado",                                       "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#slcEstadoCT", "portal_option_match":"text"},
    {"id":"municipio_ct",         "label":"Municipio o alcaldía",                         "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#slcMunicipDelegCT", "portal_option_match":"text", "portal_chain":{"parent":"estado_ct"}},
    {"id":"localidad_ct",         "label":"Localidad",                                    "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#slcLocalidadCT", "portal_option_match":"text", "portal_chain":{"parent":"municipio_ct"}},
    {"id":"colonia_ct",           "label":"Colonia",                                      "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#slcColoniaCT", "portal_option_match":"text", "portal_chain":{"parent":"localidad_ct"}},
    {"id":"calle_ct",             "label":"Calle",                                        "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtCalleCT"},
    {"id":"numero_exterior_ct",   "label":"Número exterior",                              "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtNumeroExteriorCT"},
    {"id":"numero_interior_ct",   "label":"Número interior",                              "type":"text",     "required":false, "section":"Centro de trabajo", "portal_selector":"#txtNumeroInteriorCT"},
    {"id":"entre_calle_1_ct",     "label":"Entre la calle de",                            "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtEntreCalleCT"},
    {"id":"entre_calle_2_ct",     "label":"Y la calle de",                                "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtYcalleCT"},
    {"id":"lada_ct",              "label":"Lada",                                         "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtLadaTelDistanciaCT"},
    {"id":"telefono_ct",          "label":"Teléfono fijo",                                "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtTelDistanciaCT"},
    {"id":"correo_ct",            "label":"Correo electrónico",                           "type":"text",     "required":false, "section":"Centro de trabajo", "portal_selector":"#txtCorreoCT"},

    {"id":"giro",                 "label":"Especifica tu giro / actividad",               "type":"textarea", "required":false, "section":"Actividad", "source_doc":"acta_constitutiva", "portal_selector":"#txtGiro"},
    {"id":"notas_tablas",         "label":"Notas para tablas (personas autorizadas, productos, maquinaria, transporte, personal)", "type":"textarea", "required":false, "section":"Notas para llenar a mano", "portal_skip":true, "portal_show_in_panel":true}
  ]'::jsonb,
  '["cedula_rfc","acta_constitutiva","ine","comprobante_domicilio"]'::jsonb
)
on conflict (code) do update
  set name=excluded.name, apartado=excluded.apartado, output_type=excluded.output_type,
      portal_url=excluded.portal_url, field_schema=excluded.field_schema,
      source_docs=excluded.source_docs, active=true;

-- =========================================================================
-- ARP-PF — Aviso de Inscripción Patronal (Persona Física)
-- Portal: initCapturaFisica
-- =========================================================================
insert into public.tramite_types (code, name, apartado, output_type, portal_url, field_schema, source_docs)
values (
  'arp-pf',
  'ARP-PF · Prealta patronal · Persona Física',
  2,
  'extension',
  'https://altapatronalpresencial.imss.gob.mx/sapi/plantillaPatrones.do?method=initCapturaFisica',
  '[
    {"id":"fecha_surte_efectos",  "label":"Fecha a partir de la cual surte efectos",     "type":"date",     "required":true,  "section":"Identificación", "portal_selector":"#txtFecSurEfect", "portal_datepicker":true},
    {"id":"curp",                 "label":"CURP",                                         "type":"text",     "required":true,  "section":"Identificación", "source_doc":"ine", "portal_selector":"#txtCurpDG"},
    {"id":"rfc",                  "label":"RFC con homoclave",                            "type":"text",     "required":true,  "section":"Identificación", "source_doc":"cedula_rfc", "portal_selector":"#txtRfcDG"},
    {"id":"nombre",               "label":"Nombre(s)",                                    "type":"text",     "required":true,  "section":"Identificación", "source_doc":"ine", "portal_selector":"#txtNombreRazonDG"},
    {"id":"apellido_paterno",     "label":"Primer apellido",                              "type":"text",     "required":true,  "section":"Identificación", "source_doc":"ine", "portal_selector":"#txtApellidoPaternoDG"},
    {"id":"apellido_materno",     "label":"Segundo apellido",                             "type":"text",     "required":false, "section":"Identificación", "source_doc":"ine", "portal_selector":"#txtApellidoMaternoDG"},
    {"id":"nombre_comercial",     "label":"Nombre comercial",                             "type":"text",     "required":false, "section":"Identificación", "portal_selector":"#txtNomNombreComercial"},

    {"id":"cp_fiscal",            "label":"Código postal",                                "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#txtCP"},
    {"id":"estado_fiscal",        "label":"Estado",                                       "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#slcEstado", "portal_option_match":"text"},
    {"id":"municipio_fiscal",     "label":"Municipio o alcaldía",                         "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#slcMunicipDeleg", "portal_option_match":"text", "portal_chain":{"parent":"estado_fiscal"}},
    {"id":"localidad_fiscal",     "label":"Localidad",                                    "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#slcLocalidad", "portal_option_match":"text", "portal_chain":{"parent":"municipio_fiscal"}},
    {"id":"colonia_fiscal",       "label":"Colonia",                                      "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#slcColonia", "portal_option_match":"text", "portal_chain":{"parent":"localidad_fiscal"}},
    {"id":"calle_fiscal",         "label":"Calle",                                        "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#txtDomCalleF"},
    {"id":"numero_exterior_fiscal","label":"Número exterior",                             "type":"text",     "required":true,  "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#txtRefNoExt"},
    {"id":"numero_interior_fiscal","label":"Número interior",                             "type":"text",     "required":false, "section":"Domicilio fiscal", "source_doc":"comprobante_domicilio", "portal_selector":"#txtRefNoInt"},
    {"id":"entre_calle_1_fiscal", "label":"Entre la calle de",                            "type":"text",     "required":true,  "section":"Domicilio fiscal", "portal_selector":"#txtDomEntreCalle1"},
    {"id":"entre_calle_2_fiscal", "label":"Y la calle de",                                "type":"text",     "required":true,  "section":"Domicilio fiscal", "portal_selector":"#txtDomEntreCalle2"},
    {"id":"lada_fiscal",          "label":"Lada",                                         "type":"text",     "required":true,  "section":"Domicilio fiscal", "portal_selector":"#txtLadaTelFijo1"},
    {"id":"telefono_fiscal",      "label":"Teléfono fijo",                                "type":"text",     "required":true,  "section":"Domicilio fiscal", "portal_selector":"#txtNumTelFijo1"},
    {"id":"correo_fiscal",        "label":"Correo electrónico",                           "type":"text",     "required":false, "section":"Domicilio fiscal", "portal_selector":"#txtDomCorreoElec"},

    {"id":"usar_mismo_domicilio", "label":"El centro de trabajo es el mismo que el domicilio fiscal", "type":"checkbox", "required":false, "section":"Centro de trabajo", "portal_selector":"#chkCopiarDomicilio"},
    {"id":"cp_ct",                "label":"Código postal",                                "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtCPCT"},
    {"id":"estado_ct",            "label":"Estado",                                       "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#slcEstadoCT", "portal_option_match":"text"},
    {"id":"municipio_ct",         "label":"Municipio o alcaldía",                         "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#slcMunicipDelegCT", "portal_option_match":"text", "portal_chain":{"parent":"estado_ct"}},
    {"id":"localidad_ct",         "label":"Localidad",                                    "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#slcLocalidadCT", "portal_option_match":"text", "portal_chain":{"parent":"municipio_ct"}},
    {"id":"colonia_ct",           "label":"Colonia",                                      "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#slcColoniaCT", "portal_option_match":"text", "portal_chain":{"parent":"localidad_ct"}},
    {"id":"calle_ct",             "label":"Calle",                                        "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtCalleCT"},
    {"id":"numero_exterior_ct",   "label":"Número exterior",                              "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtNumeroExteriorCT"},
    {"id":"numero_interior_ct",   "label":"Número interior",                              "type":"text",     "required":false, "section":"Centro de trabajo", "portal_selector":"#txtNumeroInteriorCT"},
    {"id":"entre_calle_1_ct",     "label":"Entre la calle de",                            "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtEntreCalleCT"},
    {"id":"entre_calle_2_ct",     "label":"Y la calle de",                                "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtYcalleCT"},
    {"id":"lada_ct",              "label":"Lada",                                         "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtLadaTelDistanciaCT"},
    {"id":"telefono_ct",          "label":"Teléfono fijo",                                "type":"text",     "required":true,  "section":"Centro de trabajo", "portal_selector":"#txtTelDistanciaCT"},
    {"id":"correo_ct",            "label":"Correo electrónico",                           "type":"text",     "required":false, "section":"Centro de trabajo", "portal_selector":"#txtCorreoCT"},

    {"id":"giro",                 "label":"Especifica tu giro / actividad",               "type":"textarea", "required":false, "section":"Actividad", "portal_selector":"#txtGiro"},
    {"id":"notas_tablas",         "label":"Notas para tablas (autorizados, productos, maquinaria, transporte, personal)", "type":"textarea", "required":false, "section":"Notas para llenar a mano", "portal_skip":true, "portal_show_in_panel":true}
  ]'::jsonb,
  '["cedula_rfc","ine","comprobante_domicilio"]'::jsonb
)
on conflict (code) do update
  set name=excluded.name, apartado=excluded.apartado, output_type=excluded.output_type,
      portal_url=excluded.portal_url, field_schema=excluded.field_schema,
      source_docs=excluded.source_docs, active=true;

-- =========================================================================
-- CERT-DIGITAL — Solicitud de Certificado Digital
-- Portal: pantalla de Solicitud de Certificado Digital del IMSS
-- Nota: este portal usa códigos de estado distintos a AFIL (AS, BC, BS, CC...
--       en lugar de AGS, BCN, BCS, CAMP). El input acepta el código directo.
-- =========================================================================
insert into public.tramite_types (code, name, apartado, output_type, field_schema, source_docs)
values (
  'cert-digital',
  'Certificado Digital · Solicitud',
  2,
  'extension',
  '[
    {"id":"registro_patronal",    "label":"Registro patronal (NRP)",                      "type":"text",     "required":true,  "section":"Identificación", "source_doc":"tip", "portal_selector":"[name=\"DN_OU\"]"},
    {"id":"digito_verificador",   "label":"Dígito verificador del NRP",                   "type":"text",     "required":false, "section":"Identificación", "portal_selector":"[name=\"digitoVerificadorNRP\"]"},
    {"id":"razon_social",         "label":"Razón social o nombre completo",               "type":"text",     "required":true,  "section":"Identificación", "source_doc":"acta_constitutiva", "portal_selector":"[name=\"DN_O\"]"},
    {"id":"rfc",                  "label":"RFC (sin homoclave)",                          "type":"text",     "required":true,  "section":"Identificación", "source_doc":"cedula_rfc", "portal_selector":"[name=\"RFCA\"]"},
    {"id":"homoclave_rfc",        "label":"Homoclave del RFC",                            "type":"text",     "required":true,  "section":"Identificación", "source_doc":"cedula_rfc", "portal_selector":"[name=\"RFCB\"]"},
    {"id":"usuario",              "label":"Usuario (login)",                              "type":"text",     "required":true,  "section":"Identificación", "portal_selector":"[name=\"LOGIN\"]"},

    {"id":"telefono",             "label":"Teléfono",                                     "type":"text",     "required":false, "section":"Contacto", "portal_selector":"[name=\"DN_PHONE\"]"},
    {"id":"fax",                  "label":"Fax",                                          "type":"text",     "required":false, "section":"Contacto", "portal_selector":"[name=\"DN_FAX\"]"},
    {"id":"correo",               "label":"Correo electrónico",                           "type":"text",     "required":true,  "section":"Contacto", "portal_selector":"[name=\"DN_E\"]"},
    {"id":"correo_confirmacion",  "label":"Confirmar correo electrónico",                 "type":"text",     "required":true,  "section":"Contacto", "portal_selector":"[name=\"confirmaCorreo\"]"},

    {"id":"rol_solicitante",      "label":"Rol del solicitante",                          "type":"select",   "required":true,  "section":"Solicitante",
      "options":["Patrón","Sujeto Obligado","Representante Legal"],
      "portal_selector":"[name=\"rolSolicitante\"]", "portal_option_match":"text"},
    {"id":"nombre_rep",           "label":"Nombre(s) del representante",                  "type":"text",     "required":false, "section":"Solicitante", "source_doc":"ine", "portal_selector":"[name=\"REP_NOMBRES\"]"},
    {"id":"apellido_paterno_rep", "label":"Apellido paterno",                             "type":"text",     "required":false, "section":"Solicitante", "source_doc":"ine", "portal_selector":"[name=\"REP_APE_PAT\"]"},
    {"id":"apellido_materno_rep", "label":"Apellido materno",                             "type":"text",     "required":false, "section":"Solicitante", "source_doc":"ine", "portal_selector":"[name=\"REP_APE_MAT\"]"},
    {"id":"curp_rep",             "label":"CURP del representante",                       "type":"text",     "required":false, "section":"Solicitante", "source_doc":"ine", "portal_selector":"[name=\"DN_T\"]"},
    {"id":"rfc_rep",              "label":"RFC del representante",                        "type":"text",     "required":false, "section":"Solicitante", "portal_selector":"[name=\"RFC_RL\"]"},

    {"id":"calle",                "label":"Calle",                                        "type":"text",     "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio", "portal_selector":"[name=\"calle\"]"},
    {"id":"numero_exterior",      "label":"Número exterior",                              "type":"text",     "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio", "portal_selector":"[name=\"numeroExterior\"]"},
    {"id":"numero_interior",      "label":"Número interior",                              "type":"text",     "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio", "portal_selector":"[name=\"numeroInterior\"]"},
    {"id":"colonia",              "label":"Colonia",                                      "type":"text",     "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio", "portal_selector":"[name=\"col\"]"},
    {"id":"estado",               "label":"Estado",                                       "type":"text",     "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio", "portal_selector":"[name=\"DN_S\"]", "portal_option_match":"text"},
    {"id":"municipio",            "label":"Municipio",                                    "type":"text",     "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio", "portal_selector":"#MUNICIPIO", "portal_option_match":"text", "portal_chain":{"parent":"estado"}},
    {"id":"localidad",            "label":"Localidad",                                    "type":"text",     "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio", "portal_selector":"[name=\"DN_L\"]"},
    {"id":"codigo_postal",        "label":"Código postal",                                "type":"text",     "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio", "portal_selector":"[name=\"DN_POSTALCODE\"]"}
  ]'::jsonb,
  '["tip","cedula_rfc","ine","comprobante_domicilio"]'::jsonb
)
on conflict (code) do update
  set name=excluded.name, apartado=excluded.apartado, output_type=excluded.output_type,
      portal_url=excluded.portal_url, field_schema=excluded.field_schema,
      source_docs=excluded.source_docs, active=true;
-- Actualiza AFIL-01 al field_schema que matchea el PDF oficial (assets/formatos/afil-01.pdf)
-- y agrega AM-SRT (assets/formatos/am-srt.pdf). Ambos generan PDF mediante overlay
-- sobre el PDF base + JSON de coordenadas — calibrar coords sin tocar código.

-- =========================================================================
-- AFIL-01 — Aviso de Inscripción Patronal o de Modificación en su Registro
-- =========================================================================
update public.tramite_types
set field_schema = '[
  {"id":"fecha_solicitud",   "label":"Fecha de solicitud del trámite",     "type":"date",     "required":true,  "section":"Encabezado"},

  {"id":"causa_aviso",       "label":"Causa de presentación del aviso",     "type":"select",   "required":true,  "section":"Encabezado",
    "options":["A","B","C","D","E","F","G","H"],
    "placeholder":"A=Alta · B=Reanudación · C=Cambio domicilio · D=Cambio nombre · E=Sustitución · F=Duplicidad · G=Baja · H=Huelga"},

  {"id":"razon_social",      "label":"Nombre, denominación o razón social", "type":"text",     "required":false, "section":"Datos generales", "source_doc":"acta_constitutiva"},
  {"id":"nombre",            "label":"Nombre(s) (solo persona física)",     "type":"text",     "required":false, "section":"Datos generales", "source_doc":"ine"},
  {"id":"apellido_paterno",  "label":"Primer apellido (solo persona física)","type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},
  {"id":"apellido_materno",  "label":"Segundo apellido (solo persona física)","type":"text",   "required":false, "section":"Datos generales", "source_doc":"ine"},
  {"id":"rfc",               "label":"RFC con homoclave",                    "type":"text",    "required":true,  "section":"Datos generales", "source_doc":"cedula_rfc"},
  {"id":"curp",              "label":"CURP (solo persona física)",           "type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},
  {"id":"clase_riesgo",      "label":"Clase de riesgo manifestada",          "type":"select",  "required":false, "section":"Datos generales", "options":["I","II","III","IV","V"]},
  {"id":"registro_patronal", "label":"Número de registro patronal (si aplica)","type":"text",  "required":false, "section":"Datos generales", "source_doc":"tip"},
  {"id":"fraccion",          "label":"Fracción",                             "type":"text",    "required":false, "section":"Datos generales"},
  {"id":"actividad_giro",    "label":"Actividad o giro de la empresa",       "type":"text",    "required":false, "section":"Datos generales"},
  {"id":"prima",             "label":"Prima",                                "type":"text",    "required":false, "section":"Datos generales"},
  {"id":"fecha_causa",       "label":"Fecha de la causa del aviso",          "type":"date",    "required":false, "section":"Datos generales"},

  {"id":"codigo_postal",     "label":"Código postal",                        "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"calle",             "label":"Calle",                                "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"numero_exterior",   "label":"Número exterior",                      "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"numero_interior",   "label":"Número interior",                      "type":"text",    "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"colonia",           "label":"Colonia",                              "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"localidad",         "label":"Localidad (opcional)",                 "type":"text",    "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"municipio",         "label":"Municipio o alcaldía",                 "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"estado",            "label":"Estado",                               "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"telefono",          "label":"Teléfono fijo (lada y número, opcional)","type":"text",  "required":false, "section":"Domicilio"},
  {"id":"correo",            "label":"Correo electrónico (opcional)",        "type":"text",    "required":false, "section":"Domicilio"},

  {"id":"no_notaria",        "label":"No. de notaría",                       "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva"},
  {"id":"no_acta",           "label":"No. de acta",                          "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva"},
  {"id":"no_libro",          "label":"No. de libro",                         "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva"},
  {"id":"no_foja",           "label":"No. de foja",                          "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva"},
  {"id":"registro_publico",  "label":"Registro Público de la Propiedad",     "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva"},
  {"id":"informacion_adicional","label":"Información adicional",             "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)"},
  {"id":"lugar_fecha_constitucion","label":"Lugar y fecha de constitución",  "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva"}
]'::jsonb,
  source_docs = '["cedula_rfc","acta_constitutiva","ine","comprobante_domicilio","tip"]'::jsonb,
  name = 'AFIL-01 · Aviso de Inscripción Patronal o de Modificación',
  output_type = 'pdf'
where code = 'afil-01';

-- =========================================================================
-- AM-SRT — Aviso de modificación de empresas para el Seguro de Riesgos de Trabajo
-- =========================================================================
insert into public.tramite_types (code, name, apartado, output_type, field_schema, source_docs)
values (
  'am-srt',
  'AM-SRT · Aviso de modificación · Seguro de Riesgos de Trabajo',
  1,
  'pdf',
  '[
    {"id":"fecha_presentacion", "label":"Fecha de presentación de este aviso",  "type":"date",    "required":true,  "section":"Encabezado"},
    {"id":"fecha_modificacion", "label":"Fecha a partir de la cual surte efecto","type":"date",    "required":true,  "section":"Encabezado"},

    {"id":"razon_social",       "label":"Denominación o razón social (persona moral)","type":"text","required":false,"section":"Datos generales", "source_doc":"acta_constitutiva"},
    {"id":"nombre",             "label":"Nombre(s) (persona física)",           "type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},
    {"id":"apellido_paterno",   "label":"Primer apellido (persona física)",     "type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},
    {"id":"apellido_materno",   "label":"Segundo apellido (persona física)",    "type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},
    {"id":"curp",               "label":"CURP (persona física)",                "type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},

    {"id":"registro_patronal",  "label":"Registro patronal actual",             "type":"text",    "required":true,  "section":"Clasificación actual", "source_doc":"tip"},
    {"id":"rfc",                "label":"RFC con homoclave",                    "type":"text",    "required":true,  "section":"Clasificación actual", "source_doc":"cedula_rfc"},
    {"id":"division",           "label":"División",                             "type":"text",    "required":false, "section":"Clasificación actual"},
    {"id":"grupo",              "label":"Grupo",                                "type":"text",    "required":false, "section":"Clasificación actual"},
    {"id":"fraccion",           "label":"Fracción",                             "type":"text",    "required":false, "section":"Clasificación actual"},
    {"id":"clase",              "label":"Clase",                                "type":"select",  "required":false, "section":"Clasificación actual", "options":["I","II","III","IV","V"]},
    {"id":"prima_srt",          "label":"Prima SRT",                            "type":"text",    "required":false, "section":"Clasificación actual"},

    {"id":"tipo_modificacion",  "label":"Tipo de modificación",                 "type":"select",  "required":true,  "section":"Tipo de modificación",
      "options":["reanudacion","cambio_domicilio","cambio_actividad","cambio_ley_racerf","incorporacion_actividades","escision","sustitucion_patronal","fusion","compra_activos","comodato","enajenacion","arrendamiento","fideicomiso"]},
    {"id":"delegacion_baja",    "label":"Delegación de la baja (si aplica)",    "type":"text",    "required":false, "section":"Datos de la baja"},
    {"id":"subdelegacion_baja", "label":"Subdelegación de la baja (si aplica)", "type":"text",    "required":false, "section":"Datos de la baja"},
    {"id":"fecha_baja",         "label":"Fecha de la baja (si aplica)",         "type":"date",    "required":false, "section":"Datos de la baja"},

    {"id":"calle",              "label":"Calle del nuevo domicilio",            "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"numero_exterior",    "label":"Número exterior",                      "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"numero_interior",    "label":"Número interior",                      "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"entre_calles",       "label":"Entre qué calles",                     "type":"text",    "required":false, "section":"Cambio de domicilio"},
    {"id":"calle_posterior",    "label":"Calle posterior",                      "type":"text",    "required":false, "section":"Cambio de domicilio"},
    {"id":"colonia",            "label":"Colonia",                              "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"localidad",          "label":"Localidad (opcional)",                 "type":"text",    "required":false, "section":"Cambio de domicilio"},
    {"id":"municipio",          "label":"Municipio o alcaldía",                 "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"estado",             "label":"Estado",                               "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"codigo_postal",      "label":"Código postal",                        "type":"text",    "required":false, "section":"Cambio de domicilio", "source_doc":"comprobante_domicilio"},
    {"id":"telefono_1",         "label":"Teléfono fijo 1 (lada+número)",        "type":"text",    "required":false, "section":"Cambio de domicilio"},
    {"id":"telefono_2",         "label":"Teléfono fijo 2 (lada+número)",        "type":"text",    "required":false, "section":"Cambio de domicilio"},
    {"id":"correo",             "label":"Correo electrónico",                   "type":"text",    "required":false, "section":"Cambio de domicilio"},

    {"id":"giro",               "label":"Especificar giro / actividad",         "type":"textarea","required":false, "section":"Actividad declarada", "source_doc":"acta_constitutiva"},
    {"id":"presta_servicios_personal", "label":"¿Presta servicios de personal?","type":"select", "required":false, "section":"Actividad declarada", "options":["si","no"]}
  ]'::jsonb,
  '["tip","cedula_rfc","acta_constitutiva","ine","comprobante_domicilio"]'::jsonb
)
on conflict (code) do update
  set name = excluded.name,
      apartado = excluded.apartado,
      output_type = excluded.output_type,
      field_schema = excluded.field_schema,
      source_docs = excluded.source_docs,
      active = true;
-- AFIL-01: agrega sub-formularios condicionales por causa (página 2 del PDF).
--
-- Cada causa A-H tiene una fila distinta en "Instrucciones para el patrón"
-- con sus propios campos. Marcamos cada campo con show_if = { causa_aviso: X }
-- para que el form los muestre solo cuando la causa elegida sea la que aplica.
-- Campos del acta constitutiva (no_notaria, etc.) ya estaban — se marcan como
-- show_if A,B,D,E porque solo aplican para esas causas.

update public.tramite_types
set field_schema = '[
  {"id":"fecha_solicitud",   "label":"Fecha de solicitud del trámite",     "type":"date",     "required":true,  "section":"Encabezado"},

  {"id":"causa_aviso",       "label":"Causa de presentación del aviso",     "type":"select",   "required":true,  "section":"Encabezado",
    "options":["A","B","C","D","E","F","G","H"],
    "placeholder":"A=Alta · B=Reanudación · C=Cambio domicilio · D=Cambio nombre · E=Sustitución · F=Duplicidad · G=Baja · H=Huelga"},

  {"id":"razon_social",      "label":"Nombre, denominación o razón social", "type":"text",     "required":false, "section":"Datos generales", "source_doc":"acta_constitutiva"},
  {"id":"nombre",            "label":"Nombre(s) (solo persona física)",     "type":"text",     "required":false, "section":"Datos generales", "source_doc":"ine"},
  {"id":"apellido_paterno",  "label":"Primer apellido (solo persona física)","type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},
  {"id":"apellido_materno",  "label":"Segundo apellido (solo persona física)","type":"text",   "required":false, "section":"Datos generales", "source_doc":"ine"},
  {"id":"rfc",               "label":"RFC con homoclave",                    "type":"text",    "required":true,  "section":"Datos generales", "source_doc":"cedula_rfc"},
  {"id":"curp",              "label":"CURP (solo persona física)",           "type":"text",    "required":false, "section":"Datos generales", "source_doc":"ine"},
  {"id":"clase_riesgo",      "label":"Clase de riesgo manifestada",          "type":"select",  "required":false, "section":"Datos generales", "options":["I","II","III","IV","V"]},
  {"id":"registro_patronal", "label":"Número de registro patronal (si aplica)","type":"text",  "required":false, "section":"Datos generales", "source_doc":"tip"},
  {"id":"fraccion",          "label":"Fracción",                             "type":"text",    "required":false, "section":"Datos generales"},
  {"id":"actividad_giro",    "label":"Actividad o giro de la empresa",       "type":"text",    "required":false, "section":"Datos generales"},
  {"id":"prima",             "label":"Prima",                                "type":"text",    "required":false, "section":"Datos generales"},
  {"id":"fecha_causa",       "label":"Fecha de la causa del aviso",          "type":"date",    "required":false, "section":"Datos generales"},

  {"id":"codigo_postal",     "label":"Código postal",                        "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"calle",             "label":"Calle",                                "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"numero_exterior",   "label":"Número exterior",                      "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"numero_interior",   "label":"Número interior",                      "type":"text",    "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"colonia",           "label":"Colonia",                              "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"localidad",         "label":"Localidad (opcional)",                 "type":"text",    "required":false, "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"municipio",         "label":"Municipio o alcaldía",                 "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"estado",            "label":"Estado",                               "type":"text",    "required":true,  "section":"Domicilio", "source_doc":"comprobante_domicilio"},
  {"id":"telefono",          "label":"Teléfono fijo (lada y número, opcional)","type":"text",  "required":false, "section":"Domicilio"},
  {"id":"correo",            "label":"Correo electrónico (opcional)",        "type":"text",    "required":false, "section":"Domicilio"},

  {"id":"no_notaria",        "label":"No. de notaría",                       "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},
  {"id":"no_acta",           "label":"No. de acta",                          "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},
  {"id":"no_libro",          "label":"No. de libro",                         "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},
  {"id":"no_foja",           "label":"No. de foja",                          "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},
  {"id":"registro_publico",  "label":"Registro Público de la Propiedad",     "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},
  {"id":"informacion_adicional","label":"Información adicional",             "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},
  {"id":"lugar_fecha_constitucion","label":"Lugar y fecha de constitución",  "type":"text",    "required":false, "section":"Acta constitutiva (causas A, B, D, E)", "source_doc":"acta_constitutiva", "show_if":{"campo":"causa_aviso","en":["A","B","D","E"]}},

  {"id":"causa_b_nombre_anterior",   "label":"Nombre, denominación o razón social del patrón o sujeto obligado", "type":"text", "required":false, "section":"Causa B · Reanudación de actividades", "show_if":{"campo":"causa_aviso","igual":"B"}},
  {"id":"causa_b_registro_anterior", "label":"Número de registro patronal", "type":"text", "required":false, "section":"Causa B · Reanudación de actividades", "source_doc":"tip", "show_if":{"campo":"causa_aviso","igual":"B"}},

  {"id":"causa_c_cp_anterior",        "label":"Código postal anterior",       "type":"text", "required":false, "section":"Causa C · Cambio de domicilio o circunscripción", "show_if":{"campo":"causa_aviso","igual":"C"}},
  {"id":"causa_c_calle_anterior",     "label":"Calle anterior",               "type":"text", "required":false, "section":"Causa C · Cambio de domicilio o circunscripción", "show_if":{"campo":"causa_aviso","igual":"C"}},
  {"id":"causa_c_num_ext_int_anterior","label":"Número exterior e interior anterior","type":"text","required":false,"section":"Causa C · Cambio de domicilio o circunscripción","show_if":{"campo":"causa_aviso","igual":"C"}},
  {"id":"causa_c_colonia_anterior",   "label":"Colonia anterior",             "type":"text", "required":false, "section":"Causa C · Cambio de domicilio o circunscripción", "show_if":{"campo":"causa_aviso","igual":"C"}},
  {"id":"causa_c_municipio_anterior", "label":"Municipio o alcaldía anterior","type":"text", "required":false, "section":"Causa C · Cambio de domicilio o circunscripción", "show_if":{"campo":"causa_aviso","igual":"C"}},
  {"id":"causa_c_estado_anterior",    "label":"Estado anterior",              "type":"text", "required":false, "section":"Causa C · Cambio de domicilio o circunscripción", "show_if":{"campo":"causa_aviso","igual":"C"}},

  {"id":"causa_d_nombre_anterior",    "label":"Nombre, denominación o razón social anterior", "type":"text", "required":false, "section":"Causa D · Cambio de nombre o razón social", "show_if":{"campo":"causa_aviso","igual":"D"}},

  {"id":"causa_e_nombre_sustituido",  "label":"Nombre, denominación o razón social del patrón sustituido", "type":"text", "required":false, "section":"Causa E · Sustitución patronal", "show_if":{"campo":"causa_aviso","igual":"E"}},
  {"id":"causa_e_registro_sustituido","label":"Número de registro patronal del patrón sustituido", "type":"text", "required":false, "section":"Causa E · Sustitución patronal", "show_if":{"campo":"causa_aviso","igual":"E"}},

  {"id":"causa_f_registro_1", "label":"Registro 1", "type":"text", "required":false, "section":"Causa F · Duplicidad", "show_if":{"campo":"causa_aviso","igual":"F"}},
  {"id":"causa_f_registro_2", "label":"Registro 2", "type":"text", "required":false, "section":"Causa F · Duplicidad", "show_if":{"campo":"causa_aviso","igual":"F"}},

  {"id":"causa_g_motivo",     "label":"Motivo de la baja", "type":"textarea", "required":false, "section":"Causa G · Baja", "show_if":{"campo":"causa_aviso","igual":"G"}}
]'::jsonb,
  source_docs = '["cedula_rfc","acta_constitutiva","ine","comprobante_domicilio","tip"]'::jsonb
where code = 'afil-01';
