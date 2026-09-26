# @epoch/action-gateway

Epoch **Action Gateway** service — the EXECUTION AUTHORITY (Work Order
W022, layer: service; the W020 agent-runtime host pattern, mirrored).

> architecture.md (binding): "Actions execute only through the Action
> Gateway." / "Agents propose; the Action Gateway authorizes execution."

## What this service owns

- **Intake** — `submitAction`: W009 authorization gate FIRST
  (`authorization-rejected` before any policy evaluation), then the typed
  policy decision through `@epoch/action-policy` (allow / deny /
  requires-approval, full W004 provenance, append-only hash-chained
  decision records). One action id grounds exactly one proposal revision
  (`action-conflict` otherwise); a re-evaluation under a CHANGED policy set
  records a NEW chained decision and supersedes open approval requests.
- **The human-approval flow** — `approveAction` / `rejectAction` /
  `expireApprovals`: quorum tracking, deadlines (typed
  `approval-deadline-expired` / `approval-timeout`), delegation bounds
  (`delegation-depth-exceeded` / `delegation-cycle`), drift detection
  (`proposal-drift-rejected` — approval authorizes EXACTLY the referenced
  decision + proposal revision, never re-evaluating policy), fail-closed
  vetoes, and supersession.
- **Execution dispatch** — `executeAction`: the W009 authorization context
  rides every execution; dispatch goes through the `ActionExecutionPort`
  ADAPTER SEAM (external systems — HTTP, queues, tools — are adapters,
  never core types). The gateway records record-shaped outcomes ONLY:
  typed success/failure records with evidence references, content-addressed
  and append-only.
- **The `action:*` event vocabulary** (W010-shaped) — one action = one
  stream (`stream:action-<suffix>`); events are W010 `action:lifecycle`
  facts (phases: proposed / authorized / rejected / executed /
  effects-recorded / failed) with typed detail payloads. Digests mirror
  `computeEventDigest` and are admitted by the REAL `sealEvent` (devDep
  parity tests, the W036 pattern — no runtime coupling).
- **Idempotent replay** — the same proposal under the same policy set is
  the kernel's typed `duplicate-decision` (the existing decision stands);
  an approval replayed by the same approver is the typed
  `duplicate-approval` echoing the sealed record. Two gateways fed the same
  history hold byte-identical snapshots.
- **Tenant isolation (R12)** — tenant-scoped actions; the host may pin one
  tenant; cross-tenant proposal references and cross-tenant reads are typed
  `tenant-isolation-rejected` rejections.
- **Health/liveness as typed data** — `health()`: deterministic derivation,
  `degraded` exactly when an action's execution failed.
- **Whole-host snapshots** — `snapshot()` / `ActionGateway.fromSnapshot()`
  (deterministic, tamper-checked restoration through the kernel parsers).

## What it deliberately is NOT

- **NOT** a policy engine: policy semantics are `@epoch/policy-contracts`'
  (W004), consumed through `@epoch/action-policy`; precedence and scope are
  never re-implemented here.
- **NOT** an executor of side effects: the actual effect lives behind the
  `ActionExecutionPort` seam; this host RECORDS outcomes (lock rule 3 —
  the seam is the boundary, adapters are the effect).
- **NOT** durable: in-memory reference behavior — NO persistence, NO
  network, NO real side effects (future Work Orders adapterize those).
- **NOT** provider-coupled: zero vendor names outside the adapter seam
  (lock rule 13); execution adapters are future Work Orders' (W029+).
- **NOT** a contract authority: the typed policy-decision and approval
  contracts are `@epoch/action-policy`'s; this service reuses them
  verbatim, it never forks them.

## Runtime dependency policy (W022 Tech Lead pin)

`@epoch/action-policy` (the evaluation kernel),
`@epoch/action-protocol` (the W003 proposal vocabulary),
`@epoch/authorization` (the W009 decision point), `@epoch/tenancy` (the
W009 tenant grammars), and `zod`. Compatibility with
`@epoch/event-log` / `@epoch/evidence` / `@epoch/verification` (and, for
test fixtures, `@epoch/policy-contracts`) is exercised via devDependencies
+ parity tests — never runtime deps.
