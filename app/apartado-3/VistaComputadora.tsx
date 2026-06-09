"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserClient } from "@/lib/supabase/client";
import { useSesionId } from "@/lib/pareo-cliente";
import {
  obtenerDocType,
  esFilaArray,
  type DatoExtraido,
  type DocType,
  type FilaExtraida,
} from "@/lib/extraccion";
import { redimensionarImagen } from "@/lib/imagen";
import type { CampoSchema, TramiteType } from "@/lib/tramites";
import { camposParaExtraccion, contextoEfectivo } from "@/lib/extraccion-contexto";
import {
  ModalContextoExtraccion,
  type OpcionesExtraccion,
} from "@/components/ModalContextoExtraccion";

type ExtractedValue = DatoExtraido | FilaExtraida[];

type DocumentRow = {
  id: string;
  storage_path: string;
  doc_type: string | null;
  extracted_data: Record<string, ExtractedValue> | null;
  extraction_status: "pendiente" | "procesando" | "listo" | "error";
  extraction_error: string | null;
  image_deleted_at: string | null;
  session_id: string | null;
  created_at: string;
};

function initSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  return getBrowserClient();
}

type TramiteListItem = Pick<
  TramiteType,
  "id" | "code" | "name" | "apartado" | "field_schema"
>;

export function VistaComputadora({
  tramites,
}: {
  tramites: TramiteListItem[];
}) {
  const [supabase] = useState<SupabaseClient | null>(initSupabase);
  const sesionId = useSesionId();
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [seleccionManual, setSeleccionManual] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const searchParams = useSearchParams();

  // Si la URL viene con ?doc=<id>, preselecciona ese documento.
  const docDesdeUrl = searchParams.get("doc");

  // Esta computadora muestra:
  //   1) Documentos pareados a esta sesión (session_id == sesionId).
  //   2) Documentos huérfanos (session_id IS NULL): fallback cuando la
  //      sesión origen ya no existe — visibles para todas las computadoras.
  // Postgres realtime no permite filtro OR; suscribimos sin filtro y
  // descartamos en cliente lo que no nos toca.
  const documentoMeCorresponde = useCallback(
    (d: { session_id: string | null }) =>
      d.session_id === null || (sesionId !== null && d.session_id === sesionId),
    [sesionId]
  );

  useEffect(() => {
    if (!supabase || sesionId === null) return;
    let cancelado = false;

    (async () => {
      // Trae lo nuestro + lo huérfano (.or filtra por OR en PostgREST).
      const { data } = await supabase
        .from("documents")
        .select(
          "id, storage_path, doc_type, extracted_data, extraction_status, extraction_error, image_deleted_at, session_id, created_at"
        )
        .or(`session_id.eq.${sesionId},session_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (cancelado) return;
      setDocs((data as DocumentRow[]) ?? []);
      setCargando(false);
    })();

    const channel = supabase
      .channel(`documents-feed-${sesionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        (payload) => {
          setDocs((prev) => {
            if (payload.eventType === "INSERT") {
              const nuevo = payload.new as DocumentRow;
              if (!documentoMeCorresponde(nuevo)) return prev;
              if (prev.some((d) => d.id === nuevo.id)) return prev;
              return [nuevo, ...prev].slice(0, 50);
            }
            if (payload.eventType === "UPDATE") {
              const upd = payload.new as DocumentRow;
              if (!documentoMeCorresponde(upd)) {
                // Cambió a otra sesión — sácalo si estaba.
                return prev.filter((d) => d.id !== upd.id);
              }
              const existia = prev.some((d) => d.id === upd.id);
              if (!existia) return [upd, ...prev].slice(0, 50);
              return prev.map((d) => (d.id === upd.id ? upd : d));
            }
            if (payload.eventType === "DELETE") {
              const del = payload.old as { id: string };
              return prev.filter((d) => d.id !== del.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      cancelado = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, sesionId, documentoMeCorresponde]);

  // Selección efectiva: query param > manual > primero.
  const seleccionId = useMemo(() => {
    if (docDesdeUrl && docs.some((d) => d.id === docDesdeUrl)) {
      return docDesdeUrl;
    }
    if (seleccionManual && docs.some((d) => d.id === seleccionManual)) {
      return seleccionManual;
    }
    return docs[0]?.id ?? null;
  }, [docDesdeUrl, seleccionManual, docs]);

  const seleccion = docs.find((d) => d.id === seleccionId) ?? null;

  if (!supabase) {
    return (
      <div className="rounded-md border border-line bg-paper-2 p-4 text-sm text-ink-3">
        Cargando…
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <SubirDesdePc
        supabase={supabase}
        sesionId={sesionId}
        tramites={tramites}
        onSubido={(id) => setSeleccionManual(id)}
      />
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <ListaDocumentos
          docs={docs}
          cargando={cargando}
          seleccionId={seleccionId}
          onSelect={setSeleccionManual}
        />
        <DetalleDocumento
        key={seleccion?.id ?? "vacio"}
        documento={seleccion}
        supabase={supabase}
        onReintentar={async (id) => {
          await fetch("/api/extraer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: id }),
          });
        }}
        onEliminado={(id) => {
          if (seleccionManual === id) setSeleccionManual(null);
        }}
      />
      </div>
    </div>
  );
}

// Subida desde la PC — mismo flujo que CapturaCelular.tsx pero sin pareo.
// Acepta múltiples archivos (imágenes y PDFs) y los procesa en secuencia.
// Por archivo: resize (solo imágenes) → upload a storage → insert documents
// → POST /api/extraer. Cada uno aparece en la Lista de la izquierda via
// realtime subscription, no se duplica.

type SubidaPc = {
  localId: string;
  nombre: string;
  estado: "subiendo" | "procesando" | "listo" | "error";
  documentId?: string;
  error?: string;
};

type EstadoModal =
  | { tipo: "cerrado" }
  | { tipo: "abierto"; archivos: File[] };

function SubirDesdePc({
  supabase,
  sesionId,
  tramites,
  onSubido,
}: {
  supabase: SupabaseClient;
  sesionId: string | null;
  tramites: TramiteListItem[];
  onSubido: (documentId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [subidas, setSubidas] = useState<SubidaPc[]>([]);
  const [modal, setModal] = useState<EstadoModal>({ tipo: "cerrado" });

  const actualizar = useCallback(
    (localId: string, patch: Partial<SubidaPc>) =>
      setSubidas((prev) =>
        prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s))
      ),
    []
  );

  const procesarUno = useCallback(
    async (
      file: File,
      localId: string,
      opts: OpcionesExtraccion,
      targetFields: { id: string; label: string }[] | null
    ) => {
      try {
        const esImagen = file.type.startsWith("image/");
        const esPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        if (!esImagen && !esPdf) {
          throw new Error("Solo imágenes (JPG/PNG/WebP/GIF) o PDF.");
        }

        // Imágenes: resize antes de subir (1600 px lado largo, JPEG q=0.8).
        // PDFs: van tal cual (el extractor ya soporta multipágina hasta 6 pp).
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

        // Insertar con session_id de la PC. Si la sesión no existe (raro en
        // PC porque PareoProvider la crea), cae a null.
        let ins = await supabase
          .from("documents")
          .insert({
            storage_path: path,
            doc_type: opts.docType,
            extraction_status: "pendiente",
            session_id: sesionId,
          })
          .select("id")
          .single();
        if (ins.error && (ins.error as { code?: string }).code === "23503") {
          ins = await supabase
            .from("documents")
            .insert({
              storage_path: path,
              doc_type: opts.docType,
              extraction_status: "pendiente",
              session_id: null,
            })
            .select("id")
            .single();
        }
        if (ins.error || !ins.data) throw ins.error ?? new Error("Insert vacío.");

        actualizar(localId, { estado: "procesando", documentId: ins.data.id });

        // Si el usuario eligió un trámite destino, mandamos target_fields
        // para que el motor extraiga solo (y todos) esos campos. Si eligió
        // "Ninguno", target_fields va undefined y se cae al doc_type fijo.
        const body: Record<string, unknown> = { documentId: ins.data.id };
        if (targetFields && targetFields.length > 0) {
          body.target_fields = targetFields;
        }

        const res = await fetch("/api/extraer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(j?.error ?? `Error de extracción (${res.status}).`);
        }

        actualizar(localId, { estado: "listo" });
        onSubido(ins.data.id);
      } catch (err) {
        actualizar(localId, {
          estado: "error",
          error: err instanceof Error ? err.message : "Error desconocido.",
        });
      }
    },
    [supabase, sesionId, actualizar, onSubido]
  );

  // Click en "Elegir archivos…" → solo guarda los archivos y abre el modal.
  // El procesamiento arranca después de que el usuario confirme las opciones.
  const onArchivos = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setModal({ tipo: "abierto", archivos: Array.from(files) });
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const cancelarModal = useCallback(() => {
    setModal({ tipo: "cerrado" });
  }, []);

  const confirmarModal = useCallback(
    async (opts: OpcionesExtraccion) => {
      if (modal.tipo !== "abierto") return;
      const archivos = modal.archivos;
      setModal({ tipo: "cerrado" });

      // Calcular target_fields si hay trámite. camposParaExtraccion ya
      // maneja: (a) trámites patron-only → todo el schema, (b) trámites
      // con ambos lados → filtra por el contexto efectivo (TIP/Acta/INE
      // rep fuerzan patron; otros usan lo elegido por el usuario).
      let targetFields: { id: string; label: string }[] | null = null;
      if (opts.tramiteCode) {
        const tramite = tramites.find((t) => t.code === opts.tramiteCode);
        if (tramite?.field_schema) {
          const ctx = contextoEfectivo(opts.docType, opts.contexto);
          const schema = (tramite.field_schema as CampoSchema[]) ?? [];
          targetFields = camposParaExtraccion(schema, ctx).map((c) => ({
            id: c.id,
            label: c.label,
          }));
        }
      }

      const items: SubidaPc[] = archivos.map((f) => ({
        localId: `${crypto.randomUUID()}`,
        nombre: f.name,
        estado: "subiendo",
      }));
      setSubidas((prev) => [...items, ...prev].slice(0, 20));
      // Procesar en secuencia — el extractor (Anthropic) no quiere ráfagas.
      for (let i = 0; i < items.length; i++) {
        await procesarUno(archivos[i], items[i].localId, opts, targetFields);
      }
    },
    [modal, tramites, procesarUno]
  );

  const limpiarFinalizadas = useCallback(() => {
    setSubidas((prev) => prev.filter((s) => s.estado !== "listo" && s.estado !== "error"));
  }, []);

  const hayFinalizadas = subidas.some(
    (s) => s.estado === "listo" || s.estado === "error"
  );

  return (
    <section className="rounded-md border border-line bg-paper-2 p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Subir desde esta computadora</p>
          <p className="mt-1 text-xs text-ink-3">
            Alternativa a la cámara del celular. Acepta JPG, PNG, WebP, GIF y
            PDF (hasta 6 páginas). Puedes subir varios archivos a la vez.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-md bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-2">
          Elegir archivos…
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            onChange={(e) => onArchivos(e.target.files)}
          />
        </label>
        <p className="text-xs text-ink-3">
          Al elegir archivos te preguntamos para qué trámite son, para que la IA
          extraiga más datos.
        </p>

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
                {s.estado === "subiendo" && (
                  <span className="text-ink-3">Subiendo…</span>
                )}
                {s.estado === "procesando" && (
                  <span className="text-warn">Extrayendo…</span>
                )}
                {s.estado === "listo" && <span className="text-ok">✓ Listo</span>}
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

      <ModalContextoExtraccion
        isOpen={modal.tipo === "abierto"}
        archivos={modal.tipo === "abierto" ? modal.archivos : []}
        tramites={tramites}
        onConfirmar={confirmarModal}
        onCancelar={cancelarModal}
      />
    </section>
  );
}

function ListaDocumentos({
  docs,
  cargando,
  seleccionId,
  onSelect,
}: {
  docs: DocumentRow[];
  cargando: boolean;
  seleccionId: string | null;
  onSelect: (id: string) => void;
}) {
  if (cargando) {
    return (
      <aside className="rounded-md border border-line bg-paper-2 p-4 text-sm text-ink-3">
        Cargando…
      </aside>
    );
  }
  if (docs.length === 0) {
    return (
      <aside className="rounded-md border border-dashed border-line-2 bg-paper-2 p-4 text-sm text-ink-2">
        <p className="eyebrow mb-2">Sin documentos</p>
        Sube un archivo arriba (PC) o toma una foto desde{" "}
        <code className="rounded bg-paper px-1 py-0.5 font-mono text-xs">/movil</code>.
      </aside>
    );
  }
  return (
    <aside className="rounded-md border border-line bg-paper-2">
      <ul className="divide-y divide-line">
        {docs.map((d) => {
          const tipo = obtenerDocType(d.doc_type);
          const esActivo = d.id === seleccionId;
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onSelect(d.id)}
                className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left text-sm transition-colors hover:bg-paper ${
                  esActivo ? "bg-paper" : ""
                }`}
              >
                <span className="font-medium text-ink">{tipo.label}</span>
                <span className="text-xs text-ink-3">
                  {new Date(d.created_at).toLocaleString("es-MX")}
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  <EstadoChip estado={d.extraction_status} />
                  {d.image_deleted_at && (
                    <span
                      className="inline-flex items-center rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-medium tracking-wide text-ink-3"
                      title="La foto fue eliminada; solo quedan los datos extraídos."
                    >
                      Sin foto
                    </span>
                  )}
                  {d.session_id === null && (
                    <span
                      className="inline-flex items-center rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-medium tracking-wide text-ink-3"
                      title="Sesión cerrada antes de que llegara el upload. Visible para todas las computadoras."
                    >
                      Sesión cerrada · captura disponible para todos
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function EstadoChip({ estado }: { estado: DocumentRow["extraction_status"] }) {
  const map: Record<DocumentRow["extraction_status"], { txt: string; cls: string }> = {
    pendiente: { txt: "Pendiente", cls: "bg-paper-2 text-ink-2 border border-line" },
    procesando: { txt: "Procesando", cls: "bg-warn-soft text-ink" },
    listo: { txt: "Listo", cls: "bg-ok-soft text-ok" },
    error: { txt: "Error", cls: "bg-err-soft text-err" },
  };
  const { txt, cls } = map[estado];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${cls}`}
    >
      {txt}
    </span>
  );
}

function DetalleDocumento({
  documento,
  supabase,
  onReintentar,
  onEliminado,
}: {
  documento: DocumentRow | null;
  supabase: SupabaseClient;
  onReintentar: (id: string) => Promise<void>;
  onEliminado: (id: string) => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  // Overrides para campos planos (uno por campo).
  const [overridesCampos, setOverridesCampos] = useState<Record<string, DatoExtraido>>({});
  // Tabla editable: copia de la tabla extraída + cambios del usuario.
  // Si el doc_type no tiene tabla, queda como [].
  const [filasEditadas, setFilasEditadas] = useState<FilaExtraida[]>(() =>
    extraerFilasIniciales(documento)
  );
  const [guardando, setGuardando] = useState<"idle" | "guardando" | "guardado">(
    "idle"
  );
  // "borrando-foto" libera Storage pero conserva los datos; "eliminando-todo"
  // borra también el row.
  const [accionEliminar, setAccionEliminar] = useState<
    "idle" | "borrando-foto" | "eliminando-todo"
  >("idle");
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const ocupadoEliminando = accionEliminar !== "idle";
  const imagenBorrada = documento?.image_deleted_at != null;

  const tipo: DocType = useMemo(
    () => obtenerDocType(documento?.doc_type ?? null),
    [documento?.doc_type]
  );

  // Datos planos combinados (extracción + overrides).
  const datosPlanos = useMemo<Record<string, DatoExtraido>>(() => {
    const out: Record<string, DatoExtraido> = {};
    if (documento?.extracted_data) {
      for (const [k, v] of Object.entries(documento.extracted_data)) {
        if (!esFilaArray(v)) out[k] = v;
      }
    }
    return { ...out, ...overridesCampos };
  }, [documento, overridesCampos]);

  // Imagen firmada (bucket privado). Si image_deleted_at != null el objeto ya
  // no existe en Storage — saltamos la llamada para no generar 404s.
  useEffect(() => {
    if (!documento || documento.image_deleted_at) {
      setSignedUrl(null);
      return;
    }
    let cancelado = false;
    (async () => {
      const { data } = await supabase.storage
        .from("documentos")
        .createSignedUrl(documento.storage_path, 60 * 30);
      if (!cancelado) setSignedUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancelado = true;
    };
  }, [documento, supabase]);

  // Borra solo la foto del Storage para liberar espacio. Los datos extraídos
  // quedan en la tabla — el row sigue visible en la lista.
  const borrarFoto = useCallback(async () => {
    if (!documento || imagenBorrada) return;
    const ok = window.confirm(
      "¿Borrar la foto? Se libera el almacenamiento; los datos extraídos se quedan en la lista y los puedes seguir editando."
    );
    if (!ok) return;
    setAccionEliminar("borrando-foto");
    setErrorEliminar(null);

    const stRes = await supabase.storage
      .from("documentos")
      .remove([documento.storage_path]);
    if (stRes.error) {
      setErrorEliminar(stRes.error.message);
      setAccionEliminar("idle");
      return;
    }
    const dbRes = await supabase
      .from("documents")
      .update({ image_deleted_at: new Date().toISOString() })
      .eq("id", documento.id);
    if (dbRes.error) {
      setErrorEliminar(dbRes.error.message);
      setAccionEliminar("idle");
      return;
    }
    setSignedUrl(null);
    setAccionEliminar("idle");
  }, [documento, supabase, imagenBorrada]);

  // Elimina el registro completo: foto (si aún hay) + row de la tabla.
  const eliminarRegistro = useCallback(async () => {
    if (!documento) return;
    const ok = window.confirm(
      "¿Eliminar este documento por completo? Se borran la foto y los datos extraídos. No se puede recuperar."
    );
    if (!ok) return;
    setAccionEliminar("eliminando-todo");
    setErrorEliminar(null);

    if (!imagenBorrada) {
      const stRes = await supabase.storage
        .from("documentos")
        .remove([documento.storage_path]);
      if (stRes.error) {
        setErrorEliminar(stRes.error.message);
        setAccionEliminar("idle");
        return;
      }
    }
    const dbRes = await supabase
      .from("documents")
      .delete()
      .eq("id", documento.id);
    if (dbRes.error) {
      setErrorEliminar(dbRes.error.message);
      setAccionEliminar("idle");
      return;
    }
    onEliminado(documento.id);
  }, [documento, supabase, imagenBorrada, onEliminado]);

  const guardar = useCallback(async () => {
    if (!documento) return;
    setGuardando("guardando");
    const nuevoExtracted: Record<string, ExtractedValue> = { ...datosPlanos };
    if (tipo.tabla) {
      nuevoExtracted[tipo.tabla.id] = filasEditadas;
    }
    await supabase
      .from("documents")
      .update({ extracted_data: nuevoExtracted })
      .eq("id", documento.id);
    setGuardando("guardado");
  }, [documento, datosPlanos, filasEditadas, tipo.tabla, supabase]);

  if (!documento) {
    return (
      <div className="rounded-md border border-dashed border-line-2 bg-paper-2 p-10 text-center text-sm text-ink-2">
        Selecciona un documento de la izquierda.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-md border border-line bg-paper-2 p-3">
          {imagenBorrada ? (
            <div className="flex h-64 flex-col items-center justify-center gap-1 text-center text-sm text-ink-3">
              <p className="font-medium text-ink-2">Foto eliminada</p>
              <p className="text-xs">
                Los datos extraídos siguen disponibles y se pueden editar.
              </p>
            </div>
          ) : signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt="Documento subido"
              className="h-auto w-full rounded-sm"
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-ink-3">
              Cargando imagen…
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <p className="eyebrow">{tipo.label}</p>
            <EstadoChip estado={documento.extraction_status} />
          </div>

          {documento.extraction_status === "error" && (
            <div role="alert" className="rounded-md border border-err/30 bg-err-soft p-4">
              <p className="text-sm font-medium text-err">Falló la extracción</p>
              <p className="mt-1 text-sm text-ink-2">
                {documento.extraction_error ?? "Sin detalles."}
              </p>
              <button
                type="button"
                onClick={() => onReintentar(documento.id)}
                className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink hover:bg-paper-2"
              >
                Reintentar extracción
              </button>
            </div>
          )}

          {(documento.extraction_status === "pendiente" ||
            documento.extraction_status === "procesando") && (
            <p className="text-sm text-ink-2">
              La IA está leyendo el documento. Aparecerá aquí en cuanto termine.
            </p>
          )}

          {documento.extraction_status === "listo" && (
            <CamposPlanos
              tipo={tipo}
              datos={datosPlanos}
              setOverride={(id, valor) =>
                setOverridesCampos((prev) => ({
                  ...prev,
                  [id]: {
                    valor: valor || null,
                    confianza:
                      prev[id]?.confianza ??
                      (documento.extracted_data?.[id] as DatoExtraido | undefined)?.confianza ??
                      "medio",
                  },
                }))
              }
            />
          )}
        </div>
      </div>

      {/* Tabla de filas, debajo de la imagen+campos para que tenga ancho completo */}
      {documento.extraction_status === "listo" && tipo.tabla && (
        <TablaFilas
          tabla={tipo.tabla}
          filas={filasEditadas}
          onChange={setFilasEditadas}
        />
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        {documento.extraction_status === "listo" && (
          <>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando === "guardando" || ocupadoEliminando}
              className="inline-flex min-h-[44px] items-center rounded-md bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-2 disabled:bg-ink-3"
            >
              {guardando === "guardando" ? "Guardando…" : "Guardar correcciones"}
            </button>
            {guardando === "guardado" && (
              <span className="text-sm text-ok">Guardado.</span>
            )}
            {!imagenBorrada && (
              <button
                type="button"
                onClick={() => onReintentar(documento.id)}
                disabled={ocupadoEliminando}
                className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink disabled:text-ink-3"
              >
                Reextraer
              </button>
            )}
          </>
        )}
        <Link
          href="/movil"
          className="ml-auto inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink hover:bg-paper-2"
        >
          + Escanear otra hoja
        </Link>
        {!imagenBorrada && (
          <button
            type="button"
            onClick={borrarFoto}
            disabled={ocupadoEliminando}
            className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink disabled:text-ink-3"
            title="Libera el almacenamiento. Conserva los datos extraídos."
          >
            {accionEliminar === "borrando-foto" ? "Borrando foto…" : "Borrar foto"}
          </button>
        )}
        <button
          type="button"
          onClick={eliminarRegistro}
          disabled={ocupadoEliminando}
          className="inline-flex min-h-[44px] items-center rounded-md border border-err/40 bg-paper px-4 text-sm font-medium text-err hover:bg-err-soft disabled:opacity-60"
          title="Borra foto y datos. Irreversible."
        >
          {accionEliminar === "eliminando-todo"
            ? "Eliminando…"
            : "Eliminar todo"}
        </button>
      </div>
      {errorEliminar && (
        <p className="text-sm text-err">No se pudo eliminar: {errorEliminar}</p>
      )}
    </div>
  );
}

function extraerFilasIniciales(documento: DocumentRow | null): FilaExtraida[] {
  if (!documento?.extracted_data) return [];
  for (const v of Object.values(documento.extracted_data)) {
    if (esFilaArray(v)) return v;
  }
  return [];
}

function CamposPlanos({
  tipo,
  datos,
  setOverride,
}: {
  tipo: DocType;
  datos: Record<string, DatoExtraido>;
  setOverride: (id: string, valor: string) => void;
}) {
  return (
    <div className="grid gap-4">
      {tipo.campos.map((campo) => {
        const dato = datos[campo.id] ?? { valor: null, confianza: "bajo" as const };
        const valor = dato.valor ?? "";
        const inputId = `c-${campo.id}`;
        return (
          <div key={campo.id} className="flex flex-col gap-1">
            <label
              htmlFor={inputId}
              className="flex items-center gap-2 text-sm font-medium text-ink-2"
            >
              {campo.label}
              <ConfianzaTag valor={dato.confianza} />
            </label>
            <input
              id={inputId}
              type="text"
              value={valor}
              onChange={(e) => setOverride(campo.id, e.target.value)}
              className="h-11 rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
            />
          </div>
        );
      })}
    </div>
  );
}

function TablaFilas({
  tabla,
  filas,
  onChange,
}: {
  tabla: NonNullable<DocType["tabla"]>;
  filas: FilaExtraida[];
  onChange: (f: FilaExtraida[]) => void;
}) {
  const filaVacia = (): FilaExtraida => {
    const f: FilaExtraida = {};
    for (const c of tabla.columnas) {
      f[c.id] = { valor: null, confianza: "bajo" };
    }
    return f;
  };

  const setCelda = (idx: number, colId: string, valor: string) => {
    const nuevas = [...filas];
    const fila = { ...nuevas[idx] };
    fila[colId] = {
      valor: valor || null,
      confianza: fila[colId]?.confianza ?? "medio",
    };
    nuevas[idx] = fila;
    onChange(nuevas);
  };

  const agregarFila = () => onChange([...filas, filaVacia()]);
  const eliminarFila = (idx: number) =>
    onChange(filas.filter((_, i) => i !== idx));

  return (
    <section className="rounded-md border border-line bg-paper-2 p-4">
      <header className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{tabla.label}</p>
          <p className="text-xs text-ink-3">
            {filas.length} fila{filas.length === 1 ? "" : "s"}
            {tabla.descripcion ? ` · ${tabla.descripcion}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={agregarFila}
          className="inline-flex min-h-[36px] items-center rounded-md border border-line bg-paper px-3 text-sm font-medium text-ink hover:bg-paper-2"
        >
          + Agregar fila
        </button>
      </header>

      {filas.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-2 bg-paper p-6 text-center text-sm text-ink-3">
          No se detectó ninguna fila. Si el documento sí tiene una tabla, prueba a reextraer o agrega filas a mano.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-2 py-2 text-xs font-medium text-ink-3">#</th>
                {tabla.columnas.map((c) => (
                  <th
                    key={c.id}
                    className="whitespace-nowrap px-2 py-2 text-xs font-medium text-ink-3"
                    title={c.hint}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, idx) => (
                <tr key={idx} className="border-b border-line last:border-b-0">
                  <td className="px-2 py-2 text-xs text-ink-3">{idx + 1}</td>
                  {tabla.columnas.map((c) => {
                    const dato = fila[c.id] ?? { valor: null, confianza: "bajo" as const };
                    return (
                      <td key={c.id} className="px-1 py-1 align-top">
                        <input
                          type="text"
                          value={dato.valor ?? ""}
                          onChange={(e) => setCelda(idx, c.id, e.target.value)}
                          className={`h-8 w-full min-w-[110px] rounded border border-line bg-paper px-2 text-sm text-ink focus-visible:border-ink ${
                            dato.confianza === "bajo"
                              ? "border-err/40"
                              : dato.confianza === "medio"
                              ? "border-warn/40"
                              : ""
                          }`}
                          title={`Confianza ${dato.confianza}`}
                        />
                      </td>
                    );
                  })}
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => eliminarFila(idx)}
                      aria-label="Eliminar fila"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border border-line bg-paper text-ink-3 hover:border-err hover:text-err"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ConfianzaTag({ valor }: { valor: DatoExtraido["confianza"] }) {
  const map: Record<DatoExtraido["confianza"], { txt: string; cls: string }> = {
    alto: { txt: "alta", cls: "bg-ok-soft text-ok" },
    medio: { txt: "media", cls: "bg-warn-soft text-ink-2" },
    bajo: { txt: "baja", cls: "bg-err-soft text-err" },
  };
  const { txt, cls } = map[valor];
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${cls}`}
    >
      confianza {txt}
    </span>
  );
}
