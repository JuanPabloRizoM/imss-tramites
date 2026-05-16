---
name: supabase-local-to-remote
description: Set up and manage a Supabase project that runs locally first (using Supabase CLI + Docker) and later deploys to a hosted Supabase.com project, with the same schema, same client, and same SQL in both environments. Use this skill whenever the user wants to start a new project with Supabase, asks about "Supabase local", "supabase start", "supabase link", database migrations, or how to switch between local and production Supabase. Also use when the user mentions setting up a new database for a project, wants to develop offline before connecting to a hosted database, or asks how to deploy schema changes from local to production. The skill is framework-agnostic on the frontend (works with Next.js, SvelteKit, Astro, vanilla JS, etc.) — only the Supabase client import line changes per stack.
---

# Supabase: Local first, remote later

This skill teaches how to set up a project that uses **Supabase running locally** during all development, and then how to deploy the same schema to a **Supabase.com** project without anything breaking.

## Core philosophy (do not skip this)

The trick to making "switching from local to remote easy" is **not writing two versions of the code**. It's this:

1. **A single source of truth for the schema**: SQL files versioned in `supabase/migrations/`. Both local and remote are built from these files.
2. **Separate environment variables**: the code always reads from `process.env.SUPABASE_URL` and `process.env.SUPABASE_ANON_KEY`. In development they point to `localhost`, in production to the remote project. **The code does not change, only the `.env` does**.
3. **Migrations, not clicks**: never create tables by clicking around in the Supabase.com dashboard directly. Always via local migration → push to remote. This avoids "desync hell".

If the user asks to skip any of these rules, explain why it will hurt them later and propose the correct alternative before complying.

---

## When to use this skill

Trigger when the user:
- Is about to start a new project and mentioned Supabase
- Asks how to run Supabase locally
- Asks how to "switch between local and production"
- Wants to make schema changes to a Supabase DB safely
- Has errors like "schema out of sync", "migration failed", "relation does not exist"

Do NOT use this skill for:
- Projects that already have Supabase remote in use for a long time and don't use migrations — that case requires first a `supabase db pull` and special considerations not covered here
- Projects that are NOT going to use Supabase

---

## Prerequisites to verify first

Before doing anything, verify with the user:

1. **Docker Desktop installed and running**. Without Docker, Supabase local does not work. If they don't have it, send them to `https://docs.docker.com/desktop/` and wait.
2. **Node.js 20+** (the CLI needs it via npx).
3. **Git initialized in the project** (migrations are versioned, without Git you lose the history).
4. **Supabase.com account** — only needed when it's time to deploy, not to start.

---

## Complete step-by-step flow

### Step 1 — Install the Supabase CLI

**Do not use `npm install -g supabase`** — global installation via npm is not supported and fails. The correct options are:

- **macOS/Linux with Homebrew**: `brew install supabase/tap/supabase`
- **Windows with Scoop**: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`
- **As a dev dependency in the project** (recommended so the team uses the same version): `npm install supabase --save-dev` and then `npx supabase <command>`

Verify it worked:
```bash
supabase --version
# or if installed as dev dep:
npx supabase --version
```

### Step 2 — Initialize Supabase in the project

From the project root:

```bash
supabase init
```

This creates a `supabase/` folder with:
- `config.toml` — local stack configuration (ports, auth, storage, etc.)
- `migrations/` — versioned SQL files go here (empty for now)
- `seed.sql` — initial data for development (we'll create it later)

**This `supabase/` folder DOES get committed to Git.** It's part of the project.

### Step 3 — Start the local stack

```bash
supabase start
```

The first time it takes several minutes because it downloads Docker images (Postgres, GoTrue for auth, Storage, Realtime, Studio, etc.). When it finishes, it prints something like:

```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
anon key: eyJ...
service_role key: eyJ...
```

**Save these values** — you'll need them for the `.env` in the next step. If you lose them, recover them with `supabase status`.

Other useful commands here:
- `supabase stop` — shuts down the stack (without deleting data)
- `supabase stop --no-backup` — shuts down and deletes everything (use only if you want to start from scratch)
- `supabase status` — shows current URLs and keys

### Step 4 — Configure environment variables

Create two files at the project root:

**`.env.local`** (for development, this is the one used day to day):
```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<the anon key printed by supabase start>
```

**`.env.example`** (this DOES get committed, serves as a template for other devs):
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

**`.gitignore`** must include:
```
.env.local
.env.production
.env*.local
supabase/.temp/
```

**Important**: if the stack is Next.js, variables exposed to the browser need the `NEXT_PUBLIC_` prefix (e.g. `NEXT_PUBLIC_SUPABASE_URL`). Other frameworks have their own conventions (Vite uses `VITE_`, SvelteKit uses `PUBLIC_`). Adapt according to the user's stack.

### Step 5 — Create the first migration (the schema)

There are two ways to create migrations. Use the first one by default:

**Option A — Write SQL directly (recommended):**

```bash
supabase migration new create_users_table
```

This creates a file like `supabase/migrations/20260115120000_create_users_table.sql`. Edit it with standard Postgres SQL:

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

alter table users enable row level security;

create policy "Users can read their own row"
  on users for select
  using (auth.uid() = id);
```

Apply the migration to the local DB:

```bash
supabase db reset
```

`db reset` wipes the local DB and rebuilds it from **all** migrations in order, then runs `seed.sql`. It's the command you'll use the most.

**Option B — Create tables from the local Studio and diff:**

If the user is not comfortable with SQL, they can go to `http://127.0.0.1:54323`, create tables by clicking, and then run:

```bash
supabase db diff -f migration_name
```

This detects the changes and generates the migration `.sql` file automatically. Afterward you still need to run `supabase db reset` to confirm the migration applies cleanly from scratch.

### Step 6 — Create seeds (test data that survives `db reset`)

Edit `supabase/seed.sql`:

```sql
insert into users (email) values
  ('test@example.com'),
  ('demo@example.com');
```

Every time you run `supabase db reset`, this data is re-inserted. Useful so you don't lose test users.

### Step 7 — Connect the code to local Supabase

The code always reads from environment variables. Example in JavaScript/TypeScript:

```js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
```

**This does not change between local and production.** Only the loaded `.env` file changes.

### Step 8 — Working with Git branches without breaking anything

When the user wants to try something risky on the schema:

```bash
git checkout -b feature/new-table
supabase migration new add_orders_table
# edit the SQL
supabase db reset  # test locally
```

If something goes wrong: `git checkout main && supabase db reset` — you go back to the previous state.

If everything is fine: merge to main like any other change.

**Rule**: never edit a migration that has already been committed and merged. If you need to change something, create a new migration that modifies it. Editing old migrations breaks the history and desyncs environments.

---

## Deploy to Supabase.com (when ready)

Up to here, everything is local. When the project is ready to have a remote DB:

### Step 9 — Create the project on Supabase.com

1. Go to `https://supabase.com/dashboard`
2. Create a new project, write down the **project ref** (short string in the dashboard URL)
3. Write down the **database password** you set when creating it

### Step 10 — Link the local project to the remote one

```bash
supabase login
supabase link --project-ref <project-ref-from-step-9>
```

It asks for the database password. It saves it in the system keychain.

### Step 11 — Push the migrations to remote

```bash
supabase db push
```

This applies **all local migrations** to the remote project in order. If it's the first time, it creates the entire schema from scratch. If some migrations were already applied, it only applies the new ones.

**Before running `db push` for the first time on a remote project that already existed**, better run `supabase db pull` first to bring in any change made from the dashboard. If the remote is empty (newly created project), you can skip the pull.

### Step 12 — Configure production environment variables

On the platform where the project is deployed (Vercel, Netlify, Railway, etc.), set:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<the anon key from the supabase.com dashboard>
```

The `anon key` and the URL of the remote project are in the dashboard: Project Settings → API.

**The code does not change.** Only these variables change in the production environment.

---

## Day-to-day workflow (once everything is set up)

```bash
# Start working
supabase start

# Make schema changes
supabase migration new description_of_change
# edit the .sql
supabase db reset  # apply locally

# When tested and committed
supabase db push   # apply to remote
```

---

## Golden rules (do not break)

1. **Never create tables by clicking in the Supabase.com dashboard directly.** Always via local migration. If it already happened, run `supabase db pull` to capture it as a migration before things get out of sync.
2. **Never edit a migration already merged into main.** Create a new one that modifies the previous one.
3. **Never commit `.env.local`** or files with real keys. Only `.env.example` with empty templates.
4. **Never use `supabase stop --no-backup` without having backed up** what matters with `supabase db dump`.
5. **`supabase db reset` wipes EVERYTHING locally.** Only used locally, never against the remote.
6. **`supabase db push` modifies the remote.** Always review which migrations will be applied beforehand (with `supabase migration list`).

---

## Common errors and how to fix them

**"Cannot connect to the Docker daemon"** → Docker Desktop is not running. Open it and retry.

**"Port 54321 is already in use"** → there's already another `supabase start` running (maybe from another project). Run `supabase stop` in the other project, or change ports in `config.toml`.

**"relation does not exist" locally** → the migration wasn't applied. Run `supabase db reset`.

**"relation does not exist" on remote but yes on local** → missed running `supabase db push`.

**Local schema and remote don't match** → check with `supabase db diff --linked` what differs. If there are changes on the remote that aren't on local (because someone clicked in the dashboard), run `supabase db pull` to capture them as a migration.

**"password authentication failed for user 'postgres'"** when running `supabase link` → the database password is wrong. Reset it from the Supabase.com dashboard (Project Settings → Database).

---

## Final project structure

```
my-project/
├── supabase/
│   ├── config.toml          # local stack configuration
│   ├── migrations/          # versioned SQL (source of truth for the schema)
│   │   └── 20260115120000_create_users_table.sql
│   └── seed.sql             # test data for development
├── .env.local               # DO NOT commit (points to localhost)
├── .env.example             # DO commit (empty template)
├── .gitignore               # must include .env.local
└── (project code)
```

That's the foundation. Everything else (authentication, storage, edge functions, realtime) is built on top of this flow.
