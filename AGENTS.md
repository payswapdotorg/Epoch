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


## Active program: ACR-010 (in-page foundation asset path)

ACR-010 — In-Page Foundation Asset Path (Fabric-Level Asset Binding) is ACTIVE at `spec/architecture-change-requests/ACR-010-in-page-foundation-asset-path.md`, activated 2026-10-03 under the operator standing continuation directive (the frontier was EMPTY at the W063 merge, 12b5f22). It delivers the ledgered leg-14 disposition (the W060 advisory): the fabric-level asset-binding orchestration (RendererAdapter contract v1.1.0 -> v1.2.0, additive), the `bind` interaction kind, and the in-page external foundation path with the leg-14 battery closure. NO semantic-authority change, NO lock transition; E1.0/X2.0 invariants remain binding; binding is presentation (the sealed, content-addressed, tenant-scoped binding reference flows intent -> admission -> runtime -> fabric -> the UNCHANGED adapter seam).

W065 MERGED (PR #147, cc3b044 — the fabric asset-binding contract v1.2.0); W066 (the bind kind) in flight; W067 (runtime + hosts + the leg-14 closure) follows W066. ACR-011 (the Blender sidecar arity defect closure) is ALSO ACTIVE: W068 (the require() fix + the CI sidecar-Python guard + the live re-run + the ledger closure) is ELIGIBLE, concurrent on disjoint surfaces. The standing operator inputs remain: provider credentials (Vercel/Neon/R2/Upstash/Apify) for the ACR-006 live deployment verification; GPU rasterization is impossible in this sandbox.
