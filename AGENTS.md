# Epoch Agent Contract

## Non-negotiable
The repository is the only durable source of truth. Never rely on conversation memory or undocumented assumptions.

## Recovery
Read README.md, AI_CONTINUATION.md, docs/LLM-ARCHITECT-HANDOFF.md, spec/PROJECT-STATE.md, spec/architecture.md, spec/architecture-lock.md, spec/requirements.md, spec/work-items.md, spec/dependency-graph.md, spec/worker-runbook.md, then the assigned Work Order and live GitHub state.

## Architect / Tech Lead
Owns architecture, Work Orders, dispatch, acceptance, review, merge decisions, and project state. May dispatch at most 3 workers concurrently. Must ensure active Work Orders have pairwise-disjoint write surfaces and frozen shared contracts.

## Worker
Implements exactly one Work Order. Stay inside declared ownership surfaces, never edit governance state in flight, never silently broaden scope, add reproducible evidence, and never merge your own PR.

## Parallelism
No-rebase default: concurrent Work Orders have disjoint write surfaces; no shared root manifest/lockfile writes in parallel; shared contracts are completed in earlier waves; dependency additions that touch shared files are serial Tech Lead changes; integration changes belong to explicit integration Work Orders.

## Authority
World Model = semantic truth. Agents = reasoning/planning participants, not authority. SolutionPackage/SolutionVersion = approved solution intent and baseline; DeliveryRecord = live delivery facts; ProgramOfWork = authoritative schedule dimension. Action Gateway = execution authority. Constraint Engine = constraint authority. Simulation = prediction. Evaluation = judgment. Verification/Evidence = proof. Experience Runtime/Solution Navigator = presentation/interaction, not authority. External providers remain authoritative for their own systems.

## Domain adaptation
The universal lifecycle is Understand -> Decide -> Plan -> Acquire -> Realize -> Observe/Actualize -> Verify -> Forecast -> Close -> Learn. Domain packs map this spine into domain vocabulary such as BOQ/procurement/execution or BOM/deployment/commissioning. Packs must not create competing lifecycle or data authorities. See `spec/domain-pack-contract.md`.

## Security
Identity, tenancy, authorization, and policy are separate. Public extensions are capability-scoped and sandboxed. Secrets are never committed. Durable state is authoritative only in designated stores.

## Merge gate
Implementation complete + verification green + evidence complete + Architect approval = merge.

## Remediation
Architect findings are fixed on the same branch/PR with regression evidence. Do not open replacement PRs for the same Work Order.


## Active program: NONE (frontier EMPTY)

ACR-010 (the in-page foundation asset path) is CLOSED COMPLETE: W065 (the RendererAdapter contract v1.2.0 + the fabric-level bindSessionAsset), W066 (the bind interaction kind), W067 (the in-page closure — the leg-14 battery REAL on web + desktop, the Blender-live variant RAN-LIVE GREEN, the program records closed). ACR-011 (the Blender sidecar arity defect closure) is CLOSED COMPLETE: W068 (both ledgered defects closed, the CI-executable sidecar-Python guard, the green live re-run). W001-W068 COMPLETE (68/68); the frontier is EMPTY. Any new implementation requires a new Architecture Change Request per spec/architecture-lock.md. The standing operator inputs remain: provider credentials for the ACR-006 live deployment verification; GPU rasterization is impossible in this sandbox.
