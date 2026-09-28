# Epoch Operations Manual (W033)

The operator-facing documentation of the Epoch deployment model — written
for operators, with no secrets and no provider names (the model is
provider-neutral by construction; see the
[provider-neutrality contract](./provider-neutrality-contract.md)).

**What this model is:** a typed, deterministic, in-repo topology + plan +
executor + runbook model — proof-of-correctness artifacts. **What it is
not:** live deployment tooling. Nothing in `deploy/` or `ops/` calls a
provider, provisions infrastructure, or holds credentials. Any real
provider is a future adapter behind the topology model (the W029 adapter
pattern applied to deployment).

## The documents

| Document | What it covers |
| --- | --- |
| [Topology catalog](./topology-catalog.md) | The typed component/environment/placement/wiring records and the reference catalog |
| [Environment model](./environment-model.md) | dev/staging/prod as typed records, tenant scoping, the fixture environment state |
| [Deploy-plan lifecycle](./deploy-plan-lifecycle.md) | Plan request → deterministic planning → execution → receipts → rollback |
| [Gate policy](./gate-policy.md) | The verification battery as data and the refusal points |
| [Runbook index](./runbook-index.md) | The incident classes, the reference runbooks, the simulator's proof model |
| [Provider-neutrality contract](./provider-neutrality-contract.md) | Why no provider appears here, and how a real provider would be admitted |

## The one-page orientation

1. The **platform** is a TOPOLOGY: typed records of components (which
   workspace packages/services/apps/adapters/packs exist), environments
   (dev/staging/prod, tenant-scoped), placement (what revision of a
   component is in which environment, owned by which tenant) and wiring
   (which placed components depend on which). Everything is
   content-addressed data.
2. A **deploy plan** is a deterministic function of a topology revision +
   a component set + an environment (+ the gate policy): an ordered,
   dependency-sorted sequence of build → verify(gate) → rollback-point →
   promote → health-check steps per component.
3. The **gates** refuse to promote unless the verification battery is
   green — the battery is DATA (command strings + expected exit codes),
   and the reference battery is exactly the Epoch verification battery.
4. The **reference executor** runs plans against fixture environment
   models and emits typed step outcomes + sealed receipts; a failed
   health check triggers an ATOMIC ROLLBACK to the recorded prior
   revisions (byte-exactly verified).
5. **Runbooks** are typed data keyed by incident class; the incident
   simulator replays them against fixture traces and emits sealed
   recovery proofs — one per class, with typed non-recovery negatives.

## Where the code lives

- `deploy/` — the deployment model (topology, gates, plans, executor) +
  the evidence suite. See [`deploy/README.md`](../../deploy/README.md).
- `ops/` — the operations kit (runbooks, simulator, checklists). See
  [`ops/README.md`](../../ops/README.md).

Every claim in these documents is pinned by a named test in
`deploy/test/*.test.ts` (97 tests); the mapping is recorded in the Work
Order's PR (criterion → named test).
