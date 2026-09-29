# Capability Discovery (W045, ACR-004)

Owned by Work Order **W045** (`packages/capability-discovery/*`,
`services/capability-discovery/*`, `contracts/capability-discovery/*`,
`docs/capability-discovery/*`). Kernel layer + service composition.

This is the universal **Role & Capability Discovery Plane** (ARCD1.0 /
ACR-004): the machinery that lets Epoch infer what kinds of agents,
humans, capabilities and substrates a problem requires — instead of
assuming every role, model or provider was predefined.

```
Problem evidence -> capability demands -> role proposals -> candidates
  -> evaluation -> approved organization        (stream A, problem-driven)

Known gaps + schedules/events -> source adapters -> safe ingestion ->
  sandbox / profile / evaluation / policy gates -> availability
                                                (stream B, ecosystem)
```

Both streams share the same capability-contribution and evaluation
machinery. **Discovery never grants execution authority and never mutates
authoritative state** (architecture-lock autonomous-discovery
invariants).

## Contents

| Surface | What it is |
|---|---|
| `packages/capability-discovery` | The KERNEL: the universal demand compiler, role synthesizer, candidate resolver, gap lifecycle, organization composition + evaluation, content-addressed run lineage, scheduler contract, source-adapter interface, ingestion/promotion boundary, ecosystem proposals, tenant-scoped store. |
| `services/capability-discovery` | The SERVICE composition: the same workflows behind a fail-closed caller-supplied authorization gate and REAL `@epoch/tenancy` validation; the deployment-neutral scheduler invocation. |
| `contracts/capability-discovery` | The typed, versioned, provider-neutral contract surface: `index.d.ts` + `parity.ts` + `manifest.json` + JSON Schema projection. |
| `docs/capability-discovery` | This README, the [contract summary](./contract-summary.md) and the [security boundary](./security-boundary.md). |

## The universal compiler (acceptance 1, 2)

From **only** task/world/evidence/constraint input (a provider-neutral
`DiscoveryInput`), the compiler derives `CapabilityDemand` records
through universal rules — one rule family per signal kind
(`operation`, `decision`, `verification`, `artifact`, `quality`,
`unknown`, `failure`, `work`, `budget`, `environment`, `authority`,
`dependency`, `outcome`), plus constraint attachment and domain-pack
priors. Signals fold in canonical order with commutative facet merges
(union / min / max / OR), so **authoring order never leaks**.

Roles are then synthesized by a universal clustering rule (connected
components over capability dependencies + shared operation namespace).
The role's slug, mission, interfaces, planning behavior, authority
boundary and confidence are all DERIVED — there is no predefined
role/model pair anywhere, and `RoleProposal` has structurally no field
that could name a model or provider (pinned by the neutrality battery:
a blocklist fixture naming common providers must appear nowhere in
kernel src).

### Domain packs are priors, never a second compiler (acceptance 7)

A `DomainPackContribution` may provide demand templates, role templates
and signal bindings. The compiler:

- **adds** a template's demand only when its applicability matches;
- **tightens** universal facets only (stricter quality target, extra
  evidence requirements, human cosign);
- **records and ignores** every attempted relaxation
  (`template-override-rejected`), and
- **overrides** role templates whose grouping conflicts with the
  universal clustering.

The same machinery serves construction, software and future packs —
proven by the cross-domain battery (distinct demands and roles from the
same functions, no domain-specific compiler).

## Candidate resolution (acceptance 3)

Existing surfaces are compared against role demands through
provider-neutral capability contracts:

- **Agent Protocol registrations (W003)** — via
  `candidateFromAgentRegistration` (real `AgentRegistration` records);
- **Capability Registry records (W007)** — via
  `candidateFromCapabilityRecord` (real `CapabilityRecord` records);
- **human declarations** — via `candidateFromHumanDeclaration`;
- **external candidates** — via the ingestion boundary (stream B).

The match goes `demand.operation <-> claimed operation + input/output
representation kinds + quality claim + latency budget`. A claim that
matches operationally but rests on declaration-only evidence (or an
external candidate below the promotion gates) resolves as `claimed`,
never `satisfied`. A model is selected because its MEASURED capabilities
satisfy the role's demands — the model name is never part of the
semantic role identity (R37).

## Gaps, organizations, evaluation (acceptance 4, 5)

An unmet demand becomes an explicit `CapabilityGap`
(`UNSATISFIED -> CANDIDATE_FOUND -> EVALUATED -> VERIFIED / DEGRADED /
REQUIRES_HUMAN`), with an append-only hash-linked transition chain and
tamper detection (`verifyGapChain`). Gaps feed ecosystem discovery.

Candidate organizations are composed (primaries, backups, handoffs from
dependency edges, supervision from authority/verification demands) and
evaluated under the task's DECLARED objective/constraint/evidence
criteria over deterministic neutral metrics (demand-coverage,
evidence-coverage, redundancy-coverage, estimates, gap-count,
critical-single-point-count). Hard constraints eliminate; objectives
score; the selection (or staging) records values and reasons.

## Reproducibility (acceptance 8)

Every run is content-addressed and fully re-derivable:

- the input is canonicalized first (shuffle-invariant run identity);
- the lineage is digest-CHAINED:
  `inputs -> demands -> roles -> resolution -> organizations -> evaluation -> selection`
  (problem-driven) or `inputs -> candidates -> gap-updates -> promotions`
  (ecosystem);
- `verifyDiscoveryRun` RE-DERIVES the whole pipeline from the
  artifact's own inputs and verifies every record set, digest and chain
  link — a tampered record fails even if its set digest is recomputed.

Zero wall-clock, zero randomness, zero environment reads anywhere in
the kernel: instants are caller-supplied data.

## The scheduler is a contract (deployment-neutral)

`EcosystemDiscoverySchedulerContract` is a pure interface
(`isDue`/`nextDue`) plus an in-memory reference driver. Any authorized
external scheduler invokes the SAME service contract
(`runEcosystemDiscovery` with trigger `scheduled`); the default cadence
is weekly; event-driven runs bypass the cadence entirely. No scheduler
dependency, no cron library. A source adapter is NOT the scheduler and
is never a kernel dependency.

## External discovery (acceptance 6, R38)

`DiscoverySourceAdapter` is the provider-neutral seam (one method:
`scan(query)`); the reference adapter is a static fixture catalog — no
real external registry is integrated. Artifacts become
`CandidateProfile` records at `discovered` state: sandbox-required,
outside the Epoch trust domain, claims recorded as `declared`. They are
**non-consequential** until the promotion gate walks the CC1.0 chain
(`discovered -> ingested -> sandboxed -> profiled -> evaluated ->
verified`) with its mandatory evidence: a passed isolated sandbox
report, fully-passing measured evaluation evidence, and — for
`verified` — a human policy approval. Organizations binding unverified
primaries are composed as STAGED and can never be selected.

## What this plane never does

- never grants execution authority (`executionAuthority` is structurally
  `'none'` on every demand/role);
- never mutates authoritative world/solution/delivery state (opaque
  references only — see the [security boundary](./security-boundary.md));
- never replaces the Capability Registry, the Agent Protocol, the
  Constraint Engine, Verification, the Action Gateway or a domain pack;
- never infers a profession from a model label;
- never activates a discovered model, adapter, extension or domain pack
  automatically (proposals are records; activation is Epoch governance).

## Verification

The full battery (kernel: 191 tests; service: 19 tests) runs in CI:

```
pnpm turbo run governance boundary typecheck lint test build
```

Highlights: cross-domain fixtures (construction + software), the five
named negatives (execution authority, canonical-state mutation,
unverified promotion, template override, cross-tenant isolation), the
provider blocklist, determinism/shuffle-invariance, lineage tampering,
serialization round-trips and the contract-drift pins.
