const STORAGE_KEY = "utm_campaign_builder_v1";

const $ = (id) => document.getElementById(id);
const form = $("utmForm");
const historyBody = $("historyBody");

function getItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
    historyBody.innerHTML = `<tr><td colspan="7" class="empty-cell">No has generado UTMs todavía.</td></tr>`;
    return;
  }

  historyBody.innerHTML = items.map(item => `
    <tr>
      <td>${new Date(item.createdAt).toLocaleString("es-CO")}</td>
      <td>${escapeHtml(item.label || "—")}</td>
      <td>${escapeHtml(item.source)}</td>
      <td>${escapeHtml(item.medium)}</td>
      <td>${escapeHtml(item.campaign)}</td>
      <td class="url-cell" title="${escapeHtml(item.generatedUrl)}">${escapeHtml(item.generatedUrl)}</td>
      <td>
        <div class="row-actions">
          <button class="button secondary mini copy-row" data-id="${item.id}" type="button">Copiar</button>
          <button class="button secondary mini delete-row" data-id="${item.id}" type="button">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join("");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const built = buildUtm(data);
    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: new Date().toISOString(),
      label: data.label.trim(),
      source: built.params.utm_source,
      medium: built.params.utm_medium,
      campaign: built.params.utm_campaign,
      term: built.params.utm_term,
      content: built.params.utm_content,
      destinationUrl: data.url.trim(),
      generatedUrl: built.url
    };
    const items = getItems();
    items.unshift(item);
    saveItems(items);
    $("generatedUrl").value = built.url;
    $("resultBox").classList.remove("hidden");
    render();
  } catch {
    alert("Revisa la URL de destino. Debe comenzar por http:// o https://");
  }
});

$("copyUrl").addEventListener("click", async () => {
  const value = $("generatedUrl").value;
  if (!value) return;
  await navigator.clipboard.writeText(value);
  $("copyUrl").textContent = "Copiado";
  setTimeout(() => $("copyUrl").textContent = "Copiar", 1200);
});

$("resetForm").addEventListener("click", () => {
  form.reset();
  $("resultBox").classList.add("hidden");
});

$("clearHistory").addEventListener("click", () => {
  if (!confirm("¿Quieres borrar todo el historial local de UTMs?")) return;
  localStorage.removeItem(STORAGE_KEY);
  render();
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

  if (button.classList.contains("delete-row")) {
    saveItems(items.filter(x => x.id !== item.id));
    render();
  }
});

$("exportCsv").addEventListener("click", () => {
  const items = getItems();
  if (!items.length) {
    alert("No hay UTMs para exportar.");
    return;
  }
  const headers = ["fecha","nombre","utm_source","utm_medium","utm_campaign","utm_term","utm_content","url_destino","url_generada"];
  const rows = items.map(x => [
    x.createdAt, x.label, x.source, x.medium, x.campaign, x.term, x.content, x.destinationUrl, x.generatedUrl
  ]);
  const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
  const csv = [headers, ...rows].map(row => row.map(esc).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `utm-history-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

render();