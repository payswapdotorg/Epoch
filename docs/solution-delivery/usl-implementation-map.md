# USL Implementation Map — stage → contract mapping (W036)

This document maps every stage of the Universal Solution Lifecycle
(USL1.0, binding) onto the concrete contracts and reference machinery of
`@epoch/solution-delivery`. The stages are PROJECTIONS over the canonical
semantic model — they may branch, pause, resume, loop and overlap as
typed relations; this table is a navigation aid, not an FSM.

| Stage | Universal semantics (USL1.0) | Solution-delivery contracts | Typed rejections that protect the stage |
|---|---|---|---|
| **Understand** | Task-sufficient world and decision context; assess decision sufficiency; acquire consequential missing information | `WorldEntityReference` (opaque W002 ids); `InformationAcquisitionRequest` with `DecisionImpact` (materiality + decision kind + stage); `UncertaintyState` (provenance/freshness/confidence preserved on every fact) | `dangling-reference-rejected` for unresolved world entities; materiality drives request issuance (`isMaterialDecisionImpact`) |
| **Decide** | Generate/constrain/simulate/evaluate alternatives; approve a baseline | `SolutionVersionContent` → `SealedSolutionVersion` (content-addressed); `BaselineApproval` (a distinct authority act); `prediction`/`estimate` distinction records | `version-conflict` on publishing the same version with different content; `digest-mismatch` on tampering; `cross-tenant-denied` on foreign approval |
| **Plan** | Turn an approved solution into executable intent | `ProgramOfWorkContent` → `SealedProgramOfWork` (the authoritative schedule dimension): work packages, activities, mirrored dependencies, milestones, resources, verification gates; `baseline` distinction records pointing at the approved version digest | `schedule-cycle-rejected` (dependency cycles, with the cycle path); `schedule-integrity-rejected` (mirror inconsistency); `dangling-reference-rejected` (unknown activities/milestones/gates) |
| **Acquire** | Obtain resources, rights, data, capabilities, prerequisites | `AcquisitionRequestRecord` with the seven-variant `AcquisitionRequestDetail` union; `AcquisitionFulfillmentRecord`; `commitment` distinction records; `ExternalRequestEnvelope` (outbound seam) | `dangling-reference-rejected` (unknown request on fulfillment); `cross-tenant-denied`; `version-conflict` (double fulfillment); `vendor-fields-rejected` (provider fields) |
| **Realize** | Transform the world toward the approved solution | `WorkPackage.realizationVariant` / `Activity.realizationVariant` (the seven realization variants); activity actuals via the delivery machinery | `schedule-integrity-rejected`; `lifecycle-conflict` (illegal stage transitions) |
| **Observe** | Capture what actually happened (evidence capture) | `observation` distinction records (sealed, digest-bearing, evidence-referenced); `recordObservation` intake; `ExternalEventEnvelope` → `externalEventToObservation` (the reference adapter) | `cross-tenant-denied`; `version-conflict` (duplicate intake); `lifecycle-conflict` (closed delivery) |
| **Actualize** | Convert accepted observations into authoritative delivery facts | `acceptObservation` / `rejectObservation` (review state on the DeliveryRecord); `actualizeObservation` producing `actual` distinction records | **`unaccepted-actualization-rejected`** — actualization converts ACCEPTED observations only |
| **Verify** | Prove requirements, work, delivered resources and outcomes meet criteria | `VerificationGate` on activities (method + criteria + evidence + pass provenance); `outcome.verificationRefs` | `dangling-reference-rejected` (gate references unknown activity) |
| **Forecast** | Project remaining work from the latest validated delivery state | `forecast` distinction records (`asOf` + `refines` forecast lineage); `Activity.forecastFinish` | **`forecast-overwrite-rejected`** — forecasts refine forecasts only; they never overwrite historical predictions, baselines or actuals |
| **Close** | Record completion, acceptance, residuals, handover | `closeDeliveryRecord`; `outcome` distinction records (delivered / accepted / handover / residual / rejected / abandoned) | `lifecycle-conflict` (double close; intake into closed delivery) |
| **Learn** | Link context + solution + acquisition + realization + observations + actuals → outcome | `learning` distinction records (`lesson` + typed record `links`) | `distinction-collapse-rejected` (record identity cannot change kind) |

## The typed transition relations

The lifecycle graph admits six relation kinds between stage records
(`admitLifecycleTransition`):

- `precedes` — forward flow between different stages;
- `branch` — an alternative path from one stage record;
- `overlap` — concurrent stages (both currently active);
- `loop` — backward or same-stage re-entry (forward flow is `precedes`);
- `pause` — a self-relation parking an active stage;
- `resume` — a self-relation resuming a paused stage.

Pause/resume statuses are DERIVED from the transition history
(`stageStatusOf`); the stage records themselves never mutate — the graph
is append-only, and its history is replayable.

## The delivery event vocabulary

Every lifecycle fact projects onto the `delivery:*` payload namespace over
the W010 event shapes (`DeliveryEventContent`, structurally identical to
`EventContent` — pinned by parity): `delivery:stage-entered`,
`delivery:stage-transition`, `delivery:baseline-approved`,
`delivery:baseline-revision`, `delivery:observation-recorded`,
`delivery:observation-accepted`, `delivery:observation-rejected`,
`delivery:observation-actualized`, `delivery:acquisition-requested`,
`delivery:acquisition-fulfilled`, `delivery:milestone-reached`,
`delivery:forecast-recorded`, `delivery:outcome-recorded`,
`delivery:learning-recorded`, `delivery:info-request-issued`.

One delivery's lifecycle events form one stream
(`stream:delivery-<suffix>`, derived deterministically by
`deliveryStreamIdOf`).
