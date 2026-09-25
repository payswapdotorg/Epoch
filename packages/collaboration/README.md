# @epoch/collaboration

Epoch **Collaboration** kernel — session-based presence/coordination over
the shared model (Work Order W010, layer: kernel).

> architecture.md (binding): "Collaboration is session-based
> presence/coordination over the shared model: typed collaboration
> sessions (participants as opaque principal ids from W009 identity),
> membership, and session-scoped coordination events. It is NOT a second
> authority: collaboration does not mutate the world model; it
> coordinates actors whose actions still flow through the action
> gateway."

## What this package owns

- **Typed collaboration sessions** (`CollaborationSession`): sealed,
  content-addressed session records — tenant-scoped, optionally
  workspace/project-narrowed (W009 tenancy grammar), opened by a
  principal at a producer-supplied instant.
- **Participant membership**: join/leave facts in the session journal;
  opaque principal ids (W009 identity grammar). Presence carries a typed
  transition table (`joining -> present <-> idle`, membership-only
  `left`, heartbeat re-assertion) — the typed
  `invalid-presence-transition` error otherwise.
- **The session-scoped coordination journal**: a closed kind vocabulary
  (membership, presence, `subject.focused`/`subject.released`,
  `coordination.note`, the terminal `session.closed`) with the
  event-log discipline applied to the session scope — append-only,
  contiguous sequences from 1, content digests, tamper rejection.
- **Coordination subjects**: opaque references into the shared model —
  world entities (W002 vocabulary) or action proposals at exact
  revisions (W003 vocabulary). References only: never embedded, never
  mutated.

## What it deliberately is NOT

- **Not a second authority** — coordination never mutates the world
  model (world semantics are @epoch/world-model's) and never makes
  authorization decisions (@epoch/authorization's). Participants
  coordinate; actions flow through the Action Gateway.
- **Not a real-time transport** — WebSocket/presence brokers are future
  adapters; this package owns the typed machinery.
- **Not a clock** — ZERO wall-clock reads and ZERO randomness; instants
  are producer-supplied payload data.
- **Not membership policy** — who MAY join is an authorization question
  (W009); this package records membership FACTS and enforces structural
  integrity only.

## Tenant isolation (R12)

Hubs may be tenant-scoped (`expectedTenantId`); sessions fix their
tenant at creation; coordination appends must match; and READS are
tenant-checked via the `asTenant` option — cross-tenant
create/append/join attempts are typed `cross-tenant-denied` rejections.

## Contract surface

In-package versioned contracts (the W007/W008/W009/W010 convention):
version constants + typed index export, runtime zod validators
(`src/schema.ts`), compile-time parity (`src/parity.ts`,
`src/kernel-parity.ts`), and the committed JSON Schema projection under
`schemas/` pinned byte-identically by `test/contract-drift.test.ts`.

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/collaboration test contract-drift
```

## Dependencies (W010 runtime policy)

Runtime: `@epoch/agent-protocol` (canonical JSON + SHA-256 digests +
timestamp/JSON primitives), `@epoch/world-model` (EntityId vocabulary
for world-entity subjects), `@epoch/action-protocol` (ProposalReference
vocabulary for action-proposal subjects), `zod`. Tenancy/identity shape
compatibility is pinned via devDependencies + compile-time and runtime
parity tests — never runtime deps.

## Tests

Positive round-trips plus named negatives: cross-tenant
create/append/join (R12), journal sequence gap/duplicate/out-of-order,
digest tamper (session and event), duplicate session, unknown session,
session-closed, duplicate/unknown participant, illegal presence
transitions, member-consistency violations, version skew, vendor-field
rejection, snapshot tamper (reorder, duplicate coordinate, mutation),
determinism (source scan), and kernel parity.
