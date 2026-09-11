import type {
  MilxdyContentAppContext,
  MilxdyContentAppModule,
  MilxdyLocalAppPackageManifestV1,
  PublicAppManifest,
  RemiliaCapabilityBrokerResult,
} from "./index";

const manifest: PublicAppManifest = {
  id: "public-contract",
  name: "Public contract",
  version: "0.2.5",
  description: "Public authoring declaration coverage.",
  surfaces: ["document", "composerAction", "replyAction"],
  loadTriggers: ["userAction"],
  composerAction: { label: "Open", presentation: "anchoredPanel" },
  hostComposerActions: ["nativeDrafts"],
  replyAction: { templates: [{ id: "hello", label: "Hello", text: "hello" }] },
  hostActions: ["wiki.openPage"],
  remiliaCapabilities: [{
    id: "remilia.profile.public",
    operations: ["getUserProfile"],
    scopes: [],
    consent: "enablement",
    reason: "Look up an explicitly supplied public Remilia username.",
  }],
};

const packageManifest: MilxdyLocalAppPackageManifestV1 = {
  ...manifest,
  manifestVersion: 1,
  packageKind: "feature",
  sdk: { minVersion: "0.2.5" },
  contentEntry: "content.js",
  defaultEnabled: false,
  storageKeys: { local: [] },
  cost: { startup: "cheap", perSurface: "cheap", network: "none", worker: "none", domWrite: "small" },
  siteScopes: [{
    site: "remiliaWiki",
    hosts: ["https://wiki.remilia.org/*"],
    integration: "contentScript",
    surfaces: ["document", "route"],
  }],
};

declare const context: MilxdyContentAppContext;
const site: "x" | "remiliaNet" | "remiliaWiki" | "miladychan" = context.site.id;
const navigation = context.openWikiPage("https://wiki.remilia.org/page");
const windowHandle = context.windows.create({
  id: "public-contract-window",
  title: "Public contract",
  content: document.createElement("section"),
  initialBounds: { width: 420, side: "right" },
  minWidth: 320,
  resizable: true,
  persistKey: "milxdy.local.public-contract.window",
});
windowHandle.open();
windowHandle.focus();
const profile: Promise<RemiliaCapabilityBrokerResult> | undefined = context.invokeRemiliaCapability?.(
  "getUserProfile",
  { username: "milady" },
);

const module: MilxdyContentAppModule = {
  boot(appContext) {
    appContext.recordDiagnostic("site", appContext.site.id);
  },
  onComposerAction(composer) {
    composer.openNativeDrafts();
  },
  onReplyAction(reply) {
    reply.selectTemplate("hello");
    reply.openNativeReply();
  },
};

// Public authors cannot use private loader or scanner aliases.
// @ts-expect-error loadAppById is an internal runtime helper.
context.loadAppById("wikiSidebar");
// @ts-expect-error scheduleScan is an internal compatibility alias.
context.scheduleScan();
// @ts-expect-error host actions must be declared from the allowlist.
manifest.hostActions = ["wiki.loadAppById"];
// @ts-expect-error broker parameters are operation-specific.
context.invokeRemiliaCapability?.("getUserProfile", { handle: "milady" });
// @ts-expect-error host windows do not accept arbitrary private chrome options.
context.windows.create({ id: "no-private-chrome", title: "No", content: document.body, chrome: "private" });

void site;
void navigation;
void profile;
void module;
void windowHandle;
void packageManifest;
