"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserClient } from "@/lib/supabase/client";
import { agruparPorSeccion, type TramiteType } from "@/lib/tramites";

type Row = {
  id: string;
  field_values: Record<string, string | null>;
  status: "nuevo" | "en_proceso" | "revisado" | "completado";
  created_at: string;
};

function initSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  return getBrowserClient();
}

export function InboxClientes({ tipo }: { tipo: TramiteType }) {
  const [supabase] = useState<SupabaseClient | null>(initSupabase);
  const [rows, setRows] = useState<Row[]>([]);
  const [cargando, setCargando] = useState(true);
  const [selManual, setSelManual] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelado = false;
    (async () => {
      const { data } = await supabase
        .from("tramites")
        .select("id, field_values, status, created_at")
        .eq("tramite_type_id", tipo.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelado) return;
      setRows((data as Row[]) ?? []);
      setCargando(false);
    })();

    const channel = supabase
      .channel(`tramites-inbox-${tipo.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tramites",
          filter: `tramite_type_id=eq.${tipo.id}`,
        },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === "INSERT") {
              const nueva = payload.new as Row;
              if (prev.some((r) => r.id === nueva.id)) return prev;
              return [nueva, ...prev].slice(0, 50);
            }
            if (payload.eventType === "UPDATE") {
              const upd = payload.new as Row;
              return prev.map((r) => (r.id === upd.id ? upd : r));
            }
            if (payload.eventType === "DELETE") {
              const del = payload.old as { id: string };
              return prev.filter((r) => r.id !== del.id);
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
  }, [supabase, tipo.id]);

  const seleccionId = useMemo(() => {
    if (selManual && rows.some((r) => r.id === selManual)) return selManual;
    return rows[0]?.id ?? null;
  }, [selManual, rows]);

  const sel = rows.find((r) => r.id === seleccionId) ?? null;

  const grupos = useMemo(
    () => agruparPorSeccion(tipo.field_schema),
    [tipo.field_schema]
  );

  const marcarRevisado = async (id: string) => {
    if (!supabase) return;
    await supabase.from("tramites").update({ status: "revisado" }).eq("id", id);
  };

  const copiar = async (texto: string, key: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(key);
      setTimeout(() => setCopiado((c) => (c === key ? null : c)), 1200);
    } catch {
      setCopiado("error");
    }
  };

  if (!supabase) {
    return (
      <p className="text-sm text-ink-3">Cargando…</p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <aside className="rounded-md border border-line bg-paper-2">
        {cargando ? (
          <p className="p-4 text-sm text-ink-3">Cargando…</p>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-ink-2">
            <p className="eyebrow mb-2">Vacío</p>
            Aún no hay capturas. Comparte la URL{" "}
            <code className="rounded bg-paper px-1 font-mono text-xs">
              /apartado-4/cliente
            </code>{" "}
            con el cliente.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const nombre = [r.field_values.nombre, r.field_values.apellido_paterno]
                .filter(Boolean)
                .join(" ") || "(Sin nombre)";
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelManual(r.id)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-paper ${
                      r.id === seleccionId ? "bg-paper" : ""
                    }`}
                  >
                    <span className="text-sm font-medium text-ink">{nombre}</span>
                    <span className="text-xs text-ink-3">
                      {new Date(r.created_at).toLocaleString("es-MX")}
                    </span>
                    <EstadoChip status={r.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {!sel ? (
        <div className="rounded-md border border-dashed border-line-2 bg-paper-2 p-10 text-center text-sm text-ink-2">
          Selecciona una captura a la izquierda.
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <EstadoChip status={sel.status} />
            <span className="text-xs text-ink-3">
              {new Date(sel.created_at).toLocaleString("es-MX")}
            </span>
            <div className="ml-auto flex gap-2">
              {sel.status !== "revisado" && (
                <button
                  type="button"
                  onClick={() => marcarRevisado(sel.id)}
                  className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink hover:bg-paper-2"
                >
                  Marcar revisado
                </button>
              )}
            </div>
          </div>

          {grupos.map(({ seccion, campos }) => (
            <section key={seccion} className="grid gap-3">
              <p className="eyebrow">{seccion}</p>
              <dl className="grid gap-3 md:grid-cols-2">
                {campos.map((c) => {
                  const v = sel.field_values[c.id]?.trim();
                  if (!v) return null;
                  return (
                    <div
                      key={c.id}
                      className="flex items-start justify-between gap-3 rounded-md border border-line bg-paper-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <dt className="text-xs text-ink-3">{c.label}</dt>
                        <dd className="break-words text-sm text-ink">{v}</dd>
                      </div>
                      <button
                        type="button"
                        onClick={() => copiar(v, c.id)}
                        className={`min-h-[36px] shrink-0 rounded-md border px-2 text-xs font-medium ${
                          copiado === c.id
                            ? "border-ok bg-ok-soft text-ok"
                            : "border-line bg-paper text-ink-2 hover:border-ink hover:text-ink"
                        }`}
                      >
                        {copiado === c.id ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EstadoChip({ status }: { status: Row["status"] }) {
  const map: Record<Row["status"], { txt: string; cls: string }> = {
    nuevo: { txt: "Nuevo", cls: "bg-accent-soft text-accent" },
    en_proceso: { txt: "En proceso", cls: "bg-warn-soft text-ink-2" },
    revisado: { txt: "Revisado", cls: "bg-ok-soft text-ok" },
    completado: { txt: "Completado", cls: "bg-paper text-ink-3 border border-line" },
  };
  const { txt, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${cls}`}
    >
      {txt}
    </span>
  );
}
