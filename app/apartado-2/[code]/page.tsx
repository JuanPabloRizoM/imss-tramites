import Link from "next/link";
import { notFound } from "next/navigation";

import { ApartadoShell } from "@/components/ApartadoShell";
import { getServerClient } from "@/lib/supabase/server";
import type { TramiteType } from "@/lib/tramites";
import { FormularioExtension } from "./FormularioExtension";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return { title: `${code.toUpperCase()} · Trámites IMSS` };
}

export default async function PaginaTramite2({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ source_doc?: string }>;
}) {
  const { code } = await params;
  const { source_doc } = await searchParams;
  const supabase = await getServerClient();

  const { data } = await supabase
    .from("tramite_types")
    .select("id, code, name, apartado, output_type, field_schema, source_docs, active, portal_url")
    .eq("code", code)
    .eq("apartado", 2)
    .maybeSingle();

  if (!data) notFound();
  const tramiteType = data as TramiteType & { portal_url: string | null };

  // Mismo patrón que /apartado-1/[code]: si vino vía "Llevar a…", trae
  // el extracted_data del documento fuente para precargar el form. El
  // doc_type viaja junto para desempatar campos ambiguos vía source_doc.
  let precarga: Record<string, unknown> | null = null;
  let precargaDocType: string | null = null;
  if (source_doc) {
    const { data: doc } = await supabase
      .from("documents")
      .select("extracted_data, doc_type")
      .eq("id", source_doc)
      .maybeSingle();
    if (doc?.extracted_data) {
      precarga = doc.extracted_data as Record<string, unknown>;
      precargaDocType = (doc.doc_type as string | null) ?? null;
    }
  }

  return (
    <ApartadoShell
      numero={2}
      titulo={tramiteType.name}
      resumen={`Llena/revisa los campos. Cuando los marques "revisado", la extensión los puede pegar en el portal.`}
    >
      <nav className="mb-6 text-sm">
        <Link
          href="/apartado-2"
          className="inline-flex min-h-[44px] items-center gap-2 text-ink-2 hover:text-ink"
        >
          <span aria-hidden="true">←</span>
          Otros trámites
        </Link>
      </nav>

      <FormularioExtension
        tramiteType={tramiteType}
        precarga={precarga}
        precargaDocType={precargaDocType}
      />
    </ApartadoShell>
  );
}
