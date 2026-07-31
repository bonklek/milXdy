import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  extractTweetPngCashtag,
  extractTweetPngMedia,
  findTweetPngQuoteElement,
  measureTweetPngQuoteHeight,
  normalizeVisualTheme,
  setTweetPngSettingsOpen,
  tweetPngPalette,
  tweetPngMediaRemovalKey,
  tweetPngVisibleLineCount,
} from "../../examples/packages/first-party-replacements/tweetPng/src/content";

describe("Share Kit package compatibility", () => {
  const packageSource = readFileSync("examples/packages/first-party-replacements/tweetPng/src/content.ts", "utf8");
  const packageManifest = readFileSync("examples/packages/first-party-replacements/tweetPng/milxdy.app.json", "utf8");
  const packageIcon = readFileSync("examples/packages/first-party-replacements/tweetPng/assets/tweet-png-icon.svg", "utf8");
  const runtimeSource = readFileSync("src/platform/runtime/content-runtime.ts", "utf8");
  const chatSource = readFileSync("src/apps/reminet-chat/content.ts", "utf8");
  const backgroundSource = readFileSync("src/extension/background/index.ts", "utf8");

  it("retains legacy Tweet PNG booleans and normalizes new color defaults", () => {
    const settings = normalizeVisualTheme({
      tweetPngIncludeImages: false,
      tweetPngIncludeQuoteText: false,
      tweetPngIncludeQuoteImages: true,
      tweetPngIncludeWatermark: false,
      tweetPngBackgroundColor: "#ABCDEF",
      tweetPngFontColor: "invalid",
    });
    expect(settings.tweetPngIncludeImages).toBe(false);
    expect(settings.tweetPngIncludeQuoteText).toBe(false);
    expect(settings.tweetPngIncludeQuoteImages).toBe(true);
    expect(settings.tweetPngIncludeWatermark).toBe(false);
    expect(settings.tweetPngBackgroundColor).toBe("#abcdef");
    expect(settings.tweetPngFontColor).toBe("#20122f");
  });

  it("defaults the watermark on and exposes a live popout toggle", () => {
    expect(normalizeVisualTheme({}).tweetPngIncludeWatermark).toBe(true);
    expect(packageSource).toContain('data-setting="tweetPngIncludeWatermark"');
    expect(packageSource).toContain("> Include milXdy watermark</label>");
    expect(packageSource).toContain('context.fillText("milXdy", width - 38, height - 8)');
    expect(packageSource).toContain("if (visualTheme.tweetPngIncludeWatermark) drawTweetPngWatermark");
  });

  it("themes nested QRT/media cards from the selected export background", () => {
    expect(tweetPngPalette("purple", "#000000")).toMatchObject({
      quoteFill: "#000000",
      mediaFill: "#000000",
      quoteBorder: "#d5b7ff",
    });
    expect(packageSource).toContain("const quoteTextColor = visualTheme.tweetPngFontColor");
    expect(tweetPngPalette("blue", "#15202b")).toMatchObject({
      quoteFill: "#15202b",
      mediaFill: "#15202b",
      quoteBorder: "#a8cef5",
    });
  });

  it("opens and closes settings with synchronized accessible state", () => {
    const settings = { hidden: true };
    const attributes = new Map<string, string>();
    const button = { setAttribute: (name: string, value: string) => attributes.set(name, value) };
    setTweetPngSettingsOpen(settings, button, true);
    expect(settings.hidden).toBe(false);
    expect(attributes.get("aria-expanded")).toBe("true");
    setTweetPngSettingsOpen(settings, button, false);
    expect(settings.hidden).toBe(true);
    expect(attributes.get("aria-expanded")).toBe("false");
    expect(packageSource).toContain('target?.closest(\'[data-action="settings"]\')');
    expect(packageSource).toContain('}, true);');
  });

  it("marks video posters for a play overlay while preserving ordinary images", () => {
    const photo = { currentSrc: "", src: "https://pbs.twimg.com/media/photo.jpg", closest: () => null } as unknown as HTMLImageElement;
    const video = { poster: "https://pbs.twimg.com/amplify_video_thumb/video.jpg", closest: () => null } as unknown as HTMLVideoElement;
    const post = {
      querySelectorAll(selector: string) {
        if (selector === '[data-testid="tweetPhoto"] img') return [photo];
        if (selector === "video[poster]") return [video];
        return [];
      },
    } as unknown as HTMLElement;
    expect(extractTweetPngMedia(post)).toEqual([
      { src: "https://pbs.twimg.com/media/photo.jpg", isVideo: false },
      { src: "https://pbs.twimg.com/amplify_video_thumb/video.jpg", isVideo: true },
    ]);
  });

  it("updates color previews and swaps explicit RemiNet recovery for local chat staging", () => {
    expect(packageSource).toContain('input.type === "color" ? "input" : "change"');
    expect(packageSource).toMatch(/data-action="reconnect"[^>]*>Reconnect<\/button>/u);
    expect(packageSource).toMatch(/data-action="refresh"[^>]*>Refresh<\/button>/u);
    expect(packageSource).toMatch(/data-action="reminet"[^>]*hidden>Share to RemiNet<\/button>/u);
    expect(packageSource).toContain("probeRemiNetConnection()");
    expect(packageSource).toContain("openRemiNetSession()");
    expect(packageSource).toContain("stageRemiNetChatPng({");
    expect(packageSource).toContain("setRemiNetConnected(connected)");
    expect(runtimeSource).toContain("probeRemiNetConnection: async");
    expect(runtimeSource).toContain('type: "reminetChat:authStatus"');
    expect(runtimeSource).toContain("stageRemiNetChatPng: async");
    expect(runtimeSource).toContain('loadApp(chat, "userAction:stageRemiNetChatPng")');
    expect(packageSource).not.toContain("window.location.reload()");
    expect(packageSource).not.toContain('href="https://www.remilia.net/"');
  });

  it("keeps RemiNet staging local and constrains reconnect to a fixed inactive tab", () => {
    const stageStart = chatSource.indexOf("export async function stageLocalAttachment");
    const stageEnd = chatSource.indexOf("\nexport function close", stageStart);
    const stageSource = chatSource.slice(stageStart, stageEnd);
    expect(stageStart).toBeGreaterThan(-1);
    expect(stageSource).toContain('status: "ready"');
    expect(stageSource).toContain("fileToDataUrl(file)");
    expect(stageSource).not.toContain("uploadPendingAttachments");
    expect(stageSource).not.toContain("runtimeSendMessage");
    expect(backgroundSource).toContain("if (!isXContentScriptSender(sender)) return unsupportedSender()");
    expect(backgroundSource).toContain('chrome.tabs.create({ url: "https://www.remilia.net/", active: false })');
    expect(runtimeSource).toContain('blob.type !== "image/png"');
    expect(runtimeSource).toContain("blob.size > 10 * 1024 * 1024");
  });

  it("labels the contextual action Share as PNG", () => {
    expect(JSON.parse(packageManifest).contextualPostActions).toEqual([
      expect.objectContaining({ id: "reviewPng", label: "Share as PNG" }),
    ]);
  });

  it("uses the standard picture glyph from the legacy share action", () => {
    expect(packageIcon).toContain('viewBox="0 0 24 24"');
    expect(packageIcon).toContain("M6.75 16.75 10.2 13.3");
    expect(packageIcon).toContain('<circle cx="8.4" cy="8.4"');
    expect(packageIcon).not.toContain('<rect width="64"');
  });

  it("keeps every text baseline that fits before the portrait cap", () => {
    expect(tweetPngVisibleLineCount(182, 278, 48)).toBe(3);
    expect(tweetPngVisibleLineCount(182, 181, 48)).toBe(0);
    expect(packageSource).toContain("TWEET_PNG_MAX_ASPECT_RATIO = 2.25");
  });

  it("extracts the local vector and labels from a cashtag attachment", () => {
    const leaf = (text: string) => ({
      textContent: text,
      querySelector: () => null,
    });
    const chart = {
      outerHTML: '<svg width="476" height="170" viewBox="0 0 476 170"><path d="M0 10 L476 0"/></svg>',
      getAttribute: (name: string) => name === "viewBox" ? "0 0 476 170" : null,
    };
    const card = {
      querySelectorAll(selector: string) {
        if (selector === "span") return [
          leaf("Ethereum"),
          leaf("ETH · Crypto"),
          leaf("$1,924.02"),
          leaf("$297.66 (+18.30%)"),
          leaf("Jul 29 at 2:07 PM · 1M"),
          leaf("$1,918.39"),
        ];
        if (selector === "svg") return [chart];
        return [];
      },
      querySelector(selector: string) {
        return selector === "img" ? { currentSrc: "", src: "https://abs.twimg.com/ethereum.png" } : null;
      },
    };
    const navigation = {
      closest: () => null,
      querySelector: () => card,
    };
    const post = {
      querySelectorAll: () => [navigation],
    } as unknown as HTMLElement;

    expect(extractTweetPngCashtag(post)).toMatchObject({
      name: "Ethereum",
      market: "ETH · Crypto",
      price: "$1,924.02",
      change: "$297.66 (+18.30%)",
      timestamp: "Jul 29 at 2:07 PM · 1M",
      currentPrice: "$1,918.39",
      iconUrl: "https://abs.twimg.com/ethereum.png",
    });
    expect(extractTweetPngCashtag(post)?.chartUrl).toContain(encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"'));
  });

  it("selects the enclosing QRT card instead of its nested photo link", () => {
    let post: HTMLElement;
    const quoteCard = {
      querySelector: (selector: string) => selector === '[data-testid="User-Name"]' ? {} : null,
    } as unknown as HTMLElement;
    const mainText = {
      closest: (selector: string) => selector === 'article[data-testid="tweet"]' ? post : null,
    } as unknown as HTMLElement;
    const quoteText = {
      closest: (selector: string) => {
        if (selector === 'article[data-testid="tweet"]') return post;
        if (selector === 'div[role="link"], a[href*="/status/"]') return quoteCard;
        return null;
      },
    } as unknown as HTMLElement;
    const photoLink = {
      href: "https://x.com/John_Hudson/status/2082852180977999924/photo/1",
      closest: () => post,
      querySelector: () => ({}),
    } as unknown as HTMLElement;
    post = {
      matches: (selector: string) => selector === 'article[data-testid="tweet"]',
      querySelector: () => null,
      querySelectorAll(selector: string) {
        if (selector === '[data-testid="tweetText"]') return [mainText, quoteText];
        if (selector === 'div[role="link"]') return [quoteCard];
        if (selector === 'a[href*="/status/"]') return [photoLink];
        return [];
      },
    } as unknown as HTMLElement;

    expect(findTweetPngQuoteElement(post, "https://x.com/dnlklr/status/2082893132304392245")).toBe(quoteCard);
  });

  it("offers an accessible per-image removal control for post and QRT media", () => {
    expect(tweetPngMediaRemovalKey("post", "https://pbs.twimg.com/media/image.jpg"))
      .toBe("post:https://pbs.twimg.com/media/image.jpg");
    expect(tweetPngMediaRemovalKey("quote", "https://pbs.twimg.com/media/image.jpg"))
      .toBe("quote:https://pbs.twimg.com/media/image.jpg");
    expect(packageSource).toContain('className = "milxdy-tweet-png-remove-media"');
    expect(packageSource).toContain('remove.style.left = `${((region.x + region.width) / nextResult.width) * 100}%`');
    expect(packageSource).toContain('remove.setAttribute("aria-label", label)');
    expect(packageSource).not.toContain("milxdy-tweet-png-media-review");
    expect(packageSource).toContain("excludedMedia.add(key)");
    expect(packageSource).toContain('updatePreview("Image removed from this PNG.")');
  });

  it("allocates QRT text space", () => {
    expect(measureTweetPngQuoteHeight(1, 0)).toBe(130);
    expect(measureTweetPngQuoteHeight(2, 300)).toBe(482);
  });
});
