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


## Active program: ACR-008 (X2.0 defect closure)

ACR-008 — Marker-Time Ordering Defect Closure is ACTIVE at `spec/architecture-change-requests/ACR-008-marker-time-comparator.md`.

ACR-007 closed complete (W001-W061, 61/61; frontier EMPTY; f7ca304 + the 0c17f6e reconcile). The operator's standing continuation directive authorizes the ledgered "future-ACR" disposition: the W016 marker-time P2 defect closure. ACR-008 is a defect-closure program — NO architecture change, NO lock transition; E1.0/X2.0 invariants remain binding.

W062 is the single serialized work order (single worker): the numeric `(atMs, markerId)` comparator in `packages/world-experience/src/timeline.ts`, the pinned known-issue battery flip, and the defect-ledger closure. After W062 merges, ACR-008 closes and the frontier returns to EMPTY; any further program again requires a new ACR. The standing operator inputs remain: provider credentials (Vercel/Neon/R2/Upstash/Apify) for the ACR-006 live deployment verification; a Blender binary for the env-gated live legs.
