# @epoch/alerts — Epoch Alerts kernel (W043)

Kernel layer. Owned surfaces of Work Order **W043**:
`packages/supervision/*`, `services/supervision/*`, `packages/alerts/*`,
`contracts/supervision/*`.

Severity + escalation **policy** and the **alert lifecycle** over
supervision findings (the finding production is `@epoch/supervision`'s
authority — the two kernels never link at runtime; compatibility is
pinned by the supervision-runtime service's compile-time parity module
+ runtime parity tests).

## Policy as data (never hard-coded branching)

`SealedEscalationPolicy` records map finding-class token (+ optional
finding-status driver) → severity → escalation path (notify targets,
escalation delay, re-notify cadence, next escalation tier). Rule lookup
is deterministic precedence: exact (class + status) beats class-only
beats the policy defaults. Swapping a policy record changes escalation
with **no code change**.

## Alert records as append-only revision chains

- **Idempotent deduplication**: re-evaluating the same finding state
  under the same policy produces the sealed prior alert (the typed
  `duplicate` admission — no state change).
- **State transitions** (due → late → blocked) append new revisions
  carrying `previousRevisionDigest` (the W023 version-chain
  convention) — never mutations.
- **Resolution is terminal**: a resolved chain does not reopen; a
  recurring finding ships as a new alert identity.

## Escalation through the W022 authority seam

Escalation actions are typed **W003 action proposals**
(`supervision.alert.escalate`, authority scope `supervision:alert`).
The policy decision comes FIRST: outcome records are admitted only
against a verifiable W003 `AuthorizationDecision` bound to the exact
proposal revision. The three decision outcomes map to typed outcome
records: `authorized` → dispatched, `denied` → blocked-by-gateway,
`escalated` → awaiting-approval. The kernel NEVER executes anything
(`gateway-bypass-rejected`).

## Typed notifications through the NotificationPort seam

The channel vocabulary is closed and provider-neutral (`in-app`,
`external-relay`); target kinds are opaque (role / principal /
channel). A channel or target kind outside the closed sets is provider
vocabulary: typed `provider-vocabulary-rejected`. ONE in-memory
reference adapter ships here (replay-safe: duplicate receipts by
digest); concrete relays — the W042 external-event bridge — are future
adapters. Nothing requires one.

## Runtime dependency policy (frozen, W043 pin)

`@epoch/action-protocol`, `@epoch/agent-protocol`, `@epoch/tenancy`,
`zod` — NOTHING else. Parity devDependencies:
`@epoch/procurement`, `@epoch/execution-tracking`, `@epoch/event-log`,
`@epoch/evidence`, `@epoch/capability-registry`, `@epoch/verification`.

## Contract surface

In-package full surface: `packages/alerts/schemas/` (21 entries +
manifest), drift-pinned byte-for-byte by `test/contract-drift.test.ts`.
Public core-record projection: `contracts/supervision/` (composed with
the supervision core records by the supervision-runtime service).

Regenerate committed schemas after an intentional change:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/alerts test contract-drift
```
