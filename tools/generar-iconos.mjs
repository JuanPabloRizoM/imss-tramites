// Genera los iconos PNG de la extensión a partir de un SVG inline.
// Uso: node tools/generar-iconos.mjs
//
// Salida:
//   extension/icons/icon-{16,48,128}.png  (los que pide manifest.json)
//   extension/icons/icon-store-300.png    (para el listing de Edge Add-ons)

import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

// SVG cuadrado 128×128 — fondo ink + "T" serif blanca + barra (representa
// formulario llenándose). Diseño austero, consistente con la app.
const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1f1f24"/>
      <stop offset="100%" stop-color="#16161a"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="128" height="128" rx="24" ry="24" fill="url(#bg)"/>
  <!-- Tres líneas horizontales que evocan campos de un formulario -->
  <rect x="28" y="40" width="48" height="6"  rx="3" fill="#e8e6df" opacity="0.55"/>
  <rect x="28" y="58" width="72" height="6"  rx="3" fill="#e8e6df" opacity="0.55"/>
  <rect x="28" y="76" width="58" height="6"  rx="3" fill="#e8e6df" opacity="0.55"/>
  <!-- Marca de "lleno" — palomita que cruza arriba a la derecha -->
  <path d="M88 88 L100 100 L120 76" stroke="#7fb069" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
`;

const ROOT = path.join(process.cwd(), "extension", "icons");
await fs.mkdir(ROOT, { recursive: true });

const tamanos = [
  { tam: 16,  archivo: "icon-16.png" },
  { tam: 48,  archivo: "icon-48.png" },
  { tam: 128, archivo: "icon-128.png" },
  { tam: 300, archivo: "icon-store-300.png" },
];

for (const { tam, archivo } of tamanos) {
  const buffer = await sharp(Buffer.from(SVG))
    .resize(tam, tam, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const dest = path.join(ROOT, archivo);
  await fs.writeFile(dest, buffer);
  console.log(`  ${archivo.padEnd(28)} ${tam}×${tam}  ${buffer.length}B`);
}

console.log("\nOK — iconos en extension/icons/");
