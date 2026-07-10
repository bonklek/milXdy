# RemiStats User Guide

RemiStats adds RemiStats profile and user metrics to X/Twitter, including badges, score context, beetle indicators, and poke affordances.

## Where To Find It

- Open the extension popup.
- Use the RemiNet/RemiStats settings in the suite controls.
- Look for badges and action icons on supported X/Twitter profile, post, and user surfaces.

## Common Tasks

- Enable **RemiNet connector badges** to show score badges.
- Enable **Tooltips** for detailed RemiStats information on hover.
- Toggle **Score icon**, **Beetle icon**, and **Poke icon** independently.
- After a successful poke, visible poke buttons for the same account update together to the active cooldown state.
- Use **Sounds** and **Sound volume** to control RemiStats effects.
- If the poke icon is missing, confirm RemiNet connector icons and **Poke icon** are enabled, then refresh X/Twitter.

## Notes

RemiStats fetches profile and user data for visible handles from RemiStats and related Remilia services. Poke cooldowns are stored locally so state can survive a refresh, including fallback cooldowns when RemiliaNET does not return an explicit value.

Poke controls appear only after the visible X/Twitter handle resolves to a confirmed RemiliaNET identity. Unknown, failed, and non-member lookups stay hidden while independent score or beetle information remains available when returned by the service.
