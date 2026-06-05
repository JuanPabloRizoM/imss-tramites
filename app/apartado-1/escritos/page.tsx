import Link from "next/link";

import { ApartadoShell } from "@/components/ApartadoShell";
import { getServerClient } from "@/lib/supabase/server";
import type { TramiteType } from "@/lib/tramites";
import { DELEGACIONES, esEscrito } from "@/lib/delegaciones";

export const metadata = { title: "Escritos · Trámites IMSS" };
export const dynamic = "force-dynamic";

// Picker de delegación para los escritos del apartado 1.
//
// Comportamiento:
//   - Si hay exactamente UN tipo de escrito (caso actual: solo
//     "escrito-generico"), el click en una delegación va directo al editor
//     con ?delegacion=<id> en la URL.
//   - Si hay 2+ tipos de escrito, primero se elige delegación, después se
//     elige tipo de escrito. (En esa fase, el delegación elegida se pasa
//     como query string en el segundo step.)
//
// VistaTramite consume el query param y pre-llena el campo `dependencia`
// del escrito con el nombre legal de la delegación.

export default async function EscritosPicker({
  searchParams,
}: {
  searchParams: Promise<{ delegacion?: string }>;
}) {
  const { delegacion } = await searchParams;
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("tramite_types")
    .select("id, code, name, apartado, output_type, field_schema, source_docs, active")
    .eq("apartado", 1)
    .eq("active", true)
    .order("name");

  const escritos = (data ?? []).filter((t) => esEscrito(t.code)) as Pick<
    TramiteType,
    "id" | "code" | "name" | "field_schema" | "source_docs"
  >[];

  const yaEligioDelegacion = !!delegacion;

  return (
    <ApartadoShell
      numero={1}
      titulo="Escritos"
      resumen={
        yaEligioDelegacion
          ? "Elige el tipo de escrito que vas a redactar."
          : "Elige a qué delegación va el escrito."
      }
    >
      <nav className="mb-8 text-sm">
        <Link
          href={yaEligioDelegacion ? "/apartado-1/escritos" : "/apartado-1"}
          className="inline-flex min-h-[44px] items-center gap-2 text-ink-2 hover:text-ink"
        >
          <span aria-hidden="true">←</span>
          {yaEligioDelegacion ? "Cambiar delegación" : "Volver a Escritos / Formatos"}
        </Link>
      </nav>

      {!yaEligioDelegacion && (
        <DelegacionesGrid escritoCode={escritos.length === 1 ? escritos[0].code : null} />
      )}

      {yaEligioDelegacion && (
        <EscritosLista escritos={escritos} delegacion={delegacion!} />
      )}
    </ApartadoShell>
  );
}

function DelegacionesGrid({ escritoCode }: { escritoCode: string | null }) {
  // Si solo hay 1 escrito disponible, cada delegación linkea directo al
  // editor con ?delegacion=<id>. Si hay varios, linkea a esta misma página
  // con ?delegacion=<id> y se renderiza el step 2 (lista de escritos).
  const hrefFor = (id: string) =>
    escritoCode
      ? `/apartado-1/${escritoCode}?delegacion=${encodeURIComponent(id)}`
      : `/apartado-1/escritos?delegacion=${encodeURIComponent(id)}`;

  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {DELEGACIONES.map((d) => (
        <li key={d.id}>
          <Link
            href={hrefFor(d.id)}
            className="group flex h-full min-h-[160px] flex-col justify-between rounded-md border border-line bg-paper-2 p-6 transition-colors hover:border-ink hover:bg-paper"
          >
            <div>
              <p className="font-display text-xl text-ink">{d.nombre}</p>
              {d.direccion && (
                <p className="mt-1 text-sm text-ink-3">{d.direccion}</p>
              )}
            </div>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-ink-2 group-hover:text-ink">
              {escritoCode ? "Redactar escrito" : "Elegir"}
              <span aria-hidden="true" className="ml-1 transition-transform group-hover:translate-x-1">
                →
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EscritosLista({
  escritos,
  delegacion,
}: {
  escritos: Pick<TramiteType, "id" | "code" | "name" | "field_schema" | "source_docs">[];
  delegacion: string;
}) {
  if (escritos.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line-2 bg-paper-2 p-8 text-sm text-ink-2">
        No hay escritos cargados. Revisa{" "}
        <code className="font-mono">tramite_types</code>.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line border-y border-line">
      {escritos.map((t) => (
        <li key={t.id}>
          <Link
            href={`/apartado-1/${t.code}?delegacion=${encodeURIComponent(delegacion)}`}
            className="group flex min-h-[80px] items-baseline gap-6 py-6 transition-colors hover:bg-paper-2"
          >
            <span className="font-display shrink-0 text-2xl uppercase tracking-wide text-ink-3 group-hover:text-accent">
              {t.code}
            </span>
            <span className="flex flex-1 flex-col gap-1">
              <span className="text-lg font-medium text-ink">{t.name}</span>
              <span className="text-sm text-ink-3">{t.field_schema.length} campos</span>
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
  );
}
