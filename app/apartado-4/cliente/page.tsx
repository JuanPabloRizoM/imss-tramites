import { notFound } from "next/navigation";

import { getServerClient } from "@/lib/supabase/server";
import type { TramiteType } from "@/lib/tramites";
import { FormCliente } from "./FormCliente";

export const metadata = {
  title: "Captura · Trámites IMSS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function PaginaCliente() {
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("tramite_types")
    .select("id, code, name, apartado, output_type, field_schema, source_docs, active")
    .eq("code", "captura-rapida")
    .maybeSingle();

  if (!data) notFound();
  const tipo = data as TramiteType;

  return (
    <main className="flex-1 px-6 py-12 md:px-12 md:py-20">
      <div className="mx-auto max-w-2xl">
        <header className="mb-12">
          <p className="eyebrow mb-3">Captura tus datos</p>
          <h1 className="font-display text-4xl text-ink md:text-6xl">
            Tus datos,{" "}
            <em className="italic text-accent">una sola vez</em>.
          </h1>
          <p className="mt-4 text-base text-ink-2 md:text-lg">
            Llena lo que sepas y aprieta enviar. El personal continúa el trámite
            con esta información.
          </p>
        </header>

        <FormCliente tipo={tipo} />
      </div>
    </main>
  );
}
