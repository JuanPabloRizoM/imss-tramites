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
    <main className="flex-1 px-6 py-10 md:px-12 md:py-14">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-10">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink"
          >
            <span aria-hidden="true">←</span>
            Volver al inicio
          </Link>
        </nav>

        <header className="mb-10 grid gap-6 border-b border-line pb-8 md:grid-cols-[auto_1fr] md:gap-10 md:pb-10">
          <p className="font-display text-5xl text-ink-3 md:text-7xl">
            {String(numero).padStart(2, "0")}
          </p>
          <div>
            <p className="eyebrow mb-2">Apartado {numero}</p>
            <h1 className="font-display text-3xl text-ink md:text-5xl">
              {titulo}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-ink-2 md:text-lg">
              {resumen}
            </p>
          </div>
        </header>

        {children ? (
          <section>{children}</section>
        ) : (
          <section className="rounded-md border border-dashed border-line-2 bg-paper-2 p-10 text-center">
            <p className="eyebrow mb-2">Pendiente</p>
            <p className="text-sm text-ink-2">
              Este apartado se construye en la fase correspondiente del plan.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
