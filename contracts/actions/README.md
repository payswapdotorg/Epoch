# contracts/actions — Epoch Action Protocol contract surface

Owned by Work Order **W003** (`packages/agent-protocol/*`,
`packages/action-protocol/*`, `contracts/agent/*`, `contracts/actions/*`).
Kernel layer.

This directory publishes the typed, versioned, provider-neutral contract
surface of the Epoch **Action Protocol v1** at its ownership boundary: the
protocol of typed interventions (proposals) and the authorization
request/decision messages that flow through the Action Gateway (W022
implements the gateway; this contract defines only the message shapes — no
authorization logic and no runtime orchestration live here).

## Contents

| Path | What it is |
|---|---|
| `index.d.ts` | Versioned TypeScript declaration surface (self-contained, no imports, no runtime code). |
| `parity.ts` | Compile-time conformance assertions: every published type must be *identical* to the implementation's zod-inferred type. Compiled by `packages/action-protocol`'s `typecheck` script; any drift fails `pnpm typecheck`. |
| `manifest.json` | Exact-revision evidence anchor: contract version, protocol version, data-type inventory, message kinds, and a SHA-256 digest for every emitted schema file. |
| `schemas/*.schema.json` | Deterministic JSON Schema (draft 2020-12) projection of every surface type, emitted by `renderActionContractFiles()` in `@epoch/action-protocol`. |

## Authority split (architecture lock rules 2/3)

Agents **propose**; only the Action Gateway **authorizes and executes**.
The split is encoded structurally in this contract:

- `ActionProposal` carries no authorization or execution fields, and
  strict objects reject unknown fields — a proposal cannot smuggle
  `authorized`, `decision`, or `executionAuthority` vocabulary.
- `AuthorizationDecision.decidedBy.role` admits only `action-gateway` and
  `human-approver`. An agent as the source of an authorization decision is
  **structurally inexpressible**; so is an escalation target in an agent
  role.
- `AuthorizationRequest`/`AuthorizationDecision` bind to an exact proposal
  revision via `proposalRef.canonicalDigest` (the SHA-256 of the proposal's
  canonical JSON), so authorization always addresses precise bytes.

## Safety-relevant metadata is required

Every `ActionProposal` must carry `preconditions`, `predictedEffects`
(≥ 1 — an action that predicts nothing cannot be evaluated before
execution, R4), `sideEffects`, a `reversibility` classification
(exhaustive: reversible via automatic/manual/compensating-action,
partially-reversible with mandatory notes on the irreversible residue, or
irreversible), and `authorityRequirements` (non-empty scopes; human
approval requires a quorum, and a quorum without human approval is
rejected). Empty `preconditions`/`sideEffects` arrays are legal and mean
"explicitly unconditional"/"explicitly effect-pure".

## Versioning

`protocolVersion` (`"1.0.0"`) is validated exactly with a typed
`version-mismatch` error; `contractVersion` (`"1.0.0"`) versions this
published surface. See `contracts/agent/README.md` for the shared policy.
The action-protocol version evolves independently of the agent-protocol
version; because this surface embeds shared primitives mirrored from
`contracts/agent`, material changes to those primitives require revisiting
this contract's major version too.

## Mirrored shared primitives

`Timestamp`, `MessageId`, `AgentId`, and `JsonValue` are redeclared here so
this directory is a self-contained published artifact; their canonical
home is `contracts/agent` (W003), and parity assertions verify the mirrors
against the implementation (which imports them from
`@epoch/agent-protocol`).

## JSON Schema fidelity and determinism

Structural-only projection; runtime refinements (quorum iff human
approval, digest hex shape, timestamp calendar validity, p95 ≥ p50 on
agent-protocol primitives) are enforced by `@epoch/action-protocol`. See
`contracts/agent/README.md` for the canonical-serialization and evidence
addressing rules; they apply identically to action-protocol messages.

## Reconciliation notes (architecture questions)

Minimal, additive references pending other Work Orders (recorded as
architecture questions in the W003 PR):

- `ActionTarget.ref` for world targets: canonical reference format owned
  by the World Model (W002, in flight at W003 dispatch time).
- `Precondition.constraintRef` / `AuthorizationCondition.constraintRef`:
  constraint registry reference format owned by W004 (in flight at W003
  dispatch time).
- `PrincipalReference`/`AuthorizerReference` ids and quorum roles:
  identity/tenancy/authorization semantics owned by W009.
- `context.simulationRunRef`/`evaluationRef` and `evidenceRefs`: formats
  owned by W005/W021 and the evidence domain (W006).
