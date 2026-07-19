# Miladychan Master Plan Notes

Source: https://archive.org/details/miladychan-master-plan/

Read date: 2026-06-27

Archive item: `MILADYCHAN MASTER PLAN`, attributed on Archive.org to Remilia Jackson, publication date 2024-04-01. Notes are based primarily on the Internet Archive OCR text file. The OCR is noisy, so these notes paraphrase the argument rather than preserving exact wording.

## Core Thesis

Miladychan is not just an imageboard skin. It is positioned as a BBS plus IRC hybrid: an anonymous/transient board whose central differentiator is hyperrealtime/supersynchronous text, where participants can see text as it is being composed before final submission.

The document treats this as a change in social physics, not a novelty interaction. The claim is that hyperrealtime makes imageboard conversation feel closer to live speech while preserving the public, pseudonymous, transient structure of a board. The intended result is a low-body-count social environment that can become active, sticky, self-organizing, and easier to splinter than traditional boards.

For milXdy, the important product lesson is that Miladychan should not be reduced to "trending threads from another site." The integration should respect live presence, active momentum, multiple simultaneous conversations, pseudonymous texture, and board-level culture.

## What The Document Argues

### Hyperrealtime Is The Product

The document distinguishes ordinary realtime chat from supersynchronous communication. IRC, Discord, and Telegram deliver messages instantly after send. Miladychan's differentiator is exposing the drafting process itself.

Claimed effects:

- Typing cadence carries emotion and creates conversational intimacy.
- Visible composition creates opportunities for interruption, more like speech.
- The channel demands attention because there is always something forming, not only completed messages.
- The environment can sustain apparent activity with far fewer users than a static board.
- Participants report difficulty looking away, which the document treats as proof of stickiness.
- Old realtime experiments retained lingering communities even after direct management stopped.

Implication for milXdy:

- A static polling widget is only a partial integration. It can help discovery, but it does not carry the core Miladychan experience.
- Any future richer integration should surface liveness explicitly: active typers if upstream exposes them, rapid post updates, connected counts, current general, new reply pulses, board radio, and "conversation is alive now" cues.
- Avoid making Miladychan feel like a newsletter/feed module. The source philosophy is closer to "walk into the room."

### Imageboard Plus IRC, Not Forum Plus Chat

The document repeatedly frames Miladychan as preserving imageboard affordances while borrowing the immediacy of chat:

- Public board format rather than private groupchat.
- Casual pseudonymity instead of account-first social identity.
- Transient posts and fast cultural turnover.
- Sticky/generals that behave like live rooms.
- Static threads retained as asynchronous BBS discussions.

The proposed ideal board separates the "general" from ordinary threads:

- The general is realtime and recurring, effectively the active room for a tribe.
- Traditional threads remain static, temporal, and asynchronous.
- The UX should expose both at once so a user entering a board sees the live flow and the longer-lived discussion surface.

Implication for milXdy:

- Our Miladychan feature should distinguish "live board pulse" from "thread browser." Today the spotlight is mainly a board/thread browser. A future version should make the board's current active room first-class.
- "General" should not be buried as just another thread if upstream makes it identifiable.
- Thread previews should bias toward "where conversation is happening now" rather than just newest or most posts.

### Low Unit Sustainability And Free Exit

The document's strategic claim is that traditional imageboards need many active users to feel alive, while hyperrealtime boards can feel alive with a much smaller active population. This lowers the barrier to exit: dissatisfied groups can split without needing hundreds of users to avoid death.

This is tied to a broader anti-lock-in design philosophy:

- Traditional boards degrade when communities cannot leave bad administration or changed culture.
- Realtime boards make splinters more viable because a small number of bodies can sustain momentum.
- Healthy communities need realistic exit paths; otherwise hidden rot accumulates.

Implication for milXdy:

- Treat board/community portability and discovery as aligned with the philosophy. Features that help users find, compare, and move among boards are not secondary.
- Avoid centralizing everything into a single milXdy-controlled social surface. milXdy should amplify routes into Remilia/Miladychan spaces, not absorb them.
- Any "recommended board" UI should avoid trapping users in one canonical channel. Let users watch several board pulses.

### Managed Growth, Not Infinite Channel Creation

The strategy section argues that new forum/channel leaders make two mistakes:

- They assume new channels create activity rather than splitting existing activity.
- They assume channels organize topics rather than tribes.

The document treats a board as a social tribe informed by a topic, not defined by it. New boards should be created only when an existing channel has enough surplus discussion and a specific user grouping to sustain both old and new spaces.

The suggested growth path:

- Seed core culture privately with Milady and Remilio boards.
- Gate early spaces until norms are legible.
- Open later after a clear culture exists, so newcomers assimilate or are shamed out by community pressure.
- Expand hobby boards only when recurring generals already demonstrate demand.
- Use artificial colonization carefully: temporarily sustain a new splinter with existing users until fresh users can keep it alive.

Implication for milXdy:

- Do not design discovery purely around "more boards equals better coverage." The design should highlight active, culturally coherent spaces.
- Board creation, board lists, and board promotion should communicate activity health, not only categories.
- For any future social feature in milXdy, resist adding tabs/channels just to organize ideas. Add a new surface only when it has enough existing demand to stay alive.

### Community Moderation As Social Mechanism

The document values community-level cultural moderation over heavy central moderation. It discusses "sage" as a historical shaming mechanism and proposes a mute-vote variant, while acknowledging risks:

- It can help the community respond to poor posting or raids without relying on moderators.
- It can reduce disruptive same-person spam without exposing pseudonymity.
- It risks capture by raiders or conformist use against opinions rather than manners.
- It needs more research and possibly sybil detection.

Implication for milXdy:

- Avoid adding external judgment layers that look like Reddit voting or algorithmic quality scoring.
- If milXdy adds reactions or filters around Miladychan, keep them lightweight and local unless upstream owns the social semantics.
- "Shame/mute/moderate" mechanics belong to the native community, not to our overlay.
- Local controls can protect the user experience, but should not pretend to govern the board.

### Reactions Are Lurker On-Ramps

The document argues reactions can lubricate conversation because they let people signal without composing a full reply. It specifically frames reactions as useful for lurkers before they enter a posting mindset.

This is notable because imageboard culture often resists reaction mechanics. The document's defense is that realtime behaves more like IRC than static forum discussion, so low-cost signals are less alien.

Implication for milXdy:

- The extension already has several one-click social gestures: poke, Beetol actions, like/reply ideas. That fits the "lurker on-ramp" principle when it lowers activation energy without replacing posting.
- A Miladychan integration could eventually show native reactions if upstream supports them, but should not invent fake reactions that fragment the social state.
- For X/Twitter augmentation, small gestures should lead back into richer Remilia conversation rather than becoming dead-end engagement toys.

### Shyposting Is A Product Pattern

The document recognizes that live drafting feels too exposed for some users. It rejects ordinary static posting as less elegant, and proposes shyposting: the system still broadcasts the act and cadence of typing, but masks the text until submission.

The important design move is not the specific visual mask. It is the compromise:

- Preserve participation in live flow.
- Reduce vulnerability for hesitant users.
- Let users overcome initial fear through practice.
- Do not remove the core realtime property.

Implication for milXdy:

- This is a general design pattern: privacy/anxiety controls should preserve the social signal when possible.
- For Postreader, RemiNet chat, Miladychan, or future composer tools, prefer "show presence without leaking content" over binary visible/invisible modes.
- If we ever add a composer bridge, shyposting should be a named inspiration for drafts, previews, or ephemeral status.

### Multitrack Posting And Power Navigation

The document criticizes one-thread-at-a-time imageboard UX. Desktop screens can support several conversations, and users miss the moment when asynchronous discussion could become synchronous.

Proposed interventions:

- Split-window format showing multiple conversations.
- Watch/notify for new posts or replies.
- Full keyboard controls for power posting and rapid navigation.

Implication for milXdy:

- The current Miladychan spotlight is a single narrow panel. That is acceptable as discovery, but not as the mature interpretation.
- A future "Miladychan deck" could allow boards/threads as columns, similar to a terminal multiplexer or TweetDeck, but visually Remilia-native.
- Keyboard shortcuts matter if this becomes a serious social tool: board switching, next active thread, open original, refresh, collapse media, focus reply.
- Watchlists are probably more valuable than generic trending: "tell me when this thread wakes up" and "show replies to things I touched."

### Hyperfinancialization As Bootstrapping, Not The Goal

The document frames money, points, NFTs, and incentives as tools for bootstrapping social formation. It criticizes Web3 social attempts that buy engagement for otherwise weak platforms.

Its stated goal is retentive engagement and eventual post-money value:

- Early financialized incentives attract and coordinate users.
- Anti-farming must make authenticity the best strategy.
- Rewards should value multifactor organic participation, not isolated actions.
- Randomization, rotating weights, delayed gratification, and hidden seeds reduce farming.
- Over time, participation in the network culture should become more valuable than points.

Implication for milXdy:

- Beetol, pokes, XP, streaks, and future tipping should point toward authentic use, not farmable counters.
- Avoid exposing exact scoring formulas for social rewards.
- Prefer broad participation signals over "do one repeated action forever."
- Streaks and daily claims should be fun and culturally legible, but should not become the whole product.
- Metrics dashboards should avoid training users into cynical optimization.

### Remilia Integrations Are Cultural Infrastructure

The document lists integrations that turn existing Remilia assets into native social value:

- Gated tribal boards for holders and high-level non-holder posters.
- Beetle Game as daily habit training and future currency metaphor.
- Banner NFTs as cultural ads linking back to listings rather than ordinary ad inventory.
- Kagami mascots as desktop buddies, later possibly AI-augmented.
- Lifestyle radio: board-specific, album-by-album, synchronized listening.
- Miladybooru, named but not detailed in the visible OCR section.

Implication for milXdy:

- milXdy is already adjacent to several of these: Beetol, Miladymaxxer, music player ideas, banner randomizer, Meme Depot, Remilia Wiki.
- Treat these as one ecosystem rather than independent gimmicks. A feature should either deepen identity, route attention, create habit, or increase cultural context.
- The music-player idea becomes more important after reading this. Board-synchronized radio is explicitly part of the Miladychan social design. Local lifestyle radio can be a personal milXdy adaptation.
- Kagami/desktop buddy work should be tied to presence and companionship, not only decoration.

### Anonymity, Transiency, And Culture Production

The appendix argues traditional imageboards are culturally powerful because anonymity and transiency reduce reputation attachment and historical accountability. This creates freer discussion, faster contradiction, and a kind of distributed think tank.

It also argues those same boards suffer predictable decay:

- Active boards tend to grow.
- Foreign influx can shift norms faster than newcomers assimilate.
- Heavy moderation can remove the community's ability to enforce its own taste.
- Exit is hard because most splinters cannot reach enough activity.
- Realtime lowers the activity threshold for splinters.

Implication for milXdy:

- Account-based overlays should not overwrite pseudonymous context.
- Do not force identity-rich X/Twitter assumptions onto Miladychan. Cross-linking should be opt-in and careful.
- It is fine for milXdy to add discovery from X into Miladychan, but the bridge should not de-anonymize or reputationalize the board.
- The strongest design posture is "companion and portal," not "identity manager."

### Barkley's Thesis: Design As Culture-Formation

The final appendix is written mythically, but its useful product point is concrete: hyperforums are treated as self-organizing systems where anonymous actors, high information density, rapid cultural development, and isolated symbolic language create emergent actions.

In practical terms:

- The product is not only communication. It is culture formation.
- Small UI changes can alter the system's emergent behavior.
- Closed or semi-closed microcosms create internal symbols and narratives.
- Designers are not just arranging content; they are changing the conditions of self-organization.

Implication for milXdy:

- Every engagement mechanic should be evaluated as a cultural intervention, not just a UI affordance.
- Features that look "cute" can still affect routing, status, pressure, or identity.
- We should keep a philosophy checklist for social features: does this preserve pseudonymity where needed, increase authentic participation, avoid farm loops, respect exit, and deepen culture?

## Product Notes For Current Miladychan Spotlight

Current feature state from `src/features/miladychanSpotlight/content.ts`:

- Dock item labeled Miladychan.
- Default boards: `milady`, `remilio`, `a`, `ai`, `kpop`, `pol`, `v`, `all`.
- Board themes and a resizable/minimizable side panel.
- Fetching from `https://boards.miladychan.org`.
- Board/thread/thread-detail view modes.
- Good start as a discovery and browsing overlay.

Gaps relative to master-plan philosophy:

- It is not visibly hyperrealtime. It reads as a board browser.
- It does not foreground general/live room behavior.
- It does not support multitrack viewing.
- It does not expose watchlists or reply/new-post notifications.
- It does not connect Beetol, music/radio, banners, Kagami, or Miladymaxxer into one Miladychan ecosystem story.
- It does not yet distinguish "tribe health/activity" from plain topic browsing.

None of this means the current feature is wrong. It is a narrow MVP. The note for future work is that the long-term design should move from "spotlight" to "live cultural portal."

## Backlog Candidates

### Near-Term

- Rename internal concept from "Miladychan spotlight" to "Miladychan portal" only if/when it gains live features. Keep public naming stable until then.
- Add board activity ordering that weights connected users, recent update time, post velocity, and unique posters if upstream exposes them reliably.
- Add a compact "active now" strip for boards, not just a list of threads.
- Add local watchlist for boards/threads with browser notifications or dock badges.
- Add keyboard controls inside the panel: refresh, back, next board, previous board, open original.
- Add "open in Miladychan" affordances consistently, keeping the native site primary.
- Add local setting to pin favorite boards and hide boards the user does not care about.

### Mid-Term

- Build a multitrack Miladychan deck view: multiple boards/threads visible as columns.
- Add a live-mode panel if upstream APIs expose enough update data.
- Add a reply/new-post pulse state that helps catch the moment a static thread becomes synchronous.
- Integrate Beetol daily claim or status near Miladychan only if it routes into authentic use and does not crowd reading.
- Prototype lifestyle radio as a board or personal station. This connects directly to both the master plan and existing music-player ideas.
- Add banner NFT rotation as a cultural object, not as generic ad inventory.
- Add Kagami desktop mascot hooks only when they have real state, presence, or assistive behavior.

### Long-Term

- Miladychan + RemiNet social layer: account-based Remilia chat and pseudonymous Miladychan should be counterparts, not collapsed into one model.
- Cross-surface "Remilia pulse": X/Twitter, RemiNet, Miladychan, Wiki, Beetol, and music should show what is alive without requiring a single feed.
- Local anti-farming design principles for XP/stats: hidden weights, delayed rewards, broad activity, and no simple repeated-action optimization.
- A philosophy checklist for social features before implementation.

## Smaller Implementation Nuggets From Rereads

Rolling sticky:

- The document treats long-lived sticky threads as infrastructure and social-design problems.
- A rolling sticky can either reset at a post limit or delete older posts as new ones arrive.
- For milXdy, this suggests that "current live room" should be visually separate from ordinary archival threads, and old content should not be overprivileged just because it is attached to the main room.

Thread migration:

- The appendix describes realtime communities spontaneously migrating to a new thread when the current one becomes too large or slow.
- The timing is social, not purely mechanical: too early and migration fails; at the right moment it becomes obvious to the group.
- For milXdy, a future deck/watchlist should avoid forcing migration mechanics, but could make "new active successor thread" easy to notice.

Time-limited boards:

- The appendix notes boards that open and close on a schedule, concentrating users into active windows.
- This is another version of the same activity-density thesis: time constraints can make a smaller population feel alive.
- For milXdy, scheduled Remilia events, radio blocks, live board hours, or "show up now" prompts may be more culturally aligned than always-on passive feeds.

Liveboard terminology:

- The appendix notes that realtime boards create retroactive terminology for older boards and posts: static boards, deadposting, liveboards, live posting.
- For product copy, "live" is probably clearer to users than "hyperrealtime" in compact UI, while internal notes can keep the precise philosophy.
- Avoid overexplaining in UI. Let status, motion, and timing show the difference.

Typing speed as social signal:

- The appendix observes that realtime posting makes typing speed visible and culturally meaningful.
- This is a hidden affordance and also a vulnerability. It reinforces the need for shyposting-style privacy compromises.
- milXdy should be careful before exposing any cadence/presence data that upstream does not already expose intentionally.

Generals as emergent structure:

- Generals are described as a community innovation before they are a software feature.
- This matters because software should recognize recurring user behavior, not only impose formal categories.
- A future Miladychan view should detect active recurring centers of gravity rather than rely entirely on board names.

Stickies and generals as antecedents:

- Stickies and generals are presented as prior forms that already concentrate users into live-like spaces.
- Hyperrealtime makes that concentration explicit and more efficient.
- milXdy can use this to prioritize sticky/general surfaces when deciding what to preview.

Affiliate/invite incentives:

- The hyperfinancialization section discusses viral sales-like structures as directed persuasion.
- The useful milXdy takeaway is not to add aggressive referral mechanics by default. It is that if invitations or rewards exist, incentives should align inviter, invitee, and community quality.
- Any referral or growth mechanic should include anti-farming and culture-quality checks from the start.

Post-money transition:

- The document expects financial incentives to matter less once social/spiritual/cultural value is established.
- milXdy should not design permanent dependence on extrinsic rewards. The better endpoint is that users return because the Remilia network is alive and meaningful.

Public/private boundary:

- Gated boards are not framed as pure holder privilege. They are culture-seeding spaces, with possible non-holder entry for good posters and penalties still applying to holders.
- For milXdy, holder-aware features should not imply that ownership equals immunity, status dominance, or guaranteed cultural fit.

## Design Principles To Carry Forward

1. Preserve the native social physics.
   Do not turn Miladychan into a generic thread feed. If a feature removes liveness, transiency, or pseudonymity, it should be scoped as discovery only.

2. Surface aliveness.
   The valuable signal is not only "new content exists." It is "people are here now."

3. Organize around tribes before topics.
   Categories are secondary to active user groupings and culture.

4. Create fewer rooms with more life.
   New channels, tabs, and panels split attention. Add them only when demand already exists.

5. Let users watch multiple currents.
   Multitrack conversation is central to the proposed UX evolution.

6. Use small gestures as on-ramps.
   Reactions, pokes, claims, and lightweight actions are useful when they help lurkers enter richer participation.

7. Avoid farmable social mechanics.
   Incentives should reward authentic, broad, repeated participation without exposing a simple optimization path.

8. Keep identity boundaries intact.
   X/Twitter identity, RemiNet account identity, NFT ownership, and Miladychan pseudonymity are different modes. Bridges should be careful and mostly opt-in.

9. Favor companion/portal over replacement.
   milXdy should route attention into the Remilia ecosystem and improve context at the edge of the browser, not become a competing social network.

10. Treat UI as cultural governance.
    Sorting, notifications, reactions, badges, and visibility all change community behavior.

## Reread Pass Notes

First pass:

- Extracted the main thesis: supersynchronous realtime plus imageboard transiency/pseudonymity.
- Identified direct UX interventions: rolling sticky, shyposting, hybrid static/realtime boards, multitrack posting, watching/notifications, keyboard controls, reactions, sage mutevote.
- Identified ecosystem integrations: gated boards, Beetle Game, banners, Kagami mascots, lifestyle radio, Miladybooru.

Second pass:

- The strongest design insight is not any single feature. It is the idea that small interaction changes alter self-organization. This should influence all milXdy social features.
- "Channels are tribes, not topics" is a major planning rule. It applies to extension UI too: do not add a surface just because a label exists.
- The document values exit and splintering. milXdy should avoid becoming another centralizing layer.
- Financial incentives are framed as temporary scaffolding for culture, not an end state. This is directly relevant to Beetol, stats, leaderboards, and tipping ideas.

Third pass:

- The current Miladychan spotlight is best understood as a discovery MVP, not the final form.
- Lifestyle radio was more important than it seemed from existing music-player notes because it is explicitly designed to unify board experience over time.
- Shyposting is a reusable privacy pattern for live social tools.
- Watchlists and multitrack views are higher-signal future work than simply adding more board categories.

## Open Questions

- Does the current Miladychan upstream API expose live typing state, connected users per thread, or only board/thread JSON summaries?
- Is there a reliable way to identify generals versus ordinary threads?
- Are reactions, sage, daily claims, gated boards, banners, and radio implemented upstream today, planned only, or partially present?
- Should milXdy's Miladychan feature remain a side overlay, or should a larger deck-style view be an app-platform surface?
- Where should a future philosophy checklist live: `ideas/running-ideas.md`, `PLANNING.md`, or a dedicated `docs` design note?

## Source Handling Notes

- OCR contains repeated Archive/CIA-style page artifacts and several misread headings.
- Exact wording should be verified against the PDF before quoting in public docs.
- These notes are for internal product/design planning, not public documentation.
