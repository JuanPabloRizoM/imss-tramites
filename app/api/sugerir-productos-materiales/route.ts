import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { buscarFraccion } from "@/lib/catalogo-imss";

// Devuelve sugerencias de Productos/Servicios y Materias Primas para llenar
// las tablas IV.1 y IV.2 del AM-SRT. Combina el catálogo del art. 196 RACERF
// (fracción + descripción legal) con un texto libre opcional del usuario
// (giro) y le pide a Haiku 4.5 listas cortas de 5–10 elementos.
//
// El usuario puede editar la sugerencia antes de meterla al PDF.

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-haiku-4-5";

type Body = {
  fraccion?: string;
  giro?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const fraccion = (body?.fraccion ?? "").trim();
  const giro = (body?.giro ?? "").trim();

  if (!fraccion && !giro) {
    return NextResponse.json(
      { error: "Manda al menos `fraccion` o `giro` para generar sugerencias." },
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

  // Contexto: descripción legal del RACERF si la fracción es válida.
  const hit = fraccion ? buscarFraccion(fraccion) : null;
  const contexto = hit
    ? [
        `División ${hit.divisionCodigo}: ${hit.divisionNombre}`,
        `Grupo ${hit.grupoCodigo}: ${hit.grupoNombre}`,
        `Fracción ${hit.fraccionCodigo}: ${hit.fraccionTitulo}`,
        `Clase de riesgo: ${hit.claseCodigo} (${hit.claseNombre})`,
        `Descripción legal (RACERF): ${hit.fraccionDescripcionLegal}`,
      ].join("\n")
    : `Fracción IMSS (sin match en catálogo): ${fraccion || "—"}`;

  const giroExtra = giro ? `\n\nGiro/actividad declarado por el patrón: ${giro}` : "";

  const systemPrompt = `Eres un asistente experto en clasificación de empresas IMSS.

Tu tarea: dado un giro/actividad de una empresa, sugerir:
  - "productos": 5–10 PRODUCTOS elaborados o SERVICIOS prestados típicos.
  - "materias_primas": 5–10 MATERIAS PRIMAS o MATERIALES típicos.

Reglas:
  1. Items cortos (2–4 palabras), en MAYÚSCULAS, sustantivos genéricos (sin
     marcas comerciales).
  2. Específicos del giro — nada de items que aplicarían a cualquier
     empresa ("luz", "internet", "papelería"). Sí items propios del
     sector ("varilla", "cemento", "encofrado" para construcción).
  3. Si la actividad es de SERVICIOS (no fabrica nada), en "productos" pon
     los tipos de servicio prestados y en "materias_primas" los insumos
     que consume.
  4. Responde EXCLUSIVAMENTE un objeto JSON sin markdown:
     {"productos": ["...", "..."], "materias_primas": ["...", "..."]}.`;

  const userPrompt = `${contexto}${giroExtra}

Devuelve JSON con productos y materias_primas para este giro.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const respuesta = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textoSalida = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const limpio = textoSalida
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    const obj = JSON.parse(limpio) as {
      productos?: unknown;
      materias_primas?: unknown;
    };
    const productos = Array.isArray(obj.productos)
      ? obj.productos.map((x) => String(x).trim()).filter(Boolean).slice(0, 10)
      : [];
    const materias_primas = Array.isArray(obj.materias_primas)
      ? obj.materias_primas.map((x) => String(x).trim()).filter(Boolean).slice(0, 10)
      : [];

    return NextResponse.json({ productos, materias_primas });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
