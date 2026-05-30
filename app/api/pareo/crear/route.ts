import { NextResponse } from "next/server";

import { generarCodigo } from "@/lib/pareo";
import { getServiceRoleClient } from "@/lib/supabase/server";

// Crea una sesión nueva para una pestaña de computadora. Genera código
// único (reintenta hasta 3 veces si choca con el UNIQUE constraint).

export const runtime = "nodejs";

const MAX_INTENTOS_CODIGO = 3;

export async function POST() {
  const supabase = getServiceRoleClient();

  for (let i = 0; i < MAX_INTENTOS_CODIGO; i++) {
    const code = generarCodigo();
    const { data, error } = await supabase
      .from("sessions")
      .insert({ code })
      .select("id, code")
      .single();

    if (!error && data) {
      return NextResponse.json({ id: data.id, code: data.code });
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
