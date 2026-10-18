import { normalizeVisualTheme, VISUAL_THEME_KEY } from "../../platform/visuals/reskin-profile";
export function visualEditorElements(): Array<HTMLInputElement | HTMLSelectElement> {
  return [
    "visualThemeName",
    "visualProfile",
    "visualTweetFont",
    "visualUiFont",
    "visualPfpShape",
    "visualMediaAdvanced", "visualPfpRounding", "visualMediaRounding", "visualQuoteSpacing",
    "visualMaxxerIntensity",
    "visualMaxxerSeparators",
    "visualPokePlacement",
    "visualAppWindowStyle",
    "visualTweetPngBorderPalette",
    "visualInterfaceAccentColor", "visualUseRemiliaProfileColor", "visualTweetPngBackgroundColor", "visualTweetPngFontColor",
    "visualMaxMediaHeight",
    "visualBackgroundFade",
    "visualSquareMedia",
    "visualPfpFeed",
    "visualPfpNotifications",
    "visualPfpChat",
    "visualQuoteMediaGap",
    "visualAppShadows",
    "visualPostButtonClickly",
    "visualPostSound",
    "visualSidebarBevel",
    "visualSidebarSound",
    "visualNewPostsPill",
    "visualNewPostsSound",
    "visualNotificationUnreadTint",
    "visualHideMessageRequestDot",
    "visualHideBoostButton",
    "visualRemistatsBox",
    "visualIncomingPokeGold",
    "visualReminetChatOverlay",
    "visualDisableMaxxer",
    "visualDisableSelfTracking",
    "visualMaxxerShimmer",
    "visualTweetPngIncludeDisplayName",
    "visualTweetPngIncludeHandle",
    "visualTweetPngIncludeImages",
    "visualTweetPngIncludeQuoteText",
    "visualTweetPngIncludeQuoteImages",
    "visualTweetPngShrinkTallImages",
    "visualTweetPngIncludeDate",
    "visualTweetPngIncludeStats",
    "visualTweetPngBorder",
  ].flatMap((id) => {
    const element = document.getElementById(id);
    return element instanceof HTMLInputElement || element instanceof HTMLSelectElement ? [element] : [];
  });
}

export function saveVisualSound(element: HTMLInputElement | HTMLSelectElement): void {
        const audioProperty = ({ visualPostSound: "postSound", visualSidebarSound: "sidebarSound", visualNewPostsSound: "newPostsSound" } as const)[element.id as "visualPostSound" | "visualSidebarSound" | "visualNewPostsSound"];
        if (audioProperty) {
          const enabled = (element as HTMLInputElement).checked;
          // Save only this audio toggle; retain unrelated unapplied appearance edits.
          void chrome.storage.local.get(VISUAL_THEME_KEY).then(stored => chrome.storage.local.set({
            [VISUAL_THEME_KEY]: { ...normalizeVisualTheme(stored[VISUAL_THEME_KEY]), [audioProperty]: enabled },
          }));
        }
}

export function appendSavedConfigurationsControl(parent: HTMLElement | null, restore: () => Promise<unknown>, failed: () => void): void {
  const button = document.createElement("button"); button.type = "button";
  button.textContent = "Saved configurations…";
  button.addEventListener("click", () => { void restore().catch(failed); });
  parent?.append(button);
}
