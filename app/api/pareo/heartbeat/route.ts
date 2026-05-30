import { NextResponse } from "next/server";

import { getServiceRoleClient } from "@/lib/supabase/server";

// Heartbeat de la pestaña de computadora. Solo actualiza last_seen_at.

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { sessionId?: string }
    | null;
  const sessionId = body?.sessionId;
  if (!sessionId) {
    return NextResponse.json({ error: "Falta sessionId." }, { status: 400 });
  }

  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from("sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
