# Environment model (W033)

Environments are typed RECORDS in the topology catalog — dev, staging and
prod differ only by data (`tier`, tenant scope, placements). No tier is
special-cased anywhere in code: the planner treats a request for
`env:dev` exactly like one for `env:prod`.

## Tenants

An environment carries its tenant scope (`tenantIds`, at least one;
`env:prod` in the reference catalog is deliberately multi-tenant). Tenant
isolation (R12) is enforced at every environment-scoped boundary:

| Boundary | Refusal |
| --- | --- |
| A placement owned by a tenant outside the environment scope | `cross-tenant-placement-rejected` |
| A wiring edge across two tenants inside one environment | `cross-tenant-wiring-rejected` |
| A plan request from a tenant outside the environment scope | `cross-tenant-plan-rejected` |

## Instants are caller-supplied

The model never reads a clock. `provisionedAt`, planned/executed instants
and every provenance instant are data supplied by the caller. This is
what makes every digest replay-stable: the same inputs (including the
same instants) always produce the same digests, in every process.

## The fixture environment state (what the executor runs against)

The reference executor executes plans against a tenant-scoped
ENVIRONMENT STATE — an in-memory snapshot of what is currently placed in
one environment for ONE tenant:

```
EnvironmentState {
  environmentId, tenantId,
  derivedFromTopologyDigest,   // skew detection at the executor door
  placements: [ { componentId, revision, tenantId, placedAt } ]  // sorted
  digest                       // content-addressed; byte-comparable
}
```

- `environmentStateFromTopology(topology, env, tenant, { baselineAt })`
  derives the state from a topology revision (only that tenant's
  placements).
- Every transition (`withPlacement`, `withoutPlacement`) returns a NEW
  sealed state — states are immutable values.
- The executor REFUSES to run when the state disagrees with the plan:
  a different topology (`topology-skew`), a state whose placements
  contradict the plan's declared rollback points (`fixture-state-skew`),
  or a state scoped to a different tenant (`cross-tenant-plan-rejected`).

## Health probes are fixture observations

A health-check step consumes a typed `HealthProbeObservation` — a
declaration of what a probe OBSERVED (`healthy` | `degraded` | `failed`,
plus a caller-supplied instant), never a probe invocation. `degraded`
passes with the observation noted on the outcome; `failed` triggers the
typed failure + rollback path ([deploy-plan lifecycle](./deploy-plan-lifecycle.md)).
