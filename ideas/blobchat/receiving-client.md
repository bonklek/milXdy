# Receiving client

The receiving client is Bob's local milXdy BlobMail component. Its job is to discover blobs, scan entries, decrypt matching messages, reconstruct large messages, and display them in the extension.[^eip4844][^hpke]

## Related docs

- [Master architecture](./master-architecture.md)
- [Privacy technology options](./privacy-tech.md)
- [Posting client](./posting-client.md)
- [Blob batching and settlement](./blob-batching-settlement.md)
- [Frontend privacy/cost modes](./frontend-modes.md)

## Responsibilities

- maintain Bob's messaging private key locally;
- discover protocol blob transactions;
- download blob sidecars/data;
- parse blob entries;
- run view-tag filtering;
- attempt authenticated decryption;
- reassemble chunks;
- store decrypted messages locally;
- notify/display inside milXdy;
- avoid leaking which entries matched.

## Ethereum data access

Bob does not strictly need a full Ethereum node. Options:

- public RPC/provider;
- privacy-conscious RPC;
- beacon API / blob sidecar provider;
- blob indexer;
- light client;
- personal full node.

Privacy spectrum:

```text
public RPC < private RPC < light client < own node
```

The extension should support delayed checking. BlobMail should work like encrypted mail: Bob can come online later and scan available blobs, subject to blob retention limits or third-party archival availability.

Future Ethereum data availability scaling work such as PeerDAS may change blob retrieval assumptions, so the receiving client should keep blob data access behind an interface rather than hard-coding one provider model.[^peerdas]

## Scanning flow

```text
new protocol blob detected
  -> download blob data
  -> parse entries
  -> for each entry:
       compute candidate view tag
       skip if tag mismatch
       attempt authenticated decrypt if tag matches
       validate decrypted metadata
       store chunk/message
  -> reassemble complete messages
  -> update local inbox
```

View tags are a performance optimization. They reveal a small amount of information and may create false positives, but they prevent Bob from attempting full decryption against every entry. Ethereum stealth-address designs are useful prior art for this scanning model.[^erc5564]

## Local key storage

Bob's private messaging key should remain local.

Potential storage choices:

- extension local storage, encrypted with a user passphrase;
- IndexedDB with WebCrypto wrapping key;
- browser platform credential store if accessible;
- hardware-backed key storage where available;
- export/import backup phrase or encrypted key file.

Open issue: Chrome extension local storage is convenient but not strong secret storage. The UX/security tradeoff needs a dedicated design pass.

## Chunk reassembly

Each decrypted chunk may reveal encrypted metadata:

```text
stream_id
chunk_index
total_chunks or coding policy
content_hash
chunk_hash
dummy flag
reply/thread reference
expiry
```

Bob's client should:

- collect chunks by stream ID;
- ignore dummy chunks;
- validate hashes;
- reconstruct when enough fragments are available;
- mark incomplete messages;
- request/rescan missing windows if possible.

## Inbox behavior

Messages should be stored locally by default.

Possible inbox states:

- received;
- partial;
- corrupt;
- expired/incomplete;
- awaiting more chunks;
- hidden/spam;
- verified sender;
- anonymous sender.

Sender identity is optional. A message may include an encrypted sender claim, but it should not be public. Bob can decide whether to trust/display it.

## Notification behavior

Notifications are tricky because they can leak that Bob received a private message.

Default:

- local-only notification;
- no delivery receipt;
- no public acknowledgement;
- no automatic reply beacon.

Optional:

- encrypted receipt to Alice;
- delayed receipt;
- no receipts ever.

## References

[^eip4844]: [EIP-4844: Shard Blob Transactions](https://eips.ethereum.org/EIPS/eip-4844), relevant to blob sidecars and temporary blob data availability.
[^hpke]: [RFC 9180: Hybrid Public Key Encryption](https://datatracker.ietf.org/doc/rfc9180/), relevant to recipient decryption.
[^erc5564]: [ERC-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564), relevant to recipient scanning patterns.
[^peerdas]: [EIP-7594: PeerDAS](https://eips.ethereum.org/EIPS/eip-7594), relevant future work for Ethereum blob/data availability scaling.
