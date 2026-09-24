# Epoch Capability Foundation Policy CF1.0

## Purpose

Epoch is the engineering system of record and semantic coordinator. Mature open-source engineering products are integrated as replaceable capabilities around the Epoch kernel.

The canonical rule is:

> **Integrate first, contribute upstream where useful, fork last.**

## 1. What Epoch owns

Epoch remains authoritative for:

- World Model semantics;
- Universal Solution Lifecycle;
- SolutionPackage / SolutionVersion;
- DeliveryRecord;
- ProgramOfWork;
- Prediction, Estimate, Baseline, Commitment, Observation, Actual, Forecast and Outcome distinctions;
- constraints and policy enforcement;
- Action Gateway authorization;
- verification/evidence/provenance;
- access projections;
- event/replay semantics;
- learning lineage.

Third-party software may calculate, render, simulate, edit, import, inspect or provide a specialized workspace, but it does not replace these authorities.

## 2. Integration hierarchy

Use the narrowest boundary that preserves the required capability:

1. **Library/API** — use when the dependency is small, stable and semantically clean.
2. **Provider-neutral adapter** — isolate a substantial engine or application behind a capability contract.
3. **Sandboxed extension/plugin** — use when user-facing extensibility is valuable and the host boundary is well defined.
4. **Optional client surface** — use when an existing desktop/cloud editor is useful as a specialized workspace.
5. **Fork** — use only after documenting why the previous four boundaries fail.

Forking a product is not itself an architecture milestone; the product still remains a capability behind Epoch contracts.

## 3. Foundation catalog

| Foundation | Primary use | Default Epoch posture |
|---|---|---|
| Blender | DCC, scene processing, rendering, asset workflows | Adapter/capability; optional desktop “Epoch Studio” surface |
| FreeCAD | Parametric CAD, precision engineering geometry | Adapter/capability; precision geometry surface |
| O3DE | Interactive 3D runtime and simulation-like experiences | Adapter/runtime capability |
| Godot | Interactive 2D/3D runtime and playback | Adapter/runtime capability |
| SALOME | CAE, meshing, solver integration | Simulation capability |
| ParaView | Scientific/result visualization | Visualization/simulation-result capability |
| Three.js | Web-native 3D rendering | First-class web capability candidate |
| Babylon.js | Web 3D engine/editor/runtime | Web capability candidate |
| CesiumJS | Geospatial/3D Tiles/globe visualization | Infrastructure/geospatial capability |
| Theia / Monaco / LSP | Software engineering workspace | Software-domain workspace capability |
| BRL-CAD | Solid geometry and geometric analysis | Geometry/analysis capability |
| OpenSCAD | Scripted deterministic CSG geometry | Agent-friendly geometry-generation capability |
| Assimp | 3D asset import normalization | Ingestion capability |

This catalog is not a commitment to ship all foundations. Each integration must pass capability registration and verification requirements.

## 4. Domain composition

### Construction

Use the Epoch semantic kernel with:
- precision geometry as needed;
- high-fidelity DCC/asset capability as needed;
- specialized simulation/visualization as needed;
- web-native 2D/3D experience as canonical.

The BOQ remains a construction projection of the universal Solution/ProgramOfWork model.

### Mechanical

Use precision CAD/geometry and CAE capabilities behind adapters; retain manufacturing sequence, inspection, qualification, delivery and learning in Epoch.

### Electrical / infrastructure

Use web-spatial and geospatial capabilities for visual context; keep asset acquisition, installation/provisioning, commissioning, actualization and verification in Epoch.

### Software

Use Theia/Monaco/LSP/Git capabilities for authoring and repository interaction; keep solution intent, ProgramOfWork, delivery state, verification, telemetry linkage and learning in Epoch.

## 5. Canonical data boundary

The provider interaction is:

Epoch object/contract → adapter → foundation-native operation → result/artifact/evidence → adapter normalization → Epoch validation → Epoch state

Never treat a provider-native project file as the Epoch database.

Provider-native files may be:
- source artifacts;
- editable working artifacts;
- external records;
- evidence inputs;
- generated outputs.

They are linked by stable external identities and provenance, not adopted as the semantic authority.

## 6. Capability registration

Every production capability should publish enough metadata to make it replaceable and auditable:

- id/version;
- provider/project;
- operations;
- formats;
- fidelity;
- supported platforms;
- runtime mode;
- resource/cost characteristics;
- reproducibility/version pins;
- data handling;
- license/dependency snapshot;
- isolation/security;
- health/compatibility;
- fallback/degraded mode;
- evidence/provenance behavior.

The Capability Registry remains the authority for capability identity and advertised contracts; an adapter remains the authority for provider-specific translation.

## 7. Licensing policy

License suitability is part of architecture, not an afterthought.

Prefer permissive dependencies when two capabilities provide materially similar engineering value and boundary conditions are comparable. This is a design preference about integration cost and distribution flexibility, not a ranking of projects.

Copyleft dependencies are allowed where the legal and distribution architecture is explicitly understood. Before a fork, static linkage, source-level embedding or distribution of a copyleft foundation, record the exact license, dependent-component licenses, distribution obligations and intended deployment topology.

As of the policy review on 2026-09-24:
- Blender is GPL.
- Code - OSS in the VS Code repository is MIT.
- Godot is MIT.
- three.js is MIT.

These are snapshots and must be verified again for the exact version/revision used in a production release.

## 8. Web / desktop / mobile

The universal web experience stays web-native.

Desktop clients may expose richer foundation-backed authoring surfaces. Such surfaces synchronize with canonical Epoch contracts; they do not fork lifecycle semantics.

Mobile remains optimized for field observation, evidence capture, review, approval and low-friction actualization rather than becoming a second heavyweight authoring stack.

## 9. Fork gate

A fork is eligible only when all are true:

- the capability is already valuable to Epoch;
- adapter/extension/process boundaries were evaluated;
- the needed changes cannot be maintained safely outside the fork;
- the fork does not become semantic authority;
- license/dependency obligations are recorded;
- security/isolation is defined;
- upstream contribution/reconciliation has been assessed;
- update and exit plans exist;
- an approved Architecture Change Request authorizes it.

## 10. Failure and fallback

A provider failure must not corrupt canonical Epoch state.

The adapter should report:
- unavailable;
- timed out;
- incompatible version;
- degraded fidelity;
- unsupported operation;
- stale artifact;
- validation failure.

Epoch preserves the failure as operational/evidence state and chooses a declared fallback or asks for human intervention.

## 11. Relationship to Domain Packs

Domain packs bind to universal lifecycle objects and request capabilities through the Capability Registry/Adapter fabric.

A domain pack may say:
- “use a precision CAD capability for this geometry operation”;
- “use a visualization capability for this projection”;
- “use a simulation capability for this evaluation”;
- “use a software workspace capability for this implementation task”.

It may not say:
- “the CAD file is the project database”;
- “the editor timeline is the Epoch lifecycle”;
- “the provider's status is the authoritative delivery state”.

## 12. Acceptance

A foundation integration is architecturally conformant when:
1. the provider is behind a declared capability/adapter boundary;
2. canonical Epoch contracts remain provider-neutral;
3. external output is normalized and validated before becoming canonical fact;
4. authorization, constraints and verification remain in Epoch;
5. the integration records version/license/provenance metadata;
6. a provider outage cannot invalidate canonical state;
7. the integration can be replaced or upgraded without changing universal lifecycle semantics;
8. any fork is explicitly authorized by an Architecture Change Request.

## References

- Blender license: https://www.blender.org/about/license/
- VS Code repository license / Code - OSS: https://github.com/microsoft/vscode/blob/main/LICENSE.txt
- Godot license: https://godotengine.org/license/
- three.js license: https://github.com/mrdoob/three.js/blob/dev/LICENSE
