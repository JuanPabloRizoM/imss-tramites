// Popup de la extensión.
//
// 1) En primer arranque pide URL + anon key de Supabase y las guarda en
//    chrome.storage.local (no en código — así nadie puede leerlas
//    revisando la extensión).
// 2) Lista trámites del apartado 2 cuyo `tramites.status = 'revisado'`.
// 3) Al hacer click en "Llenar formulario", envía un mensaje al tab activo
//    si está en el portal del IMSS. El content script hace el llenado.

const PORTAL_HOST = "altapatronalpresencial.imss.gob.mx";

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
  const { supabaseUrl, supabaseKey } = await chrome.storage.local.get([
    "supabaseUrl",
    "supabaseKey",
  ]);
  return { supabaseUrl, supabaseKey };
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
    }
  } catch (err) {
    setMsg(err.message || "Error", "err");
    $btnLlenar.disabled = true;
  }
}

async function verificarPortalAbierto() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  const ok = url.includes(PORTAL_HOST);
  $portalStatus.textContent = ok
    ? "Portal del IMSS detectado en esta pestaña."
    : "Abre el portal del IMSS en esta pestaña antes de llenar.";
  $portalStatus.style.color = ok ? "var(--ok)" : "var(--ink-3)";
  return ok;
}

async function llenarFormulario() {
  const idx = Number($select.value);
  const tramite = tramitesCache[idx];
  if (!tramite) return;

  const portalOk = await verificarPortalAbierto();
  if (!portalOk) {
    setMsg("Esta pestaña no es el portal del IMSS.", "err");
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
$("#btn-llenar").addEventListener("click", llenarFormulario);
$("#btn-refresh").addEventListener("click", pintarLista);

init();
