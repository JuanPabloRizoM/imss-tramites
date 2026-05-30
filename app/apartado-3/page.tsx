import { Suspense } from "react";

import { ApartadoShell } from "@/components/ApartadoShell";
import { PareoBanner } from "@/components/PareoBanner";
import { PareoProvider } from "@/lib/pareo-cliente";
import { VistaComputadora } from "./VistaComputadora";

export const metadata = { title: "Extracción de datos · Trámites IMSS" };

export default function Apartado3() {
  return (
    <ApartadoShell
      numero={3}
      titulo="Extracción de datos"
      resumen="Subes un documento desde el celular y aparece aquí con sus datos para revisar."
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
          <VistaComputadora />
        </Suspense>
      </PareoProvider>
    </ApartadoShell>
  );
}
