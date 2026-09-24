# ACR-002 — Universal Solution Navigator & Domain Pack Architecture Clarification

## Status

APPROVED
Approved by product/architecture authority: 2026-09-24
Effective together with the ACR-001 lock transition

## Intent

Clarify ACR-001 so the Solution Delivery architecture is explicitly reusable across engineering domains rather than being interpreted as a construction/procurement lifecycle.

## Approved target clarification

Epoch has one universal engineering lifecycle:

`Understand → Decide → Plan → Acquire → Realize → Observe/Actualize → Verify → Forecast → Close → Learn`

The detailed runtime remains:

`Observe → Reconstruct → assess Decision Sufficiency → Acquire Information → Generate → Constrain → Simulate → Evaluate → Verify → Approve → Baseline → Plan → Acquire → Realize → Observe → Actualize → Verify → Forecast → Close → Learn`

### Universal terms

- **Acquire** is the universal resource/prerequisite acquisition concept. Procurement is one projection. Other projections include internal allocation, subscription/license acquisition, cloud/service provisioning, fabrication request, specialist capability assignment and data/evidence acquisition.
- **Realize** is the universal intervention/delivery concept. Construction execution, software implementation/deployment, mechanical fabrication/assembly, electrical installation/commissioning and infrastructure provisioning are projections.
- **ProgramOfWork** is the universal dependency-aware schedule. BOQ, roadmap, BOM/manufacturing sequence and commissioning programme are domain projections.
- **Solution Navigator** is the synchronized experience projection across the entire lifecycle, not a new semantic authority.
- **Learn** consumes validated outcome lineage and never rewrites history.

## Domain pack rule

Domain packs may define domain vocabulary, measurements, calculations, capability bindings, visualizations, evidence methods, acquisition strategies, realization strategies, work templates and outcomes. They must bind to universal contracts and must not define a competing lifecycle, schedule, baseline, delivery ledger, actualization or learning authority.

## Compatibility

This ACR does not add a new runtime authority and does not supersede ACR-001. It makes the approved ACR-001 target architecture explicit for non-construction engineering domains.

## Required repository artifacts

- `spec/universal-solution-lifecycle.md`
- `spec/domain-pack-contract.md`
- `spec/solution-navigator-architecture.md`

W036 is the implementation entry point for the universal Solution Delivery contracts. W026/W027 and all future domain packs consume these contracts rather than implementing a parallel lifecycle.

## Invariants

All ACR-001 invariants remain in force. Provider-specific behavior remains adapterized; agents remain non-authoritative; the World Model remains semantic authority; Experience/Solution Navigator remains projection only.
