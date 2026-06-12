"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ajustarASelect, precargarValores } from "@/lib/precarga";
import { SubirDocumentoTramite } from "@/components/SubirDocumentoTramite";

type Props = {
  tramiteType: TramiteType & { portal_url: string | null };
  // Datos extraídos del documento fuente cuando se llegó vía "Llevar a…".
  precarga?: Record<string, unknown> | null;
  // doc_type del documento fuente — desempata campos ambiguos vía el tag
  // source_doc del schema.
  precargaDocType?: string | null;
};
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

export function FormularioExtension({ tramiteType, precarga, precargaDocType }: Props) {
  const [supabase] = useState<SupabaseClient | null>(initSupabase);
  const [valores, setValores] = useState<Valores>(() => {
    const v = valoresIniciales(tramiteType.field_schema);
    // Precarga desde "Llevar a…" — precargarValores hace el match con
    // aliases y sufijos no ambiguos (ver lib/precarga.ts).
    if (precarga) {
      Object.assign(
        v,
        precargarValores(tramiteType.field_schema, precarga, precargaDocType)
      );
    }
    return v;
  });
  const [tramiteId, setTramiteId] = useState<string | null>(null);
  const [estado, setEstado] = useState<"idle" | "guardando" | "guardado" | "revisado" | "error">("idle");
  const [precargando, setPrecargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Solo los campos cuya condición show_if se cumple con los valores
  // actuales (p.ej. el centro de trabajo se oculta cuando "mismo
  // domicilio" está marcado). Lo oculto no se pinta, no bloquea
  // required, no se guarda ni se manda al portal.
  const schemaVisible = useMemo(
    () => tramiteType.field_schema.filter((c) => debeMostrar(c, valores)),
    [tramiteType.field_schema, valores]
  );
  const grupos = useMemo(() => agruparPorSeccion(schemaVisible), [schemaVisible]);

  // Texto compilado para pegar al portal cuando la extensión no esté
  // disponible. Aplica las mismas mayúsculas que la extensión (text → upcase;
  // textarea/date/select/etc. quedan tal cual). Solo incluye campos llenos.
  const textoParaPortal = useMemo(() => {
    const normalizados = normalizarParaSalida(schemaVisible, valores);
    const partes: string[] = [];
    for (const { seccion, campos } of grupos) {
      const llenos = campos.filter((c) => (normalizados[c.id] ?? "").trim() !== "");
      if (llenos.length === 0) continue;
      partes.push(`=== ${seccion.toUpperCase()} ===`);
      const ancho = Math.max(...llenos.map((c) => c.label.length));
      for (const c of llenos) {
        const v = (normalizados[c.id] ?? "").trim();
        partes.push(`${c.label.padEnd(ancho)}  ${v}`);
      }
      partes.push("");
    }
    return partes.join("\n").trimEnd();
  }, [grupos, valores, tramiteType.field_schema]);

  const copiarTodo = useCallback(async () => {
    if (!textoParaPortal) return;
    try {
      await navigator.clipboard.writeText(textoParaPortal);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "No se pudo copiar al portapapeles.");
    }
  }, [textoParaPortal]);

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

  // Auto-precarga al montar: si hay documentos extraídos, jala todo sin que
  // el usuario tenga que dar click. Corre una sola vez por sesión.
  const autoPrecargado = useRef(false);
  useEffect(() => {
    if (autoPrecargado.current || !supabase) return;
    autoPrecargado.current = true;
    precargar();
  }, [supabase, precargar]);

  // Aplica datos extraídos al form. Solo llena campos vacíos (no pisa lo
  // que el usuario ya capturó). El IA puede devolver valor=null para campos
  // que no encontró — esos los ignoramos.
  const aplicarDatosExtraidos = useCallback(
    (datos: Record<string, DatoExtraido>): number => {
      let aplicados = 0;
      setValores((prev) => {
        const out = { ...prev };
        for (const campo of tramiteType.field_schema) {
          const d = datos[campo.id];
          if (d?.valor && !out[campo.id]?.trim()) {
            // Selects: mapear al casing exacto de la option (la extensión
            // y el portal del IMSS los necesitan literales).
            const ajustado = ajustarASelect(campo, d.valor);
            if (ajustado === null) continue;
            out[campo.id] = ajustado;
            aplicados += 1;
          }
        }
        return out;
      });
      if (estado === "guardado" || estado === "revisado") setEstado("idle");
      return aplicados;
    },
    [tramiteType.field_schema, estado]
  );

  const guardar = useCallback(
    async (nuevoStatus: "revisado" | "nuevo") => {
      if (!supabase) return;
      setEstado("guardando");
      // MAYÚSCULAS para datos cortos antes de guardar: la extensión pega
      // estos valores tal cual en el portal del IMSS, y el IMSS los exige
      // así. textarea/date/select/etc. se preservan. Solo campos VISIBLES
      // (show_if) — si marcaste "mismo domicilio", los valores viejos del
      // centro de trabajo no viajan a la extensión.
      const normalizados = normalizarParaSalida(schemaVisible, valores);
      const payload = { field_values: normalizados, status: nuevoStatus };
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
    [supabase, valores, tramiteId, tramiteType.id, schemaVisible]
  );

  // Required ocultos por show_if no bloquean (p.ej. CP del centro de
  // trabajo cuando "mismo domicilio" está marcado).
  const faltaObligatorio = schemaVisible.some(
    (c) => c.required && !valores[c.id]?.trim()
  );

  // Datos que la extensión NO va a pegar — se muestran en panel/notas.
  const camposPanel = schemaVisible.filter(
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

      {supabase && (
        <SubirDocumentoTramite
          supabase={supabase}
          schema={tramiteType.field_schema}
          onExtraido={aplicarDatosExtraidos}
        />
      )}

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

      <section className="rounded-md border border-line bg-paper-2 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Copiar todo para pegar al portal</p>
            <p className="mt-1 text-xs text-ink-3">
              Alternativa por si la extensión no está disponible: copia este
              bloque al portapapeles y pega cada valor a mano en su campo del
              portal. Ya viene en MAYÚSCULAS donde aplica.
            </p>
          </div>
          <button
            type="button"
            onClick={copiarTodo}
            disabled={!textoParaPortal}
            className="inline-flex min-h-[44px] items-center rounded-md bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-2 disabled:bg-ink-3"
          >
            {copiado ? "✓ Copiado" : "Copiar todo"}
          </button>
        </div>
        <textarea
          readOnly
          value={textoParaPortal || "(Sin datos capturados todavía.)"}
          rows={Math.min(14, Math.max(4, textoParaPortal.split("\n").length))}
          className="w-full rounded-md border border-line bg-paper px-3 py-2 font-mono text-xs text-ink"
          onFocus={(e) => e.currentTarget.select()}
        />
      </section>

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
  const esCheckbox = campo.type === "checkbox";
  const html =
    campo.type === "date"
      ? "date"
      : campo.type === "number"
      ? "number"
      : "text";

  // Checkbox: guarda "true"/"" — la extensión interpreta "true" como
  // marcado (#chkCopiarDomicilio del portal), y los show_if con
  // distinto:"true" ocultan secciones cuando está activo.
  if (esCheckbox) {
    return (
      <label
        htmlFor={id}
        className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-line bg-paper px-3 text-sm font-medium text-ink md:col-span-2"
      >
        <input
          id={id}
          type="checkbox"
          checked={valor === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "")}
          className="h-5 w-5 accent-current"
        />
        {campo.label}
      </label>
    );
  }

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
