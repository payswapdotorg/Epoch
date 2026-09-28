// W044 — the DELIVERY-TO-LEARNING end-to-end scenario definition.
//
// The construction realization slice: the COMPLETE universal lifecycle
// (Understand -> Decide -> Plan -> Acquire -> Realize -> Observe/Actualize
// -> Verify -> Forecast -> Close -> Learn) traversed end-to-end through
// REAL kernels (no mocks; every record built through a kernel admission
// path), with BOQ as the synchronized domain projection:
//
//   W026 pack profile (admitted through the W036 gate)
//     -> W036 existing-conditions estimate (Understand) + two alternative
//        solution versions + deterministic evaluation + baseline approval
//        (Decide)
//     -> W036 program of work (baseline) + live schedule states (Plan)
//     -> W026 BOQ + programme projections (identity-mapped plan lines)
//     -> W041 access policy (role-specific authorized views; its digest
//        cites the least-privilege bridge projections later)
//     -> W042 external event bridge + mocked Aurum chat provider:
//        OUTBOUND information request -> provider delivery receipt ->
//        INBOUND information response (the supervisor's returned answer)
//        AND an INBOUND observation report -> W036-shaped intake proposal
//        -> sealed through the REAL W036 authority (never the bridge)
//     -> W036 supervisor InformationAcquisitionRequest (open -> fulfilled)
//     -> W037 procurement chain (Acquire projection: request -> package
//        -> quote -> selection -> commitment -> purchase order ->
//        supplier receipt transitions + acquisition fulfillment)
//     -> W038 field observation intake + change issue + tracking state
//        (Realize projection)
//     -> W043 supervision pass 1: MISSED milestone + late activity +
//        overdue gate + unresolved supervisor unknown -> 4 findings ->
//        4 alerts -> notifications -> escalation (W003 proposal -> Action
//        Gateway decision -> dispatched outcome -> escalated revision) +
//        an OUTBOUND alert to the mocked Aurum provider
//     -> W039 validation + actualization fold (the only bridge from
//        accepted observations to authoritative delivery state) + the
//        baseline-vs-actual variance record + attribution (real W038
//        change record as the cause, real W006 evidence)
//     -> W043 supervision pass 2 (Aurum answer returned + foundations
//        complete): the finding set recomputes to ZERO (the automatic
//        update); alerts resolve
//     -> W036 forecast revisions (r1 -> r2, append-only) + delivery close
//     -> W040 learning: outcome record + comparison facts (forecast vs
//        actual, REAL record digests) -> candidates -> typed eligibility
//        (1 eligible row + 1 unresolved exclusion in the governed store
//        dataset; a foreign-tenant candidate excluded on the pure path)
//        -> model revision proposal + admission (mandatory lineage) ->
//        calibration metric fold -> pack-scoped projection
//     -> W041 authorized projections evaluated (client/engineer views of
//        the program + engineer export of the closed delivery + an
//        audited policy-binding-missing denial) with the full audit trail
//     -> W036 lifecycle graph (11 stage records + 10 precedes
//        transitions) + FOUR typed event streams (W010 log + supervision
//        + learning + access) — the inspectable, replayable evidence
//        chain.
//
// DETERMINISM: every instant is a shared constant; every id is explicit;
// the scenario is a pure function of its inputs. Running it twice in the
// same process yields byte-identical digests (asserted by the fixture
// test via deliveryLearningDigestProjection).
import {
  admitAcquisitionFulfillment,
  admitAcquisitionRequest,
  admitDistinctionRecord,
  admitInformationAcquisitionRequest,
  admitLifecycleStage,
  admitLifecycleTransition,
  admitSolutionVersion,
  approveSolutionBaseline,
  buildProgramOfWork,
  closeDeliveryRecord,
  foldDeliveryActuals,
  openDeliveryRecord,
  recordObservation,
  sealDistinctionRecord,
  sealSolutionVersion,
  verifySealedDeliveryRecord,
  type AcquisitionFulfillmentRecord,
  type AcquisitionRequestRecord,
  type BaselineApproval,
  type DistinctionLedger,
  type InformationAcquisitionRequest,
  type LifecycleGraph,
  type SealedDeliveryRecord,
  type SealedDistinctionRecord,
  type SealedProgramOfWork,
  type SealedSolutionVersion,
} from '@epoch/solution-delivery';
import {
  admitConstructionPackProfile,
  constructionPackProfile,
  digestPackProfile,
  foldDeliveryLinks,
  projectBoq,
  projectConstructionProgramme,
  type BoqView,
  type ConstructionProgrammeView,
  type DeliveryLinkIndex,
} from '@epoch/pack-construction';
import {
  admitAcquisitionPackage,
  admitPurchaseOrder,
  admitQuote,
  admitQuoteSelection,
  appendSupplierDeliveryTransition,
  emptyDeliveryLog,
  emptyPackageStore,
  emptyPurchaseOrderStore,
  emptyQuoteStore,
  emptySelectionStore,
  foldSupplierDelivery,
  sealAcquisitionPackage,
  sealProcurementCommitment,
  sealPurchaseOrder,
  sealQuote,
  sealQuoteSelection,
  sealSupplierDeliveryTransition,
  type PurchaseOrderStore,
  type QuoteStore,
  type SupplierDeliveryLog,
} from '@epoch/procurement';
import {
  admitIssue,
  admitTrackingState,
  buildProgramIndex,
  intakeFieldObservation,
  openExecutionTrackingStore,
  projectExecutionState,
  sealIssueRecord,
  sealTrackingStateRecord,
  type ExecutionStateProjection,
  type ExecutionTrackingStore,
  type SealedIssueRecord,
} from '@epoch/execution-tracking';
import {
  applyActualization,
  currentAssessments,
  intakeObservation,
  openActualizationStore,
  projectActualizationState,
  sealActualizationEvent,
  verifySealedActualizationEvent,
  type ActualizationStateProjection,
  type ActualizationStore,
  type SealedActualizationEvent,
  type SealedValidationAssessment,
} from '@epoch/actualization';
import {
  admitAttributionRecord,
  admitVarianceRecord,
  causesOf,
  computeVariance,
  foldVarianceRecords,
  foldVarianceSummary,
  openAttributionLedger,
  openVarianceLedger,
  sealAttributionRecord,
  type SealedAttributionRecord,
  type SealedVarianceRecord,
  type VarianceClassSummary,
  type VarianceLedger,
} from '@epoch/variance';
import {
  addNonNegativeDecimals,
  assembleDataset,
  compareNonNegativeDecimals,
  evaluateEligibility,
  learningStreamIdOf,
  multiplyNonNegativeDecimals,
  openLearningStore,
  projectPackView,
  projectStoreLearningState,
  registerComparisonFact,
  registerOutcomeRecord,
  intakeLearningRecord,
  assembleDatasetFromStore,
  admitModelRevisionProposal,
  foldMetrics,
  sealComparisonFactInput,
  sealModelRevisionProposal,
  sealOutcomeLearningCandidate,
  sealLearningEvent,
  type LearningStore,
  type SealedComparisonFactInput,
  type SealedLearningDataset,
  type SealedLearningEvent,
  type SealedOutcomeLearningCandidate,
  type LearningEventPayload,
  type LearningStateProjection,
  type PackLearningView,
  type SealedCalibrationMetricSet,
  type SealedModelRevision,
  type SealedModelRevisionProposal,
  type EligibilityEvaluation,
} from '@epoch/learning-calibration';
import {
  appendAuditRecord,
  admitCanonicalRecord,
  admitProjection,
  admitProjectionPolicy,
  canonicalObjectIdentity,
  evaluateProjection,
  openAccessProjectionStore,
  projectAccessState,
  redactedPathsOf,
  releasedPathsOf,
  sealAccessProjectionEvent,
  sealProjectionPolicy,
  accessStreamIdOf,
  type AccessProjectionEventPayload,
  type AccessProjectionStore,
  type AccessStateProjection,
  type CanonicalRecord,
  type ProjectionEvaluation,
  type ProjectionSubject,
  type SealedAccessProjectionEvent,
  type SealedProjectionAudit,
  type SealedAuthorizedProjection,
} from '@epoch/access-projection';
import {
  evaluate,
  sealAuthorizationDecision,
  type AuthorizationContext,
  type AuthorizationDecisionRegistration,
  type AuthorizationRequest,
} from '@epoch/authorization';
import {
  ExternalEventBridgeRuntime,
  buildOutboundRequest,
  type BridgeAuthorizationPair,
  type OutboundDispatchOutcome,
  type IntakeOutcome,
  type SealedExternalEvent,
  type SealedOutboundRequest,
  type SealedObservationIntakeProposal,
} from '@epoch/external-event-bridge';
import {
  ChatReferenceProvider,
  SUCCESS_DELIVERY_SCRIPT,
  adaptInboundMessage,
  referenceProviderMessage,
} from '@epoch/adapter-aurum-chat';
import {
  admitEscalationPolicy,
  buildEscalationProposal,
  buildNotification,
  computeProposalDigest,
  escalateAlert,
  foldAlertChains,
  InMemoryNotificationAdapter,
  planEscalation,
  raiseAlert,
  recordEscalationOutcome,
  resolveAlert,
  resolvePolicyRule,
  type ActionProposal,
  type AlertChainFold,
  type EscalationPlan,
  type NotificationReceipt,
  type SealedAlertRecord,
  type SealedEscalationOutcome,
  type SealedEscalationPolicy,
  type SealedNotificationRecord,
} from '@epoch/alerts';
import {
  evaluateSupervisionPass,
  DEFAULT_SUPERVISION_THRESHOLDS,
  projectSupervisionState,
  sealSupervisionEvent,
  supervisionStreamIdOf,
  type SealedSupervisionEvent,
  type SealedSupervisionPass,
  type SupervisionEventPayload,
  type SupervisionStateProjection,
} from '@epoch/supervision';
import { canonicalDigest, type JsonValue } from '@epoch/action-policy';
import type { AuthorizationDecision } from '@epoch/action-protocol';
import { EvidenceStore, type EvidenceStore as EvidenceStoreType } from '@epoch/evidence';
import { EventLog, sealEvent, type EventContent } from '@epoch/event-log';
import {
  APPROVER,
  BRIDGE_OPERATOR,
  CLIENT_VIEWER,
  DIGEST,
  FOREMAN,
  OBSERVER,
  PRINCIPAL,
  PROCUREMENT,
  ROLE_CLIENT,
  ROLE_ENGINEER,
  SITE_ENGINEER,
  SUPERVISOR,
  T,
  TENANT,
  derivedUncertainty,
  need,
  reportedUncertainty,
  uncertainty,
} from './shared';

// --------------------------------------------------------------------------------
// Scenario vocabulary (explicit ids — no minting, no clock).
// --------------------------------------------------------------------------------

export const SOLUTION_ID = 'solution:warehouse-extension';
export const ALT_SOLUTION_ID = 'solution:warehouse-extension-hybrid';
export const PROGRAM_ID = 'program:warehouse-extension-v1';
export const DELIVERY_ID = 'delivery:warehouse-extension-v1';
export const DELIVERY_STREAM_ID = 'stream:delivery-warehouse-extension-v1';
export const ACTUALIZATION_STREAM_ID = 'stream:actualization-warehouse-extension-v1';

export const LINE_EXCAVATION = 'line:bulk-excavation';
export const LINE_CONCRETE = 'line:concrete-foundations';
export const LINE_STEEL = 'line:steel-frame';

export const WORK_PACKAGE_SUBSTRUCTURE = 'work-package:substructure';
export const WORK_PACKAGE_SUPERSTRUCTURE = 'work-package:superstructure';
export const ACTIVITY_EXCAVATION = 'activity:excavation-bulk';
export const ACTIVITY_CONCRETE = 'activity:foundation-concrete';
export const ACTIVITY_STEEL = 'activity:steel-erection';
export const MILESTONE_FOUNDATIONS = 'milestone:foundations';
export const GATE_FORMATION = 'gate:formation-inspection';
export const GATE_STEEL = 'gate:steel-certificate';

export const ACQUISITION_ID = 'acquisition:steel-supply';
export const PACKAGE_ID = 'package:steel-supply';
export const QUOTE_ID = 'quote:steel-supply-alpha';
export const SELECTION_ID = 'selection:steel-supply-alpha';
export const COMMITMENT_ID = 'commitment:steel-supply-order-1';
export const COMMITMENT_RECORD_ID = 'commitment:steel-supply-commitment';
export const PO_ID = 'po:steel-supply-001';
export const FULFILLMENT_ID = 'fulfillment:steel-supply-receipt';
export const SUPPLIER = 'supplier:alpha-steel';

export const INFO_REQUEST_ID = 'info-request:foundations';
export const OUTBOUND_INFO_REQUEST_ID = 'outbound:info-progress-1';
export const BRIDGE_INFO_CORRELATION_ID = 'corr:progress-confirmation';
export const BRIDGE_ANSWER_EVENT_ID = 'bridge-event:progress-answer';
export const BRIDGE_OBSERVATION_EVENT_ID = 'bridge-event:goods-receipt-observation';
export const BRIDGE_ALERT_REQUEST_ID = 'outbound:alert-milestone-1';
export const BRIDGE_ALERT_CORRELATION_ID = 'corr:alert-milestone';

export const FIELD_CAPTURE_KEY = 'pit-progress-monday';
export const FIELD_OBSERVATION_ID = `observation:field-${FIELD_CAPTURE_KEY}`;
export const FIELD_ACTUAL_ID = `actual:field-${FIELD_CAPTURE_KEY}`;
export const AURUM_OBSERVATION_ID = 'observation:steel-receipt-external';
export const AURUM_RECEIPT_ACTUAL_ID = 'actual:steel-receipt-external';

export const EXISTING_CONDITIONS_ID = 'estimate:existing-pit-survey';
export const BASELINE_RECORD_ID = 'baseline:excavation-quantity';
export const FORECAST_R1_ID = 'forecast:excavation-remaining-r1';
export const FORECAST_R2_ID = 'forecast:excavation-remaining-r2';
export const OUTCOME_ID = 'outcome:excavation-delivered';
export const OUTCOME_RESIDUAL_ID = 'outcome:excavation-residual';
export const OUTCOME_FOREIGN_ID = 'outcome:excavation-foreign';

export const VARIANCE_ID = 'variance:excavation-quantity';
export const ATTRIBUTION_ID = 'attribution:excavation-geometry';
export const ISSUE_ID = 'change:pit-geometry-revision';

export const COMPARISON_FACT_ID = 'comparison-fact:excavation-r2-actual';
export const COMPARISON_FACT_RESIDUAL_ID = 'comparison-fact:excavation-r1-actual';
export const COMPARISON_FACT_FOREIGN_ID = 'comparison-fact:excavation-foreign';
export const COMPARISON_REF_ID = 'comparison:excavation-r2-actual';
export const COMPARISON_REF_RESIDUAL_ID = 'comparison:excavation-r1-actual';
export const COMPARISON_REF_FOREIGN_ID = 'comparison:excavation-foreign';
export const VALIDATION_ASSESSMENT_ID = 'validation:excavation-activity-group';
export const CANDIDATE_ID = 'candidate:excavation-r2-actual';
export const CANDIDATE_RESIDUAL_ID = 'candidate:excavation-r1-actual';
export const CANDIDATE_FOREIGN_ID = 'candidate:excavation-foreign';
export const MODEL_ID = 'model:excavation-volume-calibration';
export const REVISION_ID = 'model-revision:excavation-volume-1';
export const PROPOSAL_ID = 'proposal:excavation-volume-revision-1';

export const PASS_1_ID = 'pass:week-one';
export const PASS_2_ID = 'pass:week-two';

export const ALERT_POLICY_ID = 'alert-policy:delivery-supervision';
export const ALERT_MILESTONE_ID = 'alert:foundations-milestone-missed';
export const ALERT_ACTIVITY_ID = 'alert:foundation-concrete-late';
export const ALERT_GATE_ID = 'alert:formation-gate-overdue';
export const ALERT_CRITICAL_ID = 'alert:foundation-concrete-critical-drift';
export const ALERT_UNKNOWN_ID = 'alert:progress-confirmation-unknown';
export const ESCALATION_OUTCOME_ID = 'escalation:foundations-milestone-1';
export const ESCALATION_PROPOSAL_ID = 'proposal-escalate-foundations-1';
export const ESCALATION_PROPOSAL_MESSAGE_ID = 'message-escalate-foundations-1';
export const ESCALATION_REQUEST_ID = 'message-request-escalate-foundations-1';
export const ESCALATION_DECISION_MESSAGE_ID = 'message-decision-escalate-foundations-1';
export const ESCALATION_NOTIFICATION_ID = 'notification:foundations-milestone-escalated';

export const ACCESS_POLICY_ID = 'policy:warehouse-delivery-access';

/** The scenario's world entities (W002 type keys for the pack bindings). */
const WORLD_ENTITIES = [
  { id: 'element-foundations', type: 'construction:element' },
  { id: 'element-frame', type: 'construction:element' },
] as const;

/** The learning band thresholds (caller-supplied, never implicit). */
const BAND_THRESHOLDS = { minor: '5', material: '20', severe: '50' } as const;

/** The metric-fold tolerance bands (strictly ascending). */
const TOLERANCE_BANDS = ['5', '10'] as const;

// --------------------------------------------------------------------------------
// Content builders (loose JSON; kernels validate + seal).
// --------------------------------------------------------------------------------

function solutionContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: SOLUTION_ID,
    version: '1.0.0',
    tenantId: TENANT,
    title: 'Warehouse extension',
    description: 'Steel-framed warehouse extension: substructure and superstructure works',
    objective: 'Deliver the warehouse extension within the site constraint set',
    solutionLines: [
      {
        lineId: LINE_EXCAVATION,
        title: 'Bulk excavation to formation level',
        description: 'Excavation of the foundation footprint to the specified formation level',
        quantity: { value: '120', unit: 'm3' },
        unitCost: { amount: '18.50', currency: 'EUR' },
        worldEntityId: 'element-foundations',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: LINE_CONCRETE,
        title: 'Reinforced concrete foundations',
        quantity: { value: '85', unit: 'm3' },
        unitCost: { amount: '210.00', currency: 'EUR' },
        worldEntityId: 'element-foundations',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: LINE_STEEL,
        title: 'Structural steel frame',
        quantity: { value: '4', unit: 'tonne' },
        unitCost: { amount: '2400.00', currency: 'EUR' },
        worldEntityId: 'element-frame',
        acquisitionVariant: 'external-procurement',
      },
    ],
    worldReferences: WORLD_ENTITIES.map((entity) => ({ entityId: entity.id })),
    constraintReferences: [{ constraintId: 'max-building-height' }],
    previousVersionDigest: null,
    createdAt: T[1],
    createdBy: PRINCIPAL,
  };
}

function alternativeSolutionContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: ALT_SOLUTION_ID,
    version: '1.0.0',
    tenantId: TENANT,
    title: 'Warehouse extension (hybrid frame alternative)',
    description: 'Hybrid steel-timber warehouse extension: the rejected alternative',
    objective: 'Deliver the warehouse extension within the site constraint set',
    solutionLines: [
      {
        lineId: 'line:hybrid-concrete',
        title: 'Reinforced concrete foundations',
        quantity: { value: '85', unit: 'm3' },
        unitCost: { amount: '210.00', currency: 'EUR' },
        worldEntityId: 'element-foundations',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: 'line:hybrid-excavation',
        title: 'Bulk excavation to formation level',
        description: 'Excavation of the foundation footprint to the specified formation level',
        quantity: { value: '120', unit: 'm3' },
        unitCost: { amount: '18.50', currency: 'EUR' },
        worldEntityId: 'element-foundations',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: 'line:hybrid-frame',
        title: 'Hybrid steel-timber frame',
        quantity: { value: '4', unit: 'tonne' },
        unitCost: { amount: '3100.00', currency: 'EUR' },
        worldEntityId: 'element-frame',
        acquisitionVariant: 'external-procurement',
      },
    ],
    worldReferences: WORLD_ENTITIES.map((entity) => ({ entityId: entity.id })),
    constraintReferences: [{ constraintId: 'max-building-height' }],
    previousVersionDigest: null,
    createdAt: T[1],
    createdBy: PRINCIPAL,
  };
}

/**
 * The deterministic alternative EVALUATION (the Decide leg): total cost
 * per alternative through the W036 decimal arithmetic over the sealed
 * solution lines. The winner is the constraint-satisfying alternative
 * with the lower total. Pure, typed, zero simulation fabric.
 */
function evaluateAlternatives(
  primary: SealedSolutionVersion,
  alternative: SealedSolutionVersion,
): { primaryTotal: string; alternativeTotal: string; winnerId: string } {
  const totalOf = (solution: SealedSolutionVersion): string =>
    solution.solutionLines.reduce(
      (acc, line) =>
        addNonNegativeDecimals(acc, multiplyNonNegativeDecimals(line.quantity.value, line.unitCost?.amount ?? '0')),
      '0',
    );
  const primaryTotal = totalOf(primary);
  const alternativeTotal = totalOf(alternative);
  const winnerId =
    compareNonNegativeDecimals(primaryTotal, alternativeTotal) <= 0 ? primary.solutionId : alternative.solutionId;
  return { primaryTotal, alternativeTotal, winnerId };
}

interface ProgramVariant {
  readonly milestoneStatus: 'planned' | 'missed' | 'reached';
  readonly foundationProgress: number;
  readonly foundationFinish: string | undefined;
  readonly gatePassedAt: string | undefined;
}

function programContent(variant: ProgramVariant, sealed: SealedSolutionVersion): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.program-of-work',
    schemaVersion: 1,
    programId: PROGRAM_ID,
    tenantId: sealed.tenantId,
    solutionId: sealed.solutionId,
    solutionVersion: sealed.version,
    solutionVersionDigest: sealed.contentDigest,
    title: 'Warehouse extension programme',
    workPackages: [
      {
        workPackageId: WORK_PACKAGE_SUBSTRUCTURE,
        title: 'Substructure works',
        description: 'Excavation and reinforced concrete foundations',
        solutionLineId: LINE_EXCAVATION,
        worldEntityId: 'element-foundations',
        realizationVariant: 'construction-build',
        plannedStart: T[4],
        plannedFinish: T[7],
        responsibleActor: PRINCIPAL,
        resources: [{ resourceId: 'resource:excavator', quantity: '1', unit: 'machine' }],
        constraintReferences: [],
        approvals: [{ approvedBy: APPROVER, approvedAt: T[3] }],
        verificationGates: [
          {
            gateId: GATE_FORMATION,
            activityId: ACTIVITY_CONCRETE,
            title: 'Formation level inspection',
            method: 'construction.verify.inspection',
            criteria: 'Formation level within tolerance',
            evidence: [],
            ...(variant.gatePassedAt !== undefined ? { passedAt: variant.gatePassedAt, passedBy: SUPERVISOR } : {}),
          },
        ],
        activities: [
          {
            activityId: ACTIVITY_EXCAVATION,
            workPackageId: WORK_PACKAGE_SUBSTRUCTURE,
            title: 'Bulk excavation to formation level',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '120', unit: 'm3' },
            plannedCost: { amount: '2220.00', currency: 'EUR' },
            plannedStart: T[4],
            plannedFinish: T[6],
            predecessors: [],
            successors: [ACTIVITY_CONCRETE],
            resources: [{ resourceId: 'resource:excavator', quantity: '1', unit: 'machine' }],
            responsibleActor: PRINCIPAL,
            constraintReferences: [],
            actualProgress: 1,
            actualStart: T[4],
            actualFinish: T[6],
            blockers: [],
            evidence: [{ digest: DIGEST('a') }],
          },
          {
            activityId: ACTIVITY_CONCRETE,
            workPackageId: WORK_PACKAGE_SUBSTRUCTURE,
            title: 'Pour reinforced concrete foundations',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '85', unit: 'm3' },
            plannedCost: { amount: '17850.00', currency: 'EUR' },
            plannedStart: T[5],
            plannedFinish: T[7],
            predecessors: [ACTIVITY_EXCAVATION],
            successors: [ACTIVITY_STEEL],
            resources: [],
            responsibleActor: PRINCIPAL,
            constraintReferences: [],
            actualProgress: variant.foundationProgress,
            actualStart: T[6],
            ...(variant.foundationFinish !== undefined ? { actualFinish: variant.foundationFinish } : {}),
            blockers: [],
            evidence: [],
          },
        ],
      },
      {
        workPackageId: WORK_PACKAGE_SUPERSTRUCTURE,
        title: 'Superstructure frame works',
        description: 'Structural steel erection',
        solutionLineId: LINE_STEEL,
        worldEntityId: 'element-frame',
        realizationVariant: 'construction-build',
        plannedStart: T[12],
        plannedFinish: T[13],
        responsibleActor: 'principal:steel-lead',
        resources: [{ resourceId: 'resource:mobile-crane', quantity: '4', unit: 'day' }],
        constraintReferences: [{ constraintId: 'max-building-height' }],
        approvals: [],
        verificationGates: [
          {
            gateId: GATE_STEEL,
            activityId: ACTIVITY_STEEL,
            title: 'Structural steel material certificates',
            method: 'construction.verify.material-certificate',
            criteria: 'Mill certificates match the specified grade',
            evidence: [],
          },
        ],
        activities: [
          {
            activityId: ACTIVITY_STEEL,
            workPackageId: WORK_PACKAGE_SUPERSTRUCTURE,
            title: 'Erect structural steel frame',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '4', unit: 'tonne' },
            plannedCost: { amount: '9600.00', currency: 'EUR' },
            plannedStart: T[12],
            plannedFinish: T[13],
            predecessors: [ACTIVITY_CONCRETE],
            successors: [],
            resources: [{ resourceId: 'resource:mobile-crane', quantity: '4', unit: 'day' }],
            responsibleActor: 'principal:steel-lead',
            constraintReferences: [],
            actualProgress: 0,
            blockers: [],
            evidence: [],
          },
        ],
      },
    ],
    milestones: [
      {
        milestoneId: MILESTONE_FOUNDATIONS,
        title: 'Foundations complete',
        targetDate: T[7],
        activityIds: [ACTIVITY_EXCAVATION, ACTIVITY_CONCRETE],
        status: variant.milestoneStatus,
        ...(variant.milestoneStatus === 'reached' ? { reachedAt: variant.foundationFinish } : {}),
        evidence: variant.milestoneStatus === 'reached' ? [{ digest: DIGEST('b') }] : [],
      },
    ],
    createdAt: T[3],
    createdBy: PRINCIPAL,
  };
}

function acquisitionRequestContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.acquisition-request',
    schemaVersion: 1,
    acquisitionId: ACQUISITION_ID,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    deliveryId: DELIVERY_ID,
    detail: {
      variant: 'external-procurement',
      lines: [
        {
          description: 'Structural steel sections grade S355',
          quantity: '4',
          unit: 'tonne',
          solutionLineId: LINE_STEEL,
        },
      ],
    },
    requestedAt: T[4],
    requestedBy: PROCUREMENT,
    neededBy: T[6],
    note: 'Superstructure steel supply against the BOQ quantities',
  };
}

function packageContent(request: AcquisitionRequestRecord): Record<string, unknown> {
  return {
    schema: 'epoch.procurement.acquisition-package',
    schemaVersion: 1,
    packageId: PACKAGE_ID,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    acquisitionId: ACQUISITION_ID,
    acquisitionRequestDigest: canonicalDigest(JSON.parse(JSON.stringify(request)) as never),
    variant: 'external-procurement',
    lines: [
      {
        description: 'Structural steel sections grade S355',
        quantity: '4',
        unit: 'tonne',
        solutionLineId: LINE_STEEL,
      },
    ],
    assembledAt: T[4],
    assembledBy: PROCUREMENT,
  };
}

function quoteContent(packageDigest: string): Record<string, unknown> {
  return {
    schema: 'epoch.procurement.quote',
    schemaVersion: 1,
    quoteId: QUOTE_ID,
    tenantId: TENANT,
    packageId: PACKAGE_ID,
    packageDigest,
    supplierId: SUPPLIER,
    state: 'submitted',
    revision: 1,
    previousQuoteRevisionDigest: null,
    lines: [
      {
        description: 'Structural steel sections grade S355',
        quantity: '4',
        unit: 'tonne',
        unitCost: { amount: '2350.00', currency: 'EUR' },
        allocation: { state: 'reserved', quantity: '4', allocatedAt: T[4], allocationRef: 'alloc:steel-1' },
      },
    ],
    leadTimes: [],
    validUntil: T[10],
    submittedAt: T[4],
    submittedBy: PROCUREMENT,
  };
}

function selectionContent(packageDigest: string, quoteDigest: string): Record<string, unknown> {
  return {
    schema: 'epoch.procurement.quote-selection',
    schemaVersion: 1,
    selectionId: SELECTION_ID,
    tenantId: TENANT,
    packageId: PACKAGE_ID,
    packageDigest,
    selectedQuoteId: QUOTE_ID,
    selectedQuoteDigest: quoteDigest,
    consideredQuotes: [{ quoteId: QUOTE_ID, quoteDigest }],
    rationale: 'Single live quote with a reserved allocation',
    previousSelectionDigest: null,
    decidedAt: T[5],
    decidedBy: PROCUREMENT,
  };
}

function purchaseOrderContent(
  packageDigest: string,
  selectionDigest: string,
  commitmentDigest: string,
  lines: readonly { description: string; quantity: string; unit: string; unitCost: { amount: string; currency: string } }[],
): Record<string, unknown> {
  return {
    schema: 'epoch.procurement.purchase-order',
    schemaVersion: 1,
    poId: PO_ID,
    tenantId: TENANT,
    packageId: PACKAGE_ID,
    packageDigest,
    selectionRef: { selectionId: SELECTION_ID, contentDigest: selectionDigest },
    commitmentRef: { recordId: COMMITMENT_ID, contentDigest: commitmentDigest },
    supplierId: SUPPLIER,
    poVersion: 1,
    previousPOVersionDigest: null,
    lines: lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitCost: { amount: line.unitCost.amount, currency: line.unitCost.currency },
    })),
    totalCost: { amount: '2350', currency: 'EUR' },
    issuedAt: T[6],
    issuedBy: PROCUREMENT,
  };
}

function issueContent(): Record<string, unknown> {
  return {
    schema: 'epoch.execution-tracking.issue-record',
    schemaVersion: 1,
    recordId: ISSUE_ID,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    issueKind: 'change',
    title: 'Pit geometry revised after obstruction',
    description: 'The north-east corner geometry was revised, changing the measured pit volume',
    severity: 'moderate',
    impact: {
      workPackageIds: [WORK_PACKAGE_SUBSTRUCTURE],
      activityIds: [ACTIVITY_EXCAVATION],
      milestoneIds: [],
    },
    raisedAt: T[4],
    raisedBy: FOREMAN,
    recordedAt: T[4],
    evidenceLinks: [],
    uncertainty: uncertainty({ provenance: { kind: 'observed', sourceRef: 'source:site-instruction', actor: FOREMAN } }),
  };
}

function fieldCapture(): Record<string, unknown> {
  return {
    captureKey: FIELD_CAPTURE_KEY,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    deliveryId: DELIVERY_ID,
    observedAt: T[6],
    observedBy: OBSERVER,
    subjectRef: { kind: 'activity', id: ACTIVITY_EXCAVATION },
    measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    uncertainty: uncertainty(),
  };
}

function existingConditionsContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'estimate',
    recordId: EXISTING_CONDITIONS_ID,
    tenantId: TENANT,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_EXCAVATION,
    },
    measure: { kind: 'quantity', value: '121', unit: 'm3' },
    payload: { method: 'source:pre-work-survey' },
    recordedAt: T[0],
    recordedBy: OBSERVER,
    uncertainty: uncertainty({
      provenance: { kind: 'observed', sourceRef: 'source:pre-work-survey', actor: OBSERVER },
      confidence: { method: 'measured', value: 0.9, rationale: 'surveyed existing pit geometry' },
    }),
  };
}

function baselineRecordContent(solution: SealedSolutionVersion): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'baseline',
    recordId: BASELINE_RECORD_ID,
    tenantId: TENANT,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_EXCAVATION,
    },
    payload: {
      solutionVersion: solution.version,
      solutionVersionDigest: solution.contentDigest,
    },
    recordedAt: T[3],
    recordedBy: PRINCIPAL,
    uncertainty: derivedUncertainty(),
  };
}

function commitmentRecordContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'commitment',
    recordId: COMMITMENT_RECORD_ID,
    tenantId: TENANT,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'work-package',
      subjectId: WORK_PACKAGE_SUPERSTRUCTURE,
    },
    measure: { kind: 'quantity', value: '4', unit: 'tonne' },
    payload: {
      committedBy: PROCUREMENT,
      committedAt: T[5],
      acquisitionId: ACQUISITION_ID,
    },
    recordedAt: T[5],
    recordedBy: PROCUREMENT,
    uncertainty: uncertainty({
      provenance: { kind: 'observed', sourceRef: 'source:purchase-commitment', actor: PROCUREMENT },
    }),
  };
}

function forecastContent(recordId: string, value: string, asOf: string, refines: string | null): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'forecast',
    recordId,
    tenantId: TENANT,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_EXCAVATION,
    },
    measure: { kind: 'quantity', value, unit: 'm3' },
    payload: { asOf, refines },
    recordedAt: asOf,
    recordedBy: PRINCIPAL,
    uncertainty: derivedUncertainty({
      confidence: { method: 'derived', value: 0.85, rationale: 'projected from the plan and early survey signals' },
    }),
  };
}

function comparisonFactContent(input: {
  factId: string;
  comparisonRefId: string;
  forecastRecordId: string;
  forecastDigest: string;
  forecastValue: string;
  actualRecordId: string;
  actualDigest: string;
  deviation: string;
  observedAt: string;
}): Record<string, unknown> {
  return {
    schema: 'epoch.actualization.comparison-fact',
    schemaVersion: 1,
    factId: input.factId,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_EXCAVATION,
    },
    comparisonRef: {
      recordId: input.comparisonRefId,
      contentDigest: canonicalDigest({
        baselineRecordId: BASELINE_RECORD_ID,
        forecastRecordId: input.forecastRecordId,
        actualRecordId: input.actualRecordId,
      } as JsonValue),
    },
    forecastRef: { recordId: input.forecastRecordId, contentDigest: input.forecastDigest },
    actualRef: { recordId: input.actualRecordId, contentDigest: input.actualDigest },
    forecastMeasure: { kind: 'quantity', value: input.forecastValue, unit: 'm3' },
    actualMeasure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    deviation: input.deviation,
    bias: 'over-forecast',
    observedAt: input.observedAt,
  };
}

// --------------------------------------------------------------------------------
// The scenario result: every intermediate, for cross-surface assertions.
// --------------------------------------------------------------------------------

export interface DeliveryLearningScenario {
  // -- Understand / Decide.
  readonly packProfileDigest: string;
  readonly existingConditions: SealedDistinctionRecord;
  readonly alternativeSolution: SealedSolutionVersion;
  readonly evaluation: { primaryTotal: string; alternativeTotal: string; winnerId: string };
  readonly solution: SealedSolutionVersion;
  readonly approval: BaselineApproval;
  // -- Plan (the baseline schedule + the synchronized projections).
  readonly program: SealedProgramOfWork;
  readonly programLive1: SealedProgramOfWork;
  readonly programLive2: SealedProgramOfWork;
  readonly boq: BoqView;
  readonly programme: ConstructionProgrammeView;
  readonly deliveryLinks: DeliveryLinkIndex;
  // -- Acquire (the procurement projection) + the distinction ledger.
  readonly acquisitionRequest: AcquisitionRequestRecord;
  readonly acquisitionFulfillments: readonly AcquisitionFulfillmentRecord[];
  readonly orders: PurchaseOrderStore;
  readonly supplierDelivery: SupplierDeliveryLog;
  readonly ledger: DistinctionLedger;
  readonly baselineRecord: SealedDistinctionRecord;
  readonly commitmentRecord: SealedDistinctionRecord;
  readonly forecastR1: SealedDistinctionRecord;
  readonly forecastR2: SealedDistinctionRecord;
  // -- Realize (the execution projection).
  readonly tracking: ExecutionTrackingStore;
  readonly issue: SealedIssueRecord;
  // -- The supervisor request (open -> fulfilled) + the mocked Aurum legs.
  readonly infoRequestOpen: InformationAcquisitionRequest;
  readonly infoRequestFulfilled: InformationAcquisitionRequest;
  readonly bridge: {
    readonly registrationId: string;
    readonly infoRequest: SealedOutboundRequest;
    readonly infoDispatch: OutboundDispatchOutcome;
    readonly answerEvent: SealedExternalEvent;
    readonly answerIntake: IntakeOutcome;
    readonly observationEvent: SealedExternalEvent;
    readonly observationIntake: IntakeOutcome;
    readonly observationProposal: SealedObservationIntakeProposal;
    readonly alertRequest: SealedOutboundRequest;
    readonly alertDispatch: OutboundDispatchOutcome;
    readonly eventDiscriminators: readonly string[];
    readonly deliveredRequestCount: number;
  };
  // -- Observe (the delivery authority path).
  readonly deliveryMid: SealedDeliveryRecord;
  readonly delivery: SealedDeliveryRecord;
  readonly deliveryDigestChain: readonly string[];
  // -- Supervision pass 1 (the missed milestone).
  readonly pass1: SealedSupervisionPass;
  readonly supervisionState1: SupervisionStateProjection;
  // -- Alerts (raise -> notify -> escalate -> notify).
  readonly alertPolicy: SealedEscalationPolicy;
  readonly alertChains: readonly (readonly SealedAlertRecord[])[];
  readonly alerts: readonly SealedAlertRecord[];
  readonly notifications: readonly SealedNotificationRecord[];
  readonly notificationReceipts: readonly NotificationReceipt[];
  readonly escalationPlan: EscalationPlan;
  readonly escalationProposal: ActionProposal;
  readonly escalationOutcome: SealedEscalationOutcome;
  readonly escalatedAlert: SealedAlertRecord;
  readonly alertFold: AlertChainFold;
  // -- Actualize / Verify / Variance.
  readonly actualization: ActualizationStore;
  readonly assessments: readonly SealedValidationAssessment[];
  readonly actualizationEvents: readonly SealedActualizationEvent[];
  readonly variance: SealedVarianceRecord;
  readonly varianceLedger: VarianceLedger;
  readonly attribution: SealedAttributionRecord;
  readonly causes: readonly SealedAttributionRecord[];
  readonly evidence: EvidenceStoreType;
  readonly actuals: ReturnType<typeof foldDeliveryActuals>;
  readonly actualizationState: ActualizationStateProjection;
  readonly varianceSummary: readonly VarianceClassSummary[];
  readonly executionState: ExecutionStateProjection;
  // -- Supervision pass 2 (the automatic update).
  readonly pass2: SealedSupervisionPass;
  readonly supervisionState: SupervisionStateProjection;
  // -- Forecast / Close.
  readonly closedDelivery: SealedDeliveryRecord;
  // -- Learn.
  readonly outcome: SealedDistinctionRecord;
  readonly outcomeResidual: SealedDistinctionRecord;
  readonly comparisonFact: SealedComparisonFactInput;
  readonly comparisonFactResidual: SealedComparisonFactInput;
  readonly candidate: SealedOutcomeLearningCandidate;
  readonly candidateResidual: SealedOutcomeLearningCandidate;
  readonly foreignEvaluation: EligibilityEvaluation;
  readonly foreignDataset: SealedLearningDataset;
  readonly learningStore: LearningStore;
  readonly dataset: SealedLearningDataset;
  readonly proposal: SealedModelRevisionProposal;
  readonly revision: SealedModelRevision;
  readonly metricSet: SealedCalibrationMetricSet;
  readonly packView: PackLearningView;
  readonly learningState: LearningStateProjection;
  // -- The authorized projections (role-specific views + audited denial).
  readonly accessStore: AccessProjectionStore;
  readonly accessPolicyDigest: string;
  readonly accessEvaluations: readonly ProjectionEvaluation[];
  readonly accessAudits: readonly SealedProjectionAudit[];
  readonly accessProjections: readonly SealedAuthorizedProjection[];
  readonly accessState: AccessStateProjection;
  // -- The lifecycle graph (the 11-stage spine).
  readonly lifecycle: LifecycleGraph;
  // -- The evidence chain (four typed streams + the unified W010 log).
  readonly events: readonly EventContent[];
  readonly log: EventLog;
  readonly supervisionEvents: readonly SealedSupervisionEvent[];
  readonly learningEvents: readonly SealedLearningEvent[];
  readonly accessEvents: readonly SealedAccessProjectionEvent[];
}

// --------------------------------------------------------------------------------
// W009 helpers (REAL authorization decisions — never hand-rolled allows).
// --------------------------------------------------------------------------------

function allowContext(principalId: string): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId, status: 'active', authenticated: true }],
    memberships: [{ principalId, tenantId: TENANT }],
    knownTenants: [TENANT],
  };
}

/** One REAL W009 decision over an access-projection request. */
function accessDecision(
  principalId: string,
  action: 'view' | 'export' | 'share',
  resource: { resourceType: string; resourceId: string },
): { request: AuthorizationRequest; decision: AuthorizationDecisionRegistration } {
  const request: AuthorizationRequest = {
    schemaVersion: 1,
    principalId,
    actionKind: `access-projection.${action}`,
    resource: { ...resource, tenantId: TENANT },
  };
  const evaluated = need(evaluate(request, allowContext(principalId)), `W009 evaluate (${principalId} ${action})`);
  const sealed = need(sealAuthorizationDecision(evaluated), `W009 seal decision (${principalId} ${action})`);
  return { request, decision: sealed };
}

/** One REAL W009 gate pair for a bridge operation (the W042 seam). */
function bridgeGate(actionKind: string, resourceId: string): BridgeAuthorizationPair {
  const request: AuthorizationRequest = {
    schemaVersion: 1,
    principalId: BRIDGE_OPERATOR,
    actionKind,
    resource: { resourceType: 'external-event-bridge', resourceId, tenantId: TENANT },
    justification: 'delivery-to-learning fixture: bridged supervisor exchange',
  };
  const evaluated = need(evaluate(request, allowContext(BRIDGE_OPERATOR)), `W009 evaluate (${actionKind})`);
  return { request, decision: evaluated };
}

// --------------------------------------------------------------------------------
// The scenario runner.
// --------------------------------------------------------------------------------

export function runDeliveryLearningScenario(): DeliveryLearningScenario {
  // == Stage 1 — Understand: the pack profile + existing conditions ========
  const profile = constructionPackProfile(TENANT);
  const admittedProfile = need(admitConstructionPackProfile(profile), 'admit construction pack profile');
  const packProfileDigest = digestPackProfile(admittedProfile);
  const existingConditions = need(sealDistinctionRecord(existingConditionsContent()), 'seal existing conditions');

  // == Stage 2 — Decide: alternatives + evaluation + baseline approval ======
  const solution = need(sealSolutionVersion(solutionContent()), 'seal solution version');
  need(admitSolutionVersion([], solution), 'admit solution version');
  const alternativeSolution = need(sealSolutionVersion(alternativeSolutionContent()), 'seal alternative solution');
  need(admitSolutionVersion([], alternativeSolution), 'admit alternative solution');
  const evaluation = evaluateAlternatives(solution, alternativeSolution);
  if (evaluation.winnerId !== SOLUTION_ID) {
    throw new Error('delivery-learning scenario: the fixture expects the steel-frame alternative to win the evaluation');
  }
  const approvalOutcome = need(
    approveSolutionBaseline(solution, {
      schema: 'epoch.solution-delivery.baseline-approval',
      schemaVersion: 1,
      approvalId: 'approval:warehouse-baseline-v1',
      solutionId: SOLUTION_ID,
      tenantId: TENANT,
      version: solution.version,
      baselineDigest: solution.contentDigest,
      approvedBy: APPROVER,
      approvedAt: T[3],
      decisionNote: `approved after deterministic evaluation of ${solution.solutionId} (${evaluation.primaryTotal} EUR) against ${alternativeSolution.solutionId} (${evaluation.alternativeTotal} EUR)`,
    }),
    'approve solution baseline',
  );
  const approval = approvalOutcome.approval;

  // == Stage 3 — Plan: the baseline program + live schedules ================
  const program = need(
    buildProgramOfWork(
      programContent({ milestoneStatus: 'planned', foundationProgress: 0, foundationFinish: undefined, gatePassedAt: undefined }, solution),
    ),
    'build baseline program of work',
  );
  const programLive1 = need(
    buildProgramOfWork(
      programContent({ milestoneStatus: 'missed', foundationProgress: 0.5, foundationFinish: undefined, gatePassedAt: undefined }, solution),
    ),
    'build live program (missed milestone)',
  );
  const programLive2 = need(
    buildProgramOfWork(
      programContent({ milestoneStatus: 'reached', foundationProgress: 1, foundationFinish: T[10], gatePassedAt: T[10] }, solution),
    ),
    'build live program (reached milestone)',
  );

  // == Stage 4 — the W041 access policy (sealed early: the bridge cites it) =
  const clientProgramAllowlist = [
    'contentDigest',
    'milestones[].evidence[].digest',
    'milestones[].milestoneId',
    'milestones[].status',
    'milestones[].title',
    'programId',
    'schema',
    'schemaVersion',
    'solutionId',
    'solutionVersion',
    'solutionVersionDigest',
    'tenantId',
    'title',
    'workPackages[].activities[].actualProgress',
    'workPackages[].activities[].activityId',
    'workPackages[].activities[].evidence[].digest',
    'workPackages[].activities[].title',
    'workPackages[].realizationVariant',
    'workPackages[].title',
    'workPackages[].workPackageId',
  ];
  const engineerProgramAllowlist = [
    ...clientProgramAllowlist,
    'createdAt',
    'createdBy',
    'milestones[].reachedAt',
    'milestones[].targetDate',
    'workPackages[].activities[].actualFinish',
    'workPackages[].activities[].actualStart',
    'workPackages[].activities[].plannedCost.amount',
    'workPackages[].activities[].plannedCost.currency',
    'workPackages[].activities[].plannedFinish',
    'workPackages[].activities[].plannedQuantity.unit',
    'workPackages[].activities[].plannedQuantity.value',
    'workPackages[].activities[].plannedStart',
    'workPackages[].approvals[].approvedAt',
    'workPackages[].approvals[].approvedBy',
    'workPackages[].plannedFinish',
    'workPackages[].plannedStart',
    'workPackages[].verificationGates[].criteria',
    'workPackages[].verificationGates[].gateId',
    'workPackages[].verificationGates[].method',
    'workPackages[].verificationGates[].passedAt',
    'workPackages[].verificationGates[].passedBy',
    'workPackages[].verificationGates[].title',
    'workPackages[].worldEntityId',
  ];
  const engineerDeliveryAllowlist = [
    'acceptedObservationIds[]',
    'actuals[].contentDigest',
    'actuals[].kind',
    'actuals[].measure.kind',
    'actuals[].measure.unit',
    'actuals[].measure.value',
    'actuals[].payload.actualizedAt',
    'actuals[].payload.actualizedBy',
    'actuals[].payload.derivedFromObservationId',
    'actuals[].recordId',
    'closedAt',
    'closedBy',
    'contentDigest',
    'deliveryId',
    'openedAt',
    'openedBy',
    'observations[].contentDigest',
    'observations[].kind',
    'observations[].measure.kind',
    'observations[].measure.unit',
    'observations[].measure.value',
    'observations[].payload.deliveryId',
    'observations[].payload.observedAt',
    'observations[].payload.observedBy',
    'observations[].recordId',
    'observations[].subject.subjectId',
    'observations[].subject.subjectKind',
    'rejectedObservationIds[]',
    'schema',
    'schemaVersion',
    'solutionId',
    'solutionVersion',
    'solutionVersionDigest',
    'status',
    'tenantId',
  ];
  const accessPolicy = need(
    sealProjectionPolicy({
      schema: 'epoch.access-projection.policy',
      schemaVersion: 1,
      policyId: ACCESS_POLICY_ID,
      revision: 1,
      tenantId: TENANT,
      title: 'Warehouse delivery access policy',
      status: 'active',
      bindings: [
        {
          selector: { principalKind: 'human', role: ROLE_CLIENT },
          objectClass: 'program-of-work',
          allowedActions: ['view'],
          fieldAllowlist: [...clientProgramAllowlist].sort(),
          redactionRules: [
            { fieldPath: 'workPackages[].activities[].plannedCost', redactionClass: 'commercial-sensitive' },
          ],
          defaultRedactionClass: 'policy-scoped',
          scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
        },
        {
          selector: { principalKind: 'human', role: ROLE_ENGINEER },
          objectClass: 'delivery-record',
          allowedActions: ['export', 'share', 'view'],
          fieldAllowlist: [...engineerDeliveryAllowlist].sort(),
          redactionRules: [],
          defaultRedactionClass: 'policy-scoped',
          scopeFilters: { evidence: { mode: 'all' }, commercial: 'visible', supplier: 'hidden' },
        },
        {
          selector: { principalKind: 'human', role: ROLE_ENGINEER },
          objectClass: 'program-of-work',
          allowedActions: ['export', 'view'],
          fieldAllowlist: [...engineerProgramAllowlist].sort(),
          redactionRules: [],
          defaultRedactionClass: 'policy-scoped',
          scopeFilters: { evidence: { mode: 'all' }, commercial: 'visible', supplier: 'hidden' },
        },
      ],
    }),
    'seal access projection policy',
  );
  let accessStore = need(openAccessProjectionStore({ tenantId: TENANT }), 'open access projection store');
  accessStore = need(admitProjectionPolicy(accessStore, accessPolicy), 'admit access projection policy').store;
  const accessPolicyDigest = accessPolicy.contentDigest;

  // == Stage 5 — the supervisor request + the mocked Aurum legs =============
  const infoRequestOpen = need(
    admitInformationAcquisitionRequest({
      schema: 'epoch.solution-delivery.info-request',
      schemaVersion: 1,
      requestId: INFO_REQUEST_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      requestedInformation: 'Confirm the foundations completion status against the programme milestone',
      decisionImpact: {
        stage: 'realize',
        decisionKind: 'verification-result',
        materiality: 'material',
        rationale: 'the foundations milestone verification depends on the completion status',
      },
      freshnessRequirement: { state: 'aging', assessedAt: T[5] },
      requestedFrom: SUPERVISOR,
      issuedAt: T[5],
      issuedBy: PRINCIPAL,
      status: 'open',
    }),
    'admit supervisor info request (open)',
  );

  const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT });
  const chat = new ChatReferenceProvider({ deliveryScript: SUCCESS_DELIVERY_SCRIPT });
  const registration = need(
    runtime.registerProvider({
      provider: chat,
      tenantId: TENANT,
      registeredAt: T[3],
      registeredBy: BRIDGE_OPERATOR,
      authorization: bridgeGate('bridge.provider-registration', 'registration:external-chat-reference'),
    }),
    'register mocked Aurum chat provider',
  );

  const bridgeProjection = {
    policyDigest: accessPolicyDigest,
    recipientRef: 'role:site-supervisor',
    fieldAllowlist: ['requestRef', 'statusSummary'],
  };
  const infoRequest = need(
    buildOutboundRequest(
      {
        requestId: OUTBOUND_INFO_REQUEST_ID,
        tenantId: TENANT,
        requestClass: 'information',
        recipientRef: 'role:site-supervisor',
        correlationId: BRIDGE_INFO_CORRELATION_ID,
        causationId: null,
        createdAt: T[5],
        createdBy: BRIDGE_OPERATOR,
        idempotencyKey: 'idem:progress-confirmation-request',
        rawPayload: {
          requestRef: INFO_REQUEST_ID,
          statusSummary: 'Foundations milestone overdue; confirm completion status',
          internalCommercialNote: 'penalty threshold consideration',
        },
      },
      bridgeProjection,
    ),
    'build outbound information request',
  );
  const infoDispatch = need(
    runtime.dispatchOutboundRequest({
      request: infoRequest,
      projection: bridgeProjection,
      retryPolicy: { attemptInstants: [T[5]] },
      detectedAt: T[5],
      authorization: bridgeGate('bridge.request-dispatch', OUTBOUND_INFO_REQUEST_ID),
    }),
    'dispatch outbound information request',
  );
  if (infoDispatch.kind !== 'delivered') {
    throw new Error(`delivery-learning scenario: information dispatch concluded "${infoDispatch.kind}"`);
  }

  // == Stage 6 — Realize: the execution tracking store over the program ====
  const programIndex = need(buildProgramIndex(program), 'build program index');
  let tracking = need(
    openExecutionTrackingStore({ tenantId: TENANT, solutionId: SOLUTION_ID, programIndex }),
    'open execution tracking store',
  );
  const intake = need(intakeFieldObservation(tracking, fieldCapture()), 'intake field observation');
  tracking = intake.store;
  const fieldObservation = intake.observation.record;
  const issue = need(admitIssue(tracking, need(sealIssueRecord(issueContent()), 'seal issue record')), 'admit issue').record;
  const trackingState = need(
    admitTrackingState(
      tracking,
      need(
        sealTrackingStateRecord({
          schema: 'epoch.execution-tracking.tracking-state',
          schemaVersion: 1,
          recordId: 'state:substructure-in-progress',
          tenantId: TENANT,
          solutionId: SOLUTION_ID,
          subject: { workPackageId: WORK_PACKAGE_SUBSTRUCTURE },
          fromState: 'not-started',
          toState: 'in-progress',
          cause: 'excavation complete; foundations pour under way',
          note: 'Excavation to formation complete; foundation concrete at 50 percent',
          observedAt: T[6],
          recordedAt: T[6],
          recordedBy: PRINCIPAL,
          evidenceLinks: [],
          uncertainty: uncertainty(),
        }),
        'seal tracking state record',
      ),
    ),
    'admit tracking state',
  );
  tracking = trackingState.store;

  // == Stage 7 — the delivery record + the Aurum-supplied observation =======
  let delivery = need(
    openDeliveryRecord({
      schema: 'epoch.solution-delivery.delivery-record',
      schemaVersion: 1,
      deliveryId: DELIVERY_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      solutionVersion: solution.version,
      solutionVersionDigest: solution.contentDigest,
      openedAt: T[3],
      openedBy: PRINCIPAL,
      status: 'open',
      observations: [],
      acceptedObservationIds: [],
      rejectedObservationIds: [],
      actuals: [],
    }),
    'open delivery record',
  );
  const deliveryDigestChain: string[] = [delivery.contentDigest];

  const recordedField = need(recordObservation(delivery, fieldObservation), 'record field observation');
  delivery = recordedField;
  deliveryDigestChain.push(delivery.contentDigest);

  // The INBOUND Aurum observation (the goods receipt reported through chat):
  // the bridge PROPOSES; the W036 authority seals.
  const observationEvent = need(
    adaptInboundMessage(
      referenceProviderMessage({
        kind: 'observation',
        text: 'Steel delivery received at the gate: 4 tonne of S355 sections counted and staged for erection.',
      }),
      {
        eventId: BRIDGE_OBSERVATION_EVENT_ID,
        tenantId: TENANT,
        correlationId: BRIDGE_INFO_CORRELATION_ID,
        causationId: OUTBOUND_INFO_REQUEST_ID,
        occurredAt: T[9],
        idempotencyKey: 'idem:steel-receipt-observation',
        confidence: { method: 'stated', value: 0.8 },
        reportedBy: BRIDGE_OPERATOR,
      },
    ),
    'adapt Aurum observation message',
  );
  const observationIntake = need(
    runtime.intakeExternalEvent({
      event: observationEvent,
      observationContext: {
        proposalId: 'intake:steel-receipt-external',
        recordId: AURUM_OBSERVATION_ID,
        subject: { solutionId: SOLUTION_ID, subjectKind: 'work-package', subjectId: WORK_PACKAGE_SUPERSTRUCTURE },
        measure: { kind: 'quantity', value: '4', unit: 'tonne' },
        payload: {
          deliveryId: DELIVERY_ID,
          observedAt: T[9],
          observedBy: OBSERVER,
          evidence: [{ digest: observationEvent.source.providerPayloadDigest }],
        },
        recordedAt: T[9],
        recordedBy: OBSERVER,
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'reported', sourceRef: 'source:external-event-bridge', actor: BRIDGE_OPERATOR },
          freshness: { state: 'fresh', assessedAt: T[4] },
          confidence: { method: 'imported', value: 0.8, rationale: 'reported through the external event bridge' },
        },
        proposedAt: T[9],
        proposedBy: BRIDGE_OPERATOR,
      },
      receivedAt: T[9],
      authorization: bridgeGate('bridge.event-intake', BRIDGE_OBSERVATION_EVENT_ID),
    }),
    'intake Aurum observation event',
  );
  const observationProposal = observationIntake.proposal as SealedObservationIntakeProposal;
  const aurumObservation = need(
    sealDistinctionRecord(observationProposal.observation as unknown as Record<string, unknown>),
    'seal Aurum observation through the W036 authority',
  );
  const recordedAurum = need(recordObservation(delivery, aurumObservation), 'record Aurum observation');
  delivery = recordedAurum;
  deliveryDigestChain.push(delivery.contentDigest);
  const deliveryMid = delivery;

  // == Stage 8 — the procurement chain + fulfillment ========================
  const acquisitionRequest = need(admitAcquisitionRequest(acquisitionRequestContent()), 'admit acquisition request');
  const pkg = need(sealAcquisitionPackage(packageContent(acquisitionRequest)), 'seal acquisition package');
  const packages = need(admitAcquisitionPackage([acquisitionRequest], emptyPackageStore(), pkg), 'admit acquisition package');
  const packageDigest = packages.packages[0]!.contentDigest;
  const quote = need(sealQuote(quoteContent(packageDigest)), 'seal quote');
  const quotes: QuoteStore = need(admitQuote(packages, emptyQuoteStore(), quote), 'admit quote');
  const quoteDigest = quotes.quotes[0]!.contentDigest;
  const selection = need(sealQuoteSelection(selectionContent(packageDigest, quoteDigest)), 'seal quote selection');
  const selections = need(admitQuoteSelection(packages, quotes, emptySelectionStore(), selection), 'admit quote selection');
  const commitment = need(
    sealProcurementCommitment({
      recordId: COMMITMENT_ID,
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      quote: quotes.quotes[0]!,
      acquisitionId: ACQUISITION_ID,
      committedBy: PROCUREMENT,
      committedAt: T[5],
      recordedAt: T[5],
      uncertainty: uncertainty({ provenance: { kind: 'observed', sourceRef: 'source:purchase-commitment', actor: PROCUREMENT } }) as never,
    }),
    'seal procurement commitment',
  );
  const po = need(
    sealPurchaseOrder(
      purchaseOrderContent(packageDigest, selections.selections[0]!.contentDigest, commitment.contentDigest, quote.lines),
    ),
    'seal purchase order',
  );
  const orders = need(
    admitPurchaseOrder(packages, quotes, selections, [commitment], emptyPurchaseOrderStore(), po),
    'admit purchase order',
  );

  let supplierDelivery = emptyDeliveryLog(PO_ID, TENANT);
  const poVersionDigest = orders.orders[0]!.contentDigest;
  supplierDelivery = need(
    appendSupplierDeliveryTransition(
      orders,
      [aurumObservation],
      supplierDelivery,
      need(
        sealSupplierDeliveryTransition({
          schema: 'epoch.procurement.supplier-delivery-transition',
          schemaVersion: 1,
          transitionId: 'po-transition:steel-confirmed',
          tenantId: TENANT,
          poId: PO_ID,
          poVersionDigest,
          from: 'ordered',
          to: 'confirmed',
          occurredAt: T[7],
          recordedBy: PROCUREMENT,
        }),
        'seal supplier transition (confirmed)',
      ),
    ),
    'append supplier delivery transition (confirmed)',
  );
  supplierDelivery = need(
    appendSupplierDeliveryTransition(
      orders,
      [aurumObservation],
      supplierDelivery,
      need(
        sealSupplierDeliveryTransition({
          schema: 'epoch.procurement.supplier-delivery-transition',
          schemaVersion: 1,
          transitionId: 'po-transition:steel-shipped',
          tenantId: TENANT,
          poId: PO_ID,
          poVersionDigest,
          from: 'confirmed',
          to: 'shipped',
          occurredAt: T[8],
          recordedBy: PROCUREMENT,
        }),
        'seal supplier transition (shipped)',
      ),
    ),
    'append supplier delivery transition (shipped)',
  );
  supplierDelivery = need(
    appendSupplierDeliveryTransition(
      orders,
      [aurumObservation],
      supplierDelivery,
      need(
        sealSupplierDeliveryTransition({
          schema: 'epoch.procurement.supplier-delivery-transition',
          schemaVersion: 1,
          transitionId: 'po-transition:steel-received',
          tenantId: TENANT,
          poId: PO_ID,
          poVersionDigest,
          from: 'shipped',
          to: 'received',
          receipt: {
            observationRef: { recordId: AURUM_OBSERVATION_ID, contentDigest: aurumObservation.contentDigest },
            lines: [{ description: 'Structural steel sections grade S355', quantity: '4', unit: 'tonne' }],
            receivedAt: T[9],
            receivedBy: OBSERVER,
            note: 'Full delivery received at the gate (reported through the external event bridge)',
          },
          occurredAt: T[9],
          recordedBy: OBSERVER,
        }),
        'seal supplier transition (received)',
      ),
    ),
    'append supplier delivery transition (received)',
  );
  const acquisitionFulfillments = need(
    admitAcquisitionFulfillment([acquisitionRequest], [], {
      schema: 'epoch.solution-delivery.acquisition-fulfillment',
      schemaVersion: 1,
      fulfillmentId: FULFILLMENT_ID,
      tenantId: TENANT,
      acquisitionId: ACQUISITION_ID,
      fulfilledAt: T[9],
      fulfilledBy: OBSERVER,
      externalReference: PO_ID,
      note: 'Steel received against the purchase order; the goods receipt is the bridged observation',
    }),
    'admit acquisition fulfillment',
  );

  // == Stage 9 — the distinction ledger (the four-way distinction) ==========
  const baselineRecord = need(sealDistinctionRecord(baselineRecordContent(solution)), 'seal baseline record');
  const commitmentRecord = need(sealDistinctionRecord(commitmentRecordContent()), 'seal commitment record');
  const forecastR1 = need(sealDistinctionRecord(forecastContent(FORECAST_R1_ID, '122', T[7], null)), 'seal forecast r1');
  const forecastR2 = need(
    sealDistinctionRecord(forecastContent(FORECAST_R2_ID, '119', T[8], FORECAST_R1_ID)),
    'seal forecast r2',
  );
  let ledger: DistinctionLedger = {
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    records: [],
  };
  for (const record of [existingConditions, baselineRecord, commitmentRecord, forecastR1, forecastR2]) {
    ledger = need(admitDistinctionRecord(ledger, record), `admit distinction record ${record.recordId}`);
  }

  // == Stage 10 — supervision pass 1 (the missed milestone) =================
  const alertPolicy = need(
    admitEscalationPolicy({
      schema: 'epoch.alerts.escalation-policy',
      schemaVersion: 1,
      policyId: ALERT_POLICY_ID,
      tenantId: TENANT,
      policyVersion: '1.0.0',
      title: 'Delivery supervision escalation policy',
      defaultSeverity: 'warning',
      defaultEscalation: {
        notify: [{ targetKind: 'role', targetRef: 'role:delivery-supervisor' }],
        escalationDelaySeconds: '1800',
        reNotifyCadenceSeconds: '43200',
        escalateTo: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
      },
      rules: [
        {
          ruleId: 'rule:late-planned-vs-actual',
          findingClass: 'planned-vs-actual',
          findingStatus: 'late',
          severity: 'major',
          escalation: {
            notify: [{ targetKind: 'role', targetRef: 'role:delivery-supervisor' }],
            escalationDelaySeconds: '900',
            reNotifyCadenceSeconds: '21600',
            escalateTo: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
          },
        },
        {
          ruleId: 'rule:unresolved-unknowns',
          findingClass: 'unresolved-unknown',
          severity: 'info',
          escalation: {
            notify: [{ targetKind: 'role', targetRef: 'role:delivery-supervisor' }],
            escalationDelaySeconds: '3600',
            reNotifyCadenceSeconds: '86400',
            escalateTo: [],
          },
        },
      ],
      activatedAt: T[3],
      activatedBy: PRINCIPAL,
    }),
    'admit escalation policy',
  );

  const executionIssueSummary = {
    schema: 'epoch.supervision.execution-issue-summary',
    schemaVersion: 1,
    recordId: ISSUE_ID,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    issueKind: 'change',
    severity: 'moderate',
    resolutionState: 'open',
    impact: { workPackageIds: [WORK_PACKAGE_SUBSTRUCTURE], activityIds: [ACTIVITY_EXCAVATION], milestoneIds: [] },
    raisedAt: T[4],
    contentDigest: issue.contentDigest,
  } as const;

  const pass1 = need(
    evaluateSupervisionPass({
      passId: PASS_1_ID,
      tenantId: TENANT,
      evaluatedAt: T[9],
      evaluatedBy: PRINCIPAL,
      program: programLive1,
      delivery: deliveryMid,
      thresholds: DEFAULT_SUPERVISION_THRESHOLDS,
      executionIssues: [executionIssueSummary],
      leadTimeInputs: [],
      infoRequests: [infoRequestOpen],
    }),
    'evaluate supervision pass 1',
  );
  const supervisionState1 = projectSupervisionState([pass1]);

  // == Stage 11 — alerts: raise -> notify -> escalate -> notify =============
  const alertIds: Readonly<Record<string, string>> = {
    'finding:critical-path-drift-activity-activity-foundation-concrete': ALERT_CRITICAL_ID,
    'finding:planned-vs-actual-activity-activity-foundation-concrete': ALERT_ACTIVITY_ID,
    'finding:planned-vs-actual-milestone-milestone-foundations': ALERT_MILESTONE_ID,
    'finding:unresolved-unknown-info-request-info-request-foundations': ALERT_UNKNOWN_ID,
    'finding:verification-failure-gate-gate-formation-inspection': ALERT_GATE_ID,
  };
  const notificationIds: Readonly<Record<string, string>> = {
    [ALERT_ACTIVITY_ID]: 'notification:foundation-concrete-late',
    [ALERT_CRITICAL_ID]: 'notification:foundation-concrete-critical-drift',
    [ALERT_MILESTONE_ID]: 'notification:foundations-milestone-missed',
    [ALERT_UNKNOWN_ID]: 'notification:progress-confirmation-unknown',
    [ALERT_GATE_ID]: 'notification:formation-gate-overdue',
  };
  const chains: SealedAlertRecord[][] = [];
  const notifications: SealedNotificationRecord[] = [];
  const port = new InMemoryNotificationAdapter();
  const receipts: NotificationReceipt[] = [];
  for (const finding of pass1.findings) {
    const alertId = alertIds[finding.findingId];
    if (alertId === undefined) {
      throw new Error(`delivery-learning scenario: unmapped finding "${finding.findingId}"`);
    }
    const raised = need(
      raiseAlert([], {
        alertId,
        tenantId: TENANT,
        summary: {
          findingId: finding.findingId,
          findingDigest: finding.contentDigest,
          findingClass: finding.findingClass,
          findingStatus: finding.status,
          subjectKind: finding.subject.subjectKind,
          subjectId: finding.subject.subjectId,
          title: finding.title,
          detectedAt: pass1.evaluatedAt,
        },
        policy: alertPolicy,
        raisedAt: T[9],
        raisedBy: PRINCIPAL,
      }),
      `raise alert ${alertId}`,
    );
    if (raised.admission !== 'raised') {
      throw new Error(`delivery-learning scenario: alert ${alertId} admission "${raised.admission}"`);
    }
    chains.push([raised.alert]);
    const notification = need(
      buildNotification({
        notificationId: notificationIds[alertId]!,
        alert: raised.alert,
        channelKind: 'in-app',
        targets: resolvePolicyRule(alertPolicy, finding.findingClass, finding.status).escalation.notify,
        title: raised.alert.title,
        body: `alert ${alertId} (severity ${raised.alert.severity}) on finding ${finding.findingId} [${finding.findingClass}/${finding.status}]: ${finding.detail}`,
        dispatchedAt: T[9],
        dispatchedBy: PRINCIPAL,
      }),
      `build notification ${notificationIds[alertId]}`,
    );
    notifications.push(notification);
    receipts.push(need(port.dispatch({ notification, dispatchedAt: T[9], dispatchedBy: PRINCIPAL }), `dispatch notification ${notificationIds[alertId]}`));
  }

  // The escalation of the missed-milestone alert (W003 proposal -> REAL
  // Action Gateway decision -> dispatched outcome -> escalated revision).
  const milestoneChainIndex = chains.findIndex((chain) => chain[0]!.alertId === ALERT_MILESTONE_ID);
  const milestoneAlert = chains[milestoneChainIndex]![0]!;
  const escalationPlan = planEscalation({
    alert: milestoneAlert,
    delaySeconds: '900',
    reNotifyCadenceSeconds: '21600',
    notify: [{ targetKind: 'role', targetRef: 'role:delivery-supervisor' }],
    escalateTo: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
  });
  const escalationProposal = need(
    buildEscalationProposal({
      alert: milestoneAlert,
      plan: escalationPlan,
      proposalId: ESCALATION_PROPOSAL_ID,
      messageId: ESCALATION_PROPOSAL_MESSAGE_ID,
      proposedBy: 'agent:supervision-runtime',
      createdAt: T[11],
      rationale: 'the missed foundations milestone needs program-manager attention before steel erection',
    }),
    'build escalation proposal',
  );
  const escalationDecision: AuthorizationDecision = {
    protocolVersion: '1.0.0',
    messageKind: 'action.authorization-decision',
    messageId: ESCALATION_DECISION_MESSAGE_ID,
    createdAt: T[11],
    requestId: ESCALATION_REQUEST_ID,
    proposalRef: { proposalId: escalationProposal.proposalId, canonicalDigest: computeProposalDigest(escalationProposal) },
    decidedBy: { id: 'gateway:action-gateway', role: 'action-gateway' },
    decision: { kind: 'authorized', conditions: [] },
  };
  const escalationOutcome = need(
    recordEscalationOutcome({
      outcomeId: ESCALATION_OUTCOME_ID,
      tenantId: TENANT,
      alert: milestoneAlert,
      proposal: escalationProposal,
      decision: escalationDecision,
      escalationLevel: escalationPlan.escalationLevel,
      recordedAt: T[11],
      recordedBy: PRINCIPAL,
    }),
    'record escalation outcome',
  );
  if (escalationOutcome.outcomeKind !== 'dispatched') {
    throw new Error(`delivery-learning scenario: escalation outcome "${escalationOutcome.outcomeKind}"`);
  }
  const escalatedAlert = need(
    escalateAlert(chains[milestoneChainIndex]!, { escalatedAt: T[11], escalationLevel: escalationOutcome.escalationLevel }),
    'escalate the milestone alert',
  );
  chains[milestoneChainIndex] = [...chains[milestoneChainIndex]!, escalatedAlert];
  const escalationNotification = need(
    buildNotification({
      notificationId: ESCALATION_NOTIFICATION_ID,
      alert: escalatedAlert,
      channelKind: 'in-app',
      targets: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
      title: escalatedAlert.title,
      body: `alert ${ALERT_MILESTONE_ID} escalated to level ${escalatedAlert.escalationLevel} (severity ${escalatedAlert.severity}); the program manager is now on the escalation path`,
      dispatchedAt: T[11],
      dispatchedBy: PRINCIPAL,
    }),
    'build escalation notification',
  );
  notifications.push(escalationNotification);
  receipts.push(
    need(port.dispatch({ notification: escalationNotification, dispatchedAt: T[11], dispatchedBy: PRINCIPAL }), 'dispatch escalation notification'),
  );

  // The OUTBOUND alert to the mocked Aurum provider (alert propagation
  // across the bridge, behind the W041-cited least-privilege projection).
  const alertBridgeProjection = {
    policyDigest: accessPolicyDigest,
    recipientRef: 'role:site-supervisor',
    fieldAllowlist: ['alertRef', 'severitySummary'],
  };
  const alertRequest = need(
    buildOutboundRequest(
      {
        requestId: BRIDGE_ALERT_REQUEST_ID,
        tenantId: TENANT,
        requestClass: 'alert',
        recipientRef: 'role:site-supervisor',
        correlationId: BRIDGE_ALERT_CORRELATION_ID,
        causationId: OUTBOUND_INFO_REQUEST_ID,
        createdAt: T[11],
        createdBy: BRIDGE_OPERATOR,
        idempotencyKey: 'idem:foundations-milestone-alert',
        rawPayload: {
          alertRef: ALERT_MILESTONE_ID,
          severitySummary: `severity ${escalatedAlert.severity}, escalation level ${escalatedAlert.escalationLevel}`,
          internalCommercialNote: 'penalty clause review pending',
        },
      },
      alertBridgeProjection,
    ),
    'build outbound alert request',
  );
  const alertDispatch = need(
    runtime.dispatchOutboundRequest({
      request: alertRequest,
      projection: alertBridgeProjection,
      retryPolicy: { attemptInstants: [T[11]] },
      detectedAt: T[11],
      authorization: bridgeGate('bridge.request-dispatch', BRIDGE_ALERT_REQUEST_ID),
    }),
    'dispatch outbound alert request',
  );
  if (alertDispatch.kind !== 'delivered') {
    throw new Error(`delivery-learning scenario: alert dispatch concluded "${alertDispatch.kind}"`);
  }

  // == Stage 12 — Observe/Actualize: validation + the actualization fold ====
  let actualization = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
  const actualizationEvents: SealedActualizationEvent[] = [];
  let actualizationSequence = 0;
  const emitActualizationEvent = (discriminator: string, data: Record<string, unknown>, occurredAt: string): void => {
    actualizationSequence += 1;
    const sealed = need(
      sealActualizationEvent({
        schemaVersion: 1,
        streamId: ACTUALIZATION_STREAM_ID,
        sequence: actualizationSequence,
        tenantId: TENANT,
        actor: PRINCIPAL,
        causalParent: actualizationSequence === 1 ? null : { streamId: ACTUALIZATION_STREAM_ID, sequence: actualizationSequence - 1 },
        payload: { discriminator, data },
        occurredAt,
      }),
      `seal actualization event ${actualizationSequence}`,
    );
    need(verifySealedActualizationEvent(sealed), `verify actualization event ${actualizationSequence}`);
    actualizationEvents.push(sealed);
  };

  const intakenField = need(intakeObservation(actualization, fieldObservation), 'intake field observation (actualization)');
  actualization = intakenField.store;
  emitActualizationEvent(
    'actualization:observation-intaken',
    { deliveryId: DELIVERY_ID, observationId: FIELD_OBSERVATION_ID, subjectKind: 'activity', measureKind: 'quantity', admission: intakenField.admission.kind, intakenAt: T[10] },
    T[10],
  );
  const intakenAurum = need(intakeObservation(actualization, aurumObservation), 'intake Aurum observation (actualization)');
  actualization = intakenAurum.store;
  emitActualizationEvent(
    'actualization:observation-intaken',
    { deliveryId: DELIVERY_ID, observationId: AURUM_OBSERVATION_ID, subjectKind: 'work-package', measureKind: 'quantity', admission: intakenAurum.admission.kind, intakenAt: T[10] },
    T[10],
  );

  const policy = { mode: 'exact' as const };
  const assessments = need(currentAssessments(actualization, policy), 'current assessments');
  for (const assessment of [...assessments].sort((a, b) => (a.assessmentId < b.assessmentId ? -1 : 1))) {
    emitActualizationEvent(
      'actualization:validation-assessed',
      {
        deliveryId: DELIVERY_ID,
        assessmentId: assessment.assessmentId,
        state: assessment.state,
        observationCount: assessment.observationRefs.length,
        measureKind: assessment.measureKind,
        deviationMagnitude: assessment.deviationMagnitude,
        assessedAt: T[10],
      },
      T[10],
    );
  }
  for (const assessment of [...assessments].sort((a, b) => (a.assessmentId < b.assessmentId ? -1 : 1))) {
    const observations = assessment.observationRefs.map((ref) =>
      actualization.observations.find((observation) => observation.recordId === ref.recordId)!,
    );
    const applied = need(
      applyActualization(delivery, assessment, observations, {
        acceptedBy: APPROVER,
        acceptedAt: T[10],
        actualizedBy: PRINCIPAL,
        actualizedAt: T[10],
      }),
      `apply actualization (${assessment.assessmentId})`,
    );
    delivery = applied.delivery;
    deliveryDigestChain.push(delivery.contentDigest);
    emitActualizationEvent(
      'actualization:actuals-minted',
      {
        deliveryId: DELIVERY_ID,
        assessmentId: assessment.assessmentId,
        mintedCount: applied.applications.filter((application) => application.outcome === 'actualized').length,
        alreadyMintedCount: applied.applications.filter((application) => application.outcome === 'already-actualized').length,
        deliveryDigest: delivery.contentDigest,
        actualizedAt: T[10],
      },
      T[10],
    );
  }
  need(verifySealedDeliveryRecord(delivery), 'verify post-actualization delivery record');

  // == Stage 13 — the supervisor's answer (the returned status) =============
  const answerEvent = need(
    adaptInboundMessage(
      referenceProviderMessage({
        kind: 'information-response',
        text: 'Foundations milestone remediated: the foundation pour completed and the formation inspection passed.',
      }),
      {
        eventId: BRIDGE_ANSWER_EVENT_ID,
        tenantId: TENANT,
        correlationId: BRIDGE_INFO_CORRELATION_ID,
        causationId: OUTBOUND_INFO_REQUEST_ID,
        occurredAt: T[10],
        idempotencyKey: 'idem:progress-confirmation-answer',
        confidence: { method: 'stated', value: 0.8 },
        reportedBy: BRIDGE_OPERATOR,
      },
    ),
    'adapt Aurum answer message',
  );
  const answerIntake = need(
    runtime.intakeExternalEvent({
      event: answerEvent,
      receivedAt: T[10],
      authorization: bridgeGate('bridge.event-intake', BRIDGE_ANSWER_EVENT_ID),
    }),
    'intake Aurum answer event',
  );
  const infoRequestFulfilled = need(
    admitInformationAcquisitionRequest({
      schema: 'epoch.solution-delivery.info-request',
      schemaVersion: 1,
      requestId: INFO_REQUEST_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      requestedInformation: 'Confirm the foundations completion status against the programme milestone',
      decisionImpact: {
        stage: 'realize',
        decisionKind: 'verification-result',
        materiality: 'material',
        rationale: 'the foundations milestone verification depends on the completion status',
      },
      freshnessRequirement: { state: 'aging', assessedAt: T[5] },
      requestedFrom: SUPERVISOR,
      issuedAt: T[5],
      issuedBy: PRINCIPAL,
      status: 'fulfilled',
      fulfillment: {
        evidence: [{ digest: answerEvent.source.providerPayloadDigest }],
        fulfilledAt: T[10],
        fulfilledBy: SUPERVISOR,
        uncertainty: reportedUncertainty({
          provenance: { kind: 'reported', sourceRef: 'source:external-event-bridge', actor: SUPERVISOR },
        }),
      },
    }),
    'admit supervisor info request (fulfilled)',
  );

  // == Stage 14 — Verify: evidence + variance + attribution =================
  const evidence = EvidenceStore.create();
  const fieldArtifact = {
    note: 'field measurement of the excavated pit volume',
    observationId: FIELD_OBSERVATION_ID,
    value: '118.5',
    unit: 'm3',
  };
  const fieldEvidence = evidence.add({
    schemaVersion: 1,
    kind: 'measurement',
    subject: { artifactId: FIELD_OBSERVATION_ID, revision: '1', digest: canonicalDigest(fieldArtifact) },
    producedBy: { runId: 'run:field-monday', actorId: OBSERVER },
    observedAt: T[6],
    content: { mediaType: 'application/json', data: fieldArtifact },
    confidence: { distribution: { kind: 'interval', lower: 0.9, upper: 0.99, bias: 'none' }, method: 'measured' },
  });
  if (!fieldEvidence.ok) {
    throw new Error(`delivery-learning scenario: field evidence failed: ${JSON.stringify(fieldEvidence.issues)}`);
  }
  const formationArtifact = {
    note: 'formation level inspection certificate',
    gateId: GATE_FORMATION,
    passedAt: T[10],
    activityId: ACTIVITY_CONCRETE,
  };
  const formationEvidence = evidence.add({
    schemaVersion: 1,
    kind: 'assertion',
    subject: { artifactId: `gate:${GATE_FORMATION}`, revision: '1', digest: canonicalDigest(formationArtifact) },
    producedBy: { runId: 'run:formation-survey', actorId: SUPERVISOR },
    observedAt: T[10],
    content: { mediaType: 'application/json', data: formationArtifact },
    confidence: { distribution: { kind: 'interval', lower: 0.9, upper: 0.98, bias: 'none' }, method: 'measured' },
  });
  if (!formationEvidence.ok) {
    throw new Error(`delivery-learning scenario: formation evidence failed: ${JSON.stringify(formationEvidence.issues)}`);
  }

  const excavationActual = delivery.actuals.find((actual) => actual.recordId === FIELD_ACTUAL_ID);
  if (excavationActual === undefined) {
    throw new Error('delivery-learning scenario: excavation actual missing after the fold');
  }
  const variance = need(
    computeVariance({
      varianceId: VARIANCE_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_EXCAVATION,
      varianceClass: 'quantity',
      baselineRef: { kind: 'baseline', recordId: BASELINE_RECORD_ID, contentDigest: baselineRecord.contentDigest },
      actualRef: { kind: 'actual', recordId: FIELD_ACTUAL_ID, contentDigest: excavationActual.contentDigest },
      baselineMeasure: { kind: 'quantity', value: '120', unit: 'm3' },
      actualMeasure: { kind: 'quantity', value: '118.5', unit: 'm3' },
      evidence: [fieldEvidence.receipt.digest],
      confidence: { method: 'measured', value: 0.95, rationale: 'grounded in the accepted delivery actuals' },
      thresholds: { minor: '10', material: '100', severe: '1000' },
      computedAt: T[10],
      computedBy: PRINCIPAL,
    }),
    'compute variance',
  );
  let varianceLedger = openVarianceLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
  varianceLedger = need(admitVarianceRecord(varianceLedger, variance), 'admit variance record');

  const attribution = need(
    sealAttributionRecord({
      schema: 'epoch.variance.attribution-record',
      schemaVersion: 1,
      attributionId: ATTRIBUTION_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      varianceRef: { recordId: VARIANCE_ID, contentDigest: variance.contentDigest },
      cause: { causeKind: 'issue-record', recordId: ISSUE_ID, contentDigest: issue.contentDigest },
      evidence: [fieldEvidence.receipt.digest],
      note: 'the geometry revision changed the measured pit volume',
      attributedAt: T[10],
      attributedBy: PRINCIPAL,
    }),
    'seal attribution record',
  );
  const attributionLedger = need(
    admitAttributionRecord(openAttributionLedger({ tenantId: TENANT, solutionId: SOLUTION_ID }), foldVarianceRecords(varianceLedger), attribution),
    'admit attribution record',
  );
  const causes = causesOf(attributionLedger, VARIANCE_ID);

  // == Stage 15 — supervision pass 2 (the automatic update) ==================
  const pass2 = need(
    evaluateSupervisionPass({
      passId: PASS_2_ID,
      tenantId: TENANT,
      evaluatedAt: T[11],
      evaluatedBy: PRINCIPAL,
      program: programLive2,
      delivery,
      thresholds: DEFAULT_SUPERVISION_THRESHOLDS,
      executionIssues: [executionIssueSummary],
      leadTimeInputs: [],
      infoRequests: [infoRequestFulfilled],
    }),
    'evaluate supervision pass 2',
  );
  const supervisionState = projectSupervisionState([pass1, pass2]);

  // The alert resolutions (the findings are gone; the chains close).
  for (const [index, chain] of chains.entries()) {
    const resolved = need(
      resolveAlert(chain, { resolvedAt: T[11], resolvedBy: SUPERVISOR, resolutionKind: 'remediated' }),
      `resolve alert ${chain[0]!.alertId}`,
    );
    chains[index] = [...chain, resolved];
  }
  const alertFold = foldAlertChains(chains);

  // == Stage 16 — Forecast + Close ============================================
  const closedDelivery = need(closeDeliveryRecord(delivery, { closedBy: PRINCIPAL, closedAt: T[13] }), 'close delivery record');
  deliveryDigestChain.push(closedDelivery.contentDigest);

  // == Stage 17 — Learn: outcome + facts + dataset + revision =================
  const outcome = need(
    sealDistinctionRecord({
      ...outcomeContentBase(),
      payload: {
        outcomeKind: 'delivered',
        verificationRefs: [fieldEvidence.receipt.digest, formationEvidence.receipt.digest].sort(),
      },
    }),
    'seal outcome record',
  );
  const outcomeResidual = need(sealDistinctionRecord(outcomeResidualContent()), 'seal residual outcome record');
  const excavationAssessment = assessments.find((assessment) =>
    assessment.observationRefs.some((ref) => ref.recordId === FIELD_OBSERVATION_ID),
  );
  if (excavationAssessment === undefined) {
    throw new Error('delivery-learning scenario: excavation validation assessment missing');
  }

  const comparisonFact = need(
    sealComparisonFactInput(
      comparisonFactContent({
        factId: COMPARISON_FACT_ID,
        comparisonRefId: COMPARISON_REF_ID,
        forecastRecordId: FORECAST_R2_ID,
        forecastDigest: forecastR2.contentDigest,
        forecastValue: '119',
        actualRecordId: FIELD_ACTUAL_ID,
        actualDigest: excavationActual.contentDigest,
        deviation: '0.5',
        observedAt: T[10],
      }),
    ),
    'seal comparison fact (r2 vs actual)',
  );
  const comparisonFactResidual = need(
    sealComparisonFactInput(
      comparisonFactContent({
        factId: COMPARISON_FACT_RESIDUAL_ID,
        comparisonRefId: COMPARISON_REF_RESIDUAL_ID,
        forecastRecordId: FORECAST_R1_ID,
        forecastDigest: forecastR1.contentDigest,
        forecastValue: '122',
        actualRecordId: FIELD_ACTUAL_ID,
        actualDigest: excavationActual.contentDigest,
        deviation: '3.5',
        observedAt: T[10],
      }),
    ),
    'seal comparison fact (r1 vs actual)',
  );

  const packRef = {
    packId: 'construction.core',
    packVersion: '1.0.0',
    contentDigest: packProfileDigest,
  } as const;
  const candidate = need(
    sealOutcomeLearningCandidate({
      schema: 'epoch.learning-calibration.candidate',
      schemaVersion: 1,
      candidateId: CANDIDATE_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      comparisonFact,
      outcome,
      validationEvidence: {
        state: 'corroborated',
        assessmentRef: { recordId: VALIDATION_ASSESSMENT_ID, contentDigest: excavationAssessment.contentDigest },
      },
      varianceEvidence: {
        varianceClass: 'quantity',
        varianceRecordRef: { recordId: VARIANCE_ID, contentDigest: variance.contentDigest },
        attribution: {
          cause: { causeKind: 'issue-record', recordId: ISSUE_ID, contentDigest: issue.contentDigest },
          evidence: [fieldEvidence.receipt.digest],
        },
      },
      packRef,
      realizationVariant: 'construction-build',
    }),
    'seal learning candidate',
  );
  const candidateResidual = need(
    sealOutcomeLearningCandidate({
      schema: 'epoch.learning-calibration.candidate',
      schemaVersion: 1,
      candidateId: CANDIDATE_RESIDUAL_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      comparisonFact: comparisonFactResidual,
      outcome: outcomeResidual,
      validationEvidence: {
        state: 'corroborated',
        assessmentRef: { recordId: VALIDATION_ASSESSMENT_ID, contentDigest: excavationAssessment.contentDigest },
      },
      varianceEvidence: {
        varianceClass: 'quantity',
        varianceRecordRef: { recordId: VARIANCE_ID, contentDigest: variance.contentDigest },
        attribution: null,
      },
      packRef,
      realizationVariant: 'construction-build',
    }),
    'seal residual learning candidate',
  );

  // The foreign-tenant candidate (the pure-path typed exclusion evidence).
  const foreignOutcome = need(
    sealDistinctionRecord({
      ...outcomeContentBase(),
      recordId: OUTCOME_FOREIGN_ID,
      tenantId: 'tenant:initech',
      payload: { outcomeKind: 'delivered', verificationRefs: [DIGEST('c')] },
    }),
    'seal foreign outcome record',
  );
  const foreignFact = need(
    sealComparisonFactInput({
      ...comparisonFactContent({
        factId: COMPARISON_FACT_FOREIGN_ID,
        comparisonRefId: COMPARISON_REF_FOREIGN_ID,
        forecastRecordId: FORECAST_R2_ID,
        forecastDigest: forecastR2.contentDigest,
        forecastValue: '119',
        actualRecordId: FIELD_ACTUAL_ID,
        actualDigest: excavationActual.contentDigest,
        deviation: '0.5',
        observedAt: T[10],
      }),
      tenantId: 'tenant:initech',
    }),
    'seal foreign comparison fact',
  );
  const foreignCandidate = need(
    sealOutcomeLearningCandidate({
      schema: 'epoch.learning-calibration.candidate',
      schemaVersion: 1,
      candidateId: CANDIDATE_FOREIGN_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      comparisonFact: foreignFact,
      outcome: foreignOutcome,
      validationEvidence: {
        state: 'corroborated',
        assessmentRef: { recordId: VALIDATION_ASSESSMENT_ID, contentDigest: excavationAssessment.contentDigest },
      },
      varianceEvidence: {
        varianceClass: 'quantity',
        varianceRecordRef: { recordId: VARIANCE_ID, contentDigest: variance.contentDigest },
        attribution: null,
      },
      packRef,
      realizationVariant: 'construction-build',
    }),
    'seal foreign learning candidate',
  );
  const foreignEvaluation = evaluateEligibility({ tenantId: TENANT, solutionId: SOLUTION_ID }, foreignCandidate);
  const foreignDataset = need(
    assembleDataset(
      { tenantId: TENANT, solutionId: SOLUTION_ID },
      { comparisonFacts: [foreignFact], outcomeRecords: [foreignOutcome] },
      [foreignCandidate],
      { bandThresholds: BAND_THRESHOLDS },
    ),
    'assemble the foreign-tenant probe dataset',
  );

  // The governed store path (the learning authority).
  let learningStore = openLearningStore({ tenantId: TENANT, solutionId: SOLUTION_ID });
  learningStore = need(registerComparisonFact(learningStore, comparisonFact), 'register comparison fact');
  learningStore = need(registerComparisonFact(learningStore, comparisonFactResidual), 'register residual comparison fact');
  learningStore = need(registerOutcomeRecord(learningStore, outcome), 'register outcome record');
  learningStore = need(registerOutcomeRecord(learningStore, outcomeResidual), 'register residual outcome record');
  const intakenEligible = need(intakeLearningRecord(learningStore, candidate), 'intake eligible candidate');
  learningStore = intakenEligible.store;
  const intakenResidual = need(intakeLearningRecord(learningStore, candidateResidual), 'intake residual candidate');
  learningStore = intakenResidual.store;
  const assembled = need(assembleDatasetFromStore(learningStore, { bandThresholds: BAND_THRESHOLDS }), 'assemble dataset');
  learningStore = assembled.store;
  const dataset = assembled.dataset;

  const changingObservations = dataset.rows
    .flatMap((row) => [
      { recordId: row.provenance.comparisonFact.recordId, contentDigest: row.provenance.comparisonFact.contentDigest },
      { recordId: row.provenance.outcomeRecord.recordId, contentDigest: row.provenance.outcomeRecord.contentDigest },
    ])
    .sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
  const proposal = need(
    sealModelRevisionProposal({
      schema: 'epoch.learning-calibration.model-revision-proposal',
      schemaVersion: 1,
      proposalId: PROPOSAL_ID,
      draft: {
        schema: 'epoch.learning-calibration.model-revision',
        schemaVersion: 1,
        revisionId: REVISION_ID,
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        modelId: MODEL_ID,
        sequence: 1,
        supersedes: null,
        applicability: { measureClass: 'quantity', packId: 'construction.core', realizationVariant: 'construction-build' },
        parameters: [{ name: 'epoch.calibration.excavation.bias-offset', value: '1' }],
        lineage: {
          datasets: [{ datasetId: dataset.datasetId, contentDigest: dataset.contentDigest }],
          changingObservations,
        },
        revisedAt: T[14],
        revisedBy: PRINCIPAL,
        note: 'initial calibration of the excavation volume model from the governed dataset',
      },
      justification: [{ kind: 'dataset', reference: dataset.datasetId }],
      proposedAt: T[14],
      proposedBy: PRINCIPAL,
    }),
    'seal model revision proposal',
  );
  const revisionAdmission = need(admitModelRevisionProposal(learningStore, proposal), 'admit model revision proposal');
  learningStore = revisionAdmission.store;
  const revision = revisionAdmission.revision;

  const metricsFold = need(
    foldMetrics(learningStore, { revisionId: revision.revisionId, toleranceBands: [...TOLERANCE_BANDS] }),
    'fold calibration metrics',
  );
  learningStore = metricsFold.store;
  const metricSet = metricsFold.metricSet;

  const packView = need(projectPackView(dataset, { solutionId: SOLUTION_ID, packId: 'construction.core' }), 'project pack view');
  const learningState = projectStoreLearningState(learningStore, T[15]);

  // == Stage 18 — the authorized projections (role-specific views) =========
  const canonicalProgram: CanonicalRecord = { objectClass: 'program-of-work', record: program };
  const canonicalDelivery: CanonicalRecord = { objectClass: 'delivery-record', record: closedDelivery };
  accessStore = need(admitCanonicalRecord(accessStore, canonicalProgram), 'admit canonical program record').store;
  accessStore = need(admitCanonicalRecord(accessStore, canonicalDelivery), 'admit canonical delivery record').store;

  const accessEvaluations: ProjectionEvaluation[] = [];
  const accessAudits: SealedProjectionAudit[] = [];
  const accessProjections: SealedAuthorizedProjection[] = [];
  const evaluateAccess = (
    principalId: string,
    subject: ProjectionSubject,
    action: 'view' | 'export' | 'share',
    canonical: CanonicalRecord,
  ): void => {
    const identity = canonicalObjectIdentity(canonical);
    const gate = accessDecision(principalId, action, { resourceType: identity.objectClass, resourceId: identity.objectId });
    const outcome = need(
      evaluateProjection({
        request: gate.request,
        decision: gate.decision,
        policy: accessPolicy,
        record: canonical,
        subject,
        projectedAt: T[15],
        projectedBy: PRINCIPAL,
      }),
      `evaluate projection (${principalId} ${action} ${identity.objectClass})`,
    );
    accessEvaluations.push(outcome);
    accessAudits.push(outcome.audit);
    accessStore = need(appendAuditRecord(accessStore, outcome.audit), `append audit (${principalId} ${action})`).store;
    if (outcome.outcome === 'released') {
      accessProjections.push(outcome.projection);
      accessStore = need(admitProjection(accessStore, outcome.projection), `admit projection (${principalId} ${action})`).store;
    }
  };
  evaluateAccess(CLIENT_VIEWER, { principalId: CLIENT_VIEWER, principalKind: 'human', role: ROLE_CLIENT }, 'view', canonicalProgram);
  evaluateAccess(SITE_ENGINEER, { principalId: SITE_ENGINEER, principalKind: 'human', role: ROLE_ENGINEER }, 'view', canonicalProgram);
  evaluateAccess(CLIENT_VIEWER, { principalId: CLIENT_VIEWER, principalKind: 'human', role: ROLE_CLIENT }, 'view', canonicalDelivery);
  evaluateAccess(SITE_ENGINEER, { principalId: SITE_ENGINEER, principalKind: 'human', role: ROLE_ENGINEER }, 'export', canonicalDelivery);
  const accessState = projectAccessState(accessStore);

  // == Stage 19 — the lifecycle graph (the 11-stage spine) ==================
  const stageSpecs: readonly { stage: string; enteredAt: string }[] = [
    { stage: 'understand', enteredAt: T[0] },
    { stage: 'decide', enteredAt: T[2] },
    { stage: 'plan', enteredAt: T[3] },
    { stage: 'acquire', enteredAt: T[4] },
    { stage: 'realize', enteredAt: T[5] },
    { stage: 'observe', enteredAt: T[6] },
    { stage: 'actualize', enteredAt: T[10] },
    { stage: 'verify', enteredAt: T[12] },
    { stage: 'forecast', enteredAt: T[12] },
    { stage: 'close', enteredAt: T[13] },
    { stage: 'learn', enteredAt: T[14] },
  ];
  const stageNotes: Readonly<Record<string, string>> = {
    acquire: 'the procurement chain is the Acquire projection',
    realize: 'the execution tracking store is the Realize projection',
    observe: 'field intake plus the bridged Aurum observation report',
    actualize: 'the W039 fold is the only bridge to authoritative delivery state',
    verify: 'the formation inspection gate passed with real evidence',
    forecast: 'forecast revisions r1 to r2 (append-only)',
    close: 'the delivery record closed after verification',
    learn: 'the governed learning dataset feeds model calibration',
  };
  let lifecycle: LifecycleGraph = { tenantId: TENANT, solutionId: SOLUTION_ID, stages: [], transitions: [] };
  for (const spec of stageSpecs) {
    lifecycle = need(
      admitLifecycleStage(lifecycle, {
        schema: 'epoch.solution-delivery.lifecycle-stage',
        schemaVersion: 1,
        recordId: `stage:lifecycle-${spec.stage}`,
        tenantId: TENANT,
        subject: { solutionId: SOLUTION_ID, subjectKind: 'delivery-record', subjectId: DELIVERY_ID },
        stage: spec.stage,
        enteredAt: spec.enteredAt,
        enteredBy: PRINCIPAL,
        ...(stageNotes[spec.stage] !== undefined ? { note: stageNotes[spec.stage] } : {}),
      }),
      `admit lifecycle stage ${spec.stage}`,
    );
  }
  for (const [index, spec] of stageSpecs.entries()) {
    if (index === 0) continue;
    lifecycle = need(
      admitLifecycleTransition(lifecycle, {
        schema: 'epoch.solution-delivery.lifecycle-transition',
        schemaVersion: 1,
        recordId: `transition:lifecycle-${stageSpecs[index - 1]!.stage}-${spec.stage}`,
        tenantId: TENANT,
        subject: { solutionId: SOLUTION_ID, subjectKind: 'delivery-record', subjectId: DELIVERY_ID },
        relation: 'precedes',
        fromStageRecordId: `stage:lifecycle-${stageSpecs[index - 1]!.stage}`,
        toStageRecordId: `stage:lifecycle-${spec.stage}`,
        recordedAt: spec.enteredAt,
        recordedBy: PRINCIPAL,
      }),
      `admit lifecycle transition ${stageSpecs[index - 1]!.stage}->${spec.stage}`,
    );
  }

  // == Stage 20 — the evidence chain (four typed streams + the W010 log) ====
  // (a) the delivery lifecycle stream (the replayable W010 log).
  const events: EventContent[] = [];
  let sequence = 0;
  const emit = (discriminator: string, data: Record<string, JsonValue>, occurredAt: string, actor: string): void => {
    sequence += 1;
    events.push({
      schemaVersion: 1,
      streamId: DELIVERY_STREAM_ID,
      sequence,
      tenantId: TENANT,
      actor,
      causalParent: sequence === 1 ? null : { streamId: DELIVERY_STREAM_ID, sequence: sequence - 1 },
      payload: { discriminator, data },
      occurredAt,
    });
  };
  for (const spec of stageSpecs) {
    emit(
      'delivery:stage-entered',
      { solutionId: SOLUTION_ID, subjectId: DELIVERY_ID, stage: spec.stage, stageRecordId: `stage:lifecycle-${spec.stage}`, enteredAt: spec.enteredAt },
      spec.enteredAt,
      PRINCIPAL,
    );
  }
  emit('delivery:baseline-approved', { solutionId: SOLUTION_ID, version: solution.version, baselineDigest: approval.baselineDigest, approvedBy: APPROVER, approvedAt: T[3] }, T[3], APPROVER);
  emit('delivery:acquisition-requested', { acquisitionId: ACQUISITION_ID, variant: 'external-procurement', requestedAt: T[4] }, T[4], PROCUREMENT);
  emit('delivery:info-request-issued', { requestId: INFO_REQUEST_ID, decisionImpact: 'material', issuedAt: T[5] }, T[5], PRINCIPAL);
  emit('delivery:observation-recorded', { deliveryId: DELIVERY_ID, observationId: FIELD_OBSERVATION_ID, at: T[6] }, T[6], OBSERVER);
  emit('delivery:forecast-recorded', { forecastRecordId: FORECAST_R1_ID, asOf: T[7], refines: null }, T[7], PRINCIPAL);
  emit('delivery:forecast-recorded', { forecastRecordId: FORECAST_R2_ID, asOf: T[8], refines: FORECAST_R1_ID }, T[8], PRINCIPAL);
  emit('delivery:acquisition-fulfilled', { acquisitionId: ACQUISITION_ID, fulfilledAt: T[9] }, T[9], OBSERVER);
  emit('delivery:observation-recorded', { deliveryId: DELIVERY_ID, observationId: AURUM_OBSERVATION_ID, at: T[9] }, T[9], OBSERVER);
  emit('delivery:observation-actualized', { deliveryId: DELIVERY_ID, observationId: FIELD_OBSERVATION_ID, actualId: FIELD_ACTUAL_ID, actualizedAt: T[10] }, T[10], PRINCIPAL);
  emit('delivery:observation-actualized', { deliveryId: DELIVERY_ID, observationId: AURUM_OBSERVATION_ID, actualId: AURUM_RECEIPT_ACTUAL_ID, actualizedAt: T[10] }, T[10], PRINCIPAL);
  emit('delivery:milestone-reached', { programId: PROGRAM_ID, milestoneId: MILESTONE_FOUNDATIONS, reachedAt: T[10] }, T[10], SUPERVISOR);
  emit('delivery:outcome-recorded', { outcomeRecordId: OUTCOME_ID, outcomeKind: 'delivered', recordedAt: T[12] }, T[12], PRINCIPAL);
  emit('delivery:learning-recorded', { learningRecordId: dataset.datasetId, recordedAt: T[14] }, T[14], PRINCIPAL);
  const log = new EventLog({ expectedTenantId: TENANT });
  for (const event of events) {
    const sealed = need(sealEvent(event), `seal lifecycle event ${event.sequence}`);
    need(log.appendEvent(sealed), `append lifecycle event ${event.sequence}`);
  }

  // (b) the supervision stream (typed seals).
  const supervisionEvents: SealedSupervisionEvent[] = [];
  const supervisionStream = supervisionStreamIdOf(PROGRAM_ID);
  let supervisionSequence = 0;
  const emitSupervision = (discriminator: string, data: Record<string, unknown>, occurredAt: string, actor: string): void => {
    supervisionSequence += 1;
    supervisionEvents.push(
      need(
        sealSupervisionEvent({
          schemaVersion: 1,
          streamId: supervisionStream,
          sequence: supervisionSequence,
          tenantId: TENANT,
          actor,
          causalParent: supervisionSequence === 1 ? null : { streamId: supervisionStream, sequence: supervisionSequence - 1 },
          payload: { discriminator, data: data as SupervisionEventPayload['data'] },
          occurredAt,
        }),
        `seal supervision event ${supervisionSequence}`,
      ),
    );
  };
  emitSupervision('supervision:program-registered', { programId: PROGRAM_ID, programDigest: program.contentDigest, registeredAt: T[3] }, T[3], PRINCIPAL);
  emitSupervision('supervision:delivery-registered', { deliveryId: DELIVERY_ID, deliveryDigest: deliveryMid.contentDigest, programId: PROGRAM_ID, registeredAt: T[3] }, T[3], PRINCIPAL);
  emitSupervision('supervision:policy-registered', { policyId: ALERT_POLICY_ID, policyDigest: alertPolicy.contentDigest, policyVersion: '1.0.0', registeredAt: T[3] }, T[3], PRINCIPAL);
  emitSupervision('supervision:pass-evaluated', { passId: PASS_1_ID, passDigest: pass1.contentDigest, programId: PROGRAM_ID, deliveryId: DELIVERY_ID, findingCount: pass1.findings.length, evaluatedAt: T[9] }, T[9], PRINCIPAL);
  for (const finding of pass1.findings) {
    emitSupervision(
      'supervision:finding-produced',
      { findingId: finding.findingId, findingDigest: finding.contentDigest, findingClass: finding.findingClass, findingStatus: finding.status, subjectKind: finding.subject.subjectKind, subjectId: finding.subject.subjectId, passId: PASS_1_ID },
      T[9],
      PRINCIPAL,
    );
  }
  for (const chain of chains) {
    const raised = chain[0]!;
    emitSupervision('supervision:alert-raised', { alertId: raised.alertId, alertDigest: raised.contentDigest, revision: raised.revision, findingId: raised.findingId, findingDigest: raised.findingDigest, severity: raised.severity, raisedAt: raised.raisedAt }, T[9], PRINCIPAL);
  }
  for (const notification of notifications) {
    if (notification.dispatchedAt === T[9]) {
      emitSupervision('supervision:notification-dispatched', { notificationId: notification.notificationId, notificationDigest: notification.contentDigest, alertId: notification.alertId, channelKind: notification.channelKind, targetCount: notification.targets.length, duplicate: false, dispatchedAt: notification.dispatchedAt }, notification.dispatchedAt, PRINCIPAL);
    }
  }
  emitSupervision('supervision:alert-escalated', { alertId: escalatedAlert.alertId, alertDigest: escalatedAlert.contentDigest, revision: escalatedAlert.revision, escalationLevel: escalatedAlert.escalationLevel as number, outcomeKind: escalationOutcome.outcomeKind, proposalDigest: computeProposalDigest(escalationProposal), escalatedAt: T[11] }, T[11], PRINCIPAL);
  emitSupervision('supervision:notification-dispatched', { notificationId: escalationNotification.notificationId, notificationDigest: escalationNotification.contentDigest, alertId: escalationNotification.alertId, channelKind: escalationNotification.channelKind, targetCount: escalationNotification.targets.length, duplicate: false, dispatchedAt: T[11] }, T[11], PRINCIPAL);
  emitSupervision('supervision:projection-updated', { programId: PROGRAM_ID, deliveryId: DELIVERY_ID, passId: PASS_1_ID, findingCount: pass1.findings.length, alertCount: chains.length, projectedAt: T[11] }, T[11], PRINCIPAL);
  emitSupervision('supervision:pass-evaluated', { passId: PASS_2_ID, passDigest: pass2.contentDigest, programId: PROGRAM_ID, deliveryId: DELIVERY_ID, findingCount: pass2.findings.length, evaluatedAt: T[11] }, T[11], PRINCIPAL);
  for (const chain of chains) {
    const resolved = chain[chain.length - 1]!;
    emitSupervision('supervision:alert-resolved', { alertId: resolved.alertId, alertDigest: resolved.contentDigest, revision: resolved.revision, resolutionKind: resolved.resolutionKind as string, resolvedAt: resolved.resolvedAt as string }, resolved.resolvedAt as string, SUPERVISOR);
  }
  emitSupervision('supervision:projection-updated', { programId: PROGRAM_ID, deliveryId: DELIVERY_ID, passId: PASS_2_ID, findingCount: pass2.findings.length, alertCount: chains.length, projectedAt: T[11] }, T[11], PRINCIPAL);

  // (c) the learning stream (typed seals).
  const learningEvents: SealedLearningEvent[] = [];
  const learningStream = learningStreamIdOf(SOLUTION_ID);
  let learningSequence = 0;
  const emitLearning = (discriminator: string, data: Record<string, unknown>, occurredAt: string): void => {
    learningSequence += 1;
    learningEvents.push(
      need(
        sealLearningEvent({
          schemaVersion: 1,
          streamId: learningStream,
          sequence: learningSequence,
          tenantId: TENANT,
          actor: PRINCIPAL,
          causalParent: learningSequence === 1 ? null : { streamId: learningStream, sequence: learningSequence - 1 },
          payload: { discriminator, data: data as LearningEventPayload['data'] },
          occurredAt,
        }),
        `seal learning event ${learningSequence}`,
      ),
    );
  };
  emitLearning('learning:record-intaken', { solutionId: SOLUTION_ID, candidateId: CANDIDATE_ID, subjectKind: 'activity', admission: intakenEligible.admission, intakenAt: T[14] }, T[14]);
  emitLearning('learning:record-intaken', { solutionId: SOLUTION_ID, candidateId: CANDIDATE_RESIDUAL_ID, subjectKind: 'activity', admission: intakenResidual.admission, intakenAt: T[14] }, T[14]);
  emitLearning('learning:dataset-assembled', { solutionId: SOLUTION_ID, datasetId: dataset.datasetId, datasetDigest: dataset.contentDigest, eligibleCount: dataset.eligibleCount, excludedCount: dataset.excludedCount, assembledAt: T[14] }, T[14]);
  emitLearning('learning:revision-proposed', { solutionId: SOLUTION_ID, proposalId: PROPOSAL_ID, modelId: MODEL_ID, revisionId: REVISION_ID, sequence: 1, proposedAt: T[14] }, T[14]);
  emitLearning('learning:revision-admitted', { solutionId: SOLUTION_ID, proposalId: PROPOSAL_ID, modelId: MODEL_ID, revisionId: REVISION_ID, sequence: 1, admittedAt: T[14] }, T[14]);
  emitLearning('learning:metrics-folded', { solutionId: SOLUTION_ID, metricId: metricSet.metricId, modelId: MODEL_ID, revisionId: REVISION_ID, datasetId: dataset.datasetId, selectedRowCount: metricSet.selectedRowCount, foldedAt: T[14] }, T[14]);
  emitLearning('learning:pack-view-projected', { solutionId: SOLUTION_ID, packId: 'construction.core', rowCount: packView.rows.length, projectedAt: T[14] }, T[14]);
  emitLearning('learning:state-projected', { solutionId: SOLUTION_ID, candidateCount: learningState.candidateCount, datasetCount: learningState.datasetCount, metricCount: learningState.metricSetCount, modelCount: learningState.modelCount, revisionCount: learningState.revisionCount, projectedAt: T[15] }, T[15]);

  // (d) the access-projection stream (typed seals).
  const accessEvents: SealedAccessProjectionEvent[] = [];
  const accessStream = accessStreamIdOf(PROGRAM_ID);
  let accessSequence = 0;
  const emitAccess = (discriminator: string, data: Record<string, unknown>, occurredAt: string): void => {
    accessSequence += 1;
    accessEvents.push(
      need(
        sealAccessProjectionEvent({
          schemaVersion: 1,
          streamId: accessStream,
          sequence: accessSequence,
          tenantId: TENANT,
          actor: PRINCIPAL,
          causalParent: accessSequence === 1 ? null : { streamId: accessStream, sequence: accessSequence - 1 },
          payload: { discriminator, data: data as AccessProjectionEventPayload['data'] },
          occurredAt,
        }),
        `seal access event ${accessSequence}`,
      ),
    );
  };
  emitAccess('access-projection:policy-registered', { policyId: ACCESS_POLICY_ID, revision: 1, policyDigest: accessPolicy.contentDigest, status: 'active', bindingCount: accessPolicy.bindings.length }, T[15]);
  emitAccess('access-projection:record-admitted', { objectClass: 'program-of-work', objectId: PROGRAM_ID, objectDigest: program.contentDigest }, T[15]);
  emitAccess('access-projection:record-admitted', { objectClass: 'delivery-record', objectId: DELIVERY_ID, objectDigest: closedDelivery.contentDigest }, T[15]);
  for (const [index, evaluation] of accessEvaluations.entries()) {
    const audit = accessAudits[index]!;
    if (evaluation.outcome === 'released') {
      const projection = evaluation.projection;
      emitAccess('access-projection:projection-released', { objectClass: projection.objectClass, objectId: projection.objectId, objectDigest: projection.objectDigest, principalId: projection.subject.principalId, action: projection.action, policyDigest: accessPolicy.contentDigest, projectionDigest: projection.contentDigest, auditDigest: audit.contentDigest, releasedFieldCount: releasedPathsOf(projection).length, redactedFieldCount: redactedPathsOf(projection).length }, T[15]);
    } else {
      emitAccess('access-projection:projection-denied', { objectClass: audit.objectClass, objectId: audit.objectId, objectDigest: audit.objectDigest, principalId: audit.principalId, action: audit.action, policyDigest: accessPolicy.contentDigest, auditDigest: audit.contentDigest, denialCode: evaluation.denial.code }, T[15]);
    }
    emitAccess('access-projection:audit-recorded', { auditId: audit.auditId, evaluationKey: audit.evaluationKey, auditDigest: audit.contentDigest, outcome: audit.outcome }, T[15]);
  }
  emitAccess('access-projection:state-projected', { policyCount: accessState.policyCount, recordCount: accessState.recordCount, projectionCount: accessState.projectionCount, auditCount: accessState.auditCount }, T[15]);

  // == The projections over the final state ==================================
  const boq = need(projectBoq({ solution, program, worldEntities: [...WORLD_ENTITIES] }), 'project BOQ');
  const programme = need(projectConstructionProgramme(programLive2), 'project final programme');
  const deliveryLinks = need(
    foldDeliveryLinks({ solution, program, acquisitions: [acquisitionRequest], delivery: closedDelivery }),
    'fold delivery links',
  );
  const actuals = foldDeliveryActuals(closedDelivery);
  const actualizationState = need(projectActualizationState(actualization, closedDelivery, policy), 'project actualization state');
  const varianceSummary = foldVarianceSummary(varianceLedger);
  const executionState = projectExecutionState(tracking);

  return {
    packProfileDigest,
    existingConditions,
    alternativeSolution,
    evaluation,
    solution,
    approval,
    program,
    programLive1,
    programLive2,
    boq,
    programme,
    deliveryLinks,
    acquisitionRequest,
    acquisitionFulfillments,
    orders,
    supplierDelivery,
    ledger,
    baselineRecord,
    commitmentRecord,
    forecastR1,
    forecastR2,
    tracking,
    issue,
    infoRequestOpen,
    infoRequestFulfilled,
    bridge: {
      registrationId: registration.registration.registrationId,
      infoRequest,
      infoDispatch,
      answerEvent,
      answerIntake,
      observationEvent,
      observationIntake,
      observationProposal,
      alertRequest,
      alertDispatch,
      eventDiscriminators: runtime.recordedEvents().map((event) => event.payload.discriminator),
      deliveredRequestCount: chat.deliveredRequests.length,
    },
    deliveryMid,
    delivery: closedDelivery,
    deliveryDigestChain,
    pass1,
    supervisionState1,
    alertPolicy,
    alertChains: chains,
    alerts: chains.map((chain) => chain[chain.length - 1]!),
    notifications,
    notificationReceipts: receipts,
    escalationPlan,
    escalationProposal,
    escalationOutcome,
    escalatedAlert,
    alertFold,
    actualization,
    assessments,
    actualizationEvents,
    variance,
    varianceLedger,
    attribution,
    causes,
    evidence,
    actuals,
    actualizationState,
    varianceSummary,
    executionState,
    pass2,
    supervisionState,
    closedDelivery,
    outcome,
    outcomeResidual,
    comparisonFact,
    comparisonFactResidual,
    candidate,
    candidateResidual,
    foreignEvaluation,
    foreignDataset,
    learningStore,
    dataset,
    proposal,
    revision,
    metricSet,
    packView,
    learningState,
    accessStore,
    accessPolicyDigest,
    accessEvaluations,
    accessAudits,
    accessProjections,
    accessState,
    lifecycle,
    events,
    log,
    supervisionEvents,
    learningEvents,
    accessEvents,
  };
}

/** The base outcome-record content (overridden per variant). */
function outcomeContentBase(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'outcome',
    recordId: OUTCOME_ID,
    tenantId: TENANT,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_EXCAVATION,
    },
    payload: {
      outcomeKind: 'delivered',
      verificationRefs: [],
    },
    recordedAt: T[12],
    recordedBy: PRINCIPAL,
    uncertainty: uncertainty({
      provenance: { kind: 'observed', sourceRef: 'source:final-survey', actor: SUPERVISOR },
    }),
  };
}

function outcomeResidualContent(): Record<string, unknown> {
  return {
    ...outcomeContentBase(),
    recordId: OUTCOME_RESIDUAL_ID,
    payload: {
      outcomeKind: 'residual',
      verificationRefs: [],
    },
    uncertainty: uncertainty({
      confidence: { method: 'stated', value: 0.4, rationale: 'the unsurveyed edge strip remains open' },
    }),
  };
}

// --------------------------------------------------------------------------------
// The digest projection (determinism evidence): every key digest of the
// scenario, canonically ordered. Two runs -> byte-identical digest.
// --------------------------------------------------------------------------------

export function deliveryLearningDigestProjection(
  scenario: DeliveryLearningScenario,
): Record<string, string | readonly string[]> {
  return {
    packProfileDigest: scenario.packProfileDigest,
    existingConditionsDigest: scenario.existingConditions.contentDigest,
    alternativeSolutionDigest: scenario.alternativeSolution.contentDigest,
    solutionDigest: scenario.solution.contentDigest,
    baselineApprovalDigest: scenario.approval.baselineDigest,
    programDigest: scenario.program.contentDigest,
    programLive1Digest: scenario.programLive1.contentDigest,
    programLive2Digest: scenario.programLive2.contentDigest,
    boqDigest: scenario.boq.contentDigest,
    programmeDigest: scenario.programme.contentDigest,
    acquisitionRequestDigest: canonicalDigest(JSON.parse(JSON.stringify(scenario.acquisitionRequest)) as never),
    poDigest: scenario.orders.orders[0]!.contentDigest,
    supplierDeliveryState: foldSupplierDelivery(scenario.supplierDelivery).state,
    ledgerRecordDigests: [...scenario.ledger.records].map((record) => record.contentDigest).sort(),
    infoRequestOpenDigest: canonicalDigest(JSON.parse(JSON.stringify(scenario.infoRequestOpen)) as never),
    infoRequestFulfilledDigest: canonicalDigest(JSON.parse(JSON.stringify(scenario.infoRequestFulfilled)) as never),
    bridgeInfoRequestDigest: scenario.bridge.infoRequest.contentDigest,
    bridgeObservationEventDigest: scenario.bridge.observationEvent.contentDigest,
    bridgeAnswerEventDigest: scenario.bridge.answerEvent.contentDigest,
    bridgeObservationProposalDigest: scenario.bridge.observationProposal.contentDigest,
    bridgeAlertRequestDigest: scenario.bridge.alertRequest.contentDigest,
    bridgeEventDiscriminators: scenario.bridge.eventDiscriminators,
    deliveryMidDigest: scenario.deliveryMid.contentDigest,
    deliveryDigest: scenario.delivery.contentDigest,
    deliveryDigestChain: scenario.deliveryDigestChain,
    observationDigests: [...scenario.delivery.observations].map((observation) => observation.contentDigest).sort(),
    actualDigests: [...scenario.delivery.actuals].map((actual) => actual.contentDigest).sort(),
    actualizationEventDigests: scenario.actualizationEvents.map((event) => event.contentDigest),
    pass1Digest: scenario.pass1.contentDigest,
    pass2Digest: scenario.pass2.contentDigest,
    alertPolicyDigest: scenario.alertPolicy.contentDigest,
    alertHeadDigests: scenario.alertChains.map((chain) => chain[chain.length - 1]!.contentDigest).sort(),
    escalationProposalDigest: computeProposalDigest(scenario.escalationProposal),
    escalationOutcomeDigest: scenario.escalationOutcome.contentDigest,
    notificationDigests: scenario.notifications.map((notification) => notification.contentDigest).sort(),
    varianceDigest: scenario.variance.contentDigest,
    attributionDigest: scenario.attribution.contentDigest,
    outcomeDigest: scenario.outcome.contentDigest,
    outcomeResidualDigest: scenario.outcomeResidual.contentDigest,
    comparisonFactDigest: scenario.comparisonFact.contentDigest,
    comparisonFactResidualDigest: scenario.comparisonFactResidual.contentDigest,
    candidateDigest: scenario.candidate.contentDigest,
    candidateResidualDigest: scenario.candidateResidual.contentDigest,
    foreignDatasetDigest: scenario.foreignDataset.contentDigest,
    datasetDigest: scenario.dataset.contentDigest,
    proposalDigest: scenario.proposal.contentDigest,
    revisionDigest: scenario.revision.contentDigest,
    metricSetDigest: scenario.metricSet.contentDigest,
    accessPolicyDigest: scenario.accessPolicyDigest,
    accessAuditDigests: scenario.accessAudits.map((audit) => audit.contentDigest).sort(),
    accessProjectionDigests: scenario.accessProjections.map((projection) => projection.contentDigest).sort(),
    supervisionEventDigests: scenario.supervisionEvents.map((event) => event.contentDigest),
    learningEventDigests: scenario.learningEvents.map((event) => event.contentDigest),
    accessEventDigests: scenario.accessEvents.map((event) => event.contentDigest),
  };
}
