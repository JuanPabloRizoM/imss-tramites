"use client";

import { useState } from "react";

import { usePareo } from "@/lib/pareo-cliente";

// Banner del código de pareo. Va en la parte superior de las vistas de
// computadora que consumen documents (apartado-3 por ahora). Diseño:
// prominente sin ser ruidoso, monospace y suficientemente grande para
// leerse desde otra mesa.

export function PareoBanner() {
  const { estado, reintentar } = usePareo();
  const [tooltipAbierto, setTooltipAbierto] = useState(false);

  if (estado.tipo === "cargando") {
    return (
      <div className="mb-6 rounded-md border border-line bg-paper-2 px-4 py-3 text-sm text-ink-3">
        Preparando código de pareo…
      </div>
    );
  }

  if (estado.tipo === "error") {
    return (
      <div
        role="alert"
        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-err/30 bg-err-soft px-4 py-3"
      >
        <div className="text-sm text-ink-2">
          <p className="font-medium text-err">No se pudo crear el código</p>
          <p>{estado.mensaje}</p>
        </div>
        <button
          type="button"
          onClick={reintentar}
          className="inline-flex min-h-[40px] items-center rounded-md border border-line bg-paper px-3 text-sm font-medium text-ink hover:bg-paper-2"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const code = estado.sesion.code;

  return (
    <div className="mb-6 rounded-md border border-line bg-paper-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="eyebrow">Código:</span>
          <span
            className="font-mono text-3xl font-semibold tracking-[0.25em] text-ink md:text-4xl"
            aria-label={`Código de pareo ${code.split("").join(" ")}`}
          >
            {code}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <span>
            Ingrésalo en tu celular para enviar documentos a esta computadora.
          </span>
          <button
            type="button"
            onClick={() => setTooltipAbierto((v) => !v)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-paper text-xs font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
            aria-expanded={tooltipAbierto}
            aria-label="Cómo emparejar mi celular"
          >
            ?
          </button>
        </div>
      </div>
      {tooltipAbierto && (
        <p className="mt-3 rounded-md border border-line bg-paper p-3 text-sm text-ink-2">
          En el celular abre <code className="rounded bg-paper-2 px-1 font-mono">/movil</code>{" "}
          y escribe estos 4 caracteres. Las fotos que tome solo aparecerán aquí.
          El código vive lo que dure esta pestaña; si la cierras, sale uno
          nuevo la próxima vez.
        </p>
      )}
    </div>
  );
}
