import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { buscarFraccion } from "@/lib/catalogo-imss";

// Sugerencias de procesos de trabajo (IV.6 del AM-SRT) — generadas con Haiku
// a partir de la fracción, giro, productos elaborados y materias primas.
//
// El usuario puede pedir UNA sola sección a la vez (principales, intermedios
// o finales) para no regenerar las otras dos cuando solo quiere cambiar
// una. Devuelve una lista de 3-5 items en MAYÚSCULAS.

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-haiku-4-5";

type Body = {
  fraccion?: string;
  giro?: string;
  productos?: string;
  materias?: string;
  seccion?: "principales" | "intermedios" | "finales";
};

const DESCRIPCION_SECCION: Record<NonNullable<Body["seccion"]>, string> = {
  principales:
    "Procesos PRINCIPALES — las operaciones de inicio del trabajo, donde se preparan los insumos o el sitio (excavación, recepción de materia prima, corte, preparación, etc.).",
  intermedios:
    "Procesos INTERMEDIOS — las operaciones del cuerpo del trabajo, donde se transforma o combina lo preparado (armado, mezclado, ensamble, colado, fundición, costura, etc.).",
  finales:
    "Procesos FINALES — las operaciones de cierre, acabado y entrega (pulido, pintura, empaque, limpieza, inspección, entrega, etc.).",
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const fraccion = (body?.fraccion ?? "").trim();
  const giro = (body?.giro ?? "").trim();
  const productos = (body?.productos ?? "").trim();
  const materias = (body?.materias ?? "").trim();
  const seccion = body?.seccion;

  if (!seccion || !DESCRIPCION_SECCION[seccion]) {
    return NextResponse.json(
      { error: "Falta `seccion` (principales, intermedios o finales)." },
      { status: 400 }
    );
  }
  if (!fraccion && !giro && !productos && !materias) {
    return NextResponse.json(
      { error: "Manda al menos fracción, giro, productos o materias primas." },
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

  const hit = fraccion ? buscarFraccion(fraccion) : null;
  const contexto = [
    hit
      ? `División ${hit.divisionCodigo}: ${hit.divisionNombre}\nGrupo ${hit.grupoCodigo}: ${hit.grupoNombre}\nFracción ${hit.fraccionCodigo}: ${hit.fraccionTitulo}\nClase: ${hit.claseCodigo} (${hit.claseNombre})\nDescripción legal: ${hit.fraccionDescripcionLegal}`
      : fraccion
      ? `Fracción IMSS: ${fraccion}`
      : "",
    giro ? `Giro: ${giro}` : "",
    productos ? `Productos elaborados o servicios prestados: ${productos}` : "",
    materias ? `Materias primas y materiales: ${materias}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const systemPrompt = `Eres un asistente experto en clasificación de empresas IMSS.

Tu tarea: dado el contexto de una empresa (fracción, giro, productos, materias
primas), describir en un PÁRRAFO CORRIDO los procesos de trabajo de la sección
solicitada.

${DESCRIPCION_SECCION[seccion]}

Reglas:
  1. UN solo párrafo corrido (no listas, no bullets, no saltos de línea).
  2. Entre 200 y 400 caracteres aproximadamente. Cabe en 5 renglones del
     formato IMSS.
  3. Texto en MAYÚSCULAS, con espacios entre palabras.
  4. Estilo descriptivo y natural — "SE RECIBE LA MATERIA PRIMA, SE
     INSPECCIONA Y SE CLASIFICA POR LOTES. SE PREPARA EL ÁREA DE TRABAJO Y
     SE ALIMENTA LA MAQUINARIA SEGÚN EL PROGRAMA DEL DÍA."
  5. Específico al giro y a la sección — no mezcles fases.
  6. Responde EXCLUSIVAMENTE un objeto JSON sin markdown:
     {"text": "PÁRRAFO EN MAYÚSCULAS..."}`;

  const userPrompt = `${contexto}\n\nDevuelve JSON con el párrafo de procesos ${seccion.toUpperCase()}.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const respuesta = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
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

    const obj = JSON.parse(limpio) as { text?: unknown };
    const text = typeof obj.text === "string" ? obj.text.trim().toUpperCase() : "";

    return NextResponse.json({ seccion, text });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
