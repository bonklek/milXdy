import concepts from "./concepts.json";
import { createId, exportTuningData, importTuningData, loadDenyTerms, loadLaterItems, loadLocalAliases, loadPerformanceStats, saveDenyTerms, saveLaterItems, saveLocalAliases } from "./localData";
import type { LaterItem, LocalAlias, TuningExport, WikiEntry } from "./types";

const API = "https://wiki.remilia.org/api.php";

const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
const panels = Array.from(document.querySelectorAll<HTMLElement>(".panel"));
const aliasForm = document.querySelector<HTMLFormElement>("#aliasForm");
const aliasLabel = document.querySelector<HTMLInputElement>("#aliasLabel");
const aliasTitle = document.querySelector<HTMLInputElement>("#aliasTitle");
const aliasUrl = document.querySelector<HTMLInputElement>("#aliasUrl");
const searchQuery = document.querySelector<HTMLInputElement>("#searchQuery");
const searchWiki = document.querySelector<HTMLButtonElement>("#searchWiki");
const searchResults = document.querySelector<HTMLElement>("#searchResults");
const denyForm = document.querySelector<HTMLFormElement>("#denyForm");
const denyTerm = document.querySelector<HTMLInputElement>("#denyTerm");
const aliasesRoot = document.querySelector<HTMLElement>("#aliases");
const denyRoot = document.querySelector<HTMLElement>("#denyTerms");
const laterRoot = document.querySelector<HTMLElement>("#laterItems");
const conceptsRoot = document.querySelector<HTMLElement>("#concepts");
const diagnosticsRoot = document.querySelector<HTMLElement>("#diagnostics");
const exportData = document.querySelector<HTMLButtonElement>("#exportData");
const importData = document.querySelector<HTMLButtonElement>("#importData");
const importFile = document.querySelector<HTMLInputElement>("#importFile");

let aliases: LocalAlias[] = [];
let denyTerms: string[] = [];
let laterItems: LaterItem[] = [];
let activeLaterItem: LaterItem | null = null;

void boot();

async function boot(): Promise<void> {
  setupTabs();
  await reload();
  aliasForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void addAliasFromInputs();
  });
  denyForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void addDeny();
  });
  searchWiki?.addEventListener("click", () => void runSearch(clean(searchQuery?.value)));
  searchQuery?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void runSearch(clean(searchQuery.value));
    }
  });
  exportData?.addEventListener("click", () => void downloadExport());
  importData?.addEventListener("click", () => importFile?.click());
  importFile?.addEventListener("change", () => void uploadImport());
}

function setupTabs(): void {
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const id = tab.dataset.tab;
      for (const other of tabs) other.setAttribute("aria-selected", String(other === tab));
      for (const panel of panels) panel.classList.toggle("active", panel.id === `panel-${id}`);
    });
  }
}

async function reload(): Promise<void> {
  [aliases, denyTerms, laterItems] = await Promise.all([loadLocalAliases(), loadDenyTerms(), loadLaterItems()]);
  render();
}

function render(): void {
  renderAliases();
  renderDenyTerms();
  renderLaterItems();
  renderConcepts();
  void renderDiagnostics();
}

function renderAliases(): void {
  if (!aliasesRoot) return;
  aliasesRoot.textContent = "";
  for (const alias of aliases) {
    const row = document.createElement("div");
    row.className = "row";
    row.append(textCell(alias.label), textCell(alias.title), linkCell(alias.url), removeButton(() => removeAlias(alias.id)));
    aliasesRoot.appendChild(row);
  }
}

function renderDenyTerms(): void {
  if (!denyRoot) return;
  denyRoot.textContent = "";
  for (const term of denyTerms) {
    const row = document.createElement("div");
    row.className = "row compact";
    row.append(textCell(term), textCell("Blocked locally"), removeButton(() => removeDeny(term)));
    denyRoot.appendChild(row);
  }
}

function renderLaterItems(): void {
  if (!laterRoot) return;
  laterRoot.textContent = "";
  for (const item of laterItems) {
    const row = document.createElement("div");
    row.className = "row compact";
    const convert = button("Convert", () => startAliasFromLater(item));
    row.append(textCell(item.text), item.pageUrl ? linkCell(item.pageUrl) : textCell("No page captured"), convert, removeButton(() => removeLater(item.id)));
    laterRoot.appendChild(row);
  }
}

function renderConcepts(): void {
  if (!conceptsRoot) return;
  conceptsRoot.textContent = "";
  for (const concept of (concepts as WikiEntry[])) {
    const row = document.createElement("div");
    row.className = "row concept";
    row.append(textCell(concept.label), textCell(concept.title), textCell(concept.pattern ? "pattern" : concept.requiresContext ? "context-gated" : "curated"), textCell(String(concept.confidence ?? 100)));
    conceptsRoot.appendChild(row);
  }
}

async function addAliasFromInputs(): Promise<void> {
  const label = clean(aliasLabel?.value);
  const title = clean(aliasTitle?.value);
  const url = clean(aliasUrl?.value);
  if (!label || !title || !isWikiUrl(url)) return;
  await addAlias(label, title, url);
  clear(aliasLabel, aliasTitle, aliasUrl);
}

async function addAlias(label: string, title: string, url: string): Promise<void> {
  aliases.unshift({ id: createId(), label, title, url, createdAt: Date.now() });
  await saveLocalAliases(aliases);
  renderAliases();
}

async function addDeny(): Promise<void> {
  const term = clean(denyTerm?.value).toLowerCase();
  if (!term) return;
  denyTerms = Array.from(new Set([...denyTerms, term])).sort();
  await saveDenyTerms(denyTerms);
  clear(denyTerm);
  renderDenyTerms();
}

async function runSearch(query: string): Promise<void> {
  if (!searchResults) return;
  searchResults.textContent = "";
  if (!query) return;
  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("list", "search");
  url.searchParams.set("srlimit", "8");
  url.searchParams.set("srsearch", query);
  const response = await fetch(url);
  if (!response.ok) return;
  const data = await response.json() as SearchResponse;
  for (const result of data.query?.search ?? []) {
    const pageUrl = `https://wiki.remilia.org/${encodeURIComponent(result.title.replace(/\s+/g, "_"))}`;
    const row = document.createElement("div");
    row.className = "row search";
    row.append(
      textCell(result.title),
      textCell(`${result.wordcount ?? 0} words`),
      button(activeLaterItem ? "Create alias" : "Use target", () => useSearchTarget(result.title, pageUrl)),
    );
    searchResults.appendChild(row);
  }
}

function useSearchTarget(title: string, url: string): void {
  if (activeLaterItem) {
    void convertLaterToAlias(activeLaterItem, title, url);
    return;
  }
  if (aliasTitle) aliasTitle.value = title;
  if (aliasUrl) aliasUrl.value = url;
}

function startAliasFromLater(item: LaterItem): void {
  activeLaterItem = item;
  for (const tab of tabs) {
    if (tab.dataset.tab === "aliases") tab.click();
  }
  if (aliasLabel) aliasLabel.value = item.text;
  if (searchQuery) {
    searchQuery.value = item.text;
    void runSearch(item.text);
  }
}

async function convertLaterToAlias(item: LaterItem, title: string, url: string): Promise<void> {
  await addAlias(item.text, title, url);
  laterItems = laterItems.filter((candidate) => candidate.id !== item.id);
  await saveLaterItems(laterItems);
  activeLaterItem = null;
  if (searchResults) searchResults.textContent = "";
  clear(searchQuery);
  renderLaterItems();
}

async function removeAlias(id: string): Promise<void> {
  aliases = aliases.filter((alias) => alias.id !== id);
  await saveLocalAliases(aliases);
  renderAliases();
}

async function removeDeny(term: string): Promise<void> {
  denyTerms = denyTerms.filter((value) => value !== term);
  await saveDenyTerms(denyTerms);
  renderDenyTerms();
}

async function removeLater(id: string): Promise<void> {
  laterItems = laterItems.filter((item) => item.id !== id);
  await saveLaterItems(laterItems);
  renderLaterItems();
}

async function downloadExport(): Promise<void> {
  const data = await exportTuningData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `remilia-wiki-hyperlink-tuning-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function uploadImport(): Promise<void> {
  const file = importFile?.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text()) as TuningExport;
    await importTuningData(data);
    await reload();
  } catch (error) {
    console.error("Wiki tuning import failed", error);
  } finally {
    // Always clear the input so a corrected file can be re-selected after a bad import.
    if (importFile) importFile.value = "";
  }
}

async function renderDiagnostics(): Promise<void> {
  if (!diagnosticsRoot) return;
  const stats = await loadPerformanceStats();
  diagnosticsRoot.textContent = "";
  const rows = [
    ["Posts scanned", stats.tweetsScanned],
    ["Links created", stats.linksCreated],
    ["Matching time", `${stats.matchingMs}ms`],
    ["Skipped whole-post matches", stats.skippedWholeTweet],
    ["Skipped soft links", stats.skippedLowConfidence],
    ["Last update", stats.updatedAt ? new Date(stats.updatedAt).toLocaleString() : "Never"],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "row compact";
    row.append(textCell(String(label)), textCell(String(value)), document.createElement("span"), document.createElement("span"));
    diagnosticsRoot.appendChild(row);
  }
}

function textCell(value: string): HTMLElement {
  const cell = document.createElement("div");
  cell.textContent = value;
  return cell;
}

function linkCell(url: string): HTMLElement {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = url;
  return link;
}

function removeButton(onClick: () => void): HTMLButtonElement {
  return button("Remove", onClick);
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.addEventListener("click", () => void onClick());
  return element;
}

function clean(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function clear(...inputs: Array<HTMLInputElement | null>): void {
  for (const input of inputs) {
    if (input) input.value = "";
  }
}

function isWikiUrl(value: string): boolean {
  try {
    return new URL(value).hostname === "wiki.remilia.org";
  } catch {
    return false;
  }
}

type SearchResponse = {
  query?: {
    search?: Array<{
      title: string;
      wordcount?: number;
    }>;
  };
};
