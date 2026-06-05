"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBrowserClient } from "@/lib/supabase/client";
import {
  agruparPorSeccion,
  camposDelCaso,
  normalizarParaSalida,
  tieneCasos,
  type CampoSchema,
  type CasoTramite,
  type TramiteType,
} from "@/lib/tramites";
import { obtenerDocType, type DatoExtraido } from "@/lib/extraccion";
import { redimensionarImagen } from "@/lib/imagen";
import { buscarFraccion } from "@/lib/catalogo-imss";
import { buscarDelegacion } from "@/lib/delegaciones";

// -------------------------------------------------------------------------
// Orquestador del flujo de un trámite:
//
//   (1) Caso picker — si el trámite define casos.
//   (2) Intake de documentos — sube/foto/skip por cada doc requerido del
//       caso. Cada subida dispara /api/extraer; el estado se sigue por
//       polling sobre la fila de documents.
//   (3) Formulario — solo los required_fields del caso, prellenados con lo
//       extraído de los documentos del intake. Editable. Genera el PDF.
//
// Si el trámite no tiene casos, saltamos (1), saltamos (2) y vamos directo
// al formulario con todo el field_schema (comportamiento previo).
// -------------------------------------------------------------------------

type Props = { tramiteType: TramiteType };
type Paso = "caso" | "intake" | "form";
type Valores = Record<string, string>;
type EstadoGuardar = "idle" | "guardando" | "guardado" | "error";

// Estado de un slot de documento en el intake.
type IntakeSlotEstado =
  | { tipo: "pendiente" }
  | { tipo: "subiendo"; nombreArchivo: string }
  | { tipo: "procesando"; documentId: string; nombreArchivo: string }
  | { tipo: "listo"; documentId: string; datos: Record<string, DatoExtraido> }
  | { tipo: "skipped" }
  | { tipo: "error"; mensaje: string; reintentarPdf?: { documentId: string; paginas: number } };

type IntakeState = Record<string, IntakeSlotEstado>; // doc_type → estado

function initSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  return getBrowserClient();
}

function valoresIniciales(schema: CampoSchema[]): Valores {
  const v: Valores = {};
  for (const c of schema) v[c.id] = "";
  return v;
}

export function VistaTramite({ tramiteType }: Props) {
  const [supabase] = useState<SupabaseClient | null>(initSupabase);
  const conCasos = tieneCasos(tramiteType);
  const searchParams = useSearchParams();
  // Si la URL trae ?delegacion=<id> (caso del flujo /apartado-1/escritos),
  // resolvemos la delegación una vez para pre-llenar el campo `dependencia`
  // del escrito en el form. Solo aplica a escritos que tengan ese campo en
  // su schema — los demás trámites lo ignoran.
  const delegacionElegida = useMemo(
    () => buscarDelegacion(searchParams.get("delegacion")),
    [searchParams]
  );

  const [paso, setPaso] = useState<Paso>(conCasos ? "caso" : "form");
  const [casoId, setCasoId] = useState<string | null>(null);
  const caso = useMemo<CasoTramite | null>(
    () =>
      conCasos && casoId
        ? tramiteType.cases?.find((c) => c.id === casoId) ?? null
        : null,
    [conCasos, casoId, tramiteType.cases]
  );

  const [intake, setIntake] = useState<IntakeState>({});
  const [valores, setValores] = useState<Valores>(() => {
    const v = valoresIniciales(tramiteType.field_schema);
    // Pre-llenado desde la delegación elegida en el picker de escritos.
    // Solo toca campos que existan en el schema — silenciosamente ignora
    // los que no aplican (trámites que no son escritos).
    const ids = new Set(tramiteType.field_schema.map((c) => c.id));
    if (delegacionElegida) {
      if (ids.has("dependencia")) v.dependencia = delegacionElegida.dependencia;
      if (delegacionElegida.destinatario_default && ids.has("destinatario") && !v.destinatario) {
        v.destinatario = delegacionElegida.destinatario_default;
      }
      if (delegacionElegida.cargo_default && ids.has("cargo") && !v.cargo) {
        v.cargo = delegacionElegida.cargo_default;
      }
    }
    return v;
  });

  // Cuando se elige caso, prellenar el campo causa_aviso (queda oculto en el
  // form, pero lo necesita el generador de PDF para marcar el bloque correcto).
  useEffect(() => {
    if (!caso) return;
    setValores((prev) => ({ ...prev, causa_aviso: caso.id }));
    setIntake(
      Object.fromEntries(
        caso.required_source_docs.map((d) => [d, { tipo: "pendiente" } as IntakeSlotEstado])
      )
    );
  }, [caso]);

  if (paso === "caso") {
    return (
      <CasoPicker
        cases={tramiteType.cases ?? []}
        onSeleccionar={(id) => {
          setCasoId(id);
          setPaso("intake");
        }}
      />
    );
  }

  if (paso === "intake" && caso && supabase) {
    return (
      <IntakeDocumentos
        supabase={supabase}
        caso={caso}
        intake={intake}
        setIntake={setIntake}
        onVolver={() => setPaso("caso")}
        onContinuar={(datosCombinados) => {
          // Prellenar valores desde la extracción.
          setValores((prev) => {
            const out = { ...prev };
            for (const campo of tramiteType.field_schema) {
              if (!campo.source_doc) continue;
              const dat = datosCombinados[campo.source_doc]?.[campo.id];
              if (dat?.valor && !out[campo.id]) {
                out[campo.id] = dat.valor;
              }
            }
            return out;
          });
          setPaso("form");
        }}
      />
    );
  }

  return (
    <FormularioCaso
      tramiteType={tramiteType}
      caso={caso}
      valores={valores}
      setValores={setValores}
      supabase={supabase}
      onVolverIntake={conCasos ? () => setPaso("intake") : null}
    />
  );
}

// =========================================================================
// Paso 1 — Caso picker
// =========================================================================
function CasoPicker({
  cases,
  onSeleccionar,
}: {
  cases: CasoTramite[];
  onSeleccionar: (id: string) => void;
}) {
  return (
    <section className="grid gap-4">
      <header className="grid gap-1">
        <p className="eyebrow">Paso 1 de 3</p>
        <h2 className="text-xl font-medium text-ink">¿Qué caso vas a tramitar?</h2>
        <p className="text-sm text-ink-2">
          Cada caso pide su propio juego de datos y documentos. Elige el que
          aplique para no pedirle al cliente cosas que no necesitas.
        </p>
      </header>

      <ul className="grid gap-3 md:grid-cols-2">
        {cases.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSeleccionar(c.id)}
              className="group flex w-full items-start gap-4 rounded-md border border-line bg-paper-2 p-5 text-left transition-colors hover:border-ink hover:bg-paper"
            >
              <span className="font-display text-3xl text-ink-3 group-hover:text-accent">
                {c.id}
              </span>
              <span className="flex flex-1 flex-col gap-1">
                <span className="text-base font-medium text-ink">{c.label}</span>
                {c.description && (
                  <span className="text-sm text-ink-2">{c.description}</span>
                )}
                <span className="mt-2 text-xs text-ink-3">
                  {c.required_fields.length} campos ·{" "}
                  {c.required_source_docs.length} documentos
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// =========================================================================
// Paso 2 — Intake de documentos
// =========================================================================
function IntakeDocumentos({
  supabase,
  caso,
  intake,
  setIntake,
  onVolver,
  onContinuar,
}: {
  supabase: SupabaseClient;
  caso: CasoTramite;
  intake: IntakeState;
  setIntake: React.Dispatch<React.SetStateAction<IntakeState>>;
  onVolver: () => void;
  onContinuar: (datos: Record<string, Record<string, DatoExtraido>>) => void;
}) {
  // Suscripción a documents para detectar cuando la extracción termina.
  useEffect(() => {
    const procesandoIds = Object.values(intake)
      .filter((s): s is Extract<IntakeSlotEstado, { tipo: "procesando" }> => s.tipo === "procesando")
      .map((s) => s.documentId);

    if (procesandoIds.length === 0) return;

    const channel = supabase
      .channel(`intake-${caso.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "documents" },
        (payload) => {
          const fila = payload.new as {
            id: string;
            doc_type: string | null;
            extraction_status: string;
            extracted_data: Record<string, DatoExtraido> | null;
            extraction_error: string | null;
          };
          if (!procesandoIds.includes(fila.id)) return;
          setIntake((prev) => {
            const key = fila.doc_type ?? "";
            const slot = prev[key];
            if (!slot || slot.tipo !== "procesando") return prev;
            if (fila.extraction_status === "listo") {
              return {
                ...prev,
                [key]: {
                  tipo: "listo",
                  documentId: fila.id,
                  datos: (fila.extracted_data ?? {}) as Record<string, DatoExtraido>,
                },
              };
            }
            if (fila.extraction_status === "error") {
              return {
                ...prev,
                [key]: {
                  tipo: "error",
                  mensaje: fila.extraction_error ?? "Extracción falló.",
                },
              };
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, caso.id, intake, setIntake]);

  const subirArchivo = useCallback(
    async (docTypeId: string, file: File, confirmPdfPages = false) => {
      const esImagen = file.type.startsWith("image/");
      const esPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      setIntake((prev) => ({
        ...prev,
        [docTypeId]: { tipo: "subiendo", nombreArchivo: file.name },
      }));

      try {
        // Las imágenes se redimensionan en el cliente. Los PDFs se suben tal cual.
        let blobFinal: Blob = file;
        let extension = file.name.split(".").pop() ?? "bin";
        let contentType = file.type || "application/octet-stream";
        if (esImagen) {
          const r = await redimensionarImagen(file);
          blobFinal = r.blob;
          extension = "jpg";
          contentType = "image/jpeg";
        } else if (esPdf) {
          extension = "pdf";
          contentType = "application/pdf";
        }

        const path = `${crypto.randomUUID()}.${extension}`;
        const up = await supabase.storage.from("documentos").upload(path, blobFinal, {
          contentType,
          upsert: false,
        });
        if (up.error) throw up.error;

        const ins = await supabase
          .from("documents")
          .insert({
            storage_path: path,
            doc_type: docTypeId,
            extraction_status: "pendiente",
          })
          .select("id")
          .single();
        if (ins.error || !ins.data) throw ins.error ?? new Error("Insert vacío.");

        setIntake((prev) => ({
          ...prev,
          [docTypeId]: {
            tipo: "procesando",
            documentId: ins.data.id,
            nombreArchivo: file.name,
          },
        }));

        const res = await fetch("/api/extraer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: ins.data.id, confirmPdfPages }),
        });

        if (res.status === 409) {
          const j = (await res.json()) as {
            error: string;
            paginas: number;
            mensaje: string;
          };
          setIntake((prev) => ({
            ...prev,
            [docTypeId]: {
              tipo: "error",
              mensaje: j.mensaje,
              reintentarPdf: { documentId: ins.data.id, paginas: j.paginas },
            },
          }));
          return;
        }

        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(j?.error ?? `Error ${res.status}`);
        }
        // Si todo OK, el realtime hook actualiza a "listo" cuando termine.
        // Si no llega realtime, hacemos un fetch defensivo.
        const { data: docRow } = await supabase
          .from("documents")
          .select("id, doc_type, extraction_status, extracted_data, extraction_error")
          .eq("id", ins.data.id)
          .single();
        if (docRow && docRow.extraction_status === "listo") {
          setIntake((prev) => ({
            ...prev,
            [docTypeId]: {
              tipo: "listo",
              documentId: docRow.id,
              datos: (docRow.extracted_data ?? {}) as Record<string, DatoExtraido>,
            },
          }));
        }
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : "Error desconocido.";
        setIntake((prev) => ({
          ...prev,
          [docTypeId]: { tipo: "error", mensaje },
        }));
      }
    },
    [supabase, setIntake]
  );

  const confirmarPdfGrande = useCallback(
    async (docTypeId: string, documentId: string) => {
      setIntake((prev) => ({
        ...prev,
        [docTypeId]: { tipo: "procesando", documentId, nombreArchivo: "PDF" },
      }));
      const res = await fetch("/api/extraer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, confirmPdfPages: true }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setIntake((prev) => ({
          ...prev,
          [docTypeId]: {
            tipo: "error",
            mensaje: j?.error ?? `Error ${res.status}`,
          },
        }));
      }
    },
    [setIntake]
  );

  const saltar = (docTypeId: string) =>
    setIntake((prev) => ({ ...prev, [docTypeId]: { tipo: "skipped" } }));

  const reiniciar = (docTypeId: string) =>
    setIntake((prev) => ({ ...prev, [docTypeId]: { tipo: "pendiente" } }));

  const todosResueltos = useMemo(
    () =>
      caso.required_source_docs.every((d) => {
        const s = intake[d];
        return s && (s.tipo === "listo" || s.tipo === "skipped");
      }),
    [caso.required_source_docs, intake]
  );

  return (
    <section className="grid gap-5">
      <header className="grid gap-1">
        <p className="eyebrow">Paso 2 de 3 · Caso {caso.id} — {caso.label}</p>
        <h2 className="text-xl font-medium text-ink">Carga los documentos</h2>
        <p className="text-sm text-ink-2">
          Para cada documento puedes tomar foto, subir archivo (JPG, PNG o
          PDF) o saltarlo y llenar a mano en el siguiente paso.
        </p>
      </header>

      <ul className="grid gap-3">
        {caso.required_source_docs.map((docTypeId) => {
          const tipo = obtenerDocType(docTypeId);
          const estado = intake[docTypeId] ?? { tipo: "pendiente" as const };
          return (
            <SlotDocumento
              key={docTypeId}
              docTypeId={docTypeId}
              docTypeLabel={tipo.label}
              estado={estado}
              onSubir={(file) => subirArchivo(docTypeId, file)}
              onConfirmarPdf={(documentId) =>
                confirmarPdfGrande(docTypeId, documentId)
              }
              onSaltar={() => saltar(docTypeId)}
              onReiniciar={() => reiniciar(docTypeId)}
            />
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
        >
          ← Cambiar caso
        </button>
        <button
          type="button"
          disabled={!todosResueltos}
          onClick={() => {
            const datosCombinados: Record<string, Record<string, DatoExtraido>> =
              {};
            for (const [docId, s] of Object.entries(intake)) {
              if (s.tipo === "listo") datosCombinados[docId] = s.datos;
            }
            onContinuar(datosCombinados);
          }}
          className="inline-flex min-h-[48px] items-center rounded-md bg-ink px-6 text-sm font-semibold text-paper hover:bg-ink-2 disabled:bg-ink-3"
        >
          Continuar al formulario →
        </button>
      </div>
    </section>
  );
}

function SlotDocumento({
  docTypeId,
  docTypeLabel,
  estado,
  onSubir,
  onConfirmarPdf,
  onSaltar,
  onReiniciar,
}: {
  docTypeId: string;
  docTypeLabel: string;
  estado: IntakeSlotEstado;
  onSubir: (file: File) => void;
  onConfirmarPdf: (documentId: string) => void;
  onSaltar: () => void;
  onReiniciar: () => void;
}) {
  const inputCamId = `cam-${docTypeId}`;
  const inputFileId = `file-${docTypeId}`;

  const ocupado = estado.tipo === "subiendo" || estado.tipo === "procesando";

  return (
    <li className="rounded-md border border-line bg-paper-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-base font-medium text-ink">{docTypeLabel}</p>
          <EstadoBadge estado={estado} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={inputCamId}
            className={`inline-flex min-h-[40px] cursor-pointer items-center rounded-md border border-line bg-paper px-3 text-sm font-medium text-ink hover:bg-paper-2 ${
              ocupado ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Tomar foto
          </label>
          <input
            id={inputCamId}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={ocupado}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSubir(f);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={inputFileId}
            className={`inline-flex min-h-[40px] cursor-pointer items-center rounded-md border border-line bg-paper px-3 text-sm font-medium text-ink hover:bg-paper-2 ${
              ocupado ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Subir archivo
          </label>
          <input
            id={inputFileId}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="sr-only"
            disabled={ocupado}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSubir(f);
              e.target.value = "";
            }}
          />
          {estado.tipo === "pendiente" && (
            <button
              type="button"
              onClick={onSaltar}
              className="inline-flex min-h-[40px] items-center rounded-md border border-line bg-paper px-3 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              Saltar
            </button>
          )}
          {(estado.tipo === "listo" ||
            estado.tipo === "skipped" ||
            estado.tipo === "error") && (
            <button
              type="button"
              onClick={onReiniciar}
              className="inline-flex min-h-[40px] items-center rounded-md border border-line bg-paper px-3 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              Reemplazar
            </button>
          )}
        </div>
      </div>

      {estado.tipo === "error" && (
        <div className="mt-3 rounded-md border border-err/30 bg-err-soft p-3 text-sm text-ink-2">
          <p className="font-medium text-err">No se pudo extraer</p>
          <p>{estado.mensaje}</p>
          {estado.reintentarPdf && (
            <button
              type="button"
              onClick={() =>
                onConfirmarPdf(estado.reintentarPdf!.documentId)
              }
              className="mt-2 inline-flex min-h-[40px] items-center rounded-md bg-ink px-3 text-sm font-semibold text-paper hover:bg-ink-2"
            >
              Procesar de todos modos ({estado.reintentarPdf.paginas} págs)
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function EstadoBadge({ estado }: { estado: IntakeSlotEstado }) {
  const map: Record<IntakeSlotEstado["tipo"], { txt: string; cls: string }> = {
    pendiente: { txt: "Pendiente", cls: "bg-paper text-ink-2 border border-line" },
    subiendo: { txt: "Subiendo…", cls: "bg-warn-soft text-ink" },
    procesando: { txt: "Extrayendo…", cls: "bg-warn-soft text-ink" },
    listo: { txt: "Listo", cls: "bg-ok-soft text-ok" },
    skipped: { txt: "Saltado · llenar a mano", cls: "bg-paper text-ink-3 border border-line" },
    error: { txt: "Error", cls: "bg-err-soft text-err" },
  };
  const { txt, cls } = map[estado.tipo];
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${cls}`}
    >
      {txt}
    </span>
  );
}

// =========================================================================
// Paso 3 — Formulario (filtrado por caso si aplica)
// =========================================================================
function FormularioCaso({
  tramiteType,
  caso,
  valores,
  setValores,
  supabase,
  onVolverIntake,
}: {
  tramiteType: TramiteType;
  caso: CasoTramite | null;
  valores: Valores;
  setValores: React.Dispatch<React.SetStateAction<Valores>>;
  supabase: SupabaseClient | null;
  onVolverIntake: (() => void) | null;
}) {
  const [tramiteId, setTramiteId] = useState<string | null>(null);
  const [guardar, setGuardar] = useState<EstadoGuardar>("idle");
  const [generando, setGenerando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const campos = useMemo(
    () => camposDelCaso(tramiteType.field_schema, caso).filter((c) => c.id !== "causa_aviso"),
    [tramiteType.field_schema, caso]
  );
  const grupos = useMemo(() => agruparPorSeccion(campos), [campos]);

  // AM-SRT: vigila la fracción y aplica el auto-llenado SIN IMPORTAR el
  // origen (typing, extracción IA, precarga desde docs). El check de
  // igualdad evita loop infinito.
  useEffect(() => {
    if (tramiteType.code !== "am-srt") return;
    const frac = valores.fraccion;
    if (!frac) return;
    const hit = buscarFraccion(frac);
    if (!hit) return;
    if (
      valores.fraccion === hit.fraccionCodigo &&
      valores.division === hit.divisionCodigo &&
      valores.grupo === hit.grupoCodigo &&
      valores.clase === hit.claseCodigo
    ) {
      return;
    }
    setValores((prev) => ({
      ...prev,
      fraccion: hit.fraccionCodigo,
      division: hit.divisionCodigo,
      grupo: hit.grupoCodigo,
      clase: hit.claseCodigo,
      division_descripcion: hit.divisionNombre,
      grupo_descripcion: hit.grupoNombre,
      fraccion_descripcion: hit.fraccionTitulo,
      // clase_descripcion: NO se auto-llena (redundante con la columna Clave).
    }));
  }, [
    tramiteType.code,
    valores.fraccion,
    valores.division,
    valores.grupo,
    valores.clase,
    setValores,
  ]);

  // AM-SRT: pedir sugerencias de productos + materias primas con Haiku.
  const [sugiriendo, setSugiriendo] = useState(false);
  const [errorSugerir, setErrorSugerir] = useState<string | null>(null);
  // Sugerencias de procesos (IV.6) — por sección, independientes.
  const [sugiriendoProc, setSugiriendoProc] = useState<
    "principales" | "intermedios" | "finales" | null
  >(null);
  const [errorProc, setErrorProc] = useState<string | null>(null);
  const sugerirProcesos = useCallback(
    async (seccion: "principales" | "intermedios" | "finales") => {
      setErrorProc(null);
      setSugiriendoProc(seccion);
      try {
        const res = await fetch("/api/sugerir-procesos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fraccion: valores.fraccion ?? "",
            giro: valores.giro ?? "",
            productos: valores.productos_elaborados ?? "",
            materias: valores.materias_primas ?? "",
            seccion,
          }),
        });
        const j = (await res.json()) as {
          text?: string;
          error?: string;
        };
        if (!res.ok || j.error) {
          setErrorProc(j.error ?? `Error ${res.status}`);
          return;
        }
        const target =
          seccion === "principales"
            ? "procesos_principales"
            : seccion === "intermedios"
            ? "procesos_intermedios"
            : "procesos_finales";
        setValores((prev) => ({
          ...prev,
          [target]: j.text ?? "",
        }));
      } catch (err) {
        setErrorProc(err instanceof Error ? err.message : "Error de red.");
      } finally {
        setSugiriendoProc(null);
      }
    },
    [
      setValores,
      valores.fraccion,
      valores.giro,
      valores.productos_elaborados,
      valores.materias_primas,
    ]
  );
  const sugerirProductosMaterias = useCallback(async () => {
    setErrorSugerir(null);
    setSugiriendo(true);
    try {
      const res = await fetch("/api/sugerir-productos-materiales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fraccion: valores.fraccion ?? "",
          giro: valores.giro ?? "",
        }),
      });
      const j = (await res.json()) as {
        productos?: string[];
        materias_primas?: string[];
        error?: string;
      };
      if (!res.ok || j.error) {
        setErrorSugerir(j.error ?? `Error ${res.status}`);
        return;
      }
      setValores((prev) => ({
        ...prev,
        productos_elaborados: (j.productos ?? []).join("\n"),
        materias_primas: (j.materias_primas ?? []).join("\n"),
      }));
    } catch (err) {
      setErrorSugerir(
        err instanceof Error ? err.message : "Error de red al sugerir."
      );
    } finally {
      setSugiriendo(false);
    }
  }, [setValores, valores.fraccion, valores.giro]);

  const setCampo = (id: string, valor: string) => {
    setValores((prev) => {
      const next = { ...prev, [id]: valor };
      // AM-SRT: cuando el usuario escribe el código de fracción, busca en el
      // catálogo del art. 196 RACERF y auto-llena división/grupo/clase y sus
      // descripciones. Prima SRT se queda manual — puede cambiar por caso.
      if (tramiteType.code === "am-srt" && id === "fraccion") {
        const hit = buscarFraccion(valor);
        if (hit) {
          // Normalizar al formato IMSS de 4 dígitos (lo que el PDF espera).
          next.fraccion = hit.fraccionCodigo;
          next.division = hit.divisionCodigo;
          next.grupo = hit.grupoCodigo;
          next.clase = hit.claseCodigo;
          next.division_descripcion = hit.divisionNombre;
          next.grupo_descripcion = hit.grupoNombre;
          next.fraccion_descripcion = hit.fraccionTitulo;
          // clase_descripcion no se auto-llena: el código romano en la
          // columna Clave ya basta y agregar "Riesgo X" suena redundante.
        }
      }
      return next;
    });
    if (guardar === "guardado") setGuardar("idle");
  };

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
      // Para el PDF: solo campos del caso (más causa_aviso si aplica) que
      // tengan valor.
      const incluir = new Set(campos.map((c) => c.id));
      if (caso) incluir.add("causa_aviso");
      const valoresFiltrados: Record<string, string> = {};
      for (const id of incluir) {
        if (valores[id]) valoresFiltrados[id] = valores[id];
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
      a.download = caso
        ? `${tramiteType.code}-${caso.id}.pdf`
        : `${tramiteType.code}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error al generar PDF.");
    } finally {
      setGenerando(false);
    }
  }, [tramiteType.code, valores, campos, caso]);

  const camposFaltantes = campos.filter(
    (c) => c.required && !valores[c.id]?.trim()
  );
  const faltaObligatorio = camposFaltantes.length > 0;

  return (
    <div className="grid gap-8">
      {caso && (
        <div className="rounded-md border border-line bg-paper-2 p-4">
          <p className="eyebrow">
            Paso 3 de 3 · Caso {caso.id} — {caso.label}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            Revisa y corrige. Los campos vacíos se pueden llenar a mano. Al
            generar el PDF solo van los datos de este caso.
          </p>
        </div>
      )}

      {tramiteType.code === "am-srt" && (
        <div className="grid gap-3 rounded-md border border-line bg-paper-2 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={sugerirProductosMaterias}
              disabled={sugiriendo || (!valores.fraccion && !valores.giro)}
              className="inline-flex min-h-[44px] items-center rounded-md bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink-2 disabled:bg-ink-3"
              title="Genera IV.1 y IV.2 con Haiku. Necesita fracción o giro. ~$0.003 USD."
            >
              {sugiriendo ? "Generando…" : "Sugerir productos y materias (IV.1 / IV.2)"}
            </button>
            {errorSugerir && (
              <span className="text-sm text-err">{errorSugerir}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-3">Procesos (IV.6) — uno a la vez:</span>
            {(["principales","intermedios","finales"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => sugerirProcesos(s)}
                disabled={sugiriendoProc === s || (!valores.fraccion && !valores.giro)}
                className="inline-flex min-h-[36px] items-center rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink hover:bg-paper-2 disabled:text-ink-3"
                title={`Sugiere procesos ${s} con Haiku. ~$0.003 USD.`}
              >
                {sugiriendoProc === s ? "Generando…" : `Sugerir ${s}`}
              </button>
            ))}
            {errorProc && <span className="text-sm text-err">{errorProc}</span>}
          </div>
        </div>
      )}

      <form
        className="grid gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          generarPDF();
        }}
      >
        {grupos.map(({ seccion, campos: camposSec }) => (
          <fieldset key={seccion} className="grid gap-4">
            <legend className="eyebrow">{seccion}</legend>
            <div className="grid gap-4 md:grid-cols-2">
              {camposSec.map((campo) => (
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
          {onVolverIntake && (
            <button
              type="button"
              onClick={onVolverIntake}
              className="inline-flex min-h-[48px] items-center rounded-md border border-line bg-paper px-5 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              ← Volver a documentos
            </button>
          )}
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
        <>
          {campo.options && campo.options.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {campo.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    onChange(valor.trim() ? `${valor}\n${opt}` : opt)
                  }
                  className="rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink-2 hover:bg-paper-2 hover:text-ink"
                  title={`Insertar "${opt}" en nueva línea`}
                >
                  + {opt}
                </button>
              ))}
            </div>
          )}
          <textarea
            id={id}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            className="rounded-md border border-line bg-paper px-3 py-2 text-base text-ink focus-visible:border-ink"
          />
        </>
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
