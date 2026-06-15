# Backstop Roadmap

Backstop today is a working, on-chain, veto-only co-signer for autonomous agents on Mantle: a
guardian simulates every proposed transaction on live chain state, co-signs the safe ones, and vetoes
drainers with a real `Blocked` event. That core is built, deployed, Sourcify-verified, and tested.

This document is about what comes after the core. It also names the honest limits of the hackathon
build and the exact, researched path past each one. Every step below has a production precedent; none
of it is hand-waving.

**North star: [Predicate](https://predicate.io) (formerly Aethos)** already runs Backstop's exact
thesis in production: a restaking-secured operator set that attests whether a transaction satisfies
policy *before* it executes. Backstop is that pattern, scoped to a single agent's wallet, with a path
to the same decentralization.

---

## Shipped (hackathon build)

- **Veto-only co-signer**: the guardian can block but never move funds. Theft via the guardian is
  impossible by construction; a silent guardian can't freeze you (on-chain timelock recovery).
- **Two-tier classifier**: a deterministic floor (approval abuse, immediate drain, privilege
  escalation, known-bad target) catches the obvious cases in under a second; gray-zone calls escalate
  to a pluggable LLM (AltLLM primary → Anthropic fallback) that judges drainer patterns and
  intent↔calldata mismatch.
- **Live simulation**: `eth_call` with a code-override traces real balance/allowance deltas with zero
  deployment.
- **ERC-8004 identity**: both the guardian and each guarded agent hold an on-chain identity.
- **Real threat intel**: a 652-address known-drainer list sourced from
  [ethereum-lists](https://github.com/MyEtherWallet/ethereum-lists) (MIT).
- **Two onboarding modes**: hosted guardian (zero infra) or self-hosted keeper (trustless). The
  keeper is account-agnostic; it guards a brand-new agent the moment you wrap it.

---

## Near-term: custody and adoption (the two biggest unlocks)

### 1. Key custody: env → KMS *(quick win, ~1 day)*
The guardian key lives in an env var today. The first hardening step is non-exportable, IAM-gated,
audited signing via **AWS/GCP KMS** (`@rumblefishdev/eth-signer-kms`). One day of work; removes the
single largest operational risk (raw key in env) with no protocol change.

### 2. Adoption: one-tx install on *existing* wallets *(the #1 adoption objection)*
Today, adopting Backstop means deploying a `BackstopAccount` and migrating funds into it. The fix is to
ship Backstop as a **module**, not an account:

- **`BackstopValidator` + `BackstopHook` (ERC-7579)**: `validateUserOp` is a direct port of the
  account's `execute()` guard; the Hook's `preCheck` is "veto on any unauthorized action."
- **`BackstopGuard` (Safe)**: `checkTransaction` enforces the same veto.

Built with [Rhinestone ModuleKit](https://docs.rhinestone.dev), one codebase ships to Kernel, Nexus,
and Safe at once. Adoption becomes a single `installModule` / `setGuard` transaction. **Funds never
move.** [Safe Research's "cosigner" write-up](https://docs.safe.global) is effectively the spec.

---

## Mid-term: multi-tenancy, gas, and high availability

### 3. Multi-tenant policy registry
One guardian, many agents, no shared mutable default: a per-agent policy registry, **on-chain anchored
(ERC-8004 identity) and off-chain evaluated**, the Turnkey/Predicate pattern.

### 4. Gas: the agent pays, not the operator
Vetoes currently cost the operator gas. **[Pimlico](https://docs.pimlico.io) is already live on Mantle
5000** (`api.pimlico.io/v2/5000`); an ERC-4337 verifying paymaster lets the account self-fund its own
veto/co-sign gas, with a capped subsidy as UX. The operator subsidizes zero.

### 5. Veto mechanics + no single point of failure
Formalize the optimistic veto window with **Zodiac Delay Modifier** semantics, and run **redundant
keepers without double-signing** (consensus-gated, à la Chainlink OCR3 / Obol DVT).
*Caveat we take seriously:* the 2026-06-01 Gnosis Pay Delay-Module exploit proves two things: the
watcher must be provably live, and the veto window must exceed worst-case detection latency (our
Tier-B LLM path is 8–15s). Both become hard SLAs, not assumptions.

---

## Long-term: decentralize the guardian

### 6. Threshold / MPC signing
KMS → **t-of-n threshold/MPC** (Lit PKP / Turnkey / Fireblocks): conditional signing and high
availability without ever reconstructing a single key or double-signing.

### 7. ERC-8004 depth
Move from identity-only to the full standard: NFT custody held by the agent
(`register → safeTransferFrom` + `setAgentWallet`), an on-chain reverse mapping (agentId ↔ account),
**Reputation** attestations per guard window (`giveFeedback`), and a **Validation** registry for
per-action, high-assurance verdicts.

### 8. Restaking-secured guardian set
The endgame: replace the single guardian with a **restaking-secured operator set** (EigenLayer, the
Predicate model) that writes attestations into ERC-8004 Validation, optionally with **verifiable LLM
inference** (EigenAI) so the gray-zone verdict itself is provable on-chain. At that point Backstop is
no longer a trusted co-signer; it's a decentralized one.

---

## Honest limits today (and where each is addressed above)

| Limit in the hackathon build | Addressed by |
|------------------------------|--------------|
| Guardian key in an env var | §1 (KMS) → §6 (threshold/MPC) |
| Adopting requires deploying an account + moving funds | §2 (ERC-7579 module / Safe Guard) |
| One guardian, one keeper (SPOF; no key rotation) | §3, §5, §6, §8 |
| Operator pays veto gas | §4 (Pimlico paymaster, live on Mantle) |
| Threat intel is a bundled list, not a live oracle | GoPlus (free, no-key, Mantle 5000) is the documented live path; an optional paid provider is a drop-in upgrade |
| Detection is off-chain (the contract enforces, the keeper decides) | §8 (verifiable inference written on-chain) |

The hackathon scope was deliberate: ship a **working, on-chain, honest** core rather than a half-built
decentralized stack. Everything above is the researched path from that core to production, with a live
precedent (Predicate) proving the destination is real.
