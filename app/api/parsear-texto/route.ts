import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import type { CampoSchema } from "@/lib/tramites";

// API route que toma un texto libre (notas del personal, lo que el cliente
// dictó, un fragmento copiado de un expediente, etc.) y lo mapea contra el
// field_schema de un trámite. Devuelve solo los valores reconocidos.
//
// Reglas:
//   - La ANTHROPIC_API_KEY solo se usa aquí, en el server.
//   - No reintentar en bucle: un error es un error y la UI ofrece reintento.

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-haiku-4-5";

type Body = {
  texto?: string;
  schema?: CampoSchema[];
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const texto = (body.texto ?? "").trim();
  const schema = body.schema ?? [];

  if (!texto) {
    return NextResponse.json({ error: "Falta texto." }, { status: 400 });
  }
  if (schema.length === 0) {
    return NextResponse.json({ error: "Falta schema." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  const systemPrompt = construirPrompt(schema);
  const anthropic = new Anthropic({ apiKey });

  try {
    const respuesta = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Texto del usuario:\n\n${texto}\n\nDevuelve solo el JSON.`,
            },
          ],
        },
      ],
    });

    const textoSalida = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const valores = parsearRespuesta(textoSalida, schema);
    return NextResponse.json({ ok: true, values: valores });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}

function construirPrompt(schema: CampoSchema[]): string {
  const campos = schema
    .map((c) => {
      const opts =
        c.options && c.options.length > 0
          ? ` — valores permitidos: ${c.options.map((o) => `"${o}"`).join(", ")}`
          : "";
      const tipo = ` [${c.type}]`;
      return `- ${c.id}${tipo} — ${c.label}${opts}`;
    })
    .join("\n");

  return `Eres un asistente del IMSS que extrae datos de notas de texto libre.
El usuario te pega un fragmento (notas a mano transcritas, un párrafo de un
expediente, lo que dictó un cliente). Tu tarea es identificar qué campos del
formulario aparecen en ese texto y devolver sus valores.

Campos del formulario (identificador [tipo] — etiqueta):
${campos}

Reglas estrictas:
1. Responde EXCLUSIVAMENTE con un objeto JSON. Sin markdown, sin \`\`\`, sin
   texto antes o después.
2. Las claves del JSON son los identificadores de la lista de arriba. NO
   inventes claves nuevas.
3. Los valores son strings. Si un campo NO aparece en el texto o no estás
   seguro, OMITE la clave (no la pongas como null, no la pongas como ""). Es
   mejor no rellenar que adivinar.
4. Para campos [date] usa formato AAAA-MM-DD (es el formato que espera el
   input HTML).
5. Para campos [select] el valor DEBE ser exactamente uno de los valores
   permitidos. Si el texto no menciona uno claramente, omite la clave.
6. Para campos [number] devuelve solo dígitos.
7. NO normalices a mayúsculas ni cambies el formato del nombre — devuelve el
   valor como aparece en el texto. La UI normaliza después.

Ejemplo de salida:
{"nombre":"Juan Pérez","rfc":"PERJ800101ABC","fecha_nacimiento":"1980-01-01"}`;
}

function parsearRespuesta(
  texto: string,
  schema: CampoSchema[]
): Record<string, string> {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const obj = JSON.parse(limpio) as Record<string, unknown>;
  const idsValidos = new Set(schema.map((c) => c.id));
  const out: Record<string, string> = {};

  for (const [k, v] of Object.entries(obj)) {
    if (!idsValidos.has(k)) continue;
    if (v == null) continue;
    const s = String(v).trim();
    if (s === "") continue;
    out[k] = s;
  }

  return out;
}
