# Epoch Technology Strategy

## Build ourselves
- World Model semantic IR and assertion/state/uncertainty model.
- Agent Protocol and Action Protocol.
- Constraint Language and deterministic evaluation contract.
- Simulation/Evaluation/Verification/Evidence contracts.
- Capability Registry and Adapter SDK.
- Experience Protocol, Experience Graph, Experience Compiler, Experience Runtime.
- Extension/entitlement semantics.
- Marketplace domain model and provider-neutral billing boundary.
- Engineering replay/decision semantics.

## Adopt or adapterize
- PostgreSQL for authoritative durable state.
- Arrow/Parquet for analytical data.
- JSON Schema/JSON-LD/SHACL/PROV/UCUM-compatible standards.
- Three.js + React Three Fiber for initial web 3D.
- glTF/GLB for runtime 3D assets.
- OpenUSD through adapter for complex scene composition.
- OpenCASCADE through geometry adapter.
- IfcOpenShell through IFC adapter; license dependencies must be isolated and reviewed.
- FMI as simulation interoperability target.
- OpenFOAM, Chrono, Drake, OpenModelica, and commercial solvers through adapters.
- PydanticAI, LangGraph, other agent frameworks, and model gateways through adapters.
- Temporal for durable workflows.
- NATS for event distribution.
- Yjs where CRDT collaboration is appropriate.
- Wasm Component Model/WIT + Wasmtime for public extension execution.
- OpenFGA for relationship authorization; OPA for generalized policy.
- Keycloak as initial identity reference behind provider-neutral identity contract.
- OpenTelemetry for traces/metrics/logs.
- Tauri 2 for desktop/mobile packaging.

## Rules
1. Never let a vendor-specific type become a kernel semantic type.
2. Keep difficult engines behind replaceable adapters.
3. Prefer OSS with permissive licensing for embedded components; isolate copyleft or commercially licensed engines behind process/service adapters unless legal review says otherwise.
4. The kernel depends on protocols, not implementations.
5. Version every adapter/capability and record provenance.
6. Build proprietary only where it creates cross-domain platform differentiation.

## Client
Web is canonical; desktop is power-user; mobile is field. All use the same semantic Experience Protocol.
