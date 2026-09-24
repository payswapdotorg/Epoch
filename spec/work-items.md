# Epoch Work Items WO1.0

One Work Order = one branch = one PR. Worker count = 1. Concurrent items must have pairwise-disjoint write surfaces. Only W001 is currently AUTHORIZED.

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
| W014 | Web App Shell | W009,W011,W012 | apps/web/* |
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
| W026 | Construction Pack | W002,W004,W006,W007,W011,W013 | packs/construction/* |
| W027 | Software/Infrastructure Pack | W002,W003,W006,W007,W011,W013 | packs/software/* |
| W028 | Document-to-Adapter | W002,W004,W006,W007,W008 | services/document-adapter/*, packages/document-adapter/* |
| W029 | External Adapter Reference Set (Git/IFC/MCP/FMI) | W007,W013,W021,W022 | adapters/github/*, adapters/ifc/*, adapters/mcp/*, adapters/fmi/* |
| W030 | Security/Isolation/Observability | W008,W009,W020,W021,W022,W023 | services/security/*, packages/observability/*, tests/security/*, docs/security/* |
| W031 | Reference E2E slices | W014,W015,W016,W020,W021,W022,W026,W027,W028,W029 | examples/e2e/*, tests/e2e/*, docs/e2e/* |
| W032 | Cross-domain integration harness | W026,W027,W028,W029,W031 | packages/test-harness/*, tests/contracts/*, tests/integration/* |
| W033 | Production deployment | W032 | deploy/*, ops/*, docs/operations/* |
| W034 | Performance + scale | W032,W033 | packages/performance/*, tests/performance/*, docs/performance/* |
| W035 | Release/SDK docs/marketplace readiness | W033,W034 | docs/release/*, docs/sdk/*, docs/marketplace-readiness/*, examples/sdk/*, release/*, .github/workflows/* |

## Verified parallelism design

The dependency graph is authoritative; these are safe high-value concurrent groups when their prerequisites are complete:
- W002 + W003 + W004
- W005 + W006
- W008 + W009
- W010 + W011
- W012 + W013
- W014 + W015 + W016
- W017 + W018 + W019
- later: select any 3 among currently READY items such as W020/W026/W027/W028, then continue dynamically.

No same-group pair shares a write surface. Dependencies that touch shared contracts are intentionally sequenced.

## Universal acceptance
Every item must:
- stay inside owned surfaces;
- add evidence for acceptance;
- preserve authority boundaries;
- avoid shared root-manifest/lockfile changes during parallel work;
- document exact verification and final head SHA.

## W001 acceptance
1. Fresh checkout installs and runs standard checks/build/test/typecheck entrypoints.
2. Workspace boundaries match IMPLEMENTATION.md.
3. CI invokes governance/typecheck/lint/test.
4. Governance checker detects invalid worker count, missing canonical files, and overlapping active Work Order ownership.
5. Package boundary checks prevent kernel -> UI imports.
6. Dependency baseline needed by W002-W004 is frozen so those branches need no root-manifest/lockfile edits.
7. No domain feature behavior is introduced.
