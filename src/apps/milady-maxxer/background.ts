// Service worker for Maxxer notifications.
import { registerBackgroundMessageHandlers } from "../../platform/background/router";

type MiladyLevelUpMessage = {
  type: "milady:levelup";
  level: number;
};

registerBackgroundMessageHandlers([
  {
    type: "milady:levelup",
    matches: isMiladyLevelUpMessage,
    handle: (message, sender) => {
      if (!isMiladyLevelUpSender(sender)) return { ok: false, error: "UNSUPPORTED_SENDER" };
      void chrome.notifications.create(`milady-levelup-${Date.now()}`, {
        type: "basic",
        iconUrl: "milady-logo.png",
        title: "Milady Level Up!",
        message: `You reached Level ${message.level}`,
        priority: 1,
      });
      return { ok: true };
    },
  },
]);

function isMiladyLevelUpMessage(message: unknown): message is MiladyLevelUpMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milady:levelup" && typeof record.level === "number";
}

function isMiladyLevelUpSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id) return false;
  if (typeof sender.tab?.id !== "number") return false;
  if (sender.frameId !== undefined && sender.frameId !== 0) return false;
  const source = sender.url || sender.origin || sender.tab.url || "";
  try {
    const url = new URL(source);
    return url.protocol === "https:" && (url.hostname === "x.com" || url.hostname === "twitter.com");
  } catch {
    return false;
  }
}
