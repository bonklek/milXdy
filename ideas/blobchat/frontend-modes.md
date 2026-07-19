# Frontend privacy and cost modes

BlobMail should expose user choices through product modes, not protocol jargon. The underlying implementation may use AA/paymaster choices, anonymous sponsorship, and HPKE-style recipient encryption, but the UI should translate those into understandable modes.[^erc4337][^semaphore][^hpke]

The key rule:

> Optionality should affect the user's own cost, latency, funding privacy, transport privacy, and traffic-shape privacy. It should not alter the shared private-entry format in ways that weaken other users.

## Related docs

- [Master architecture](./master-architecture.md)
- [Privacy technology options](./privacy-tech.md)
- [Posting client](./posting-client.md)
- [Receiving client](./receiving-client.md)
- [Blob batching and settlement](./blob-batching-settlement.md)

## Suggested top-level lanes

### Private Standard

Default for most users.

- recipient-hiding encryption;
- relay-only network transport;
- shared blob batches;
- padded entries;
- ordinary paymaster or ephemeral session account;
- balanced batching delay.

### Private Anonymous

For users who care about hiding sender identity from chain observers.

- all Private Standard protections;
- ephemeral sender account;
- anonymous or semi-anonymous sponsorship;
- rotating peer identity;
- stronger relay settings.

### Private Maximum

For users willing to pay more or wait longer.

- anonymous sponsorship or shielded balance;
- multi-hop relay / Tor-compatible path;
- randomized chunk distribution;
- dummy chunks;
- stronger padding;
- delayed or disabled receipts.

### Public / Direct

Separate lane, not mixed into private batches.

- plaintext or explicitly public messages;
- direct app/server/gossip transport;
- cheaper and faster;
- no private-batch anonymity claims.

## Compose controls

Simple UI:

```text
Privacy: Standard / Anonymous / Maximum
Speed: Economy / Balanced / Fast
Large message handling: Efficient / Mixed / Obfuscated
Max spend: [amount]
Expires after: [time]
```

Advanced UI:

```text
sender account mode
paymaster mode
relay mode
padding class
chunk distribution
dummy budget
erasure coding
receipt policy
RPC/data source
```

## Speed modes

### Economy

- waits longer;
- lower bid escalation;
- best cost efficiency;
- larger anonymity set likely because batches fill more naturally.

### Balanced

- moderate wait;
- moderate fee;
- default mode.

### Fast

- higher bid;
- may seal current shared batch early;
- should not default to dedicated one-message blobs.

## Large-message modes

### Efficient

Minimum padded chunks.

Example:

```text
70 KB message -> 32 KB + 32 KB + 8 KB public classes
```

### Mixed

Variable logical chunks, but still standard public classes.

```text
logical: 19 KB, 7 KB, 26 KB, 18 KB
public: 32 KB, 8 KB, 32 KB, 32 KB
```

### Obfuscated

Adds:

- randomized logical chunks;
- dummy fragments;
- delayed release;
- possibly erasure-coded redundancy;
- spread across batches.

Higher cost and latency.

## Choices that should not be allowed in private lane

- exact arbitrary public entry sizes;
- plaintext private messages;
- public recipient fields;
- direct peer-to-peer WebRTC by default;
- dedicated one-message blob presented as equally private;
- public mapping from sender operation to blob entry index;
- persistent sender identity as the only default private path.

## Product copy direction

Avoid promising "anonymous" too broadly. Prefer precise language:

- "Hides the recipient inside shared encrypted batches."
- "Uses a temporary sender account."
- "Reduces IP exposure by routing through relays."
- "Costs more because it adds padding, delay, and sponsorship privacy."
- "Does not make timing or message volume disappear."

## References

[^erc4337]: [ERC-4337: Account Abstraction Using Alt Mempool](https://eips.ethereum.org/EIPS/eip-4337), relevant to paymaster and account-mode language surfaced through the UI.
[^semaphore]: [Semaphore documentation](https://docs.semaphore.pse.dev/), relevant to anonymous sponsorship modes.
[^hpke]: [RFC 9180: Hybrid Public Key Encryption](https://datatracker.ietf.org/doc/rfc9180/), relevant to explaining recipient-hiding encryption precisely.
