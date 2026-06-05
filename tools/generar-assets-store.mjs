// Genera los assets visuales para el listing de Microsoft Edge Add-ons.
// Uso: node tools/generar-assets-store.mjs
//
// Salida en ~/Downloads (rutas absolutas, copia-y-sube al wizard):
//   tramites-imss-screenshot.png   1280×800   (obligatorio)
//   tramites-imss-promo-small.png  440×280    (opcional)
//   tramites-imss-promo-large.png  1400×560   (opcional)

import { promises as fs } from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";

const OUT = path.join(os.homedir(), "Downloads");

// Paleta consistente con la app:
const PAPER = "#f5f3ec";
const PAPER_2 = "#e8e6df";
const INK = "#16161a";
const INK_2 = "#3a3a44";
const INK_3 = "#777783";
const LINE = "#d6d3c9";
const ACCENT = "#7fb069";

// ─── Screenshot 1280×800 ─────────────────────────────────────────
// Mock del flujo: la app web a la izquierda con un trámite revisado +
// el popup de la extensión a la derecha listo para "Llenar formulario".
const SCREENSHOT_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" width="1280" height="800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fafaf6"/>
      <stop offset="100%" stop-color="#eeece4"/>
    </linearGradient>
    <linearGradient id="popup-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1f1f24"/>
      <stop offset="100%" stop-color="#16161a"/>
    </linearGradient>
  </defs>

  <!-- Fondo papel -->
  <rect width="1280" height="800" fill="url(#bg)"/>

  <!-- Header de la app -->
  <text x="80" y="80"  font-family="Georgia, serif" font-size="14" letter-spacing="2" fill="${INK_3}">APARTADO 2</text>
  <text x="80" y="130" font-family="Georgia, serif" font-size="44" fill="${INK}">Altas, prealtas y certificado digital</text>
  <text x="80" y="160" font-family="-apple-system, sans-serif" font-size="16" fill="${INK_2}">Capturas datos aquí; la extensión los pega en el portal del IMSS en Edge.</text>

  <!-- Línea separadora -->
  <line x1="80" y1="195" x2="780" y2="195" stroke="${LINE}" stroke-width="1"/>

  <!-- Tarjeta del trámite -->
  <rect x="80" y="220" width="700" height="500" rx="8" fill="${PAPER}" stroke="${LINE}" stroke-width="1"/>

  <text x="105" y="255" font-family="-apple-system, sans-serif" font-size="12" letter-spacing="1.5" font-weight="600" fill="${INK_3}">CERT-DIGITAL · SOLICITUD</text>
  <text x="105" y="285" font-family="-apple-system, sans-serif" font-size="22" font-weight="600" fill="${INK}">Certificado Digital — IDSE</text>

  <!-- Pseudo-form fields -->
  <text x="105" y="330" font-family="-apple-system, sans-serif" font-size="13" font-weight="500" fill="${INK_2}">Registro patronal (NRP)</text>
  <rect x="105" y="338" width="320" height="40" rx="6" fill="${PAPER_2}" stroke="${LINE}" stroke-width="1"/>
  <text x="120" y="364" font-family="-apple-system, sans-serif" font-size="14" fill="${INK}">Y12-34567-10</text>

  <text x="445" y="330" font-family="-apple-system, sans-serif" font-size="13" font-weight="500" fill="${INK_2}">RFC completo</text>
  <rect x="445" y="338" width="230" height="40" rx="6" fill="${PAPER_2}" stroke="${LINE}" stroke-width="1"/>
  <text x="460" y="364" font-family="-apple-system, sans-serif" font-size="14" fill="${INK}">CTE240101ABC</text>

  <text x="105" y="408" font-family="-apple-system, sans-serif" font-size="13" font-weight="500" fill="${INK_2}">Razón social</text>
  <rect x="105" y="416" width="570" height="40" rx="6" fill="${PAPER_2}" stroke="${LINE}" stroke-width="1"/>
  <text x="120" y="442" font-family="-apple-system, sans-serif" font-size="14" fill="${INK}">CONSTRUCTORA TEST SA DE CV</text>

  <text x="105" y="486" font-family="-apple-system, sans-serif" font-size="13" font-weight="500" fill="${INK_2}">Correo electrónico</text>
  <rect x="105" y="494" width="570" height="40" rx="6" fill="${PAPER_2}" stroke="${LINE}" stroke-width="1"/>
  <text x="120" y="520" font-family="-apple-system, sans-serif" font-size="14" fill="${INK}">contacto@constructora-test.mx</text>

  <text x="105" y="564" font-family="-apple-system, sans-serif" font-size="13" font-weight="500" fill="${INK_2}">Domicilio</text>
  <rect x="105" y="572" width="570" height="40" rx="6" fill="${PAPER_2}" stroke="${LINE}" stroke-width="1"/>
  <text x="120" y="598" font-family="-apple-system, sans-serif" font-size="14" fill="${INK}">AV. VALLARTA 1234, COL. CENTRO, GDL, JAL., 44100</text>

  <!-- Botón "Marcar revisado" -->
  <rect x="105" y="650" width="220" height="48" rx="6" fill="${INK}"/>
  <text x="215" y="680" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" fill="${PAPER}" text-anchor="middle">✓ Marcado revisado</text>

  <!-- Popup de la extensión (lado derecho) -->
  <rect x="820" y="220" width="380" height="540" rx="12" fill="url(#popup-grad)" stroke="#3a3a44" stroke-width="1"/>

  <!-- Header del popup con ícono mini -->
  <rect x="840" y="240" width="36" height="36" rx="6" fill="#16161a"/>
  <rect x="848" y="252" width="14" height="3" rx="1.5" fill="${PAPER}" opacity="0.55"/>
  <rect x="848" y="259" width="20" height="3" rx="1.5" fill="${PAPER}" opacity="0.55"/>
  <rect x="848" y="266" width="16" height="3" rx="1.5" fill="${PAPER}" opacity="0.55"/>
  <path d="M866 268 L869 271 L874 264" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>

  <text x="888" y="263" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" fill="${PAPER}">Trámites</text>
  <text x="888" y="278" font-family="-apple-system, sans-serif" font-size="11" fill="#777783">Llenado del portal IMSS</text>

  <!-- Estado del portal -->
  <text x="840" y="320" font-family="-apple-system, sans-serif" font-size="11" letter-spacing="1" font-weight="600" fill="${ACCENT}">● PORTAL DETECTADO</text>
  <text x="840" y="338" font-family="-apple-system, sans-serif" font-size="12" fill="#9b9ba6">idse.imss.gob.mx</text>

  <!-- Label -->
  <text x="840" y="380" font-family="-apple-system, sans-serif" font-size="11" letter-spacing="1" font-weight="600" fill="#777783">TRÁMITE REVISADO</text>

  <!-- Dropdown trámite -->
  <rect x="840" y="394" width="340" height="44" rx="6" fill="#2a2a30" stroke="#3a3a44" stroke-width="1"/>
  <text x="855" y="421" font-family="-apple-system, sans-serif" font-size="13" font-weight="600" fill="${PAPER}">CERT-DIGITAL · CONSTRUCTORA TEST</text>

  <!-- Botón llenar -->
  <rect x="840" y="464" width="340" height="52" rx="6" fill="${PAPER}"/>
  <text x="1010" y="497" font-family="-apple-system, sans-serif" font-size="15" font-weight="700" fill="${INK}" text-anchor="middle">Llenar formulario</text>

  <!-- Hint -->
  <text x="840" y="548" font-family="-apple-system, sans-serif" font-size="11" fill="#9b9ba6">Pega los datos directo en los campos del</text>
  <text x="840" y="563" font-family="-apple-system, sans-serif" font-size="11" fill="#9b9ba6">portal — Estado, Municipio y Colonia se</text>
  <text x="840" y="578" font-family="-apple-system, sans-serif" font-size="11" fill="#9b9ba6">cargan en cadena automáticamente.</text>

  <!-- Pie -->
  <text x="840" y="730" font-family="-apple-system, sans-serif" font-size="10" fill="#5a5a64">v0.3.1 · Trámites IMSS</text>

  <!-- Flecha conectando form → popup -->
  <path d="M790 470 Q 805 470 815 470" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round" fill="none"/>
  <polygon points="815,464 825,470 815,476" fill="${ACCENT}"/>
</svg>
`;

// ─── Small promotional tile 440×280 ──────────────────────────────
const PROMO_SMALL_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 280" width="440" height="280">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1f1f24"/>
      <stop offset="100%" stop-color="#0f0f12"/>
    </linearGradient>
  </defs>
  <rect width="440" height="280" fill="url(#bg)"/>

  <!-- Logo grande arriba -->
  <rect x="32" y="46" width="72" height="72" rx="14" fill="#16161a" stroke="#3a3a44" stroke-width="1"/>
  <rect x="46" y="68" width="22" height="4" rx="2" fill="#e8e6df" opacity="0.55"/>
  <rect x="46" y="78" width="34" height="4" rx="2" fill="#e8e6df" opacity="0.55"/>
  <rect x="46" y="88" width="26" height="4" rx="2" fill="#e8e6df" opacity="0.55"/>
  <path d="M82 92 L88 98 L98 84" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>

  <!-- Nombre -->
  <text x="32" y="158" font-family="Georgia, serif" font-size="30" font-weight="600" fill="#f5f3ec">Trámites IMSS</text>
  <text x="32" y="190" font-family="-apple-system, sans-serif" font-size="14" font-weight="500" fill="#9b9ba6">Llenado del portal</text>

  <!-- Tagline -->
  <text x="32" y="232" font-family="-apple-system, sans-serif" font-size="12" fill="#777783">Rellena el portal del IMSS</text>
  <text x="32" y="248" font-family="-apple-system, sans-serif" font-size="12" fill="#777783">automáticamente.</text>
</svg>
`;

// ─── Large promotional tile 1400×560 ─────────────────────────────
const PROMO_LARGE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 560" width="1400" height="560">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1f1f24"/>
      <stop offset="100%" stop-color="#0f0f12"/>
    </linearGradient>
  </defs>
  <rect width="1400" height="560" fill="url(#bg)"/>

  <!-- Logo grande -->
  <rect x="96" y="160" width="180" height="180" rx="32" fill="#16161a" stroke="#3a3a44" stroke-width="2"/>
  <rect x="132" y="216" width="56" height="9" rx="4.5" fill="#e8e6df" opacity="0.55"/>
  <rect x="132" y="240" width="84" height="9" rx="4.5" fill="#e8e6df" opacity="0.55"/>
  <rect x="132" y="264" width="68" height="9" rx="4.5" fill="#e8e6df" opacity="0.55"/>
  <path d="M205 268 L221 282 L249 254" stroke="${ACCENT}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>

  <!-- Texto principal -->
  <text x="340" y="240" font-family="Georgia, serif" font-size="68" font-weight="600" fill="#f5f3ec">Trámites IMSS</text>
  <text x="340" y="290" font-family="-apple-system, sans-serif" font-size="26" font-weight="400" fill="#9b9ba6">Llenado automático del portal</text>

  <text x="340" y="370" font-family="-apple-system, sans-serif" font-size="20" fill="#bcbcc4">Captura los datos del patrón una vez en la app interna —</text>
  <text x="340" y="400" font-family="-apple-system, sans-serif" font-size="20" fill="#bcbcc4">la extensión los pega en los campos del IMSS solo.</text>

  <!-- Chips de dominios -->
  <rect x="340" y="442" width="280" height="34" rx="17" fill="#2a2a30" stroke="#3a3a44"/>
  <text x="360" y="464" font-family="-apple-system, sans-serif" font-size="12" font-weight="600" fill="${ACCENT}">●</text>
  <text x="376" y="464" font-family="-apple-system, sans-serif" font-size="13" font-weight="500" fill="#e8e6df">altapatronalpresencial.imss.gob.mx</text>

  <rect x="630" y="442" width="180" height="34" rx="17" fill="#2a2a30" stroke="#3a3a44"/>
  <text x="650" y="464" font-family="-apple-system, sans-serif" font-size="12" font-weight="600" fill="${ACCENT}">●</text>
  <text x="666" y="464" font-family="-apple-system, sans-serif" font-size="13" font-weight="500" fill="#e8e6df">idse.imss.gob.mx</text>
</svg>
`;

async function renderTo(svg, outPath, w, h) {
  const buffer = await sharp(Buffer.from(svg))
    .resize(w, h, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await fs.writeFile(outPath, buffer);
  console.log(`  ${path.basename(outPath).padEnd(34)} ${w}×${h}  ${(buffer.length / 1024).toFixed(1)}KB`);
}

await renderTo(SCREENSHOT_SVG, path.join(OUT, "tramites-imss-screenshot.png"), 1280, 800);
await renderTo(PROMO_SMALL_SVG, path.join(OUT, "tramites-imss-promo-small.png"), 440, 280);
await renderTo(PROMO_LARGE_SVG, path.join(OUT, "tramites-imss-promo-large.png"), 1400, 560);

console.log(`\nOK — assets en ${OUT}/`);
