# Epoch Work Items WO1.0

One Work Order = one branch = one PR. Worker count = 1. Concurrent items must have pairwise-disjoint write surfaces. Only W001 is currently AUTHORIZED.

W001 Repository/runtime foundation | deps: — | wave: W0 | owns: root manifests, apps/*, packages/*, services/*, packs/*, scripts/*, .github/*
W002 Canonical World Model | deps: W001 | W1 | owns: packages/world-model/*, contracts/world/*
W003 Agent + Action Protocols | deps: W001 | W1 | owns: packages/agent-protocol/*, packages/action-protocol/*, contracts/agent/*, contracts/actions/*
W004 Constraint & Policy Language | deps: W001 | W1 | owns: packages/constraint-language/*, packages/policy-contracts/*, contracts/constraints/*
W005 Simulation + Evaluation | deps: W002 | W2 | owns: packages/simulation-protocol/*, packages/evaluation-protocol/*
W006 Verification/Evidence/Provenance | deps: W002 | W2 | owns: packages/verification/*, packages/evidence/*, packages/provenance/*
W007 Capability Registry + Adapter SDK | deps: W003,W005,W006 | W2 | owns: packages/capability-registry/*, packages/adapter-sdk/*
W008 Extension SDK + Wasm | deps: W003,W007 | W3 | owns: packages/extension-sdk/*, packages/extension-runtime/*, runtimes/wasm/*
W009 Tenancy/Identity/Authorization | deps: W002,W007 | W3 | owns: packages/tenancy/*, packages/identity/*, packages/authorization/*
W010 Event/Replay/Collaboration | deps: W002,W003,W009 | W3 | owns: packages/event-log/*, packages/replay/*, packages/collaboration/*
W011 Experience Protocol | deps: W002,W003,W006,W007 | W4 | owns: packages/experience-protocol/*, contracts/experience/*
W012 Experience Compiler | deps: W011 | W4 | owns: packages/experience-compiler/*, contracts/experience-compiler/*
W013 Renderer Runtime | deps: W011 | W4 | owns: packages/experience-runtime/*, packages/renderer-runtime/*, contracts/renderers/*
W014 Web App Shell | deps: W009,W011,W012 | W5 | owns: apps/web/*
W015 AI Collaboration UX | deps: W010,W011,W012 | W5 | owns: packages/ai-experience/*, apps/web/src/features/agents/*
W016 Interactive World UX | deps: W012,W013 | W5 | owns: packages/world-experience/*, apps/web/src/features/world/*
W017 Desktop Client | deps: W014,W015,W016 | W6 | owns: apps/desktop/*
W018 Mobile Field Client | deps: W014,W015,W016 | W6 | owns: apps/mobile/*
W019 Renderer/Device Adaptation | deps: W013,W016 | W6 | owns: packages/device-capabilities/*, packages/renderer-adapters/*, packages/progressive-scene/*
W020 Agent Runtime/Orchestration | deps: W003,W007,W010 | W7 | owns: services/agent-runtime/*, packages/agent-orchestration/*
W021 Simulation Execution Fabric | deps: W005,W007,W020 | W7 | owns: services/simulation-runner/*, packages/simulation-fabric/*
W022 Action Gateway + Human Approval | deps: W003,W004,W006,W009,W020 | W7 | owns: services/action-gateway/*, packages/action-policy/*
W023 Marketplace | deps: W007,W008,W009 | W8 | owns: services/marketplace/*, packages/marketplace/*, apps/web/src/features/marketplace/*
W024 Billing + Entitlements | deps: W009,W023 | W8 | owns: services/billing/*, packages/entitlements/*
W025 Developer Portal/Publishing | deps: W008,W023,W024 | W8 | owns: services/developer-portal/*, apps/web/src/features/developers/*
W026 Construction Pack | deps: W002,W004,W006,W007,W011,W013 | W9 | owns: packs/construction/*
W027 Software/Infrastructure Pack | deps: W002,W003,W006,W007,W011,W013 | W9 | owns: packs/software/*
W028 Document-to-Adapter | deps: W002,W004,W006,W007,W008 | W9 | owns: services/document-adapter/*, packages/document-adapter/*
W029 External Adapter Reference Set (Git/IFC/MCP/FMI) | deps: W007,W013,W021,W022 | W10 | owns: adapters/github/*, adapters/ifc/*, adapters/mcp/*, adapters/fmi/*
W030 Security/Isolation/Observability | deps: W008,W009,W020,W021,W022,W023 | W10 | owns: services/security/*, packages/observability/*, tests/security/*, docs/security/*
W031 Reference E2E slices | deps: W014,W015,W016,W020,W021,W022,W026,W027,W028,W029 | W10 | owns: examples/e2e/*, tests/e2e/*, docs/e2e/*
W032 Cross-domain integration harness | deps: W026,W027,W028,W029,W031 | W11 | owns: packages/test-harness/*, tests/contracts/*, tests/integration/*
W033 Production deployment | deps: W032 | W12 | owns: deploy/*, ops/*, docs/operations/*
W034 Performance + scale | deps: W032,W033 | W12 | owns: packages/performance/*, tests/performance/*, docs/performance/*
W035 Release/SDK docs/marketplace readiness | deps: W033,W034 | W12 | owns: docs/*, examples/*, release/*, .github/workflows/*

All Work Orders must implement only their owned surfaces, add evidence for acceptance, preserve authority boundaries, and avoid shared dependency/lockfile edits during parallel work.
