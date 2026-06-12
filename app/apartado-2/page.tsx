import Link from "next/link";

import { ApartadoShell } from "@/components/ApartadoShell";
import { getServerClient } from "@/lib/supabase/server";
import type { TramiteType } from "@/lib/tramites";

export const metadata = { title: "Altas y prealtas · Trámites IMSS" };
export const dynamic = "force-dynamic";

export default async function Apartado2() {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("tramite_types")
    .select("id, code, name, apartado, output_type, field_schema, source_docs, active, portal_url")
    .eq("apartado", 2)
    .eq("active", true)
    .order("name");

  const tramites = (data ?? []) as (Pick<
    TramiteType,
    "id" | "code" | "name" | "field_schema" | "source_docs"
  > & { portal_url: string | null })[];

  return (
    <ApartadoShell
      numero={2}
      titulo="Altas patronales, prealtas y certificado digital"
      resumen="Capturas datos aquí; la extensión los pega en el portal del IMSS en Edge."
    >
      <p className="mb-8 rounded-md border border-line bg-paper-2 p-4 text-sm text-ink-2">
        Requiere la <strong className="font-medium text-ink">extensión de Edge</strong>.
        Instálala desde la{" "}
        <a
          href="https://microsoftedge.microsoft.com/addons/detail/ppmommkgdmjeaoiahapbanjcamodpelm"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-ink underline underline-offset-2 hover:text-accent"
        >
          tienda de Microsoft Edge
        </a>{" "}
        (un clic) y configúrala con la URL y anon key de Supabase — ver{" "}
        <code className="font-mono text-xs">extension/README.md</code>.
      </p>

      {error && (
        <div className="rounded-md border border-err/30 bg-err-soft p-4 text-sm">
          No se pudo cargar el catálogo: {error.message}
        </div>
      )}

      {!error && tramites.length === 0 && (
        <div className="rounded-md border border-dashed border-line-2 bg-paper-2 p-10 text-center">
          <p className="eyebrow mb-2">Sin trámites cargados</p>
          <p className="text-sm text-ink-2">
            Aplica la migración <code className="font-mono">0006_seed_apartado_2.sql</code>.
          </p>
        </div>
      )}

      {tramites.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {tramites.map((t) => (
            <li key={t.id}>
              <Link
                href={`/apartado-2/${t.code}`}
                className="group flex min-h-[88px] items-baseline gap-6 py-6 transition-colors hover:bg-paper-2"
              >
                <span className="font-display shrink-0 text-2xl uppercase tracking-wide text-ink-3 group-hover:text-accent">
                  {t.code}
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-lg font-medium text-ink">{t.name}</span>
                  <span className="text-sm text-ink-3">
                    {t.field_schema.length} campos · Documentos fuente:{" "}
                    {t.source_docs.length ? t.source_docs.join(", ") : "—"}
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
