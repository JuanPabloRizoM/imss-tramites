# tramites-imss

Aplicación web interna de una papelería que tramita asuntos del IMSS. Ver `imss-tramites.md` para el plano completo (arquitectura, alcance, fases).

**Estado:** Fase 0 — cimientos. Pantalla "quiz" + 4 apartados vacíos + tablas en Supabase. Las funciones de cada apartado se construyen en las fases 1–5.

## Stack

- **Next.js** (App Router, TypeScript) — front + API routes.
- **Supabase** (PostgreSQL + Storage + Realtime) — datos, archivos, sincronización celular↔computadora.
- **Tailwind CSS** — estilos, siguiendo las reglas de "herramienta interna" del documento (base-4, accesibilidad WCAG AA, sin lenguaje de marketing).
- **API de Anthropic** (Haiku) — extracción de datos (Fase 1).

## Estructura

```
tramites-imss/
├── app/
│   ├── page.tsx              # Pantalla inicio: el "quiz" con los 4 apartados
│   ├── apartado-1/           # Escritos y formatos (PDF)
│   ├── apartado-2/           # Altas/prealtas/certificado (extensión)
│   ├── apartado-3/           # Extracción de datos
│   ├── apartado-4/           # Genérico / formulario cliente
│   └── layout.tsx
├── components/
│   └── ApartadoShell.tsx     # Layout reutilizable de cada apartado
├── lib/
│   └── supabase.ts           # Clientes navegador/servidor/service-role
├── supabase/
│   ├── migrations/           # Esquema SQL versionado (fuente de verdad)
│   └── README.md
├── .claude/skills/           # Skills consultadas por Claude Code
└── .env.local.example        # Plantilla de variables — NUNCA subir .env.local
```

## Configuración local

1. Instala dependencias:
   ```bash
   npm install
   ```

2. Copia el ejemplo de variables y llénalo:
   ```bash
   cp .env.local.example .env.local
   ```
   Las claves de Supabase salen al correr `supabase start` (ver `supabase/README.md`). La `ANTHROPIC_API_KEY` se necesita hasta la Fase 1.

3. Aplica las migraciones a Supabase local (ver `supabase/README.md`):
   ```bash
   supabase start
   supabase db reset
   ```

4. Arranca la app:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000). Debes ver la pregunta *"¿Qué trámite vas a hacer?"* con los 4 botones.

## Comandos

- `npm run dev` — desarrollo en `localhost:3000`.
- `npm run build` — build de producción.
- `npm run start` — servir el build.
- `npm run lint` — linter.

## Seguridad

- `.env.local` **no** se sube a Git (está en `.gitignore`). Solo se versiona `.env.local.example` sin valores.
- `ANTHROPIC_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY` se usan **solo** en API routes del servidor, nunca en el navegador.
- Si una clave se expone por accidente: **rotarla** (generar nueva y desactivar la vieja); no basta con borrar el archivo.

## Próximas fases

| Fase | Qué se construye |
|---|---|
| **0** ✅ | Cimientos: este estado actual. |
| **1** | Apartado 3 — extracción de datos con Haiku. |
| **2** | Apartado 1 — formatos a PDF (empezar con AFIL-01 + escrito genérico). |
| **3** | Apartado 4 — genérico y formulario para cliente. |
| **5** | Pulido: vista móvil, Realtime, marca "en proceso", manejo de errores. |
| **4** | Apartado 2 — extensión de navegador (requiere mapeo manual del portal). |

Sigue el orden de fases. Cada una debe quedar funcionando antes de pasar a la siguiente.
