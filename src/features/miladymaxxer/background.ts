// Service worker for badge updates and notifications
import { registerBackgroundMessageHandlers } from "../../shared/backgroundRouter";
import { browserAction } from "../../shared/browserAction";

type MiladyBadgeMessage = {
  type: "milady:badge";
  count: number;
};

type MiladyLevelUpMessage = {
  type: "milady:levelup";
  level: number;
};

registerBackgroundMessageHandlers([
  {
    type: "milady:badge",
    matches: isMiladyBadgeMessage,
    handle: (message) => {
      const text = message.count > 0 ? String(message.count) : "";
      void browserAction.setBadgeText({ text });
      void browserAction.setBadgeBackgroundColor({ color: "#2f4d0c" });
      void browserAction.setBadgeTextColor?.({ color: "#f4ffee" });
      return { ok: true };
    },
  },
  {
    type: "milady:levelup",
    matches: isMiladyLevelUpMessage,
    handle: (message) => {
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

function isMiladyBadgeMessage(message: unknown): message is MiladyBadgeMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milady:badge" && typeof record.count === "number";
}

function isMiladyLevelUpMessage(message: unknown): message is MiladyLevelUpMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milady:levelup" && typeof record.level === "number";
}
