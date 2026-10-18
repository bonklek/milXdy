import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const remiStatsContent = readFileSync(new URL("./content.js", import.meta.url), "utf8");
const remiStatsBackground = readFileSync(new URL("./background.ts", import.meta.url), "utf8");
const remiStatsOfficialApi = readFileSync(new URL("./official-api.ts", import.meta.url), "utf8");
const remiStatsCss = readFileSync(new URL("./remistats.css", import.meta.url), "utf8");
const chatContent = readFileSync(new URL("../reminet-chat/content.ts", import.meta.url), "utf8");
const beetolBackground = readFileSync(new URL("../beetol/background.js", import.meta.url), "utf8");
const popup = readFileSync(new URL("../../extension/popup/index.ts", import.meta.url), "utf8");
const contentRuntime = readFileSync(new URL("../../platform/runtime/content-runtime.ts", import.meta.url), "utf8");
const hubAppCard = readFileSync(new URL("../../platform/runtime/hub-app-card.ts", import.meta.url), "utf8");
const trophyBannerMedia = readFileSync(new URL("./trophy-banner-media.ts", import.meta.url), "utf8");
const profileBannerController = readFileSync(new URL("./profile-banner-controller.ts", import.meta.url), "utf8");

describe("official RemiStats UI and legacy boundaries", () => {
  it("does not assume a fixed 24-hour poke cooldown in either consumer", () => {
    expect(remiStatsContent).not.toContain("DEFAULT_POKE_COOLDOWN_MS");
    expect(chatContent).not.toContain("DEFAULT_POKE_COOLDOWN_MS");
  });

  it("keeps poke and notification handlers out of the legacy Beetol adapter", () => {
    expect(beetolBackground).not.toContain("beetol:poke");
    expect(beetolBackground).not.toContain("beetol:incomingPokes");
    expect(beetolBackground).not.toContain("/api/pokeUser");
    expect(beetolBackground).not.toContain("/api/notifications");
  });

  it("routes official stats to the X profile UI through the background identity gate", () => {
    expect(remiStatsContent).toContain("type: 'remistats:getMyStatsForXProfile'");
    expect(remiStatsContent).toContain("await fetchOfficialSelfProfileScore(exactProfileXHandle)");
    expect(remiStatsBackground).toContain("getRemiliaAuthStatus");
    expect(remiStatsBackground).toContain("remiStatsOfficialService.getMyStatsForXProfile(message.xHandle)");
  });

  it("launches per-post Poke from an independently confirmed exact directory target", () => {
    expect(remiStatsContent).toContain("type: 'remistats:resolvePokeTargets'");
    expect(remiStatsContent).toContain("fetchPokeTarget(username)");
    expect(remiStatsContent).toContain("pokeUsername ? 'poke-only' : 'fetch-empty'");
    expect(readFileSync(new URL("./poke-feedback.ts", import.meta.url), "utf8")).toContain('type: "remistats:pokeXAuthor"');
    expect(readFileSync(new URL("./poke-feedback.ts", import.meta.url), "utf8")).toContain("expectedRemiliaUsername: username");
    expect(remiStatsBackground).toContain("remiStatsOfficialService.pokeXAuthor(message.xHandle, message.expectedRemiliaUsername)");
    expect(remiStatsContent).not.toContain("confirmPokeIdentity(userData.remiliaUsername)");
    expect(remiStatsOfficialApi).toContain('authStatus.phase !== "connected" && authStatus.phase !== "missing-scope"');
    expect(remiStatsOfficialApi).not.toContain('private async connectedAuthUsername()');
    expect(remiStatsOfficialApi).toContain("target.remiliaUsername !== authUsername");
  });

  it("reconciles one launcher after rerender and exposes action failures visibly", () => {
    expect(remiStatsContent).toContain("await reconcileExistingPokeLauncher(element, ownBadge)");
    expect(remiStatsContent).toContain("for (const duplicate of existingGroups) duplicate.remove()");
    expect(remiStatsContent).toContain("findOwnedNode(element, '[data-testid=\"reply\"], [data-testid=\"like\"], [data-testid=\"unlike\"]')");
    expect(readFileSync(new URL("./poke-feedback.ts", import.meta.url), "utf8")).toContain("button.dataset.reminetPokeMessage = label");
    expect(remiStatsCss).toContain("content: attr(data-reminet-poke-message)");
    expect(remiStatsContent).toContain("pokeTargetLatestRequests.get(xHandle) !== requestGeneration");
  });

  it("keeps Poke authorization independent from optional public badge data", () => {
    expect(remiStatsContent).toContain("const [scoreData, pokeTarget] = await Promise.all([");
    expect(remiStatsContent).toContain("const badge = createScoreBadge(scoreData, { pokeTargetUsername: pokeUsername })");
    expect(remiStatsContent).toContain("const username = cleanRemiliaUsername(button.dataset.reminetUsername || badge?.dataset.reminetUsername)");
    expect(remiStatsContent).not.toContain("badge?.dataset.reminetUsername || profileUsernameFromUrl()");
    expect(remiStatsContent).toContain("const confirmedPokeUsername = cleanRemiliaUsername(pokeTargetUsername)");
  });

  it("exposes one sanitized built-path checkpoint without identity or auth fields", () => {
    expect(remiStatsContent).toContain("recordRuntimePhase('activation', 'module-started')");
    expect(remiStatsContent).toContain("'directory-requested'");
    expect(remiStatsContent).toContain("shouldForceExactDirectoryProfileRetry(response)");
    expect(remiStatsContent).toContain("{ force: true, maxAgeMs: 0 }");
    expect(remiStatsContent).toContain("reserveForcedProfileRoute(cleanXHandle)");
    expect(remiStatsContent).toContain("'directory-sender-rejected'");
    expect(profileBannerController).toContain('deps.phase("profile", "banner-control-mounted")');
    expect(profileBannerController).toContain('deps.phase("profile", "banner-removed")');
    expect(remiStatsContent).toContain("recordRuntimePhase('poke', 'control-mounted')");
    expect(contentRuntime).toContain('key === "runtimePhase"');
    expect(hubAppCard).toContain('item.dataset.remistatsRuntimePhase = "true"');
    expect(contentRuntime).toContain('error: "MESSAGE_POLICY_REJECTED"');
    expect(contentRuntime).not.toContain("remistatsRuntimePhases.handle");
    expect(contentRuntime).not.toContain("remistatsRuntimePhases.token");
  });

  it("renders a directory-confirmed trophy shelf when public profile data is empty", () => {
    expect(trophyBannerMedia).toContain("const shelfUrl = legacyBeetleTrophyShelfUrl(username, deps.baseUrl)");
    expect(trophyBannerMedia).toContain("await loadImage(url, false)");
    expect(trophyBannerMedia).toContain("remember(cache, username, url)");
    expect(profileBannerController).toContain('await upgrade(identity?.remiliaUsername || "", handle, path)');
    expect(remiStatsContent).toContain("findExactProfileBannerRoot(document, cleanExactXHandle(xHandle))");
    expect(profileBannerController).toContain("for (const delay of [0, 200, 600, 1400])");
    expect(remiStatsContent).not.toContain("document.querySelector('[data-testid=\"UserProfileHeader_Items\"]')");
    expect(remiStatsContent).toContain("type: 'reminetIdentity:resolve'");
    expect(remiStatsContent).toContain("exactDirectoryProfileIdentity(response, cleanXHandle)");
    expect(remiStatsContent).toContain("void reconcileProfileTrophy(surface.handle || profileUsernameFromUrl())");
    expect(profileBannerController).toContain("deps.exactXHandle(deps.profileUsername()) !== handle");
    expect(remiStatsContent).toContain("function clearRemiStatsBadges() {\n  resetProfileTrophyBanner();");
    expect(remiStatsContent).not.toContain("type: 'remistats:resolveProfileIdentity'");
    expect(remiStatsBackground).not.toContain("resolveProfileIdentity");
    expect(profileBannerController).toContain("!username || deps.confirmed(username, handle)");
    expect(remiStatsContent).not.toContain("isConfirmedPokeTarget(remiliaUsername, xHandle)");
    expect(remiStatsContent).not.toContain("Edit profile");
  });

  it("suppresses stale or mismatched trophy results across SPA profile changes", () => {
    expect(profileBannerController).toContain("const isCurrent = (generation: number, path: string, username: string, handle: string)");
    expect(profileBannerController).toContain("path === deps.pathname()");
    expect(profileBannerController).toContain("!username || deps.confirmed(username, handle)");
    expect(remiStatsContent).toContain("export function onRouteChange(route)");
    expect(remiStatsContent).toContain("resetProfileTrophyBanner()");
    expect(remiStatsContent).toContain("processedProfiles.clear()");
    expect(profileBannerController).toContain("if (!isCurrent(generation, path, clean, cleanHandle))");
    expect(profileBannerController).toContain("[data-milxdy-trophy-banner-user], [data-milxdy-trophy-banner-state]");
    expect(remiStatsContent).not.toContain("root.dataset.milxdyTrophyBannerState === 'loading') return");
  });
});
