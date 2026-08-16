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

  it("logs only bounded poke failure fields and renders no target in diagnostics", () => {
    expect(remiStatsContent).toContain("category: String(response?.category || 'unknown')");
    expect(remiStatsContent).toContain("code: String(response?.code || 'unknown_error')");
    expect(remiStatsContent).not.toContain("console.warn('RemiNet poke failed', { username, response })");
    expect(popup).not.toContain("Target: ${String(diagnostic.username");
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
    expect(remiStatsContent).toContain("type: 'remistats:pokeXAuthor'");
    expect(remiStatsContent).toContain("expectedRemiliaUsername: username");
    expect(remiStatsBackground).toContain("remiStatsOfficialService.pokeXAuthor(message.xHandle, message.expectedRemiliaUsername)");
    expect(remiStatsContent).not.toContain("confirmPokeIdentity(userData.remiliaUsername)");
    expect(remiStatsOfficialApi).toContain('authStatus.phase === "connected" || authStatus.phase === "missing-scope"');
    expect(remiStatsOfficialApi).not.toContain('private async connectedAuthUsername()');
    expect(remiStatsOfficialApi).toContain("target.remiliaUsername !== authUsername");
  });

  it("reconciles one launcher after rerender and exposes action failures visibly", () => {
    expect(remiStatsContent).toContain("await reconcileExistingPokeLauncher(element, ownBadge)");
    expect(remiStatsContent).toContain("for (const duplicate of existingGroups) duplicate.remove()");
    expect(remiStatsContent).toContain("findOwnedNode(element, '[data-testid=\"reply\"], [data-testid=\"like\"], [data-testid=\"unlike\"]')");
    expect(remiStatsContent).toContain("button.dataset.reminetPokeMessage = label");
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
    expect(remiStatsContent).toContain("recordRuntimePhase('profile', 'banner-control-mounted')");
    expect(remiStatsContent).toContain("recordRuntimePhase('profile', 'banner-removed')");
    expect(remiStatsContent).toContain("recordRuntimePhase('poke', 'control-mounted')");
    expect(contentRuntime).toContain('key === "runtimePhase"');
    expect(contentRuntime).toContain('phaseSummary.dataset.remistatsRuntimePhase = "true"');
    expect(contentRuntime).toContain('error: "MESSAGE_POLICY_REJECTED"');
    expect(contentRuntime).not.toContain("remistatsRuntimePhases.handle");
    expect(contentRuntime).not.toContain("remistatsRuntimePhases.token");
  });

  it("renders a directory-confirmed trophy shelf when public profile data is empty", () => {
    expect(remiStatsContent).toContain("const trophyShelfUrl = legacyBeetleTrophyShelfUrl(clean, REMILIA_BASE_URL)");
    expect(remiStatsContent).toContain("await preloadDisplayImage(trophyShelfUrl)");
    expect(remiStatsContent).toContain("rememberTrophyBanner(clean, trophyShelfUrl)");
    expect(remiStatsContent).toContain("await upgradeProfileTrophyBanner(identity.remiliaUsername, cleanXHandle, profilePath)");
    expect(remiStatsContent).toContain("findExactProfileBannerRoot(document, cleanExactXHandle(xHandle))");
    expect(remiStatsContent).toContain("const delays = [0, 200, 600, 1400]");
    expect(remiStatsContent).not.toContain("document.querySelector('[data-testid=\"UserProfileHeader_Items\"]')");
    expect(remiStatsContent).toContain("type: 'reminetIdentity:resolve'");
    expect(remiStatsContent).toContain("exactDirectoryProfileIdentity(response, cleanXHandle)");
    expect(remiStatsContent).toContain("void reconcileProfileTrophy(surface.handle || profileUsernameFromUrl())");
    expect(remiStatsContent).toContain("exactXProfileHandle(profileUsernameFromUrl()) !== cleanXHandle");
    expect(remiStatsContent).toContain("function clearRemiStatsBadges() {\n  resetProfileTrophyBanner();");
    expect(remiStatsContent).not.toContain("type: 'remistats:resolveProfileIdentity'");
    expect(remiStatsBackground).not.toContain("resolveProfileIdentity");
    expect(remiStatsContent).toContain("isConfirmedProfileIdentity(remiliaUsername, xHandle)");
    expect(remiStatsContent).not.toContain("isConfirmedPokeTarget(remiliaUsername, xHandle)");
    expect(remiStatsContent).not.toContain("Edit profile");
  });

  it("suppresses stale or mismatched trophy results across SPA profile changes", () => {
    expect(remiStatsContent).toContain("function profileTrophyRequestIsCurrent(requestGeneration, profilePath, remiliaUsername, xHandle)");
    expect(remiStatsContent).toContain("&& profilePath === window.location.pathname");
    expect(remiStatsContent).toContain("&& isConfirmedProfileIdentity(remiliaUsername, xHandle)");
    expect(remiStatsContent).toContain("export function onRouteChange(route)");
    expect(remiStatsContent).toContain("resetProfileTrophyBanner()");
    expect(remiStatsContent).toContain("processedProfiles.clear()");
    expect(remiStatsContent).toContain("if (!profileTrophyRequestIsCurrent(requestGeneration, profilePath, clean, cleanXHandle)) return");
    expect(remiStatsContent).toContain("document.querySelectorAll('[data-milxdy-trophy-banner-user], [data-milxdy-trophy-banner-state]')");
    expect(remiStatsContent).not.toContain("root.dataset.milxdyTrophyBannerState === 'loading') return");
  });
});
