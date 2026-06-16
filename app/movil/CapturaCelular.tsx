"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { redimensionarImagen } from "@/lib/imagen";
import { listarDocTypes } from "@/lib/extraccion";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  guardarSesionCelular,
  leerSesionCelular,
} from "@/lib/pareo-cliente";
import type { SesionResumen } from "@/lib/pareo";
import { PantallaPareoCelular } from "./PantallaPareoCelular";

type Estado =
  | { tipo: "vacio" }
  | { tipo: "subiendo"; nombre: string }
  | { tipo: "procesando"; nombre: string }
  | { tipo: "listo"; nombre: string; documentId: string }
  | { tipo: "error"; mensaje: string; ultimoDocumentId?: string };

const TIPOS = listarDocTypes();

export function CapturaCelular() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [docType, setDocType] = useState<string>("generico");
  const [estado, setEstado] = useState<Estado>({ tipo: "vacio" });
  // null = todavía no decidimos (server-side render). undefined = sin sesión.
  const [sesion, setSesion] = useState<SesionResumen | null | undefined>(null);
  const [recienConectado, setRecienConectado] = useState<string | null>(null);

  // En mount: si ya hay sesión guardada en sessionStorage, usarla. Si no,
  // mostrar la pantalla de pareo. Solo corre en cliente.
  useEffect(() => {
    setSesion(leerSesionCelular() ?? undefined);
  }, []);

  async function manejarArchivo(file: File) {
    try {
      setEstado({ tipo: "subiendo", nombre: file.name });

      const { blob, nombre } = await redimensionarImagen(file);
      const supabase = getBrowserClient();

      const path = `${crypto.randomUUID()}-${nombre}`;
      const up = await supabase.storage
        .from("documentos")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (up.error) throw up.error;

      // Intenta insertar con la sesión actual. Si la sesión de la
      // computadora ya cerró, el FK falla (23503) — reintentamos sin
      // session_id (fallback: visible para todas las computadoras).
      const sessionId = sesion?.id ?? null;
      let ins = await supabase
        .from("documents")
        .insert({
          storage_path: path,
          doc_type: docType,
          extraction_status: "pendiente",
          session_id: sessionId,
        })
        .select("id")
        .single();
      if (ins.error && (ins.error as { code?: string }).code === "23503") {
        // La sesión ya no existe en la BD: avísale al usuario después.
        guardarSesionCelular(null);
        ins = await supabase
          .from("documents")
          .insert({
            storage_path: path,
            doc_type: docType,
            extraction_status: "pendiente",
            session_id: null,
          })
          .select("id")
          .single();
      }
      if (ins.error || !ins.data) throw ins.error ?? new Error("Insert vacío.");

      // Modo trámite: la sesión apunta a un trámite de la computadora. NO
      // extraemos aquí — la computadora hace UNA sola extracción dirigida
      // (solo los campos de ese trámite) en cuanto llega la foto. Así no se
      // gastan tokens dos veces. Ver migración 0025.
      const target = sesion?.target_tramite ?? null;
      if (target) {
        setEstado({ tipo: "listo", nombre, documentId: ins.data.id });
        return;
      }

      setEstado({ tipo: "procesando", nombre });

      const res = await fetch("/api/extraer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: ins.data.id }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(errJson?.error ?? `Error de extracción (${res.status}).`);
      }

      setEstado({ tipo: "listo", nombre, documentId: ins.data.id });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error desconocido.";
      setEstado({ tipo: "error", mensaje });
    }
  }

  function reset() {
    setEstado({ tipo: "vacio" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const ocupado = estado.tipo === "subiendo" || estado.tipo === "procesando";

  // Estado inicial — todavía no leímos sessionStorage.
  if (sesion === null) {
    return (
      <p className="text-center text-sm text-ink-3">Cargando…</p>
    );
  }

  // No hay sesión: pantalla de pareo.
  if (sesion === undefined) {
    return (
      <PantallaPareoCelular
        onConectado={(s) => {
          setSesion(s);
          setRecienConectado(s.code);
          // Limpia el aviso después de unos segundos.
          setTimeout(() => setRecienConectado(null), 4500);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-paper-2 px-3 py-2 text-xs">
        <span className="text-ink-2">
          Conectado a la computadora{" "}
          <span className="font-mono font-semibold text-ink">
            …{sesion.code.slice(-2)}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            guardarSesionCelular(null);
            setSesion(undefined);
            setEstado({ tipo: "vacio" });
          }}
          className="text-ink-3 underline-offset-2 hover:text-ink hover:underline"
        >
          Cambiar
        </button>
      </div>

      {recienConectado && (
        <div
          role="status"
          className="rounded-md border border-ok/30 bg-ok-soft px-3 py-2 text-sm text-ink-2"
        >
          Conectado a esta computadora ·{" "}
          <span className="font-mono font-semibold text-ink">
            …{recienConectado.slice(-2)}
          </span>
        </div>
      )}

      {sesion.target_tramite && (
        <div className="rounded-md border border-accent/40 bg-paper-2 px-3 py-2 text-sm text-ink-2">
          Estás capturando para el trámite{" "}
          <strong className="text-ink">{sesion.target_tramite.name}</strong>. La
          foto se procesa y llena los campos en la computadora — aquí no se lee.
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="doc-type" className="text-sm font-medium text-ink-2">
          Tipo de documento
        </label>
        <select
          id="doc-type"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          disabled={ocupado}
          className="h-12 rounded-md border border-line bg-paper px-3 text-base text-ink focus-visible:border-ink disabled:bg-paper-2 disabled:text-ink-3"
        >
          {TIPOS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-ink-3">
          Si no estás seguro deja &quot;documento (tipo no especificado)&quot;.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) manejarArchivo(f);
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={ocupado}
          className="flex min-h-[64px] items-center justify-center rounded-md bg-ink px-6 text-base font-semibold text-paper hover:bg-ink-2 focus-visible:bg-ink-2 disabled:bg-ink-3"
        >
          Tomar foto del documento
        </button>

        <p className="text-center text-xs text-ink-3">
          Se redimensiona en el celular antes de subir · 1600 px · JPEG.
        </p>
      </div>

      <EstadoBox
        estado={estado}
        onReset={reset}
        targetTramite={sesion.target_tramite ?? null}
      />
    </div>
  );
}

function EstadoBox({
  estado,
  onReset,
  targetTramite,
}: {
  estado: Estado;
  onReset: () => void;
  targetTramite: { code: string; name: string } | null;
}) {
  if (estado.tipo === "vacio") return null;

  if (estado.tipo === "subiendo" || estado.tipo === "procesando") {
    const texto =
      estado.tipo === "subiendo"
        ? "Subiendo…"
        : "La IA está leyendo el documento…";
    return (
      <div role="status" className="rounded-md border border-line bg-paper-2 p-4">
        <p className="eyebrow mb-1">En curso</p>
        <p className="text-sm font-medium text-ink">{estado.nombre}</p>
        <p className="mt-1 text-sm text-ink-2">{texto}</p>
      </div>
    );
  }

  if (estado.tipo === "listo") {
    // Modo trámite: la foto se envió a la computadora y allá se llena solo.
    // No hay datos que revisar en el celular ni link a /apartado-3.
    if (targetTramite) {
      return (
        <div role="status" className="rounded-md border border-ok/30 bg-ok-soft p-4">
          <p className="eyebrow mb-1 text-ok">Enviado</p>
          <p className="text-sm font-medium text-ink">{estado.nombre}</p>
          <p className="mt-1 text-sm text-ink-2">
            Se envió a la computadora. Los campos de{" "}
            <strong className="text-ink">{targetTramite.name}</strong> se están
            llenando allá. Revisa la pantalla de la computadora.
          </p>
          <button
            type="button"
            onClick={onReset}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink hover:bg-paper-2"
          >
            Capturar otro
          </button>
        </div>
      );
    }
    return (
      <div role="status" className="rounded-md border border-ok/30 bg-ok-soft p-4">
        <p className="eyebrow mb-1 text-ok">Listo</p>
        <p className="text-sm font-medium text-ink">{estado.nombre}</p>
        <p className="mt-1 text-sm text-ink-2">
          Los datos quedaron extraídos. Ábrelos para revisarlos y corregirlos.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/apartado-3?doc=${estado.documentId}`}
            className="inline-flex min-h-[44px] items-center rounded-md bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink-2"
          >
            Ver datos extraídos →
          </Link>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink hover:bg-paper-2"
          >
            Capturar otro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-md border border-err/30 bg-err-soft p-4">
      <p className="eyebrow mb-1 text-err">Error</p>
      <p className="text-sm font-medium text-ink">No se pudo procesar</p>
      <p className="mt-1 text-sm text-ink-2">{estado.mensaje}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-line bg-paper px-4 text-sm font-medium text-ink hover:bg-paper-2"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
