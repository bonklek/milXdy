import { describe, expect, it } from "vitest";
import { requiresRemiliaLogin } from "./remilia-setting-locks";

describe("account setting availability", () => {
  it("requires login for profile color, poke actions, game and chat settings across tabs", () => {
    for (const setting of ["visualUseRemiliaProfileColor", "visualIncomingPokeGold", "visualReminetChatOverlay",
      "remistats.likeAutoPoke", "remistats.pokeAutoLike", "pokes.placement", "pokes.autoLike",
      "beetol.color", "reminet.beetleInstantResults", "reminetChat.enabled", "reminetChat.sounds.send.volume", "remistats.sounds.volume"])
      expect(requiresRemiliaLogin(setting), setting).toBe(true);
  });
  it("keeps public badges, banners, Wiki and custom theme controls available", () => {
    for (const setting of ["remistats.enabled", "remistats.showTooltips", "remistats.banners.shelf",
      "wiki.enabled", "wikiSidebar.enabled", "visualInterfaceAccentColor", "rootVisuals.pfpShape", "interfaceSounds.volume"])
      expect(requiresRemiliaLogin(setting), setting).toBe(false);
  });
});
