"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserClient } from "@/lib/supabase/client";
import {
  obtenerDocType,
  esFilaArray,
  type DatoExtraido,
  type DocType,
  type FilaExtraida,
} from "@/lib/extraccion";

type ExtractedValue = DatoExtraido | FilaExtraida[];

type DocumentRow = {
  id: string;
  storage_path: string;
  doc_type: string | null;
  extracted_data: Record<string, ExtractedValue> | null;
  extraction_status: "pendiente" | "procesando" | "listo" | "error";
  extraction_error: string | null;
  created_at: string;
};

function initSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  return getBrowserClient();
}

export function VistaComputadora() {
  const [supabase] = useState<SupabaseClient | null>(initSupabase);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [seleccionManual, setSeleccionManual] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const searchParams = useSearchParams();

  // Si la URL viene con ?doc=<id>, preselecciona ese documento.
  const docDesdeUrl = searchParams.get("doc");

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

  // Imagen firmada (bucket privado).
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

      {documento.extraction_status === "listo" && (
        <div className="flex items-center gap-3 border-t border-line pt-6">
          <button
            type="button"
            onClick={guardar}
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
