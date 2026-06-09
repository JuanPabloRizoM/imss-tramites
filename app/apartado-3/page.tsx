import { Suspense } from "react";

import { ApartadoShell } from "@/components/ApartadoShell";
import { PareoBanner } from "@/components/PareoBanner";
import { PareoProvider } from "@/lib/pareo-cliente";
import { getServerClient } from "@/lib/supabase/server";
import type { TramiteType } from "@/lib/tramites";
import { VistaComputadora } from "./VistaComputadora";

export const metadata = { title: "Extracción de datos · Trámites IMSS" };
export const dynamic = "force-dynamic";

export default async function Apartado3() {
  // Fetch de todos los tramite_types activos para alimentar el modal de
  // "¿Para qué es este documento?" que se abre antes de subir. Necesitamos
  // id, code, name, field_schema y apartado — el field_schema se usa
  // como target_fields cuando el usuario elige un trámite.
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("tramite_types")
    .select("id, code, name, apartado, field_schema")
    .eq("active", true)
    .order("apartado")
    .order("name");

  const tramites = (data ?? []) as Pick<
    TramiteType,
    "id" | "code" | "name" | "apartado" | "field_schema"
  >[];

  return (
    <ApartadoShell
      numero={3}
      titulo="Extracción de datos"
      resumen="Subes un documento desde el celular o desde esta computadora y aparece aquí con sus datos para revisar."
    >
      <PareoProvider>
        <PareoBanner />
        <Suspense
          fallback={
            <div className="rounded-md border border-line bg-paper-2 p-4 text-sm text-ink-3">
              Cargando…
            </div>
          }
        >
          <VistaComputadora tramites={tramites} />
        </Suspense>
      </PareoProvider>
    </ApartadoShell>
  );
}
