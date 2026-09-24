# Epoch — LLM Architect / Tech Lead Handoff

## Mission
Build Epoch into a provider-agnostic engineering operating system in which every complex task becomes a task-sufficient world shared by human agents, AI agents, simulations, external software, and extensions.

## Frozen architecture
- Universal World Model.
- Provider-neutral Agent Protocol and typed Action Protocol.
- Declarative Constraint/Policy Language.
- Simulation/Evaluation Fabric.
- Verification/Evidence/Provenance.
- Capability Registry and Adapter Fabric.
- Experience Runtime + Experience Protocol + Experience Compiler.
- Sandboxed commercial extension ecosystem.
- Multi-tenant security/authorization.
- Web-first, desktop-power, mobile-field clients.

## Provider strategy
Build semantic/protocol/control-plane contracts; adopt mature open standards/open-source infrastructure behind adapters. Reference implementations may include PostgreSQL, Arrow/Parquet, JSON Schema/JSON-LD/SHACL/PROV/UCUM-compatible semantics, Three.js/R3F, glTF, OpenUSD adapter, OpenCASCADE adapter, IfcOpenShell adapter, FMI, OpenFOAM/Chrono/Drake/OpenModelica/commercial solvers, agent-framework/model-provider adapters, Temporal, NATS, Yjs, Wasm Component Model/WIT + Wasmtime, OpenFGA, OPA, Keycloak, OpenTelemetry, and Tauri 2. These are replaceable implementations, not authorities.

## UX
Humans and agents operate on the same semantic world. The UI turns structured world/action/evidence state into 2D, 3D, animation, narrative, replay, presence, controls, and device-appropriate fidelity. Humans can watch, pause, take over, and return control to agents.

## Extensions
Extensions may contribute ontology, visual ontology, assets, animation, interactions, agents, constraints, simulation, evaluation, verification, workflows, connectors, and UI. JSON/YAML is declarative; TypeScript/React is rich UI; WebAssembly is portable computation; remote services support heavy/private capabilities. Public code is sandboxed and least-privilege.

## Commercial
Marketplace supports free, one-time, subscription, seat/workspace, usage, hybrid and enterprise licensing. Billing providers are adapters; Epoch owns entitlement semantics and developer accounting records.

## Execution
W001 is COMPLETE (PR #2, squash 1b0d8d240f01de95cc6e269d4ae86471a934f717; independent verification green). The first concurrent wave W002 (Canonical World Model), W003 (Agent + Action Protocols), W004 (Constraint & Policy Language) is AUTHORIZED with pairwise-disjoint surfaces. The Tech Lead may activate the next ready wave automatically after merges, up to three workers, provided ownership surfaces are disjoint.

## Completion
Every merge updates spec/PROJECT-STATE.md, development-state files, and this handoff with exact merge SHA, verification baseline, next frontier, and review lessons.
