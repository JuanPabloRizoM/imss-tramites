"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { DELEGACIONES, esEscrito } from "@/lib/delegaciones";
import type { TramiteType } from "@/lib/tramites";

// Modal "Llevar a…" que aparece en /apartado-3 sobre cada documento ya
// extraído. Permite mandar la extracción a llenar un trámite específico:
//
//   Apartado 1 → Escritos → Delegación → Escrito específico
//   Apartado 1 → Formatos → AFIL-01 / AMSRT / etc.
//   Apartado 2 → Trámite del apartado 2 (cert. digital, prealtas, etc.)
//
// Al confirmar, navega a /apartado-[1|2]/[code]?source_doc=<documentId>
// (y &delegacion=<id> si fue un escrito). La página destino lee
// source_doc y precarga los campos del form que matcheen con
// extracted_data.

type TramiteListItem = Pick<
  TramiteType,
  "id" | "code" | "name" | "apartado"
>;

export function ModalLlevarA({
  isOpen,
  documentId,
  tramites,
  onCerrar,
}: {
  isOpen: boolean;
  documentId: string | null;
  tramites: TramiteListItem[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const [apartado, setApartado] = useState<1 | 2 | null>(null);
  const [tipo, setTipo] = useState<"escrito" | "formato" | null>(null);
  const [delegacionId, setDelegacionId] = useState<string>("");
  const [tramiteCode, setTramiteCode] = useState<string>("");

  // Reset cada vez que se abre.
  useEffect(() => {
    if (isOpen) {
      setApartado(null);
      setTipo(null);
      setDelegacionId("");
      setTramiteCode("");
    }
  }, [isOpen]);

  // Cerrar con Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCerrar]);

  if (!isOpen || !montado) return null;

  // Filtrados por apartado / tipo según las elecciones del usuario.
  const tramitesA1 = tramites.filter((t) => t.apartado === 1);
  const tramitesA2 = tramites.filter((t) => t.apartado === 2);
  const escritos = tramitesA1.filter((t) => esEscrito(t.code));
  const formatos = tramitesA1.filter((t) => !esEscrito(t.code));

  // ¿Está listo para confirmar?
  let puedeConfirmar = false;
  let destino: string | null = null;
  if (apartado === 1 && tipo === "escrito" && delegacionId && tramiteCode) {
    puedeConfirmar = true;
    destino = `/apartado-1/${tramiteCode}?source_doc=${documentId}&delegacion=${delegacionId}`;
  } else if (apartado === 1 && tipo === "formato" && tramiteCode) {
    puedeConfirmar = true;
    destino = `/apartado-1/${tramiteCode}?source_doc=${documentId}`;
  } else if (apartado === 2 && tramiteCode) {
    puedeConfirmar = true;
    destino = `/apartado-2/${tramiteCode}?source_doc=${documentId}`;
  }

  const confirmar = () => {
    if (!destino) return;
    router.push(destino);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/70"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-ink bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(32rem, calc(100vw - 2rem))",
          maxHeight: "calc(100vh - 2rem)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: "1rem",
          padding: "1.5rem",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <header className="grid gap-1">
          <p className="eyebrow">Llevar datos extraídos</p>
          <h2 className="font-display text-2xl text-ink">
            ¿A dónde los llevas?
          </h2>
          <p className="text-xs text-ink-3">
            Te mando a la pantalla del trámite con los campos ya precargados.
            Lo que falte lo llenas a mano o subiendo más documentos ahí mismo.
          </p>
        </header>

        {/* Paso 1 — Apartado */}
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-ink-2">Apartado</legend>
          <div className="grid grid-cols-2 gap-2">
            <BotonOpcion
              activo={apartado === 1}
              onClick={() => {
                setApartado(1);
                setTipo(null);
                setTramiteCode("");
              }}
              titulo="Apartado 1"
              subtitulo="Llenado de formatos / escritos"
            />
            <BotonOpcion
              activo={apartado === 2}
              onClick={() => {
                setApartado(2);
                setTipo(null);
                setTramiteCode("");
              }}
              titulo="Apartado 2"
              subtitulo="Portal IMSS"
            />
          </div>
        </fieldset>

        {/* Paso 2a — Apartado 1: escritos vs formatos */}
        {apartado === 1 && (
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-ink-2">Tipo</legend>
            <div className="grid grid-cols-2 gap-2">
              <BotonOpcion
                activo={tipo === "escrito"}
                onClick={() => {
                  setTipo("escrito");
                  setTramiteCode("");
                }}
                titulo="Escrito"
                subtitulo="Carta a delegación"
              />
              <BotonOpcion
                activo={tipo === "formato"}
                onClick={() => {
                  setTipo("formato");
                  setTramiteCode("");
                }}
                titulo="Formato"
                subtitulo="AFIL-01, AMSRT, etc."
              />
            </div>
          </fieldset>
        )}

        {/* Paso 3 — Escrito: delegación */}
        {apartado === 1 && tipo === "escrito" && (
          <label className="grid gap-1">
            <span className="text-sm font-medium text-ink-2">Delegación</span>
            <select
              value={delegacionId}
              onChange={(e) => setDelegacionId(e.target.value)}
              className="h-11 w-full rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
              style={{ minWidth: 0 }}
            >
              <option value="">— Elige delegación —</option>
              {DELEGACIONES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Paso 3 — Escrito: cuál escrito */}
        {apartado === 1 && tipo === "escrito" && delegacionId && (
          <label className="grid gap-1">
            <span className="text-sm font-medium text-ink-2">Escrito</span>
            <select
              value={tramiteCode}
              onChange={(e) => setTramiteCode(e.target.value)}
              className="h-11 w-full rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
              style={{ minWidth: 0 }}
            >
              <option value="">— Elige escrito —</option>
              {escritos.map((t) => (
                <option key={t.id} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Paso 3 — Formato */}
        {apartado === 1 && tipo === "formato" && (
          <label className="grid gap-1">
            <span className="text-sm font-medium text-ink-2">Formato</span>
            <select
              value={tramiteCode}
              onChange={(e) => setTramiteCode(e.target.value)}
              className="h-11 w-full rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
              style={{ minWidth: 0 }}
            >
              <option value="">— Elige formato —</option>
              {formatos.map((t) => (
                <option key={t.id} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Paso 2b — Apartado 2: trámite */}
        {apartado === 2 && (
          <label className="grid gap-1">
            <span className="text-sm font-medium text-ink-2">Trámite</span>
            <select
              value={tramiteCode}
              onChange={(e) => setTramiteCode(e.target.value)}
              className="h-11 w-full rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink"
              style={{ minWidth: 0 }}
            >
              <option value="">— Elige trámite —</option>
              {tramitesA2.map((t) => (
                <option key={t.id} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-2 flex flex-wrap justify-end gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={onCerrar}
            className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!puedeConfirmar}
            className="inline-flex min-h-[44px] items-center rounded-md bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Llevar →
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function BotonOpcion({
  activo,
  onClick,
  titulo,
  subtitulo,
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  subtitulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid gap-1 rounded-md border-2 p-3 text-left transition-colors ${
        activo
          ? "border-ink bg-paper-2"
          : "border-line bg-paper hover:border-line-2"
      }`}
    >
      <span className="text-sm font-medium text-ink">{titulo}</span>
      <span className="text-xs text-ink-3">{subtitulo}</span>
    </button>
  );
}
