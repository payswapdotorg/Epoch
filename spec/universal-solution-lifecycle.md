# Epoch Universal Solution Lifecycle USL1.0

## Purpose

Epoch must be able to carry one semantic lifecycle across construction, software, mechanical, electrical, infrastructure, manufacturing, facilities, field service and future engineering domains.

The universal lifecycle is a semantic spine. Domain packs provide vocabulary, measurements, calculations, simulations, evidence methods, visualizations and specialized workflows on top of it.

## Universal stages

`Understand → Decide → Plan → Acquire → Realize → Observe → Actualize → Verify → Forecast → Close → Learn`

The stages are projections over the canonical semantic model. They may branch, pause, resume, loop and overlap.

### Understand

Establish the task-sufficient world and decision context.

Includes:
- observe;
- reconstruct;
- identify relevant entities, relationships and state;
- assess decision sufficiency;
- acquire consequential missing information.

### Decide

Produce and select solution alternatives subject to constraints.

Includes:
- generate alternatives;
- constrain;
- simulate;
- evaluate;
- verify proposed claims;
- approve a baseline.

### Plan

Turn an approved solution into executable intent.

Includes:
- SolutionPackage / SolutionVersion baseline;
- Program of Work;
- dependencies and milestones;
- resources;
- quantities and costs;
- prerequisites;
- verification gates;
- delivery policies.

### Acquire

Obtain or allocate the resources, rights, data, capabilities and prerequisites required for realization.

Acquisition variants include:
- external procurement;
- internal allocation;
- subscription/license acquisition;
- cloud/service provisioning;
- fabrication request;
- specialist capability assignment;
- data/evidence acquisition.

Procurement is therefore a domain-specific acquisition projection, not the universal authority.

### Realize

Transform the world toward the approved solution.

Realization variants include:
- construction/build;
- software implementation and deployment;
- mechanical fabrication/assembly;
- electrical installation/commissioning;
- manufacturing;
- infrastructure provisioning;
- field service/repair.

Execution is a common construction-facing term for realization, but the universal semantic concept is Realization.

### Observe / Actualize

Capture what actually happened and reconcile it into validated delivery state.

Includes:
- progress;
- resource consumption;
- measurements;
- deliveries;
- changes;
- defects;
- delays;
- costs;
- telemetry;
- field evidence;
- user/operator observations.

Observation is evidence capture; Actualization converts accepted observations into authoritative delivery facts.

### Verify

Prove that requirements, work, delivered resources, realized state and outcomes meet their applicable criteria.

Verification methods may be tests, inspection, measurement, review, certification, telemetry or other evidence-producing methods.

### Forecast

Project remaining work and expected completion/cost/performance using the latest validated delivery state.

Forecasts never overwrite historical predictions, baselines or actuals.

### Close

Record completion, acceptance, unresolved residuals, handover and final outcome state.

### Learn

Link:
`context + selected solution + assumptions + acquisition + realization conditions + observations + actuals → outcome`

Learning may improve parameters, priors, rankings, retrieval, templates and calibration without rewriting historical facts.

## Universal semantic distinctions

Epoch preserves these as separate concepts:
- Prediction;
- Estimate;
- Baseline;
- Commitment;
- Observation;
- Actual;
- Forecast;
- Outcome;
- Learning Record.

No domain pack may collapse them into one mutable value.

## Universal Program of Work

ProgramOfWork is a dependency-aware realization graph.

An activity/work package may reference:
- planned quantity and unit;
- planned start/finish;
- predecessors/successors;
- resources;
- responsible actors;
- constraints;
- approvals;
- verification gates;
- actual progress and dates;
- blockers;
- evidence;
- confidence;
- forecast finish.

A domain pack can rename or regroup the presentation, but cannot create a competing schedule authority.

## Domain examples

| Domain | Solution projection | Acquisition projection | Realization projection | Typical schedule projection |
|---|---|---|---|---|
| Construction | building/site solution | materials, subcontractors, equipment | build/install | BOQ + construction programme |
| Software | architecture/release solution | cloud, licenses, data, capabilities | implement/deploy | roadmap + dependency schedule |
| Mechanical | design/assembly solution | materials, parts, tooling | fabricate/assemble | manufacturing/assembly plan + BOM |
| Electrical | system design | equipment, cabling, specialist capability | install/commission | installation + commissioning schedule |
| Infrastructure | topology/service solution | capacity, vendors, access | provision/configure | rollout + migration programme |

The semantic identity remains the same across domains even when user-facing terms differ.

## Decision-sufficiency rule

A missing field is not automatically a blocker.

Epoch should:
1. determine whether the unknown can change the decision, safety/authority boundary or verification result;
2. acquire it when the expected decision impact is material;
3. otherwise preserve the uncertainty with provenance, freshness and confidence.

## Authority boundaries

- World Model: semantic world authority.
- SolutionPackage/SolutionVersion: approved solution intent and baseline authority.
- DeliveryRecord: live delivery facts and delivery-state authority.
- ProgramOfWork: authoritative schedule dimension inside the solution/delivery domain.
- Constraint Engine: constraints/policies.
- Simulation: prediction.
- Evaluation: judgment.
- Verification/Evidence: proof.
- Action Gateway: execution authorization.
- Experience Runtime: presentation and interaction projection.
- External providers: authority over their own systems only.

One responsibility has one authority.
