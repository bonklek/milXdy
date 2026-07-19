# BlobMail master architecture

BlobMail is a private messaging app concept intended to live inside milXdy first, then potentially split into its own repo. The product target is a browser-extension messaging layer for X/Twitter users, using Ethereum-native availability and payment mechanisms where useful, while keeping the UX simple enough for normal users.[^eip4844]

The core product idea:

1. Alice opens Bob's X profile in milXdy.
2. milXdy resolves Bob's messaging public key.
3. Alice writes a message and chooses a privacy/cost mode.
4. The client encrypts the message locally.
5. The encrypted payload enters a shared pending-message layer.
6. A permissionless bundler/batcher packs many encrypted messages into Ethereum blobs.
7. Bob's client scans blob batches, detects messages intended for him, decrypts locally, and displays them in the extension.

The system should support optional privacy paths, but private messages must preserve a common baseline:

- recipient-hiding encryption is always on;
- entries use standard padded public size classes;
- public recipient identifiers are never embedded in blob entries;
- direct peer IP exposure is not a default behavior;
- low-cost users should not weaken the anonymity set for higher-privacy users.

## Related docs

- [Privacy technology options](./privacy-tech.md)
- [Posting client](./posting-client.md)
- [Receiving client](./receiving-client.md)
- [AA mempool and Paraclete layer](./aa-mempool-paraclete.md)
- [Blob batching and settlement](./blob-batching-settlement.md)
- [RemiNet OAuth and identity](./reminet-oauth-identity.md)
- [Frontend privacy/cost modes](./frontend-modes.md)

## Major components

The AA/mempool layer is based on ERC-4337-style UserOperations and bundlers, with Paraclete as the relevant browser-gossip implementation to evaluate.[^erc4337][^paraclete] The private payload layer should use a standard recipient-encryption construction such as HPKE unless implementation testing shows a better audited option.[^hpke]

```text
milXdy extension
|-- Posting client
|   |-- recipient resolution
|   |-- local encryption
|   |-- padding and chunking
|   |-- privacy/cost mode selection
|   `-- AA/UserOperation submission
|-- Receiving client
|   |-- blob discovery
|   |-- blob download
|   |-- view-tag scanning
|   |-- chunk reassembly
|   `-- local inbox display
|-- Identity layer
|   |-- RemiNet OAuth / X ownership verification
|   |-- .gwei names
|   |-- ENS names
|   |-- raw messaging keys
|   `-- key registry / attestations
|-- Privacy layer
|   |-- recipient-hiding encryption
|   |-- ephemeral sender accounts
|   |-- relay-only or multi-hop transport
|   |-- anonymous sponsorship
|   `-- shielded payment options
|-- Paraclete / AA mempool layer
|   |-- browser-native gossip
|   |-- UserOperation propagation
|   |-- paymaster integration
|   `-- bundler visibility
`-- Blob batcher
    |-- pending message selection
    |-- blob construction
    |-- settlement proof creation
    `-- bundler/batcher payment
```

## Baseline flow

```text
Bob enrolls
  -> generates messaging keypair
  -> proves X account ownership through RemiNet OAuth or another verifier
  -> publishes/resolves identity -> messaging public key

Alice sends
  -> selects @bob in X
  -> resolves Bob's messaging public key
  -> encrypts locally
  -> pads/chunks payload
  -> submits a messaging UserOperation or adjacent payload
  -> operation propagates through Paraclete/AA mempool

Bundler/batcher posts
  -> watches pending messaging operations
  -> selects a profitable/privacy-compatible batch
  -> shuffles entries
  -> builds one or more blobs
  -> posts blob transaction
  -> settles payment through AA/paymaster path

Bob receives
  -> scans protocol blob transactions
  -> downloads blobs through Ethereum access provider
  -> view-tag filters entries
  -> decrypts matching entries
  -> reassembles chunks
  -> shows message locally
```

## Why RemiNet OAuth matters

milXdy already has RemiNet auth infrastructure, and RemiNet exposes the user's X account. That makes RemiNet OAuth the cleanest initial way to prove that Bob controls the X account Alice sees in the browser.

The harder architecture question is not whether RemiNet can verify the X account. It is where the messaging-key registry lives and how Alice gets Bob's public key without introducing an avoidable central dependency or privacy leak.

Desired enrollment path:

```text
User authenticates with RemiNet
  -> RemiNet exposes the user's X account
  -> BlobMail binds @handle to messaging public key
  -> registry or attestation layer makes the public key discoverable
```

The key lookup problem is:

```text
Alice sees @bob
  -> Alice needs Bob's messaging public key
  -> Alice should not need Bob's wallet address
  -> Alice should not rely on a plaintext recipient field in the blob
```

Possible registry models:

1. Public on-chain registry
   - A contract stores `identity hash -> messaging public key`.
   - This is more Ethereum-native and independently readable.
   - Tradeoff: if the identity hash is derived from a guessable X handle or account ID, anyone can enumerate enrolled users.

2. `.gwei` / name registry
   - BlobMail treats `.gwei` names as first-class key records.
   - X accounts can point to `.gwei`, or `.gwei` can include an X attestation.
   - Tradeoff: this requires users to claim/manage a name before receiving messages unless there is an addressless fallback.

3. Committed/private registry
   - The registry stores commitments instead of directly enumerable identity mappings.
   - Lookup may require a server, PIR-style lookup, encrypted directory snapshots, or a reveal/capability flow.
   - Tradeoff: better enrollment privacy, more complex UX and infrastructure.

The practical initial design can use a public registry because public membership is acceptable for the first version. The interface should still stay abstract:

```text
resolveRecipient("@bob") -> messaging_public_key
```

That allows the registry backend to move from a public on-chain mapping to `.gwei` records or a committed/private registry without changing the sender encryption flow. Existing Ethereum stealth-address registry work is relevant prior art for public-key discovery, even though BlobMail is messaging-oriented rather than payment-oriented.[^erc5564][^erc6538]

## Privacy model

BlobMail aims to hide:

- plaintext message contents;
- intended recipient inside blob entries;
- direct Alice-to-Bob linkage in the blob;
- Alice's main wallet, when using ephemeral sender and private sponsorship;
- peer IP addresses from other ordinary users, when relay-only or multi-hop relay mode is used.

BlobMail may still expose:

- that a user enrolled, depending on registry design;
- rough message volume;
- timing patterns;
- public funding metadata in lower-privacy modes;
- RPC/provider lookup metadata;
- entry size class;
- batcher/bundler participation;
- Alice's IP to an entry relay unless stronger anonymity transport is used.

## Core unresolved design choices

- Should encrypted payloads live directly inside ERC-4337 UserOperations, or should UserOperations carry commitments to adjacent gossip payloads?
- How much of the registry should be public, and how much should be committed/private?
- What blob-linked inclusion proof should be required before paying batchers?
- Which testnet/devnet should be used first for blob posting and payment experiments?

## Registry privacy question

The registry has two jobs that are in tension:

1. Alice must reliably find Bob's current messaging public key.
2. Enrollment and lookup should not create unnecessary public metadata.

A fully public registry is easy:

```text
hash("@bob") -> pk_B
```

But if the hash input is guessable, observers can enumerate known X handles and learn who has enrolled. That may be acceptable for early versions, but it is not private membership.

A committed registry can hide more:

```text
commitment = H(identity, pk_B, salt)
```

This prevents simple enumeration only if Alice has a way to get the salt, proof, or lookup response. That means some additional discovery mechanism is still needed. Options include:

- users publish `.gwei` or profile-level pointers;
- clients download large directory snapshots and search locally;
- a private lookup system is introduced later.

The clean architecture stance is to separate the resolver interface from the registry backend. BlobMail should treat key discovery as a module with multiple backends, not bake RemiNet, `.gwei`, or on-chain storage into the encryption format.

## References

[^eip4844]: [EIP-4844: Shard Blob Transactions](https://eips.ethereum.org/EIPS/eip-4844), the Ethereum blob transaction proposal.
[^erc4337]: [ERC-4337: Account Abstraction Using Alt Mempool](https://eips.ethereum.org/EIPS/eip-4337), the UserOperation, bundler, EntryPoint, and paymaster standard.
[^paraclete]: [unattended-backpack/paraclete](https://github.com/unattended-backpack/paraclete), a browser extension project for gossiping ERC-4337 user operations to public bundlers.
[^hpke]: [RFC 9180: Hybrid Public Key Encryption](https://datatracker.ietf.org/doc/rfc9180/), the preferred reference for recipient-key encryption.
[^erc5564]: [ERC-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564), relevant prior art for recipient privacy and view/scanning patterns.
[^erc6538]: [ERC-6538: Stealth Meta-Address Registry](https://eips.ethereum.org/EIPS/eip-6538), relevant prior art for public key/meta-address registry design.
