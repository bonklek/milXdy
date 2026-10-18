export function contentEntryPoints(source, appEnabled) {
  return {
    content: source("src/extension/content/index.ts"),
    background: source("src/extension/background/index.ts"),
    catalogBridge: source("src/extension/catalog-bridge.ts"),
    popup: source("src/extension/popup/index.ts"),
    ...(appEnabled("post-reading") ? { postReadingAudioConversion: source("src/apps/post-reading/audio-conversion-entry.ts") } : {}),
    wikiFrame: source("src/extension/frames/wiki-frame.ts"),
    reminetChatBridge: source("src/extension/frames/reminet-chat-bridge.ts"),
    reminetCraftFastPath: source("src/extension/frames/reminet-craft-fast-path.ts"),
  };
}
