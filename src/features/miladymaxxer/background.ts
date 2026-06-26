// Service worker for badge updates and notifications
import { browserAction } from "../../shared/browserAction";

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "milady:badge" && typeof message.count === "number") {
    const text = message.count > 0 ? String(message.count) : "";
    browserAction.setBadgeText({ text });
    browserAction.setBadgeBackgroundColor({ color: "#2f4d0c" });
    browserAction.setBadgeTextColor({ color: "#f4ffee" });
  }
  if (message.type === "milady:levelup" && typeof message.level === "number") {
    chrome.notifications.create(`milady-levelup-${Date.now()}`, {
      type: "basic",
      iconUrl: "milady-logo.png",
      title: "Milady Level Up!",
      message: `You reached Level ${message.level}`,
      priority: 1,
    });
  }
});
