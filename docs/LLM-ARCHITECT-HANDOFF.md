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

The complete target is in spec/solution-delivery-architecture.md; the Aurum boundary is in spec/aurum-chat-integration.md; formal approval is in spec/architecture-change-requests/ACR-001-solution-delivery-and-realtime-event-bridge.md.

## Current lock / transition rule
Current main is c7430b6478213b0fe9e97f4c159ff9608be77b32.
The current authorized W008/W009/W011 wave remains governed by E1.0/X1.0. ACR-001 is approved but not effective for new implementation until that wave is stabilized and the lock transition plus frontier update are committed. No worker is to reinterpret W008/W009/W011 from ACR-001.

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
