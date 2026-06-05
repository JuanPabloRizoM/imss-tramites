import Link from "next/link";

import { ApartadoShell } from "@/components/ApartadoShell";

export const metadata = { title: "Escritos y formatos · Trámites IMSS" };

// Pantalla de entrada del Apartado 1: bifurca entre Escritos (con su picker
// de delegación) y Llenado de formatos (lista completa de formatos oficiales).
// Cada rama tiene su propia ruta — esta página solo decide cuál.

export default function Apartado1() {
  return (
    <ApartadoShell
      numero={1}
      titulo="Escritos y llenado de formatos"
      resumen="Elige qué vas a hacer."
    >
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <Link
          href="/apartado-1/escritos"
          className="group flex min-h-[220px] flex-col justify-between rounded-lg border border-line bg-paper-2 p-8 transition-colors hover:border-ink hover:bg-paper"
        >
          <div>
            <p className="eyebrow mb-2">Opción 1</p>
            <h2 className="font-display text-3xl text-ink">Escritos</h2>
            <p className="mt-3 text-sm text-ink-2">
              Carta dirigida a una delegación del IMSS. Eliges a qué
              delegación va y rellenas el contenido.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm font-medium text-ink-2 group-hover:text-ink">
            Elegir delegación
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </div>
        </Link>

        <Link
          href="/apartado-1/formatos"
          className="group flex min-h-[220px] flex-col justify-between rounded-lg border border-line bg-paper-2 p-8 transition-colors hover:border-ink hover:bg-paper"
        >
          <div>
            <p className="eyebrow mb-2">Opción 2</p>
            <h2 className="font-display text-3xl text-ink">Llenado de formatos</h2>
            <p className="mt-3 text-sm text-ink-2">
              Formatos oficiales del IMSS (AFIL-01, AM-SRT, etc.). Llenas los
              campos y sale el PDF oficial firmado por encima.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm font-medium text-ink-2 group-hover:text-ink">
            Ver formatos disponibles
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </div>
        </Link>
      </div>
    </ApartadoShell>
  );
}
