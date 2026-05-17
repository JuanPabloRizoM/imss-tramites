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
