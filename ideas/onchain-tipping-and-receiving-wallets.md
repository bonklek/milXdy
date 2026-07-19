# On-Chain Tipping And Receiving Wallets

Draft idea for a distant-future milXdy wallet layer. This is not near-term release scope.

## Purpose

milXdy already sees X/Twitter social context locally: handles, posts, avatars, Milady/Maxxer matches, likes, RemiStats surfaces, and user actions. A future wallet layer could let users send ERC-20 tips from those surfaces while keeping different privacy and hygiene options available.

The core product choice is that public tipping remains public by default so tips can power visible social surfaces such as tip totals, rankings, or badges. Private tipping remains available as an advanced mode, but private transfers are not expected to feed public tip trackers.

## Three Tip Flows

### 1. Direct Public Tip

```text
sender -> recipient public wallet
```

The simplest flow maps a social handle to a public Ethereum address and sends the tip directly there.

Properties:

- easiest to understand and implement
- fully public on-chain
- compatible with public tip trackers and leaderboards
- exposes the recipient's normal wallet as their social receiving address
- best treated as an explicit opt-in mode, not the safest default

### 2. Rotating Public Receiving Wallet

```text
sender -> current public receiving wallet -> relay/shield/withdraw path -> user's regular wallet
```

This is the preferred default concept. The user gets a generated public receiving address that can receive ordinary unshielded ERC-20 tips. That receiving address is linked to their public milXdy/X identity, but it is not their regular wallet.

The receiving wallet acts like a disposable public inbox:

- tips into it are public and can be counted
- the user's regular wallet is not published as the tip destination
- the wallet can be emptied, retired, and replaced
- historical receiving wallets remain useful for tip history
- the extension abstracts wallet rotation and fund movement away from the normal user flow

This is not full cryptographic privacy. If funds move directly from the receiving wallet to the user's regular wallet, the link is visible. The useful privacy boundary comes from routing withdrawals through a relay, shielded pool, delay, batching, or other hygiene path before funds reach the user's regular wallet.

### 3. Fully Shielded Tip

```text
sender shielded note -> recipient shielded note
```

This flow is for private transfers. It would use a shielded pool design such as EIP-8182 if that infrastructure becomes available in the target chain environment.

Properties:

- sender, recipient, token, and amount are hidden at the shielded transfer layer
- not counted by public tip trackers by default
- requires wallet/proof/discovery UX that does not exist in milXdy today
- useful as a privacy demonstration and advanced user path

## Registry Shape

A future on-chain registry should support public and private paths separately instead of forcing one address type to serve every use case.

Possible conceptual shape:

```solidity
struct MilxdyProfile {
    address directWallet;
    address currentReceivingWallet;
    uint64 receivingWalletEpoch;
    bytes shieldedDiscoveryData;
}
```

Direct wallet and current receiving wallet are public Ethereum addresses. Shielded discovery data is optional and only relevant for private transfer flows.

The public tip tracker should count tips sent to current and historical receiving wallets associated with a profile. Retired receiving wallets should remain part of historical accounting, but the UI should prefer the current wallet for new public tips.

## Sponsored Transaction Flow

For public tips, gas sponsorship can be handled with account abstraction, a paymaster policy, or another relaying pattern. The sponsor submits the transaction and pays gas, while immutable contract logic controls which actions are valid for sponsorship.

For shielded transfers, EIP-8182 includes a private fee-compensation concept: a broadcaster can pay public gas and receive compensation through a private fee note. This keeps the fee path inside the shielded note model rather than requiring a public fee output.

## Open Design Questions

- How are public receiving wallets generated, backed up, rotated, and retired?
- Does the extension create receiving wallets locally, or does the user's wallet create them?
- What is the minimum safe relay/shield path before funds leave a receiving wallet?
- How does a user recover funds from an old receiving wallet after reinstalling milXdy?
- What handle-ownership proof is required before publishing registry entries?
- Should direct public wallet tipping be hidden behind an advanced setting?
- How should the UI explain that rotating receiving wallets improve hygiene but are not full privacy?
- Which ERC-20 tokens are supported, and how are token approvals handled safely?
- What public event schema should the tipping contract emit for indexers and local milXdy views?
- What parts of this can be prototyped before EIP-8182-style infrastructure exists?

## Product Framing

This idea should be treated as a future wallet-aware social layer for milXdy:

- public default: rotating receiving wallet tips
- simple option: direct public wallet tips
- advanced option: fully shielded tips
- public tracking only for public tips
- privacy tooling focused on keeping the user's regular wallet out of the public social identity path
