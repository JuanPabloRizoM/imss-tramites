"use client";

import { useEffect, useState } from "react";

import { listarDocTypes } from "@/lib/extraccion";
import {
  CONTEXTO_FORZADO_POR_DOC_TYPE,
  tramiteTieneTrabajador,
  type Contexto,
} from "@/lib/extraccion-contexto";
import type { CampoSchema, TramiteType } from "@/lib/tramites";

// Modal centrado que se abre ANTES de subir documentos en /apartado-3.
// Pregunta:
//   1. Para qué trámite es (opcional — "Ninguno" deja extracción libre
//      por doc_type, comportamiento legacy).
//   2. Qué tipo de documento es (TIP, INE, Cédula RFC, etc.).
//   3. De quién son los datos (Trabajador / Patrón / Ambos) — solo cuando
//      hay trámite elegido Y el doc_type no fuerza contexto (TIP, Acta,
//      INE rep ya son patrón sí o sí).
//
// Con esa info, /apartado-3 calcula target_fields filtrado al field_schema
// del trámite + lado del trabajador/patrón → la IA extrae muchos más
// campos del documento porque sabe exactamente qué buscar.

export type OpcionesExtraccion = {
  tramiteCode: string | null; // null = extracción libre por doc_type
  docType: string;
  contexto: Contexto;
};

type TramiteListItem = Pick<
  TramiteType,
  "id" | "code" | "name" | "apartado" | "field_schema"
>;

const TIPOS_DOC = listarDocTypes();

const ETIQUETA_APARTADO: Record<number, string> = {
  1: "Apartado 1 · Llenado de formatos",
  2: "Apartado 2 · Portal IMSS",
  3: "Apartado 3 · Extracción suelta",
  4: "Apartado 4 · Genérico",
};

export function ModalContextoExtraccion({
  isOpen,
  archivos,
  tramites,
  onConfirmar,
  onCancelar,
}: {
  isOpen: boolean;
  archivos: File[];
  tramites: TramiteListItem[];
  onConfirmar: (opts: OpcionesExtraccion) => void;
  onCancelar: () => void;
}) {
  const [tramiteCode, setTramiteCode] = useState<string>("");
  const [docType, setDocType] = useState<string>("generico");
  const [contexto, setContexto] = useState<Contexto>("ambos");

  // Reset al abrir — cada vez que se abre el modal arranca limpio.
  useEffect(() => {
    if (isOpen) {
      setTramiteCode("");
      setDocType("generico");
      setContexto("ambos");
    }
  }, [isOpen]);

  // Cerrar con Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCancelar]);

  if (!isOpen) return null;

  // El dropdown de "para quién" solo aplica cuando hay trámite, el
  // doc_type no fuerza contexto, Y el trámite tiene campos de trabajador
  // (AFIL-01, AMSRT, todo el apartado 2 son patron-only → no preguntamos).
  const trámiteElegido = tramiteCode !== "";
  const tramiteActual = trámiteElegido
    ? tramites.find((t) => t.code === tramiteCode)
    : undefined;
  const tramiteSchema = (tramiteActual?.field_schema as CampoSchema[]) ?? [];
  const tramitePatronOnly =
    trámiteElegido && !tramiteTieneTrabajador(tramiteSchema);
  const contextoForzadoDocType = CONTEXTO_FORZADO_POR_DOC_TYPE[docType];
  const mostrarContexto =
    trámiteElegido &&
    !tramitePatronOnly &&
    contextoForzadoDocType === undefined;

  // Agrupar trámites por apartado para el optgroup del select.
  const grupos = new Map<number, TramiteListItem[]>();
  for (const t of tramites) {
    const lista = grupos.get(t.apartado) ?? [];
    lista.push(t);
    grupos.set(t.apartado, lista);
  }
  const apartadosOrdenados = [...grupos.keys()].sort((a, b) => a - b);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancelar}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="grid w-full max-w-md gap-4 rounded-md border border-line bg-paper p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="grid gap-1">
          <p className="eyebrow">Antes de extraer</p>
          <h2 className="font-display text-2xl text-ink">
            ¿Para qué es este documento?
          </h2>
          <p className="text-xs text-ink-3">
            Elige a qué trámite va dirigida la extracción para que la IA
            busque solo los campos relevantes y saque más datos.
          </p>
        </header>

        {archivos.length > 0 && (
          <ul className="grid gap-1 rounded-md border border-line bg-paper-2 p-3 text-xs text-ink-2">
            {archivos.slice(0, 5).map((f, i) => (
              <li key={`${f.name}-${i}`} className="truncate">
                · {f.name}
              </li>
            ))}
            {archivos.length > 5 && (
              <li className="text-ink-3">…y {archivos.length - 5} más</li>
            )}
          </ul>
        )}

        <label className="grid gap-1">
          <span className="text-sm font-medium text-ink-2">
            Trámite destino
          </span>
          <select
            value={tramiteCode}
            onChange={(e) => setTramiteCode(e.target.value)}
            className="h-11 rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
          >
            <option value="">Ninguno · extracción libre</option>
            {apartadosOrdenados.map((apartado) => (
              <optgroup
                key={apartado}
                label={ETIQUETA_APARTADO[apartado] ?? `Apartado ${apartado}`}
              >
                {(grupos.get(apartado) ?? []).map((t) => (
                  <option key={t.id} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium text-ink-2">
            Tipo de documento
          </span>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="h-11 rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
          >
            {TIPOS_DOC.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {mostrarContexto && (
          <label className="grid gap-1">
            <span className="text-sm font-medium text-ink-2">
              ¿De quién son los datos?
            </span>
            <select
              value={contexto}
              onChange={(e) => setContexto(e.target.value as Contexto)}
              className="h-11 rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
            >
              <option value="ambos">Ambos · no estoy seguro</option>
              <option value="trabajador">Trabajador</option>
              <option value="patron">Patrón</option>
            </select>
          </label>
        )}

        {trámiteElegido && contextoForzadoDocType !== undefined && (
          <p className="rounded-md border border-line bg-paper-2 p-2 text-xs text-ink-3">
            {docType === "tip" && "La TIP siempre es del patrón."}
            {docType === "acta_constitutiva" &&
              "El acta constitutiva siempre es del patrón."}
            {docType === "ine_representante" &&
              "El INE del representante siempre es del lado del patrón."}
          </p>
        )}

        {tramitePatronOnly && contextoForzadoDocType === undefined && (
          <p className="rounded-md border border-line bg-paper-2 p-2 text-xs text-ink-3">
            Este trámite solo tiene datos del patrón.
          </p>
        )}

        <div className="mt-2 flex flex-wrap justify-end gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={onCancelar}
            className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirmar({
                tramiteCode: tramiteCode || null,
                docType,
                contexto,
              })
            }
            className="inline-flex min-h-[44px] items-center rounded-md bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-2"
          >
            Continuar y extraer
          </button>
        </div>
      </div>
    </div>
  );
}
