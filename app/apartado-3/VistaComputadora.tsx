"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserClient } from "@/lib/supabase/client";
import { obtenerDocType, type DatoExtraido } from "@/lib/extraccion";

type DocumentRow = {
  id: string;
  storage_path: string;
  doc_type: string | null;
  extracted_data: Record<string, DatoExtraido> | null;
  extraction_status: "pendiente" | "procesando" | "listo" | "error";
  extraction_error: string | null;
  created_at: string;
};

// Cliente perezoso con guarda de SSR: en el servidor devuelve null para que
// la página pueda prerenderizarse sin tocar env vars del navegador.
function initSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  return getBrowserClient();
}

export function VistaComputadora() {
  const [supabase] = useState<SupabaseClient | null>(initSupabase);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [seleccionManual, setSeleccionManual] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    let cancelado = false;
    (async () => {
      const { data } = await supabase
        .from("documents")
        .select(
          "id, storage_path, doc_type, extracted_data, extraction_status, extraction_error, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (cancelado) return;
      setDocs((data as DocumentRow[]) ?? []);
      setCargando(false);
    })();

    const channel = supabase
      .channel("documents-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        (payload) => {
          setDocs((prev) => {
            if (payload.eventType === "INSERT") {
              const nuevo = payload.new as DocumentRow;
              if (prev.some((d) => d.id === nuevo.id)) return prev;
              return [nuevo, ...prev].slice(0, 50);
            }
            if (payload.eventType === "UPDATE") {
              const upd = payload.new as DocumentRow;
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
  }, [supabase]);

  // Selección efectiva: lo seleccionado a mano o el primero.
  const seleccionId = useMemo(() => {
    if (seleccionManual && docs.some((d) => d.id === seleccionManual)) {
      return seleccionManual;
    }
    return docs[0]?.id ?? null;
  }, [seleccionManual, docs]);

  const seleccion = docs.find((d) => d.id === seleccionId) ?? null;

  if (!supabase) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
        Cargando...
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <ListaDocumentos
        docs={docs}
        cargando={cargando}
        seleccionId={seleccionId}
        onSelect={setSeleccionManual}
      />
      <DetalleDocumento
        // key fuerza el remontaje al cambiar el documento → resetea estado interno.
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
      />
    </div>
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
        Toma una foto desde{" "}
        <code className="rounded bg-paper px-1 py-0.5 font-mono text-xs">/movil</code>{" "}
        para verla aparecer aquí.
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
                <EstadoChip estado={d.extraction_status} />
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
}: {
  documento: DocumentRow | null;
  supabase: SupabaseClient;
  onReintentar: (id: string) => Promise<void>;
}) {
  // El componente se remonta por `key` al cambiar de documento. Los datos
  // mostrados son los del documento más cualquier corrección local del usuario.
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, DatoExtraido>>({});
  const [guardando, setGuardando] = useState<"idle" | "guardando" | "guardado">(
    "idle"
  );

  const datos = useMemo<Record<string, DatoExtraido>>(
    () => ({ ...(documento?.extracted_data ?? {}), ...overrides }),
    [documento?.extracted_data, overrides]
  );

  // Obtener URL firmada (bucket privado).
  useEffect(() => {
    if (!documento) return;
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

  const tipo = useMemo(
    () => obtenerDocType(documento?.doc_type ?? null),
    [documento?.doc_type]
  );

  const guardar = useCallback(async () => {
    if (!documento) return;
    setGuardando("guardando");
    await supabase
      .from("documents")
      .update({ extracted_data: datos })
      .eq("id", documento.id);
    setGuardando("guardado");
  }, [documento, datos, supabase]);

  if (!documento) {
    return (
      <div className="rounded-md border border-dashed border-line-2 bg-paper-2 p-10 text-center text-sm text-ink-2">
        Selecciona un documento de la izquierda.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="overflow-hidden rounded-md border border-line bg-paper-2 p-3">
        {signedUrl ? (
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
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              guardar();
            }}
          >
            {tipo.campos.map((campo) => {
              const dato = datos[campo.id] ?? { valor: null, confianza: "bajo" as const };
              const valor = dato.valor ?? "";
              const confianza = dato.confianza;
              const inputId = `c-${campo.id}`;
              return (
                <div key={campo.id} className="flex flex-col gap-1">
                  <label
                    htmlFor={inputId}
                    className="flex items-center gap-2 text-sm font-medium text-ink-2"
                  >
                    {campo.label}
                    <ConfianzaTag valor={confianza} />
                  </label>
                  <input
                    id={inputId}
                    type="text"
                    value={valor}
                    onChange={(e) =>
                      setOverrides((prev) => ({
                        ...prev,
                        [campo.id]: {
                          valor: e.target.value || null,
                          confianza:
                            prev[campo.id]?.confianza ??
                            documento.extracted_data?.[campo.id]?.confianza ??
                            "medio",
                        },
                      }))
                    }
                    className="h-11 rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
                  />
                </div>
              );
            })}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={guardando === "guardando"}
                className="inline-flex min-h-[44px] items-center rounded-md bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-2 disabled:bg-ink-3"
              >
                {guardando === "guardando" ? "Guardando…" : "Guardar correcciones"}
              </button>
              {guardando === "guardado" && (
                <span className="text-sm text-ok">Guardado.</span>
              )}
              <button
                type="button"
                onClick={() => onReintentar(documento.id)}
                className="ml-auto inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
              >
                Reextraer
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
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
