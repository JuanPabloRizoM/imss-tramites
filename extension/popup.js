// Popup de la extensión.
//
// 1) Credenciales del Supabase de la papelería vienen embebidas (build time).
//    La anon key está diseñada para ser pública (Row Level Security protege
//    los datos). chrome.storage.local sigue funcionando como override por si
//    en una computadora específica se necesita apuntar a otra base.
// 2) Lista trámites del apartado 2 cuyo `tramites.status = 'revisado'`.
// 3) Al hacer click en "Llenar formulario", envía un mensaje al tab activo
//    si está en el portal del IMSS. El content script hace el llenado.

// Inyectados en build desde .env.local — NO editar a mano. Si necesitas
// reemplazarlos corre: node tools/build-extension.mjs
const SUPABASE_URL_DEFAULT = "__SUPABASE_URL__";
const SUPABASE_KEY_DEFAULT = "__SUPABASE_KEY__";

// Lista de hosts que la extensión soporta (debe quedar sincronizada con
// `host_permissions` y `content_scripts.matches` del manifest.json). Sirve
// para el mensaje genérico al inicio, cuando todavía no se eligió trámite.
const PORTAL_HOSTS = [
  "altapatronalpresencial.imss.gob.mx",
  "idse.imss.gob.mx",
];

// Saca el host de una URL — null si la URL es inválida.
function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

// El portal SAPI distingue persona física/moral por el query param `method`
// (initCapturaFisica vs initCapturaMoral) — mismo host, página distinta.
// Comparar solo el host dejaba pasar el cruce: llenar un trámite de persona
// moral parado en la captura de persona física pegaba 1 campo y fallaba 11.
function methodOf(url) {
  try {
    return new URL(url).searchParams.get("method");
  } catch {
    return null;
  }
}

const NOMBRE_METHOD = {
  initCapturaFisica: "persona FÍSICA",
  initCapturaMoral: "persona MORAL",
};

const $ = (sel) => document.querySelector(sel);
const $config = $("#config-block");
const $main = $("#main-block");
const $loading = $("#loading-block");
const $msg = $("#msg");
const $select = $("#tramite-select");
const $btnLlenar = $("#btn-llenar");
const $portalStatus = $("#portal-status");

let tramitesCache = [];

function setMsg(text, type = "") {
  $msg.textContent = text || "";
  $msg.className = "msg " + type;
}

async function getConfig() {
  const stored = await chrome.storage.local.get(["supabaseUrl", "supabaseKey"]);
  return {
    supabaseUrl: stored.supabaseUrl || SUPABASE_URL_DEFAULT,
    supabaseKey: stored.supabaseKey || SUPABASE_KEY_DEFAULT,
  };
}

async function rest(url, key, path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function obtenerTramitesRevisados() {
  const { supabaseUrl, supabaseKey } = await getConfig();
  if (!supabaseUrl || !supabaseKey) throw new Error("Sin configurar.");

  // Pull tramite_types del apartado 2 + sus trámites en revisado.
  const tipos = await rest(
    supabaseUrl,
    supabaseKey,
    "tramite_types?select=id,code,name,field_schema,portal_url&apartado=eq.2&active=eq.true"
  );
  const ids = tipos.map((t) => t.id);
  if (ids.length === 0) return [];

  const tramites = await rest(
    supabaseUrl,
    supabaseKey,
    `tramites?select=id,tramite_type_id,field_values,status,updated_at&tramite_type_id=in.(${ids.join(
      ","
    )})&status=eq.revisado&order=updated_at.desc&limit=20`
  );

  return tramites.map((t) => {
    const tipo = tipos.find((x) => x.id === t.tramite_type_id);
    return { ...t, tipo };
  });
}

async function pintarLista() {
  setMsg("Cargando…");
  try {
    tramitesCache = await obtenerTramitesRevisados();
    $select.innerHTML = "";
    if (tramitesCache.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "— Sin trámites revisados —";
      $select.appendChild(opt);
      $btnLlenar.disabled = true;
      setMsg("Marca un trámite como 'revisado' en la app para verlo aquí.");
    } else {
      tramitesCache.forEach((t, i) => {
        const opt = document.createElement("option");
        opt.value = String(i);
        const nombre = t.field_values?.razon_social ||
                       [t.field_values?.nombre, t.field_values?.apellido_paterno].filter(Boolean).join(" ") ||
                       "(Sin nombre)";
        opt.textContent = `${t.tipo?.code?.toUpperCase() ?? "?"} · ${nombre}`;
        $select.appendChild(opt);
      });
      $btnLlenar.disabled = false;
      setMsg("");
      // Revalida el portal contra el primer trámite seleccionado por defecto.
      verificarPortalAbierto(tramitesCache[0]?.tipo?.portal_url);
    }
  } catch (err) {
    setMsg(err.message || "Error", "err");
    $btnLlenar.disabled = true;
  }
}

// Verifica si la pestaña activa está en alguno de los portales soportados.
// Si pasas `expectedPortalUrl`, exige que esté en ese portal específico
// (host match). Sin parámetro, acepta cualquiera de los PORTAL_HOSTS.
async function verificarPortalAbierto(expectedPortalUrl) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabHost = hostOf(tab?.url ?? "");
  let ok = false;
  let mensaje = "Abre el portal del IMSS en esta pestaña antes de llenar.";

  if (expectedPortalUrl) {
    const expected = hostOf(expectedPortalUrl);
    const expectedMethod = methodOf(expectedPortalUrl);
    const tabMethod = methodOf(tab?.url ?? "");
    const hostOk = !!tabHost && !!expected && tabHost === expected;
    const methodOk = expectedMethod == null || tabMethod === expectedMethod;
    ok = hostOk && methodOk;
    if (!hostOk) {
      mensaje = `Abre ${expected} en esta pestaña — actualmente estás en ${tabHost || "una pestaña sin URL"}.`;
    } else if (!methodOk) {
      const esperado = NOMBRE_METHOD[expectedMethod] ?? expectedMethod;
      const actual = NOMBRE_METHOD[tabMethod] ?? tabMethod ?? "otra página del portal";
      mensaje = `Este trámite es de ${esperado}, pero esta pestaña es la captura de ${actual}. Abre: ${expectedPortalUrl}`;
    } else {
      mensaje = `Portal correcto detectado (${expected}).`;
    }
  } else {
    ok = !!tabHost && PORTAL_HOSTS.includes(tabHost);
    mensaje = ok
      ? `Portal del IMSS detectado (${tabHost}).`
      : "Abre el portal del IMSS en esta pestaña antes de llenar.";
  }

  $portalStatus.textContent = mensaje;
  $portalStatus.style.color = ok ? "var(--ok)" : "var(--ink-3)";
  return ok;
}

async function llenarFormulario() {
  const idx = Number($select.value);
  const tramite = tramitesCache[idx];
  if (!tramite) return;

  // Valida contra el portal específico de este trámite (no genérico).
  const portalOk = await verificarPortalAbierto(tramite.tipo?.portal_url);
  if (!portalOk) {
    setMsg(
      tramite.tipo?.portal_url
        ? `Abre ${hostOf(tramite.tipo.portal_url)} en esta pestaña.`
        : "Este trámite no tiene portal_url configurado.",
      "err"
    );
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  setMsg("Enviando datos al portal…");

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "TRAMITES_IMSS_FILL",
      payload: {
        tramite_code: tramite.tipo?.code,
        field_schema: tramite.tipo?.field_schema ?? [],
        field_values: tramite.field_values ?? {},
      },
    });
    setMsg("Listo. Revisa el portal.", "ok");
  } catch {
    setMsg(
      "No se pudo contactar al portal. Recarga la página del IMSS e intenta otra vez.",
      "err"
    );
  }
}

// Captura la estructura de las tablas del portal y la copia al portapapeles,
// para poder escribir el auto-llenado de las tablas dinámicas (Productos,
// personas autorizadas, etc.). El content script hace el volcado.
async function copiarEstructuraTablas() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const host = hostOf(tab?.url ?? "");
  if (!host || !PORTAL_HOSTS.includes(host)) {
    setMsg("Abre el portal del IMSS en esta pestaña primero.", "err");
    return;
  }
  setMsg("Leyendo tablas del portal…");
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "TRAMITES_IMSS_DUMP" });
    if (!resp?.ok) throw new Error(resp?.error || "Sin respuesta del portal.");
    setMsg("✓ Se abrió un panel en la página con la estructura. Cópiala de ahí.", "ok");
  } catch {
    setMsg("No se pudo leer. Recarga la página del portal e intenta otra vez.", "err");
  }
}

async function guardarConfig() {
  const url = $("#cfg-url").value.trim().replace(/\/+$/, "");
  const key = $("#cfg-key").value.trim();
  if (!url || !key) {
    setMsg("Completa URL y key.", "err");
    return;
  }
  await chrome.storage.local.set({ supabaseUrl: url, supabaseKey: key });
  $config.hidden = true;
  $main.hidden = false;
  await pintarLista();
}

async function resetConfig() {
  await chrome.storage.local.remove(["supabaseUrl", "supabaseKey"]);
  $main.hidden = true;
  $config.hidden = false;
}

async function init() {
  $loading.hidden = false;
  const { supabaseUrl, supabaseKey } = await getConfig();
  $loading.hidden = true;

  // Con credenciales embebidas siempre hay URL+key — el config screen se
  // omite. Si una papelería necesita apuntar a otra base, el botón Reset
  // limpia el storage y la próxima carga de getConfig() volverá a los
  // valores embebidos (o, si se llenó el storage manualmente desde una
  // versión anterior, a esos).
  if (!supabaseUrl || !supabaseKey) {
    $config.hidden = false;
    return;
  }

  $main.hidden = false;
  await verificarPortalAbierto();
  await pintarLista();
}

$("#cfg-save").addEventListener("click", guardarConfig);
$("#btn-reset").addEventListener("click", resetConfig);
$("#btn-dump").addEventListener("click", copiarEstructuraTablas);
$("#btn-llenar").addEventListener("click", llenarFormulario);
$("#btn-refresh").addEventListener("click", pintarLista);

// Al cambiar de trámite en el dropdown, revalida contra ese portal específico
// — así el mensaje "Abre X en esta pestaña" siempre coincide con el destino
// real del trámite seleccionado.
$select.addEventListener("change", () => {
  const idx = Number($select.value);
  const tramite = tramitesCache[idx];
  verificarPortalAbierto(tramite?.tipo?.portal_url);
});

init();
