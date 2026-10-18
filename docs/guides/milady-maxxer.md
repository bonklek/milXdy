# Milady Maxxer User Guide

Milady Maxxer applies Max mode styling, optional Milady image detection, XP behavior, cards, badges, and the Maxxer side panel.

## Where To Find It

- Open the extension popup.
- Use the **Maxxer** tab for Maxxer behavior.
- Enable and pin **Maxxer** from Apps & Features to use the side panel.

## Common Tasks

- Use **Milady effects** for the normal match experience.
- Use **Debug** only when checking detection markers and scores.
- Use **Off** to disable Maxxer behavior.
- Choose a **Card theme** for tier styling.
- Enable **RemiStats beetle users** to treat accounts with RemiStats beetle data as Maxxer matches.
- Add **Whitelist handles** to exclude accounts from normal scoring or XP behavior.
- Add **Manual Milady handles** when an account should always count as a Milady match.

## Successful poke counts

The Maxxer panel shows successful outgoing RemiStats/RemiNet pokes sent through milXdy, how many were directed to already tracked profiles, and the last success time. The official background API success is the counting boundary. Cooldown, authentication, network and other failed attempts do not count; repeated copies of one success receipt do not add another count. Existing successful-poke XP behavior is unchanged.

Counts belong to the X account active when the request starts. A response arriving after an account switch remains with the initiating account. Without a known X account, no unscoped poke history is created. If the optional poke summary cannot load, XP and collection still load; the panel shows **Poke statistics are unavailable**, disables reset and offers **Retry poke statistics**. It never presents a failed read as an empty history. The panel’s **Reset poke counts** asks for confirmation and preserves XP, likes, collection and other accounts. In-flight results from before a reset are excluded even after the service worker restarts.

Totals and last-success time stay locally until reset or extension data is cleared. No target handles, names, message contents or per-target history are retained. Up to 256 receipt hashes support a 90-day duplicate window; expired hashes are removed on the next update/reset. A bounded high-water mark prevents evicted receipts from being replayed. Reset preserves this temporary duplicate protection. This is a local summary, not a server leaderboard or an incentive to bypass cooldowns.

Future local statistics panels can use `readPokeStatistics(storage, xAccountScope)` from `src/apps/milady-maxxer/shared/poke-statistics.ts`; it exposes only totals, last-success and reset timestamps.

## Notes

Avatar inference runs locally in the extension context using packaged model assets. Some supporting identity context can come from RemiStats, RemiliaNET, and public Ethereum RPC services.
