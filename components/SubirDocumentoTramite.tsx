"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  listarDocTypes,
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

type SubidaTramite = {
  localId: string;
  nombre: string;
  estado: "subiendo" | "procesando" | "listo" | "error";
  campos_aplicados?: number;
  error?: string;
};

export function SubirDocumentoTramite({
  supabase,
  schema,
  onExtraido,
  titulo = "Subir documento para autollenar",
  hint = "La IA va a buscar SOLO los campos que pide este trámite en el documento. Lo que no encuentre queda vacío para que lo llenes a mano. Si el documento es de un trabajador o de un patrón específicamente, elige a quién — la IA solo intentará rellenar esa columna del form.",
}: {
  supabase: SupabaseClient;
  schema: CampoSchema[];
  onExtraido: (datos: Record<string, DatoExtraido>) => number;
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

  const actualizar = useCallback(
    (localId: string, patch: Partial<SubidaTramite>) =>
      setSubidas((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s))),
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
        actualizar(localId, { estado: "listo", campos_aplicados: aplicados });
      } catch (err) {
        actualizar(localId, {
          estado: "error",
          error: err instanceof Error ? err.message : "Error desconocido.",
        });
      }
    },
    [supabase, docType, targetFields, actualizar, onExtraido]
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

      {subidas.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {subidas.map((s) => (
            <li
              key={s.localId}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-paper px-3 py-2 text-sm"
            >
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
