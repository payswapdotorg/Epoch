# @epoch/ai-experience

Epoch **AI Experience** — the typed AI-collaboration domain model (Work
Order W015, layer: experience).

> spec/experience-architecture.md (binding): "The UI is a projection of
> the same world used by humans and agents. It is not a second
> authority." — "Every material agent action becomes an event." —
> "Agents emit typed Experience Intents, never arbitrary executable UI
> code."

## What this package owns

- **Typed collaboration-session descriptors** (`AiSessionDescriptor`):
  tenant-scoped opening facts with declared human/agent **role
  descriptors** (`ParticipantRoleDescriptor` — opaque principal, W011
  peer kind, registered agent id for agent peers, and the granted
  interaction-intent subset). Roles are grants, not authorization
  decisions: approvals and execution still flow through the Action
  Gateway.
- **Agent presence/focus states**: the W010 collaboration presence
  vocabulary and transition table (mirrored + parity-pinned via
  devDependencies), and focus targets in the exact W010 collaboration
  subject grammar (world entities / exact-revision action proposals).
- **The interaction-intent vocabulary**: sixteen versioned
  discriminated-union members — typed subsets of the Universal
  interactions (annotate, approve, branch, compare, execute, filter,
  follow-agent, inspect, pause, query, reject, release-control, replay,
  resume, select, take-control). Agents emit these TYPED intents; the
  Dynamic UI law and provider neutrality are enforced at admission
  (`executable-ui-rejected`, `vendor-fields-rejected`).
- **Takeover/release transitions with provenance**: take-control and
  release-control are explicit typed transitions carrying WHO, WHEN, and
  ON WHAT AUTHORITY (`ControlAuthority`: session-owner, role-grant, or
  explicit-handover). Unauthorized attempts are typed rejections
  (`control.denied` events) that record the SAME claimed provenance —
  denials are history, never silent.
- **Engineering Moment records**: the shareable/replayable collaboration
  unit (world snapshot + agent state + human state + visual state +
  timeline position + evidence + scenario + available actions) as a
  content-addressed RECORD TYPE — producing one never mutates engine
  state; the SHA-256 digest over canonical JSON is the shareable
  identity.
- **Collaboration event adapters over the W010 event shapes**:
  emission/adaptation of event-log records in the open `ai:` payload
  namespace (round-trips through the real `@epoch/event-log`), and
  adaptation of W010 collaboration journal events (mirrored +
  parity-pinned; `@epoch/collaboration` stays a devDependency).
- **The deterministic collaboration projection** (`projectCollaboration`):
  a pure fold of typed events into the collaboration state view
  (presence, focus, control, follows, playback, timeline position,
  branch points, annotations, captured moments, last view intents) with
  sorted outputs — order-independent, zero wall-clock, zero randomness.

## What it deliberately is NOT

- **Not a second authority** — the World Model owns semantics, the Action
  Gateway owns execution, the event log owns change history; this package
  models collaboration semantics as typed data over that substrate.
- **Not event storage** — the W010 substrate stores; this package adapts
  and projects. No mutation, no deletion, no journal reimplementation.
- **Not a real-time transport** — presence brokers and sockets are future
  adapters.
- **Not an authorization decision maker** — role grants coordinate
  control; who MAY act is W009/W022 territory.
- **Not a clock** — ZERO wall-clock reads and ZERO randomness; instants
  are producer-supplied payload data.

## Runtime dependency policy (W015 Tech Lead pin)

Runtime dependencies are EXACTLY `@epoch/agent-protocol` (ids, digests,
canonical JSON, version discriminators), `@epoch/event-log` (W010 event
shapes), and `@epoch/experience-protocol` (W011 experience vocabulary) —
plus `zod` from the frozen catalog. Compatibility with
`@epoch/collaboration`, `@epoch/replay`, `@epoch/tenancy`, and
`@epoch/experience-compiler` is pinned via devDependencies + compile-time
parity (`src/kernel-parity.ts`) and runtime parity tests — never runtime
deps (the W002/W006-W009/W010/W011/W013/W028 kernel-to-kernel devDep
precedent; DEPENDENCY-BASELINE.md was studied and the pin governs).

**Layer note:** the package declares `epoch.layer = "experience"`. The
W015 design pin's "(layer kernel)" phrase is unsatisfiable together with
the same pin's `@epoch/experience-protocol` RUNTIME dependency: the frozen
boundary model (scripts/boundary-check.mjs, `pnpm check:boundary`) forbids
kernel → experience edges. The experience marker matches the W011/W012/W013
siblings this package composes and keeps the boundary battery green; the
deviation is recorded in the W015 PR as an answered architecture question.

## Tenant isolation (R12)

Sessions fix their tenant at the descriptor; intents, journal events,
projected references, and Engineering Moment evidence are tenant-checked
with typed `cross-tenant-denied` rejections at admission, at the fold,
and at capture.

## Contract surface

In-package versioned contracts (the W007/W008/W009/W010 convention):
version constants + typed index export, runtime zod validators
(`src/schema.ts`), compile-time parity (`src/parity.ts` +
`src/kernel-parity.ts`), and the committed JSON Schema projection under
`schemas/` pinned byte-for-byte by `test/contract-drift.test.ts`
(regenerate with `EPOCH_UPDATE_CONTRACTS=1 pnpm --filter
@epoch/ai-experience test contract-drift`).

## The typed error taxonomy

`version-unsupported`, `validation`, `digest-mismatch`,
`unknown-session-reference`, `cross-tenant-denied`, `takeover-denied`,
`invalid-intent`, `executable-ui-rejected`, `vendor-fields-rejected`,
`unknown-evidence-reference`, `replay-position-invalid` — every entry
point is total; errors are values, never exceptions.

## Testing note (the web feature module)

The package's Vitest runner also executes the pure-logic tests of the
W015 web feature module (`apps/web/src/features/agents/**`): the app
manifest is frozen during this Work Order (integration is a serialized
shell/integration change), so the feature tests run here in `globals`
mode and import nothing outside `apps/web`. See
`vitest.config.mts`.
