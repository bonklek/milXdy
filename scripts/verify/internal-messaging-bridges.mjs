import { readFile } from "node:fs/promises";

const files = {
  background: await readFile("src/extension/background/index.ts", "utf8"),
  postReadingBackground: await readFile("src/apps/post-reading/background.ts", "utf8"),
  postReadingUrlPolicy: await readFile("src/apps/post-reading/urlPolicy.ts", "utf8"),
  postReadingOcr: await readFile("src/apps/post-reading/ocr.ts", "utf8"),
  postReadingOcrHost: await readFile("src/extension/frames/ocr-host.ts", "utf8"),
  reminetChatBackground: await readFile("src/apps/reminet-chat/background.ts", "utf8"),
  reminetChatBridge: await readFile("src/extension/frames/reminet-chat-bridge.ts", "utf8"),
  reminetCraftFastPath: await readFile("src/extension/frames/reminet-craft-fast-path.ts", "utf8"),
  extensionManifest: await readFile("assets/extension/manifest.json", "utf8"),
  beetolBackground: await readFile("src/apps/beetol/background.js", "utf8"),
  beetolContent: await readFile("src/apps/beetol/content.js", "utf8"),
  miladyMaxxerBackground: await readFile("src/apps/milady-maxxer/background.ts", "utf8"),
  appSdkDocs: await readFile("docs/APP_SDK.md", "utf8"),
};

const failures = [];

verifyReminetChatSocketBridge();
verifyReminetChatRuntimeBridge();
verifyReminetUploadCaps();
verifyBeetolRuntimeBridge();
verifyPostReadingOcrBridge();
verifyPostReadingFetchCaps();
verifyWikiSidebarFrameBridge();
verifyCentralRoutedBridgePolicies();
verifyMiladyLevelUpSender();
verifyDocsContract();

if (failures.length > 0) {
  console.error(`Internal messaging bridge verification failed: ${failures.length}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("Internal messaging bridge verification passed.");

function verifyReminetChatSocketBridge() {
  const onConnect = functionBody(files.reminetChatBackground, "chrome.runtime.onConnect.addListener");
  const senderPolicy = functionBody(files.reminetChatBackground, "isReminetChatSocketSender");
  const registerSiteBridge = functionBody(files.reminetChatBackground, "registerSiteSocketBridge");
  const bridge = files.reminetChatBridge;
  assertIncludes(onConnect, "if (port.name !== SOCKET_PORT_NAME) return;", "RemiNet socket bridge must ignore unrelated port names");
  assertIncludes(onConnect, "if (!isReminetChatSocketSender(port.sender))", "RemiNet socket bridge must validate sender before socket setup");
  assertIncludes(onConnect, "port.disconnect();", "RemiNet socket bridge must disconnect invalid senders");
  assertIncludes(onConnect, "postToSiteSocketBridge", "RemiNet socket clients must relay through the authenticated site bridge");
  assertNotIncludes(files.reminetChatBackground, "new WebSocket", "RemiNet background must not own the cross-site WebSocket");
  assertNotIncludes(files.reminetChatBackground, "chrome.tabs.create", "RemiNet socket recovery must not open hidden tabs");
  assertNotIncludes(files.reminetChatBackground, "chrome.tabs.remove", "RemiNet socket recovery must not close tabs");

  assertIncludes(registerSiteBridge, 'isAllowedReminetChatSender(port.sender, ["www.remilia.net"])', "RemiNet site bridge must accept only RemiliaNET top-frame senders");
  assertIncludes(registerSiteBridge, 'startsWith("socket:")', "RemiNet site bridge must relay only socket events");
  assertIncludes(registerSiteBridge, "client.postMessage(record)", "RemiNet site bridge must broadcast live frames to connected chat clients");

  assertIncludes(bridge, 'chrome.runtime.connect({ name: SOCKET_PORT_NAME })', "RemiNet site bridge must use its dedicated runtime port");
  assertIncludes(bridge, 'new WebSocket(SOCKET_URL)', "RemiNet live socket must be created in the RemiliaNET page context");
  assertIncludes(bridge, 'type: "subscribe"', "RemiNet live socket must subscribe after opening");
  assertIncludes(bridge, 'socket.send(JSON.stringify(record.payload))', "RemiNet site bridge must forward submitted chat payloads unchanged");
  assertIncludes(bridge, "nextPort.onDisconnect.addListener", "RemiNet site bridge must handle extension-port shutdown");
  assertIncludes(bridge, "reconnectTimer = setTimeout(connectPort", "RemiNet site bridge must reconnect after a background-worker restart");
  assertIncludes(bridge, "closeSocket();", "RemiNet site bridge must release its socket when the extension port closes");
  assertIncludes(files.extensionManifest, '"matches": ["https://www.remilia.net/*"]', "RemiNet site bridge must be injected only on RemiliaNET pages");
  assertIncludes(files.extensionManifest, '"js": ["reminetChatBridge.js"]', "RemiNet site bridge must be declared in the extension manifest");
  assertIncludes(files.extensionManifest, '"js": ["reminetCraftFastPath.js"]', "RemiNet crafting fast path must be declared in the extension manifest");
  assertIncludes(files.extensionManifest, '"world": "MAIN"', "RemiNet crafting fast path must run in the page world");
  assertIncludes(files.reminetCraftFastPath, "FAST_TIMEOUTS", "RemiNet crafting fast path must limit acceleration to known staged timers");
  assertIncludes(files.reminetCraftFastPath, "craftFastSubmissionIsActive", "RemiNet crafting fast path must gate acceleration to an active craft submission");

  const auth = files.reminetChatBackground;
  assertIncludes(auth, "socketAuthReadyUntil", "RemiNet socket setup must reuse a recent successful auth preparation");
  assertIncludes(auth, "socketAuthPromise", "RemiNet socket setup must share an in-flight auth preparation");
  assertIncludes(auth, "SOCKET_AUTH_TIMEOUT_MS", "RemiNet socket auth preparation must have a deadline");
  assertIncludes(auth, 'error: "AUTH_TIMEOUT"', "RemiNet socket auth timeout must return a typed recovery error");
  assertIncludes(auth, "await isRemiliaDisconnected()", "RemiNet socket auth cache must honor explicit connector logout before reuse");
  assertIncludes(auth, "socketAuthGeneration", "RemiNet socket auth must reject late results after logout or timeout");
  assertIncludes(auth, "generation !== socketAuthGeneration", "RemiNet socket auth must check request generation before caching credentials");
  assertIncludes(auth, "prepareRemiliaAuth(SESSION_PROBE_PATH, { signal: abort.signal })", "RemiNet socket auth timeout must cancel shared authentication work");
  assertIncludes(auth, "abort.abort(new DOMException", "RemiNet socket auth timeout must abort underlying authentication work");

  assertIncludes(senderPolicy, "isAllowedReminetChatSender(sender, [\"x.com\", \"twitter.com\"])", "RemiNet socket sender policy must restrict to X/Twitter hosts");
  verifySameExtensionTopFrameHttpsPolicy(functionBody(files.reminetChatBackground, "isAllowedReminetChatSender"), "RemiNet shared sender policy");
}

function verifyReminetChatRuntimeBridge() {
  const handler = functionBody(files.reminetChatBackground, "handleChatMessage");
  const senderPolicy = functionBody(files.reminetChatBackground, "isReminetChatMessageSender");
  assertIncludes(handler, "if (!isReminetChatMessageSender(sender))", "RemiNet runtime bridge must validate sender before authenticated operations");
  assertIncludes(handler, "UNSUPPORTED_SENDER", "RemiNet runtime bridge must fail closed for unsupported senders");
  assertOrder(handler, "if (!isReminetChatMessageSender(sender))", "if (message.type === \"reminetChat:authStatus\")", "RemiNet runtime bridge must validate sender before dispatch");
  assertIncludes(senderPolicy, "isAllowedReminetChatSender(sender, [\"x.com\", \"twitter.com\", \"www.remilia.net\"])", "RemiNet runtime sender policy must restrict to supported X/Twitter and RemiliaNET pages");
  verifySameExtensionTopFrameHttpsPolicy(functionBody(files.reminetChatBackground, "isAllowedReminetChatSender"), "RemiNet shared sender policy");
}

function verifyBeetolRuntimeBridge() {
  const handler = functionBody(files.beetolBackground, "handleBeetolMessage");
  const senderPolicy = functionBody(files.beetolBackground, "isBeetolMessageSender");
  const extensionPagePolicy = functionBody(files.beetolBackground, "isBeetolExtensionPageSender");
  const contentScriptPolicy = functionBody(files.beetolBackground, "isBeetolContentScriptSender");
  assertIncludes(handler, "if (!isBeetolMessageSender(message, sender))", "Beetol runtime bridge must validate sender before authenticated operations");
  assertIncludes(handler, "UNSUPPORTED_SENDER", "Beetol runtime bridge must fail closed for unsupported senders");
  assertOrder(handler, "if (!isBeetolMessageSender(message, sender))", "if (message?.type === 'beetol:logout')", "Beetol runtime bridge must validate sender before dispatch");
  assertIncludes(senderPolicy, "sender.id !== chrome.runtime.id", "Beetol sender policy must require same-extension sender id");
  assertIncludes(senderPolicy, "isBeetolExtensionPageSender(sender)", "Beetol sender policy must recognize popup/extension-page senders");
  assertIncludes(senderPolicy, "message?.type === 'beetol:authStatus'", "Beetol extension-page policy must allow popup auth status");
  assertIncludes(senderPolicy, "message?.type === 'beetol:sessionStatus'", "Beetol extension-page policy must allow popup session status");
  assertIncludes(senderPolicy, "message?.type === 'beetol:logout'", "Beetol extension-page policy must allow popup logout");
  assertIncludes(senderPolicy, "return isBeetolContentScriptSender(sender);", "Beetol sender policy must use a separate content-script policy for page actions");
  assertIncludes(extensionPagePolicy, "if (sender.tab) return false;", "Beetol extension-page policy must reject tab senders");
  assertIncludes(extensionPagePolicy, "chrome.runtime.getURL('')", "Beetol extension-page policy must compare against the packaged extension origin");
  verifySameExtensionTopFrameHttpsPolicy(contentScriptPolicy, "Beetol content-script sender policy", "'");
  assertIncludes(contentScriptPolicy, "url.hostname === 'x.com'", "Beetol content-script sender policy must allow supported X pages");
  assertIncludes(contentScriptPolicy, "url.hostname === 'twitter.com'", "Beetol content-script sender policy must allow supported Twitter pages");
  assertIncludes(contentScriptPolicy, "url.hostname === 'www.remilia.net'", "Beetol content-script sender policy must allow supported RemiliaNET pages");

  const action = functionBody(files.beetolBackground, "runAction");
  assertIncludes(action, "remiliaAuthedFetch('POST'", "Beetol actions must submit through the authenticated mutation path");
  assertIncludes(action, "getStored({ lastUser: null })", "Beetol actions may use the last snapshot for reward comparison without a blocking preflight GET");
  assertNotIncludes(action, "remiliaAuthedFetch('GET'", "Beetol actions must not spend their shared message deadline on a preflight state GET");
  assertNotIncludes(action, "await getState()", "Beetol actions must return the mutation result before trailing state reconciliation");
  assertIncludes(action, "needsRefresh: true", "Beetol action responses must request non-blocking state reconciliation");
  const reconciliation = functionBody(files.beetolContent, "reconcileStateAfterAction");
  assertIncludes(reconciliation, "type: 'beetol:getState'", "Beetol content must reconcile state after an action in a separate request");
  assertIncludes(files.beetolContent, "if (response.needsRefresh) void reconcileStateAfterAction()", "Beetol action UI must launch reconciliation without keeping the action pending");
}

function verifyPostReadingOcrBridge() {
  const handler = functionBody(files.postReadingBackground, "fetchPostReadingResource");
  const dispatchPolicy = functionBody(files.postReadingBackground, "isAllowedPostReadingSender");
  const xPolicy = functionBody(files.postReadingBackground, "isXContentScriptSender");
  const ocrPolicy = functionBody(files.postReadingBackground, "isPostReadingOcrFrameSender");

  assertIncludes(handler, "if (!isAllowedPostReadingSender(message, sender))", "post-reading bridge must validate sender before fetch");
  assertIncludes(handler, "UNSUPPORTED_SENDER", "post-reading bridge must return a distinct unsupported-sender failure");
  assertOrder(handler, "if (!isAllowedPostReadingSender(message, sender))", "runNetworkTask", "post-reading bridge must validate sender before any network task");
  assertIncludes(dispatchPolicy, "message.type === \"post-reading:fetchBlob\"", "post-reading sender policy must treat OCR blob fetches separately");
  assertIncludes(dispatchPolicy, "return isPostReadingOcrFrameSender(sender);", "post-reading OCR blob fetches must require OCR frame sender");
  assertIncludes(dispatchPolicy, "return isXContentScriptSender(sender);", "post-reading text/json fetches must require X/Twitter content sender");

  assertIncludes(xPolicy, "typeof sender.tab?.id !== \"number\"", "post-reading X sender policy must require tab context");
  assertIncludes(xPolicy, "sender.id !== chrome.runtime.id", "post-reading X sender policy must require same-extension sender id");
  assertIncludes(xPolicy, "sender.frameId !== undefined && sender.frameId !== 0", "post-reading X sender policy must reject non-top frames");
  assertIncludes(xPolicy, "sender.url || sender.origin || sender.tab.url", "post-reading X sender policy must inspect sender URL sources");
  assertIncludes(xPolicy, "url.protocol === \"https:\"", "post-reading X sender policy must require HTTPS");
  assertIncludes(xPolicy, "url.hostname === \"x.com\" || url.hostname === \"twitter.com\"", "post-reading X sender policy must restrict to X/Twitter hosts");
  assertIncludes(files.postReadingBackground, "MAX_JSON_RESPONSE_BYTES", "post-reading bridge must cap JSON response size");
  assertIncludes(files.postReadingBackground, "MAX_TEXT_RESPONSE_BYTES", "post-reading bridge must cap text response size");
  assertIncludes(files.postReadingBackground, "MAX_BLOB_RESPONSE_BYTES", "post-reading bridge must cap blob response size");
  assertIncludes(files.postReadingBackground, "isAllowedResponseContentType", "post-reading bridge must validate response content types");
  assertIncludes(files.postReadingBackground, "RESPONSE_TOO_LARGE", "post-reading bridge must reject oversized responses");
  assertIncludes(files.postReadingBackground, 'url.hostname === "publish.twitter.com"', "post-reading JSON bridge must allow the public oEmbed host");
  assertIncludes(files.postReadingBackground, "isAllowedPublishTwitterOembedUrl(url)", "post-reading JSON bridge must validate the public oEmbed endpoint");
  assertIncludes(files.postReadingUrlPolicy, 'url.pathname !== "/oembed"', "post-reading oEmbed policy must pin the public oEmbed path");
  assertIncludes(files.postReadingUrlPolicy, 'url.searchParams.get("url")', "post-reading oEmbed policy must inspect the nested status URL");
  assertIncludes(files.postReadingUrlPolicy, "normalizeXStatusUrl", "post-reading oEmbed policy must use host-strict X/Twitter status URL normalization");
  assertIncludes(files.postReadingBackground, 'normalized.startsWith("application/json") || normalized.startsWith("text/javascript")', "post-reading JSON bridge must require JSON-compatible content types");

  assertIncludes(ocrPolicy, "sender.id !== chrome.runtime.id", "post-reading OCR sender policy must require same-extension sender id");
  assertIncludes(ocrPolicy, "typeof sender.frameId !== \"number\" || sender.frameId <= 0", "post-reading OCR sender policy must require a non-top frame");
  assertIncludes(ocrPolicy, "chrome.runtime.getURL(\"ocr.html\")", "post-reading OCR sender policy must pin the packaged OCR frame URL");
  assertIncludes(ocrPolicy, "url.origin === ocrUrl.origin && url.pathname === ocrUrl.pathname", "post-reading OCR sender policy must match OCR frame origin and path");

  const ocrContent = files.postReadingOcr;
  const ocrHostListener = functionBody(files.postReadingOcrHost, "window.addEventListener");
  const ocrHostAuth = functionBody(files.postReadingOcrHost, "isAuthenticatedParentRequest");
  const ocrHostOrigin = functionBody(files.postReadingOcrHost, "isAllowedParentOrigin");
  assertIncludes(ocrContent, "hostFrameAuthTokens.set(frame, crypto.randomUUID())", "post-reading OCR content must mint a frame authentication token");
  assertIncludes(ocrContent, "type: \"post-reading-ocr-init\"", "post-reading OCR content must initialize host authentication");
  assertIncludes(ocrContent, "event.origin !== extensionOrigin()", "post-reading OCR content must validate extension-origin host responses");
  assertIncludes(ocrContent, "event.source !== frame.contentWindow", "post-reading OCR content must validate the OCR frame response source");
  assertIncludes(ocrContent, "event.data.id !== id", "post-reading OCR content must route OCR responses by request id");
  assertNotIncludes(ocrContent, "event.data.authToken === authToken", "post-reading OCR content must not require host responses to echo the parent auth token");
  assertIncludes(ocrHostListener, "event.source !== window.parent", "post-reading OCR host must accept messages only from its parent frame");
  assertIncludes(ocrHostListener, "isAuthenticatedParentRequest(event)", "post-reading OCR host must require authenticated parent requests");
  assertIncludes(ocrHostAuth, "event.origin === parentTargetOrigin", "post-reading OCR host must pin the initialized parent origin");
  assertIncludes(ocrHostAuth, "isAllowedParentOrigin(event.origin)", "post-reading OCR host must require an allowed parent origin");
  assertIncludes(ocrHostAuth, "event.data.authToken === parentAuthToken", "post-reading OCR host must require the content-issued authentication token");
  assertIncludes(ocrHostOrigin, "url.hostname === \"x.com\"", "post-reading OCR host must allow X parent origins");
  assertIncludes(ocrHostOrigin, "url.hostname === \"twitter.com\"", "post-reading OCR host must allow Twitter parent origins");
  assertIncludes(ocrHostOrigin, "url.hostname === \"wiki.remilia.org\"", "post-reading OCR host must allow Remilia Wiki parent origins");
  assertIncludes(files.postReadingOcrHost, "target.postMessage({ type: \"post-reading-ocr-result\", id: request.id, text:", "post-reading OCR host must return results without the parent auth token");
  assertIncludes(files.postReadingOcrHost, "target.postMessage({ type: \"post-reading-ocr-error\", id: request.id, error:", "post-reading OCR host must return errors without the parent auth token");
  assertIncludes(files.postReadingOcrHost, "target.postMessage({ type: \"post-reading-ocr-progress\", id, status, progress: value }, targetOrigin)", "post-reading OCR host must return progress without the parent auth token");
  assertNotIncludes(files.postReadingOcrHost, "authToken: request.authToken", "post-reading OCR host must not echo request auth tokens in page-observable responses");
  assertNotIncludes(files.postReadingOcrHost, "id, authToken, status", "post-reading OCR host progress responses must not include auth tokens");
  verifyOcrHostResponsePayloads(files.postReadingOcrHost);
}

function verifyReminetUploadCaps() {
  const background = files.reminetChatBackground;
  const upload = functionBody(background, "uploadAttachment");
  assertIncludes(background, "MAX_ATTACHMENT_IMAGE_BYTES = 10 * 1024 * 1024", "RemiNet uploads must cap image attachments");
  assertIncludes(background, "MAX_ATTACHMENT_VIDEO_BYTES = 32 * 1024 * 1024", "RemiNet uploads must cap video attachments");
  assertIncludes(background, "ALLOWED_ATTACHMENT_IMAGE_TYPES", "RemiNet uploads must enumerate allowed image MIME types");
  assertIncludes(background, "ALLOWED_ATTACHMENT_VIDEO_TYPES", "RemiNet uploads must enumerate allowed video MIME types");
  assertIncludes(upload, "isAllowedAttachmentMimeType(declaredMimeType)", "RemiNet upload handler must validate declared MIME type before decoding");
  assertIncludes(upload, "decodeAttachmentDataUrl(dataUrl)", "RemiNet upload handler must decode data URLs through capped validation");
  assertIncludes(upload, "decoded.contentType !== declaredMimeType", "RemiNet upload handler must reject MIME mismatches");
  assertIncludes(upload, "decoded.tooLarge || decoded.bytes.byteLength > maxBytes", "RemiNet upload handler must reject oversized decoded payloads");
  assertIncludes(functionBody(background, "decodeAttachmentDataUrl"), "estimatedBase64Bytes(base64) > maxBytes", "RemiNet upload decoder must reject oversized base64 before full decode");
}

function verifyMiladyLevelUpSender() {
  const handler = files.miladyMaxxerBackground;
  const senderPolicy = functionBody(files.miladyMaxxerBackground, "isMiladyLevelUpSender");
  assertIncludes(handler, "if (!isMiladyLevelUpSender(sender))", "milady level-up handler must validate sender before creating notifications");
  assertIncludes(handler, "UNSUPPORTED_SENDER", "milady level-up handler must fail closed for unsupported senders");
  verifySameExtensionTopFrameHttpsPolicy(senderPolicy, "Milady level-up sender policy");
  assertIncludes(senderPolicy, "url.hostname === \"x.com\" || url.hostname === \"twitter.com\"", "Milady level-up sender policy must restrict to X/Twitter hosts");
}

function verifyCentralRoutedBridgePolicies() {
  const router = files.background;
  for (const [type, wrapper] of [
    ["milxdy:fetchImageDataUrl", "fetchImageDataUrlForSender"],
    ["miladychan:fetchJson", "fetchMiladychanJsonForSender"],
    ["music:fetchJson", "fetchMusicJsonForSender"],
    ["music:postForm", "postMusicFormForSender"],
    ["music:fetchImageDataUrl", "fetchMusicImageDataUrlForSender"],
    ["wiki:fetchImageDataUrl", "fetchWikiImageDataUrlForSender"],
    ["remistats:getUser", "fetchRemiStatsUserForSender"],
    ["reminetIdentity:getProfile", "resolveReminetIdentityForSender"],
  ]) {
    assertIncludes(router, `type: "${type}"`, `${type} must be centrally routed`);
    assertIncludes(router, wrapper, `${type} must dispatch through a sender-aware wrapper`);
  }

  for (const wrapper of [
    "fetchImageDataUrlForSender",
    "fetchMiladychanJsonForSender",
    "fetchMusicJsonForSender",
    "postMusicFormForSender",
    "fetchMusicImageDataUrlForSender",
    "fetchRemiStatsUserForSender",
    "resolveReminetIdentityForSender",
  ]) {
    const body = functionBody(files.background, wrapper);
    assertIncludes(body, "if (!isXContentScriptSender(sender)) return unsupportedSender();", `${wrapper} must require same-extension top-frame X/Twitter sender policy`);
  }

  const wikiWrapper = functionBody(files.background, "fetchWikiImageDataUrlForSender");
  assertIncludes(wikiWrapper, "if (!isWikiImageSender(sender)) return unsupportedSender();", "wiki image fetches must use the wiki image sender policy");
  const wikiPolicy = functionBody(files.background, "isWikiImageSender");
  assertIncludes(wikiPolicy, "isXContentScriptSender(sender) || isWikiFrameSender(sender)", "wiki image sender policy must allow X content and packaged wiki frames only");
  const xPolicy = functionBody(files.background, "isXContentScriptSender");
  assertIncludes(xPolicy, "isSameExtensionTopFrameHttpsSender(sender, [\"x.com\", \"twitter.com\"])", "central X sender policy must restrict to X/Twitter hosts");
  verifySameExtensionTopFrameHttpsPolicy(functionBody(files.background, "isSameExtensionTopFrameHttpsSender"), "Central X route sender policy");
  assertIncludes(files.background, "UNSUPPORTED_SENDER", "central routed bridges must fail closed for unsupported senders");
  verifyCentralImageBridgeCaps();
}

function verifyCentralImageBridgeCaps() {
  assertIncludes(files.background, "MAX_IMAGE_RESPONSE_BYTES", "central image bridges must define a shared byte ceiling");
  assertIncludes(files.background, "IMAGE_TOO_LARGE", "central image bridges must return a stable oversized image error");
  assertIncludes(files.background, "readCappedResponseBytes", "central image bridges must read responses through a capped helper");
  assertIncludes(functionBody(files.background, "readCappedResponseBytes"), "content-length", "central image bridge cap helper must check Content-Length before reading");
  assertIncludes(functionBody(files.background, "readCappedResponseBytes"), "total > maxBytes", "central image bridge cap helper must enforce a hard streaming byte ceiling");
  for (const [label, fnName] of [
    ["music:image", "fetchMusicImageDataUrl"],
    ["wiki:image", "fetchWikiImageDataUrl"],
    ["milxdy:imageDataUrl", "fetchImageDataUrl"],
  ]) {
    const body = functionBody(files.background, fnName);
    assertIncludes(body, "readCappedResponseBytes(response, MAX_IMAGE_RESPONSE_BYTES)", `${label} must use the shared capped image reader`);
  }
}

function verifyPostReadingFetchCaps() {
  const helper = functionBody(files.postReadingBackground, "readCappedArrayBuffer");
  assertIncludes(helper, "response.body.getReader()", "Post-reading fetch bridge must stream response bodies through a reader");
  assertIncludes(helper, "content-length", "Post-reading fetch bridge must check Content-Length before reading");
  assertIncludes(helper, "total > maxBytes", "Post-reading fetch bridge must enforce a hard streaming byte ceiling");
  assertIncludes(helper, "reader.cancel()", "Post-reading fetch bridge must cancel oversized response streams");
  if (helper.includes("response.arrayBuffer()")) {
    failures.push("Post-reading fetch bridge must not buffer the full response before enforcing byte caps");
  }
}

function verifyWikiSidebarFrameBridge() {
  const senderPolicy = functionBody(files.background, "isWikiFrameSender");
  for (const handler of [
    "openWikiSidebarTab",
    "forwardWikiSidebarNavigation",
    "forwardWikiSidebarNavigateInFrame",
    "forwardWikiSidebarHistory",
    "forwardWikiSidebarReadAloudRequest",
  ]) {
    const body = functionBody(files.background, handler);
    assertIncludes(body, "isWikiFrameSender(sender)", `${handler} must use the shared Wiki frame sender policy`);
  }
  assertIncludes(senderPolicy, "sender.id !== chrome.runtime.id", "Wiki frame sender policy must require same-extension sender id");
  assertIncludes(senderPolicy, "typeof sender.tab?.id !== \"number\"", "Wiki frame sender policy must require tab context");
  assertIncludes(senderPolicy, "typeof sender.frameId !== \"number\" || sender.frameId <= 0", "Wiki frame sender policy must require a non-top frame");
  assertIncludes(senderPolicy, "sender.url || sender.origin", "Wiki frame sender policy must inspect frame URL sources");
  assertIncludes(senderPolicy, "WIKI_SIDEBAR_OPEN_TAB_RULES.some", "Wiki frame sender policy must use the wiki host allowlist");
  assertIncludes(senderPolicy, "parseAllowedUrl(url.href, [rule])", "Wiki frame sender policy must use shared URL allowlist parsing");
}

function verifyDocsContract() {
  assertIncludes(files.appSdkDocs, "not local package APIs and not sandbox boundaries", "App SDK docs must state internal bridges are not package APIs or sandbox boundaries");
  assertIncludes(files.appSdkDocs, "same-extension top-frame X/Twitter and RemiliaNET senders", "App SDK docs must document both sides of RemiNet socket sender validation");
  assertIncludes(files.appSdkDocs, "packaged `ocr.html` sender", "App SDK docs must document OCR frame sender validation");
  assertIncludes(files.appSdkDocs, "content-issued frame authentication token", "App SDK docs must document OCR frame parent authentication");
  assertIncludes(files.appSdkDocs, "same-extension non-top wiki frame senders", "App SDK docs must document Wiki iframe sender validation");
}

function verifyOcrHostResponsePayloads(source) {
  for (const payload of objectLiteralsPassedToPostMessage(source)) {
    if (!payload.includes("post-reading-ocr-progress")
      && !payload.includes("post-reading-ocr-result")
      && !payload.includes("post-reading-ocr-error")) {
      continue;
    }
    assertNotIncludes(payload, "authToken", "post-reading OCR host response payloads must not include authToken fields");
    assertNotIncludes(payload, "parentAuthToken", "post-reading OCR host response payloads must not include parent auth token values");
    assertNotIncludes(payload, "request.authToken", "post-reading OCR host response payloads must not echo request auth token values");
  }
}

function objectLiteralsPassedToPostMessage(source) {
  const payloads = [];
  let searchFrom = 0;
  while (searchFrom < source.length) {
    const callIndex = source.indexOf(".postMessage(", searchFrom);
    if (callIndex < 0) break;
    const objectStart = source.indexOf("{", callIndex);
    if (objectStart < 0) break;
    let depth = 0;
    for (let index = objectStart; index < source.length; index += 1) {
      const char = source[index];
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          payloads.push(source.slice(objectStart, index + 1));
          searchFrom = index + 1;
          break;
        }
      }
    }
    if (searchFrom <= callIndex) break;
  }
  return payloads;
}

function functionBody(source, name) {
  const start = name.includes(".")
    ? source.indexOf(name)
    : findFunctionDeclaration(source, name);
  if (start < 0) fail(`missing function or call body: ${name}`);
  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) fail(`missing opening brace for: ${name}`);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(braceStart, index + 1);
    }
  }
  fail(`missing closing brace for: ${name}`);
  return "";
}

function findFunctionDeclaration(source, name) {
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${escapeRegExp(name)}\\s*\\(`, "m");
  const match = pattern.exec(source);
  return match ? match.index : -1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertIncludes(source, needle, message) {
  if (!source.includes(needle)) fail(message);
}

function assertNotIncludes(source, needle, message) {
  if (source.includes(needle)) fail(message);
}

function assertOrder(source, first, second, message) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) fail(message);
}

function verifySameExtensionTopFrameHttpsPolicy(source, label, quote = "\"") {
  assertIncludes(source, `sender.id !== chrome.runtime.id`, `${label} must require same-extension sender id`);
  assertIncludes(source, `typeof sender.tab?.id !== ${quote}number${quote}`, `${label} must require tab context`);
  assertIncludes(source, "sender.frameId !== undefined && sender.frameId !== 0", `${label} must reject non-top frames`);
  assertIncludes(source, "sender.url || sender.origin || sender.tab.url", `${label} must inspect sender URL sources`);
  assertIncludes(source, `url.protocol === ${quote}https:${quote}`, `${label} must require HTTPS`);
}

function fail(message) {
  failures.push(message);
}
