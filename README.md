# Epoch

Epoch is a provider-agnostic engineering operating system: a shared, task-sufficient computational world where humans, AI agents, simulations, external software, and extensions collaborate.

## Source of truth

The repository is authoritative; chat is not. Start with:
1. AGENTS.md
2. AI_CONTINUATION.md
3. docs/LLM-ARCHITECT-HANDOFF.md
4. spec/PROJECT-STATE.md
5. spec/architecture.md
6. spec/architecture-lock.md
7. spec/requirements.md
8. spec/work-items.md
9. spec/dependency-graph.md
10. spec/worker-runbook.md
11. spec/universal-solution-lifecycle.md
12. spec/domain-pack-contract.md
13. spec/solution-navigator-architecture.md
14. spec/capability-foundation-policy.md
15. spec/autonomous-role-capability-discovery.md
16. spec/capability-contribution-contract.md
17. spec/productization-architecture.md
18. spec/journey-validation.md

## Product architecture

World Model + Agent System + Role/Capability Discovery + Constraints + Actions + Simulation/Evaluation + Verification/Evidence + Solution Delivery + Outcome/Learning, wrapped by a shared Experience Runtime and Capability/Adapter Fabric.

Epoch is the semantic and lifecycle authority. Mature external engineering software and future models are integrated as replaceable capabilities through provider-neutral adapters, sandboxed extensions, or optional client surfaces. Epoch can derive task-specific roles and capability demands and search compatible agents/models rather than requiring hard-coded role/model pairings. The canonical rule is integrate first; contribute upstream where useful; fork last.

## Clients

Web is the canonical client. Desktop is the power client. Mobile is the field client. All clients share semantic contracts and Experience Protocol.

Current implementation status:
- Web: application shell and multiple feature/projection surfaces exist; W047 productization is still pending.
- Desktop: W017 typed reference host exists; W048 will create the real Tauri 2 Linux/Windows/macOS application.
- Mobile: W018 typed reference field host exists; W049 will create the real Expo/React Native Android/iOS application.

Do not interpret W017/W018 completion as native application distribution.

## Development

W001-W045 are complete (45/45). ACR-005 is effective and defines W046-W050.

Current frontier is authoritative only in spec/development-state/program-state.json and frontier-state.json.

Initial dispatch:
- W046 active.
- W047/W048/W049/W050 blocked by dependency.

After W046 is merged and reconciled, W047/W048/W049 run concurrently (maximum three workers). W050 is serialized after all three.

One Work Order = one branch = one PR. Workers never merge. Root manifests and lockfiles are Tech Lead serial work.
