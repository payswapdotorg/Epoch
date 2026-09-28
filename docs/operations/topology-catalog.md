# Topology catalog (W033)

The topology is the platform as DATA: typed, content-addressed records.
Swapping environments or revising the catalog changes records — never
code. The planner and executor are pure functions over these records.

## The record kinds

### Components (`cmp:` ids)

| Field | Meaning |
| --- | --- |
| `componentId` / `kind` / `name` | Opaque id (`cmp:<slug>`), repository role (`package` \| `service` \| `app` \| `adapter` \| `pack`), display name |
| `workspacePath` | The repository-relative path of the workspace member (e.g. `packages/tenancy`) |
| `dependsOn` | Compile/dependency edges to other components, BY ID (never by path) |
| `health` | The neutral health declaration: `checkKind` (`readiness` \| `liveness` \| `startup`), `timeoutMs`, `intervalMs` — a declaration, never a probe call |
| `capacity` | The neutral capacity declaration: `replicas` (abstract units, 1..64) |

### Environments (`env:` ids)

| Field | Meaning |
| --- | --- |
| `environmentId` / `tier` / `displayName` | Opaque id, tier (`dev` \| `staging` \| `prod`), display name. `prod` is not special in code |
| `tenantIds` | The tenant scope of the environment (R12 isolation boundary; at least one) |
| `provisionedAt` | A CALLER-SUPPLIED instant — the model never reads a clock |

### Placement

One record per (environment, component): the currently-deployed
`revision` (`rev:<16hex>`, content-derived), owned by a `tenantId` that
MUST be within the environment's tenant scope
(`cross-tenant-placement-rejected` otherwise). An absent placement means
"not deployed here yet" — a fresh deploy whose rollback un-places.

### Wiring

One record per dependency edge between two PLACED components of ONE
environment (`from` consumes `to`). Endpoints must be placed in the
wiring's environment (`wiring-environment-mismatch`) and owned by the
SAME tenant (`cross-tenant-wiring-rejected`).

### Topology revisions (`topo:` ids + sequence)

A revision seals the four collections with one digest. Admission (total,
typed errors) runs, in order: child digest verification
(`digest-mismatch` on tamper), duplicate detection, reference integrity,
dependency-cycle detection, tenant isolation, and the provider-vocabulary
scan. The seal sorts every collection canonically, so identical records
in ANY input order produce the IDENTICAL revision digest.

## The reference catalog (the real workspace)

The reference topology of the evidence suite mirrors the REAL Epoch
workspace — `deploy/test/helpers.ts`:

| Component | Kind | Path | Depends on |
| --- | --- | --- | --- |
| `cmp:agent-protocol` | package | `packages/agent-protocol` | — |
| `cmp:tenancy` | package | `packages/tenancy` | `cmp:agent-protocol` |
| `cmp:event-log` | package | `packages/event-log` | `cmp:agent-protocol`, `cmp:tenancy` |
| `cmp:action-protocol` | package | `packages/action-protocol` | `cmp:agent-protocol` |
| `cmp:action-gateway` | service | `services/action-gateway` | `cmp:action-protocol`, `cmp:tenancy` |
| `cmp:web-app` | app | `apps/web` | `cmp:action-gateway`, `cmp:event-log` |
| `cmp:adapter-github` | adapter | `adapters/github` | `cmp:action-protocol` |
| `cmp:pack-construction` | pack | `packs/construction` | `cmp:tenancy`, `cmp:event-log` |

Environments: `env:dev` and `env:staging` (tenant `epoch-labs`), and the
deliberately multi-tenant `env:prod` (`epoch-labs` + `epoch-field`). The
prod placements carry the full lab spine (kernels at `REV_A`, gateway at
`REV_B`, web at `REV_C`) plus the field tenant's pack placement; prod
wiring mirrors the dependency edges above. The ops runbook catalog
([runbook index](./runbook-index.md)) references these same component
ids.

## Versioning

Every record carries `recordVersion: 1` and the contract surface is
`DEPLOY_MODEL_CONTRACT_VERSION 1.0.0` (`deploy/src/version.ts`). Records
are admitted only at the exact version — skew is a typed `validation`
refusal before any other diagnostic.
