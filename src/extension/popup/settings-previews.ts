import { absoluteRemiliaMediaUrl } from "../../platform/media/remilia-media-allowlist";
// Keep aligned with tweetPngPalette in the Share Kit export renderer.
export const EXPORT_PREVIEW_PALETTES: Record<string, [string, string, string]> = {
  purple: ["#b67cff", "#c9a5ff", "#d5b7ff"],
  gray: ["#cfd6df", "#d8dee7", "#d8dee7"],
  blue: ["#78aee8", "#a8cef5", "#a8cef5"],
  green: ["#82b98a", "#add8b1", "#add8b1"],
};

type PreviewPerson = { username: string; displayName: string; avatarUrl: string };
type PreviewProfile = { account: PreviewPerson; friends: PreviewPerson[] };
const jackson: PreviewPerson = { username: "remilia_jackson", displayName: "Remilia Jackson", avatarUrl: "https://pfp.remilia.net/pfp/special/jackson" };
let profile: PreviewProfile = { account: jackson, friends: [] };
let profileVersion = 0;
let fallbackRequest: Promise<PreviewProfile | null> | null = null;

/** Memory only: reset on disconnect and discard any response from an older connection. */
export function setPreviewProfile(value: PreviewProfile | null): void {
  const version = ++profileVersion;
  if(value?.account?.username) {
    profile = value;
    document.dispatchEvent(new Event("settings-preview-profile"));
    return;
  }
  profile = { account: jackson, friends: [] };
  fallbackRequest ??= chrome.runtime.sendMessage({ type: "remilia-auth:previewFallback" })
    .then(response => response?.ok && response.preview?.account?.username ? response.preview : null).catch(() => null);
  void fallbackRequest!.then(fallback => {
    if(version !== profileVersion) return;
    if(fallback) profile = fallback;
    document.dispatchEvent(new Event("settings-preview-profile"));
  });
}

function friend(index = 0): PreviewPerson { return profile.friends[index] ?? jackson; }
function picture(target: HTMLElement, person: PreviewPerson): void {
  target.textContent = "";
  const url = person.avatarUrl ? absoluteRemiliaMediaUrl(person.avatarUrl) : jackson.avatarUrl;
  const img = document.createElement("img");
  img.src = url || jackson.avatarUrl;
  img.alt = person.displayName || person.username;
  img.referrerPolicy = "no-referrer";
  img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit";
  img.addEventListener("error", () => {
    if(img.src !== jackson.avatarUrl) img.src = jackson.avatarUrl;
    else { img.remove(); target.textContent = (person.displayName || person.username || "R").slice(0, 1); }
  });
  target.append(img);
}

const BONKLER_IMAGE_URL = "https://i2.seadn.io/ethereum/0xabfae8a54e6817f57f9de7796044e9a60e61ad67/cb5973c754f96521d8fb93709e551e55.png?w=1600";
let tallExample: Promise<string> | null = null;

/** Deterministic browser resampling, with no invented details or persistent account data. */
function tallExampleImage(): Promise<string> {
  return tallExample ??= (async () => {
    const source = new Image();
    source.crossOrigin = "anonymous";
    source.referrerPolicy = "no-referrer";
    source.src = BONKLER_IMAGE_URL;
    await source.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 1600;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  })();
}

/** Public NFT artwork: stable token IDs keep previews consistent between settings. */
function nftImage(target: HTMLElement, token = 1, tall = false): void {
  target.textContent = "";
  const image = document.createElement("img");
  image.className = "preview-nft-image";
  if(tall) void tallExampleImage().then(url => { image.src = url; }).catch(() => { image.remove(); target.textContent = "Image unavailable"; });
  else image.src = `https://pfp.remilia.net/pfp/yayo/${token}`;
  image.alt = tall ? "Bonkler #1" : `Yayo #${token}`;
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    image.remove(); target.textContent = "Image unavailable";
  }, { once: true });
  target.append(image);
}

function personalize(scene: HTMLElement): void {
  // Replace only static sample identities, never interpolate account strings into HTML.
  const walker = document.createTreeWalker(scene, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while(walker.nextNode()) nodes.push(walker.currentNode as Text);
  for(const node of nodes) {
    if(node.parentElement?.closest("[data-preview-person]")) continue;
    node.textContent = (node.textContent ?? "").replace(/@alex\b|@jamie\b|\bAlex\b|\bJamie\b/g, token => {
      const person = token === "Alex" || token === "@alex" ? profile.account : friend();
      return token.startsWith("@") ? `@${person.username}` : person.displayName || person.username;
    });
  }
}

function currentAppearanceRadius(kind: "pfp" | "media"): string {
  const advanced = (document.getElementById("visualMediaAdvanced") as HTMLInputElement | null)?.checked;
  if(advanced) return `${(Number((document.getElementById(kind === "pfp" ? "visualPfpRounding" : "visualMediaRounding") as HTMLInputElement | null)?.value) || 0) / 2}%`;
  if(kind === "media") return (document.getElementById("visualSquareMedia") as HTMLInputElement | null)?.checked ? "0" : "7px";
  const shape = (document.getElementById("visualPfpShape") as HTMLSelectElement | null)?.value;
  return shape === "square" ? "0" : shape === "circle" ? "50%" : "5px";
}

type PreviewContext = { optionValue?: string; colorControl?: string };
type PreviewDefinition = { selector: string; render: (target: HTMLElement, tooltip: HTMLElement, context?: PreviewContext) => void };

/** Reusable preview registry: settings opt in without duplicating tooltip behavior. */
const previews: PreviewDefinition[] = [
  { selector: "#visualPfpRounding, #visualMediaRounding, #visualQuoteSpacing, #visualPfpShape, #visualMaxMediaHeight, #visualSquareMedia, #visualQuoteMediaGap, #visualPfpFeed, #visualPfpNotifications, #visualPfpChat, #visualNotificationUnreadTint", render: appendAvatarLocationPreview },
  { selector: "#visualTweetPngBorderPalette, #visualTweetPngBackgroundColor, #visualTweetPngFontColor, #visualTweetPngIncludeImages, #visualTweetPngIncludeQuoteText, #visualTweetPngIncludeQuoteImages, #visualTweetPngShrinkTallImages, #visualTweetPngIncludeDate, #visualTweetPngIncludeStats, #visualTweetPngBorder", render: appendExportColorPreview },
  { selector: "#visualInterfaceAccentColor, #visualUseRemiliaProfileColor, #visualBackgroundFade, #visualHideMessageRequestDot, #visualPostButtonClickly, #visualSidebarBevel, #visualNewPostsPill, #visualAppWindowStyle, #visualAppShadows", render: appendInterfacePreview },
  { selector: '[data-control="remistats.icons.enabled"], [data-control="remistats.icons.score"], [data-control="remistats.icons.beetle"], [data-control="remistats.icons.poke"], #visualRemistatsBox, #visualPokePlacement', render: appendStatsPreview },
];

export function setupSettingsPreviews(): void {
  setPreviewProfile(null);
  for(const preview of previews) for(const control of document.querySelectorAll(preview.selector)) {
    const target = control.closest(".field, .setting");
    if(!target || target.querySelector("small")) continue;
    const help = document.createElement("small");
    help.textContent = "Preview with your current settings.";
    (target.querySelector("span") ?? target).append(help);
  }
}

export function appendSettingsPreview(target: HTMLElement, tooltip: HTMLElement, context: PreviewContext = {}): void {
  const preview = previews.find(item => target.matches(item.selector) || target.querySelector(item.selector));
  preview?.render(target, tooltip, context);
  personalize(tooltip);
}

function enabled(id: string): boolean {
  return (document.getElementById(id) as HTMLInputElement | null)?.checked ?? false;
}

function selected(id: string): string {
  return (document.getElementById(id) as HTMLSelectElement | null)?.value ?? "";
}

/** Post text is illustrative; identities come from the narrow connector projection. */
function example(tooltip: HTMLElement, title: string, markup: string): HTMLElement {
  const preview = document.createElement("div");
  preview.className = "appearance-example";
  const scene = document.createElement("div");
  scene.className = "appearance-example-scene";
  scene.innerHTML = markup;
  preview.setAttribute("aria-label", title);
  preview.append(scene);
  tooltip.append(preview);
  return scene;
}

function appendInterfacePreview(target: HTMLElement, tooltip: HTMLElement, context: PreviewContext = {}): void {
  const control = target.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
  if(!control) return;
  let scene: HTMLElement;
  switch(control.id) {
    case "visualInterfaceAccentColor":
      scene = example(tooltip, "Theme color", '<div class="preview-notification"><span>♥</span><div><b>Alex liked your post</b><br>A little inspiration for today ☀️</div></div><div class="preview-post-stats"><span class="preview-poke">Poke</span><span>Theme accent</span></div>');
      scene.style.setProperty("--accent", context.optionValue ?? control.value ?? "#1f6f5b");
      scene.style.setProperty("--accent-soft", `color-mix(in srgb, ${context.optionValue || control.value || "#1f6f5b"} 12%, var(--surface))`);
      scene.dataset.highlight = "true";
      break;
    case "visualUseRemiliaProfileColor":
    case "visualBackgroundFade":
      scene = example(tooltip, "X background", '<div class="preview-x-page"><div>For you · Following</div><div class="preview-x-paper"><b>Alex</b> @alex<br>A little inspiration for today ☀️</div></div>');
      scene.dataset.green = String(enabled("visualBackgroundFade"));
      const custom = (document.getElementById("visualInterfaceAccentColor") as HTMLInputElement)?.value || "";
      const profileColor = document.documentElement.dataset.remiliaProfileColor || "";
      const color = selected("visualProfile") === "max" ? (enabled("visualUseRemiliaProfileColor") ? profileColor : "") || custom : "";
      if(color && enabled("visualBackgroundFade")) scene.querySelector<HTMLElement>(".preview-x-page")!.style.background = `linear-gradient(135deg, color-mix(in srgb, ${color} 24%, var(--surface)), color-mix(in srgb, ${color} 8%, var(--surface)))`;
      break;
    case "visualNotificationUnreadTint":
      scene = example(tooltip, "Notifications", '<div class="preview-notification"><span>♥</span><div><b>Alex liked your post</b><br>A little inspiration for today ☀️</div></div><div class="preview-notification read"><span>↻</span><div><b>Jamie reposted your post</b><br>Earlier notification</div></div>');
      scene.dataset.highlight = String(enabled(control.id));
      break;
    case "visualHideMessageRequestDot":
      scene = example(tooltip, "Message requests", '<div class="preview-messages-label">✉ Messages <span class="preview-request-dot"></span><span class="preview-unread-badge">2</span></div>');
      scene.dataset.dot = String(enabled(control.id)); // Inverted control presents “show dot”.
      break;
    case "visualPostButtonClickly":
      scene = example(tooltip, "Post button", '<span class="preview-post-button">Post</span>');
      scene.dataset.pressed = String(enabled(control.id));
      break;
    case "visualNewPostsPill":
      scene = example(tooltip, "New posts", '<div class="preview-new-posts-bar"><span>Show 12 posts</span></div>');
      scene.dataset.rounded = String(enabled(control.id));
      break;
    case "visualSidebarBevel":
      scene = example(tooltip, "Sidebar", '<div class="preview-sidebar"><span>⌂ Home</span><span>⌕ Explore</span><span>♧ Notifications</span><span>✉ Messages</span></div>');
      scene.dataset.raised = String(enabled(control.id));
      break;
    default:
      scene = example(tooltip, "App window", '<div class="preview-app-window"><div class="preview-window-title"><b>Remilia chat</b><span>− □ ×</span></div><div class="preview-window-body">Alex<br><span>Hey, did you see this?</span></div></div>');
      scene.dataset.style = selected("visualAppWindowStyle");
      scene.dataset.shadow = String(enabled("visualAppShadows"));
  }
  scene.dataset.control = control.id;
}

function appendStatsPreview(_target: HTMLElement, tooltip: HTMLElement): void {
  const on = (key: string) => document.querySelector<HTMLInputElement>(`[data-control="remistats.icons.${key}"]`)?.checked ?? false;
  const scene = example(tooltip, "Post stats", '<div class="preview-stats-author"><b>Alex</b> @alex</div><div>A little inspiration for today ☀️</div>');
  const stats = document.createElement("div");
  stats.className = "preview-post-stats";
  stats.dataset.box = String(enabled("visualRemistatsBox"));
  if(on("enabled")) {
    if(on("score")) { const item = document.createElement("span"); item.textContent = "★ 42"; stats.append(item); }
    if(on("beetle")) { const item = document.createElement("span"); item.textContent = "♧ 8 beetles"; stats.append(item); }
    if(on("poke")) { const item = document.createElement("span"); item.className = "preview-poke"; item.textContent = "Poke"; stats.append(item); }
  }
  if(selected("visualPokePlacement") === "top") scene.prepend(stats);
  else scene.append(stats);
}

/** Local examples explain where the chosen picture shape is applied. */
function appendAvatarLocationPreview(target: HTMLElement, tooltip: HTMLElement, context: PreviewContext = {}): void {
  const control = target.querySelector<HTMLInputElement>("input[id], select:not(#visualMediaHeightPreset)");
  if(!control) return;
  if(control.id === "visualMaxMediaHeight") {
    appendMediaHeightPreview(tooltip);
    return;
  }
  const shape = (control.id === "visualPfpShape" ? context.optionValue : undefined) ?? (document.getElementById("visualPfpShape") as HTMLSelectElement | null)?.value ?? "circle";
  const squareMedia = (document.getElementById("visualSquareMedia") as HTMLInputElement | null)?.checked ?? false;
  const spacedQuotes = (document.getElementById("visualQuoteMediaGap") as HTMLInputElement | null)?.checked ?? false;
  const mediaLimit = Number((document.getElementById("visualMaxMediaHeight") as HTMLInputElement | null)?.value) || 0;
  const advanced = (document.getElementById("visualMediaAdvanced") as HTMLInputElement | null)?.checked ?? false;
  const intensity = (id: string) => Number((document.getElementById(id) as HTMLInputElement | null)?.value) || 0;
  const radius = advanced ? `${intensity("visualPfpRounding") / 2}%` : shape === "square" ? "0" : shape === "rounded-square" ? "5px" : "50%";
  const location = ["visualPfpNotifications", "visualNotificationUnreadTint"].includes(control.id) ? "notifications" : control.id === "visualPfpChat" ? "chat" : "feed";
  const shapeName = advanced ? `${intensity("visualPfpRounding")}% rounding` : shape === "square" ? "Square" : shape === "rounded-square" ? "Rounded square" : "Circle";
  const preview = document.createElement("div");
  preview.className = "avatar-location-preview";
  preview.dataset.location = location;
  preview.dataset.mediaCorners = squareMedia ? "square" : "rounded";
  preview.dataset.quoteSpacing = spacedQuotes ? "spaced" : "compact";
  preview.style.setProperty("--preview-media-radius", advanced ? `${intensity("visualMediaRounding") / 2}%` : squareMedia ? "0px" : "7px");
  preview.style.setProperty("--preview-quote-gap", advanced ? `${intensity("visualQuoteSpacing")}px` : spacedQuotes ? "8px" : "0px");
  // Scale the example media while honoring unusually small height limits.
  preview.style.setProperty("--preview-media-height", `${mediaLimit > 0 ? Math.min(200, mediaLimit / 2) : 200}px`);
  preview.setAttribute("aria-label", location === "feed" ? "Feed post" : location === "notifications" ? "Notification" : "Chat message");
  const comparisons = document.createElement("div");
  comparisons.className = "avatar-preview-comparisons";
  comparisons.append(createAvatarLocationScene(control, location, radius, shapeName));
  preview.append(comparisons);
  const pictureShapePreview = ["visualPfpRounding", "visualPfpShape", "visualPfpFeed", "visualPfpNotifications", "visualPfpChat"].includes(control.id);
  if(pictureShapePreview) tooltip.replaceChildren(preview);
  else tooltip.append(preview);
}

/** A 2× portrait demonstration makes every supported height cap visible without changing NFT artwork. */
function appendMediaHeightPreview(tooltip: HTMLElement): void {
  const limit = Math.max(0, Number(selected("visualMaxMediaHeight")) || 0);
  const sourceHeight = 1600;
  const previewScale = 0.125;
  const displayedHeight = Math.min(sourceHeight, limit || sourceHeight);
  const preview = document.createElement("div");
  preview.className = "appearance-example media-height-preview";
  preview.dataset.limit = String(limit);
  preview.dataset.sourceHeight = String(sourceHeight);
  const media = document.createElement("div");
  media.className = "avatar-preview-post-art";
  media.style.cssText = `width:${displayedHeight * 0.75 * previewScale}px;height:${displayedHeight * previewScale}px;border-radius:${currentAppearanceRadius("media")}`;
  nftImage(media, 1, true);
  const caption = document.createElement("span");
  caption.className = "avatar-preview-note";
  caption.textContent = `${limit ? `${limit}px limit` : "None"} · 2× upscaled example`;
  preview.append(media, caption);
  tooltip.append(preview);
}

/** A synthetic exported post uses the same palette as the export renderer. */
function appendExportColorPreview(target: HTMLElement, tooltip: HTMLElement, context: PreviewContext = {}): void {
  const control = document.getElementById("visualTweetPngBorderPalette") as HTMLSelectElement | null;
  if(!control) return;
  const value = context.optionValue && (!context.colorControl || context.colorControl === control.id) ? context.optionValue : control.value;
  const [border, media, quote] = /^#[0-9a-f]{6}$/i.test(value) ? [value, value, value] : EXPORT_PREVIEW_PALETTES[value] ?? EXPORT_PREVIEW_PALETTES.purple;
  const checked = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.checked ?? false;
  const preview = document.createElement("div");
  preview.className = "export-color-preview";
  preview.dataset.palette = value;
  preview.setAttribute("aria-label", `Exported post · ${value}${checked("visualTweetPngBorder") ? "" : " · Border off"}`);
  const post = document.createElement("div");
  post.className = "export-preview-post";
  post.style.setProperty("--export-preview-border", border);
  post.style.setProperty("--export-preview-media", media);
  post.style.setProperty("--export-preview-quote", quote);
  post.style.backgroundColor = context.colorControl === "visualTweetPngBackgroundColor" ? context.optionValue! : (document.getElementById("visualTweetPngBackgroundColor") as HTMLInputElement | null)?.value || control.dataset.background || "#fffaff";
  post.style.color = context.colorControl === "visualTweetPngFontColor" ? context.optionValue! : (document.getElementById("visualTweetPngFontColor") as HTMLInputElement | null)?.value || control.dataset.textColor || "#20122f";
  post.dataset.border = String(checked("visualTweetPngBorder"));
  post.dataset.shrink = String(checked("visualTweetPngShrinkTallImages"));
  post.innerHTML = '<div class="export-preview-author"><b>Alex</b><span>@alex</span></div><div class="export-preview-copy">A little inspiration for today ☀️</div>';
  if(checked("visualTweetPngIncludeImages")) {
    const image = document.createElement("div");
    image.className = "export-preview-image";
    nftImage(image, 1);
    post.append(image);
  }
  if(checked("visualTweetPngIncludeQuoteText")) {
    const quoted = document.createElement("div");
    quoted.className = "export-preview-quote";
    quoted.innerHTML = '<b>Jamie</b> <span>@jamie</span><div>Keeping a little sunshine in the feed.</div>';
    if(checked("visualTweetPngIncludeQuoteImages")) {
      const image = document.createElement("div");
      image.className = "export-preview-image";
      nftImage(image, 2);
      quoted.append(image);
    }
    post.append(quoted);
  }
  if(checked("visualTweetPngIncludeStats")) {
    const stats = document.createElement("div");
    stats.className = "export-preview-stats";
    stats.textContent = "★ 42 · 8 beetles";
    post.append(stats);
  }
  const reference = document.createElement("div");
  reference.className = "export-preview-reference";
  reference.textContent = checked("visualTweetPngIncludeDate") ? "Oct 5, 2026" : `x.com/${profile.account.username}/status/…`;
  post.append(reference);
  for(const [author, person] of [[post.querySelector(".export-preview-author"), profile.account], [post.querySelector(".export-preview-quote"), friend()]] as const) {
    if(!author) continue;
    const avatar = document.createElement("span"); avatar.className = "preview-identity-picture";
    avatar.style.borderRadius = currentAppearanceRadius("pfp");
    picture(avatar, person); author.prepend(avatar);
  }
  preview.append(post);
  tooltip.append(preview);
}

function createAvatarLocationScene(control: HTMLInputElement, location: string, radius: string, shapeName: string): HTMLElement {
  const example = document.createElement("div");
  example.className = "avatar-preview-example";
  example.dataset.current = "true";
  const scene = document.createElement("div");
  scene.className = "avatar-preview-scene";
  const avatar = document.createElement("span");
  avatar.className = "avatar-preview-picture";
  avatar.style.borderRadius = radius;
  avatar.setAttribute("aria-label", shapeName);
  // Local placeholder is replaced by the connector picture below.
  avatar.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#809eb4" d="M0 0h32v32H0z"/><path fill="#486b85" d="m0 26 10-12 8 9 6-7 8 10v6H0z"/><circle cx="23" cy="8" r="4" fill="#f9df9b"/></svg>';
  const person = location === "feed" ? profile.account : friend();
  picture(avatar, person);
  const content = document.createElement("div");
  content.className = "avatar-preview-content";
  const name = document.createElement("strong");
  name.dataset.previewPerson = "true";
  name.textContent = person.displayName || person.username;
  const meta = document.createElement("span");
  meta.className = "avatar-preview-meta";
  meta.dataset.previewPerson = "true";
  meta.textContent = `@${person.username}${location === "feed" ? " · 2h" : ""}`;
  const line = document.createElement("span");
  line.className = "avatar-preview-copy";
  line.textContent = location === "feed" ? "A little inspiration for today ☀️" : location === "notifications" ? "liked your post" : "Hey, did you see this?";
  const chrome = document.createElement("div");
  chrome.className = "avatar-preview-x-header";
  chrome.innerHTML = location === "feed"
    ? '<span class="selected">For you</span><span>Following</span>'
    : location === "notifications" ? '<span class="selected">All</span><span>Mentions</span>'
      : '<span aria-hidden="true">←</span><strong>Messages</strong><span aria-hidden="true">⋯</span>';
  content.append(name, meta);
  if(location !== "notifications") content.append(line);
  scene.append(avatar);
  if(location !== "notifications") scene.append(content);
  const details = document.createElement("div");
  details.className = "avatar-preview-x-details";
  if(location === "feed") {
    details.innerHTML = '<div class="avatar-preview-post-art" aria-label="Example post image"></div><div class="avatar-preview-quote"><b>Jamie</b> <span>@jamie · 3h</span><div>Keeping a little sunshine in the feed.</div></div><div class="avatar-preview-post-actions" aria-hidden="true"><span>♡ 12</span><span>↻ 3</span><span>▥ 124</span><span>↗</span></div>';
  } else if(location === "notifications") {
    const heart = document.createElement("span");
    heart.className = "avatar-preview-like";
    heart.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.697 3.5c-1.9 0-3.6.9-4.697 2.3C10.903 4.4 9.203 3.5 7.303 3.5 3.873 3.5 1.25 6.11 1.25 9.53c0 4.56 5.19 8.99 10.2 11.63a1.2 1.2 0 0 0 1.1 0c5.01-2.64 10.2-7.07 10.2-11.63 0-3.42-2.623-6.03-6.053-6.03Z"/></svg>';
    heart.setAttribute("aria-hidden", "true");
    scene.prepend(heart);
    scene.dataset.highlight = String(enabled("visualNotificationUnreadTint"));
    details.innerHTML = '<div class="avatar-preview-notification-action"><b>Alex</b> liked your post <span class="avatar-preview-notification-time">· 7h</span></div><div class="avatar-preview-post-excerpt">A little inspiration for today ☀️</div>';
  } else {
    details.innerHTML = '<div class="avatar-preview-post-art" aria-label="Example message image"></div><div class="avatar-preview-reply">Yes! Looks great.</div><div class="avatar-preview-message-time">2:41 PM · Seen</div>';
  }
  const showsMedia = ["visualMaxMediaHeight", "visualMediaRounding", "visualQuoteSpacing", "visualSquareMedia", "visualQuoteMediaGap"].includes(control.id);
  const showsQuote = ["visualMediaRounding", "visualQuoteSpacing", "visualSquareMedia", "visualQuoteMediaGap"].includes(control.id);
  if(!showsMedia) details.querySelector(".avatar-preview-post-art")?.remove();
  if(!showsQuote) details.querySelector(".avatar-preview-quote")?.remove();
  details.querySelector(".avatar-preview-post-actions")?.remove();
  details.querySelectorAll<HTMLElement>(".avatar-preview-post-art").forEach(image => nftImage(image));
  if(location === "notifications") {
    const author = details.querySelector("b")!; author.dataset.previewPerson = "true"; author.textContent = person.displayName || person.username;
  }
  if(details.querySelector(".avatar-preview-quote")) {
    const quotedAvatar = document.createElement("span");
    quotedAvatar.className = "preview-identity-picture";
    quotedAvatar.style.borderRadius = radius;
    picture(quotedAvatar, friend());
    details.querySelector(".avatar-preview-quote")?.prepend(quotedAvatar);
  }
  if(location === "notifications") scene.append(details);
  example.append(chrome, scene);
  if(location !== "notifications") example.append(details);
  return example;
}
