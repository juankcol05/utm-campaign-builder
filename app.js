const STORAGE_KEY = "utm_campaign_builder_v1";

const $ = (id) => document.getElementById(id);
const form = $("utmForm");
const historyBody = $("historyBody");

let sharedStore = null;
let sharedItems = [];
let isRefreshing = false;
let nextRefresh = false;

// Nunca calcular el inventario global en localStorage.
function getItems() { return sharedItems; }
function readLegacyHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
async function refreshSharedHistory() {
  if (!sharedStore) return;
  if (isRefreshing) { nextRefresh = true; return; }
  isRefreshing = true;
  try {
    sharedItems = await sharedStore.getAll();
    render();
  } catch (error) {
    console.error("No se pudo sincronizar el historial", error);
  } finally {
    isRefreshing = false;
    if (nextRefresh) { nextRefresh = false; refreshSharedHistory(); }
  }
}
function normalize(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function buildUtm(data) {
  const url = new URL(data.url);
  const params = {
    utm_source: normalize(data.source),
    utm_medium: normalize(data.medium),
    utm_campaign: normalize(data.campaign),
    utm_term: normalize(data.term || ""),
    utm_content: normalize(data.content || "")
  };
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return { url: url.toString(), params };
}

async function shortenUrl(longUrl) {
  // El proveedor devuelve una redirección hacia la URL completa, con todas las UTMs.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const endpoint = "https://is.gd/create.php?format=json&url=" + encodeURIComponent(longUrl);
    const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error("Error HTTP " + response.status);
    const result = await response.json();
    if (result.errormessage || !result.shorturl) throw new Error(result.errormessage || "Sin URL corta");
    const short = new URL(result.shorturl);
    if (short.protocol !== "https:" || short.hostname !== "is.gd") throw new Error("Respuesta inesperada del acortador");
    return short.toString();
  } finally {
    clearTimeout(timeout);
  }
}

function setShortStatus(message, retry = false) {
  $("shortStatus").textContent = message;
  $("retryShortUrl").classList.toggle("hidden", !retry);
}

async function addShortUrl(itemId) {
  const item = getItems().find(x => x.id === itemId);
  if (!item) return;
  $("shortUrl").value = "";
  $("copyShortUrl").disabled = true;
  setShortStatus("Generando enlace corto…");
  try {
    const shortUrl = await shortenUrl(item.generatedUrl);
    const items = getItems();
    const current = items.find(x => x.id === itemId);
    if (current && current.generatedUrl === item.generatedUrl) {
      await sharedStore.updateShort(itemId, shortUrl);
      await refreshSharedHistory();
    }
    if ($("resultBox").dataset.itemId === itemId) {
      $("shortUrl").value = shortUrl;
      $("copyShortUrl").disabled = false;
      setShortStatus("Enlace corto creado. La URL original permanece intacta.");
    }
  } catch (error) {
    if ($("resultBox").dataset.itemId === itemId) {
      setShortStatus("No se pudo acortar el enlace. Puedes usar la UTM larga o reintentar.", true);
    }
  }
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "(vacío)";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function renderBarChart(targetId, counts) {
  const target = $(targetId);
  const entries = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) {
    target.className = "bar-chart empty-state";
    target.textContent = "Aún no hay datos.";
    return;
  }
  const max = Math.max(...entries.map(([,value]) => value));
  target.className = "bar-chart";
  target.innerHTML = entries.map(([label, value]) => `
    <div class="bar-row">
      <span class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(value/max)*100}%"></div></div>
      <span class="bar-value">${value}</span>
    </div>
  `).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  const items = getItems();
  $("totalUtms").textContent = items.length;
  $("totalSources").textContent = new Set(items.map(x => x.source)).size;
  $("totalCampaigns").textContent = new Set(items.map(x => x.campaign)).size;
  $("totalMediums").textContent = new Set(items.map(x => x.medium)).size;
  $("historyCount").textContent = `${items.length} ${items.length === 1 ? "registro" : "registros"}`;

  renderBarChart("sourceChart", countBy(items, "source"));
  renderBarChart("mediumChart", countBy(items, "medium"));

  if (!items.length) {
    historyBody.innerHTML = `<tr><td colspan="9" class="empty-cell">No has generado UTMs todavía.</td></tr>`;
    return;
  }

  historyBody.innerHTML = items.map((item, index) => `
    
    <tr>
      <td>${item.consecutive}</td>
      <td>${new Date(item.createdAt).toLocaleString("es-CO")}</td>
      <td>${escapeHtml(item.label || "—")}</td>
      <td>${escapeHtml(item.source)}</td>
      <td>${escapeHtml(item.medium)}</td>
      <td>${escapeHtml(item.campaign)}</td>
      <td class="url-cell" title="${escapeHtml(item.generatedUrl)}">${escapeHtml(item.generatedUrl)}</td>
      <td class="url-cell" title="${escapeHtml(item.shortUrl || "")}">${item.shortUrl ? `<a href="${escapeHtml(item.shortUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.shortUrl)}</a>` : "—"}</td>
      <td>
        <div class="row-actions">
          <button class="button secondary mini copy-row" data-id="${item.id}" type="button">Copiar larga</button>
          <button class="button secondary mini copy-short-row" data-id="${item.id}" type="button" ${item.shortUrl ? "" : "disabled"}>Copiar corta</button>
          <button class="button secondary mini delete-row" data-id="${item.id}" type="button">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join("");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!sharedStore) {
    alert("La bitácora central todavía no está disponible. No se ha creado ningún registro.");
    return;
  }
  const data = Object.fromEntries(new FormData(form).entries());
  let built;
  try {
    built = buildUtm(data);
    if (!/^https?:$/.test(new URL(built.url).protocol)) throw new Error("Protocolo inválido");
  } catch {
    alert("Revisa la URL de destino. Debe comenzar por http:// o https://");
    return;
  }
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    label: data.label.trim(),
    source: built.params.utm_source, medium: built.params.utm_medium,
    campaign: built.params.utm_campaign, term: built.params.utm_term,
    content: built.params.utm_content, destinationUrl: data.url.trim(),
    generatedUrl: built.url, shortUrl: ""
  };
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await sharedStore.add(item); // ID global otorgado por PostgreSQL.
    await refreshSharedHistory();
    $("generatedUrl").value = built.url;
    $("resultBox").dataset.itemId = item.id;
    $("resultBox").classList.remove("hidden");
    addShortUrl(item.id);
  } catch (error) {
    console.error(error);
    alert("No se pudo guardar la UTM en la base de datos central. No se ha registrado como creada.");
  } finally {
    submitButton.disabled = false;
  }
});

$("copyUrl").addEventListener("click", async () => {
  const value = $("generatedUrl").value;
  if (!value) return;
  await navigator.clipboard.writeText(value);
  $("copyUrl").textContent = "Copiado";
  setTimeout(() => $("copyUrl").textContent = "Copiar", 1200);
});

$("copyShortUrl").addEventListener("click", async () => {
  const value = $("shortUrl").value;
  if (!value) return;
  await navigator.clipboard.writeText(value);
  $("copyShortUrl").textContent = "Copiado";
  setTimeout(() => $("copyShortUrl").textContent = "Copiar corta", 1200);
});

$("retryShortUrl").addEventListener("click", () => {
  const id = $("resultBox").dataset.itemId;
  if (id) addShortUrl(id);
});

$("resetForm").addEventListener("click", () => {
  form.reset();
  $("resultBox").classList.add("hidden");
});

$("clearHistory").addEventListener("click", async () => {
  if (!sharedStore) { alert("Conexión compartida no disponible."); return; }
  if (!confirm("Esto eliminará el historial PARA TODOS LOS USUARIOS. Solo un administrador puede hacerlo. ¿Continuar?")) return;
  if (!confirm("Confirma por segunda vez que deseas borrar el inventario compartido completo.")) return;
  try {
    await sharedStore.clearAll();
    await refreshSharedHistory();
  } catch (error) {
    console.error(error);
    alert("No se eliminó el inventario. Es posible que tu usuario no tenga permisos de administrador.");
  }
});

historyBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const items = getItems();
  const item = items.find(x => x.id === button.dataset.id);
  if (!item) return;

  if (button.classList.contains("copy-row")) {
    await navigator.clipboard.writeText(item.generatedUrl);
    button.textContent = "Copiado";
    setTimeout(() => button.textContent = "Copiar", 1000);
  }

  if (button.classList.contains("copy-short-row") && item.shortUrl) {
    await navigator.clipboard.writeText(item.shortUrl);
    button.textContent = "Copiado";
    setTimeout(() => button.textContent = "Copiar corta", 1000);
  }

  if (button.classList.contains("delete-row")) {
    if (!confirm("Este registro desaparecerá para TODOS los usuarios. ¿Eliminar?")) return;
    try {
      await sharedStore.remove(item.id);
      await refreshSharedHistory();
    } catch (error) {
      console.error(error);
      alert("No se eliminó. Solo los administradores pueden borrar UTMs del inventario central.");
    }
  }
});

function exportRows() {
  const items = getItems();
  const headers = ["consecutivo","fecha","nombre_interno","utm_source","utm_medium","utm_campaign","utm_term","utm_content","url_destino","url_larga","url_corta"];
  const rows = items.map((x, index) => [
    x.consecutive, x.createdAt, x.label || "", x.source, x.medium, x.campaign,
    x.term || "", x.content || "", x.destinationUrl, x.generatedUrl, x.shortUrl || ""
  ]);
  return { items, headers, rows };
}

function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}

$("exportCsv").addEventListener("click", () => {
  const { items, headers, rows } = exportRows();
  if (!items.length) { alert("Todavía no hay UTMs para exportar."); return; }
  // Neutraliza el inicio de fórmulas para abrir el CSV de forma más segura en Excel.
  const safeCell = value => {
    const raw = String(value ?? "");
    const clean = /^\s*[=+@-]/.test(raw) ? "'" + raw : raw;
    return '"' + clean.replaceAll('"', '""') + '"';
  };
  const csv = [headers, ...rows].map(row => row.map(safeCell).join(";")).join("\r\n");
  downloadText("bitacora_utms_banfondesa_" + new Date().toISOString().slice(0,10) + ".csv", "\ufeff" + csv, "text/csv;charset=utf-8");
});

$("exportTxt").addEventListener("click", () => {
  const { items, headers, rows } = exportRows();
  if (!items.length) { alert("Todavía no hay UTMs para exportar."); return; }
  const lines = ["UTM Campaign Builder Banfondesa - Mercadeo", "Inventario de UTMs", "Total de registros: " + items.length, ""];
  rows.forEach(row => {
    lines.push("------------------------------------------------------------");
    row.forEach((value, index) => lines.push(headers[index] + ": " + String(value ?? "")));
    lines.push("");
  });
  downloadText("bitacora_utms_banfondesa_" + new Date().toISOString().slice(0,10) + ".txt", lines.join("\r\n"), "text/plain;charset=utf-8");
});

async function initializeSharedHistory() {
  try {
    const { openSharedStore } = await import("./shared-store.js");
    const candidate = await openSharedStore();
    const authorized = await candidate.requireAccess();
    if (!authorized) return;
    // Al iniciar desde cada dispositivo se incorporan sus registros anteriores.
    // Las importaciones son idempotentes por el ID único antiguo.
    await candidate.migrateLegacy(readLegacyHistory());
    sharedStore = candidate;
    await refreshSharedHistory();
    sharedStore.watch(refreshSharedHistory);
  } catch (error) {
    console.error("No se pudo iniciar el inventario compartido", error);
    alert("No se pudo conectar a la bitácora compartida: " + error.message);
  }
}

initializeSharedHistory();
