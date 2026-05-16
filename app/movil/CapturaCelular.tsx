"use client";

import { useRef, useState } from "react";

import { redimensionarImagen } from "@/lib/imagen";
import { listarDocTypes } from "@/lib/extraccion";
import { getBrowserClient } from "@/lib/supabase/client";

type Estado =
  | { tipo: "vacio" }
  | { tipo: "subiendo"; nombre: string }
  | { tipo: "procesando"; nombre: string }
  | { tipo: "listo"; nombre: string }
  | { tipo: "error"; mensaje: string; ultimoDocumentId?: string };

const TIPOS = listarDocTypes();

export function CapturaCelular() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [docType, setDocType] = useState<string>("generico");
  const [estado, setEstado] = useState<Estado>({ tipo: "vacio" });

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

      const ins = await supabase
        .from("documents")
        .insert({
          storage_path: path,
          doc_type: docType,
          extraction_status: "pendiente",
        })
        .select("id")
        .single();
      if (ins.error || !ins.data) throw ins.error ?? new Error("Insert vacío.");

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

      setEstado({ tipo: "listo", nombre });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error desconocido.";
      setEstado({ tipo: "error", mensaje });
    }
  }

  function reset() {
    setEstado({ tipo: "vacio" });
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="doc-type"
          className="text-sm font-medium text-zinc-700"
        >
          Tipo de documento
        </label>
        <select
          id="doc-type"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          disabled={estado.tipo === "subiendo" || estado.tipo === "procesando"}
          className="h-12 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus-visible:border-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
        >
          {TIPOS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">
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
          disabled={estado.tipo === "subiendo" || estado.tipo === "procesando"}
          className="flex min-h-[56px] items-center justify-center rounded-md bg-zinc-900 px-6 text-base font-semibold text-white hover:bg-zinc-800 focus-visible:bg-zinc-800 disabled:bg-zinc-400"
        >
          Tomar foto / subir
        </button>

        <p className="text-center text-xs text-zinc-500">
          Se redimensiona en el celular antes de subir (lado largo 1600 px, JPEG).
        </p>
      </div>

      <EstadoBox estado={estado} onReset={reset} />
    </div>
  );
}

function EstadoBox({ estado, onReset }: { estado: Estado; onReset: () => void }) {
  if (estado.tipo === "vacio") return null;

  if (estado.tipo === "subiendo" || estado.tipo === "procesando") {
    const texto =
      estado.tipo === "subiendo"
        ? "Subiendo a Supabase..."
        : "La IA está leyendo el documento...";
    return (
      <div
        role="status"
        className="rounded-md border border-zinc-200 bg-white p-4"
      >
        <p className="text-sm font-medium text-zinc-900">{estado.nombre}</p>
        <p className="mt-1 text-sm text-zinc-600">{texto}</p>
      </div>
    );
  }

  if (estado.tipo === "listo") {
    return (
      <div
        role="status"
        className="rounded-md border border-emerald-300 bg-emerald-50 p-4"
      >
        <p className="text-sm font-medium text-emerald-900">
          Listo: {estado.nombre}
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          Revisa los datos en la computadora.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-emerald-300 bg-white px-4 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
        >
          Capturar otro documento
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 p-4"
    >
      <p className="text-sm font-medium text-red-900">No se pudo procesar</p>
      <p className="mt-1 text-sm text-red-800">{estado.mensaje}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-900 hover:bg-red-100"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
