"use client";

import { useCallback, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserClient } from "@/lib/supabase/client";
import {
  agruparPorSeccion,
  debeMostrar,
  normalizarParaSalida,
  type CampoSchema,
  type TramiteType,
} from "@/lib/tramites";
import type { DatoExtraido } from "@/lib/extraccion";

type Props = { tramiteType: TramiteType };
type Valores = Record<string, string>;
type EstadoGuardar = "idle" | "guardando" | "guardado" | "error";

function initSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  return getBrowserClient();
}

function valoresIniciales(schema: CampoSchema[]): Valores {
  const v: Valores = {};
  for (const c of schema) v[c.id] = "";
  return v;
}

export function FormularioTramite({ tramiteType }: Props) {
  const [supabase] = useState<SupabaseClient | null>(initSupabase);
  const [valores, setValores] = useState<Valores>(() =>
    valoresIniciales(tramiteType.field_schema)
  );
  const [tramiteId, setTramiteId] = useState<string | null>(null);
  const [guardar, setGuardar] = useState<EstadoGuardar>("idle");
  const [generando, setGenerando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [precargando, setPrecargando] = useState(false);

  // Solo campos visibles según `show_if`. Los ocultos no se muestran ni
  // bloquean la validación, y no se envían al PDF (su valor queda en blanco).
  const camposVisibles = useMemo(
    () =>
      tramiteType.field_schema.filter((c) => debeMostrar(c, valores)),
    [tramiteType.field_schema, valores]
  );
  const grupos = useMemo(
    () => agruparPorSeccion(camposVisibles),
    [camposVisibles]
  );

  const setCampo = (id: string, valor: string) => {
    setValores((prev) => ({ ...prev, [id]: valor }));
    if (guardar === "guardado") setGuardar("idle");
  };

  // Trae el último documento extraído de cada source_doc del trámite y
  // vuelca sus valores en los campos correspondientes. Solo sobrescribe
  // campos vacíos para no pisar correcciones manuales.
  const precargarDesdeExtraccion = useCallback(async () => {
    if (!supabase) return;
    setPrecargando(true);
    setMensaje(null);
    try {
      const docTypes = tramiteType.source_docs.length > 0
        ? tramiteType.source_docs
        : Array.from(
            new Set(
              tramiteType.field_schema
                .map((c) => c.source_doc)
                .filter((x): x is string => !!x)
            )
          );

      if (docTypes.length === 0) {
        setMensaje("Este trámite no declara documentos fuente.");
        return;
      }

      let aplicados = 0;
      for (const docType of docTypes) {
        const { data } = await supabase
          .from("documents")
          .select("doc_type, extracted_data")
          .eq("doc_type", docType)
          .eq("extraction_status", "listo")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const datos = (data?.extracted_data ?? null) as
          | Record<string, DatoExtraido>
          | null;
        if (!datos) continue;

        for (const campo of tramiteType.field_schema) {
          if (campo.source_doc !== docType) continue;
          const d = datos[campo.id];
          if (d?.valor && !valores[campo.id]) {
            setCampo(campo.id, d.valor);
            aplicados += 1;
          }
        }
      }

      setMensaje(
        aplicados > 0
          ? `Se prellenaron ${aplicados} campos desde documentos extraídos.`
          : "No se encontraron documentos extraídos para este trámite."
      );
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error al precargar.");
    } finally {
      setPrecargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, tramiteType]);

  const guardarBorrador = useCallback(async () => {
    if (!supabase) return;
    setGuardar("guardando");
    const normalizados = normalizarParaSalida(tramiteType.field_schema, valores);
    const payload = { field_values: normalizados, status: "revisado" as const };
    if (tramiteId) {
      const { error } = await supabase
        .from("tramites")
        .update(payload)
        .eq("id", tramiteId);
      setGuardar(error ? "error" : "guardado");
      return;
    }
    const { data, error } = await supabase
      .from("tramites")
      .insert({ ...payload, tramite_type_id: tramiteType.id })
      .select("id")
      .single();
    if (error || !data) {
      setGuardar("error");
      setMensaje(error?.message ?? "No se pudo guardar.");
      return;
    }
    setTramiteId(data.id);
    setGuardar("guardado");
  }, [supabase, valores, tramiteId, tramiteType.id, tramiteType.field_schema]);

  const generarPDF = useCallback(async () => {
    setGenerando(true);
    setMensaje(null);
    try {
      // Solo manda valores de campos visibles — evita escribir en el PDF
      // datos residuales de un sub-form que se ocultó al cambiar la causa.
      const valoresFiltrados: Record<string, string> = {};
      for (const c of camposVisibles) {
        if (valores[c.id]) valoresFiltrados[c.id] = valores[c.id];
      }
      const res = await fetch("/api/generar-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tramite_type_code: tramiteType.code,
          field_values: valoresFiltrados,
        }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(errJson?.error ?? `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tramiteType.code}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error al generar PDF.");
    } finally {
      setGenerando(false);
    }
  }, [tramiteType.code, valores, camposVisibles]);

  const camposFaltantes = camposVisibles.filter(
    (c) => c.required && !valores[c.id]?.trim()
  );
  const faltaObligatorio = camposFaltantes.length > 0;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-paper-2 p-4">
        <button
          type="button"
          onClick={precargarDesdeExtraccion}
          disabled={precargando || !supabase}
          className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink hover:bg-paper-2 disabled:text-ink-3"
        >
          {precargando ? "Buscando…" : "Cargar datos de documentos extraídos"}
        </button>
        <span className="text-xs text-ink-3">
          Trae lo más reciente del Apartado 3 que coincida con los documentos fuente del trámite.
        </span>
      </div>

      <form
        className="grid gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          generarPDF();
        }}
      >
        {grupos.map(({ seccion, campos }) => (
          <fieldset key={seccion} className="grid gap-4">
            <legend className="eyebrow">{seccion}</legend>
            <div className="grid gap-4 md:grid-cols-2">
              {campos.map((campo) => (
                <CampoInput
                  key={campo.id}
                  campo={campo}
                  valor={valores[campo.id] ?? ""}
                  onChange={(v) => setCampo(campo.id, v)}
                />
              ))}
            </div>
          </fieldset>
        ))}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <button
            type="submit"
            disabled={generando || faltaObligatorio}
            className="inline-flex min-h-[48px] items-center rounded-md bg-ink px-6 text-sm font-semibold text-paper hover:bg-ink-2 disabled:bg-ink-3"
          >
            {generando ? "Generando…" : "Generar PDF"}
          </button>
          <button
            type="button"
            onClick={guardarBorrador}
            disabled={guardar === "guardando" || !supabase}
            className="inline-flex min-h-[48px] items-center rounded-md border border-line bg-paper px-5 text-sm font-medium text-ink hover:bg-paper-2"
          >
            {guardar === "guardando" ? "Guardando…" : "Guardar borrador"}
          </button>
          {guardar === "guardado" && (
            <span className="text-sm text-ok">Borrador guardado.</span>
          )}
          {faltaObligatorio && (
            <div className="text-sm text-ink-3">
              Faltan: {camposFaltantes.map((c) => c.label).join(", ")}
            </div>
          )}
        </div>
      </form>

      {mensaje && (
        <p className="rounded-md border border-line bg-paper-2 p-3 text-sm text-ink-2">
          {mensaje}
        </p>
      )}
    </div>
  );
}

function CampoInput({
  campo,
  valor,
  onChange,
}: {
  campo: CampoSchema;
  valor: string;
  onChange: (v: string) => void;
}) {
  const id = `f-${campo.id}`;
  const esTextarea = campo.type === "textarea";
  const esSelect = campo.type === "select";
  const html =
    campo.type === "date"
      ? "date"
      : campo.type === "number"
      ? "number"
      : "text";

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
          rows={6}
          className="rounded-md border border-line bg-paper px-3 py-2 text-base text-ink focus-visible:border-ink"
        />
      ) : esSelect ? (
        <select
          id={id}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
        >
          <option value="">—</option>
          {(campo.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={html}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
        />
      )}
    </div>
  );
}
