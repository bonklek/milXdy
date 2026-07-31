# Beetol User Guide

Beetol adds the Beetol RemiStats game panel to the milXdy side rail.

## Where To Find It

- Open X/Twitter.
- Enable and pin **Beetol** from Apps & Features.
- Open **Beetol** from the side rail.

## Common Tasks

- Use **Open RemiliaNET** to start RemiliaNET login in the browser.
- Complete RemiliaNET login, including any 2FA step.
- Return to milXdy and use **Retry session**.
- Enable **Show Beetol hunt panel** when you want the hover panel.
- Adjust **Beetol color** and **Beetol mode** for the panel style.

## Notes

Beetol uses the same RemiNet connector login as RemiStats pokes and RemiNet Chat. Authenticated game actions are sent to RemiliaNET after user interaction.

Cooldown and exhausted hunt state are restored locally after refresh so the panel does not incorrectly reset the visible hunt timer.

In the RemiliaNET Beetle Crafting cartridge, single-clicking an inventory item still opens its normal inspection. Double-click an eligible item to place it in the next compatible empty slot; hammers go to the empty hammer slot, and opening the craft UI fills an empty sacrifice slot with an available green beetle when possible. These shortcuts select and place through the site's existing UI only; they do not craft or submit automatically.

On the final available hunt, Beetol keeps the found-item result visible briefly before showing a red **Done** status and the normal 90-minute cooldown countdown.
