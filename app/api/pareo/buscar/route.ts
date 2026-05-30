import { NextResponse } from "next/server";

import { codigoValido, normalizarCodigo } from "@/lib/pareo";
import { getServiceRoleClient } from "@/lib/supabase/server";

// Busca una sesión por código (input del celular). Case-insensitive. Solo
// devuelve sesiones activas. Rate-limit del lado del celular (5 intentos
// fallidos → 30 s de espera) — no aquí, porque es un lookup barato y la
// abuso vendría más bien del lado de probar códigos al azar; lo controla
// la UI del celular.

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const code = normalizarCodigo(body?.code ?? "");
  if (!codigoValido(code)) {
    return NextResponse.json(
      { error: "El código debe ser 4 caracteres (sin 0, O, 1, I, L)." },
      { status: 400 }
    );
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, code, active")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Código no encontrado. Verifica con la computadora." },
      { status: 404 }
    );
  }

  return NextResponse.json({ id: data.id, code: data.code });
}
