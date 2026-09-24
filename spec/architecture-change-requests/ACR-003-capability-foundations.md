# ACR-003 — Engineering Capability Foundations & Upstream Integration Policy

## Status

APPROVED
Approved by product/architecture authority: 2026-09-24
Effective architecture version: pending the next explicit architecture lock transition
Current implementation lock remains E1.0 / X1.0 for the active W009/W011 wave

## Intent

Establish how Epoch uses mature open-source engineering software without turning any third-party editor, CAD system, game engine, simulation package, or IDE into Epoch's semantic core.

Epoch's value is the provider-neutral engineering system that coordinates world state, solutions, constraints, simulation, verification, delivery and learning. Existing open-source systems are capabilities that Epoch may invoke, embed behind a boundary, or expose through an optional client surface.

## Approved architecture

1. **Epoch remains the semantic kernel.**
   The World Model, canonical lifecycle, SolutionPackage/SolutionVersion, DeliveryRecord, ProgramOfWork, authorization, constraints, verification/evidence, actualization, forecasting and learning remain Epoch authorities.

2. **Third-party engineering software is capability, not authority.**
   Blender, FreeCAD, O3DE, SALOME, ParaView, Theia/Monaco, Three.js/Babylon.js, CesiumJS, BRL-CAD, OpenSCAD, Assimp and similar projects may provide rendering, geometry, simulation, visualization, authoring, IDE or asset-import capabilities. Their native project models never become the canonical Epoch semantic state.

3. **Integrate before forking.**
   The default progression is:
   library/API → provider-neutral adapter → sandboxed extension/plugin → optional client surface → fork.
   A fork is justified only when the upstream interaction model itself is a majority of the required product surface and the required changes cannot be maintained cleanly at an adapter/extension/process boundary.

4. **Forks require an Architecture Change Request.**
   A fork must document:
   - exact upstream version and commit;
   - license and third-party dependency inventory;
   - why an adapter/extension/process boundary is insufficient;
   - modified surface and expected divergence;
   - upstream contribution/reintegration strategy;
   - security/isolation boundary;
   - update and exit plan;
   - ownership of the resulting semantic and operational interfaces.
   No fork may silently become a new Epoch authority.

5. **Provider neutrality remains mandatory.**
   Capability contracts must describe what a capability does, not require a particular vendor, repository or model. Provider-specific APIs, file formats, credentials and runtime behavior stay behind adapters.

6. **Canonical web experience remains web-native.**
   Epoch's web experience should use a web-native renderer/runtime. A desktop engineering application may use a richer optional capability, but that capability must project into and out of canonical Epoch contracts.

7. **Domain packs consume capabilities; they do not own them semantically.**
   Domain packs may select appropriate geometry, visualization, simulation, authoring or software-workspace capabilities, but remain projections over Epoch's universal lifecycle and semantic graph.

## Foundation roles

| Capability class | Reference foundations | Epoch role |
|---|---|---|
| Precision engineering geometry/CAD | FreeCAD, BRL-CAD, OpenSCAD | Geometry/design/manufacturing capability |
| DCC, asset processing, high-fidelity scene work | Blender | Reconstruction, asset, geometry-processing and rendering capability |
| Interactive world/runtime | O3DE, Godot | Interactive simulation/playback capability |
| Engineering CAE/simulation | SALOME, ParaView | Simulation/meshing/result-visualization capability |
| Web 3D / spatial UI | Three.js, Babylon.js, CesiumJS | Canonical or optional web visualization capability |
| Software engineering workspace | Theia, Monaco, LSP/Git integrations | Software-domain authoring/workspace capability |
| 3D interchange/import | Assimp and format-specific adapters | Asset ingestion capability |

The list is illustrative, not an allow-list. Capability selection remains evidence- and contract-driven.

## Recommended domain compositions

### Construction

Epoch coordinates the semantic world, solution and delivery state. FreeCAD may provide precision engineering geometry; Blender may provide high-fidelity scene/asset processing; SALOME/ParaView may provide specialized simulation or result visualization; Three.js/Babylon.js may provide the canonical web experience.

### Mechanical

Epoch coordinates design intent, work, acquisition, realization, inspection, qualification and learning. FreeCAD is a precision geometry/CAD capability; SALOME and related solvers may provide CAE; O3DE or Blender may provide interactive/visual experiences where useful.

### Electrical / infrastructure

Epoch coordinates topology, equipment/resource acquisition, installation or provisioning, verification and operating outcomes. CesiumJS can provide geospatial context; Three.js/Babylon.js or O3DE can provide interactive spatial experiences; specialized simulation/analysis remains behind adapters.

### Software

Epoch remains the lifecycle, delivery and learning authority. Theia or Monaco plus LSP/Git capabilities may provide a software engineering workspace, but files, repositories, deployments, telemetry and generated artifacts are external system records linked through explicit adapters and evidence contracts.

## Licensing and commercial architecture

Epoch must prefer integration boundaries that preserve a viable commercial extension model.

- Permissive dependencies are generally easier to embed, redistribute or expose through commercial products, subject to their notices and dependency terms.
- Copyleft foundations require deliberate boundary design and legal review before source-level coupling or distribution.
- Example: Blender is GPL; its official documentation describes the Python API as an integral part of the software and states that published Python API scripts must be GPL-compliant. This makes a tightly coupled commercial Blender fork a materially different licensing posture from an external/process adapter.
- Example: Code - OSS is MIT licensed in the VS Code repository; a Code - OSS based surface is therefore materially different from relying on the proprietary Microsoft VS Code distribution.
- Example: Godot is MIT licensed and explicitly supports proprietary third-party tools as plugins that do not ship with the engine.

License status is version-sensitive. Every production capability registration must record the license snapshot actually used, including notable third-party dependencies, and must be re-checked before release.

## Capability registration requirements

A production adapter/capability registration should record:

- capability id/version;
- provider/project;
- function category;
- supported operations;
- accepted/produced formats;
- fidelity/accuracy characteristics;
- supported platforms;
- execution mode (in-process, worker, remote service, desktop client);
- latency/cost characteristics;
- reproducibility/version pinning;
- data egress/retention characteristics;
- license snapshot and notices location;
- security/isolation requirements;
- health/version compatibility;
- fallback capability or degraded mode;
- evidence/provenance produced.

## Authority boundary

The interaction pattern is:

Epoch canonical contract → capability adapter → external foundation → normalized result/evidence → Epoch validation → canonical state

The external foundation may own its own internal document, scene, mesh, repository, solver state or workspace. Epoch owns the cross-domain engineering semantics and lifecycle.

No adapter may:
- write directly to Epoch authoritative state;
- bypass constraints, verification or authorization;
- reinterpret provider output as verified fact without an applicable validation method;
- make the provider mandatory when a declared fallback exists;
- expose provider-native identities as Epoch semantic identities without explicit mapping.

## Upstream strategy

Epoch should prefer upstream contribution when a change is generally useful to the source project. If a capability is maintained as a fork, the fork must have a documented divergence budget and update strategy. The repository should periodically assess whether fork-specific code can be upstreamed or moved behind a narrower adapter.

## Decision rule

A proposed foundation is selected by fit against:
- semantic fit;
- boundary cleanliness;
- web/desktop/mobile needs;
- reproducibility;
- performance;
- licensing/commercial posture;
- ecosystem maturity;
- maintenance burden;
- interoperability;
- security/isolation;
- ability to degrade/fallback.

No foundation is selected merely because it is the largest or most feature-rich project.

## Relationship to existing architecture

This ACR refines the Capability Fabric, Extension SDK, Experience Runtime and Domain Pack architecture. It adds no second lifecycle or semantic authority.

It is compatible with ACR-001 and ACR-002 and becomes binding implementation policy at the same explicit architecture lock transition.