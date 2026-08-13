# Beetol User Guide

Beetol adds the Beetol RemiStats game panel to the milXdy side rail.

## Where To Find It

- Open X/Twitter.
- Enable and pin **Beetol** from Apps & Features.
- Open **Beetol** from the side rail.

## Common Tasks

- Open **Remilia account**, review the requested abilities, and use **Connect**.
- Beetle state and cards require the `remilia:beetle.read` ability. If it is
  missing or expired, use **Reconnect** and review consent again.
- Enable **Show Beetol hunt panel** when you want the hover panel.
- Adjust **Beetol color** and **Beetol mode** for the panel style.

## Notes

Beetol uses the same official Remilia account connection as RemiStats pokes and
RemiNet Chat. API-v1 state and card reads are official coverage. Hunt, craft,
the `catchBeetle`, `beetleHunt`, `claimUBC`, `junkFaucet`, `craft`, and public
trophy-shelf operations that do not yet have documented API-v1 equivalents use
separately labeled temporary legacy adapters and run only after user action.

Beetle state and discovered cards are read through the documented Remilia API v1 endpoints using the delegated `remilia:beetle.read` scope. milXdy normalizes missing inventory, hammer, charge, card, and cooldown fields locally so a partial response does not invent a ready action or discard a persisted cooldown.

Hunt, claim, faucet, Crunch All Junk craft mutations, and the public trophy-shelf texture still depend on explicitly labeled, undocumented legacy Remilia endpoints. Mutation adapters accept only fixed operations and validated item codenames, keep credentials in background code, and run only after a user action; the shelf image sends only the already-resolved public Remilia username and no bearer token or X browsing data. Each adapter is temporary: remove it once API v1 documents and live-verifies an equivalent scoped operation or shelf asset contract, or remove the related feature if Remilia retires the legacy endpoint.

Cooldown and exhausted hunt state are restored locally after refresh so the panel does not incorrectly reset the visible hunt timer.

Service cooldown and exhausted state are authoritative. A locally restored
cooldown is a labeled offline presentation fallback and is replaced by the next
successful official response.

In the RemiliaNET Beetle Crafting cartridge, single-clicking an inventory item still opens its normal inspection. Double-click an eligible item to place it in the first compatible empty slot; once all three assembly slots are occupied, subsequent placements target slots one, two, then three in order through RemiliaNET's native swap behavior. Hammers go to the hammer slot, and opening the craft UI fills an empty sacrifice slot with an available green beetle when possible. These shortcuts select and place through the site's existing UI only; they do not craft or submit automatically.

On the final available hunt, Beetol keeps the found-item result visible briefly before showing a red **Done** status and the normal 90-minute cooldown countdown.
