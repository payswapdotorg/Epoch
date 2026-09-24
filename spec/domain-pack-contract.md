# Epoch Domain Pack Contract DP1.0

## Purpose

A domain pack teaches Epoch how a domain expresses the universal lifecycle. It does not replace Epoch's lifecycle, World Model, delivery state, authorization, verification or event authority.

## Required relationship

`Domain Pack → Universal Contracts → Domain-specific capabilities`

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
- require an external provider for basic lifecycle progression.

## Projection rule

A pack may present:
- Construction: BOQ and construction programme;
- Software: release plan, epics/issues, deployment plan;
- Mechanical: BOM and manufacturing/assembly sequence;
- Electrical: circuit/work schedule and commissioning plan.

These are synchronized projections over the same SolutionPackage, SolutionVersion, DeliveryRecord and ProgramOfWork identities.

## Capability rule

Domain-specific computation is exposed through the Capability Registry and Adapter/Extension fabric. A pack may request specialized engines, but provider-specific behavior remains behind adapters.

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
8. disabling the pack does not corrupt core semantic state.
