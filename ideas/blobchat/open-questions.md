# Open questions

These questions are organized around the current BlobMail architecture: EIP-4844 blob delivery, ERC-4337-style pending operations, Paraclete-style browser gossip, and optional anonymous sponsorship.[^eip4844][^erc4337][^paraclete][^semaphore]

## Related docs

- [Master architecture](./master-architecture.md)
- [Privacy technology options](./privacy-tech.md)
- [Posting client](./posting-client.md)
- [Receiving client](./receiving-client.md)
- [AA mempool and Paraclete layer](./aa-mempool-paraclete.md)
- [Blob batching and settlement](./blob-batching-settlement.md)
- [RemiNet OAuth and identity](./reminet-oauth-identity.md)
- [Frontend privacy/cost modes](./frontend-modes.md)

## Product

- Should this ship first as a hidden milXdy experimental app or as a separate repo prototype?
- Should RemiNet Chat link to BlobMail, or should the surfaces remain completely separate?
- What is the minimum UX that proves the concept without implementing full blob settlement?

## Identity

- What exact RemiNet OAuth/identity claims are available today?
- Does RemiNet expose stable X account IDs, handles, or both?
- Can RemiNet sign attestations that clients can verify independently?
- Should `.gwei` be first-class in v1 or later?
- How should messaging keys rotate?
- How should multi-device receiving work?

## Cryptography

- Which HPKE suite is practical in browser extension WebCrypto?
- How should view tags be derived?
- How large should view tags be?
- Should sender identity claims be encrypted inside messages?
- What backup/recovery format should be used for messaging private keys?

## AA / Paraclete

- Does Paraclete support arbitrary application payloads or only canonical ERC-4337 UserOperations?
- Can BlobMail use a separate gossip topic?
- What payload sizes are acceptable in practice?
- Should ciphertext live inside UserOperation calldata or adjacent payload objects?
- How should relay-only/private transport be configured?

## Batching

- What is the first reference batcher implementation target?
- How should batches be shuffled?
- What is the minimum settlement proof?
- Can paymaster-mediated settlement avoid separate per-message claims?
- What should batchers be paid for early sealing?
- How should failed settlement be handled?

## Economics

- What fee model is easiest for users?
- Should fee curves be explicit or hidden behind modes?
- How should urgent users pay for stranded blob capacity?
- How should dummy chunks be priced?
- Can anonymous sponsorship be amortized over a session?

## Privacy

- What is the minimum acceptable default IP privacy?
- Should direct WebRTC be completely disabled in private mode?
- Should two-hop relay be supported in v1?
- How should public RPC leakage be explained?
- Should the extension support Tor/browser proxy settings?

## Implementation sequencing

Likely order:

1. Local docs and protocol sketch.
2. milXdy app shell prototype.
3. Local key generation and encrypted self-test messages.
4. Recipient resolution through RemiNet-authenticated identity.
5. Local padded/chunked message format.
6. Simulated pending pool and simulated batcher.
7. Paraclete adapter spike.
8. ERC-4337/paymaster design spike.
9. Blob posting prototype on testnet/devnet.
10. Dedicated repo split.

## References

[^eip4844]: [EIP-4844: Shard Blob Transactions](https://eips.ethereum.org/EIPS/eip-4844), for blob experiments.
[^erc4337]: [ERC-4337: Account Abstraction Using Alt Mempool](https://eips.ethereum.org/EIPS/eip-4337), for AA/paymaster questions.
[^paraclete]: [unattended-backpack/paraclete](https://github.com/unattended-backpack/paraclete), for browser AA gossip integration questions.
[^semaphore]: [Semaphore documentation](https://docs.semaphore.pse.dev/), for anonymous sponsorship questions.
