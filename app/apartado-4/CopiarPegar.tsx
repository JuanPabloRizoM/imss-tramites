"use client";

import { useMemo, useState } from "react";

import {
  agruparPorSeccion,
  type CampoSchema,
  type TramiteType,
} from "@/lib/tramites";

export function CopiarPegar({ tipo }: { tipo: TramiteType }) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState<string | null>(null);

  const grupos = useMemo(
    () => agruparPorSeccion(tipo.field_schema),
    [tipo.field_schema]
  );

  const setCampo = (id: string, v: string) =>
    setValores((prev) => ({ ...prev, [id]: v }));

  const copiar = async (texto: string, id: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado((c) => (c === id ? null : c)), 1400);
    } catch {
      setCopiado("error");
    }
  };

  const todoFormateado = useMemo(() => {
    const lineas: string[] = [];
    for (const { seccion, campos } of grupos) {
      lineas.push(`# ${seccion}`);
      for (const c of campos) {
        const v = valores[c.id]?.trim();
        if (v) lineas.push(`${c.label}: ${v}`);
      }
      lineas.push("");
    }
    return lineas.join("\n").trim();
  }, [grupos, valores]);

  const limpiar = () => setValores({});

  return (
    <div className="grid gap-8">
      <p className="text-sm text-ink-2">
        Captura los datos una sola vez y pega cada campo donde lo necesites.
        El botón <span className="font-medium text-ink">Copiar</span> a la
        derecha de cada campo copia su valor al portapapeles.
      </p>

      <div className="grid gap-8">
        {grupos.map(({ seccion, campos }) => (
          <fieldset key={seccion} className="grid gap-4">
            <legend className="eyebrow">{seccion}</legend>
            <div className="grid gap-4 md:grid-cols-2">
              {campos.map((c) => (
                <CampoConCopia
                  key={c.id}
                  campo={c}
                  valor={valores[c.id] ?? ""}
                  onChange={(v) => setCampo(c.id, v)}
                  onCopy={() => copiar(valores[c.id] ?? "", c.id)}
                  copiado={copiado === c.id}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button
          type="button"
          onClick={() => copiar(todoFormateado, "_all")}
          disabled={!todoFormateado}
          className="inline-flex min-h-[48px] items-center rounded-md bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-2 disabled:bg-ink-3"
        >
          {copiado === "_all" ? "Copiado · todo" : "Copiar todo formateado"}
        </button>
        <button
          type="button"
          onClick={limpiar}
          className="inline-flex min-h-[48px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
        >
          Limpiar
        </button>
        {copiado === "error" && (
          <span className="text-sm text-err">No se pudo acceder al portapapeles.</span>
        )}
      </div>
    </div>
  );
}

function CampoConCopia({
  campo,
  valor,
  onChange,
  onCopy,
  copiado,
}: {
  campo: CampoSchema;
  valor: string;
  onChange: (v: string) => void;
  onCopy: () => void;
  copiado: boolean;
}) {
  const id = `cp-${campo.id}`;
  const esTextarea = campo.type === "textarea";

  return (
    <div className={`flex flex-col gap-1 ${esTextarea ? "md:col-span-2" : ""}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {campo.label}
      </label>
      <div className="flex gap-2">
        {esTextarea ? (
          <textarea
            id={id}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-base text-ink focus-visible:border-ink"
          />
        ) : (
          <input
            id={id}
            type={campo.type === "date" ? "date" : "text"}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 flex-1 rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
          />
        )}
        <button
          type="button"
          onClick={onCopy}
          disabled={!valor}
          aria-label={`Copiar ${campo.label}`}
          className={`min-h-[44px] shrink-0 rounded-md border px-3 text-xs font-medium transition-colors ${
            copiado
              ? "border-ok bg-ok-soft text-ok"
              : "border-line bg-paper text-ink-2 hover:border-ink hover:text-ink disabled:text-ink-3"
          }`}
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
