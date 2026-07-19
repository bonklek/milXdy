# RemiNet OAuth and identity

milXdy already has RemiNet auth support. BlobMail should use that where possible instead of creating a separate X OAuth flow immediately. The relevant pattern is OIDC-style identity, not RemiNet hosting the key registry.[^oidc]

Existing local code:

- `src/shared/remiliaAuth.ts`
- RemiliaNET OIDC endpoints under `https://www.remilia.net`
- short-lived RemiliaNET access token handling
- browser-session SSO reuse

## Related docs

- [Master architecture](./master-architecture.md)
- [Privacy technology options](./privacy-tech.md)
- [Posting client](./posting-client.md)
- [Frontend privacy/cost modes](./frontend-modes.md)

## Goal

Use RemiNet authentication as the first identity bridge:

```text
RemiNet-authenticated user
  -> verified X account / Remilia identity
  -> messaging public key registration
```

## Why this helps

If RemiNet already verifies X account ownership, BlobMail does not need users to:

- post public verification tweets;
- manually copy challenge strings;
- authorize another OAuth client;
- expose registration via public X profile changes.

It also fits milXdy's current user model.

## Desired identity claims

BlobMail needs a reliable statement like:

```json
{
  "subject": "remilia-user-id",
  "x_handle": "bob",
  "x_account_id": "12345",
  "verified_at": "timestamp",
  "issuer": "remilia.net"
}
```

Then BlobMail can bind:

```text
H(x_account_id or normalized_handle) -> messaging_public_key
```

Prefer stable X account ID over mutable handle where possible.

## Enrollment flow

```text
Bob opens BlobMail app
  -> milXdy checks RemiNet session
  -> Bob generates messaging keypair locally
  -> app reads the X-account identity exposed by RemiNet auth
  -> Bob signs/approves key registration
  -> non-RemiNet registry stores key mapping or commitment
```

## Registry design options

### Public registry

Stores:

```text
identity_hash -> messaging_public_key
```

Ethereum stealth-address standards are useful prior art here because they separate public identity/key publication from recipient scanning and private receipt.[^erc6538][^erc5564]

Pros:

- simple;
- easy lookup;
- easy client implementation.

Cons:

- reveals enrolled identities if hash input is guessable;
- public key rotation history may be visible.

### Commitment registry

Stores commitments instead of directly enumerable identity mappings.

Pros:

- more privacy-preserving;
- flexible migration path.

Cons:

- more complexity;
- harder lookup UX.

Initial recommendation:

1. Use RemiNet authentication to verify which X account the local user controls.
2. Publish the user's messaging public key through a registry not hosted by RemiNet.
3. Use a public registry for the first version if gas is acceptable.
4. Keep the resolver interface compatible with future salted commitments or private lookup.

## Sender identity disclosure

A sender may optionally include an encrypted identity claim inside the message:

```text
from: @alice
claim: local identity claim or registry-linked identity reference
signature: Alice messaging key signature
```

This is visible only to Bob after decryption.

Anonymous mode should omit or minimize sender claims.

## Key rotation

Users need:

- current messaging public key;
- rotation mechanism;
- revocation;
- backup/recovery;
- multi-device support;
- stale-key handling.

Open issue: multi-device support is nontrivial because Bob's private key must be available on each receiving device or messages must be encrypted to multiple device keys.

## References

[^oidc]: [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html), relevant to RemiNet OAuth/OIDC identity assertions.
[^erc6538]: [ERC-6538: Stealth Meta-Address Registry](https://eips.ethereum.org/EIPS/eip-6538), relevant prior art for publishing recipient key material.
[^erc5564]: [ERC-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564), relevant to identity-to-recipient-key privacy patterns.
