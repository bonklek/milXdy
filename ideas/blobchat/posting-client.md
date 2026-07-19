# Posting client

The posting client is the part of the milXdy BlobMail app that Alice interacts with when sending a message. It creates encrypted payloads locally and turns them into AA-compatible pending operations or adjacent payload objects.[^erc4337][^hpke]

## Related docs

- [Master architecture](./master-architecture.md)
- [Privacy technology options](./privacy-tech.md)
- [AA mempool and Paraclete layer](./aa-mempool-paraclete.md)
- [Blob batching and settlement](./blob-batching-settlement.md)
- [RemiNet OAuth and identity](./reminet-oauth-identity.md)
- [Frontend privacy/cost modes](./frontend-modes.md)

## Responsibilities

- detect/select the recipient from X profile context;
- resolve recipient identity into a messaging public key;
- compose message locally;
- choose privacy/cost mode;
- encrypt message locally;
- chunk and pad payload;
- create or select sender account mode;
- attach payment/sponsorship data;
- submit to the pending-message layer;
- track pending status until inclusion, expiry, cancellation, or failure.

## Recipient resolution

Supported recipient forms:

- X handle through RemiNet-verified identity;
- `.gwei` name;
- ENS name;
- Ethereum address with registered messaging key;
- raw messaging public key.

All forms resolve to:

```text
recipient_identifier -> messaging_public_key
```

For the X-first product, the preferred v1 path is:

```text
visible X profile -> RemiNet ownership/identity lookup -> messaging public key
```

## Compose privacy controls

The UI should not expose protocol internals by default. It should expose controlled mode choices:

- Delivery speed: economy / balanced / fast.
- Sender privacy: standard / ephemeral / anonymous.
- Message distribution: efficient / mixed / dispersed.
- Max spend or fee cap.
- Expiry.

Advanced mode can expose:

- size class;
- chunking mode;
- dummy fragment budget;
- relay mode;
- paymaster choice;
- proof mode.

## Encryption flow

For each message or chunk:

1. Resolve Bob's messaging public key.
2. Generate ephemeral encryption key.
3. Derive shared secret.
4. Build encrypted metadata.
5. Encrypt payload.
6. Pad to selected public size class.
7. Produce message commitment.

Public entry template:

```text
version
ephemeral_public_key
view_tag
size_class
padded_ciphertext
auth_tag
commitment
```

The exact format should be deterministic and versioned.

## Chunking flow

If the message exceeds the selected class:

1. Compress if enabled.
2. Split into logical fragments.
3. Optionally randomize logical fragment sizes.
4. Optionally add dummy fragments.
5. Optionally apply erasure coding.
6. Encrypt chunk metadata into each fragment.
7. Pad every public entry into a standard class.

Bob should learn reconstruction metadata only after decrypting at least one valid chunk.

## Pending operation creation

Open design choice:

### Option A: ciphertext inside UserOperation

The UserOperation directly carries encrypted payload bytes.[^erc4337]

Pros:

- simpler propagation;
- AA mempool sees one object;
- easier deduplication.

Cons:

- bloats UserOperations;
- may not fit normal ERC-4337 validation expectations cleanly;
- bundlers may reject nonstandard payloads.

### Option B: UserOperation carries commitment, payload travels adjacent

The UserOperation carries:

```text
payload_commitment
payment_terms
expiry
nonce/nullifier
paymaster_data
```

The encrypted payload is gossiped as an adjacent BlobMail object.

Pros:

- cleaner AA validation;
- more flexible blob-specific payload format;
- easier to keep large ciphertext out of core AA path.

Cons:

- requires custom gossip topic/object;
- bundler must join commitment to payload;
- more moving parts.

Initial recommendation: prototype both locally, but expect Option B to be cleaner for production. ERC-4337 implementation docs are useful for the bundler/paymaster constraints that will decide which option is actually acceptable.[^erc4337docs]

## Submission lifecycle

```text
draft
  -> encrypted
  -> pending gossip submission
  -> seen by local node/relay
  -> selected by bundler
  -> included in blob
  -> settled/paid
  -> locally marked sent
```

Failure states:

- recipient key not found;
- invalid/expired sponsorship;
- user fee cap too low;
- mempool propagation failure;
- expired before inclusion;
- cancelled by user;
- selected but settlement failed;
- blob unavailable from chosen data source.

The final publication target is an EIP-4844 blob transaction, but the posting client should treat that as a downstream batcher responsibility rather than something every sender performs directly.[^eip4844]

## References

[^erc4337]: [ERC-4337: Account Abstraction Using Alt Mempool](https://eips.ethereum.org/EIPS/eip-4337), relevant to UserOperations, paymasters, and bundler submission.
[^erc4337docs]: [ERC-4337 documentation](https://docs.erc4337.io/), practical reference for smart accounts, bundlers, and paymasters.
[^hpke]: [RFC 9180: Hybrid Public Key Encryption](https://datatracker.ietf.org/doc/rfc9180/), relevant to local message encryption.
[^eip4844]: [EIP-4844: Shard Blob Transactions](https://eips.ethereum.org/EIPS/eip-4844), relevant to final blob publication.
