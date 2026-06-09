import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

import {
  construirPromptSistema,
  esFilaArray,
  obtenerDocType,
  parsearRespuestaIA,
  type DatoExtraido,
} from "@/lib/extraccion";
import { validarValor } from "@/lib/formatos-imss";
import { getServiceRoleClient } from "@/lib/supabase/server";

// API route que toma un document.id, descarga el archivo desde Storage, llama
// a Claude Haiku con un prompt cerrado y guarda los datos extraídos.
//
// Soporta:
//   - Imágenes (JPG, PNG, WebP, GIF): se envían como bloque "image".
//   - PDFs: se envían como bloque "document". Antes de enviar contamos las
//     páginas; si son más de COST_GUARD_PAGES rechazamos el request a menos
//     que el caller mande confirmPdfPages=true (lo decide el usuario).
//
// Reglas clave (Principio 1.5 y 7.3):
//   - La ANTHROPIC_API_KEY y la SERVICE_ROLE_KEY solo se usan aquí, en el server.
//   - No reintentar en bucle: un error queda como tal y la UI ofrece reintento.

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5";
// La API de Anthropic cobra por página de PDF. Más de este umbral exige
// confirmación explícita del usuario para evitar facturas inesperadas.
const COST_GUARD_PAGES = 15;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    documentId?: string;
    confirmPdfPages?: boolean;
    // Extracción dirigida por trámite: el frontend manda los campos del
    // field_schema del trámite que se está llenando. Si llega, sobreescribe
    // los campos default del doc_type — la IA solo busca estos. Los que no
    // encuentre quedan en null (regla 3 del prompt) y no ensucian el form.
    target_fields?: Array<{ id: string; label: string }>;
  };
  const { documentId, confirmPdfPages, target_fields } = body;
  if (!documentId) {
    return NextResponse.json(
      { error: "Falta documentId en el body." },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  const supabase = getServiceRoleClient();

  // 1) Leer la fila del documento.
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, storage_path, doc_type")
    .eq("id", documentId)
    .single();

  if (docErr || !doc) {
    return NextResponse.json(
      { error: "Documento no encontrado." },
      { status: 404 }
    );
  }

  // Marcar procesando.
  await supabase
    .from("documents")
    .update({ extraction_status: "procesando", extraction_error: null })
    .eq("id", documentId);

  // 2) Descargar la imagen del bucket.
  const { data: blob, error: dlErr } = await supabase.storage
    .from("documentos")
    .download(doc.storage_path);

  if (dlErr || !blob) {
    await marcarError(supabase, documentId, "No se pudo descargar la imagen.");
    return NextResponse.json(
      { error: "No se pudo descargar la imagen." },
      { status: 500 }
    );
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const base64 = buffer.toString("base64");
  const esPdf = inferEsPdf(doc.storage_path, blob.type);

  // Guard de costo: PDF con más de COST_GUARD_PAGES exige confirmación
  // explícita del usuario porque Anthropic cobra por página.
  if (esPdf) {
    let paginas = 0;
    try {
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      paginas = pdf.getPageCount();
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : "No se pudo leer el PDF.";
      await marcarError(supabase, documentId, mensaje);
      return NextResponse.json({ error: mensaje }, { status: 400 });
    }
    if (paginas > COST_GUARD_PAGES && !confirmPdfPages) {
      // Dejamos el documento en "pendiente" — el usuario decide.
      await supabase
        .from("documents")
        .update({ extraction_status: "pendiente", extraction_error: null })
        .eq("id", documentId);
      return NextResponse.json(
        {
          error: "pdf_demasiadas_paginas",
          paginas,
          umbral: COST_GUARD_PAGES,
          mensaje: `Este PDF tiene ${paginas} páginas y la extracción se cobra por página (Anthropic). Es ~${paginas}× más caro que una página única. Confirma para procesarlo de todos modos.`,
        },
        { status: 409 }
      );
    }
  }

  // 3) Llamar a Claude Haiku con el prompt cerrado.
  const docType = obtenerDocType(doc.doc_type);
  // Si llegan target_fields desde el trámite, esos sobreescriben los del
  // doc_type. Filtramos vacíos por defensividad.
  const targetCampos = (target_fields ?? []).filter(
    (f) => f && typeof f.id === "string" && f.id && typeof f.label === "string"
  );
  const systemPrompt = construirPromptSistema(
    docType,
    targetCampos.length > 0 ? targetCampos : undefined
  );
  // El parser itera sobre los campos del docType. En extracción dirigida el
  // modelo responde con los ids de target_fields — hay que parsear contra
  // ESOS, no contra los del doc_type, o se tira casi toda la respuesta.
  const docTypeParaParseo =
    targetCampos.length > 0
      ? { ...docType, campos: targetCampos, tabla: undefined }
      : docType;

  const anthropic = new Anthropic({ apiKey });

  const bloqueArchivo = esPdf
    ? ({
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: base64,
        },
      })
    : ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: inferMediaType(doc.storage_path, blob.type),
          data: base64,
        },
      });

  try {
    const respuesta = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            bloqueArchivo,
            {
              type: "text",
              text: "Extrae los campos del documento siguiendo las reglas del sistema. Devuelve solo el JSON.",
            },
          ],
        },
      ],
    });

    const textoSalida = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const datos = parsearRespuestaIA(textoSalida, docTypeParaParseo);

    // Post-validación contra los formatos conocidos (lib/formatos-imss.ts):
    // normaliza (quita espacios/guiones, upcase) y si el valor no cumple el
    // formato (longitud, patrón, dígito verificador) baja la confianza a
    // "bajo" para que el campo se pinte como dudoso en la UI.
    for (const [id, dato] of Object.entries(datos)) {
      if (esFilaArray(dato)) {
        for (const fila of dato) {
          for (const [colId, celda] of Object.entries(fila)) {
            aplicarValidacion(colId, celda);
          }
        }
      } else {
        aplicarValidacion(id, dato);
      }
    }

    await supabase
      .from("documents")
      .update({
        extracted_data: datos,
        extraction_status: "listo",
        extraction_error: null,
      })
      .eq("id", documentId);

    return NextResponse.json({ ok: true, data: datos });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido.";
    await marcarError(supabase, documentId, mensaje);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}

// Muta el dato extraído: guarda el valor normalizado y, si no cumple el
// formato del campo (regex / dígito verificador), baja la confianza.
function aplicarValidacion(fieldId: string, dato: DatoExtraido) {
  if (!dato.valor) return;
  const res = validarValor(fieldId, dato.valor);
  if (!res) return; // campo sin formato conocido (texto libre)
  dato.valor = res.normalizado;
  if (!res.valido) dato.confianza = "bajo";
}

async function marcarError(
  supabase: ReturnType<typeof getServiceRoleClient>,
  documentId: string,
  mensaje: string
) {
  await supabase
    .from("documents")
    .update({
      extraction_status: "error",
      extraction_error: mensaje.slice(0, 1000),
    })
    .eq("id", documentId);
}

function inferMediaType(
  path: string,
  fallback?: string
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (fallback === "image/png") return "image/png";
  if (fallback === "image/webp") return "image/webp";
  if (fallback === "image/gif") return "image/gif";
  return "image/jpeg";
}

function inferEsPdf(path: string, fallback?: string): boolean {
  if (path.toLowerCase().endsWith(".pdf")) return true;
  return fallback === "application/pdf";
}
