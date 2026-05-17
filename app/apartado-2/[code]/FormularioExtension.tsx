"use client";

import { useCallback, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserClient } from "@/lib/supabase/client";
import {
  agruparPorSeccion,
  type CampoSchema,
  type TramiteType,
} from "@/lib/tramites";
import type { DatoExtraido } from "@/lib/extraccion";

type Props = { tramiteType: TramiteType & { portal_url: string | null } };
type Valores = Record<string, string>;

function initSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  return getBrowserClient();
}

function valoresIniciales(schema: CampoSchema[]): Valores {
  const v: Valores = {};
  for (const c of schema) v[c.id] = "";
  return v;
}

export function FormularioExtension({ tramiteType }: Props) {
  const [supabase] = useState<SupabaseClient | null>(initSupabase);
  const [valores, setValores] = useState<Valores>(() =>
    valoresIniciales(tramiteType.field_schema)
  );
  const [tramiteId, setTramiteId] = useState<string | null>(null);
  const [estado, setEstado] = useState<"idle" | "guardando" | "guardado" | "revisado" | "error">("idle");
  const [precargando, setPrecargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const grupos = useMemo(
    () => agruparPorSeccion(tramiteType.field_schema),
    [tramiteType.field_schema]
  );

  const setCampo = (id: string, valor: string) => {
    setValores((prev) => ({ ...prev, [id]: valor }));
    if (estado === "guardado" || estado === "revisado") setEstado("idle");
  };

  const precargar = useCallback(async () => {
    if (!supabase) return;
    setPrecargando(true);
    setMensaje(null);
    try {
      const docTypes = tramiteType.source_docs.length > 0
        ? tramiteType.source_docs
        : Array.from(new Set(
            tramiteType.field_schema
              .map((c) => c.source_doc)
              .filter((x): x is string => !!x)
          ));

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
          ? `Se prellenaron ${aplicados} campos.`
          : "No se encontraron documentos extraídos para este trámite."
      );
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error al precargar.");
    } finally {
      setPrecargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, tramiteType]);

  const guardar = useCallback(
    async (nuevoStatus: "revisado" | "nuevo") => {
      if (!supabase) return;
      setEstado("guardando");
      const payload = { field_values: valores, status: nuevoStatus };
      if (tramiteId) {
        const { error } = await supabase
          .from("tramites")
          .update(payload)
          .eq("id", tramiteId);
        setEstado(error ? "error" : nuevoStatus === "revisado" ? "revisado" : "guardado");
        if (error) setMensaje(error.message);
        return;
      }
      const { data, error } = await supabase
        .from("tramites")
        .insert({ ...payload, tramite_type_id: tramiteType.id })
        .select("id")
        .single();
      if (error || !data) {
        setEstado("error");
        setMensaje(error?.message ?? "No se pudo guardar.");
        return;
      }
      setTramiteId(data.id);
      setEstado(nuevoStatus === "revisado" ? "revisado" : "guardado");
    },
    [supabase, valores, tramiteId, tramiteType.id]
  );

  const faltaObligatorio = tramiteType.field_schema.some(
    (c) => c.required && !valores[c.id]?.trim()
  );

  // Datos que la extensión NO va a pegar — se muestran en panel/notas.
  const camposPanel = tramiteType.field_schema.filter(
    (c) => c.portal_show_in_panel || c.portal_skip
  );

  return (
    <div className="grid gap-8">
      <div className="rounded-md border border-line bg-paper-2 p-4">
        <p className="eyebrow mb-2">Cómo se usa</p>
        <ol className="grid gap-1 text-sm text-ink-2 [counter-reset:step] list-decimal list-inside marker:text-ink-3">
          <li>Llena/revisa los campos abajo. Apoya con &quot;Cargar desde documentos extraídos&quot;.</li>
          <li>Click <strong className="text-ink">Marcar revisado</strong>. La extensión solo ve trámites marcados así.</li>
          <li>
            Abre el portal en Edge:{" "}
            {tramiteType.portal_url ? (
              <a
                href={tramiteType.portal_url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-ink underline underline-offset-4 hover:text-accent"
              >
                {tramiteType.portal_url}
              </a>
            ) : (
              <span>(URL del portal — pendiente)</span>
            )}
          </li>
          <li>Click en el ícono de la extensión → elige este trámite → &quot;Llenar formulario&quot;.</li>
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-paper-2 p-4">
        <button
          type="button"
          onClick={precargar}
          disabled={precargando || !supabase}
          className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink hover:bg-paper-2 disabled:text-ink-3"
        >
          {precargando ? "Buscando…" : "Cargar desde documentos extraídos"}
        </button>
        <span className="text-xs text-ink-3">
          Toma el último documento extraído de cada tipo fuente y rellena los campos vacíos.
        </span>
      </div>

      <form
        className="grid gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          guardar("revisado");
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
            disabled={estado === "guardando" || faltaObligatorio || !supabase}
            className="inline-flex min-h-[48px] items-center rounded-md bg-ink px-6 text-sm font-semibold text-paper hover:bg-ink-2 disabled:bg-ink-3"
          >
            {estado === "guardando" ? "Guardando…" : "Marcar revisado · listo para extensión"}
          </button>
          <button
            type="button"
            onClick={() => guardar("nuevo")}
            disabled={estado === "guardando" || !supabase}
            className="inline-flex min-h-[48px] items-center rounded-md border border-line bg-paper px-5 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
          >
            Guardar borrador
          </button>
          {estado === "revisado" && (
            <span className="text-sm text-ok">
              Listo. La extensión ya lo puede recoger.
            </span>
          )}
          {estado === "guardado" && (
            <span className="text-sm text-ink-2">Borrador guardado.</span>
          )}
          {faltaObligatorio && (
            <span className="text-sm text-ink-3">Faltan campos obligatorios.</span>
          )}
        </div>
      </form>

      {camposPanel.length > 0 && (
        <section className="rounded-md border border-accent/30 bg-accent-soft p-5">
          <p className="eyebrow mb-2 text-accent">Para pegar a mano en el portal</p>
          <p className="text-sm text-ink-2">
            Las tablas dinámicas del portal (personas autorizadas, productos,
            maquinaria, transporte, personal) y otros campos sin selector estable
            no se pegan automáticamente. Anota aquí las notas — la extensión
            mostrará este texto como recordatorio sobre el portal.
          </p>
        </section>
      )}

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
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-ink-2">
        {campo.label}
        {campo.required && <span className="text-accent">*</span>}
        {campo.portal_chain && (
          <span className="text-[10px] font-normal text-ink-3">
            (depende de {campo.portal_chain.parent})
          </span>
        )}
      </label>
      {esTextarea ? (
        <textarea
          id={id}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
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
