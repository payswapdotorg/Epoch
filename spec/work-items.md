# Epoch Work Items WO1.0

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
| W007 | Capability Registry + Adapter SDK | W003,W005,W006 | packages/capability-registry/*, packages/adapter-sdk/*, contracts/capabilities/* |
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
