import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import {
  construirPromptSistema,
  obtenerDocType,
  parsearRespuestaIA,
} from "@/lib/extraccion";
import { getServiceRoleClient } from "@/lib/supabase/server";

// API route que toma un document.id, descarga su imagen desde Storage, llama
// a Claude Haiku con un prompt cerrado y guarda los datos extraídos.
//
// Reglas clave (Principio 1.5 y 7.3):
//   - La ANTHROPIC_API_KEY y la SERVICE_ROLE_KEY solo se usan aquí, en el server.
//   - No reintentar en bucle: un error queda como tal y la UI ofrece reintento.

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5";

export async function POST(req: Request) {
  const { documentId } = (await req.json()) as { documentId?: string };
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
  const mediaType = inferMediaType(doc.storage_path, blob.type);

  // 3) Llamar a Claude Haiku con el prompt cerrado.
  const docType = obtenerDocType(doc.doc_type);
  const systemPrompt = construirPromptSistema(docType);

  const anthropic = new Anthropic({ apiKey });

  try {
    const respuesta = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
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

    const datos = parsearRespuestaIA(textoSalida, docType);

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
