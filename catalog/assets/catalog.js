const dataUrl = new URL("../data/catalog.json", import.meta.url);

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
          <span class="sr-only">Select ${escapeHtml(pkg.name)} for download</span>
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
          : '<div class="empty-state"><span aria-hidden="true">—</span><p><strong>No packages published</strong><span>Verified records will appear here.</span></p></div>'}
      </div>
    </section>`).join("");

  const button = document.querySelector("#download-selected");
  const status = document.querySelector("#selection-status");
  const checkboxes = [...document.querySelectorAll("input[data-package-id]:not(:disabled)")];

  const updateSelection = () => {
    const count = checkboxes.filter((input) => input.checked).length;
    button.disabled = count === 0;
    status.textContent = count === 0
      ? (checkboxes.length ? "Select one or more published packages." : "No published packages are available to select.")
      : `${count} package${count === 1 ? "" : "s"} selected. Your browser may ask permission for multiple downloads.`;
  };

  checkboxes.forEach((input) => input.addEventListener("change", updateSelection));
  button.addEventListener("click", () => {
    const selected = checkboxes.filter((input) => input.checked);
    const downloads = selected.map((input) => packageMap.get(input.dataset.packageId)).filter(isPublishedDownload);
    if (!downloads.length) return updateSelection();
    status.textContent = `Starting ${downloads.length} browser download${downloads.length === 1 ? "" : "s"}. Check your browser's download tray and warnings.`;
    downloads.forEach((pkg, index) => {
      window.setTimeout(() => {
        const link = document.createElement("a");
        link.href = pkg.download.url;
        link.download = pkg.download.filename;
        link.rel = "noopener noreferrer";
        document.body.append(link);
        link.click();
        link.remove();
      }, index * 250);
    });
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
        ? `<strong>Published package.</strong> Verify the SHA-256 value before using the ZIP: <code>${escapeHtml(pkg.download.sha256)}</code>`
        : "<strong>No download is published.</strong> This detail record cannot install, download, or imply availability without a verified HTTPS ZIP and SHA-256 value."}
    </div>
    ${detailSection("Capabilities", pkg.capabilities, "No capabilities have been claimed in the catalog record.")}
    ${detailSection("Permissions and privileged surfaces", pkg.permissions, "No permissions have been listed in the catalog record.")}
    ${detailSection("Privacy and data use", pkg.privacy, "No privacy claims have been listed in the catalog record.")}
    <section>
      <h2>Installation model</h2>
      <p>This package is a privileged custom-build input. Place its ZIP in <code>local-app-packages/</code>, run the reviewed local Chromium build, inspect the generated plan, and reload the unpacked build from <code>dist/chromium-local-apps/</code>. It is not installed at runtime.</p>
    </section>
    ${downloadable ? `<p><a class="download-link" href="${escapeHtml(pkg.download.url)}" download="${escapeHtml(pkg.download.filename)}">Download verified ZIP</a></p>` : ""}`;
}

try {
  const catalog = await loadCatalog();
  if (document.body.dataset.page === "index") renderIndex(catalog);
  if (document.body.dataset.page === "detail") renderDetail(catalog);
} catch (error) {
  const mount = document.querySelector("#catalog-sections, #addon-detail");
  if (mount) mount.innerHTML = `<div class="status-banner status-unavailable"><strong>Catalog unavailable.</strong> ${escapeHtml(error.message)}</div>`;
}
