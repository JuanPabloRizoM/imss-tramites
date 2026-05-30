"use client";

import { useEffect, useRef, useState } from "react";

import { codigoValido, LARGO_CODIGO, normalizarCodigo } from "@/lib/pareo";
import { guardarSesionCelular } from "@/lib/pareo-cliente";
import type { SesionResumen } from "@/lib/pareo";

// Pantalla inicial del celular: pide el código de pareo. Diseño mobile-first
// — un solo elemento de foco, autouppercase, sin distracciones.
//
// Rate-limit: 5 intentos fallidos en esta misma pestaña bloquean por 30 s.
// Vive solo en memoria — cerrar y reabrir la pestaña lo limpia, que está
// bien para un tool interno (no es defensa contra atacantes).

const MAX_INTENTOS = 5;
const COOLDOWN_MS = 30_000;

export function PantallaPareoCelular({
  onConectado,
}: {
  onConectado: (sesion: SesionResumen) => void;
}) {
  const [valor, setValor] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Tick cada segundo cuando hay bloqueo para refrescar el contador.
  useEffect(() => {
    if (bloqueadoHasta === null) return;
    const t = setInterval(() => {
      if (Date.now() >= bloqueadoHasta) {
        setBloqueadoHasta(null);
        setIntentosFallidos(0);
        return;
      }
      forceTick((n) => n + 1);
    }, 500);
    return () => clearInterval(t);
  }, [bloqueadoHasta]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const bloqueado = bloqueadoHasta !== null && Date.now() < bloqueadoHasta;
  const segundosRestantes = bloqueado
    ? Math.ceil(((bloqueadoHasta as number) - Date.now()) / 1000)
    : 0;

  const enviar = async () => {
    if (bloqueado) return;
    const code = normalizarCodigo(valor);
    if (!codigoValido(code)) {
      setError(`El código son ${LARGO_CODIGO} letras o números.`);
      return;
    }
    setVerificando(true);
    setError(null);
    try {
      const res = await fetch("/api/pareo/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.status === 404) {
        const nuevosIntentos = intentosFallidos + 1;
        setIntentosFallidos(nuevosIntentos);
        if (nuevosIntentos >= MAX_INTENTOS) {
          setBloqueadoHasta(Date.now() + COOLDOWN_MS);
          setError(
            `Demasiados intentos. Espera ${Math.ceil(COOLDOWN_MS / 1000)} segundos.`
          );
        } else {
          const restan = MAX_INTENTOS - nuevosIntentos;
          setError(
            `Código no encontrado. Verifica con la computadora. (${restan} intento${restan === 1 ? "" : "s"} antes de bloqueo).`
          );
        }
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `Error ${res.status}`);
      }
      const sesion = (await res.json()) as SesionResumen;
      guardarSesionCelular(sesion);
      onConectado(sesion);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error de red.";
      setError(mensaje);
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">Paso 1</p>
        <h1 className="text-2xl font-medium text-ink">
          Ingresa el código de la computadora
        </h1>
        <p className="text-sm text-ink-2">
          La computadora muestra un código de 4 caracteres en la parte superior.
          Escríbelo aquí para que tus fotos se envíen solo a esa máquina.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex flex-col gap-4"
      >
        <label htmlFor="codigo" className="text-sm font-medium text-ink-2">
          Código
        </label>
        <input
          ref={inputRef}
          id="codigo"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={LARGO_CODIGO}
          value={valor}
          disabled={verificando || bloqueado}
          onChange={(e) => {
            setValor(normalizarCodigo(e.target.value));
            if (error) setError(null);
          }}
          placeholder="A B C D"
          className="h-20 rounded-md border border-line bg-paper px-4 text-center font-mono text-4xl tracking-[0.4em] text-ink focus-visible:border-ink disabled:bg-paper-2 disabled:text-ink-3"
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "codigo-err" : undefined}
        />

        {error && (
          <p
            id="codigo-err"
            role="alert"
            className="rounded-md border border-err/30 bg-err-soft p-3 text-sm text-ink-2"
          >
            <span className="font-medium text-err">No se pudo conectar.</span>{" "}
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={
            verificando || bloqueado || valor.length !== LARGO_CODIGO
          }
          className="flex min-h-[56px] items-center justify-center rounded-md bg-ink px-6 text-base font-semibold text-paper hover:bg-ink-2 disabled:bg-ink-3"
        >
          {verificando
            ? "Conectando…"
            : bloqueado
            ? `Espera ${segundosRestantes} s`
            : "Conectar"}
        </button>
      </form>
    </div>
  );
}
