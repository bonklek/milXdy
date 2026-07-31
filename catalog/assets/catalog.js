import { isSelectable, resolveSelection, selectionJson } from "./selection.js";

const dataUrl = new URL("../data/catalog.json", import.meta.url);
const catalogRootUrl = new URL("../", dataUrl);
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
  experimental: "Experimental",
  "under-review": "Under review",
  published: "Published",
  incompatible: "Incompatible",
  unavailable: "Unavailable",
  deprecated: "Deprecated",
  blocked: "Blocked",
})[status] || "Unknown";

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

function downloadSelection(catalog, packages) {
  const blob = new Blob([selectionJson(catalog, packages)], { type: "application/json" });
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
  const selectable = isSelectable(pkg);
  return `
    <article class="package-card">
      <div class="package-card-heading">
        <label class="package-check">
          <input type="checkbox" data-package-id="${escapeHtml(pkg.id)}" ${selectable ? "" : "disabled"}>
          <span class="sr-only">Add ${escapeHtml(pkg.name)} to the selection file</span>
        </label>
        <img src="${escapeHtml(new URL(pkg.icon.src, catalogRootUrl).href)}" alt="${escapeHtml(pkg.icon.alt)}" width="42" height="42">
        <div>
          <span class="status status-${escapeHtml(pkg.availability)}">${displayStatus(pkg.availability)}</span>
          <h3><a href="add-ons/?id=${encodeURIComponent(pkg.id)}">${escapeHtml(pkg.name)}</a></h3>
        </div>
      </div>
      <p>${escapeHtml(pkg.summary)}</p>
      <dl>
        <div><dt>Publisher</dt><dd>${escapeHtml(pkg.publisher)}</dd></div>
        <div><dt>Package</dt><dd><code>${escapeHtml(pkg.id)}@${escapeHtml(pkg.version || "not available")}</code></dd></div>
        <div><dt>SDK target</dt><dd>${escapeHtml(pkg.sdk.targetVersion || "not assigned")}</dd></div>
        <div><dt>Catalog</dt><dd>${escapeHtml(section.name)}</dd></div>
        <div><dt>Review</dt><dd>${escapeHtml(pkg.review.status)}</dd></div>
      </dl>
      ${selectable ? "" : `<p class="unavailable">${escapeHtml(pkg.blockers?.[0]?.reason || "No reviewed local package artifact is selectable.")}</p>`}
    </article>`;
}

function renderIndex(catalog) {
  const mount = document.querySelector("#catalog-sections");
  const packages = catalog.sections.flatMap((section) => section.packages);
  const packageMap = new Map(packages.map((pkg) => [pkg.id, pkg]));
  const published = packages.filter((pkg) => isSelectable(pkg));
  const summary = document.querySelector("#catalog-summary");
  if (summary) summary.textContent = `${packages.length} maintainer records · ${published.length} selectable · Chromium local builds only`;

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
  const errors = document.querySelector("#selection-errors");
  const review = document.querySelector("#selection-summary");
  const checkboxes = [...document.querySelectorAll("input[data-package-id]:not(:disabled)")];

  const updateSelection = () => {
    const ids = checkboxes.filter((input) => input.checked).map((input) => input.dataset.packageId);
    const resolved = resolveSelection(catalog, ids);
    const count = resolved.selected.length;
    button.disabled = !resolved.ok;
    button.textContent = count ? "Download selection file" : "Download baseline selection";
    status.textContent = count === 0
      ? "Explicit empty selection: build the baseline with no catalog add-ons."
      : `${count} package${count === 1 ? "" : "s"} explicitly selected. Review the combined declarations before downloading.`;
    errors.hidden = resolved.errors.length === 0;
    errors.textContent = resolved.errors.join(" ");
    renderSelectionSummary(review, resolved.summary);
  };

  checkboxes.forEach((input) => input.addEventListener("change", updateSelection));
  button.addEventListener("click", () => {
    const selected = checkboxes.filter((input) => input.checked);
    const packages = selected.map((input) => packageMap.get(input.dataset.packageId)).filter(Boolean);
    const resolved = resolveSelection(catalog, packages.map((pkg) => pkg.id));
    if (!resolved.ok) return updateSelection();
    downloadSelection(catalog, resolved.selected);
    status.textContent = `Selection file created for ${packages.length || "no"} catalog package${packages.length === 1 ? "" : "s"}. Run the local Prepare command next.`;
  });
  updateSelection();
}

function renderSelectionSummary(mount, summary) {
  const rows = [
    ["Packages", summary.packages],
    ["Capabilities", summary.capabilities],
    ["Hosts", summary.hosts],
    ["Optional permissions", summary.optionalPermissions],
    ["Privileged surfaces", summary.privilegedSurfaces],
    ["Site scope", summary.siteScopes],
    ["Remote services", summary.remoteServices],
    ["Storage", summary.storage],
    ["Privacy", summary.privacyNotes],
    ["Acknowledgements", summary.acknowledgements],
  ];
  mount.innerHTML = rows.map(([label, values]) => `
    <div><dt>${escapeHtml(label)}</dt><dd>${values.length ? values.map(escapeHtml).join("<br>") : "none"}</dd></div>
  `).join("");
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
  const downloadable = isSelectable(pkg);
  document.title = `${pkg.name} · milXdy Add-ons`;
  mount.innerHTML = `
    <p class="eyebrow">${escapeHtml(section.name)}</p>
    <span class="status status-${escapeHtml(pkg.availability)}">${displayStatus(pkg.availability)}</span>
    <h1>${escapeHtml(pkg.name)}</h1>
    <p class="lede">${escapeHtml(pkg.summary)}</p>
    <dl class="detail-meta">
      <div><dt>Package ID</dt><dd><code>${escapeHtml(pkg.id)}</code></dd></div>
      <div><dt>Package kind</dt><dd>${escapeHtml(pkg.packageKind)}</dd></div>
      <div><dt>Version</dt><dd>${escapeHtml(pkg.version || "not available")}</dd></div>
      <div><dt>SDK</dt><dd>${escapeHtml(pkg.sdk.minVersion || "unassigned")} minimum · ${escapeHtml(pkg.sdk.targetVersion || "unassigned")} target</dd></div>
      <div><dt>Publisher</dt><dd>${escapeHtml(pkg.publisher)}</dd></div>
      <div><dt>Review status</dt><dd>${escapeHtml(pkg.review.status)}</dd></div>
      ${pkg.review.reviewedBy ? `<div><dt>Reviewed by</dt><dd>${escapeHtml(pkg.review.reviewedBy)}</dd></div>` : ""}
      ${pkg.review.reviewedAt ? `<div><dt>Review date</dt><dd>${escapeHtml(pkg.review.reviewedAt)}</dd></div>` : ""}
    </dl>
    <div class="status-banner ${downloadable ? "" : "status-unavailable"}">
      ${downloadable
        ? `<strong>Published local package.</strong> The generated selection pins this checked-in package SHA-256: <code>${escapeHtml(pkg.artifact.packageSha256)}</code>`
        : "<strong>No selectable artifact is published.</strong> This detail record cannot install, download, or imply availability without a reviewed checked-in maintainer package and exact package hash."}
    </div>
    ${detailSection("Capabilities", pkg.capabilities, "No capabilities have been claimed in the catalog record.")}
    ${detailSection("Host permissions", pkg.permissions.hosts, "No host-permission expansion.")}
    ${detailSection("Privileged surfaces", pkg.permissions.privilegedSurfaces, "No privileged surfaces declared.")}
    ${detailSection("Site scope", pkg.siteScopes, "No site scope has been assigned.")}
    ${detailSection("Remote services", pkg.remoteServices.map((service) => `${service.name} · ${service.origin} · ${service.dataSent}`), "No remote services.")}
    ${detailSection("Storage", [
      ...pkg.storage.local.map((key) => `local:${key}`),
      ...pkg.storage.sync.map((key) => `sync:${key}`),
      ...pkg.storage.session.map((key) => `session:${key}`),
      ...pkg.storage.notes,
    ], "No package storage.")}
    ${detailSection("Privacy and data use", pkg.privacyNotes, "No privacy claims have been listed in the catalog record.")}
    ${detailSection("Dependencies", pkg.dependencies.map((entry) => `${entry.id}@${entry.version} · ${entry.reason}`), "No package dependencies.")}
    ${detailSection("Conflicts", pkg.conflicts.map((entry) => `${entry.id} · ${entry.reason}`), "No declared package conflicts.")}
    ${detailSection("Availability blockers", pkg.blockers.map((entry) => `${entry.reason} (${entry.issue})`), "No availability blockers.")}
    <section>
      <h2>Installation model</h2>
      <p>This package is a privileged custom-build input already present in a reviewed milXdy source checkout. Select it in the catalog, download the generated <code>.milxdy-selection.json</code>, run <code>npm run addons:prepare -- --selection=&lt;file&gt;</code>, review the consolidated report, then run <code>npm run addons:apply</code> with the listed acknowledgements. Reload the existing unpacked build from <code>dist/chromium-local-apps/</code>. The page does not download package code, and nothing is installed at runtime.</p>
    </section>
    ${downloadable ? '<p><button id="download-package-selection" class="download-link" type="button">Download selection file</button></p>' : ""}`;
  document.querySelector("#download-package-selection")?.addEventListener("click", () => downloadSelection(catalog, [pkg]));
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
