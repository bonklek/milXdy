---
name: remilia-wiki-article-writer
description: Guide an AI assistant through interviewing a user and drafting ready-to-paste Remilia Wiki article wikitext. Use when a user wants help turning a Remilia-related concept, event, person, project, meme, token, artwork, collection, or source material into a MediaWiki article draft.
---

# Remilia Wiki Article Writer

Your job is to interview the user, research comparable Remilia Wiki pages when web access is available, and produce a ready-to-paste MediaWiki wikitext draft. Do not publish to the wiki. The final answer must be a single copy-pasteable wikitext block plus a short list of unresolved citation or fact gaps.

## Prefer Wikitool When Available

If the user provides the official `remiliacorporation/remilia-wikitool` release or AI pack, use that first. Its `AGENTS.md`, `codex_skills/`, and `writing_context/` files are the canonical Remilia Wiki authoring workflow.

When the local `wikitool` binary is available, start with:

```bash
wikitool workflow session-refresh
wikitool knowledge article-start "<Topic>" --intent new --format json --view brief
```

Then use the Wikitool knowledge-interview guidance before drafting. Use this lightweight skill only as a chat-only fallback when the assistant cannot run Wikitool or cannot read the official AI pack.

## Start

1. Ask for the page title or saved phrase.
2. Classify the target as one or more of: concept, event, person/social media personality, organization/collective, artwork/project, NFT collection, token, website/tool, phrase/meme, place/scene, publication/writing, or other.
3. Ask whether the user wants a stub, standard article, or substantial article:
   - Stub: 150-350 words.
   - Standard: 500-900 words.
   - Substantial: 900-1500 words.
4. Ask the user for source material: links, posts, screenshots, notes, dates, participants, and related wiki pages.
5. Read `references/article-patterns.md` for article shape and `references/interview-guide.md` for targeted questions.

## Research

When web access is available, consult Remilia Wiki before drafting:

1. Search `wiki.remilia.org` for the page title, aliases, related names, and likely parent topics.
2. Open 3-5 comparable articles by type.
3. Identify internal pages to link on first mention only.
4. Note useful templates, infoboxes, section names, categories, citation style, and naming conventions.
5. Do not invent citations. If a claim lacks a source, mark it with `{{Citation needed}}` or put it in the fact-gap list.

When web access is unavailable, ask the user to provide comparable article names or excerpts and proceed cautiously.

## Interview Rules

Ask concise batches of questions. Do not ask everything at once. Keep going until you can separate:

- Known facts with sources.
- User-provided claims that need citations.
- Interpretive context.
- Speculation or uncertain lore that should be omitted or labeled carefully.

Always ask about:

- Dates: origin date, launch date, event date, active period, important milestones.
- People and entities: creators, participants, affiliated groups, aliases, handles.
- Influences: aesthetic, philosophical, internet, art, crypto, anime, music, or scene influences.
- Relationship to Remilia: why the topic belongs on Remilia Wiki.
- Related pages: existing wiki pages that should be linked.
- Evidence: links to posts, announcements, blog posts, archives, marketplaces, contracts, repositories, or media coverage.

## Drafting Rules

Write in neutral encyclopedia style. Avoid hype, advocacy, inside jokes without explanation, and unsupported claims.

Use this common article skeleton unless the comparable pages suggest a better fit:

```wikitext
{{SHORTDESC:Brief neutral description}}
{{Article quality|stub}}

'''Page Title''' is ...

== Overview ==

== Background ==

== Significance ==

== See also ==
* [[Related page]]

== References ==
<references />

[[Category:Relevant category]]
```

For larger pages, add specific sections such as `History`, `Launch`, `Development`, `Themes`, `Reception`, `Controversies`, `Tokenomics`, `Related projects`, or `External links`.

Use internal links like `[[Milady Maker]]` on first mention only. Use display text when needed, for example `[[Remilia Corporation|Remilia]]`.

Use citation templates when sources are available:

```wikitext
<ref>{{Cite web|url=|title=|website=|date=|access-date=}}</ref>
<ref>{{Cite post|url=|title=|author=|date=|website=X}}</ref>
<ref>{{Cite tweet|url=|author=|date=|title=}}</ref>
```

Do not include raw markdown links in the final wikitext.

## Final Output

Before finalizing, ask the user to confirm names, dates, and any claims that could be controversial.

Then provide:

1. A single fenced `wikitext` block containing the full article draft.
2. A short list of unresolved gaps, citations needed, and suggested existing wiki pages to link.

Do not include conversational notes inside the wikitext block.
