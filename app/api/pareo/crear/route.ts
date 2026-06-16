import { NextResponse } from "next/server";

import { generarCodigo } from "@/lib/pareo";
import { getServiceRoleClient } from "@/lib/supabase/server";

// Crea una sesión nueva para una pestaña de computadora. Genera código
// único (reintenta hasta 3 veces si choca con el UNIQUE constraint).

export const runtime = "nodejs";

const MAX_INTENTOS_CODIGO = 3;

export async function POST(req: Request) {
  const supabase = getServiceRoleClient();

  // Opcional: la sesión puede apuntar a un trámite (captura dirigida desde
  // el celular). Se guarda atómicamente en el insert para que el celular lo
  // vea apenas se conecte. Ver migración 0025.
  const body = (await req.json().catch(() => null)) as {
    target_tramite?: { code?: string; name?: string } | null;
  } | null;
  const tt = body?.target_tramite;
  const target_tramite =
    tt && typeof tt.code === "string" && typeof tt.name === "string"
      ? { code: tt.code, name: tt.name }
      : null;

  for (let i = 0; i < MAX_INTENTOS_CODIGO; i++) {
    const code = generarCodigo();
    const { data, error } = await supabase
      .from("sessions")
      .insert({ code, target_tramite })
      .select("id, code, target_tramite")
      .single();

    if (!error && data) {
      return NextResponse.json({
        id: data.id,
        code: data.code,
        target_tramite: data.target_tramite,
      });
    }
    // 23505 = unique_violation. Solo reintentamos en ese caso.
    const codigoError =
      (error as { code?: string } | null)?.code ?? "";
    if (codigoError !== "23505") {
      return NextResponse.json(
        { error: error?.message ?? "No se pudo crear la sesión." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    {
      error:
        "No se pudo generar un código único después de varios intentos. Intenta de nuevo.",
    },
    { status: 500 }
  );
}
