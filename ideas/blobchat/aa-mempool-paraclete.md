# AA mempool and Paraclete layer

The AA mempool is the Account Abstraction mempool used by ERC-4337. It carries `UserOperation` objects instead of normal Ethereum transactions.[^erc4337][^erc4337docs]

Paraclete is relevant because it provides browser-native gossip for ERC-4337-style pending operations. BlobMail can reuse that collection substrate instead of inventing a fully separate queue.[^paraclete]

## Related docs

- [Master architecture](./master-architecture.md)
- [Posting client](./posting-client.md)
- [Blob batching and settlement](./blob-batching-settlement.md)
- [Privacy technology options](./privacy-tech.md)
- [Frontend privacy/cost modes](./frontend-modes.md)

## Why AA is useful

BlobMail needs:

- signed user intents;
- pending operation propagation;
- bundlers that collect many operations;
- paymaster/sponsorship logic;
- nonstandard funding policies;
- optional ephemeral sender accounts.

ERC-4337 already has:

- `UserOperation`;
- bundlers;
- paymasters;
- account factories;
- validation rules;
- a separate mempool.

EIP-7702 may improve account UX over time, but BlobMail's initial AA layer should be defined around ERC-4337 because that is the Paraclete-relevant mempool model.[^eip7702]

That makes AA a better fit than the normal Ethereum transaction mempool.

## Role of Paraclete

Paraclete can provide:

- browser extension gossip;
- pending operation propagation;
- peer validation/scoring;
- deduplication;
- bundler visibility;
- an existing path for ERC-4337 objects.

BlobMail adds:

- encrypted message payloads;
- recipient-hiding envelope format;
- privacy-preserving sender modes;
- blob-aware bundler logic;
- batch economics;
- recipient scanning.

## Possible integration models

### Model A: BlobMail messages are UserOperations

Each encrypted message is represented as a UserOperation.

```text
encrypted message data + paymaster data + sender account -> UserOperation
```

Pros:

- maximally aligned with Paraclete's existing purpose;
- simpler for bundlers that already watch UserOperations;
- standard AA payment hooks.

Cons:

- message payload may be awkward inside UserOperation calldata;
- large payloads may be rejected or costly;
- ciphertext propagation is tied to AA validation constraints.

### Model B: UserOperation + adjacent BlobMail payload

The UserOperation authorizes payment and commits to the payload. The encrypted payload is a separate gossiped object.

```text
UserOperation:
  sender
  paymaster data
  payload commitment
  expiry
  fee terms

BlobMail payload:
  encrypted padded entry
  commitment preimage data
```

Pros:

- cleaner separation;
- better for large/chunked payloads;
- easier to keep private-message object format stable.

Cons:

- requires a BlobMail-specific topic or object type;
- bundlers need to match operations to payloads;
- more implementation complexity.

### Model C: Separate messaging mempool, AA only for settlement

Encrypted messages use a custom gossip layer. AA is used only to pay/settle.

Pros:

- full protocol freedom.

Cons:

- less reuse of Paraclete;
- more new infrastructure;
- weaker alignment with existing bundler ecosystem.

Initial recommendation: design toward Model B, while keeping Model A as the fastest prototype path.

## IP privacy requirements

For private messaging, Paraclete transport should default to relay-only behavior:

- no direct WebRTC between ordinary users;
- no public user identity in peer IDs;
- rotating peer identities;
- optional two-hop relay mode;
- separate identities for messaging and non-messaging flows.

If Paraclete's default behavior includes direct browser peer connectivity, BlobMail private mode should wrap or configure it differently.

## Bundler visibility

Bundlers need to see enough to:

- validate payment authorization;
- determine payload size;
- check expiry;
- estimate profitability;
- include payload commitment;
- claim payment after publication.

Bundlers should not see:

- plaintext;
- recipient identity;
- sender's main wallet in higher-privacy modes;
- user-facing identity unless explicitly disclosed by sender.

## References

[^erc4337]: [ERC-4337: Account Abstraction Using Alt Mempool](https://eips.ethereum.org/EIPS/eip-4337), the core account-abstraction mempool and UserOperation standard.
[^erc4337docs]: [ERC-4337 documentation](https://docs.erc4337.io/), practical docs for bundlers, paymasters, and smart accounts.
[^paraclete]: [unattended-backpack/paraclete](https://github.com/unattended-backpack/paraclete), the browser-native AA gossip project this design may integrate with.
[^eip7702]: [EIP-7702: Set EOA account code](https://eips.ethereum.org/EIPS/eip-7702), relevant to future account abstraction ergonomics.
