// Service worker for Maxxer notifications.
import { registerBackgroundMessageHandlers } from "../../shared/backgroundRouter";

type MiladyLevelUpMessage = {
  type: "milady:levelup";
  level: number;
};

registerBackgroundMessageHandlers([
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

function isMiladyLevelUpMessage(message: unknown): message is MiladyLevelUpMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milady:levelup" && typeof record.level === "number";
}
