"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { SesionResumen } from "./pareo";

// Provider de sesión de computadora.
//
// - En mount: si sessionStorage tiene un id válido, lo reusa. Si no, llama
//   /api/pareo/crear, guarda y empieza heartbeat.
// - Heartbeat: cada 30 s pinga last_seen_at (POST a /api/pareo/heartbeat).
//   No bloquea la UI; si falla, se reintenta en el siguiente tick.
// - El estado vive solo lo que dure la pestaña (sessionStorage es por
//   pestaña en navegadores actuales). Cerrar la pestaña = código nuevo
//   la próxima vez. Intencional.

const STORAGE_KEY = "pareo:sesion";
const HEARTBEAT_MS = 30_000;

type Estado =
  | { tipo: "cargando" }
  | { tipo: "listo"; sesion: SesionResumen }
  | { tipo: "error"; mensaje: string };

type Ctx = {
  estado: Estado;
  reintentar: () => void;
};

const PareoCtx = createContext<Ctx | null>(null);

function leerStorage(): SesionResumen | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SesionResumen;
    if (
      typeof parsed?.id === "string" &&
      typeof parsed?.code === "string" &&
      parsed.id.length > 0 &&
      parsed.code.length === 4
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function guardarStorage(s: SesionResumen | null) {
  if (typeof window === "undefined") return;
  if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(STORAGE_KEY);
}

export function PareoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inicializar = useCallback(async () => {
    setEstado({ tipo: "cargando" });
    const cache = leerStorage();
    if (cache) {
      setEstado({ tipo: "listo", sesion: cache });
      return;
    }
    try {
      const res = await fetch("/api/pareo/crear", { method: "POST" });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const j = (await res.json()) as SesionResumen;
      guardarStorage(j);
      setEstado({ tipo: "listo", sesion: j });
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : "No se pudo crear la sesión.";
      setEstado({ tipo: "error", mensaje });
    }
  }, []);

  useEffect(() => {
    inicializar();
  }, [inicializar]);

  // Heartbeat — solo arranca cuando ya hay sesión.
  useEffect(() => {
    if (estado.tipo !== "listo") return;
    const sesionId = estado.sesion.id;

    const tick = async () => {
      try {
        await fetch("/api/pareo/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sesionId }),
        });
      } catch {
        // Silencioso: si falla un heartbeat ahora, intentaremos en 30 s.
      }
    };
    tick();
    heartbeatRef.current = setInterval(tick, HEARTBEAT_MS);
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [estado]);

  return (
    <PareoCtx.Provider value={{ estado, reintentar: inicializar }}>
      {children}
    </PareoCtx.Provider>
  );
}

export function usePareo(): Ctx {
  const ctx = useContext(PareoCtx);
  if (!ctx) {
    throw new Error("usePareo se usa solo dentro de PareoProvider");
  }
  return ctx;
}

// Hook conveniente: devuelve solo el sessionId cuando ya hay sesión lista.
export function useSesionId(): string | null {
  const { estado } = usePareo();
  return estado.tipo === "listo" ? estado.sesion.id : null;
}

// Lado celular: helpers para leer/escribir el sessionId del pareo. El celular
// NO usa el provider porque su ciclo es distinto (entra el código una vez y
// luego sube documentos).
const STORAGE_KEY_CEL = "pareo:sesion-celular";

export function leerSesionCelular(): SesionResumen | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_CEL);
    if (!raw) return null;
    return JSON.parse(raw) as SesionResumen;
  } catch {
    return null;
  }
}

export function guardarSesionCelular(s: SesionResumen | null) {
  if (typeof window === "undefined") return;
  if (s) sessionStorage.setItem(STORAGE_KEY_CEL, JSON.stringify(s));
  else sessionStorage.removeItem(STORAGE_KEY_CEL);
}
