import Link from "next/link";
import { notFound } from "next/navigation";

import { ApartadoShell } from "@/components/ApartadoShell";
import { getServerClient } from "@/lib/supabase/server";
import type { TramiteType } from "@/lib/tramites";
import { esEscrito } from "@/lib/delegaciones";
import { VistaTramite } from "./VistaTramite";

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
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ source_doc?: string; delegacion?: string }>;
}) {
  const { code } = await params;
  const { source_doc } = await searchParams;
  const supabase = await getServerClient();

  const { data: tipo } = await supabase
    .from("tramite_types")
    .select(
      "id, code, name, apartado, output_type, field_schema, source_docs, cases, active"
    )
    .eq("code", code)
    .eq("apartado", 1)
    .maybeSingle();

  if (!tipo) notFound();
  const tramiteType = tipo as TramiteType;

  // Si vino con ?source_doc=<uuid>, trae los datos extraídos para precargar
  // el form. Si el doc no existe o no es del usuario, simplemente no
  // precarga — no rompemos el flujo. El doc_type viaja junto para que la
  // precarga desempate campos ambiguos vía el tag source_doc del schema.
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
  const tieneCasos = Array.isArray(tramiteType.cases) && tramiteType.cases.length > 0;
  const esEscritoTipo = esEscrito(tramiteType.code);

  // El breadcrumb regresa a la lista de la que vino:
  //   - Escritos → /apartado-1/escritos
  //   - Formatos → /apartado-1/formatos
  // Conservamos `?delegacion=X` si existe (NextLink lo arrastra automático).
  const volverHref = esEscritoTipo ? "/apartado-1/escritos" : "/apartado-1/formatos";
  const volverLabel = esEscritoTipo ? "Otros escritos" : "Otros formatos";

  return (
    <ApartadoShell
      numero={1}
      titulo={tramiteType.name}
      resumen={
        tieneCasos
          ? "Elige el caso, captura los documentos requeridos y genera el PDF."
          : `Llena los campos. Genera un PDF descargable. ${tramiteType.field_schema.length} campos en ${
              new Set(tramiteType.field_schema.map((c) => c.section ?? "Datos"))
                .size
            } secciones.`
      }
    >
      <nav className="mb-6 text-sm">
        <Link
          href={volverHref}
          className="inline-flex min-h-[44px] items-center gap-2 text-ink-2 hover:text-ink"
        >
          <span aria-hidden="true">←</span>
          {volverLabel}
        </Link>
      </nav>

      <VistaTramite
        tramiteType={tramiteType}
        precarga={precarga}
        precargaDocType={precargaDocType}
      />
    </ApartadoShell>
  );
}
