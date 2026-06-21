import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";

import { DEFAULT_SETTINGS, DEFAULT_STATS } from "./shared/constants";
import { getLevelProgress } from "./shared/levels";
import {
  loadCollectedAvatars,
  loadMatchedAccounts,
  loadSettings,
  loadStats,
  normalizeCollectedAvatars,
  normalizeMatchedAccounts,
  normalizeStats,
  normalizeWhitelistHandles,
  readNumber,
  resetCollectedAvatars,
  resetMatchedAccounts,
  resetStats,
  saveCollectedAvatars,
  saveMatchedAccounts,
  saveSettings,
  saveStats,
  uniqueStrings,
} from "./shared/storage";
import type {
  CollectedAvatar,
  CollectedAvatarMap,
  DetectionStats,
  FilterMode,
  MatchedAccount,
  MatchedAccountMap,
} from "./shared/types";

type TabId = "filter" | "stats" | "accounts" | "dataset";

const TAB_LABELS: Array<{ id: TabId; label: string }> = [
  { id: "accounts", label: "Accounts" },
  { id: "stats", label: "Stats" },
  { id: "filter", label: "Settings" },
  { id: "dataset", label: "Data" },
];

const MODE_OPTIONS: Array<{ value: FilterMode; label: string; note: string }> = [
  { value: "off", label: "Off", note: "Do nothing. Show everything." },
  { value: "milady", label: "MILADY", note: "Color code milady." },
  { value: "debug", label: "Debug", note: "Show detection markers and scores." },
];

const styles = `
  :root {
    color-scheme: light;
    --bg-0: #f4ffee;
    --bg-1: #e8f5e0;
    --bg-2: #d9f0d6;
    --bg-card: rgba(47, 77, 12, 0.05);
    --line: rgba(47, 77, 12, 0.15);
    --line-strong: rgba(47, 77, 12, 0.25);
    --text: #0a1a04;
    --text-soft: #2f4d0c;
    --text-faint: #5a7a3a;
    --accent: #2f4d0c;
    --accent-bright: #3d6510;
    --accent-soft: rgba(47, 77, 12, 0.12);
    --good: #2f4d0c;
    --shadow-sm: 0 1px 2px rgba(47, 77, 12, 0.08);
    --shadow-md: 0 4px 12px rgba(47, 77, 12, 0.1);
    --shadow-lg: 0 8px 24px rgba(47, 77, 12, 0.12);
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    height: 100%;
  }

  body {
    margin: 0;
    min-width: 320px;
    background: #f4ffee;
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
    font-size: 13px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  /* Linear-style scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--line-strong);
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--text-faint);
  }

  button,
  input {
    font: inherit;
  }

  .popup {
    position: relative;
    width: 340px;
    height: 480px;
    display: flex;
    flex-direction: column;
    padding: 20px;
    background: linear-gradient(180deg, #d9f0d6 0%, #f4ffee 100%);
    border-radius: 0;
    border: none;
  }


  .header {
    position: relative;
    z-index: 1;
    margin-bottom: 20px;
  }

  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, #2f4d0c 0%, #1d3007 50%, #2f4d0c 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.3);
  }

  h1 span {
    background: linear-gradient(135deg, var(--accent-bright) 0%, var(--accent) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .lede,
  .footnote,
  .section-note,
  .empty {
    margin: 0;
    color: var(--text-faint);
    font-size: 12px;
    line-height: 1.5;
  }

  .tabs {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0 0 16px;
    padding: 3px;
    background: rgba(47, 77, 12, 0.08);
    border-radius: 10px;
    border: 1px solid rgba(47, 77, 12, 0.2);
    box-shadow: inset 0 1px 2px rgba(47, 77, 12, 0.05);
  }

  .tabs::-webkit-scrollbar {
    display: none;
  }

  .tab {
    position: relative;
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--text-soft);
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    border-radius: 7px;
    transition: all 150ms ease;
  }

  .tab:hover {
    color: var(--text);
    background: rgba(47, 77, 12, 0.1);
  }

  .tab[data-active="true"] {
    color: #3d2e0a;
    background: rgba(217, 240, 214, 0.9);
    border: 1px solid rgba(47, 77, 12, 0.25);
    box-shadow: 0 2px 6px rgba(47, 77, 12, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }

    .tab[data-active="true"] {
      color: var(--text);
      background: var(--bg-2);
      border: none;
      box-shadow: var(--shadow-sm);
    }
  }

  .panel {
    position: relative;
    z-index: 1;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding-top: 14px;
    scrollbar-width: thin;
    scrollbar-color: rgba(47, 77, 12, 0.4) rgba(47, 77, 12, 0.1);
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .panel-title {
    margin: 0 0 4px;
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .panel-actions-bottom {
    display: flex;
    justify-content: flex-end;
    margin-top: auto;
    padding-top: 20px;
  }

  .action-button {
    border: 0;
    padding: 0;
    background: transparent;
    color: #2f4d0c;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .action-button:hover {
    color: #1d3007;
  }

  .action-button:disabled {
    color: rgba(47, 77, 12, 0.35);
    cursor: default;
  }

  .mode-list {
    display: grid;
    gap: 0;
  }

  .mode-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 11px 0;
    border: 0;
    border-bottom: 1px solid rgba(47, 77, 12, 0.15);
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .mode-dot {
    position: relative;
    display: block;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    border: 1.5px solid rgba(47, 77, 12, 0.5);
    border-radius: 999px;
    flex: 0 0 18px;
    background: rgba(217, 240, 214, 0.5);
  }

  .mode-dot::after {
    content: "";
    position: absolute;
    inset: 4px;
    border-radius: 999px;
    background: transparent;
  }

  .mode-row[data-active="true"] .mode-dot {
    border-color: #2f4d0c;
    background: rgba(217, 240, 214, 0.8);
  }

  .mode-row[data-active="true"] .mode-dot::after {
    background: linear-gradient(135deg, #3d6510, #2f4d0c);
  }

  .mode-label {
    margin: 0 0 3px;
    font-size: 14px;
    font-weight: 620;
  }

  .mode-note {
    margin: 0;
    color: var(--text-faint);
    font-size: 12px;
    line-height: 1.45;
  }

  .sound-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(47, 77, 12, 0.15);
  }

  .sound-toggle-label {
    color: var(--text-soft);
    font-size: 13px;
    font-weight: 500;
  }

  .sound-toggle-switch {
    position: relative;
    width: 40px;
    height: 22px;
    background: rgba(47, 77, 12, 0.15);
    border: 1px solid rgba(47, 77, 12, 0.3);
    border-radius: 11px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .sound-toggle-switch[data-enabled="true"] {
    background: linear-gradient(135deg, #3d6510, #2f4d0c);
    border-color: #2f4d0c;
    box-shadow: 0 2px 8px rgba(47, 77, 12, 0.3);
  }

  .sound-toggle-switch::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: rgba(217, 240, 214, 0.9);
    border-radius: 50%;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(47, 77, 12, 0.2);
  }

  .sound-toggle-switch[data-enabled="true"]::after {
    left: 20px;
    background: #fff;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 16px;
    margin: 0;
  }

  .stats-grid div {
    min-width: 0;
  }

  .stats-grid dt {
    margin: 0 0 3px;
    color: var(--text-soft);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .stats-grid dd {
    margin: 0;
    color: var(--text);
    font-size: 16px;
    font-weight: 640;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .account-list {
    display: grid;
  }

  .account-search {
    width: 100%;
    margin: 0 0 14px;
    border: 1px solid rgba(47, 77, 12, 0.25);
    border-radius: 8px;
    background: rgba(217, 240, 214, 0.6);
    color: var(--text);
    padding: 9px 11px;
    outline: none;
    transition: all 0.15s ease;
    box-shadow: inset 0 1px 2px rgba(47, 77, 12, 0.05);
  }

  .account-search::placeholder {
    color: var(--text-faint);
  }

  .account-search:focus {
    border-color: rgba(47, 77, 12, 0.5);
    background: rgba(217, 240, 214, 0.8);
  }

  .account-group + .account-group {
    margin-top: 16px;
  }

  .account-group-title {
    margin: 0 0 6px;
    color: var(--text-faint);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .account-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 8px;
    overflow: hidden;
    box-sizing: border-box;
    border-radius: 8px;
    margin-bottom: 4px;
    background: rgba(217, 240, 214, 0.5);
    border: 1px solid rgba(47, 77, 12, 0.15);
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .account-row:hover {
    background: rgba(217, 240, 214, 0.5);
    border-color: rgba(47, 77, 12, 0.3);
    box-shadow: 0 2px 8px rgba(47, 77, 12, 0.1);
  }

  .account-row[data-whitelisted="true"] {
    background: rgba(217, 240, 214, 0.7);
    border-color: rgba(47, 77, 12, 0.25);
  }

  .account-row[data-whitelisted="true"] .account-handle,
  .account-row[data-whitelisted="true"] .account-note {
    color: var(--good);
  }

  .account-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(47, 77, 12, 0.3);
    box-shadow: 0 2px 6px rgba(47, 77, 12, 0.2);
    flex-shrink: 0;
  }

  .account-avatar-placeholder {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(47, 77, 12, 0.15) 0%, rgba(47, 77, 12, 0.2) 100%);
    border: 2px solid rgba(47, 77, 12, 0.35);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: #2f4d0c;
  }

  .account-info {
    flex: 1;
    min-width: 0;
  }

  .account-handle-row {
    display: flex;
    align-items: baseline;
    gap: 0;
    margin: 0 0 2px;
    min-width: 0;
    overflow: hidden;
  }

  .account-handle {
    font-size: 14px;
    font-weight: 620;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .account-note {
    margin: 0;
    color: var(--text-faint);
    font-size: 11px;
  }

  .account-link {
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(47, 77, 12, 0.12);
    border: 1px solid rgba(47, 77, 12, 0.25);
    color: #2f4d0c;
    font-size: 10px;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .account-link:hover {
    background: rgba(47, 77, 12, 0.2);
    border-color: rgba(47, 77, 12, 0.4);
  }

  .account-displayname {
    font-weight: 400;
    color: var(--text-faint);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex-shrink: 1;
  }

  .account-level {
    flex-shrink: 0;
    margin-left: auto;
    padding-left: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #b8860b;
    white-space: nowrap;
  }

  .account-row-uncaught {
    background: rgba(120, 120, 120, 0.08);
    border-color: rgba(120, 120, 120, 0.15);
    padding: 5px 8px;
    gap: 6px;
  }

  .account-row-uncaught .account-avatar,
  .account-row-uncaught .account-avatar-placeholder {
    width: 22px;
    height: 22px;
    border-width: 1px;
    border-color: rgba(120, 120, 120, 0.3);
  }

  .account-row-uncaught .account-handle {
    font-size: 11px;
    font-weight: 500;
    color: #888;
  }

  .account-row-uncaught .account-note {
    font-size: 10px;
    color: #aaa;
  }

  .account-row-uncaught .account-link {
    font-size: 9px;
    padding: 2px 6px;
  }

  .account-row-uncaught:hover {
    border-color: rgba(120, 120, 120, 0.3);
  }

  .level-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 7px;
    border-radius: 8px;
    background: linear-gradient(135deg, #4a7a28 0%, #5d9432 100%);
    color: #f4ffee;
    font-size: 10px;
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
    margin-left: auto;
  }

  .tooltip-trigger {
    position: absolute;
    top: 0;
    right: 0;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(47, 77, 12, 0.1);
    border: 1px solid rgba(47, 77, 12, 0.2);
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: help;
  }

  .tooltip-trigger:hover + .tooltip-content {
    display: block;
  }

  .tooltip-content {
    display: none;
    position: absolute;
    top: 22px;
    right: 0;
    width: 220px;
    padding: 8px 10px;
    background: rgba(15, 20, 10, 0.95);
    color: #d9f0d6;
    font-size: 10px;
    line-height: 1.5;
    border-radius: 6px;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }

  .collection-stats {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 600;
    color: #2f4d0c;
    text-align: center;
  }

  .collection-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 10px;
  }

  .collection-controls .account-search {
    flex: 1;
    margin-bottom: 0;
  }

  .sort-toggle {
    display: flex;
    border: 1px solid rgba(47, 77, 12, 0.25);
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .sort-button {
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: var(--text-faint);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .sort-button[data-active="true"] {
    background: rgba(47, 77, 12, 0.15);
    color: #2f4d0c;
    font-weight: 600;
  }

  .xp-bar-container {
    height: 3px;
    margin-top: 4px;
    border-radius: 2px;
    background: rgba(47, 77, 12, 0.1);
    overflow: hidden;
  }

  .xp-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(90deg, #d4af37, #f0c850);
    transition: width 0.3s ease;
  }

  .dataset-summary {
    margin-bottom: 14px;
  }

  .footnote {
    padding-top: 12px;
    border-top: 1px solid rgba(47, 77, 12, 0.15);
  }
`;

function App() {
  const [tab, setTab] = createSignal<TabId>("accounts");
  const [accountSearch, setAccountSearch] = createSignal("");
  const [accountSort, setAccountSort] = createSignal<"level" | "recent">("level");
  const [settings, setSettings] = createSignal(DEFAULT_SETTINGS);
  const [stats, setStats] = createSignal<DetectionStats>(DEFAULT_STATS);
  const [matchedAccounts, setMatchedAccounts] = createSignal<MatchedAccountMap>({});
  const [collectedAvatars, setCollectedAvatars] = createSignal<CollectedAvatarMap>({});

  const sortedAccounts = createMemo(() => Object.values(matchedAccounts()).sort(compareAccounts));
  const accountSearchTerm = createMemo(() => accountSearch().trim().toLowerCase());
  const matchesAccountSearch = (account: MatchedAccount) => {
    const query = accountSearchTerm();
    if (!query) {
      return true;
    }
    return (
      account.handle.toLowerCase().includes(query) ||
      (account.displayName?.toLowerCase().includes(query) ?? false)
    );
  };
  const whitelistedAccounts = createMemo(() =>
    sortedAccounts().filter(
      (account) => settings().whitelistHandles.includes(account.handle) && matchesAccountSearch(account),
    ),
  );
  const nonWhitelistedAccounts = createMemo(() =>
    sortedAccounts().filter(
      (account) => !settings().whitelistHandles.includes(account.handle) && matchesAccountSearch(account),
    ),
  );
  const caughtAccounts = createMemo(() => {
    const accounts = nonWhitelistedAccounts().filter((a) => a.caught);
    const sort = accountSort();
    if (sort === "recent") {
      return [...accounts].sort((a, b) => (b.caughtAt ?? "").localeCompare(a.caughtAt ?? ""));
    }
    return [...accounts].sort((a, b) => b.postsLiked - a.postsLiked);
  });
  const uncaughtAccounts = createMemo(() =>
    nonWhitelistedAccounts().filter((a) => !a.caught),
  );
  const caughtCount = createMemo(() =>
    Object.values(matchedAccounts()).filter((a) => a.caught).length,
  );
  const seenCount = createMemo(() => Object.keys(matchedAccounts()).length);
  const catchRateLabel = createMemo(() => {
    const seen = seenCount();
    if (seen <= 0) return "0%";
    const rate = (caughtCount() / seen) * 100;
    return `${rate.toFixed(rate >= 10 ? 0 : 1)}%`;
  });
  const matchRateLabel = createMemo(() => {
    const seen = stats().tweetsScanned;
    if (seen <= 0) {
      return "0%";
    }
    const rate = (stats().postsMatched / seen) * 100;
    return `${rate.toFixed(rate >= 10 ? 1 : 2)}%`;
  });
  const totalAvatarSightings = createMemo(() =>
    Object.values(collectedAvatars()).reduce((total, avatar) => total + avatar.seenCount, 0),
  );
  const lastHitLabel = createMemo(() => {
    const value = stats().lastMatchAt;
    return value ? formatDate(value) : "Never";
  });

  // Get avatar URL for a handle from collected avatars
  const getAvatarUrl = (handle: string): string | null => {
    const avatars = collectedAvatars();
    for (const avatar of Object.values(avatars)) {
      if (avatar.handles.includes(handle.toLowerCase())) {
        return avatar.originalUrl;
      }
    }
    return null;
  };

  // Open Twitter profile in new tab
  const openProfile = (handle: string, event: MouseEvent) => {
    event.stopPropagation();
    window.open(`https://twitter.com/${handle}`, "_blank");
  };

  onMount(async () => {
    const [nextSettings, nextStats, nextMatchedAccounts, nextCollectedAvatars] = await Promise.all([
      loadSettings(),
      loadStats(),
      loadMatchedAccounts(),
      loadCollectedAvatars(),
    ]);
    setSettings(nextSettings);
    setStats(nextStats);
    setMatchedAccounts(nextMatchedAccounts);
    setCollectedAvatars(nextCollectedAvatars);

    const handleStorageChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area === "sync") {
        if (changes.mode) {
          const mode = changes.mode.newValue;
          if (mode === "milady" || mode === "debug" || mode === "off") {
            setSettings((current) => ({ ...current, mode }));
          }
        }
        if (changes.whitelistHandles) {
          setSettings((current) => ({
            ...current,
            whitelistHandles: normalizeWhitelistHandles(changes.whitelistHandles.newValue),
          }));
        }
        if (changes.soundEnabled) {
          setSettings((current) => ({
            ...current,
            soundEnabled: typeof changes.soundEnabled.newValue === "boolean" ? changes.soundEnabled.newValue : current.soundEnabled,
          }));
        }
        if (changes.showLevelBadge) {
          setSettings((current) => ({
            ...current,
            showLevelBadge: typeof changes.showLevelBadge.newValue === "boolean" ? changes.showLevelBadge.newValue : current.showLevelBadge,
          }));
        }
      }

      if (area === "local") {
        if (changes.stats) {
          setStats(normalizeStats(changes.stats.newValue));
        }
        if (changes.matchedAccounts) {
          setMatchedAccounts(normalizeMatchedAccounts(changes.matchedAccounts.newValue));
        }
        if (changes.collectedAvatars) {
          setCollectedAvatars(normalizeCollectedAvatars(changes.collectedAvatars.newValue));
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    onCleanup(() => chrome.storage.onChanged.removeListener(handleStorageChange));
  });

  const setMode = async (mode: FilterMode) => {
    const next = { ...settings(), mode };
    setSettings(next);
    await saveSettings(next);
  };

  const toggleLevelBadge = async () => {
    const next = { ...settings(), showLevelBadge: !settings().showLevelBadge };
    setSettings(next);
    await saveSettings(next);
  };

  const toggleSound = async () => {
    const next = { ...settings(), soundEnabled: !settings().soundEnabled };
    setSettings(next);
    await saveSettings(next);
  };

  const setCardTheme = async (theme: string) => {
    const next = { ...settings(), cardTheme: theme as "full" | "no-premium" | "silver-only" | "off" };
    setSettings(next);
    await saveSettings(next);
  };

  const toggleWhitelist = async (handle: string) => {
    const current = settings().whitelistHandles;
    const nextWhitelist = current.includes(handle)
      ? current.filter((entry) => entry !== handle)
      : [...current, handle].sort((left, right) => left.localeCompare(right));
    const next = { ...settings(), whitelistHandles: nextWhitelist };
    setSettings(next);
    await saveSettings(next);
  };

  const handleResetStats = async () => {
    await Promise.all([resetStats(), resetMatchedAccounts()]);
    const [nextStats, nextMatchedAccounts] = await Promise.all([loadStats(), loadMatchedAccounts()]);
    setStats(nextStats);
    setMatchedAccounts(nextMatchedAccounts);
  };

  const handleResetAvatars = async () => {
    await resetCollectedAvatars();
    setCollectedAvatars(await loadCollectedAvatars());
  };

  const handleExportAvatars = () => {
    exportCollectedAvatars(collectedAvatars(), settings().whitelistHandles);
  };

  const handleImportLegacyStats = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const imported = await importLegacyMiladyData(file, {
      stats: stats(),
      matchedAccounts: matchedAccounts(),
      collectedAvatars: collectedAvatars(),
    });
    await Promise.all([
      saveStats(imported.stats),
      saveMatchedAccounts(imported.matchedAccounts),
      saveCollectedAvatars(imported.collectedAvatars),
    ]);
    setStats(imported.stats);
    setMatchedAccounts(imported.matchedAccounts);
    setCollectedAvatars(imported.collectedAvatars);
  };

  return (
    <>
      <style>{styles}</style>
      <main class="popup">
        <header class="header">
          <h1>Miladymaxxer</h1>
        </header>

        <nav class="tabs" aria-label="Popup sections">
          <For each={TAB_LABELS}>
            {(item) => (
              <button
                type="button"
                class="tab"
                data-active={String(tab() === item.id)}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            )}
          </For>
        </nav>

        <Show when={tab() === "filter"}>
          <section class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Mode</h2>
                <p class="section-note">What happens when a match is found.</p>
              </div>
            </div>
            <div class="mode-list">
              <For each={MODE_OPTIONS}>
                {(option) => (
                  <button
                    type="button"
                    class="mode-row"
                    data-active={String(settings().mode === option.value)}
                    onClick={() => void setMode(option.value)}
                  >
                    <span class="mode-dot" />
                    <div>
                      <p class="mode-label">{option.label}</p>
                      <p class="mode-note">{option.note}</p>
                    </div>
                  </button>
                )}
              </For>
            </div>
            <div class="sound-toggle">
              <span class="sound-toggle-label">Sound</span>
              <button
                type="button"
                class="sound-toggle-switch"
                data-enabled={String(settings().soundEnabled)}
                onClick={() => void toggleSound()}
                aria-label={settings().soundEnabled ? "Disable sound" : "Enable sound"}
              />
            </div>
            <div class="sound-toggle">
              <span class="sound-toggle-label">Level badges</span>
              <button
                type="button"
                class="sound-toggle-switch"
                data-enabled={String(settings().showLevelBadge)}
                onClick={() => void toggleLevelBadge()}
                aria-label={settings().showLevelBadge ? "Hide level badges" : "Show level badges"}
              />
            </div>
            <div style="margin-top: 12px; margin-bottom: 12px">
              <p class="section-note" style="margin-bottom: 6px">Card theming</p>
              <div class="sort-toggle" style="width: 100%">
                <button type="button" class="sort-button" style="flex:1" data-active={String(settings().cardTheme === "full")} onClick={() => void setCardTheme("full")}>Full</button>
                <button type="button" class="sort-button" style="flex:1" data-active={String(settings().cardTheme === "no-premium")} onClick={() => void setCardTheme("no-premium")}>Green/silver only</button>
                <button type="button" class="sort-button" style="flex:1" data-active={String(settings().cardTheme === "silver-only")} onClick={() => void setCardTheme("silver-only")}>Silver only</button>
                <button type="button" class="sort-button" style="flex:1" data-active={String(settings().cardTheme === "off")} onClick={() => void setCardTheme("off")}>Off</button>
              </div>
            </div>
          </section>
        </Show>

        <Show when={tab() === "stats"}>
          <section class="panel">
            <dl class="stats-grid">
              <div><dt>Seen</dt><dd>{formatNumber(stats().tweetsScanned)}</dd></div>
              <div><dt>Matched</dt><dd>{formatNumber(stats().postsMatched)}</dd></div>
              <div><dt>Rate</dt><dd>{matchRateLabel()}</dd></div>
              <div><dt>Exempt</dt><dd>{formatNumber(whitelistedAccounts().length)}</dd></div>
              <div><dt>Errors</dt><dd>{formatNumber(stats().errors)}</dd></div>
              <div><dt>Last match</dt><dd>{lastHitLabel()}</dd></div>
            </dl>
            <div class="panel-actions-bottom">
              <button type="button" class="action-button" onClick={() => void handleResetStats()}>
                Reset
              </button>
              <label class="action-button">
                Import legacy stats
                <input type="file" accept="application/json,.json" onChange={(event) => void handleImportLegacyStats(event)} hidden />
              </label>
            </div>
          </section>
        </Show>

        <Show when={tab() === "accounts"}>
          <section class="panel" style="position: relative">
            <span class="tooltip-trigger">?</span>
            <div class="tooltip-content">
              <b>Inverse quadratic progression</b><br/>
              Level = floor(√ posts liked)<br/>
              Player level = floor(√(likes / 3))<br/><br/>
              <b>Card tiers (by post likes):</b><br/>
              Silver — uncaught (Lv.0)<br/>
              Mint — caught, &lt;75 likes<br/>
              Gold — 75+ likes<br/>
              Diamond — 250+ likes<br/><br/>
              Allow-listed accounts give 25% player XP.
            </div>
            <p class="collection-stats">
              {formatNumber(caughtCount())} caught / {formatNumber(seenCount())} seen · {catchRateLabel()}
            </p>
            <div class="collection-controls">
              <input
                class="account-search"
                type="search"
                value={accountSearch()}
                onInput={(event) => setAccountSearch(event.currentTarget.value)}
                placeholder="Search handles"
                spellcheck={false}
              />
              <div class="sort-toggle">
                <button
                  type="button"
                  class="sort-button"
                  data-active={String(accountSort() === "level")}
                  onClick={() => setAccountSort("level")}
                >Level</button>
                <button
                  type="button"
                  class="sort-button"
                  data-active={String(accountSort() === "recent")}
                  onClick={() => setAccountSort("recent")}
                >Recent</button>
              </div>
            </div>
            <Show
              when={sortedAccounts().length > 0}
              fallback={<p class="empty">Nothing detected yet.</p>}
            >
              <Show when={whitelistedAccounts().length > 0}>
                <div class="account-group">
                  <p class="account-group-title">Exempt</p>
                  <div class="account-list">
                    <For each={whitelistedAccounts()}>
                      {(account) => {
                        return (
                          <div
                            class="account-row"
                            data-whitelisted="true"
                            title={`@${account.handle} is exempt`}
                          >
                            <Show
                              when={getAvatarUrl(account.handle)}
                              fallback={<div class="account-avatar-placeholder">✦</div>}
                            >
                              {(url) => (
                                <img
                                  src={url()}
                                  alt=""
                                  class="account-avatar"
                                  loading="eager"
                                  referrerPolicy="no-referrer"
                                  onClick={(e) => openProfile(account.handle, e)}
                                  style="cursor: pointer"
                                />
                              )}
                            </Show>
                            <div class="account-info" onClick={() => void toggleWhitelist(account.handle)} style="cursor: pointer">
                              <p class="account-handle">@{account.handle}</p>
                              <p class="account-note">
                                {formatNumber(account.postsMatched)} hits, exempt
                              </p>
                            </div>
                            <a
                              class="account-link"
                              href={`https://twitter.com/${account.handle}`}
                              target="_blank"
                              rel="noopener"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View
                            </a>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={caughtAccounts().length > 0}>
                <div class="account-group">
                  <p class="account-group-title">CAUGHT MILADYS</p>
                  <div class="account-list">
                    <For each={caughtAccounts()}>
                      {(account) => {
                        const avatarUrl = getAvatarUrl(account.handle);
                        const progress = () => getLevelProgress(account.postsLiked);
                        const likeRate = () => account.postsMatched > 0 ? Math.round((account.postsLiked / account.postsMatched) * 100) : 0;
                        const tooltipText = () => {
                          const parts = [];
                          if (account.caughtAt) parts.push(`Caught ${formatDate(account.caughtAt)}`);
                          if (account.lastDetectionScore != null) parts.push(`Score ${(account.lastDetectionScore * 100).toFixed(0)}%`);
                          parts.push(`Seen ${formatNumber(account.postsMatched)} times`);
                          parts.push(`Liked ${formatNumber(account.postsLiked)} (${likeRate()}%)`);
                          return parts.join(" \u00b7 ");
                        };
                        return (
                          <div
                            class="account-row"
                            data-caught="true"
                            title={tooltipText()}
                          >
                            <Show
                              when={getAvatarUrl(account.handle)}
                              fallback={<div class="account-avatar-placeholder">✦</div>}
                            >
                              {(url) => (
                                <img
                                  src={url()}
                                  alt=""
                                  class="account-avatar"
                                  loading="eager"
                                  referrerPolicy="no-referrer"
                                  onClick={(e) => openProfile(account.handle, e)}
                                  style="cursor: pointer"
                                />
                              )}
                            </Show>
                            <div class="account-info" onClick={(e) => openProfile(account.handle, e)} style="cursor: pointer">
                              <div class="account-handle-row">
                                <span class="account-handle" style="font-weight: 700; font-size: 13px">{account.displayName || account.handle}</span>
                                <span class="level-pill">Lv.{progress().level}</span>
                              </div>
                              <p class="account-note" style="margin: 0">
                                @{account.handle} · {formatNumber(account.postsLiked)} likes
                              </p>
                              <div class="xp-bar-container">
                                <div
                                  class="xp-bar-fill"
                                  style={{ width: `${progress().needed > 0 ? (progress().current / progress().needed) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={uncaughtAccounts().length > 0}>
                <div class="account-group">
                  <p class="account-group-title">Seen</p>
                  <div class="account-list">
                    <For each={uncaughtAccounts()}>
                      {(account) => {
                        return (
                          <div
                            class="account-row account-row-uncaught"
                            title={`Seen ${formatNumber(account.postsMatched)} times${account.lastDetectionScore != null ? ` \u00b7 Score ${(account.lastDetectionScore * 100).toFixed(0)}%` : ""}`}
                          >
                            <Show
                              when={getAvatarUrl(account.handle)}
                              fallback={<div class="account-avatar-placeholder">✦</div>}
                            >
                              {(url) => (
                                <img
                                  src={url()}
                                  alt=""
                                  class="account-avatar"
                                  loading="eager"
                                  referrerPolicy="no-referrer"
                                  onClick={(e) => openProfile(account.handle, e)}
                                  style="cursor: pointer"
                                />
                              )}
                            </Show>
                            <div class="account-info" onClick={(e) => openProfile(account.handle, e)} style="cursor: pointer">
                              <p class="account-handle">@{account.handle}</p>
                              <p class="account-note">seen {formatNumber(account.postsMatched)} times</p>
                            </div>
                            <a
                              class="account-link"
                              href={`https://twitter.com/${account.handle}`}
                              target="_blank"
                              rel="noopener"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View
                            </a>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </Show>
            </Show>
          </section>
        </Show>

        <Show when={tab() === "dataset"}>
          <section class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Dataset</h2>
                <p class="section-note">Export avatar data for labeling.</p>
              </div>
              <div class="actions">
                <button
                  type="button"
                  class="action-button"
                  onClick={handleExportAvatars}
                  disabled={Object.keys(collectedAvatars()).length === 0}
                >
                  Export
                </button>
                <button
                  type="button"
                  class="action-button"
                  onClick={() => void handleResetAvatars()}
                  disabled={Object.keys(collectedAvatars()).length === 0}
                >
                  Reset
                </button>
              </div>
            </div>
            <div class="dataset-summary">
              <dl class="stats-grid">
                <div><dt>Unique avatars</dt><dd>{formatNumber(Object.keys(collectedAvatars()).length)}</dd></div>
                <div><dt>Total sightings</dt><dd>{formatNumber(totalAvatarSightings())}</dd></div>
              </dl>
            </div>
            <p class="footnote">Collected entries are local-only until you export them.</p>
          </section>
        </Show>
      </main>
    </>
  );
}

render(() => <App />, document.getElementById("app")!);

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Never";
  }
  return formatRelativeTime(date);
}

function formatRelativeTime(date: Date): string {
  const deltaMs = date.getTime() - Date.now();
  const absMs = Math.abs(deltaMs);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
    { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
    { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
    { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
    { unit: "day", ms: 24 * 60 * 60 * 1000 },
    { unit: "hour", ms: 60 * 60 * 60 * 1000 / 60 },
    { unit: "minute", ms: 60 * 1000 },
    { unit: "second", ms: 1000 },
  ];

  for (const { unit, ms } of units) {
    if (absMs >= ms || unit === "second") {
      return formatter.format(Math.round(deltaMs / ms), unit);
    }
  }

  return "just now";
}

type LegacyImportState = {
  stats: DetectionStats;
  matchedAccounts: MatchedAccountMap;
  collectedAvatars: CollectedAvatarMap;
};

async function importLegacyMiladyData(file: File, current: LegacyImportState): Promise<LegacyImportState> {
  const raw = JSON.parse(await file.text()) as unknown;
  const root = objectRecord(raw);
  const storageRoot = objectRecord(root.storage);
  const source = Object.keys(storageRoot).length > 0 ? storageRoot : root;
  const importedStats = normalizeStats(root.stats ?? source.stats ?? root.detectionStats ?? source.detectionStats);
  const importedAccounts = normalizeMatchedAccounts(
    root.matchedAccounts ?? source.matchedAccounts ?? root.accounts ?? source.accounts,
  );
  const importedAvatars = normalizeCollectedAvatars(
    root.collectedAvatars ?? source.collectedAvatars ?? root.avatars ?? source.avatars,
  );

  return {
    stats: mergeStats(current.stats, importedStats),
    matchedAccounts: mergeMatchedAccounts(current.matchedAccounts, importedAccounts),
    collectedAvatars: mergeCollectedAvatars(current.collectedAvatars, importedAvatars),
  };
}

function mergeStats(current: DetectionStats, imported: DetectionStats): DetectionStats {
  return {
    tweetsScanned: Math.max(current.tweetsScanned, imported.tweetsScanned),
    avatarsChecked: Math.max(current.avatarsChecked, imported.avatarsChecked),
    cacheHits: Math.max(current.cacheHits, imported.cacheHits),
    postsMatched: Math.max(current.postsMatched, imported.postsMatched),
    modelMatches: Math.max(current.modelMatches, imported.modelMatches),
    errors: Math.max(current.errors, imported.errors),
    lastMatchAt: latestDateString(current.lastMatchAt, imported.lastMatchAt),
  };
}

function mergeMatchedAccounts(current: MatchedAccountMap, imported: MatchedAccountMap): MatchedAccountMap {
  const merged: MatchedAccountMap = { ...current };
  for (const [handle, account] of Object.entries(imported)) {
    const existing = merged[handle];
    if (!existing) {
      merged[handle] = account;
      continue;
    }
    merged[handle] = {
      ...existing,
      displayName: existing.displayName || account.displayName,
      postsMatched: Math.max(existing.postsMatched, account.postsMatched),
      postsLiked: Math.max(existing.postsLiked, account.postsLiked),
      lastMatchedAt: latestDateString(existing.lastMatchedAt, account.lastMatchedAt),
      lastDetectionScore: maxNullableNumber(existing.lastDetectionScore, account.lastDetectionScore),
      caught: existing.caught || account.caught,
      caughtAt: latestDateString(existing.caughtAt, account.caughtAt),
      verificationStatus: existing.verificationStatus === "verified" || account.verificationStatus !== "verified"
        ? existing.verificationStatus
        : account.verificationStatus,
    };
  }
  return merged;
}

function mergeCollectedAvatars(current: CollectedAvatarMap, imported: CollectedAvatarMap): CollectedAvatarMap {
  const merged: CollectedAvatarMap = { ...current };
  for (const [url, avatar] of Object.entries(imported)) {
    const existing = merged[url];
    if (!existing) {
      merged[url] = avatar;
      continue;
    }
    merged[url] = {
      ...existing,
      originalUrl: existing.originalUrl || avatar.originalUrl,
      handles: mergeStringLists(existing.handles, avatar.handles),
      displayNames: mergeStringLists(existing.displayNames, avatar.displayNames),
      sourceSurfaces: mergeStringLists(existing.sourceSurfaces, avatar.sourceSurfaces),
      seenCount: Math.max(existing.seenCount, avatar.seenCount),
      firstSeenAt: earliestDateString(existing.firstSeenAt, avatar.firstSeenAt) || existing.firstSeenAt,
      lastSeenAt: latestDateString(existing.lastSeenAt, avatar.lastSeenAt) || existing.lastSeenAt,
      exampleProfileUrl: existing.exampleProfileUrl || avatar.exampleProfileUrl,
      exampleNotificationUrl: existing.exampleNotificationUrl || avatar.exampleNotificationUrl,
      exampleTweetUrl: existing.exampleTweetUrl || avatar.exampleTweetUrl,
      heuristicMatch: existing.heuristicMatch ?? avatar.heuristicMatch,
      heuristicSource: existing.heuristicSource ?? avatar.heuristicSource,
      heuristicScore: maxNullableNumber(existing.heuristicScore, avatar.heuristicScore),
      heuristicTokenId: existing.heuristicTokenId ?? avatar.heuristicTokenId,
      whitelisted: existing.whitelisted || avatar.whitelisted,
    };
  }
  return merged;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function mergeStringLists(left: string[], right: string[]): string[] {
  return Array.from(new Set([...left, ...right])).sort((a, b) => a.localeCompare(b));
}

function maxNullableNumber(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
}

function latestDateString(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function earliestDateString(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

function compareAccounts(left: MatchedAccount, right: MatchedAccount): number {
  if (right.postsMatched !== left.postsMatched) {
    return right.postsMatched - left.postsMatched;
  }
  return left.handle.localeCompare(right.handle);
}

function exportCollectedAvatars(collectedAvatars: CollectedAvatarMap, whitelistHandles: string[]): void {
  const avatars = Object.values(collectedAvatars).sort(compareCollectedAvatars);
  if (avatars.length === 0) {
    return;
  }

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    avatarCount: avatars.length,
    totalSightings: avatars.reduce((total, avatar) => total + avatar.seenCount, 0),
    whitelistHandles,
    avatars,
  };

  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `miladymaxxer-avatars-${timestampForFilename(new Date())}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function compareCollectedAvatars(left: CollectedAvatar, right: CollectedAvatar): number {
  if (right.seenCount !== left.seenCount) {
    return right.seenCount - left.seenCount;
  }
  return left.normalizedUrl.localeCompare(right.normalizedUrl);
}

function timestampForFilename(value: Date): string {
  return value.toISOString().replace(/[:.]/g, "-");
}
