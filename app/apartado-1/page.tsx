import Link from "next/link";

import { ApartadoShell } from "@/components/ApartadoShell";
import { getServerClient } from "@/lib/supabase/server";
import type { TramiteType } from "@/lib/tramites";

export const metadata = { title: "Escritos y formatos · Trámites IMSS" };
export const dynamic = "force-dynamic";

export default async function Apartado1() {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("tramite_types")
    .select("id, code, name, apartado, output_type, field_schema, source_docs, active")
    .eq("apartado", 1)
    .eq("active", true)
    .order("name");

  const tramites = (data ?? []) as Pick<
    TramiteType,
    "id" | "code" | "name" | "field_schema" | "source_docs"
  >[];

  return (
    <ApartadoShell
      numero={1}
      titulo="Escritos y llenado de formatos"
      resumen="Elige un trámite. Llenas los campos, sale un PDF descargable."
    >
      {error && (
        <div className="rounded-md border border-err/30 bg-err-soft p-4 text-sm text-ink-2">
          No se pudo cargar el catálogo: {error.message}
        </div>
      )}

      {!error && tramites.length === 0 && (
        <div className="rounded-md border border-dashed border-line-2 bg-paper-2 p-10 text-center">
          <p className="eyebrow mb-2">Sin trámites cargados</p>
          <p className="text-sm text-ink-2">
            La tabla <code className="font-mono">tramite_types</code> está vacía.
            Aplica la migración{" "}
            <code className="font-mono">0004_seed_tramite_types.sql</code>.
          </p>
        </div>
      )}

      {tramites.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {tramites.map((t) => (
            <li key={t.id}>
              <Link
                href={`/apartado-1/${t.code}`}
                className="group flex min-h-[80px] items-baseline gap-6 py-6 transition-colors hover:bg-paper-2"
              >
                <span className="font-display shrink-0 text-2xl uppercase tracking-wide text-ink-3 group-hover:text-accent">
                  {t.code}
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-lg font-medium text-ink">{t.name}</span>
                  <span className="text-sm text-ink-3">
                    {t.field_schema.length} campos
                    {t.source_docs.length > 0
                      ? ` · Documentos fuente: ${t.source_docs.join(", ")}`
                      : ""}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-ink-3 transition-transform group-hover:translate-x-1 group-hover:text-ink"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ApartadoShell>
  );
}
