"use client";

import { useCallback, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserClient } from "@/lib/supabase/client";
import {
  agruparPorSeccion,
  normalizarParaSalida,
  type CampoSchema,
  type TramiteType,
} from "@/lib/tramites";

type Estado = "edicion" | "enviando" | "enviado" | "error";

function initSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  return getBrowserClient();
}

export function FormCliente({ tipo }: { tipo: TramiteType }) {
  const [supabase] = useState<SupabaseClient | null>(initSupabase);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<Estado>("edicion");
  const [error, setError] = useState<string | null>(null);

  const grupos = useMemo(
    () => agruparPorSeccion(tipo.field_schema),
    [tipo.field_schema]
  );

  const setCampo = (id: string, v: string) =>
    setValores((prev) => ({ ...prev, [id]: v }));

  const enviar = useCallback(async () => {
    if (!supabase) return;
    setEstado("enviando");
    setError(null);

    // Normalizar a MAYÚSCULAS los datos cortos (textarea/date/select/etc.
    // se preservan). Luego limpia strings vacíos a null para no guardar
    // basura.
    const normalizados = normalizarParaSalida(tipo.field_schema, valores);
    const limpio: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(normalizados)) {
      limpio[k] = v.trim() === "" ? null : v.trim();
    }

    const { error: err } = await supabase.from("tramites").insert({
      tramite_type_id: tipo.id,
      status: "nuevo",
      field_values: limpio,
    });

    if (err) {
      setError(err.message);
      setEstado("error");
      return;
    }
    setEstado("enviado");
  }, [supabase, tipo.id, tipo.field_schema, valores]);

  const reiniciar = () => {
    setValores({});
    setEstado("edicion");
    setError(null);
  };

  const faltaObligatorio = tipo.field_schema.some(
    (c) => c.required && !valores[c.id]?.trim()
  );

  if (estado === "enviado") {
    return (
      <div className="rounded-md border border-ok/30 bg-ok-soft p-8 text-center">
        <p className="eyebrow mb-2 text-ok">Recibido</p>
        <h2 className="font-display mb-2 text-3xl text-ink">
          Gracias.
        </h2>
        <p className="text-base text-ink-2">
          El personal continúa el trámite con tu información.
        </p>
        <button
          type="button"
          onClick={reiniciar}
          className="mt-6 inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink hover:bg-paper-2"
        >
          Capturar otra persona
        </button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
    >
      {grupos.map(({ seccion, campos }) => (
        <fieldset key={seccion} className="grid gap-4">
          <legend className="eyebrow">{seccion}</legend>
          <div className="grid gap-4 md:grid-cols-2">
            {campos.map((c) => (
              <Campo
                key={c.id}
                campo={c}
                valor={valores[c.id] ?? ""}
                onChange={(v) => setCampo(c.id, v)}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button
          type="submit"
          disabled={estado === "enviando" || faltaObligatorio || !supabase}
          className="inline-flex min-h-[56px] items-center rounded-md bg-ink px-7 text-base font-semibold text-paper hover:bg-ink-2 disabled:bg-ink-3"
        >
          {estado === "enviando" ? "Enviando…" : "Enviar"}
        </button>
        {faltaObligatorio && (
          <span className="text-sm text-ink-3">Faltan campos obligatorios.</span>
        )}
        {error && <span className="text-sm text-err">{error}</span>}
      </div>
    </form>
  );
}

function Campo({
  campo,
  valor,
  onChange,
}: {
  campo: CampoSchema;
  valor: string;
  onChange: (v: string) => void;
}) {
  const id = `c-${campo.id}`;
  const esTextarea = campo.type === "textarea";

  return (
    <div className={`flex flex-col gap-1 ${esTextarea ? "md:col-span-2" : ""}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {campo.label}
        {campo.required && <span className="text-accent"> *</span>}
      </label>
      {esTextarea ? (
        <textarea
          id={id}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="rounded-md border border-line bg-paper px-3 py-2 text-base text-ink focus-visible:border-ink"
        />
      ) : (
        <input
          id={id}
          type={campo.type === "date" ? "date" : "text"}
          inputMode={campo.type === "number" ? "numeric" : undefined}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
        />
      )}
    </div>
  );
}
