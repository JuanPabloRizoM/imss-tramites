import Link from "next/link";
import { notFound } from "next/navigation";

import { ApartadoShell } from "@/components/ApartadoShell";
import { getServerClient } from "@/lib/supabase/server";
import type { TramiteType } from "@/lib/tramites";
import { FormularioTramite } from "./FormularioTramite";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return { title: `${code.toUpperCase()} · Trámites IMSS` };
}

export default async function PaginaTramite({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await getServerClient();

  const { data: tipo } = await supabase
    .from("tramite_types")
    .select("id, code, name, apartado, output_type, field_schema, source_docs, active")
    .eq("code", code)
    .eq("apartado", 1)
    .maybeSingle();

  if (!tipo) notFound();
  const tramiteType = tipo as TramiteType;

  return (
    <ApartadoShell
      numero={1}
      titulo={tramiteType.name}
      resumen={`Llena los campos. Genera un PDF descargable. ${tramiteType.field_schema.length} campos en ${
        new Set(tramiteType.field_schema.map((c) => c.section ?? "Datos")).size
      } secciones.`}
    >
      <nav className="mb-6 text-sm">
        <Link
          href="/apartado-1"
          className="inline-flex min-h-[44px] items-center gap-2 text-ink-2 hover:text-ink"
        >
          <span aria-hidden="true">←</span>
          Otros formatos
        </Link>
      </nav>

      <FormularioTramite tramiteType={tramiteType} />
    </ApartadoShell>
  );
}
