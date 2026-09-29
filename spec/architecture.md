# Epoch Architecture E1.0 / Experience X1.0

## Core model

Problem = (World, Agents, Constraints, Actions, Evaluators, Verification, Feedback)

Runtime: Observe -> Reconstruct -> assess Decision Sufficiency -> Acquire Information -> Generate -> Constrain -> Simulate -> Evaluate -> Verify -> Approve -> Baseline -> Plan -> Acquire -> Realize -> Observe -> Actualize -> Verify -> Forecast -> Close -> Learn.

Universal lifecycle: Understand -> Decide -> Plan -> Acquire -> Realize -> Observe/Actualize -> Verify -> Forecast -> Close -> Learn.

## World Model

Typed property/relationship graph with entities, relations, assertions, state, behavior, temporal history, actors, resources, evidence, uncertainty, models and events.

## Autonomous role and capability discovery

Epoch contains a provider-neutral Role & Capability Discovery Plane above the Agent Protocol and Capability Registry. It derives task-specific capability demands from reconstructed world state, constraints, unresolved unknowns, failures, delivery/work state and verification requirements; synthesizes candidate roles; resolves agents, humans, skills, extensions and model substrates; constructs candidate organizations; and evaluates them before assignment.

A model/provider name never establishes role suitability.

## Actions / Agents / Constraints

Agents propose. Action Gateway authorizes execution. Constraints are authoritative in the Constraint Engine. Simulation predicts; evaluation judges; verification/evidence proves.

## Solution Delivery

An approved solution may instantiate DeliveryRecord following acquisition, realization, verification, payment and outcome. ProgramOfWork is the universal schedule dimension.

## Domain Packs / Capability Fabric

Domain packs specialize the universal lifecycle and must not create competing authorities. Mature third-party engineering systems remain capabilities behind adapters or client seams.

## Autonomous ecosystem discovery

Scheduled discovery uses authorized source adapters and sandbox/profile/evaluation/promotion boundaries. External claims never directly mutate canonical state or grant execution authority.

## Experience Runtime

Consumes world/task/agent/evidence/device/capability state and produces 2D/3D/animation/narrative/timeline/control projections. Experience and clients are never semantic authority.

## Persistence

PostgreSQL is authoritative durable state; object storage holds bytes; event/workflow infrastructure remains provider-neutral.

## Clients

Web canonical. Desktop power client. Mobile field client.

Productization architecture is governed by ACR-005:
- shared Application Gateway;
- real web product;
- Tauri 2 desktop host for Linux/Windows/macOS;
- Expo/React Native mobile host for Android/iOS;
- cross-device continuity;
- mandatory real-artifact journey validation.

See spec/productization-architecture.md and spec/journey-validation.md.
