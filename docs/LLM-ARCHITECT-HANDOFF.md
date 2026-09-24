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

## Approved next architecture: ACR-001
ACR-001 was approved on 2026-09-24. Its target architecture adds:

SolutionPackage -> SolutionVersion -> DeliveryRecord -> Program of Work / Procurement / Execution -> Verification -> Forecast -> Outcome -> Learning.

The Program of Work is a first-class schedule and is synchronized with the construction BOQ. Prediction, estimate, commitment, actual and forecast remain distinct. Partial data is allowed; uncertainty keeps provenance, freshness and confidence. High-value missing information may be acquired through manual or connector-driven requests.

An optional provider-neutral External Event Bridge allows systems such as Aurum Chat to acquire information from people, return normalized observations/events, relay schedule questions, and deliver alerts. Epoch remains fully usable without Aurum and never imports Aurum-specific semantic types.

Fine-grained access produces authorized projections of the same semantic state for clients, engineers, contractors, procurement users and agents.

The complete target is in spec/solution-delivery-architecture.md; the universal lifecycle is in spec/universal-solution-lifecycle.md; the domain-pack boundary is in spec/domain-pack-contract.md; Navigator behavior is in spec/solution-navigator-architecture.md; the Aurum boundary is in spec/aurum-chat-integration.md; formal approval is in ACR-001 and the ACR-002 clarification.

## Current lock / transition rule
Current main is e7c87d3e3657867e03044ad349fdce1327968951 after W008 (PR #22) and the post-W008 lockfile reconcile/governance reconciliation (PR #24/#25).
The current remaining authorized W009/W011 wave is governed by E1.0/X1.0. ACR-001/ACR-002 are approved but not effective for new implementation until that wave is stabilized and the lock transition plus frontier update are committed. W008 is complete. W009/W011 remain on the original E1.0/X1.0 contract obligations; ACR-001 does not reinterpret their work.

## Universal engineering lifecycle and domain packs
The approved target uses `Understand → Decide → Plan → Acquire → Realize → Observe/Actualize → Verify → Forecast → Close → Learn`. Procurement and execution are domain projections of Acquire and Realize. The Solution Navigator is a synchronized projection, never a new authority. Domain packs must conform to `spec/domain-pack-contract.md` and consume W036 universal contracts. Canonical documents: `spec/universal-solution-lifecycle.md`, `spec/domain-pack-contract.md`, `spec/solution-navigator-architecture.md`.

## Successor work orders
- W036 Solution Delivery Core
- W037 Procurement + supplier delivery
- W038 Execution tracking + field observation
- W039 Actualization + variance + forecast
- W040 Outcome learning + calibration
- W041 Fine-grained access + projections
- W042 External Event Bridge + optional Aurum adapter
- W043 Delivery supervision + alerts
- W044 Delivery-to-learning construction E2E

All work orders have disjoint declared write surfaces and are dependency-gated. W036 must land before delivery descendants. The Tech Lead must cap concurrency at three workers and run exact ownership-overlap checks at dispatch.

## UX
Humans and agents operate on the same semantic world. The UI turns structured world/action/evidence state into 2D, 3D, animation, narrative, replay, Program of Work, BOQ, procurement, execution, verification, outcome and learning projections. Humans can watch, pause, take over, and return control to agents.

## Completion
Every merge updates spec/PROJECT-STATE.md, development-state files, and this handoff with exact merge SHA, verification baseline, next frontier and review lessons.


ACR-002 is an approved clarification of ACR-001, not a second lifecycle authority. It becomes effective at the same explicit architecture lock transition.
