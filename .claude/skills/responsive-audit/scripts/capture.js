#!/usr/bin/env node
/**
 * capture.js — Multi-width screenshot capture for a responsive audit.
 *
 * Loads one or more routes at a set of viewport widths and saves a full-page
 * screenshot for each width/route combination. Designed to be run by the
 * `responsive-audit` skill, but usable standalone.
 *
 * Usage:
 *   node capture.js --url http://localhost:3000 --routes "/,/about" --out ./audit-output
 *
 * Flags:
 *   --url      Base URL of the running site (required).
 *   --routes   Comma-separated route paths to capture. Default: "/".
 *   --widths   Comma-separated viewport widths in px. Default: the standard set.
 *   --out      Output directory for screenshots. Default: "./audit-output".
 *
 * Requires Playwright with Chromium:
 *   npm install -D playwright && npx playwright install chromium
 */

const fs = require('fs');
const path = require('path');

// Default widths span the meaningful range, not three arbitrary devices.
// 320 doubles as the WCAG 1.4.10 reflow check; 1920 catches "thin stripe" content.
const DEFAULT_WIDTHS = [320, 375, 768, 1024, 1440, 1920];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}

function slug(routePath) {
  const s = routePath.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-');
  return s.length ? s : 'home';
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.url) {
    console.error('Error: --url is required. Example:');
    console.error('  node capture.js --url http://localhost:3000 --routes "/" --out ./audit-output');
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    console.error('Error: Playwright is not installed.');
    console.error('Install it with:');
    console.error('  npm install -D playwright && npx playwright install chromium');
    process.exit(1);
  }

  const baseUrl = args.url.replace(/\/+$/, '');
  const routes = (args.routes || '/').split(',').map((r) => r.trim()).filter(Boolean);
  const widths = (args.widths
    ? args.widths.split(',').map((w) => parseInt(w.trim(), 10)).filter((n) => !Number.isNaN(n))
    : DEFAULT_WIDTHS);
  const outDir = args.out || './audit-output';

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const results = [];

  for (const route of routes) {
    const url = baseUrl + (route.startsWith('/') ? route : '/' + route);
    for (const width of widths) {
      // Height is a sensible default; fullPage capture overrides it anyway.
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const fileName = `${slug(route)}-${width}px.png`;
      const filePath = path.join(outDir, fileName);

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        // Settle layout: let fonts and lazy content land before capturing.
        await page.waitForTimeout(500);

        // Detect horizontal overflow — the single most common responsive bug.
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            hasHorizontalScroll: doc.scrollWidth > doc.clientWidth + 1,
          };
        });

        await page.screenshot({ path: filePath, fullPage: true });

        results.push({ route, width, file: fileName, overflow });
        const flag = overflow.hasHorizontalScroll ? '  [HORIZONTAL SCROLL]' : '';
        console.log(`captured ${fileName}${flag}`);
      } catch (err) {
        results.push({ route, width, file: null, error: err.message });
        console.error(`failed  ${route} @ ${width}px — ${err.message}`);
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();

  // Write a machine-readable index so the auditor can cross-reference findings.
  const indexPath = path.join(outDir, 'capture-index.json');
  fs.writeFileSync(indexPath, JSON.stringify({ baseUrl, results }, null, 2));

  const overflowHits = results.filter((r) => r.overflow && r.overflow.hasHorizontalScroll);
  console.log(`\nDone. ${results.length} captures saved to ${outDir}`);
  if (overflowHits.length) {
    console.log(`WARNING: horizontal scroll detected at ${overflowHits.length} width(s):`);
    overflowHits.forEach((r) => console.log(`  ${r.route} @ ${r.width}px`));
  }
  console.log(`Index written to ${indexPath}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
