const status = document.querySelector("#catalog-status");
const entriesRoot = document.querySelector("#catalog-entries");

function appendTextElement(parent, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

function renderEntry(entry) {
  const article = document.createElement("article");
  article.className = "entry";
  appendTextElement(article, "strong", `${entry.id} · ${entry.version}`);
  appendTextElement(article, "code", `source ${entry.sourceSha256}`);
  appendTextElement(article, "code", `manifest ${entry.manifestSha256}`);
  entriesRoot.append(article);
}

try {
  const response = await fetch("../catalog.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const catalog = await response.json();
  const entries = Array.isArray(catalog.entries) ? catalog.entries : [];

  status.textContent = `${catalog.catalogVersion} · ${entries.length} versioned entr${entries.length === 1 ? "y" : "ies"}`;
  if (entries.length === 0) {
    appendTextElement(
      entriesRoot,
      "p",
      "No default artwork bundle is included yet. Local authors can use their own declared package assets without catalog approval.",
      "empty",
    );
  } else {
    entries.forEach(renderEntry);
  }
} catch {
  status.textContent = "Catalog could not be loaded";
  appendTextElement(
    entriesRoot,
    "p",
    "Serve this directory over a local HTTP server, then run the repository validator before trusting the index.",
    "empty",
  );
}
