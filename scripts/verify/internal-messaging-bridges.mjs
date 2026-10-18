import { readFile } from "node:fs/promises";

const files = {
  imageHandlers: await readFile("src/extension/background/image-fetch-handlers.ts", "utf8"),
  background: await readFile("src/extension/background/index.ts", "utf8"),
  postReadingBackground: await readFile("src/apps/post-reading/background.ts", "utf8"),
  postReadingUrlPolicy: await readFile("src/apps/post-reading/urlPolicy.ts", "utf8"),
  postReadingOcr: await readFile("src/apps/post-reading/ocr.ts", "utf8"),
  postReadingOcrHost: await readFile("src/extension/frames/ocr-host.ts", "utf8"),
  reminetChatBackground: await readFile("src/apps/reminet-chat/background.ts", "utf8"),
  reminetLegacyAdapters: await readFile("src/apps/reminet-chat/legacy-adapters.ts", "utf8"),
  reminetLegacyMediaUpload: await readFile("src/apps/reminet-chat/legacy-media-upload.ts", "utf8"),
  reminetChatBridge: await readFile("src/extension/frames/reminet-chat-bridge.ts", "utf8"),
  reminetBeetleFastControls: await readFile("src/extension/frames/reminet-beetle-fast-controls.ts", "utf8"),
  reminetLegacySocket: await readFile("src/extension/frames/reminet-chat-legacy-socket.ts", "utf8"),
  reminetCraftFastPath: await readFile("src/extension/frames/reminet-craft-fast-path-runtime.ts", "utf8"),
  reminetCraftBootstrap: await readFile("src/extension/frames/reminet-craft-fast-path.ts", "utf8"),
  extensionManifest: await readFile("assets/extension/manifest.json", "utf8"),
  beetolBackground: await readFile("src/apps/beetol/background.js", "utf8"),
  beetolContent: await readFile("src/apps/beetol/content.js", "utf8"),
  miladyMaxxerBackground: await readFile("src/apps/milady-maxxer/background.ts", "utf8"),
  appSdkDocs: await readFile("docs/sdk/APP_SDK.md", "utf8"),
};

const failures = [];

assertIncludes(files.reminetCraftBootstrap, "installReminetCraftFastPath();", "craft bootstrap must install the reviewed runtime");
verifyReminetChatSocketBridge();
verifyReminetChatRuntimeBridge();
verifyReminetChatLoginHandoff();
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
  const senderPolicy = functionBody(files.reminetLegacyAdapters, "isAllowedLegacySender");
  const registerSiteBridge = functionBody(files.reminetChatBackground, "registerSiteSocketBridge");
  const bridge = files.reminetChatBridge;
  const beetleFastControls = files.reminetBeetleFastControls;
  const socketTransport = files.reminetLegacySocket;
  assertIncludes(onConnect, "if (port.name !== SOCKET_PORT_NAME) return;", "RemiNet socket bridge must ignore unrelated port names");
  assertIncludes(onConnect, "if (!isReminetChatSocketSender(port.sender))", "RemiNet socket bridge must validate sender before socket setup");
  assertIncludes(onConnect, "port.disconnect();", "RemiNet socket bridge must disconnect invalid senders");
  assertIncludes(onConnect, "postToSiteSocketBridge", "RemiNet socket clients must relay through the authenticated site bridge");
  assertNotIncludes(files.reminetChatBackground, "new WebSocket", "RemiNet background must not own the cross-site WebSocket");
  for (const source of [onConnect, registerSiteBridge, functionBody(files.reminetChatBackground, "postToSiteSocketBridge"), socketTransport]) {
    assertNotIncludes(source, "chrome.tabs.create", "RemiNet socket recovery must not open tabs");
    assertNotIncludes(source, "chrome.action.openPopup", "RemiNet socket recovery must not open login UI");
  }
  assertNotIncludes(files.reminetChatBackground, "chrome.tabs.remove", "RemiNet socket recovery must not close tabs");

  assertIncludes(registerSiteBridge, 'isAllowedLegacySender(port.sender, "remilia-bridge")', "RemiNet site bridge must accept only exact RemiliaNET top-frame senders");
  assertIncludes(registerSiteBridge, "parseLegacySocketBridgeEvent(message)", "RemiNet site bridge must schema-validate every socket event");
  assertIncludes(registerSiteBridge, "broadcastSocketEvent(event)", "RemiNet site bridge must broadcast only validated live events");

  assertIncludes(bridge, "startReminetLegacySocketBridge()", "RemiNet page bridge must start the isolated legacy socket module");
  assertIncludes(socketTransport, 'chrome.runtime.connect({ name: SOCKET_PORT_NAME })', "RemiNet site bridge must use its dedicated runtime port");
  assertIncludes(socketTransport, 'new WebSocket(LEGACY_SOCKET_URL)', "RemiNet live socket must be created at the exact legacy endpoint in the RemiliaNET page context");
  assertIncludes(socketTransport, "isExactLegacySocketUrl(LEGACY_SOCKET_URL)", "RemiNet live socket must fail closed unless its endpoint is exact");
  assertIncludes(socketTransport, 'type: "subscribe"', "RemiNet live socket must subscribe after opening");
  assertIncludes(socketTransport, 'socket.send(JSON.stringify(command.mutation))', "RemiNet site bridge must forward only typed legacy mutations");
  assertIncludes(socketTransport, 'type: "socket:mutation-sent"', "RemiNet site bridge must acknowledge only locally serialized mutations");
  assertIncludes(socketTransport, "parseLegacySocketFrame(event.data)", "RemiNet site bridge must reject malformed and oversized frames before relay");
  assertIncludes(socketTransport, 'type: "socket:hint"', "RemiNet site bridge must relay only typed hints rather than raw frame payloads");
  assertNotIncludes(socketTransport, 'post({ type: "socket:frame"', "RemiNet site bridge must not expose raw frame bodies outside RemiliaNET");
  assertIncludes(socketTransport, "LEGACY_SOCKET_OPEN_TIMEOUT_MS", "RemiNet live socket opening must have a deadline");
  assertIncludes(socketTransport, 'reason: "remote-close"', "RemiNet live socket close events must redact server-provided reasons");
  assertNotIncludes(socketTransport, "reason: event.reason", "RemiNet live socket must never relay raw close reasons");
  assertIncludes(socketTransport, "nextPort.onDisconnect.addListener", "RemiNet site bridge must handle extension-port shutdown");
  assertIncludes(socketTransport, "legacyPortReconnectDelay(portReconnectAttempts)", "RemiNet site bridge must use bounded reconnect backoff after a background-worker restart");
  assertIncludes(socketTransport, "closeSocket();", "RemiNet site bridge must release its socket when the extension port closes");
  assertIncludes(files.extensionManifest, '"matches": ["https://www.remilia.net/*", "https://remilia.net/*"]', "RemiNet site bridge must be injected only on the two exact RemiliaNET origins");
  assertIncludes(files.extensionManifest, '"js": ["reminetChatBridge.js"]', "RemiNet site bridge must be declared in the extension manifest");
  assertIncludes(files.extensionManifest, '"js": ["reminetCraftFastPath.js"]', "RemiNet crafting fast path must be declared in the extension manifest");
  assertIncludes(files.extensionManifest, '"world": "MAIN"', "RemiNet crafting fast path must run in the page world");
  assertNotIncludes(files.reminetCraftFastPath, "window.setTimeout =", "RemiNet crafting fast path must retain native page timer ownership");
  assertNotIncludes(files.reminetCraftFastPath, "FAST_TIMEOUTS", "RemiNet crafting fast path must not accelerate unrelated page timers");
  assertIncludes(bridge, "createBeetleReducedMotionCss", "RemiNet bridge must use the completion-safe Beetle motion policy");
  assertIncludes(beetleFastControls, "animation-iteration-count: 1", "RemiNet reduced motion must cover nested Beetle route animations");
  assertIncludes(beetleFastControls, 'candidate.nodeType === 1 && typeof candidate.closest === "function"', "RemiNet fast Beetle actions must resolve cross-realm click targets without instanceof");
  assertIncludes(beetleFastControls, 'status.ok === true && status.signedIn === true && status.method === "oidc"', "RemiNet instant Beetle results must require token-free connected OIDC status");
  assertIncludes(bridge, '{ type: "beetol:authStatus" }', "RemiNet instant Beetle results must poll only the token-free Beetol connector status");
  assertIncludes(bridge, "preferred && connectorActive", "RemiNet instant Beetle results must combine stored preference with live connector status");
  assertIncludes(bridge, "BEETLE_CONNECTOR_STATUS_POLL_MS", "RemiNet instant Beetle results must react to live disconnect and reconnect");
  assertNotIncludes(bridge, "remilia-auth:", "RemiNet content must not call popup-only Remilia auth operations");
  assertIncludes(bridge, "trustedNativeBeetleActionFor(event, instantResultsEnabled)", "RemiNet fast Beetle presentation must remain limited to trusted enabled clicks");
  assertIncludes(bridge, "observeNativeBeetleAction(action)", "RemiNet fast Beetle presentation must observe the native action result");
  assertIncludes(beetleFastControls, "createNativeBeetleAccelerationCss", "RemiNet instant results must accelerate native presentation through a bounded policy");
  assertNotIncludes(bridge, '{ type: "beetol:action", action }', "RemiNet fast Beetle controls must not replace native actions with a background mutation");
  assertNotIncludes(bridge, "event.preventDefault()", "RemiNet fast Beetle controls must not cancel the trusted native click");
  assertNotIncludes(bridge, "event.stopImmediatePropagation()", "RemiNet fast Beetle controls must not silence the native page handler");
  assertNotIncludes(bridge, "event.target instanceof Element", "RemiNet fast Beetle actions must not discard isolated-world click targets");
  const animationNoneSelectors = Array.from(beetleFastControls.matchAll(/([^{}]+)\{[^{}]*animation:\s*none/gi))
    .map((match) => match[1])
    .join("\n");
  for (const selector of [".beetle-console", ".beetleModule", ".beetle-catch-module", ".carousel", ".claim-button"]) {
    assertNotIncludes(animationNoneSelectors, selector, `RemiNet fast motion must preserve ${selector} completion events`);
  }

  assertNotIncludes(files.reminetChatBackground, "prepareSocketAuth", "RemiNet site socket must not depend on a dormant browser-session preparation route");
  assertNotIncludes(files.reminetChatBackground, "refreshRemiliaAccess", "RemiNet site socket must not refresh ambient browser session state");

  assertIncludes(functionBody(files.reminetChatBackground, "isReminetChatSocketSender"), 'isAllowedLegacySender(sender, "runtime-content")', "RemiNet socket sender policy must use the typed multi-site runtime role");
  assertIncludes(functionBody(files.reminetChatBackground, "isReminetChatMessageSender"), 'isAllowedLegacySender(sender, "x-content")', "RemiNet privileged runtime messages must retain the typed X/Twitter-only role");
  assertIncludes(senderPolicy, "sender.id !== chrome.runtime.id", "RemiNet legacy sender policy must require same-extension sender id");
  assertIncludes(senderPolicy, 'typeof sender.tab?.id !== "number"', "RemiNet legacy sender policy must require tab context");
  assertIncludes(senderPolicy, "sender.frameId !== undefined && sender.frameId !== 0", "RemiNet legacy sender policy must reject non-top frames");
  assertIncludes(senderPolicy, "sender.url || sender.origin || sender.tab.url", "RemiNet legacy sender policy must inspect sender URL sources");
  assertIncludes(senderPolicy, 'url.protocol !== "https:"', "RemiNet legacy sender policy must reject non-HTTPS senders");
  assertIncludes(senderPolicy, "LEGACY_SITE_ORIGINS.includes(url.origin", "RemiNet site sender policy must require one of the exact RemiliaNET origins");
  assertIncludes(senderPolicy, 'url.origin === "https://x.com" || url.origin === "https://twitter.com"', "RemiNet client sender policy must require exact X/Twitter origins");
  assertIncludes(senderPolicy, 'role === "runtime-content"', "RemiNet runtime sender policy must use an explicit typed role");
}

function verifyReminetChatRuntimeBridge() {
  const handler = functionBody(files.reminetChatBackground, "handleChatMessage");
  const senderPolicy = functionBody(files.reminetChatBackground, "isReminetChatMessageSender");
  const matcher = functionBody(files.reminetChatBackground, "isChatMessage");
  assertIncludes(handler, "if (!isReminetChatMessageSender(sender))", "RemiNet runtime bridge must validate sender before authenticated operations");
  assertIncludes(handler, "UNSUPPORTED_SENDER", "RemiNet runtime bridge must fail closed for unsupported senders");
  assertOrder(handler, "if (!isReminetChatMessageSender(sender))", "if (message.type === \"reminetChat:authStatus\")", "RemiNet runtime bridge must validate sender before dispatch");
  assertIncludes(senderPolicy, 'isAllowedLegacySender(sender, "x-content")', "RemiNet runtime sender policy must retain the exact X/Twitter top-frame role");
  assertIncludes(matcher, "Object.keys(record)", "RemiNet runtime bridge must exact-key validate message payloads");
  assertIncludes(matcher, "keys.length === 1", "RemiNet auth-status messages must be body-free");
  assertIncludes(matcher, "keys.length === 3", "RemiNet legacy uploads must contain exactly the typed upload fields");
  assertIncludes(matcher, "keys.length === 2", "RemiNet media fetches must contain exactly a type and URL");
}

function verifyReminetChatLoginHandoff() {
  const handler = functionBody(files.reminetChatBackground, "handleChatMessage");
  const loginStart = handler.indexOf('if (message.type === "reminetChat:openLogin")');
  const loginEnd = handler.indexOf('if (message.type === "reminetChat:legacy:uploadAttachment")', loginStart);
  const login = loginStart >= 0 && loginEnd > loginStart ? handler.slice(loginStart, loginEnd) : "";
  assertIncludes(login, "await chrome.action.openPopup()", "Only explicit Chat login may open the extension popup");
  assertIncludes(login, 'await chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?focus=remilia-login"), active: true })', "Explicit Chat login fallback must open only the shipped popup in a visible active tab");
  assertOrder(handler, "if (!isReminetChatMessageSender(sender))", 'if (message.type === "reminetChat:openLogin")', "Explicit Chat login must pass the exact privileged sender policy");
  assertNotIncludes(files.reminetChatBackground.replace(login, ""), "chrome.tabs.create", "Tab creation must remain exclusive to the explicit Chat login branch");
  assertNotIncludes(files.reminetChatBackground, "active: false", "RemiNet login and recovery must never open a hidden tab");
}

function verifyBeetolRuntimeBridge() {
  const handler = functionBody(files.beetolBackground, "handleBeetolMessage");
  const senderPolicy = functionBody(files.beetolBackground, "isBeetolMessageSender");
  const extensionPagePolicy = functionBody(files.beetolBackground, "isBeetolExtensionPageSender");
  const contentScriptPolicy = functionBody(files.beetolBackground, "isBeetolContentScriptSender");
  assertIncludes(handler, "if (!isBeetolMessageSender(message, sender))", "Beetol runtime bridge must validate sender before authenticated operations");
  assertIncludes(handler, "UNSUPPORTED_SENDER", "Beetol runtime bridge must fail closed for unsupported senders");
  assertOrder(handler, "if (!isBeetolMessageSender(message, sender))", "if (message?.type === 'beetol:authStatus')", "Beetol runtime bridge must validate sender before dispatch");
  assertIncludes(senderPolicy, "sender.id !== chrome.runtime.id", "Beetol sender policy must require same-extension sender id");
  assertIncludes(senderPolicy, "isBeetolExtensionPageSender(sender)", "Beetol sender policy must recognize popup/extension-page senders");
  assertIncludes(senderPolicy, "message?.type === 'beetol:authStatus'", "Beetol extension-page policy must allow popup auth status");
  assertNotIncludes(files.beetolBackground, "beetol:sessionStatus", "Beetol must not retain the retired browser-session status operation");
  assertNotIncludes(files.beetolBackground, "beetol:logout", "Beetol must not retain a non-popup auth-disconnect operation");
  assertNotIncludes(files.beetolBackground, "disconnectRemiliaAuth", "Beetol action failures must not destroy trusted auth state");
  assertIncludes(senderPolicy, "return isBeetolContentScriptSender(sender);", "Beetol sender policy must use a separate content-script policy for page actions");
  assertIncludes(extensionPagePolicy, "if (sender.tab) return false;", "Beetol extension-page policy must reject tab senders");
  assertIncludes(extensionPagePolicy, "chrome.runtime.getURL('')", "Beetol extension-page policy must compare against the packaged extension origin");
  verifySameExtensionTopFrameHttpsPolicy(contentScriptPolicy, "Beetol content-script sender policy", "'");
  assertIncludes(contentScriptPolicy, "url.hostname === 'x.com'", "Beetol content-script sender policy must allow supported X pages");
  assertIncludes(contentScriptPolicy, "url.hostname === 'twitter.com'", "Beetol content-script sender policy must allow supported Twitter pages");
  assertIncludes(contentScriptPolicy, "url.hostname === 'www.remilia.net'", "Beetol content-script sender policy must allow supported RemiliaNET pages");
  assertNotIncludes(files.beetolContent, "beetol-retry-session", "Beetol content must not retain retry-session UI or action naming");
  assertNotIncludes(files.beetolContent, "beetol:sessionStatus", "Beetol content must not invoke retired browser-session status");
  assertNotIncludes(files.beetolContent, "remilia-auth:", "Beetol content must not invoke extension-page-only auth actions");
  assertIncludes(files.beetolContent, "Open the milXdy extension popup", "Beetol disconnected UI must direct users to the official extension connection surface");
  assertIncludes(files.beetolContent, "Official read-only status", "Beetol X/Twitter UI must label official state as read-only");
  assertIncludes(files.beetolContent, "Play Beetle on RemiliaNET", "Beetol X/Twitter UI must provide one clear visible native-game route");
  assertIncludes(files.beetolContent, "?cartridge=beetle", "Beetol native-game route must target the visible Beetle cartridge");
  assertIncludes(files.beetolContent, 'target="_blank" rel="noopener noreferrer"', "Beetol native-game navigation must be user-initiated and opener-safe");
  assertNotIncludes(files.beetolContent, "type: 'beetol:action'", "Beetol read-only content must not invoke the legacy action handler");
  assertNotIncludes(files.beetolContent, "type: 'beetol:crunchJunk'", "Beetol read-only content must not invoke legacy craft handling");
  assertNotIncludes(files.beetolContent, "data-action", "Beetol read-only content must not render action-looking legacy tiles");
  assertNotIncludes(files.beetolContent, "Use the visible RemiliaNET Beetle control", "Beetol content must not show circular native-control guidance");

  const action = functionBody(files.beetolBackground, "runAction");
  const nativeAction = functionBody(files.beetolBackground, "nativeBeetleActionResponse");
  assertIncludes(action, "nativeBeetleActionResponse(action)", "Beetol actions must route to the visible native RemiliaNET action boundary");
  assertIncludes(nativeAction, "getRemiliaAuthStatus()", "Beetol native action guidance must fail closed on connector status");
  assertIncludes(nativeAction, "status.phase !== 'connected'", "Beetol native action guidance must require the connected official connector");
  assertIncludes(nativeAction, "NATIVE_ACTION_REQUIRED", "Beetol must return a bounded native-action result instead of proxying a legacy mutation");
  assertIncludes(nativeAction, "actionMode: 'native-remilianet'", "Beetol status must distinguish native RemiliaNET actions");
  assertNotIncludes(files.beetolBackground, "/api/beetle/action/", "Beetol must not call undocumented mutation endpoints");
  assertNotIncludes(files.beetolBackground, "Authorization", "Beetol must not attach the official bearer to undocumented mutations");
  assertNotIncludes(files.beetolBackground, "fetch(", "Beetol background must not directly transport undocumented mutations");
  assertNotIncludes(files.beetolBackground, "prepareRemiliaAccess", "Beetol must not prepare an access token for undocumented mutations");
  assertNotIncludes(files.beetolBackground, "refreshRemiliaAccess", "Beetol must not refresh after a legacy action rejection");
  assertNotIncludes(files.beetolBackground, "credentials: 'include'", "Beetol must not borrow ambient website credentials");
  assertNotIncludes(files.beetolBackground, "chrome.tabs.create", "Beetol must not open a hidden action or auth tab");
  assertNotIncludes(files.beetolBackground, "chrome.windows.create", "Beetol must not open a hidden action or auth window");
  assertIncludes(files.beetolBackground, "readOfficialBeetleSnapshot(officialBeetleReads)", "Beetol state must use the official typed Beetle reads");
  assertNotIncludes(files.beetolBackground, "/api/beetle/user", "Beetol must not retain the undocumented state read endpoint");
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
  assertIncludes(ocrContent, "post-reading:ocrSession", "post-reading OCR content must obtain a background-bound host session");
  assertIncludes(ocrContent, "post-reading-ocr-authenticated", "post-reading OCR content must wait for host authorization before accepting requests");
  assertIncludes(ocrContent, "event.origin !== extensionOrigin()", "post-reading OCR content must validate extension-origin host responses");
  assertIncludes(ocrContent, "event.source !== frame.contentWindow", "post-reading OCR content must validate the OCR frame response source");
  assertIncludes(ocrContent, "event.data.id !== id", "post-reading OCR content must route OCR responses by request id");
  assertNotIncludes(ocrContent, "event.data.authToken === authToken", "post-reading OCR content must not require host responses to echo the parent auth token");
  assertIncludes(ocrHostListener, "event.source !== window.parent", "post-reading OCR host must accept messages only from its parent frame");
  assertIncludes(ocrHostListener, "isAuthenticatedParentRequest(event)", "post-reading OCR host must require authenticated parent requests");
  assertIncludes(files.postReadingOcrHost, "post-reading:authorizeOcrSession", "post-reading OCR host must authorize setup through the extension background");
  assertIncludes(files.postReadingOcrHost, "parentAuthToken !== \"\"", "post-reading OCR host must reject reinitialization after authorization");
  assertIncludes(files.postReadingOcrHost, "post-reading-ocr-authenticated", "post-reading OCR host must acknowledge completed authorization");
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
  const contract = files.reminetLegacyAdapters;
  const executor = files.reminetLegacyMediaUpload;
  assertIncludes(contract, "LEGACY_MAX_IMAGE_BYTES = 10 * 1024 * 1024", "RemiNet legacy uploads must cap image attachments");
  assertIncludes(contract, "LEGACY_MAX_VIDEO_BYTES = 32 * 1024 * 1024", "RemiNet legacy uploads must cap video attachments");
  assertIncludes(contract, "LEGACY_IMAGE_TYPES", "RemiNet legacy uploads must enumerate allowed image MIME types");
  assertIncludes(contract, "LEGACY_VIDEO_TYPES", "RemiNet legacy uploads must enumerate allowed video MIME types");
  assertIncludes(background, 'error: "MEDIA_UNAVAILABLE"', "RemiNet upload handler must explicitly reject unsupported official media uploads");
  assertNotIncludes(background, "prepareRemiliaAccess", "RemiNet upload handler must not acquire an official token for legacy media");
  assertNotIncludes(background, "executeLegacyMediaUpload", "RemiNet upload handler must keep the legacy media executor dormant");
  assertIncludes(background, 'isAllowedLegacySender(sender, "x-content")', "RemiNet legacy upload messages must require the exact X/Twitter sender role");
  assertIncludes(executor, "decodeLegacyAttachmentDataUrl(request)", "RemiNet legacy upload executor must decode through strict capped validation");
  assertIncludes(executor, "estimatedBase64Bytes(base64) > maxBytes", "RemiNet upload decoder must reject oversized base64 before full decode");
  assertIncludes(executor, "LEGACY_UPLOAD_TIMEOUT_MS", "RemiNet upload must have a deadline");
  assertIncludes(executor, "LEGACY_CONFIRM_TIMEOUT_MS", "RemiNet confirmation must have a deadline");
  assertIncludes(executor, "LEGACY_RESPONSE_MAX_BYTES", "RemiNet legacy JSON responses must have a byte ceiling");
  assertIncludes(executor, 'credentials: "omit"', "RemiNet legacy media mutation must not send ambient browser credentials");
  assertIncludes(executor, 'redirect: "error"', "RemiNet legacy media mutation must reject redirects");
  assertIncludes(executor, 'referrerPolicy: "no-referrer"', "RemiNet legacy media mutation must suppress referrers");
  assertIncludes(executor, "Authorization: `Bearer ${dependencies.accessToken}`", "RemiNet legacy media mutation must keep delegated authorization inside the background executor");
  assertNotIncludes(executor, "response.text()", "RemiNet legacy media failures must not buffer or relay raw response bodies");
  assertNotIncludes(background, 'error instanceof Error ? error.message', "RemiNet legacy upload failures must not relay exception text");
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
  const catalogWrapper = functionBody(router, "openAddonsCatalogWindow");
  const runtimeSenderPolicy = functionBody(router, "isApprovedRuntimeContentSender");
  assertIncludes(catalogWrapper, "if (!isApprovedRuntimeContentSender(sender)) return unsupportedSender();", "Add-ons catalog launch must validate approved runtime content senders");
  for (const host of ["x.com", "twitter.com", "www.remilia.net", "remilia.wiki", "wiki.remilia.org", "boards.miladychan.org"]) {
    assertIncludes(runtimeSenderPolicy, `"${host}"`, `approved runtime sender policy must include ${host}`);
  }
  for (const [type, wrapper] of [
    ["milxdy:fetchImageDataUrl", "fetchImageDataUrlForSender"],
    ["miladychan:fetchJson", "fetchMiladychanJsonForSender"],
    ["miladychan:postText", "postMiladychanTextForSender"],
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
    "fetchMusicJsonForSender",
    "postMusicFormForSender",
    "fetchMusicImageDataUrlForSender",
    "fetchRemiStatsUserForSender",
    "resolveReminetIdentityForSender",
  ]) {
    const body = functionBody(files.background, wrapper);
    assertIncludes(body, "if (!isXContentScriptSender(sender)) return unsupportedSender();", `${wrapper} must require same-extension top-frame X/Twitter sender policy`);
  }

  for (const wrapper of ["fetchMiladychanJsonForSender", "postMiladychanTextForSender"]) {
    const body = functionBody(files.background, wrapper);
    assertIncludes(body, "if (!isMiladychanPortalSender(sender)) return unsupportedSender();", `${wrapper} must require the scoped Miladychan portal sender policy`);
  }
  const miladychanPolicy = functionBody(files.background, "isMiladychanPortalSender");
  assertIncludes(miladychanPolicy, '"x.com", "twitter.com", "boards.miladychan.org"', "Miladychan sender policy must allow only X/Twitter and the approved native board host");

  const wikiWrapper = functionBody(files.background, "fetchWikiImageDataUrlForSender");
  assertIncludes(wikiWrapper, "if (!isWikiImageSender(sender)) return unsupportedSender();", "wiki image fetches must use the wiki image sender policy");
  const wikiPolicy = functionBody(files.background, "isWikiImageSender");
  assertIncludes(wikiPolicy, "isXContentScriptSender(sender) || isWikiFrameSender(sender)", "wiki image sender policy must allow X content and packaged wiki frames only");
  const xPolicy = functionBody(files.background, "isXContentScriptSender");
  assertIncludes(xPolicy, "isSameExtensionTopFrameHttpsSender(sender, [\"x.com\", \"twitter.com\"])", "central X sender policy must restrict to X/Twitter hosts");
  verifySameExtensionTopFrameHttpsPolicy(functionBody(files.background, "isSameExtensionTopFrameHttpsSender"), "Central X route sender policy");
  const miladychanPost = functionBody(files.background, "postMiladychanText");
  assertIncludes(miladychanPost, "MILADYCHAN_POST_RULES", "Miladychan posting must use a fixed endpoint allowlist");
  assertIncludes(miladychanPost, 'credentials: "omit"', "Miladychan posting must not reuse browser cookies or sessions");
  assertIncludes(miladychanPost, "new FormData()", "Miladychan posting must match the native multipart request shape");
  assertIncludes(miladychanPost, 'form.set("body", body)', "Miladychan posting must send only the user-entered text body");
  assertIncludes(miladychanPost, 'form.set("name", name)', "Miladychan posting must use only the explicitly selected poster pseudonym");
  assertIncludes(miladychanPost, '"milXdy"', "Miladychan posting must default to the disclosed milXdy pseudonym");
  assertNotIncludes(miladychanPost, 'form.set("image"', "Miladychan posting must not upload media");
  assertIncludes(files.background, "UNSUPPORTED_SENDER", "central routed bridges must fail closed for unsupported senders");
  verifyCentralImageBridgeCaps();
}

function verifyCentralImageBridgeCaps() {
  assertIncludes(files.imageHandlers, "MAX_IMAGE_RESPONSE_BYTES", "central image bridges must define a shared byte ceiling");
  assertIncludes(files.imageHandlers, "IMAGE_TOO_LARGE", "central image bridges must return a stable oversized image error");
  assertIncludes(files.imageHandlers, "readCappedResponseBytes", "central image bridges must read responses through a capped helper");
  assertIncludes(functionBody(files.imageHandlers, "readCappedResponseBytes"), "content-length", "central image bridge cap helper must check Content-Length before reading");
  assertIncludes(functionBody(files.imageHandlers, "readCappedResponseBytes"), "total > maxBytes", "central image bridge cap helper must enforce a hard streaming byte ceiling");
  for (const [label, fnName] of [
    ["music:image", "fetchMusicImageDataUrl"],
    ["wiki:image", "fetchWikiImageDataUrl"],
    ["milxdy:imageDataUrl", "fetchImageDataUrl"],
  ]) {
    assertIncludes(files.background, `${fnName}(url, budgetedFetch)`, `${label} must retain the budgeted fetch dependency in its sender wrapper`);
    const body = functionBody(files.imageHandlers, fnName);
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
  assertIncludes(files.appSdkDocs, "packaged `ocr.html` frame redeems once", "App SDK docs must document packaged OCR-frame redemption");
  assertIncludes(files.appSdkDocs, "trusted content script obtains from the background", "App SDK docs must document background-issued same-tab OCR sessions");
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
