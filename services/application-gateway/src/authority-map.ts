/**
 * @epoch/application-gateway — THE AUTHORITY MAP (first-class artifact).
 *
 * ACR-005: "The Application Gateway composes existing authorities; it is
 * NOT a new semantic authority." This table maps EVERY gateway operation
 * to the existing Epoch kernel/service that owns its semantics. Any
 * operation that cannot be mapped to an existing authority is FORBIDDEN
 * — enforced mechanically by the walk test (test/authority-map.test.ts),
 * which walks the complete gateway surface and fails on unmapped
 * operations, unknown authority packages, or drift between this table,
 * the docs table (docs/product-runtime/authority-map.md) and the frozen
 * operation vocabulary (@epoch/client-runtime).
 */

/** The layer of the authority being delegated to. */
export type AuthorityLayer = 'kernel' | 'service';

/** One authority-mapping entry: gateway operation -> the authority that owns the semantics. */
export interface AuthorityMapping {
  /** The gateway operation name (must be a registered operation). */
  readonly operation: string;
  /** The workspace package that owns the semantics (must exist in the repo). */
  readonly authority: string;
  /** The authority's layer. */
  readonly authorityLayer: AuthorityLayer;
  /** What the authority owns for this operation (the semantic responsibility). */
  readonly owns: string;
  /** The exact authority API entry points the gateway delegates through. */
  readonly delegatesTo: readonly string[];
}

/**
 * THE authority map (frozen v1, W046). Every entry names an EXISTING
 * Epoch authority; the gateway never re-implements any semantics listed
 * in `owns`.
 */
export const AUTHORITY_MAP: readonly AuthorityMapping[] = [
  {
    operation: 'session.issue',
    authority: '@epoch/authentication',
    authorityLayer: 'kernel',
    owns: 'session issuance + lifecycle state (projected from @epoch/identity verified authentication results)',
    delegatesTo: ['SessionManager.issueSession', 'sealSession'],
  },
  {
    operation: 'session.validate',
    authority: '@epoch/authentication',
    authorityLayer: 'kernel',
    owns: 'session lifecycle evaluation (active/expired/revoked)',
    delegatesTo: ['SessionManager.validateSession'],
  },
  {
    operation: 'session.revoke',
    authority: '@epoch/authentication',
    authorityLayer: 'kernel',
    owns: 'session revocation',
    delegatesTo: ['SessionManager.revokeSession'],
  },
  {
    operation: 'context.resolve',
    authority: '@epoch/tenancy',
    authorityLayer: 'kernel',
    owns: 'the Platform -> Tenant -> Workspace -> Project -> World hierarchy',
    delegatesTo: ['TenancyHierarchy.getNode', 'TenancyHierarchy.listNodes'],
  },
  {
    operation: 'world.snapshot',
    authority: '@epoch/world-model',
    authorityLayer: 'kernel',
    owns: 'world semantic truth (typed property/relation graph) + content digest',
    delegatesTo: ['WorldModel.serialize', 'WorldModel.digest'],
  },
  {
    operation: 'world.entities',
    authority: '@epoch/world-model',
    authorityLayer: 'kernel',
    owns: 'world entity truth',
    delegatesTo: ['WorldModel.listEntities'],
  },
  {
    operation: 'evidence.intake',
    authority: '@epoch/evidence',
    authorityLayer: 'kernel',
    owns: 'evidence records + digest discipline (subject-conflict, exact-revision)',
    delegatesTo: ['EvidenceStore.add', 'computeEvidenceDigest'],
  },
  {
    operation: 'evidence.get',
    authority: '@epoch/evidence',
    authorityLayer: 'kernel',
    owns: 'evidence record lookup',
    delegatesTo: ['EvidenceStore.byDigest', 'EvidenceStore.byArtifact'],
  },
  {
    operation: 'discovery.run',
    authority: '@epoch/capability-discovery',
    authorityLayer: 'kernel',
    owns: 'capability-demand compilation, role synthesis, candidate resolution, organization composition + evaluation, discovery-run lineage',
    delegatesTo: ['runProblemDrivenDiscovery'],
  },
  {
    operation: 'action.submit',
    authority: '@epoch/action-gateway',
    authorityLayer: 'service',
    owns: 'EXECUTION AUTHORITY: action intake, W009 authorization gate, policy decision recording (the Action Gateway)',
    delegatesTo: ['ActionGateway.submitAction'],
  },
  {
    operation: 'action.approve',
    authority: '@epoch/action-gateway',
    authorityLayer: 'service',
    owns: 'the human-approval flow (quorum, delegation, supersession)',
    delegatesTo: ['ActionGateway.approveAction'],
  },
  {
    operation: 'action.execute',
    authority: '@epoch/action-gateway',
    authorityLayer: 'service',
    owns: 'authorized dispatch + record-shaped outcomes (the only execution path)',
    delegatesTo: ['ActionGateway.executeAction'],
  },
  {
    operation: 'action.status',
    authority: '@epoch/action-gateway',
    authorityLayer: 'service',
    owns: 'action entries + action:* lifecycle events',
    delegatesTo: ['ActionGateway.getAction', 'ActionGateway.listActions', 'ActionGateway.actionStream'],
  },
  {
    operation: 'constraints.evaluate',
    authority: '@epoch/constraint-language',
    authorityLayer: 'kernel',
    owns: 'compiled-constraint evaluation (the Constraint Engine surface)',
    delegatesTo: ['evaluateConstraint'],
  },
  {
    operation: 'verification.validateChain',
    authority: '@epoch/verification',
    authorityLayer: 'kernel',
    owns: 'the Requirement -> Claim -> Method -> Run -> Evidence -> Result -> Approval chain',
    delegatesTo: ['validateChain', 'admitChain'],
  },
  {
    operation: 'solution.sealVersion',
    authority: '@epoch/solution-delivery',
    authorityLayer: 'kernel',
    owns: 'solution intent + baseline versioning (hash-chained)',
    delegatesTo: ['sealSolutionVersion'],
  },
  {
    operation: 'solution.approveBaseline',
    authority: '@epoch/solution-delivery',
    authorityLayer: 'kernel',
    owns: 'baseline approval (immutable after approval)',
    delegatesTo: ['approveSolutionBaseline'],
  },
  {
    operation: 'program.build',
    authority: '@epoch/solution-delivery',
    authorityLayer: 'kernel',
    owns: 'Program of Work (the authoritative schedule dimension)',
    delegatesTo: ['buildProgramOfWork'],
  },
  {
    operation: 'program.schedule',
    authority: '@epoch/solution-delivery',
    authorityLayer: 'kernel',
    owns: 'schedule/BOQ folds over the sealed program',
    delegatesTo: ['foldQuantitySchedule', 'foldCostSchedule', 'foldResourceSchedule', 'foldMilestoneSchedule'],
  },
  {
    operation: 'delivery.open',
    authority: '@epoch/solution-delivery',
    authorityLayer: 'kernel',
    owns: 'DeliveryRecord lifecycle (live delivery facts)',
    delegatesTo: ['openDeliveryRecord'],
  },
  {
    operation: 'delivery.observe',
    authority: '@epoch/execution-tracking',
    authorityLayer: 'kernel',
    owns: 'low-friction field observation intake + execution tracking state',
    delegatesTo: ['openExecutionTrackingStore', 'intakeFieldObservation'],
  },
  {
    operation: 'delivery.close',
    authority: '@epoch/solution-delivery',
    authorityLayer: 'kernel',
    owns: 'delivery closing',
    delegatesTo: ['closeDeliveryRecord'],
  },
  {
    operation: 'procurement.quote',
    authority: '@epoch/procurement',
    authorityLayer: 'kernel',
    owns: 'acquisition packages + quote lineage/selection',
    delegatesTo: ['sealQuote', 'admitQuote'],
  },
  {
    operation: 'procurement.order',
    authority: '@epoch/procurement',
    authorityLayer: 'kernel',
    owns: 'purchase orders over selected quotes',
    delegatesTo: ['sealPurchaseOrder', 'admitPurchaseOrder'],
  },
  {
    operation: 'actualization.forecast',
    authority: '@epoch/actualization',
    authorityLayer: 'kernel',
    owns: 'rolling forecast over validated actuals',
    delegatesTo: ['rollForecast'],
  },
  {
    operation: 'outcome.learn',
    authority: '@epoch/learning-calibration',
    authorityLayer: 'kernel',
    owns: 'outcome records + calibration datasets',
    delegatesTo: ['openLearningStore', 'registerOutcomeRecord'],
  },
  {
    operation: 'access.project',
    authority: '@epoch/access-projection',
    authorityLayer: 'kernel',
    owns: 'fine-grained authorized projections (two-stage evaluation)',
    delegatesTo: ['evaluateProjection', 'selectVisiblePaths'],
  },
  {
    operation: 'supervision.check',
    authority: '@epoch/supervision',
    authorityLayer: 'kernel',
    owns: 'supervision passes + finding records',
    delegatesTo: ['evaluateSupervisionPass', 'runAllChecks'],
  },
  {
    operation: 'alerts.raise',
    authority: '@epoch/alerts',
    authorityLayer: 'kernel',
    owns: 'alert chains + escalation policies',
    delegatesTo: ['raiseAlert'],
  },
  {
    operation: 'marketplace.entitlement',
    authority: '@epoch/marketplace',
    authorityLayer: 'kernel',
    owns: 'entitlement checks over grants/revocations',
    delegatesTo: ['checkEntitlement'],
  },
  {
    operation: 'events.read',
    authority: '@epoch/event-log',
    authorityLayer: 'kernel',
    owns: 'the append-only event log (READ only: events are appended by domain authorities, never by clients)',
    delegatesTo: ['EventLog.readStream', 'EventLog.listStreams'],
  },
  {
    operation: 'recovery.replay',
    authority: '@epoch/action-gateway',
    authorityLayer: 'service',
    owns: 'the offline queue drain path: every replayed intent routes through the Action Gateway with idempotency keys (offline-admission negative (e))',
    delegatesTo: ['ApplicationGateway.call -> action.* (ActionGateway.submitAction/approveAction/executeAction)'],
  },
] as const;

/** Lookup table: operation -> mapping. */
export const AUTHORITY_BY_OPERATION: Readonly<Record<string, AuthorityMapping>> = Object.fromEntries(
  AUTHORITY_MAP.map((mapping) => [mapping.operation, mapping]),
);

/** True when the operation has a complete authority mapping. */
export function isAuthorityMapped(operation: string): boolean {
  const mapping = AUTHORITY_BY_OPERATION[operation];
  return mapping !== undefined && mapping.delegatesTo.length > 0 && mapping.owns.length > 0;
}
