import { NextResponse } from "next/server";

import { generarPDF } from "@/lib/pdf";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { TramiteType } from "@/lib/tramites";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { tramite_type_code?: string; field_values?: Record<string, string> }
    | null;

  const code = body?.tramite_type_code;
  const values = body?.field_values ?? {};
  if (!code) {
    return NextResponse.json(
      { error: "Falta tramite_type_code." },
      { status: 400 }
    );
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("tramite_types")
    .select("id, code, name, apartado, output_type, field_schema, source_docs, portal_url, active")
    .eq("code", code)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Trámite no encontrado." },
      { status: 404 }
    );
  }

  try {
    const bytes = await generarPDF(data as TramiteType, values);
    const arrayBuffer = (bytes.buffer as ArrayBuffer).slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    );
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${code}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
