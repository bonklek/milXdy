import { selectionJson } from "./selection.js";

const dataUrl = new URL("../data/catalog.json", import.meta.url);
const folderDatabase = "milxdy-catalog";
const folderStore = "directory-handles";
const packagesFolderKey = "local-app-packages";
let extensionBridgeReady = false;

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const displayStatus = (status) => ({
  planned: "Not published",
  "under-review": "Under review",
  published: "Published",
})[status] || "Unknown";

const isPublishedDownload = (pkg) => {
  if (pkg.availability !== "published" || !pkg.download) return false;
  try {
    const url = new URL(pkg.download.url);
    return url.protocol === "https:" && /^[a-f0-9]{64}$/.test(pkg.download.sha256);
  } catch {
    return false;
  }
};

function openFolderDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(folderDatabase, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(folderStore);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSavedFolder() {
  const database = await openFolderDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(folderStore).objectStore(folderStore).get(packagesFolderKey);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

async function saveFolder(handle) {
  const database = await openFolderDatabase();
  try {
    await new Promise((resolve, reject) => {
      const request = database.transaction(folderStore, "readwrite").objectStore(folderStore).put(handle, packagesFolderKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

function setFolderState(button, status, state, message) {
  button.dataset.state = state;
  status.textContent = message;
}

function requestAddonsSettings(target) {
  window.postMessage({ source: "milxdy-catalog", type: "milxdy-open-addon-settings", target }, window.location.origin);
}

function bindExtensionBridge() {
  const folderStatus = document.querySelector("#packages-folder-status");
  const rebuildStatus = document.querySelector("#rebuild-step-status");
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== "milxdy-extension") return;
    if (message.type === "milxdy-addon-bridge-ready") {
      extensionBridgeReady = true;
      if (folderStatus?.textContent === "Choose local-app-packages/") folderStatus.textContent = "Open Add-ons settings";
      return;
    }
    if (message.type !== "milxdy-addon-settings-opened") return;
    const status = message.target === "rebuild" ? rebuildStatus : folderStatus;
    if (status) status.textContent = message.ok ? "Opened Add-ons settings" : "Open milXdy from the toolbar";
  });
  window.postMessage({ source: "milxdy-catalog", type: "milxdy-addon-bridge-ping" }, window.location.origin);
}

async function bindFolderPicker() {
  const button = document.querySelector("#choose-packages-folder");
  const status = document.querySelector("#packages-folder-status");
  if (!button || !status) return;

  if (!("showDirectoryPicker" in window) || !("indexedDB" in window)) {
    button.disabled = true;
    setFolderState(button, status, "unsupported", "Choose manually · Chromium only");
    return;
  }

  setFolderState(button, status, "ready", "Choose local-app-packages/");

  try {
    const saved = await readSavedFolder();
    if (saved?.name?.toLowerCase() === packagesFolderKey && typeof saved.queryPermission === "function") {
      const permission = await saved.queryPermission({ mode: "readwrite" });
      setFolderState(button, status, permission === "granted" ? "selected" : "saved", permission === "granted" ? "Selected: local-app-packages/" : "Saved · click to reconnect");
    }
  } catch {
    // Private browsing and storage policies can block IndexedDB. The picker can
    // still provide a useful one-session selection when clicked.
  }

  button.addEventListener("click", async () => {
    if (extensionBridgeReady) {
      status.textContent = "Opening Add-ons settings…";
      requestAddonsSettings("folder");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ id: "milxdy-local-app-packages", mode: "readwrite" });
      if (handle.name.toLowerCase() !== packagesFolderKey) {
        setFolderState(button, status, "wrong-folder", `Choose local-app-packages/ · not ${handle.name}`);
        return;
      }
      let saved = true;
      try {
        await saveFolder(handle);
      } catch {
        saved = false;
      }
      setFolderState(button, status, "selected", saved ? "Selected: local-app-packages/" : "Selected for this tab");
    } catch (error) {
      if (error?.name !== "AbortError") setFolderState(button, status, "error", "Folder access unavailable");
    }
  });
}

function bindAddonsSettingsLauncher() {
  const button = document.querySelector("#open-addon-settings");
  const status = document.querySelector("#rebuild-step-status");
  if (!button || !status) return;
  button.addEventListener("click", () => {
    window.postMessage({ source: "milxdy-catalog", type: "milxdy-addon-bridge-ping" }, window.location.origin);
    if (!extensionBridgeReady) {
      status.textContent = "Update milXdy · open settings manually";
      return;
    }
    status.textContent = "Opening Add-ons settings…";
    requestAddonsSettings("rebuild");
  });
}

function downloadSelection(packages) {
  const blob = new Blob([selectionJson(packages)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ".milxdy-selection.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadCatalog() {
  const response = await fetch(dataUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`catalog request failed (${response.status})`);
  return response.json();
}

function renderList(items, emptyText) {
  if (!items?.length) return `<p class="empty-list">${escapeHtml(emptyText)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function packageCard(pkg, section) {
  const selectable = isPublishedDownload(pkg);
  return `
    <article class="package-card">
      <div class="package-card-heading">
        <label class="package-check">
          <input type="checkbox" data-package-id="${escapeHtml(pkg.id)}" ${selectable ? "" : "disabled"}>
          <span class="sr-only">Add ${escapeHtml(pkg.name)} to the selection file</span>
        </label>
        <div>
          <span class="status status-${escapeHtml(pkg.availability)}">${displayStatus(pkg.availability)}</span>
          <h3><a href="add-ons/?id=${encodeURIComponent(pkg.id)}">${escapeHtml(pkg.name)}</a></h3>
        </div>
      </div>
      <p>${escapeHtml(pkg.summary)}</p>
      <dl>
        <div><dt>Publisher</dt><dd>${escapeHtml(pkg.publisher)}</dd></div>
        <div><dt>Catalog</dt><dd>${escapeHtml(section.name)}</dd></div>
        <div><dt>Review</dt><dd>${escapeHtml(pkg.review.status)}</dd></div>
      </dl>
      ${selectable ? "" : '<p class="unavailable">No verified package download is attached to this record.</p>'}
    </article>`;
}

function renderIndex(catalog) {
  const mount = document.querySelector("#catalog-sections");
  const packages = catalog.sections.flatMap((section) => section.packages);
  const packageMap = new Map(packages.map((pkg) => [pkg.id, pkg]));

  mount.innerHTML = catalog.sections.map((section) => `
    <section class="catalog-section" aria-labelledby="section-${escapeHtml(section.id)}">
      <div class="section-heading">
        <h3 id="section-${escapeHtml(section.id)}">${escapeHtml(section.name)}</h3>
        <span>${section.packages.length}</span>
      </div>
      <p>${escapeHtml(section.description)}</p>
      <div class="package-grid">
        ${section.packages.length
          ? section.packages.map((pkg) => packageCard(pkg, section)).join("")
          : '<div class="empty-state"><span aria-hidden="true">—</span><p><strong>No add-ons published yet</strong><span>Verified records will appear here.</span></p></div>'}
      </div>
    </section>`).join("");

  const button = document.querySelector("#download-selected");
  const status = document.querySelector("#selection-status");
  const checkboxes = [...document.querySelectorAll("input[data-package-id]:not(:disabled)")];

  const updateSelection = () => {
    const count = checkboxes.filter((input) => input.checked).length;
    button.disabled = count === 0;
    status.textContent = count === 0
      ? (checkboxes.length ? "Select one or more published packages." : "No add-ons are published yet, so there is nothing to select.")
      : `${count} package${count === 1 ? "" : "s"} selected. Download one pinned selection file for the local manager.`;
  };

  checkboxes.forEach((input) => input.addEventListener("change", updateSelection));
  button.addEventListener("click", () => {
    const selected = checkboxes.filter((input) => input.checked);
    const packages = selected.map((input) => packageMap.get(input.dataset.packageId)).filter(isPublishedDownload);
    if (!packages.length) return updateSelection();
    downloadSelection(packages);
    status.textContent = `Selection file created for ${packages.length} package${packages.length === 1 ? "" : "s"}. Run the local Prepare command next.`;
  });
  updateSelection();
}

function detailSection(title, items, emptyText) {
  return `<section><h2>${escapeHtml(title)}</h2>${renderList(items, emptyText)}</section>`;
}

function renderDetail(catalog) {
  const mount = document.querySelector("#addon-detail");
  const id = new URLSearchParams(window.location.search).get("id");
  const located = catalog.sections
    .flatMap((section) => section.packages.map((pkg) => ({ pkg, section })))
    .find((entry) => entry.pkg.id === id);

  if (!located) {
    document.title = "Add-on not published · milXdy";
    mount.innerHTML = `
      <p class="eyebrow">catalog placeholder</p>
      <h1>Add-on not published</h1>
      <div class="status-banner"><strong>No package record is available for this address.</strong> Return to the catalog for the current official and approved-external inventory. A missing record is not a downloadable package.</div>`;
    return;
  }

  const { pkg, section } = located;
  const downloadable = isPublishedDownload(pkg);
  document.title = `${pkg.name} · milXdy Add-ons`;
  mount.innerHTML = `
    <p class="eyebrow">${escapeHtml(section.name)}</p>
    <span class="status status-${escapeHtml(pkg.availability)}">${displayStatus(pkg.availability)}</span>
    <h1>${escapeHtml(pkg.name)}</h1>
    <p class="lede">${escapeHtml(pkg.summary)}</p>
    <dl class="detail-meta">
      <div><dt>Package ID</dt><dd><code>${escapeHtml(pkg.id)}</code></dd></div>
      <div><dt>Publisher</dt><dd>${escapeHtml(pkg.publisher)}</dd></div>
      <div><dt>Review status</dt><dd>${escapeHtml(pkg.review.status)}</dd></div>
      ${pkg.review.reviewedBy ? `<div><dt>Reviewed by</dt><dd>${escapeHtml(pkg.review.reviewedBy)}</dd></div>` : ""}
      ${pkg.review.reviewedAt ? `<div><dt>Review date</dt><dd>${escapeHtml(pkg.review.reviewedAt)}</dd></div>` : ""}
    </dl>
    <div class="status-banner ${downloadable ? "" : "status-unavailable"}">
      ${downloadable
        ? `<strong>Published package.</strong> The generated selection pins this ZIP SHA-256: <code>${escapeHtml(pkg.download.sha256)}</code>`
        : "<strong>No download is published.</strong> This detail record cannot install, download, or imply availability without a verified HTTPS ZIP and SHA-256 value."}
    </div>
    ${detailSection("Capabilities", pkg.capabilities, "No capabilities have been claimed in the catalog record.")}
    ${detailSection("Permissions and privileged surfaces", pkg.permissions, "No permissions have been listed in the catalog record.")}
    ${detailSection("Privacy and data use", pkg.privacy, "No privacy claims have been listed in the catalog record.")}
    <section>
      <h2>Installation model</h2>
      <p>This package is a privileged custom-build input. Select it in the catalog, download the generated <code>.milxdy-selection.json</code>, run <code>npm run addons:prepare -- --selection=&lt;file&gt;</code>, review the consolidated report, then run <code>npm run addons:apply</code> with the listed acknowledgements. Reload the existing unpacked build from <code>dist/chromium-local-apps/</code>. It is not installed at runtime.</p>
    </section>
    ${downloadable ? '<p><button id="download-package-selection" class="download-link" type="button">Download selection file</button></p>' : ""}`;
  document.querySelector("#download-package-selection")?.addEventListener("click", () => downloadSelection([pkg]));
}

bindExtensionBridge();
bindFolderPicker();
bindAddonsSettingsLauncher();

try {
  const catalog = await loadCatalog();
  if (document.body.dataset.page === "index") renderIndex(catalog);
  if (document.body.dataset.page === "detail") renderDetail(catalog);
} catch (error) {
  const mount = document.querySelector("#catalog-sections, #addon-detail");
  if (mount) mount.innerHTML = `<div class="status-banner status-unavailable"><strong>Catalog unavailable.</strong> ${escapeHtml(error.message)}</div>`;
}
