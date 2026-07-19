# Blob batching and settlement

Blob batching is the main new infrastructure beyond the extension UX and AA/mempool layer. It depends on EIP-4844 blob transactions for temporary Ethereum data availability.[^eip4844]

The batcher may be a standalone actor, but the cleaner model is an ERC-4337 bundler extended with BlobMail-specific logic.[^erc4337]

## Related docs

- [Master architecture](./master-architecture.md)
- [AA mempool and Paraclete layer](./aa-mempool-paraclete.md)
- [Posting client](./posting-client.md)
- [Receiving client](./receiving-client.md)
- [Privacy technology options](./privacy-tech.md)

## Batcher responsibilities

1. Watch the AA/Paraclete pending layer.
2. Collect valid BlobMail operations/payloads.
3. Filter expired or invalid entries.
4. Score entries by fee, size class, waiting time, and privacy constraints.
5. Shuffle and pack entries into a blob.
6. Publish the blob transaction.
7. Submit or expose settlement proofs.
8. Claim authorized payment.
9. Announce or index successful inclusion.

## Why batching matters

Cost:

- one blob can carry many small messages;
- users share fixed blob capacity;
- urgent users can subsidize early publication.

Privacy:

- each recipient is hidden among many unrelated padded entries;
- bundler transaction breaks direct user-to-blob posting linkage;
- shuffled batches make entry/payment correlation harder.

## Batch selection

Each message can specify:

```text
start_block
expiry_block
base_bid
bid_escalation_rate
max_fee
size_class
privacy_lane
payload_commitment
nonce/nullifier
```

Bid function:

```text
bid(h) = min(max_fee, base_bid + bid_escalation_rate * (h - start_block))
```

The batcher posts when selected entries cover:

```text
blob fee + execution fee + proof/settlement cost + margin
```

Urgent mode should generally seal the current shared batch early, not create a dedicated one-entry blob.

## Entry format

Blob public layout should be deterministic and versioned.

Possible structure:

```text
BlobHeader
  protocol_version
  chain_id
  batch_id
  entry_count
  size_class_counts
  manifest_root

Entries
  entry_0
  entry_1
  ...
  entry_n

ManifestCommitment
  root/commitment needed for settlement
```

Entries should be shuffled. The public blob should avoid a simple ordered mapping:

```text
UserOperation 17 -> blob entry 17
```

## Settlement problem

The batcher must prove it included the committed payload and is entitled to payment.

The EVM cannot freely read blob contents. Settlement likely needs one of:

- a manifest commitment in transaction calldata;
- Merkle roots over entries;
- KZG point proofs;
- per-entry inclusion proofs;
- aggregate inclusion proofs;
- paymaster-managed validation of batch roots.

Open design issue: find the cheapest proof path that is implementable by ERC-4337 bundlers and acceptable for paymasters.

## Preferred proof direction

Alice should retain decryptability for her own sent messages, but settlement should not rely primarily on Alice or Bob detecting fraud after the fact.

The preferred settlement chain is:

```text
payment authorization
  -> entry_hash
  -> specific blob position/proof
  -> blob commitment
  -> batcher payment
```

This means Alice's payment authorization commits to the encrypted entry she wants delivered. The batcher is paid only when it can link that authorized entry to a specific committed blob batch.

Alice retaining decryptability is still useful:

- she can keep a local sent-message record;
- she can verify what she submitted;
- she can audit whether a posted batch contains her entry;
- she can debug delivery failures;
- she can produce off-chain evidence if a batcher or UI lies.

But the normal payment path should use positive inclusion proof, not a fraud-claim-first model.

## Alice-side decryptability

The encrypted message should be recoverable by both:

- Bob, as the recipient;
- Alice, as the sender.

This does not require publicly revealing Alice as sender. The client can either:

1. store the content encryption key locally in Alice's sent-message state; or
2. include a sender-wrapped copy of the content key inside encrypted metadata.

The local-only option is cleaner for privacy. A sender-wrapped copy helps multi-device sent-message recovery, but it adds more encrypted metadata and needs careful format design.

Conceptual encryption model:

```text
plaintext
  -> content_encryption_key
  -> ciphertext
  -> key wrapped for Bob
  -> key retained or wrapped for Alice
```

The public blob entry still should not reveal:

- Alice's identity;
- Bob's identity;
- which wrapped key belongs to whom;
- whether a sender copy exists.

## Minimum viable settlement proof

The minimum viable settlement proof question is:

```text
What is the cheapest on-chain evidence that links:
  Alice's paid authorization
  -> her encrypted entry commitment
  -> a specific blob batch
  -> the batcher who posted it
```

For testnet-first implementation, a practical starting point is manifest-based settlement:

1. Alice's UserOperation or payment authorization commits to `entry_hash`.
2. The batcher builds a blob with shuffled encrypted entries.
3. The batcher posts an on-chain `manifest_root`.
4. The manifest tree commits to each entry hash and enough positional metadata to bind the entry to the blob layout.
5. The batcher claims payment with a Merkle proof from `entry_hash` to `manifest_root`.
6. The paymaster/contract checks that the authorization is valid, unexpired, unpaid, and included.

### V1 weakness

The v1 manifest-based proof proves:

```text
entry_hash is included in the posted manifest_root
```

It does not, by itself, prove:

```text
the actual blob bytes at the claimed position contain the entry that hashes to entry_hash
```

That distinction matters. A dishonest or buggy batcher could theoretically publish a manifest that includes Alice's `entry_hash`, while the blob payload omits the corresponding encrypted entry or places different bytes at that position. In that case:

- the contract/paymaster may see a valid Merkle proof against the manifest;
- Alice may see that her authorization was consumed;
- Bob may fail to find/decrypt the message because the blob did not actually contain it.

For a testnet prototype, this weakness may be acceptable because the goal is to validate the end-to-end flow, batch economics, UserOperation/payment wiring, and client UX. It should not be treated as production-safe settlement.

V1 mitigations:

- make the manifest include claimed blob position, offset, length, and size class;
- make clients audit posted blobs against manifests;
- let Alice retain decryptability and local sent-entry records;
- expose mismatches in logs/telemetry;
- optionally delay final settlement or use a challenge path during testing.

These mitigations help catch bad behavior, but they do not replace cryptographic blob-content linkage.

### Production target

Production settlement should tighten the linkage:

```text
entry_hash
  -> manifest leaf with position/offset
  -> manifest_root
  -> blob commitment / versioned blob hash
```

The production target is:

```text
payment authorization
  -> entry_hash
  -> exact blob position or polynomial opening
  -> blob commitment / versioned blob hash
  -> batcher payment
```

In production, a batcher should only be paid when the proof shows that the paid entry is committed by the actual blob data, not merely listed in a separate manifest.

Depending on available tooling and gas costs, that may use:

- KZG/blob commitment proofs;
- a manifest root placed in transaction calldata;
- offset commitments;
- aggregate inclusion proofs;
- paymaster-level validation of batch roots.

KZG-related proof verification is an area to treat carefully because gas cost and available precompiles materially affect the design.[^kzg]

The important design requirement is that a batcher should not be able to get paid for an entry that appears only in a manifest but not in the actual blob payload.

Future blob/data-availability upgrades such as PeerDAS may change throughput and retrieval assumptions, but they do not remove the need for a settlement proof tying payment authorization to the committed data object.[^peerdas]

## Fraud claims versus positive proof

A fraud-claim model is possible:

```text
batcher claims payment
  -> challenge window
  -> Alice/Bob detects missing entry
  -> challenger proves omission or forces batcher to prove inclusion
```

This is not the preferred default because it adds:

- watcher assumptions;
- delayed settlement;
- griefing surface;
- more complex UX;
- more complexity around who has standing to challenge.

Fraud claims may still be useful as a backup mechanism, especially in early testnet versions, but the target design should favor direct positive inclusion proof before payment.

## Settlement models

### Per-message claim

Batcher submits individual inclusion claims.

Pros:

- simple mental model.

Cons:

- expensive at scale.

### Aggregate batch claim

Batcher submits one batch root and aggregate claim.

Pros:

- lower on-chain cost.

Cons:

- more complex proof and fraud/validity model.

### Paymaster-mediated settlement

The paymaster validates the messaging operation and pays/reimburses the bundler through the AA path.

Pros:

- aligns with ERC-4337;
- fits the Paraclete developer's suggestion;
- avoids inventing a parallel payment mechanism.

Cons:

- paymaster logic becomes protocol-critical;
- private sponsorship adds complexity.

## Batcher decentralization

The protocol should allow anyone to run a compatible batcher.

Likely initial batchers:

- project-operated reference batcher;
- Paraclete/AA bundler operators;
- Ethereum searchers/builders;
- community operators;
- high-volume users.

Bootstrap reality: the project may need to run the first batcher until volume makes third-party operation profitable.

## References

[^eip4844]: [EIP-4844: Shard Blob Transactions](https://eips.ethereum.org/EIPS/eip-4844), the core blob transaction/data availability proposal.
[^erc4337]: [ERC-4337: Account Abstraction Using Alt Mempool](https://eips.ethereum.org/EIPS/eip-4337), relevant to bundler/paymaster-mediated settlement.
[^kzg]: [EIP-2537: BLS12-381 precompile](https://eips.ethereum.org/EIPS/eip-2537), relevant background for efficient pairing operations that may matter for KZG-style verification paths.
[^peerdas]: [EIP-7594: PeerDAS](https://eips.ethereum.org/EIPS/eip-7594), relevant future work around Ethereum data availability scaling.
