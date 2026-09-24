# Epoch Domain Pack Contract DP1.0

## Purpose

A domain pack teaches Epoch how a domain expresses the universal lifecycle. It does not replace Epoch's lifecycle, World Model, delivery state, authorization, verification or event authority.

## Required relationship

Domain Pack → Universal Contracts → Domain-specific capabilities

A pack may specialize:
- terminology;
- entity/relationship extensions;
- units and measurement methods;
- quantity derivations;
- cost/resource classifications;
- constraints;
- simulation/evaluation adapters;
- verification methods;
- visualizations;
- work templates;
- acquisition strategies;
- realization strategies;
- outcome schemas;
- learning features.

A pack must reference canonical universal object identities and lifecycle states.

## Pack profile

Each production pack should expose a machine-readable profile containing at least:
- domain id and version;
- supported universal lifecycle version;
- display vocabulary for each universal stage;
- domain entity bindings to World Model types;
- measurement/quantity methods;
- resource/acquisition categories;
- realization/work types;
- verification methods;
- outcome types;
- capability dependencies;
- supported client projections;
- migration/version compatibility.

## Forbidden

A domain pack must not:
- define a second lifecycle authority;
- introduce a second baseline ledger;
- define mutable substitutes for Prediction, Commitment, Actual or Forecast;
- bypass Constraint Engine, Verification/Evidence or Action Gateway;
- write directly to authoritative stores outside approved contracts;
- make a provider or LLM the domain semantic authority;
- fork the core frontend into a vertical-specific application;
- require an external provider for basic lifecycle progression;
- promote a provider-native project, scene, repository, editor timeline or solver state to Epoch semantic authority.

## Projection rule

A pack may present:
- Construction: BOQ and construction programme;
- Software: release plan, epics/issues, deployment plan;
- Mechanical: BOM and manufacturing/assembly sequence;
- Electrical: circuit/work schedule and commissioning plan.

These are synchronized projections over the same SolutionPackage, SolutionVersion, DeliveryRecord and ProgramOfWork identities.

## Capability rule

Domain-specific computation is exposed through the Capability Registry and Adapter/Extension fabric. A pack may request specialized engines, but provider-specific behavior remains behind adapters.

Reference capability classes include:
- precision engineering geometry/CAD;
- DCC and scene/asset processing;
- interactive world/runtime;
- CAE/simulation and scientific visualization;
- web 3D/spatial visualization;
- software engineering workspaces;
- asset import/interchange.

Mature open-source systems such as Blender, FreeCAD, O3DE, Godot, SALOME, ParaView, Three.js, Babylon.js, CesiumJS, Theia/Monaco, BRL-CAD, OpenSCAD and Assimp may serve these roles. This is an integration catalog, not a semantic dependency or allow-list.

The integration preference is:
library/API → provider-neutral adapter → sandboxed extension/plugin → optional client surface → fork.

A fork, source-level embedding or distribution topology that materially changes licensing/security/maintenance posture requires an approved Architecture Change Request under spec/architecture-change-requests/ACR-003-capability-foundations.md.

## Evidence rule

Domain calculations must retain:
- method;
- source/input references;
- timestamp;
- provenance;
- assumptions;
- uncertainty;
- confidence;
- exact version/revision when reproducibility matters.

Capability outputs become canonical facts only after the applicable Epoch validation/verification contract accepts them.

## Evolution

New domain behavior is additive and versioned. When a domain requirement conflicts with a universal invariant, create an Architecture Change Request rather than silently creating a parallel authority.

## Acceptance checklist

A domain pack is conformant when:
1. its profile declares the universal lifecycle version;
2. its workflows bind to canonical lifecycle objects;
3. its schedule is a ProgramOfWork projection;
4. its acquisition path uses the universal Acquire contract;
5. its realization path uses the universal Realize contract;
6. its evidence is addressable and reproducible;
7. its authorizations use Epoch authorization/projection contracts;
8. capability integrations are provider-neutral and replaceable;
9. provider version/license/provenance data is retained where required;
10. disabling the pack does not corrupt core semantic state.
