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

Cooldown and exhausted hunt state are restored after refresh from RemiliaNET's hunt count and last-hunt timestamp, with the local snapshot used between API refreshes. A server **Action is on cooldown** response therefore retains the actual remaining portion of the 90-minute cycle instead of starting a new 90-minute timer.

On the final available hunt, Beetol keeps the found-item result visible briefly before showing a red **Done** status and the normal 90-minute cooldown countdown.
