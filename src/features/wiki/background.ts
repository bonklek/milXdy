import { createId, loadDenyTerms, loadLaterItems, loadLocalAliases, saveDenyTerms, saveLaterItems, saveLocalAliases } from "./localData";

const MENU_ADD_ALIAS = "remilia-add-alias";
const MENU_LINK_LATER = "remilia-link-later";
const MENU_DENY = "remilia-deny-term";
const MENU_DENY_LINK_TEXT = "remilia-deny-link-text";
const MENU_DENY_LINK_TARGET = "remilia-deny-link-target";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ADD_ALIAS,
      title: "Link selected text to this page",
      contexts: ["selection"],
      documentUrlPatterns: ["https://wiki.remilia.org/*"],
    });
    chrome.contextMenus.create({
      id: MENU_LINK_LATER,
      title: "Save selected text to link later",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_DENY,
      title: "Never link selected text",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_DENY_LINK_TEXT,
      title: "Never link this Remilia phrase",
      contexts: ["link"],
      targetUrlPatterns: ["https://wiki.remilia.org/*"],
    });
    chrome.contextMenus.create({
      id: MENU_DENY_LINK_TARGET,
      title: "Never link this Remilia target",
      contexts: ["link"],
      targetUrlPatterns: ["https://wiki.remilia.org/*"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const text = normalizeSelection(info.selectionText);

  if (info.menuItemId === MENU_LINK_LATER && text) {
    void addLater(text, tab?.url);
  } else if (info.menuItemId === MENU_DENY && text) {
    void addDeny(text);
  } else if (info.menuItemId === MENU_ADD_ALIAS && tab?.url && text) {
    void addAlias(text, tab.url, tab.title || text);
  } else if (info.menuItemId === MENU_DENY_LINK_TEXT && text) {
    void addDeny(text);
  } else if (info.menuItemId === MENU_DENY_LINK_TARGET && info.linkUrl) {
    void addDeny(normalizeWikiTarget(info.linkUrl));
  }
});

async function addLater(text: string, pageUrl?: string): Promise<void> {
  const items = await loadLaterItems();
  items.unshift({ id: createId(), text, pageUrl, createdAt: Date.now() });
  await saveLaterItems(items.slice(0, 500));
}

async function addDeny(text: string): Promise<void> {
  const terms = await loadDenyTerms();
  await saveDenyTerms([...terms, text]);
}

async function addAlias(label: string, url: string, title: string): Promise<void> {
  const aliases = await loadLocalAliases();
  const cleanTitle = title.replace(/ - Remilia Wiki$/i, "").trim() || label;
  aliases.unshift({
    id: createId(),
    label,
    title: cleanTitle,
    url,
    createdAt: Date.now(),
  });
  await saveLocalAliases(aliases.slice(0, 500));
}

function normalizeSelection(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, 160);
}

function normalizeWikiTarget(value: string): string {
  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.split("/").pop() || value).replace(/_/g, " ");
  } catch {
    return value;
  }
}
