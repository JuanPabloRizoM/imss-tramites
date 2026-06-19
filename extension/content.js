// Content script — corre dentro del portal del IMSS.
//
// Escucha mensajes del popup. Al recibir TRAMITES_IMSS_FILL:
//   1) Llena los campos planos (input/textarea/checkbox).
//   2) Orquesta cadenas de selects dependientes esperando entre niveles a
//      que se carguen las opciones del hijo (Estado → Municipio → Localidad
//      → Colonia, y División → Grupo → Fracción).
//   3) Muestra un panel flotante con notas y datos que no se pegaron, para
//      que la persona los teclee a mano en las tablas dinámicas del portal.

const TAG_PREFIX = "[Trámites IMSS]";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Herramienta de captura: vuelca la estructura HTML de las tablas dinámicas
  // del portal (botón "Agregar fila" + inputs por renglón) para poder escribir
  // los selectores de auto-llenado. Es de desarrollo: no toca el formulario.
  if (msg?.type === "TRAMITES_IMSS_DUMP") {
    try {
      const dump = dumpEstructuraTablas();
      mostrarPanelDump(dump); // panel visible en la página, no solo portapapeles
      sendResponse({ ok: true, dump });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
    return true;
  }
  if (msg?.type !== "TRAMITES_IMSS_FILL") return;
  llenarFormulario(msg.payload)
    .then((resumen) => sendResponse({ ok: true, resumen }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // respuesta asíncrona
});

// Captura la estructura de las tablas/sub-formularios del portal: cada <table>
// que tenga inputs, y los controles tipo "Agregar fila" con su onclick (que
// suele revelar la función JS que crea el renglón). Limpia scripts/estilos y
// colapsa espacios para que el texto sea pegable en el chat.
function dumpEstructuraTablas() {
  const limpiar = (html) =>
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const partes = [];
  partes.push(`URL: ${location.href}`);
  partes.push(`method: ${new URLSearchParams(location.search).get("method") || "(ninguno)"}`);

  // Tablas con campos de captura (ignora las de puro layout).
  const tablas = [...document.querySelectorAll("table")].filter(
    (t) => t.querySelector("input, select, textarea")
  );
  partes.push(`\n===== ${tablas.length} TABLA(S) CON CAMPOS =====`);
  tablas.forEach((t, i) => {
    const n = t.querySelectorAll("input, select, textarea").length;
    partes.push(
      `\n----- TABLE #${i}  id="${t.id}" class="${t.className}"  campos=${n} -----`
    );
    partes.push(limpiar(t.outerHTML).slice(0, 8000));
  });

  // Controles tipo "Agregar / + fila / Nuevo renglón".
  const reAgregar = /agregar|añad|anad|\bagrega\b|\+\s*fila|nuevo\s+rengl|a[ñn]adir/i;
  const controles = [
    ...document.querySelectorAll(
      "button, input[type=button], input[type=submit], input[type=image], a"
    ),
  ].filter((el) => reAgregar.test((el.textContent || "") + " " + (el.value || "") + " " + (el.title || "")));
  partes.push(`\n===== ${controles.length} CONTROL(ES) tipo "Agregar" =====`);
  controles.slice(0, 40).forEach((c, i) => {
    const txt = (c.textContent || c.value || c.title || "").trim().slice(0, 50);
    partes.push(
      `BTN #${i}: <${c.tagName.toLowerCase()}> text="${txt}" id="${c.id}" name="${c.name || ""}" onclick="${(c.getAttribute("onclick") || "").slice(0, 200)}"`
    );
  });

  return partes.join("\n");
}

async function llenarFormulario(payload) {
  const { field_schema = [], field_values = {}, tramite_code } = payload || {};

  const planos = [];
  const cadenas = [];
  const panel = [];

  for (const campo of field_schema) {
    if (campo.portal_show_in_panel || campo.portal_skip) {
      panel.push({ campo, valor: field_values[campo.id] });
      continue;
    }
    if (!campo.portal_selector) continue;
    const valor = field_values[campo.id];
    if (valor == null || valor === "") continue;

    if (campo.portal_chain) {
      cadenas.push(campo);
    } else {
      planos.push(campo);
    }
  }

  // 1) Campos planos primero.
  let llenados = 0, fallidos = [];
  for (const campo of planos) {
    const ok = setCampo(campo, field_values[campo.id]);
    if (ok) llenados++; else fallidos.push(campo);
    await sleep(80);
  }

  // 2) Cadenas dependientes. Las procesamos en orden topológico — un campo
  //    se llena solo cuando su padre ya fue llenado.
  const procesados = new Set(planos.map((c) => c.id));
  const pendientes = [...cadenas];
  let intentos = 0;
  while (pendientes.length && intentos < 30) {
    intentos++;
    for (let i = pendientes.length - 1; i >= 0; i--) {
      const campo = pendientes[i];
      const parent = campo.portal_chain.parent;
      if (!procesados.has(parent)) continue;

      // Esperar hasta que el select hijo tenga >1 option (lo carga DWR).
      const elem = document.querySelector(campo.portal_selector);
      if (!elem) {
        fallidos.push(campo);
        pendientes.splice(i, 1);
        continue;
      }
      const okWait = await esperarSelectPoblado(elem, 6000);
      if (!okWait) {
        fallidos.push(campo);
        pendientes.splice(i, 1);
        continue;
      }
      const ok = setCampo(campo, field_values[campo.id]);
      if (ok) llenados++; else fallidos.push(campo);
      procesados.add(campo.id);
      pendientes.splice(i, 1);
      await sleep(150);
    }
    await sleep(200);
  }
  for (const c of pendientes) fallidos.push(c);

  // 3) Panel flotante.
  mostrarPanel({
    tramite_code,
    llenados,
    fallidos,
    panel,
    field_values,
  });

  return { llenados, fallidos: fallidos.length };
}

function setCampo(campo, valor) {
  try {
    const elem = document.querySelector(campo.portal_selector);
    if (!elem) {
      console.warn(TAG_PREFIX, "no encontrado:", campo.portal_selector);
      return false;
    }
    const tag = elem.tagName.toLowerCase();

    if (tag === "select") {
      return setSelect(elem, String(valor), campo.portal_option_match ?? "value");
    }

    if (elem.type === "checkbox") {
      const debe = valor === true || valor === "true" || valor === "1" || valor === "on";
      if (elem.checked !== debe) {
        elem.checked = debe;
        elem.dispatchEvent(new Event("change", { bubbles: true }));
        elem.dispatchEvent(new Event("click", { bubbles: true }));
      }
      return true;
    }

    // input text / textarea / date readonly (datepicker)
    elem.focus();
    if (elem.readOnly && campo.portal_datepicker) {
      // jQuery datepicker: setear value + disparar change funciona en este portal.
      elem.removeAttribute("readonly");
    }
    setNativeValue(elem, String(valor));
    elem.dispatchEvent(new Event("input", { bubbles: true }));
    elem.dispatchEvent(new Event("change", { bubbles: true }));
    elem.dispatchEvent(new Event("blur", { bubbles: true }));
    if (campo.portal_datepicker) elem.setAttribute("readonly", "readonly");
    return true;
  } catch (err) {
    console.error(TAG_PREFIX, campo, err);
    return false;
  }
}

// Setea el value usando el setter nativo del prototipo. Necesario para que
// frameworks (jQuery, React) detecten el cambio.
function setNativeValue(elem, value) {
  const proto = Object.getPrototypeOf(elem);
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc?.set) desc.set.call(elem, value);
  else elem.value = value;
}

function setSelect(selectElem, valor, match) {
  const opciones = Array.from(selectElem.options);
  if (opciones.length === 0) return false;

  const norm = (s) => (s ?? "").toString().trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");

  const objetivo = norm(valor);
  let elegido = null;

  if (match === "text") {
    elegido = opciones.find((o) => norm(o.textContent) === objetivo)
           || opciones.find((o) => norm(o.textContent).includes(objetivo))
           || opciones.find((o) => objetivo.includes(norm(o.textContent)) && o.value !== "-1" && o.value !== "");
  } else {
    elegido = opciones.find((o) => o.value === valor)
           || opciones.find((o) => norm(o.value) === objetivo)
           || opciones.find((o) => norm(o.textContent) === objetivo);
  }
  // Fallback: si no se encontró, intentar por texto siempre.
  if (!elegido) {
    elegido = opciones.find((o) => norm(o.textContent).includes(objetivo) && o.value !== "-1" && o.value !== "");
  }
  if (!elegido) return false;

  setNativeValue(selectElem, elegido.value);
  selectElem.dispatchEvent(new Event("input", { bubbles: true }));
  selectElem.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

async function esperarSelectPoblado(selectElem, timeoutMs) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    // Algunos selects empiezan con 1 option placeholder ("Selecciona uno").
    // Esperamos a que haya >= 2.
    if (selectElem.options.length >= 2) return true;
    await sleep(150);
  }
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// =============================================================================
// Panel flotante con resumen y notas para pegado manual.
// =============================================================================
function mostrarPanel({ tramite_code, llenados, fallidos, panel, field_values }) {
  document.getElementById("tramites-imss-panel")?.remove();

  const root = document.createElement("div");
  root.id = "tramites-imss-panel";
  root.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    width: 340px; max-height: calc(100vh - 32px); overflow: auto;
    background: #fafaf6; color: #16181d;
    border: 1px solid #d4d0c5; border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    font: 13px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif;
    padding: 14px 16px;
  `;

  const head = document.createElement("div");
  head.style.cssText = "display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;gap:8px;";
  head.innerHTML = `
    <div>
      <div style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#93969d">Trámites IMSS</div>
      <div style="font-family:Georgia,serif;font-style:italic;font-size:18px;line-height:1.1">${escapeHtml(tramite_code ?? "?")}</div>
    </div>
    <button id="tii-close" style="background:transparent;border:0;font-size:18px;cursor:pointer;color:#93969d;line-height:1">×</button>
  `;
  root.appendChild(head);

  const resumen = document.createElement("p");
  resumen.style.cssText = "margin:0 0 12px;color:#5a5d65;font-size:12px";
  const fallidosTxt = fallidos.length > 0
    ? ` · ${fallidos.length} sin pegar`
    : "";
  resumen.innerHTML = `${llenados} campo${llenados === 1 ? "" : "s"} pegado${llenados === 1 ? "" : "s"}${fallidosTxt}.`;
  root.appendChild(resumen);

  if (fallidos.length > 0) {
    const sec = document.createElement("section");
    sec.style.cssText = "margin-bottom:12px;padding:8px 10px;background:#fbe9e1;border:1px solid #f0b9a6;border-radius:6px";
    sec.innerHTML = `
      <div style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#8a4a35;margin-bottom:6px">No se pudieron pegar</div>
    `;
    for (const c of fallidos) {
      const item = renderCampoItem(c, field_values[c.id]);
      sec.appendChild(item);
    }
    root.appendChild(sec);
  }

  if (panel.length > 0) {
    const sec = document.createElement("section");
    sec.style.cssText = "margin-bottom:8px";
    sec.innerHTML = `
      <div style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#93969d;margin-bottom:6px">Pegar a mano</div>
    `;
    for (const { campo, valor } of panel) {
      if (!valor) continue;
      const item = renderCampoItem(campo, valor);
      sec.appendChild(item);
    }
    root.appendChild(sec);
  }

  document.body.appendChild(root);
  document.getElementById("tii-close").addEventListener("click", () => root.remove());
}

function renderCampoItem(campo, valor) {
  const item = document.createElement("div");
  item.style.cssText = "display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:6px 0;border-top:1px solid #e3e0d7";
  item.innerHTML = `
    <div style="min-width:0;flex:1">
      <div style="font-size:10px;color:#93969d">${escapeHtml(campo.label || campo.id)}</div>
      <div style="font-size:13px;color:#16181d;word-break:break-word">${escapeHtml(valor || "—")}</div>
    </div>
  `;
  const btn = document.createElement("button");
  btn.textContent = "Copiar";
  btn.style.cssText = "flex-shrink:0;font-size:11px;padding:4px 8px;border:1px solid #d4d0c5;border-radius:4px;background:#fafaf6;cursor:pointer;color:#5a5d65";
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(String(valor ?? ""));
      btn.textContent = "Copiado";
      setTimeout(() => (btn.textContent = "Copiar"), 1200);
    } catch {
      btn.textContent = "Error";
    }
  });
  item.appendChild(btn);
  return item;
}

// Panel visible con el volcado de estructura, en una caja de texto ya
// seleccionada (Ctrl/Cmd+C copia todo). No depende del portapapeles del popup,
// que algunos portales bloquean.
function mostrarPanelDump(texto) {
  document.getElementById("tii-dump-panel")?.remove();
  const root = document.createElement("div");
  root.id = "tii-dump-panel";
  root.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
    display: flex; flex-direction: column; gap: 8px;
    background: #fafaf6; color: #16181d;
    border: 1px solid #d4d0c5; border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    font: 13px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif;
    padding: 14px 16px;
  `;
  const tablas = (texto.match(/----- TABLE #/g) || []).length;
  const btns = (texto.match(/BTN #/g) || []).length;
  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
      <div>
        <div style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#93969d">Trámites IMSS</div>
        <div style="font-family:Georgia,serif;font-style:italic;font-size:18px;line-height:1.1">Estructura de tablas</div>
      </div>
      <button id="tii-dump-close" style="background:transparent;border:0;font-size:18px;cursor:pointer;color:#93969d;line-height:1">×</button>
    </div>
    <p style="margin:0;color:#5a5d65;font-size:12px">${tablas} tabla(s) con campos · ${btns} control(es) "Agregar". Selecciona todo y copia (Ctrl/Cmd+C), luego pégalo en el chat.</p>
  `;
  const ta = document.createElement("textarea");
  ta.readOnly = true;
  ta.value = texto;
  ta.style.cssText = `
    width:100%; flex:1; min-height:260px; resize:vertical;
    border:1px solid #d4d0c5; border-radius:6px; padding:8px;
    font:11px/1.4 ui-monospace, "SF Mono", Menlo, monospace;
    color:#16181d; background:#fff;
  `;
  root.appendChild(ta);
  const fila = document.createElement("div");
  fila.style.cssText = "display:flex;gap:8px";
  const copiar = document.createElement("button");
  copiar.textContent = "Copiar todo";
  copiar.style.cssText = "flex:1;min-height:36px;border:1px solid #16181d;border-radius:6px;background:#16181d;color:#fafaf6;cursor:pointer;font:inherit;font-weight:600";
  copiar.addEventListener("click", async () => {
    ta.focus(); ta.select();
    try {
      await navigator.clipboard.writeText(texto);
      copiar.textContent = "✓ Copiado";
    } catch {
      document.execCommand("copy"); // fallback
      copiar.textContent = "✓ Copiado";
    }
    setTimeout(() => (copiar.textContent = "Copiar todo"), 1500);
  });
  fila.appendChild(copiar);
  root.appendChild(fila);
  document.body.appendChild(root);
  document.getElementById("tii-dump-close").addEventListener("click", () => root.remove());
  // Pre-selecciona para que Ctrl/Cmd+C funcione de inmediato.
  ta.focus(); ta.select();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

console.log(TAG_PREFIX, "content script cargado");
