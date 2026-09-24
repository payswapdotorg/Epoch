# Epoch Architecture E1.0 / Experience X1.0

## Core model
Problem = (World, Agents, Constraints, Actions, Evaluators, Verification, Feedback)

Runtime: Observe -> Reconstruct -> assess Decision Sufficiency -> Acquire Information -> Generate -> Constrain -> Simulate -> Evaluate -> Verify -> Approve -> Baseline -> Plan -> Procure -> Execute -> Observe -> Actualize -> Verify -> Forecast -> Close -> Learn.

## World Model
Typed property/relationship graph with entities, relations, assertions, state, behavior, temporal history, actors, resources, evidence, uncertainty, models and events. Assertions retain source, timestamp, provenance, confidence and validity. External standards map into the model.

## Task-Sufficient Reconstruction
Reconstruct only what can materially affect feasible solutions, predicted effects, or verification. Acquire missing information when uncertainty could change the decision.

## Actions
Typed interventions have target, parameters, preconditions, predicted effects, side effects, reversibility and authority requirements. Agents propose; the Action Gateway authorizes execution.

## Agents
Registered agents declare capabilities, tools, authority, cost/latency and evidence requirements. Frameworks/models are implementation details behind the protocol.

## Constraints
ECL supports hard, soft, resource, safety/regulatory, epistemic/evidence and authority/governance constraints. Natural language may author constraints; deterministic compiled enforcement is preferred.

## Simulation / Evaluation
Simulation predicts; evaluation judges. Simulator contracts declare inputs, outputs, fidelity, validity domain, assumptions, reproducibility, cost and latency.

## Verification / Evidence
Requirement -> Claim -> Method -> Run -> Evidence -> Result -> Approval. Verification and validation are distinct. Evidence is exact-revision addressable.

## Solution Delivery
An approved solution may instantiate a DeliveryRecord that follows procurement, execution, verification, payment and outcome. The baseline remains immutable; live actuals, commitments and forecasts are separate records. The universal schedule is the Program of Work; Construction renders the synchronized quantity/cost schedule as an interactive BOQ.

Detailed contracts are defined by the approved ACR-001 target architecture. That target is not effective for new implementation until the architecture lock transition is recorded.

## Capability Fabric
Registered adapter categories: source, semantic, reconstruction, visualization, simulation, evaluator, action, verification. Sources include first-party, community, external software, and provisional document-derived mappings.

## Experience Runtime
Consumes world/task/agent/evidence/device/capability state and produces Experience Graphs for 2D, 3D, animation, narrative, timeline/replay, presence and controls. It is never semantic authority. The Solution Navigator presents synchronized Design, Program of Work, BOQ, Procurement, Execution, Verification, Forecast, Outcome and Learning projections.

## Extensions
Declarative manifest/schema + TypeScript/React + Wasm Component Model + remote service adapter. Public extensions are sandboxed and capability-scoped.

## Tenancy
Platform -> Tenant -> Workspace -> Project -> World/Scenario/Evidence. Identity != tenancy != authorization != policy.

## Persistence
PostgreSQL authoritative durable state; object storage for bytes; Arrow/Parquet for analytical data; NATS for event distribution; Temporal for durable workflows.

## External event bridge
External systems can provide authorized normalized observations/events and receive typed information requests, status checks and alerts. Provider-specific semantics remain behind adapters. Aurum Chat is an optional reference adapter, never an Epoch prerequisite.

## Clients
Web canonical. Tauri 2 desktop/mobile clients share semantic contracts; mobile is optimized for field capture/review/approval.

## Marketplace
Epoch owns listings, trust metadata, versions, entitlements, usage accounting, and developer revenue records. Payment processors are adapters.
