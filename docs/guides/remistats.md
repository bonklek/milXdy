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
- If milXdy reports a missing ability, use **Remilia account > Reconnect** and
  review `remilia:stats.read`, `remilia:notifications.read`,
  `remilia:pokes.write`, and `remilia:directory.read` as applicable.

## Notes

RemiStats continues to fetch public reputation data from RemiStats. Official
Remilia API-v1 profile and directory endpoints resolve Remilia/X/GitHub/Discord
identities, while delegated stats, notifications, and poke endpoints use the
connected account. API-provided cooldowns and `next_allowed_at` are
authoritative; local cooldown state is only a labeled offline fallback.

Poke controls appear only after the visible X/Twitter handle resolves to a confirmed RemiliaNET identity. Unknown, failed, and non-member lookups stay hidden while independent score or beetle information remains available when returned by the service.
