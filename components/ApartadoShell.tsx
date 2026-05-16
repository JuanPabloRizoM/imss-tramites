import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  numero: number;
  titulo: string;
  resumen: string;
  children?: ReactNode;
};

export function ApartadoShell({ numero, titulo, resumen, children }: Props) {
  return (
    <main className="flex-1 px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-8">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            <span aria-hidden="true">←</span>
            Volver al inicio
          </Link>
        </nav>

        <header className="mb-8 md:mb-12">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Apartado {numero}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">
            {titulo}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-zinc-600">{resumen}</p>
        </header>

        <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
          {children ?? (
            <p className="text-sm text-zinc-500">
              En construcción. Este apartado se implementa en la fase
              correspondiente del plan.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
