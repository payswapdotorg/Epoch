# The Application Gateway Authority Map (W046)

**The Application Gateway composes existing authorities; it is NOT a new semantic authority** (ACR-005, effective). Every gateway operation maps to an EXISTING Epoch kernel/service that owns its semantics. Any operation that cannot be mapped to an existing authority is FORBIDDEN.

This table is the first-class artifact (`services/application-gateway/src/authority-map.ts`); the **walk test** (`services/application-gateway/test/authority-map.test.ts`) enforces it mechanically: it walks the complete gateway surface (the frozen `@epoch/client-runtime` operation vocabulary), fails on any unmapped operation, verifies every authority is an existing workspace package with the declared layer, and pins THIS document table to the same surface (no drift in either direction).

| Operation | Authority layer | Authority (owns the semantics) | Delegates through |
|---|---|---|---|
| `session.issue` | kernel | `@epoch/authentication` (over `@epoch/identity` verified results) | `SessionManager.issueSession`, `sealSession` |
| `session.validate` | kernel | `@epoch/authentication` | `SessionManager.validateSession` |
| `session.revoke` | kernel | `@epoch/authentication` | `SessionManager.revokeSession` |
| `context.resolve` | kernel | `@epoch/tenancy` (the container hierarchy) | `TenancyHierarchy.getNode`, `TenancyHierarchy.listNodes` |
| `world.snapshot` | kernel | `@epoch/world-model` (world semantic truth) | `WorldModel.serialize`, `WorldModel.digest` |
| `world.entities` | kernel | `@epoch/world-model` | `WorldModel.listEntities` |
| `evidence.intake` | kernel | `@epoch/evidence` + `@epoch/object-storage` (bytes by digest) | `EvidenceStore.add`, `computeEvidenceDigest`, `ObjectStore.put` |
| `evidence.get` | kernel | `@epoch/evidence` | `EvidenceStore.byDigest`, `EvidenceStore.byArtifact` |
| `discovery.run` | kernel | `@epoch/capability-discovery` (the discovery plane) | `runProblemDrivenDiscovery` |
| `action.submit` | service | `@epoch/action-gateway` (**the EXECUTION AUTHORITY**) | `ActionGateway.submitAction` |
| `action.approve` | service | `@epoch/action-gateway` (the human-approval flow) | `ActionGateway.approveAction` |
| `action.execute` | service | `@epoch/action-gateway` (authorized dispatch) | `ActionGateway.executeAction` |
| `action.status` | service | `@epoch/action-gateway` (action entries + events) | `ActionGateway.getAction`, `ActionGateway.listActions`, `ActionGateway.actionStream` |
| `constraints.evaluate` | kernel | `@epoch/constraint-language` (the Constraint Engine surface) | `evaluateConstraint` |
| `verification.validateChain` | kernel | `@epoch/verification` (the verification chain) | `validateChain` |
| `solution.sealVersion` | kernel | `@epoch/solution-delivery` (solution intent + baselines) | `sealSolutionVersion` |
| `solution.approveBaseline` | kernel | `@epoch/solution-delivery` | `approveSolutionBaseline` |
| `program.build` | kernel | `@epoch/solution-delivery` (Program of Work) | `buildProgramOfWork` |
| `program.schedule` | kernel | `@epoch/solution-delivery` (schedule/BOQ folds) | `foldQuantitySchedule`, `foldCostSchedule`, `foldResourceSchedule`, `foldMilestoneSchedule` |
| `delivery.open` | kernel | `@epoch/solution-delivery` (DeliveryRecord lifecycle) | `openDeliveryRecord` |
| `delivery.observe` | kernel | `@epoch/execution-tracking` (field observation intake) | `openExecutionTrackingStore`, `intakeFieldObservation` |
| `delivery.close` | kernel | `@epoch/solution-delivery` | `closeDeliveryRecord` |
| `procurement.quote` | kernel | `@epoch/procurement` (acquisition packages + quotes) | `sealQuote`, `admitQuote` |
| `procurement.order` | kernel | `@epoch/procurement` (purchase orders) | `sealPurchaseOrder`, `admitPurchaseOrder` |
| `actualization.forecast` | kernel | `@epoch/actualization` (rolling forecast) | `rollForecast` |
| `outcome.learn` | kernel | `@epoch/learning-calibration` (outcome records) | `openLearningStore`, `registerOutcomeRecord` |
| `access.project` | kernel | `@epoch/access-projection` (authorized projections) | `evaluateProjection`, `selectVisiblePaths` |
| `supervision.check` | kernel | `@epoch/supervision` (supervision passes) | `evaluateSupervisionPass`, `runAllChecks` |
| `alerts.raise` | kernel | `@epoch/alerts` (alert chains + escalation) | `raiseAlert` |
| `marketplace.entitlement` | kernel | `@epoch/marketplace` (entitlement checks) | `checkEntitlement` |
| `events.read` | kernel | `@epoch/event-log` (the append-only log; **READ only** — events are appended by domain authorities, never by clients) | `EventLog.readStream`, `EventLog.listStreams` |
| `recovery.replay` | service | `@epoch/action-gateway` (the offline queue drain routes THROUGH the Action Gateway with idempotency keys) | `ApplicationGateway.call -> action.*` |

## Walk-test result (the enforcement)

`services/application-gateway/test/authority-map.test.ts` — 9 assertions, all green:

1. every operation in the frozen vocabulary has a COMPLETE authority mapping (unmapped operations fail the build);
2. the authority map declares EXACTLY the gateway surface (no extra, no missing);
3. every mapped authority is an EXISTING workspace package with the declared layer;
4. every mapping names concrete delegation entry points;
5. the ACTION operations map to the Action Gateway (lock rule 3);
6. events are READ-ONLY through the gateway (no client-side append operation exists);
7. the queueable (offline) operations all route through action-path authorities;
8. this document's table covers EXACTLY the same surface (no doc drift);
9. the gateway implements every operation (no `operation-unknown` dispatch).

## Non-rules (what the gateway never does)

- It never re-validates kernel payload semantics (only the envelope); a kernel rejection surfaces verbatim as `authority-rejected` carrying the authority's own typed error.
- It never grants authorization (the W009 decision point decides, fail-closed).
- It never appends raw events (events are appended by domain authorities).
- It never mints identity/tenancy, digests or verification results.
