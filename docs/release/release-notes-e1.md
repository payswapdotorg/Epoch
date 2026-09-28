# E1.0/X1.0 Program Release 1 — Release Notes (W035)

The reference release notes of the first Epoch program release. This
document is the human-readable PROJECTION of the typed
`ReleaseNotes` record of the reference release candidate
(`release:e1-program-1` — see `release/test/helpers.ts` and
`examples/sdk/release-readiness-example.ts`): the record carries the
sections, the highlights and the typed citations; this rendering never
contradicts it. The typed notes-record machinery is pinned by
`release/test/readiness.positive.test.ts` (notes admission) and
`release/test/readiness.negative.test.ts` (citation grammar + tamper
refusals).

## Highlights

- **A deterministic, typed release model**: scope → derived checklist →
  typed evidence → pure evaluation → sealed manifest → replayable
  `release:readiness` event journal (W035).
- **The verification battery and benchmark citations are
  content-addressed data** — the same three-command battery the
  operators and CI run, mirrored from the W033 deploy gate.
- **The SDK documentation set ships pinned to the exact contract
  versions** the packages export, machine-checked by the contract-sync
  suite.

## What ships

The program surface at this release: the canonical world model, the
agent/action protocols, the constraint/policy language, simulation and
evaluation protocols, verification/evidence/provenance, the capability
registry + adapter SDK, the extension SDK + Wasm runtime layout, the
tenancy/identity/authorization kernel, the event/replay/collaboration
kernel, the experience protocol + compiler, the renderer runtime, the
web app shell with the agent/world/marketplace feature modules, the
desktop and mobile field clients, agent runtime/orchestration, the
simulation execution fabric, the action gateway, the marketplace kernel
+ host, the two domain packs (construction, software/infrastructure),
the document-to-adapter service, the external adapter reference set
(Git/IFC/MCP/FMI), the reference E2E slices, the cross-domain
integration harness, the production deployment model, the performance
kernel, the solution-delivery core with its acquisition/realization/
actualization/learning/supervision chain, the external event bridge
with the Aurum Chat reference adapter, and the fine-grained access
projection layer.

The component inventory of the reference release scope is typed data
(`release/test/helpers.ts` — `referenceScope().components`); the
released trees are enumerated by the Work Order index below.

## Work Order index (merged at this release)

| Wave | Work Orders |
| --- | --- |
| Foundation | W001 repository/runtime foundation; W002 canonical world model; W003 agent + action protocols; W004 constraint & policy language |
| Simulation & evidence | W005 simulation + evaluation; W006 verification/evidence/provenance |
| Capability fabric | W007 capability registry + adapter SDK; W008 extension SDK + Wasm |
| Tenancy & events | W009 tenancy/identity/authorization; W010 event/replay/collaboration |
| Experience | W011 experience protocol; W012 experience compiler; W013 renderer runtime |
| Clients | W014 web app shell; W015 AI collaboration UX; W016 interactive world UX; W017 desktop client; W018 mobile field client |
| Services | W020 agent runtime; W021 simulation execution fabric; W022 action gateway + human approval; W023 marketplace |
| Packs & adapters | W026 construction pack; W027 software/infrastructure pack; W028 document-to-adapter; W029 external adapter reference set (Git/IFC/MCP/FMI) |
| Proof layer | W031 reference E2E slices; W032 cross-domain integration harness |
| Operations | W033 production deployment; W034 performance + scale |
| Solution delivery | W036 delivery core; W037 resource acquisition; W038 realization tracking; W039 actualization/variance/forecast; W040 outcome learning + calibration; W041 access projections; W042 external event bridge + Aurum Chat reference adapter; W043 delivery supervision + alerts |

Not yet merged at this release: W019 renderer/device adaptation, W024
billing + entitlements, W025 developer portal/publishing, W030
security/isolation/observability, W044 delivery-to-learning E2E
fixture — and this Work Order itself (W035, the release/SDK docs/
marketplace readiness surface you are reading).

## Verification

The release's battery is the Epoch verification battery of record —
the same three commands the W033 deploy gate pins verbatim
(`deploy/src/gates/gates.ts` — `REFERENCE_BATTERY_COMMANDS`; mirrored
into the release scope by `release/test/helpers.ts`):

1. `pnpm install` (exit 0)
2. `pnpm check` (exit 0) — governance + boundary
3. `pnpm exec turbo run typecheck lint test build --concurrency=1 --force` (exit 0)

The owned out-of-glob surfaces of this Work Order additionally run
their own battery (see `release/README.md`):

```
pnpm --filter @epoch/test-harness exec vitest run --root ../../release
pnpm --filter @epoch/test-harness exec tsc --noEmit -p ../../release/tsconfig.json
(cd release && ../packages/test-harness/node_modules/.bin/eslint .)
(cd examples/sdk && ../../packages/test-harness/node_modules/.bin/eslint .)
```

## Performance

The release cites the W034 performance discipline — deterministic,
wall-clock-free operation-count budgets. The budget catalog of record
is [`docs/performance/budget-catalog.md`](../performance/budget-catalog.md);
the evidence suite is `tests/performance/test/` and the kernel
self-tests of `@epoch/performance` (see
[`docs/performance/README.md`](../performance/README.md)). The catalog
budgets:

- `budget:solution-admission` — the W036 admission path is constant in
  plan lines (a per-line re-admission regression exceeds the envelope).
- `budget:program-fold` — the five synchronized schedule folds iterate
  their input records once each.
- `budget:pack-projection` — the domain-pack projections emit one view
  row per input record.
- `budget:observation-stack` — the full authority path per observation
  is linear with small constants.
- `budget:variance-stack` — per variance record: seal, admission, folds.
- `budget:harness-scenario` — the W032 runner double-runs every
  scenario for replay determinism (4S+4 driver-seam invocations).
- `budget:delivery-stack-composition` — the composed delivery stack at
  N plan lines under the composition grammar.
- `budget:distinction-refold` — the fold-discipline envelope that makes
  re-fold-after-every-admission a typed over-budget verdict.

Citations in the typed release scope carry each budget's input unit,
size, overall verdict and the content digests of the cited budget +
verdict records (`release/src/scope.ts` — `BenchmarkCitationSchema`).

## SDK surfaces

This release publishes four documented SDK surfaces, each pinned in
[`docs/sdk/sdk-versions.md`](../sdk/sdk-versions.md) and machine-checked
against the exported constants by
`release/test/contract-sync.test.ts`:

- `@epoch/adapter-sdk` (W007) — the per-category adapter contracts,
  bind-time version negotiation, deterministic descriptor digests.
- `@epoch/capability-registry` (W007) — the capability/version
  vocabulary listings and extensions bind to.
- `@epoch/extension-sdk` (W008) — the extension authoring surface:
  manifests, grants, trust-class ceilings.
- `@epoch/marketplace` (W023) — the marketplace domain kernel:
  listings, entitlements, usage accounting, revenue records.

## Marketplace readiness

The marketplace readiness criteria of this release — listing chain
verification, the entitlement flip, usage fold determinism, revenue
provenance completeness — are documented in
[`docs/marketplace-readiness/readiness-criteria.md`](../marketplace-readiness/readiness-criteria.md)
and proven by the marketplace kernel's own suites plus the
`release/test/examples.test.ts` composition
("examples/sdk — marketplace listing (W023)"), which drives the real
kernel end to end and produces the four typed readiness evidence
records.

## Known limitations

- The release model is a readiness/record model, not a distribution
  system: nothing here publishes artifacts to any channel (any real
  channel is a future adapter behind a provider-neutral seam).
- The revision carried by the reference scope is the dispatch-base SHA
  as fixed data; the model never reads git state.
- The reference benchmark citations in the test fixtures carry
  deterministic fixture digests; the REAL catalog records live in the
  W034 surface (`tests/performance`) and are cited by id in these notes.
