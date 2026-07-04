import { createId, loadDenyTerms, loadLaterItems, loadLocalAliases, saveDenyTerms, saveLaterItems, saveLocalAliases } from "./localData";

const MENU_ADD_ALIAS = "remilia-add-alias";
const MENU_LINK_LATER = "remilia-link-later";
const MENU_CREATE_WITH_GROK = "remilia-create-wiki-with-grok";
const MENU_GROK_POST_SEED = "remilia-create-wiki-with-grok-post-seed";
const MENU_GROK_GENERIC = "remilia-create-wiki-with-grok-generic";
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
      id: MENU_CREATE_WITH_GROK,
      title: "Create Wiki entry with Grok",
      contexts: ["selection", "page", "link"],
      documentUrlPatterns: ["https://x.com/*", "https://twitter.com/*"],
    });
    chrome.contextMenus.create({
      id: MENU_GROK_POST_SEED,
      parentId: MENU_CREATE_WITH_GROK,
      title: "Use this post as a jumping off point",
      contexts: ["selection", "page", "link"],
      documentUrlPatterns: ["https://x.com/*", "https://twitter.com/*"],
    });
    chrome.contextMenus.create({
      id: MENU_GROK_GENERIC,
      parentId: MENU_CREATE_WITH_GROK,
      title: "Create a generic article prompt",
      contexts: ["selection", "page", "link"],
      documentUrlPatterns: ["https://x.com/*", "https://twitter.com/*"],
    });
    chrome.contextMenus.create({
      id: "remilia-create-wiki-with-grok-profile",
      parentId: MENU_CREATE_WITH_GROK,
      title: "Create a profile article prompt",
      contexts: ["page", "selection", "link"],
      documentUrlPatterns: ["https://x.com/*", "https://twitter.com/*"],
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
  } else if (info.menuItemId === MENU_GROK_POST_SEED && tab?.id) {
    void createWithGrok(tab.id, text, info.linkUrl || tab.url, "post-seed");
  } else if (info.menuItemId === MENU_GROK_GENERIC && tab?.id) {
    void createWithGrok(tab.id, text, info.linkUrl || tab.url, "generic");
  } else if (info.menuItemId === "remilia-create-wiki-with-grok-profile" && tab?.id) {
    void createWithGrok(tab.id, text, info.linkUrl || tab.url, "profile");
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

async function createWithGrok(tabId: number, selectedText: string, sourceUrl: string | undefined, mode: "post-seed" | "generic" | "profile"): Promise<void> {
  await chrome.tabs.sendMessage(tabId, {
    type: "remilia-wiki:createWithGrok",
    selectedText,
    sourceUrl,
    mode,
  }).catch(() => undefined);
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
