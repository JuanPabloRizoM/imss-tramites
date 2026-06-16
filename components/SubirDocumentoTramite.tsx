"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  listarDocTypes,
  obtenerDocType,
  type DatoExtraido,
} from "@/lib/extraccion";
import type { CampoSchema } from "@/lib/tramites";
import { redimensionarImagen } from "@/lib/imagen";
import {
  CONTEXTO_FORZADO_POR_DOC_TYPE,
  camposParaExtraccion,
  tramiteTieneTrabajador,
  type Contexto,
} from "@/lib/extraccion-contexto";

// Widget de subida de documentos con extracción dirigida por el schema del
// trámite. La IA solo busca los campos que el trámite pide; lo que no
// encuentre queda en null y no contamina el form.
//
// Mismo componente para apartado-1 (form de PDFs) y apartado-2 (form para
// pegar al portal con la extensión). Estructura:
//   1. Dropdown de tipo de documento (TIP, INE, Cédula RFC, Acta, etc., o
//      "Documento no especificado" como fallback).
//   2. Botón "Elegir archivo…" — acepta imágenes y PDFs, múltiple.
//   3. Lista de estados por archivo: Subiendo → Extrayendo → "✓ N campos
//      llenados" o Error.
//   4. Botón "Limpiar finalizados".
//
// Mecánica: subir → /api/extraer con `target_fields = schema` → trae
// extracted_data → llama `onExtraido(datos)` que el padre usa para llenar
// solo los campos vacíos del form (no pisa lo que ya escribió el usuario).

const TIPOS_DOC = listarDocTypes();

// Lista corta de labels para no inundar la fila: primeros 4 + "y N más".
function resumirLabels(labels: string[]): string {
  const max = 4;
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} y ${labels.length - max} más`;
}

type SubidaTramite = {
  localId: string;
  nombre: string;
  estado: "subiendo" | "procesando" | "listo" | "error";
  campos_aplicados?: number;
  // Labels de los target_fields que el documento NO trajo — feedback de
  // qué sigue faltando después de esta subida.
  faltantes?: string[];
  // Labels llenados con confianza media/baja — el usuario debe revisarlos
  // (típico: separación ambigua de nombre/apellidos, dígitos dudosos).
  dudosos?: string[];
  error?: string;
};

export function SubirDocumentoTramite({
  supabase,
  schema,
  onExtraido,
  tramiteCode,
  tramiteName,
  titulo = "Subir documento para autollenar",
  hint = "La IA va a buscar SOLO los campos que pide este trámite en el documento. Lo que no encuentre queda vacío para que lo llenes a mano. Si el documento es de un trabajador o de un patrón específicamente, elige a quién — la IA solo intentará rellenar esa columna del form.",
}: {
  supabase: SupabaseClient;
  schema: CampoSchema[];
  onExtraido: (datos: Record<string, DatoExtraido>) => number;
  // Si se pasan ambos, se habilita "Escanear desde el celular": se genera un
  // código de pareo amarrado a este trámite. El celular sube la foto sin
  // extraer y aquí se hace UNA sola extracción dirigida. Ver migración 0025.
  tramiteCode?: string;
  tramiteName?: string;
  titulo?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [docType, setDocType] = useState<string>("generico");
  const [contextoElegido, setContextoElegido] = useState<Contexto>("ambos");
  const [subidas, setSubidas] = useState<SubidaTramite[]>([]);

  // Si el doc_type fuerza un contexto, lo usamos. Si no, el usuario decide.
  // "representante" (INE rep) mapea a patrón para fines de filtrado.
  const contextoForzado = CONTEXTO_FORZADO_POR_DOC_TYPE[docType];
  const contextoEfectivo: Contexto = contextoForzado === "representante"
    ? "patron"
    : (contextoForzado ?? contextoElegido);
  // Solo preguntamos "Trabajador o Patrón" cuando el doc_type no lo fuerza
  // Y el trámite efectivamente tiene campos de trabajador (AFIL-01, AMSRT
  // y el apartado 2 son patron-only).
  const tieneTrabajador = useMemo(
    () => tramiteTieneTrabajador(schema),
    [schema]
  );
  const necesitaPreguntar = contextoForzado === undefined && tieneTrabajador;

  // target_fields filtrados al contexto elegido — la IA solo busca lo que
  // aplica a esa columna del form. camposParaExtraccion maneja también el
  // caso patron-only (devuelve todo el schema).
  const targetFields = useMemo(
    () =>
      camposParaExtraccion(schema, contextoEfectivo).map((c) => ({
        id: c.id,
        label: c.label,
      })),
    [schema, contextoEfectivo]
  );

  // target_fields para un doc_type arbitrario (el que eligió el celular).
  // Mismo criterio de contexto que el flujo de PC: si el doc_type fuerza
  // lado (TIP→patrón, etc.) se respeta; si no, usa lo elegido en el widget.
  const targetFieldsParaDocType = useCallback(
    (dt: string) => {
      const forzado = CONTEXTO_FORZADO_POR_DOC_TYPE[dt];
      const ctx: Contexto =
        forzado === "representante" ? "patron" : (forzado ?? contextoElegido);
      return camposParaExtraccion(schema, ctx).map((c) => ({
        id: c.id,
        label: c.label,
      }));
    },
    [schema, contextoElegido]
  );

  const actualizar = useCallback(
    (localId: string, patch: Partial<SubidaTramite>) =>
      setSubidas((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s))),
    []
  );

  // Feedback faltantes/dudosos común a la subida desde PC y desde celular.
  const calcularFeedback = useCallback(
    (datos: Record<string, DatoExtraido>, target: { id: string; label: string }[]) => {
      const faltantes: string[] = [];
      const dudosos: string[] = [];
      for (const f of target) {
        const d = datos[f.id];
        if (!d?.valor) faltantes.push(f.label);
        else if (d.confianza !== "alto") dudosos.push(f.label);
      }
      return { faltantes, dudosos };
    },
    []
  );

  const procesarUno = useCallback(
    async (file: File, localId: string) => {
      try {
        const esImagen = file.type.startsWith("image/");
        const esPdf =
          file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!esImagen && !esPdf) throw new Error("Solo imágenes (JPG/PNG/WebP/GIF) o PDF.");

        let blob: Blob;
        let nombre: string;
        let contentType: string;
        let ext: string;
        if (esImagen) {
          const r = await redimensionarImagen(file);
          blob = r.blob;
          nombre = r.nombre;
          contentType = "image/jpeg";
          ext = "jpg";
        } else {
          blob = file;
          nombre = file.name.replace(/[^\w.\-]/g, "_");
          contentType = "application/pdf";
          ext = "pdf";
        }

        const path = `${crypto.randomUUID()}-${nombre.endsWith(`.${ext}`) ? nombre : `${nombre}.${ext}`}`;
        const up = await supabase.storage
          .from("documentos")
          .upload(path, blob, { contentType, upsert: false });
        if (up.error) throw up.error;

        const ins = await supabase
          .from("documents")
          .insert({
            storage_path: path,
            doc_type: docType,
            extraction_status: "pendiente",
            session_id: null,
          })
          .select("id")
          .single();
        if (ins.error || !ins.data) throw ins.error ?? new Error("Insert vacío.");

        actualizar(localId, { estado: "procesando" });

        const res = await fetch("/api/extraer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: ins.data.id,
            target_fields: targetFields,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(j?.error ?? `Error de extracción (${res.status}).`);
        }

        const { data: docRow } = await supabase
          .from("documents")
          .select("extracted_data")
          .eq("id", ins.data.id)
          .single();
        const datos = (docRow?.extracted_data ?? {}) as Record<string, DatoExtraido>;
        const aplicados = onExtraido(datos);
        // Feedback por subida: qué target_fields no vinieron en el documento
        // y cuáles vinieron con confianza dudosa (revisar a mano).
        const { faltantes, dudosos } = calcularFeedback(datos, targetFields);
        actualizar(localId, {
          estado: "listo",
          campos_aplicados: aplicados,
          faltantes,
          dudosos,
        });
      } catch (err) {
        actualizar(localId, {
          estado: "error",
          error: err instanceof Error ? err.message : "Error desconocido.",
        });
      }
    },
    [supabase, docType, targetFields, actualizar, onExtraido, calcularFeedback]
  );

  const onArchivos = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const items: SubidaTramite[] = Array.from(files).map((f) => ({
        localId: crypto.randomUUID(),
        nombre: f.name,
        estado: "subiendo",
      }));
      setSubidas((prev) => [...items, ...prev].slice(0, 10));
      for (let i = 0; i < items.length; i++) await procesarUno(files[i], items[i].localId);
      if (inputRef.current) inputRef.current.value = "";
    },
    [procesarUno]
  );

  const limpiarFinalizadas = useCallback(() => {
    setSubidas((prev) => prev.filter((s) => s.estado !== "listo" && s.estado !== "error"));
  }, []);
  const hayFinalizadas = subidas.some((s) => s.estado === "listo" || s.estado === "error");

  // -------------------------------------------------------------------------
  // Escaneo desde el celular: pareo amarrado a este trámite + extracción
  // dirigida cuando llega la foto. El celular sube SIN extraer (lo decide al
  // ver que la sesión apunta a un trámite); aquí hacemos la única extracción.
  // -------------------------------------------------------------------------
  const habilitarCelular = !!tramiteCode && !!tramiteName;
  const [sesionCel, setSesionCel] = useState<{ id: string; code: string } | null>(null);
  const [iniciandoPareo, setIniciandoPareo] = useState(false);
  const [errorPareo, setErrorPareo] = useState<string | null>(null);

  // Procesa un documento ya subido por el celular (status "pendiente"): una
  // sola extracción dirigida + llenar el form. Reusa el feedback de la subida.
  const procesarEntrante = useCallback(
    async (docId: string, docTypeEntrante: string) => {
      const localId = crypto.randomUUID();
      const tipoLabel = obtenerDocType(docTypeEntrante).label;
      setSubidas((prev) =>
        [
          { localId, nombre: `Foto del celular · ${tipoLabel}`, estado: "procesando" as const },
          ...prev,
        ].slice(0, 10)
      );
      try {
        const target = targetFieldsParaDocType(docTypeEntrante);
        const res = await fetch("/api/extraer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: docId, target_fields: target }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(j?.error ?? `Error de extracción (${res.status}).`);
        }
        const { data: docRow } = await supabase
          .from("documents")
          .select("extracted_data")
          .eq("id", docId)
          .single();
        const datos = (docRow?.extracted_data ?? {}) as Record<string, DatoExtraido>;
        const aplicados = onExtraido(datos);
        const { faltantes, dudosos } = calcularFeedback(datos, target);
        actualizar(localId, { estado: "listo", campos_aplicados: aplicados, faltantes, dudosos });
      } catch (err) {
        actualizar(localId, {
          estado: "error",
          error: err instanceof Error ? err.message : "Error desconocido.",
        });
      }
    },
    [supabase, targetFieldsParaDocType, onExtraido, calcularFeedback, actualizar]
  );

  // Ref para que el canal realtime lea siempre la última versión (el contexto
  // trabajador/patrón puede cambiar después de mostrar el código).
  const procesarEntranteRef = useRef(procesarEntrante);
  useEffect(() => {
    procesarEntranteRef.current = procesarEntrante;
  }, [procesarEntrante]);

  const iniciarPareo = useCallback(async () => {
    if (!habilitarCelular) return;
    setIniciandoPareo(true);
    setErrorPareo(null);
    try {
      const res = await fetch("/api/pareo/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_tramite: { code: tramiteCode, name: tramiteName } }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const j = (await res.json()) as { id: string; code: string };
      setSesionCel({ id: j.id, code: j.code });
    } catch (err) {
      setErrorPareo(err instanceof Error ? err.message : "No se pudo generar el código.");
    } finally {
      setIniciandoPareo(false);
    }
  }, [habilitarCelular, tramiteCode, tramiteName]);

  // Realtime: foto del celular (pendiente, amarrada a esta sesión) → procesar
  // una sola vez. El Set de-dupe evita reprocesar si llegan eventos repetidos.
  const procesadosRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!sesionCel) return;
    const sid = sesionCel.id;
    type DocRT = {
      id: string;
      doc_type: string | null;
      extraction_status: string;
      session_id: string | null;
    };
    const intentar = (doc: DocRT) => {
      if (doc.session_id !== sid || doc.extraction_status !== "pendiente") return;
      if (procesadosRef.current.has(doc.id)) return;
      procesadosRef.current.add(doc.id);
      procesarEntranteRef.current(doc.id, doc.doc_type ?? "generico");
    };

    // Por si la foto llegó entre crear la sesión y suscribirnos.
    (async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, doc_type, extraction_status, session_id")
        .eq("session_id", sid)
        .eq("extraction_status", "pendiente");
      for (const d of (data ?? []) as DocRT[]) intentar(d);
    })();

    const channel = supabase
      .channel(`tramite-cel-${sid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "documents" },
        (payload) => intentar(payload.new as DocRT)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, sesionCel]);

  return (
    <section className="rounded-md border border-line bg-paper-2 p-5">
      <div className="mb-4">
        <p className="eyebrow">{titulo}</p>
        <p className="mt-1 text-xs text-ink-3">{hint}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-2">Tipo de documento</span>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="h-11 min-w-[260px] rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
          >
            {TIPOS_DOC.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {necesitaPreguntar && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink-2">¿De quién son los datos?</span>
            <select
              value={contextoElegido}
              onChange={(e) => setContextoElegido(e.target.value as Contexto)}
              className="h-11 min-w-[180px] rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
            >
              <option value="ambos">Ambos / no estoy seguro</option>
              <option value="trabajador">Trabajador</option>
              <option value="patron">Patrón</option>
            </select>
          </label>
        )}

        <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-md bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-2">
          Elegir archivo…
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            onChange={(e) => onArchivos(e.target.files)}
          />
        </label>

        {hayFinalizadas && (
          <button
            type="button"
            onClick={limpiarFinalizadas}
            className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
          >
            Limpiar finalizados
          </button>
        )}
      </div>

      {habilitarCelular && (
        <div className="mt-4 rounded-md border border-dashed border-line-2 bg-paper p-4">
          {!sesionCel ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={iniciarPareo}
                disabled={iniciandoPareo}
                className="inline-flex min-h-[44px] items-center rounded-md border border-ink bg-paper px-4 text-sm font-semibold text-ink hover:bg-paper-2 disabled:opacity-60"
              >
                {iniciandoPareo ? "Generando código…" : "Escanear desde el celular"}
              </button>
              <p className="text-xs text-ink-3">
                Toma la foto con el celular y los campos se llenan aquí solos. La
                IA lee solo los campos de este trámite — igual de barato que subir
                desde la PC.
              </p>
              {errorPareo && <p className="text-xs text-err">{errorPareo}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="eyebrow">Escanear desde el celular</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm text-ink-2">En el celular abre</span>
                <code className="rounded bg-paper-2 px-2 py-0.5 font-mono text-sm">/movil</code>
                <span className="text-sm text-ink-2">y escribe este código:</span>
                <span className="font-display text-3xl tracking-[0.3em] text-ink">
                  {sesionCel.code}
                </span>
              </div>
              <p className="text-xs text-ink-3">
                Cada foto que tomes se procesa aquí solo y llena los campos vacíos.
                Deja esta pantalla abierta.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSesionCel(null);
                  procesadosRef.current = new Set();
                }}
                className="self-start text-xs text-ink-3 underline-offset-2 hover:text-ink hover:underline"
              >
                Dejar de escanear
              </button>
            </div>
          )}
        </div>
      )}

      {subidas.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {subidas.map((s) => (
            <li
              key={s.localId}
              className="grid gap-1 rounded-md border border-line bg-paper px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-ink">{s.nombre}</span>
                <span className="shrink-0">
                  {s.estado === "subiendo" && <span className="text-ink-3">Subiendo…</span>}
                  {s.estado === "procesando" && <span className="text-warn">Extrayendo…</span>}
                  {s.estado === "listo" && (
                    <span className="text-ok">
                      ✓ {s.campos_aplicados ?? 0} campo{(s.campos_aplicados ?? 0) === 1 ? "" : "s"} llenado{(s.campos_aplicados ?? 0) === 1 ? "" : "s"}
                    </span>
                  )}
                  {s.estado === "error" && (
                    <span className="text-err" title={s.error}>
                      Error: {s.error}
                    </span>
                  )}
                </span>
              </div>
              {s.estado === "listo" && (s.dudosos?.length ?? 0) > 0 && (
                <p className="text-xs text-warn" title={s.dudosos!.join(", ")}>
                  ⚠ Revisa a mano: {resumirLabels(s.dudosos!)}
                </p>
              )}
              {s.estado === "listo" && (s.faltantes?.length ?? 0) > 0 && (
                <p className="text-xs text-ink-3" title={s.faltantes!.join(", ")}>
                  Este documento no trajo: {resumirLabels(s.faltantes!)} — llénalos
                  a mano o sube otro documento que los tenga.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
