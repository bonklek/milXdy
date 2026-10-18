# Beetol User Guide

Beetol adds the Beetol RemiStats game panel to the milXdy side rail.

## Where To Find It

- Open X/Twitter.
- Enable and pin **Beetol** from Apps & Features.
- Open **Beetol** from the side rail.

## Common Tasks

- Open the milXdy extension popup, find **RemiNet → Account access → Official Remilia connection**, review the
  requested abilities, and use **Connect** or **Reconnect**. Beetol's panel only
  shows this passive instruction; it does not open or reuse a RemiliaNET website
  session.
- Beetle state and cards require the `remilia:beetle.read` ability. If it is
  missing or expired, use **Reconnect** and review consent again.
- The X/Twitter panel is read-only. Use its single **Play Beetle on RemiliaNET**
  link to open the visible Beetle cartridge, then use RemiliaNET's native
  controls for claim, hunt, faucet, and craft actions.
- Enable **Show Beetol status panel** when you want the hover panel.
- Adjust **Beetol color** and **Beetol mode** for the panel style.

## Temporary dual-auth holdover

The milXdy connection powers official reads. Native Hunt, Claim, and Craft
still use the separate RemiliaNET website sign-in. Check that sign-in on the
website: a connected milXdy status does not confirm it, and disconnecting
milXdy does not sign out the website.

## Notes

Beetol uses the same official Remilia account connection as RemiStats pokes and
RemiNet Chat. API-v1 state and card reads are official coverage. Hunt, craft,
the `catchBeetle`, `beetleHunt`, `claimUBC`, `junkFaucet`, `craft`, and public
trophy-shelf operations that do not yet have documented API-v1 equivalents use
separately labeled temporary legacy classifications. The visible RemiliaNET
page, not milXdy, performs those native actions after your direct click.
Beetol content reads token-free connection status only. It cannot disconnect
the account or invoke retired logout/session-status operations.

Beetle state and discovered cards are read through the documented Remilia API v1 endpoints using the delegated `remilia:beetle.read` scope. milXdy normalizes missing inventory, hammer, charge, card, and cooldown fields locally so a partial response does not invent a ready action or discard a persisted cooldown.

Hunt, claim, faucet, and Crunch All Junk craft mutations do not have documented API-v1 write operations. Use the visible controls on RemiliaNET: the page performs its native request with its own website session after your trusted click. milXdy does not read or forward that session, attach the official bearer, call the undocumented mutation route, or open a hidden action tab. The X/Twitter Beetol panel shows official read-only status instead of action tiles and provides one clearly labeled link to the visible RemiliaNET Beetle cartridge. The public trophy-shelf texture remains a separately labeled legacy public read; it sends only the already-resolved public Remilia username and no bearer token or X browsing data. Remove each typed action classification once API v1 documents and live-verifies an equivalent scoped operation, and remove the shelf adapter once an official asset contract reaches parity or the legacy image retires.

**Use instant Beetle results** is available only while the token-free connector status is active. It preserves your saved preference while disconnected, then restores it on reconnect. When enabled on RemiliaNET, it lets the trusted native Claim/Hunt click pass through unchanged, observes only the page's structural result or failure state, and accelerates the native presentation. It cannot submit or retry the action, read the native response body, or report success before RemiliaNET exposes a result.

Cooldown and exhausted hunt state are restored locally after refresh so the panel does not incorrectly reset the visible hunt timer.

Service cooldown and exhausted state are authoritative. A locally restored
cooldown is a labeled offline presentation fallback and is replaced by the next
successful official response.

In the RemiliaNET Beetle Crafting cartridge, single-clicking an inventory item still opens its normal inspection. Double-click an eligible item to place it in the first compatible empty slot; once all three assembly slots are occupied, subsequent placements target slots one, two, then three in order through RemiliaNET's native swap behavior. Hammers go to the hammer slot, and opening the craft UI fills an empty sacrifice slot with an available green beetle when possible. These shortcuts select and place through the site's existing UI only; they do not craft or submit automatically.

## Native crafting shortcuts

The **Reduce remilia.net Beetle Hunt motion** setting also enables selection
shortcuts on the native crafting page. Click once to inspect; double-click or
press **Shift+Enter** to select an available item for an empty slot. Right-click
an occupied material or hammer slot to clear its selection. The first deliberate
crafting gesture can select an available green sacrifice when that slot is empty.
You still review the selections and press the site's own **Craft** button.
Turning the setting off leaves native gestures unchanged and cancels pending
shortcut inspection. These shortcuts do not restore extension-side crafting
through the Remilia API.
