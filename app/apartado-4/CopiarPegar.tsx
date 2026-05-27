"use client";

import { useMemo, useState } from "react";

import {
  agruparPorSeccion,
  normalizarParaSalida,
  type CampoSchema,
  type TramiteType,
} from "@/lib/tramites";

type EstadoIA =
  | { tipo: "idle" }
  | { tipo: "leyendo" }
  | { tipo: "ok"; rellenados: number }
  | { tipo: "error"; mensaje: string };

export function CopiarPegar({ tipo }: { tipo: TramiteType }) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState<string | null>(null);
  const [textoLibre, setTextoLibre] = useState("");
  const [estadoIA, setEstadoIA] = useState<EstadoIA>({ tipo: "idle" });

  const grupos = useMemo(
    () => agruparPorSeccion(tipo.field_schema),
    [tipo.field_schema]
  );

  // Lo que el usuario ve mientras tipea es lo que escribió. Lo que se COPIA
  // sale en MAYÚSCULAS (regla de presentación del IMSS). textarea/date/etc.
  // se preservan.
  const valoresSalida = useMemo(
    () => normalizarParaSalida(tipo.field_schema, valores),
    [tipo.field_schema, valores]
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
        const v = valoresSalida[c.id]?.trim();
        if (v) lineas.push(`${c.label}: ${v}`);
      }
      lineas.push("");
    }
    return lineas.join("\n").trim();
  }, [grupos, valoresSalida]);

  const limpiar = () => setValores({});

  const autocompletarConIA = async () => {
    const texto = textoLibre.trim();
    if (!texto) return;
    setEstadoIA({ tipo: "leyendo" });
    try {
      const res = await fetch("/api/parsear-texto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, schema: tipo.field_schema }),
      });
      const json = (await res.json()) as
        | { ok: true; values: Record<string, string> }
        | { error: string };
      if (!res.ok || "error" in json) {
        const msg = "error" in json ? json.error : `Error ${res.status}`;
        setEstadoIA({ tipo: "error", mensaje: msg });
        return;
      }
      setValores((prev) => ({ ...prev, ...json.values }));
      setEstadoIA({ tipo: "ok", rellenados: Object.keys(json.values).length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido.";
      setEstadoIA({ tipo: "error", mensaje: msg });
    }
  };

  return (
    <div className="grid gap-8">
      <p className="text-sm text-ink-2">
        Captura los datos una sola vez y pega cada campo donde lo necesites.
        El botón <span className="font-medium text-ink">Copiar</span> a la
        derecha de cada campo copia su valor al portapapeles.
      </p>

      <section className="grid gap-3 rounded-md border border-line bg-paper-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="eyebrow">Pegar texto y autocompletar</p>
          <span className="text-xs text-ink-3">
            Lee notas sueltas y rellena los campos.
          </span>
        </div>
        <textarea
          value={textoLibre}
          onChange={(e) => {
            setTextoLibre(e.target.value);
            if (estadoIA.tipo !== "idle" && estadoIA.tipo !== "leyendo") {
              setEstadoIA({ tipo: "idle" });
            }
          }}
          rows={4}
          placeholder="Pega aquí lo que tengas: notas a mano transcritas, un párrafo del expediente, lo que dictó el cliente. La IA identificará los campos y los rellenará abajo."
          className="rounded-md border border-line bg-paper px-3 py-2 text-base text-ink focus-visible:border-ink"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={autocompletarConIA}
            disabled={!textoLibre.trim() || estadoIA.tipo === "leyendo"}
            className="inline-flex min-h-[44px] items-center rounded-md bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink-2 disabled:bg-ink-3"
          >
            {estadoIA.tipo === "leyendo" ? "Leyendo…" : "Autocompletar con IA"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTextoLibre("");
              setEstadoIA({ tipo: "idle" });
            }}
            disabled={!textoLibre || estadoIA.tipo === "leyendo"}
            className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-3 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink disabled:text-ink-3"
          >
            Limpiar texto
          </button>
          {estadoIA.tipo === "ok" && (
            <span className="text-sm text-ok">
              {estadoIA.rellenados === 0
                ? "La IA no encontró ningún campo en el texto."
                : `Se rellenaron ${estadoIA.rellenados} campo${estadoIA.rellenados === 1 ? "" : "s"}. Revísalos antes de copiar.`}
            </span>
          )}
          {estadoIA.tipo === "error" && (
            <span className="text-sm text-err">No se pudo leer: {estadoIA.mensaje}</span>
          )}
        </div>
      </section>

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
                  onCopy={() => copiar(valoresSalida[c.id] ?? "", c.id)}
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
