// Service worker for badge updates and notifications

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "milady:badge" && typeof message.count === "number") {
    const text = message.count > 0 ? String(message.count) : "";
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: "#2f4d0c" });
    chrome.action.setBadgeTextColor({ color: "#f4ffee" });
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
