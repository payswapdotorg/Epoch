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

## Product architecture

World Model + Agent System + Constraints + Actions + Simulation/Evaluation + Verification/Evidence + Solution Delivery + Outcome/Learning, wrapped by a shared Experience Runtime and Capability/Adapter Fabric.

Epoch is the semantic and lifecycle authority. Mature external engineering software is integrated as replaceable capability through provider-neutral adapters, sandboxed extensions, or optional client surfaces. The canonical rule is **integrate first, contribute upstream where useful, fork last**.

## Domain examples

Construction: interactive world + synchronized BOQ/ProgramOfWork + procurement + execution + verification + forecast + learning.

Software: solution architecture + release ProgramOfWork + repository/cloud/license acquisition + implementation/deployment + telemetry/verification + learning.

Mechanical/electrical/infrastructure: domain-specific geometry, simulation, workspace and spatial capabilities projected onto the same universal lifecycle.

## Clients

Web is canonical. Desktop is the power client. Mobile is the field client. All clients share semantic contracts and Experience Protocol.

Foundation-backed desktop tools may provide specialized authoring or analysis, but provider-native projects, editor timelines and files remain linked artifacts rather than Epoch semantic authority.

## Development

Current authorized Work Orders are W009 (Tenancy/Identity/Authorization) and W011 (Experience Protocol). They remain governed by E1.0/X1.0. W036-W044 are dependency-gated successor work and require the explicit ACR-001/ACR-002/ACR-003 lock transition after the current wave stabilizes.

One Work Order = one branch = one PR. Maximum three concurrent workers. The Tech Lead/Architect derives eligibility from the dependency graph and enforces pairwise-disjoint write surfaces.
