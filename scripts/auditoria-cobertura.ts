// Auditoría de cobertura: doc_types de extracción vs field_schemas de los
// trámites del catálogo vivo.
//
// Para cada trámite y cada documento fuente (source_doc) que declara su
// field_schema, simula la precarga (lib/precarga.ts) suponiendo que el
// doc_type extrajo TODOS sus campos, y reporta los campos del schema que
// quedarían vacíos — es decir, los huecos reales de extracción.
//
// Correr:  npx tsx scripts/auditoria-cobertura.ts
// Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y _ANON_KEY.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DOC_TYPES } from "../lib/extraccion";
import { precargarValores } from "../lib/precarga";
import type { CampoSchema, TramiteType } from "../lib/tramites";

function leerEnv(clave: string): string {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  const linea = env.split("\n").find((l) => l.startsWith(`${clave}=`));
  if (!linea) throw new Error(`Falta ${clave} en .env.local`);
  return linea.slice(clave.length + 1).trim();
}

async function main() {
  const url = leerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = leerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const res = await fetch(
    `${url}/rest/v1/tramite_types?select=code,name,apartado,field_schema,source_docs&active=eq.true&order=apartado,code`,
    { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const tramites = (await res.json()) as Pick<
    TramiteType,
    "code" | "name" | "apartado" | "field_schema" | "source_docs"
  >[];

  let totalHuecos = 0;

  for (const t of tramites) {
    const schema = (t.field_schema ?? []) as CampoSchema[];
    if (schema.length === 0) continue;

    console.log(`\n━━━ [A${t.apartado}] ${t.code} — ${t.name}`);
    console.log(`    ${schema.length} campos · fuentes: ${(t.source_docs ?? []).join(", ") || "(ninguna)"}`);

    for (const docId of t.source_docs ?? []) {
      const docType = DOC_TYPES[docId];
      if (!docType) {
        console.log(`  ⚠️  source_doc "${docId}" NO EXISTE como doc_type`);
        totalHuecos++;
        continue;
      }

      // Extracción simulada: todos los campos del doc_type con valor.
      // Para campos que aterrizan en selects del schema hay que simular
      // un valor REAL (ajustarASelect rechaza lo que no mapea a una
      // option — comportamiento correcto).
      const VALOR_SIMULADO: Record<string, string> = {
        sexo: "H",
        tipo_persona: "FISICA",
        clase_rt: "IV",
        clase: "IV",
        tipo_emision: "EMA",
      };
      const extraidoSimulado: Record<string, unknown> = {};
      for (const c of docType.campos) {
        extraidoSimulado[c.id] = {
          valor: VALOR_SIMULADO[c.id] ?? "X",
          confianza: "alto",
        };
      }

      // Pasamos docId como tercer argumento — igual que el flujo real de
      // "Llevar a…", que conoce el doc_type del documento fuente.
      const precargados = precargarValores(schema, extraidoSimulado, docId);

      // Campos del schema que DECLARAN venir de este doc y no se llenaron.
      const esperados = schema.filter((c) => c.source_doc === docId);
      const huecos = esperados.filter((c) => !(c.id in precargados));

      const cubiertos = esperados.length - huecos.length;
      const tag = huecos.length === 0 ? "✅" : "❌";
      console.log(
        `  ${tag} ${docId}: ${cubiertos}/${esperados.length} campos esperados cubiertos` +
          (Object.keys(precargados).length > cubiertos
            ? ` (+${Object.keys(precargados).length - cubiertos} extra por coincidencia)`
            : "")
      );
      for (const h of huecos) {
        console.log(`       · falta ${h.id} — "${h.label}" [${h.section ?? "sin sección"}]`);
        totalHuecos++;
      }
    }

    // Campos con source_doc que apunta a un doc que el trámite NO lista.
    const fuentesDeclaradas = new Set(t.source_docs ?? []);
    const huerfanos = schema.filter(
      (c) => c.source_doc && !fuentesDeclaradas.has(c.source_doc)
    );
    for (const h of huerfanos) {
      console.log(
        `  ⚠️  ${h.id} declara source_doc="${h.source_doc}" pero el trámite no lo lista`
      );
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`TOTAL de huecos de cobertura: ${totalHuecos}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
