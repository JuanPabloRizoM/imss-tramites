// Build de la extensión para publicar al Edge Add-ons store.
// Uso: node tools/build-extension.mjs
//
// - Lee credenciales públicas de Supabase desde .env.local (las mismas que
//   ya usa el frontend Next.js — la anon key está diseñada para ser pública,
//   protegida por Row Level Security en la BD).
// - Copia extension/ a un dir temporal de build.
// - Reemplaza los placeholders __SUPABASE_URL__ y __SUPABASE_KEY__ en
//   popup.js con los valores reales.
// - Empaqueta el resultado a ~/Downloads/tramites-imss-extension-v<version>.zip.
//
// El zip resultante es el que se sube a Microsoft Partner Center vía
// "Update" en el dashboard del Edge program.

import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { spawnSync } from "child_process";

const REPO = process.cwd();
const SRC = path.join(REPO, "extension");
const OUT_DIR = path.join(os.homedir(), "Downloads");

const env = await fs.readFile(path.join(REPO, ".env.local"), "utf8");
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const key = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim();
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

const manifest = JSON.parse(await fs.readFile(path.join(SRC, "manifest.json"), "utf8"));
const version = manifest.version;
const zipName = `tramites-imss-extension-v${version}.zip`;
const zipPath = path.join(OUT_DIR, zipName);

// Dir temporal de build (limpio en cada corrida).
const BUILD = path.join(os.tmpdir(), `tramites-imss-build-${Date.now()}`);
await fs.mkdir(BUILD, { recursive: true });

// Lista de archivos/dirs que SÍ van al zip publicado. Excluye README,
// portales/*.raw.json (referencia interna) y el icono del store (se sube
// aparte como logo, no parte del paquete).
const incluir = [
  "manifest.json",
  "popup.html",
  "popup.js",
  "content.js",
  "icons/icon-16.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
];

for (const rel of incluir) {
  const src = path.join(SRC, rel);
  const dst = path.join(BUILD, rel);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
}

// Sustitución de placeholders en popup.js. JSON.stringify() escapa
// correctamente cualquier carácter especial dentro de la key.
const popupSrc = await fs.readFile(path.join(BUILD, "popup.js"), "utf8");
const popupPatched = popupSrc
  .replace('"__SUPABASE_URL__"', JSON.stringify(url))
  .replace('"__SUPABASE_KEY__"', JSON.stringify(key));
if (popupPatched === popupSrc) {
  console.error("No se encontraron los placeholders __SUPABASE_URL__/__SUPABASE_KEY__ en popup.js");
  process.exit(1);
}
await fs.writeFile(path.join(BUILD, "popup.js"), popupPatched);

// Zip. Usa el binario `zip` de macOS (sin colas externas).
await fs.rm(zipPath, { force: true });
const res = spawnSync("zip", ["-r", zipPath, "."], { cwd: BUILD, stdio: "inherit" });
if (res.status !== 0) {
  console.error("Falló el zip.");
  process.exit(1);
}

const { size } = await fs.stat(zipPath);
console.log(`\nOK — ${zipName} (${(size / 1024).toFixed(1)} KB)`);
console.log(`   Sube este zip en el dashboard de Edge → tu extensión → "Update".`);
console.log(`   Las credenciales quedan dentro; los empleados ya no las pedirán.`);

// Limpia el dir de build.
await fs.rm(BUILD, { recursive: true, force: true });
