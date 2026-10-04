# Epoch Work Items WO2.0

One Work Order = one branch = one PR. Worker count = 1. Concurrent items must have pairwise-disjoint write surfaces. Only currently authorized items are recorded by live Work Order state.

## Dispatch contract
The Tech Lead derives the live frontier from dependencies. Up to three READY items may be active at once. A static wave never overrides a dependency edge. If four+ items are READY, select any three whose declared write surfaces are pairwise disjoint.

| ID | Scope | Depends | Owned surfaces |
|---|---|---|---|
| W001 | Repository/runtime foundation, CI, test harness, package boundaries | — | root manifests, apps/*, packages/*, services/*, packs/*, scripts/*, .github/* |
| W002 | Canonical World Model | W001 | packages/world-model/*, contracts/world/* |
| W003 | Agent + Action Protocols | W001 | packages/agent-protocol/*, packages/action-protocol/*, contracts/agent/*, contracts/actions/* |
| W004 | Constraint & Policy Language | W001 | packages/constraint-language/*, packages/policy-contracts/*, contracts/constraints/* |
| W005 | Simulation + Evaluation | W002 | packages/simulation-protocol/*, packages/evaluation-protocol/* |
| W006 | Verification/Evidence/Provenance | W002 | packages/verification/*, packages/evidence/*, packages/provenance/* |
| W007 | Capability Registry + Adapter SDK | W003,W005,W006 | packages/capability-registry/*, packages/adapter-sdk/* |
| W008 | Extension SDK + Wasm | W003,W007 | packages/extension-sdk/*, packages/extension-runtime/*, runtimes/wasm/* |
| W009 | Tenancy/Identity/Authorization | W002,W007 | packages/tenancy/*, packages/identity/*, packages/authorization/* |
| W010 | Event/Replay/Collaboration | W002,W003,W009 | packages/event-log/*, packages/replay/*, packages/collaboration/* |
| W011 | Experience Protocol | W002,W003,W006,W007 | packages/experience-protocol/*, contracts/experience/* |
| W012 | Experience Compiler | W011 | packages/experience-compiler/*, contracts/experience-compiler/* |
| W013 | Renderer Runtime | W011 | packages/experience-runtime/*, packages/renderer-runtime/*, contracts/renderers/* |
| W014 | Web App Shell | W009,W011,W012 | apps/web/app/*, apps/web/src/shell/*, apps/web/src/shared/* |
| W015 | AI Collaboration UX | W010,W011,W012 | packages/ai-experience/*, apps/web/src/features/agents/* |
| W016 | Interactive World UX | W012,W013 | packages/world-experience/*, apps/web/src/features/world/* |
| W017 | Desktop Client | W014,W015,W016 | apps/desktop/* |
| W018 | Mobile Field Client | W014,W015,W016 | apps/mobile/* |
| W019 | Renderer/Device Adaptation | W013,W016 | packages/device-capabilities/*, packages/renderer-adapters/*, packages/progressive-scene/* |
| W020 | Agent Runtime/Orchestration | W003,W007,W010 | services/agent-runtime/*, packages/agent-orchestration/* |
| W021 | Simulation Execution Fabric | W005,W007,W020 | services/simulation-runner/*, packages/simulation-fabric/* |
| W022 | Action Gateway + Human Approval | W003,W004,W006,W009,W020 | services/action-gateway/*, packages/action-policy/* |
| W023 | Marketplace | W007,W008,W009 | services/marketplace/*, packages/marketplace/*, apps/web/src/features/marketplace/* |
| W024 | Billing + Entitlements | W009,W023 | services/billing/*, packages/entitlements/* |
| W025 | Developer Portal/Publishing | W008,W023,W024 | services/developer-portal/*, apps/web/src/features/developers/* |
| W026 | Construction Pack | W002,W004,W006,W007,W011,W013,W036 | packs/construction/* |
| W027 | Software/Infrastructure Pack | W002,W003,W006,W007,W011,W013,W036 | packs/software/* |
| W028 | Document-to-Adapter | W002,W004,W006,W007,W008 | services/document-adapter/*, packages/document-adapter/* |
| W029 | External Adapter Reference Set (Git/IFC/MCP/FMI) | W007,W013,W021,W022 | adapters/github/*, adapters/ifc/*, adapters/mcp/*, adapters/fmi/* |
| W030 | Security/Isolation/Observability | W008,W009,W020,W021,W022,W023 | services/security/*, packages/observability/*, tests/security/*, docs/security/* |
| W031 | Reference E2E slices | W014,W015,W016,W020,W021,W022,W026,W027,W028,W029 | examples/e2e/*, tests/e2e/*, docs/e2e/* |
| W032 | Cross-domain integration harness | W026,W027,W028,W029,W031 | packages/test-harness/*, tests/contracts/*, tests/integration/* |
| W033 | Production deployment | W032 | deploy/*, ops/*, docs/operations/* |
| W034 | Performance + scale | W032,W033 | packages/performance/*, tests/performance/*, docs/performance/* |
| W035 | Release/SDK docs/marketplace readiness | W033,W034 | docs/release/*, docs/sdk/*, docs/marketplace-readiness/*, examples/sdk/*, release/*, .github/workflows/* |
| W036 | Solution Delivery Core: universal lifecycle, SolutionPackage, DeliveryRecord, Program of Work, acquisition/realization/external-event contracts | W002,W003,W004,W006,W009,W010,W011 | packages/solution-delivery/*, contracts/solution-delivery/*, docs/solution-delivery/* |
| W037 | Resource acquisition + supplier delivery tracking (procurement projection) | W036,W007,W009 | packages/procurement/*, services/procurement/*, contracts/procurement/* |
| W038 | Realization tracking + low-friction field observation (execution projection) | W036,W006,W007,W010 | packages/execution-tracking/*, services/execution-tracking/*, contracts/execution/* |
| W039 | Actualization + variance + forecast | W037,W038 | packages/actualization/*, services/actualization/*, packages/variance/*, contracts/actualization/* |
| W040 | Outcome learning + prediction calibration | W039,W005,W006 | packages/learning-calibration/*, services/learning-calibration/*, contracts/learning-calibration/* |
| W041 | Fine-grained authorization + authorized projections | W009,W011,W036 | packages/access-projection/*, services/access-projection/*, contracts/access-projection/* |
| W042 | Provider-neutral external event bridge + optional Aurum Chat adapter | W007,W010,W036,W041 | packages/external-event-bridge/*, adapters/aurum-chat/*, contracts/external-event-bridge/*, docs/integrations/aurum-chat/* |
| W043 | Delivery supervision + alerts | W020,W022,W036,W038 | packages/supervision/*, services/supervision/*, packages/alerts/*, contracts/supervision/* |
| W044 | Delivery-to-learning construction E2E fixture | W026,W031,W037,W038,W039,W040,W041,W042,W043 | examples/delivery-e2e/*, tests/delivery-e2e/*, docs/delivery-e2e/* |
| W045 | Autonomous Role & Capability Discovery: capability-demand compiler, role proposals, organization search, external model/capability discovery, scheduled ecosystem scan | W002,W003,W004,W006,W007,W009,W010,W011,W020 | packages/capability-discovery/*, services/capability-discovery/*, contracts/capability-discovery/*, docs/capability-discovery/* |

## Approved successor architecture program

ACR-001 (approved 2026-09-24) adds the Solution Delivery architecture in spec/solution-delivery-architecture.md and the optional Aurum bridge in spec/aurum-chat-integration.md. ACR-002 clarifies the universal lifecycle and domain-pack/Navigator rules in spec/universal-solution-lifecycle.md, spec/domain-pack-contract.md, and spec/solution-navigator-architecture.md. ACR-003 establishes the Capability Foundation Policy in spec/capability-foundation-policy.md: third-party engineering foundations remain replaceable capabilities behind the Capability/Adapter Fabric and forks require an explicit architecture/legal/operations gate.

W036-W044 remain READY_AFTER_DEPENDENCIES until the ACR-001/ACR-002/ACR-003 lock transition is made effective. The currently authorized W009/W011 wave remains pinned to the existing E1.0/X1.0 contract surface and is not redefined by the successor architecture targets.

ACR-003 creates no standalone implementation Work Order. Concrete foundation integrations are scheduled through the existing Capability/Adapter, Renderer/Experience, Desktop or Domain Pack surfaces when they fit those ownership boundaries; otherwise the Architect must create and authorize a new Work Order.

## Verified parallelism design
The dependency graph is authoritative. Safe examples are:
- W002 + W003 + W004
- W005 + W006
- W008 + W009
- W010 + W011
- W012 + W013
- W014 + W015 + W016
- W017 + W018 + W019
- after W036: W037 + W038 + W041, subject to max 3 and exact ownership checks.
- after W036 and W041: W037 + W038 + W042, subject to max 3 and exact ownership checks.
No static group overrides dependencies.

## Universal acceptance
Every item must stay inside owned surfaces, add evidence for acceptance, preserve authority boundaries, avoid shared root-manifest/lockfile changes during parallel work, and document exact verification and final head SHA.

## Domain-pack acceptance
Every domain pack must conform to spec/domain-pack-contract.md, bind to the universal lifecycle, and implement domain schedules as ProgramOfWork projections. A pack may specialize vocabulary/capabilities but may not create a competing lifecycle authority or promote a provider-native foundation project into semantic authority.

## Capability-foundation acceptance
Every third-party foundation integration must conform to spec/capability-foundation-policy.md. Provider-native files/projects remain linked artifacts, not the Epoch semantic database. Any fork requires ACR approval plus documented license/dependency, security/isolation, divergence, upstream/reintegration, update and exit planning.

## ACR-004 autonomous discovery program

ACR-004 introduces the universal Role & Capability Discovery Plane defined in spec/autonomous-role-capability-discovery.md and the universal contribution boundary in spec/capability-contribution-contract.md.

W045 is the implementation entry point. It intentionally unifies problem-driven organization search and scheduled ecosystem discovery because both streams share capability-demand, candidate-evaluation, provenance and promotion machinery.

Problem-driven discovery handles concrete capability gaps in a task/project. Ecosystem-driven discovery runs on a schedule (weekly by default) and scans authorized public/private sources through adapters. No source, model or provider becomes a kernel dependency.

W045 is gated by its dependency set and by the explicit architecture-lock transition for successor architecture. It must not disturb currently in-flight Work Orders.


# ACR-005 Productization Work Orders

The W001-W045 program is complete. ACR-005 establishes W046-W050.

| ID | Scope | Depends | Owned surfaces |
|---|---|---|---|
| W046 | Shared Product Runtime + Application Gateway, persistence/auth/session seams, product fixtures | W001-W045 | contracts/application-gateway/*, packages/client-runtime/*, services/application-gateway/*, packages/persistence/*, packages/object-storage/*, packages/authentication/*, qa/fixtures/*, docs/product-runtime/*, spec/journeys/fixtures/* |
| W047 | Web Product + Browser Journey Validation | W046 | apps/web/*, qa/web/*, docs/journeys/web.md |
| W048 | Desktop Native Product + Desktop Journey Validation | W046 | apps/desktop/*, qa/desktop/*, docs/journeys/desktop-linux.md, docs/journeys/desktop-windows.md, docs/journeys/desktop-macos.md |
| W049 | Mobile Native Product + Mobile Journey Validation | W046 | apps/mobile/*, qa/mobile/*, docs/journeys/mobile-android.md, docs/journeys/mobile-ios.md |
| W050 | Cross-Platform Release + Journey Closure | W047,W048,W049 | apps/web/*, apps/desktop/*, apps/mobile/*, qa/cross-platform/*, docs/journeys/*, release/clients/*, .github/workflows/*client*, .github/workflows/*e2e*, docs/release/* |

## ACR-005 concurrency

Only W046 is initially authorized. After W046 merges and the Tech Lead reconciles dependency/lockfile state, W047/W048/W049 may run concurrently because their implementation surfaces are disjoint. W050 is serialized after all three.

W050 is the explicit cross-platform hardening exception and may edit all three client trees only after W047-W049 have merged.

## Productization acceptance invariant

For W047-W050, source-level CI is necessary but insufficient: the worker must build a real artifact, launch/use it through the visible product, execute the required journey set, record defects, fix P0/P1 (and scoped P2) issues, add regression evidence and rerun.

## Dependency/reconciliation rule

Workers do not modify shared root manifests/lockfiles in parallel. The Tech Lead serializes dependency-intake and lockfile reconciliation after merges.

# ACR-006 Public Deployment Work Orders

The ACR-005 productization program is complete (W001-W050, 50/50). ACR-006 (Public Deployment, Free-Tier Infrastructure & Production Operations) establishes W051-W055: making the completed product publicly deployable and actually accessible over the internet on free-tier infrastructure, with no new semantic authority.

| ID | Scope | Depends | Owned surfaces |
|---|---|---|---|
| W051 | Production deployment foundation: environment contract, provider-neutral deployment contracts, health/readiness, bootstrap/migration contract, deployment manifests + env templates (placeholders only), cost guardrails, observability contract, freeze seams (RequestGuard port; REAL adapter implementations — amended 2026-10-02: the binding layer must actually bind) | ACR-006 | spec/deployment-architecture.md, spec/production-environment.md, spec/free-tier-infrastructure.md, spec/production-security.md, spec/production-operations.md, spec/production-rollback.md, docs/deployment/*, services/application-gateway/src/rate-limit.ts + test, adapters/s3-object-store/*, adapters/upstash-redis/*, apps/web/src/server/production-*.ts + product-runtime.ts (gateway construction seam — amended), apps/web/app/api/healthz/*, apps/web/app/api/readyz/*, apps/web/app/api/gateway/route.ts (IP guard + size limit — amended), apps/web/package.json (workspace links only), apps/web/.env.example, apps/web/vercel.json, apps/web/tsconfig.tsbuildinfo, release/clients/release-manifest.json (the web definition-file stamp — regenerated per the X-06 freshness contract), packages/object-storage/src/index.ts (the additive 'unavailable' error code), spec/development-state/*, spec/PROJECT-STATE.md, AI_CONTINUATION.md, docs/LLM-ARCHITECT-HANDOFF.md, docs/product-runtime/limitations.md (pg state note) |
| W052 | Public web + Vercel production deployment: real public environment, production env vars, public URL, health/readiness + auth/session + API routing + tenant-boundary validation, real browser journeys against the deployed site | W051 | apps/web/* EXCEPT the W051-frozen files (apps/web/src/server/production-*.ts, apps/web/app/api/healthz/*, apps/web/app/api/readyz/*, apps/web/.env.example, apps/web/vercel.json — read-only for W052), docs/journeys/production-web.md, docs/deployment/vercel-setup.md |
| W053 | Neon + R2 + Upstash production infrastructure: S3-compatible object-store adapter + Upstash rate-limit adapter implementations against the W051-frozen ports, Neon connection + migrations + tenant isolation + evidence flow verification, mandatory negative tests, reproducible setup docs | W051 | adapters/s3-object-store/src/*, adapters/upstash-redis/src/*, packages/persistence/src/postgres/* (production hardening only if strictly required), docs/operations/infrastructure.md, docs/deployment/neon-r2-upstash-setup.md |
| W054 | External acquisition + Apify + production operations: Apify adapter behind the W045 DiscoverySourceAdapter seam, quota-guarded scheduler trigger, provenance preservation, untrusted-input discipline, graceful degradation, operational runbooks | W051 | adapters/apify/*, services/capability-discovery/src/* (production scheduler trigger + quota guard only), ops/src/runbooks/*, docs/operations/acquisition.md |
| W055 | Serialized production closure: topology + parity + integration verification, security/rate-limit/migration/cost reviews, recovery + rollback testing, consolidated public journeys, production release identity, documentation/state reconciliation | W052, W053, W054 | cross-cutting serialized: spec/journey-validation.md, spec/PROJECT-STATE.md, spec/development-state/*, AI_CONTINUATION.md, docs/LLM-ARCHITECT-HANDOFF.md, README.md, docs/journeys/production.md, release/clients/release-manifest.json, .github/workflows/* (deployment-config validation), docs/deployment/*, docs/operations/* |

## ACR-006 concurrency

Only W051 is initially authorized (Tech Lead serialized foundation). After W051 merges and state is reconciled, W052/W053/W054 may run concurrently because their surfaces are pairwise disjoint: W052 owns apps/web (minus the W051-frozen files), W053 owns the infrastructure adapter implementations, W054 owns the acquisition adapter + capability-discovery production wiring. W055 is serialized after all three.

## ACR-006 deployment invariants

- Zero new runtime dependencies (frozen catalog); providers speak REST over fetch; SigV4 via node:crypto; Neon over the existing pg pin.
- No secret values in Git — placeholders only; provider credentials only in the deployment platform's secure environment.
- The Application Gateway remains the ONLY client-facing boundary; apps/web binds it in-process; no second backend.
- Redis is non-authoritative (rate-limit/cache acceleration only); R2 stores bytes, not semantic truth; Apify output is untrusted adapter input with provenance.
- Production profile fails closed on missing durable persistence; optional capabilities degrade gracefully; security gates never fail open.
- Honest-blocking rule: real provider provisioning requires operator-owned credentials; work orders record VERIFIED/NOT-VERIFIED honestly and never fabricate deployment URLs or identifiers.


# ACR-007 Interactive World + Multi-Renderer Work Orders

ACR-007 is APPROVED_STAGED and becomes the successor implementation program after ACR-006/W055.

| ID | Scope | Depends | Owned surfaces |
|---|---|---|---|
| W056 | Renderer Fabric & Multi-Renderer Switching Contract | ACR-006/W055 | contracts/renderers/*, packages/renderer-runtime/*, packages/renderer-adapters/*, packages/renderer-fabric/*, spec/renderer-fabric-architecture.md, docs/rendering/*, qa/renderer-conformance/* |
| W057 | Interactive World Workspace & Game-like Engineering UX | W056 | packages/world-runtime/*, apps/web/src/features/world/*, apps/web/src/shell/* (world route only), apps/desktop/* (world host wiring), qa/world-experience/*, docs/journeys/interactive-world.md |
| W058 | Three.js Embedded Interactive Renderer | W056 | adapters/renderers/threejs/*, qa/renderer-conformance/threejs/*, docs/rendering/threejs.md |
| W059 | Babylon.js Embedded Interactive Renderer | W056 | adapters/renderers/babylonjs/*, qa/renderer-conformance/babylonjs/*, docs/rendering/babylonjs.md |
| W060 | Foundation Renderer & Asset Bridges | W057,W058,W059 | adapters/renderers/blender/*, adapters/foundations/freecad/*, adapters/foundations/assimp/*, adapters/foundations/openusd/*, docs/rendering/*, qa/foundation-renderers/* |
| W061 | Multi-Renderer Integration & Interactive World Closure | W060 | apps/web/*, apps/desktop/*, packages/world-runtime/*, packages/renderer-fabric/*, qa/rendering/*, qa/world-experience/*, docs/journeys/interactive-world.md, docs/rendering/*, release/clients/*, spec/PROJECT-STATE.md, spec/development-state/*, AI_CONTINUATION.md, docs/LLM-ARCHITECT-HANDOFF.md, README.md |

## ACR-007 concurrency

After ACR-006/W055 completion and the X2.0 lock transition:

W057 | W058 | W059

W060 is serialized after all three.
W061 is serialized last.

## ACR-007 completion invariant

The central acceptance object is a real interactive spatial world, not a table/status substitute. At least two concrete renderers must mount the same canonical fixture and support the shared interaction battery; renderer switching must preserve semantic identity and digest; at least one external foundation path must operate behind the Epoch-owned surface.

The detailed acceptance contracts live in `spec/architecture-change-requests/ACR-007-interactive-world-renderer-fabric.md` and each W056-W061 Work Order file.


# ACR-008 Marker-Time Defect Closure Work Orders

ACR-008 is APPROVED and is the active defect-closure program after ACR-007/W061.

| ID | Scope | Depends | Owned surfaces |
|---|---|---|---|
| W062 | Marker-Time Ordering Defect Closure (fix -> rerun -> close) | ACR-007/W061 | packages/world-experience/src/timeline.ts, packages/world-experience/test/* (comparator regression only), qa/world-experience/w016-marker-time-known-issue.test.ts, docs/journeys/interactive-world.md, spec/PROJECT-STATE.md, spec/development-state/*, AI_CONTINUATION.md |

## ACR-008 concurrency

W062 is the single serialized work order. No concurrent wave.

## ACR-008 completion invariant

The central acceptance object is the closed defect with the full public discipline chain: the numeric comparator lands, the pinned known-issue battery flips into the regression record (ascending admits, descending refuses, the wrong-end-bound consequences disappear), the same-digit-width control and every same-width consumer stay green unchanged, and the defect ledger records fix -> rerun -> close with exact evidence. The detailed acceptance contract lives in `spec/architecture-change-requests/ACR-008-marker-time-comparator.md` and `spec/work-orders/W062-marker-time-comparator.md`.

# ACR-009 Desktop Installable Artifacts Work Orders

ACR-009 is APPROVED (2026-10-02) and is the active productization/release program after ACR-008/W062. It closes the declared W048 environment gap by provisioning the toolchains and producing the real installable desktop artifacts, re-stamping the release identity. No architecture change, no lock transition.

| ID | Scope | Depends | Owned surfaces |
|---|---|---|---|
| W063 | Desktop installable artifacts (linux AppImage+deb built-in-sandbox; windows NSIS built-in-sandbox-cross; macos ci-recipe-delivered) + the release re-stamp | ACR-008/W062 | apps/desktop/src-tauri/** (the D-1 host fix + the committed Cargo.lock), .github/workflows/release-desktop-native.yml (new, dispatch-only), release/clients/**, docs/journeys/desktop-*.md, docs/journeys/defect-ledger.md, docs/release/client-release-process.md, spec/PROJECT-STATE.md, spec/development-state/*, AI_CONTINUATION.md, docs/LLM-ARCHITECT-HANDOFF.md |

## ACR-009 concurrency

W063 is the single serialized work order. No concurrent wave.

## ACR-009 completion invariant

Every desktop platform carries its most complete honestly-verifiable artifact in `release/clients/release-manifest.json` (file, bytes, sha256, producedBy; `deviations` declared); the committed tree carries NO build-local adaptations; every defect closed with the public discipline chain (D-1..D-4 in the defect ledger); the canonical recipes exist as a dispatch workflow that is not the release gate. The detailed acceptance contract lives in `spec/architecture-change-requests/ACR-009-desktop-installable-artifacts.md`.


# ACR-010 In-Page Foundation Asset Path Work Orders

ACR-010 is APPROVED (2026-10-03, operator standing continuation directive; the frontier was EMPTY at the W063 merge) and is the active program after ACR-009/W063. It delivers the ledgered leg-14 disposition (the W060 advisory): the fabric-level asset-binding orchestration (RendererAdapter contract v1.1.0 -> v1.2.0, additive), the `bind` interaction kind, and the in-page external foundation path with the leg-14 battery closure. No semantic-authority change, no lock transition; E1.0/X2.0 invariants remain binding.

| ID | Scope | Depends | Owned surfaces |
|---|---|---|---|
| W064 | Blender Live-Battery Verification Closure (the standing operator action: official 4.2.11 binary + the env-gated live battery + honest records; docs-only) | — (main 12b5f22) | docs/rendering/blender.md, docs/journeys/interactive-world.md, AI_CONTINUATION.md, spec/PROJECT-STATE.md |
| W065 | Fabric Asset-Binding Contract v1.2.0 (frozen-first contract bump + the fabric-level `bindSessionAsset` operation + the typed receipt) | — (ACR-010 activation) | contracts/renderers/*, packages/renderer-fabric/* |
| W066 | The `bind` interaction kind (closed-vocabulary extension + the typed admission path + the `binding-requested` effect + the invariance pins) | — (ACR-010 activation) | packages/world-experience/* |
| W067 | In-Page Foundation Path Closure (runtime application + the web/desktop host affordances + the leg-14 battery + the closure records) | W065, W066 | packages/world-runtime/*, apps/web/src/features/world/*, apps/web/e2e/*, apps/desktop/* (world section), docs/journeys/interactive-world.md, docs/rendering/closure.md |

## ACR-010 concurrency

W065 + W066 are ELIGIBLE concurrently (pairwise-disjoint surfaces: contracts/renderers + packages/renderer-fabric vs packages/world-experience). W064 (the Blender live-battery verification closure, docs-only surfaces) may run concurrently with both. W067 is serialized after W065 + W066 (it composes their seams). Maximum three concurrent workers respected.

## ACR-010 completion invariant

The leg-14 verdict flips from the honest NOT-RUNNABLE skip to PASS with exact evidence: the in-page path (import -> validate/seal -> typed `bind` -> fabric-level binding -> receipt + digest-addressed ledger) runs on web + desktop through the REAL seam; the presented semantic entity ids and the canonical world digest are UNCHANGED by the binding (pinned); untrusted bytes remain typed refusals; the Blender-live variant and GPU stay honestly recorded as env-gated/impossible. The detailed acceptance contract lives in `spec/architecture-change-requests/ACR-010-in-page-foundation-asset-path.md` and the W065-W067 Work Order files.


# ACR-011 Blender Sidecar Arity Defect Closure Work Orders

ACR-011 is APPROVED (2026-10-03, operator standing continuation directive) and is the active defect-closure program after the W064 live-battery finding (PR #148, merged 220e99f). It closes the ledgered sidecar `require()` arity defect: fix -> CI-executable sidecar-Python guard -> env-gated live re-run -> ledger closure. No architecture change, no lock transition, no contract bump.

| ID | Scope | Depends | Owned surfaces |
|---|---|---|---|
| W068 | Blender Sidecar Arity Defect Closure (the require() arity fix + the CI-executable sidecar-Python guard + the env-gated live re-run + the ledger closure) | — (ACR-011 activation) | adapters/renderers/blender/*, docs/journeys/interactive-world.md (defect-ledger entry only), docs/rendering/blender.md (live re-run record only), spec/PROJECT-STATE.md (W068 record only) |

## ACR-011 concurrency

W068 is the single serialized defect-closure order. It runs CONCURRENT with the ACR-010 remainder on pairwise-disjoint surfaces (adapters/renderers/blender vs packages/world-experience [W066, in flight] vs packages/world-runtime + apps [W067, pending]).

## ACR-011 completion invariant

The defect-ledger entry closes with the full public discipline chain: the arity fix lands (the BLENDER_SIDECAR_PYTHON_DIGEST re-stamp disclosed), the CI-executable sidecar-Python guard proves the failure class can never return silently (runs in the standard battery with no Blender binary), the env-gated live battery flips to 3 passed against the official Blender 4.2.11 (or the honest NOT-RUNNABLE live disposition with the fix+guard landed), and the ledger records fix -> rerun -> close with exact evidence. The detailed acceptance contract lives in spec/architecture-change-requests/ACR-011-blender-sidecar-arity-defect-closure.md and spec/work-orders/W068-blender-sidecar-arity-defect-closure.md.


# ACR-012 Construction Solution Explorer Work Orders

ACR-012 is EFFECTIVE (2026-10-04, operator directive) and is the active product-surface program after ACR-011: the construction solution world becomes the primary problem-solving experience on web + desktop (spatially dominated workspace, real construction systems, engineering inspector/BOQ/constraints, solution variants, visible agents, construction timeline). Mobile is OUT OF SCOPE. The activation record is `spec/architecture-change-requests/ACR-012-construction-solution-explorer.md`.

| ID | Scope | Depends | Owned surfaces |
|---|---|---|---|
| W071 | Construction Solution World Fixture (shared deterministic fixture package + verification battery; freezes the W072/W073 consumption contract) | — (ACR-012 activation) | packages/construction-world-fixture/*, qa/construction-solution/*, root manifests/pnpm-lock.yaml ONLY to register the new package (disclosed in the PR) |
| W072 | Web Construction Solution Workspace (the /world spatially dominated construction explorer) | W071 (frozen fixture API) | apps/web/src/features/world/*, apps/web/src/shell/* additive-only, apps/web/src/product/* additive-only, apps/web/src/client/* additive-only, apps/web/src/shared/* additive-only, apps/web/src/server/* additive-only, qa/web/* |
| W073 | Desktop Construction Solution Workspace (the default construction explorer surface) | W071 (frozen fixture API) | apps/desktop/app/*, apps/desktop/src/*, apps/desktop/test/*, apps/desktop/scripts/*, apps/desktop/package.json ONLY required deps (disclosed), qa/desktop/* |

## ACR-012 concurrency

W071 is serialized first (it freezes the fixture contract W072/W073 compile against). W072 + W073 become ELIGIBLE together at the W071 merge — pairwise-disjoint surfaces (apps/web/* + qa/web/* vs apps/desktop/* + qa/desktop/*), max concurrent 3.

## ACR-012 completion invariant

The program completes when a user can open the construction solution on web and desktop and solve the solution through the spatial world: real building/site geometry across the six construction layers rendered by BOTH Three.js and Babylon.js (switching preserves the semantic world), plan/3D/section navigation, selection to canonical semantic ids, engineering inspector/BOQ/constraint projections, solution variants that CHANGE the world representation, visible agents with followable work, and the construction timeline — all through the EXISTING typed Epoch world/timeline/interaction contracts (no second semantic authority). The detailed acceptance contract lives in `spec/architecture-change-requests/ACR-012-construction-solution-explorer.md` and the W071-W073 Work Order files.
