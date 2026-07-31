# Identifier Media Post Schema (Draft v1)

This draft is groundwork for the 0.2.8 identifier-media layer. It is not a new messaging protocol, identity system, or publishing path.

## Visible post format

```text
[milxdy:media/v1]
kind: music
id: isrc:USABC1234567
title: Example Track
creator: Example Artist
source: https://example.example/track
comment: Optional human-visible recommendation.
```

Supported `kind` values are `music`, `book`, `podcast`, `screen`, and `recipe`. Each has a constrained public identifier: ISRC, ISBN, a public feed/source URL, IMDb/TMDb, or a public recipe URL. Unknown fields, duplicate fields, malformed identifiers, non-HTTPS links, and unmarked posts are rejected.

## Board discovery

The default board allowlist is intentionally empty. A future media app must opt into specific upstream-approved public boards; it must not scan all Miladychan boards or make background requests.

## Provenance and identity

Every parsed item retains public native provenance: board, post ID, timestamp, native URL, and the post's visible author label. That proves only that the visible Miladychan post exists; it does not prove a cross-network identity.

An optional visible `identity:` HTTPS link is self-declared, not verified. The draft sends no RemiNet, X/Twitter, wallet, extension, cookie, or session data to Miladychan. RemiNet-friend discovery is explicitly unavailable until a documented endpoint, consent flow, scopes, local retention policy, revocation behavior, and user-facing explanation are approved.
