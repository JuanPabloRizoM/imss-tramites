# Base de datos — `tramites-imss`

Las migraciones SQL en `supabase/migrations/` son la **fuente única de verdad** del esquema. Tanto el entorno local (Supabase CLI + Docker) como el remoto (Supabase.com) se construyen aplicando estas migraciones — nunca se editan tablas a mano en el dashboard.

## Aplicar localmente (recomendado para desarrollo)

```bash
# Una sola vez: instalar Supabase CLI (https://supabase.com/docs/guides/cli)
brew install supabase/tap/supabase

# Inicializar carpeta supabase/ (solo la primera vez; ya está creada)
supabase init

# Arrancar Supabase local (Docker)
supabase start

# Aplicar todas las migraciones
supabase db reset
```

`supabase start` imprime las credenciales locales — cópialas a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # "anon key" del output
SUPABASE_SERVICE_ROLE_KEY=...       # "service_role key" del output
```

## Subir el esquema al proyecto remoto (cuando exista)

```bash
supabase link --project-ref <ref-del-proyecto>
supabase db push
```

`db push` aplica solo las migraciones que aún no están en remoto. No edita la base directamente.

## Archivos

- `migrations/0001_init.sql` — tablas `tramite_types`, `tramites`, `documents`, trigger de `updated_at`, publicación de Realtime.
- `migrations/0002_storage.sql` — bucket privado `documentos` para imágenes y PDFs.
