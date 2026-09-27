# @epoch/pack-construction

The Epoch Construction Domain Pack (W026, DP1.0): DATA + PURE PROJECTION
FUNCTIONS over the universal solution-delivery state (W036
`@epoch/solution-delivery`). The pack teaches Epoch how construction
expresses the universal lifecycle — it never holds lifecycle authority,
never keeps a parallel ledger, never writes canonical state, renders no UI,
and names no provider.

## What the pack provides

- **The DP1.0 pack profile** (`constructionPackProfile(tenantId)`): the W036
  `SolutionPackProfile` shape instantiated — pack id/version, the
  supported universal lifecycle version, the stage display vocabulary for
  the eleven universal stages (realize -> "Construction"), the projection
  rules over the eleven Navigator projections, measurement/migration notes
  and capability dependencies. Admitted through the W036
  `admitPackProfile` path (`admitConstructionPackProfile`); authority-claim
  fields and non-universal stage bindings are `authority-violation-rejected`
  by the kernel itself.
- **Construction vocabulary as typed data** (one sealed
  `VocabularyBundle`, content-addressed):
  - World Model entity bindings (`construction:element|space|system|zone`
    W002 type keys -> construction concepts) — descriptive bindings, never
    new authorities;
  - measurement methods (length/area/volume/count/mass with measurement
    codes and net/gross rules — deterministic quantity derivations as pure
    functions over plan quantity schedules);
  - cost/resource classifications (labour/plant/material/subcontract/
    overhead) applied as folds over the W036 `CostSchedule`/
    `ResourceSchedule`;
  - verification-method descriptors (inspection,
    measurement-against-BOQ, material certificate, commissioning test)
    referencing the W006 provenance conventions — descriptors only, the
    verification authority is never re-implemented;
  - constraint descriptors compatible with the W004 `policyBindingSchema`
    (pinned by the devDep parity tests);
  - outcome types (practical completion, defects liability, handover) as
    projections over the universal W036 outcome kinds.
- **Work templates**: versioned, content-addressed construction
  work-package/activity templates (`constructionWorkTemplates()`).
  `instantiateWorkTemplate` is a CALLER-SIDE fold producing
  plan-compatible `WorkPackage` shapes admitted by the W036
  `buildProgramOfWork` — never a canonical write.
- **The synchronized projections** (pure folds over W036 sealed state,
  recomputed on every call, digest-bearing):
  - `projectBoq` — the interactive-BOQ view model: sections (grouped by
    world-entity bindings), line items IDENTITY-MAPPED to the plan-line ids
    (the SAME ids, never minted), units, measured quantities (net/gross),
    rates, exact amounts, currency totals and the embedded delivery links;
  - `projectConstructionProgramme` — the construction programme view over
    the `SealedProgramOfWork` (activities/milestones/dependencies carrying
    the construction vocabulary);
  - `foldDeliveryLinks` — the pure derived BOQ <-> procurement <->
    execution index (projections of the universal Plan/Acquire/Realize
    concepts), linked BY TYPED REFERENCE to the canonical ids;
  - `projectConstructionOutcomes` — construction outcome views over the
    universal outcome records.

The BOQ is NEVER a stored parallel ledger: `boq-direct-write-rejected` and
`parallel-ledger-rejected` classify stored-BOQ and parallel-ledger attempts
at every pack admission surface, and the projection recomputes from sealed
state on every call.

## Discipline

- Deterministic, in-memory, zod-typed; zero wall-clock/randomness/IO.
- Tenant isolation on every record the pack produces (views carry the
  tenant id of their inputs; cross-tenant inputs are `cross-tenant-denied`).
- Partial data follows SN1.0: missing inputs project as empty views, never
  blockers.
- Provider-neutral: no vendor vocabulary anywhere (blocklist-tested).
- Runtime dependencies (frozen by W026): `@epoch/solution-delivery`,
  `@epoch/world-model`, `@epoch/agent-protocol`, `@epoch/tenancy`, `zod`.

## Verification

```
pnpm install
pnpm check
pnpm exec turbo run typecheck lint test build --concurrency=1 --force
```

The test battery (161 tests) covers every acceptance criterion with named
tests: profile admission (positive + authority/vendor/malformed negatives),
the BOQ projection (identity mapping, net/gross derivation, links,
determinism, partial data), the programme projection, template
instantiation into plan-compatible shapes, measurement/classification
folds, round-trip serialization + digest verification for every public
type, tenant isolation, tamper detection, provider-neutrality source
scans, and runtime parity with the W004/W006/W007/W036 kernel grammars.
