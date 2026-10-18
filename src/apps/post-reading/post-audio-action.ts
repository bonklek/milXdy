import type { MilxdyContextualPostActionContext } from "../../platform/app-sdk/app-platform";
import type { PostReadingSettings } from "./shared/types";
import { extractPostConversionSource, openAudioConversion, type ExportMessenger } from "./audio-conversion";

export function reviewPostAudio(
  context: Pick<MilxdyContextualPostActionContext, "actionId" | "post" | "statusUrl" | "signal">,
  settings: PostReadingSettings,
  sendMessage: ExportMessenger,
): (() => void) | null {
  if (context.actionId !== "reviewMp3" || context.signal.aborted || !context.post.isConnected) return null;
  if (!["tweet", "twitterArticleReadView"].includes(context.post.dataset.testid || "")) return null;
  if (context.statusUrl) {
    const ownLink = Array.from(context.post.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'))
      .find(link => !link.closest('[data-testid="quoteTweet"]') && link.closest('article[data-testid="tweet"]') === context.post);
    if (!ownLink || new URL(ownLink.href).pathname !== new URL(context.statusUrl).pathname) throw new Error("This post changed. Reopen its Share menu to review audio.");
  }
  const source = extractPostConversionSource(context.post, context.statusUrl || window.location.href);
  if (!source) throw new Error("No visible readable text is available for this post.");
  const closePanel = openAudioConversion(source, settings, sendMessage);
  const close = () => {
    context.signal.removeEventListener("abort", close);
    closePanel();
  };
  context.signal.addEventListener("abort", close, { once: true });
  return close;
}
