// W032 — the CROSS-DOMAIN delivery driver: the ScenarioDriver that
// composes the REAL workspace kernels behind the harness's typed seam.
//
// Every driverOp dispatches to public kernel admission paths ONLY:
//   W026 pack-construction, W027 pack-software (the two domain packs),
//   W036 solution-delivery (solution/baseline/program/delivery/
//   observations), W037 procurement (the Acquire chain), W038
//   execution-tracking (the Realize stream), W039 actualization +
//   variance (the shared fold + variance computation), W006 evidence,
//   W010 event-log (the lifecycle stream + recovery).
//
// NOTHING is mocked; no kernel internals are imported; every reported
// value is DERIVED DATA (digests, ids, typed errors). External providers
// do not participate (the procurement supplier is fixture data through
// the W037 kernel paths).
//
// DETERMINISM: zero wall-clock, zero randomness, zero network. Two runs
// of the same scenario produce byte-identical worlds (asserted by the
// harness runner's double-run).
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
  admitSoftwarePackProfile,
  projectBacklog,
  projectRoadmap,
  softwarePackProfile,
  type BacklogView,
  type RoadmapView,
} from '@epoch/pack-software';
import {
  admitAcquisitionRequest,
  admitSolutionVersion,
  approveSolutionBaseline,
  buildProgramOfWork,
  foldDeliveryActuals,
  openDeliveryRecord,
  recordObservation,
  reviseSolutionBaseline,
  sealDistinctionRecord,
  sealSolutionVersion,
  verifySealedDeliveryRecord,
  verifySealedDistinctionRecord,
  verifySealedProgramOfWork,
  type AcquisitionRequestRecord,
  type BaselineApproval,
  type DeliveryActualsSummary,
  type SealedDeliveryRecord,
  type SealedDistinctionRecord,
  type SealedProgramOfWork,
  type SealedSolutionVersion,
} from '@epoch/solution-delivery';
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
  type AcquisitionPackageStore,
  type PurchaseOrderStore,
  type QuoteStore,
  type SelectionStore,
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
  type ActualizationStateProjection,
  type ActualizationStore,
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
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { EvidenceStore } from '@epoch/evidence';
import {
  EventLog,
  sealEvent,
  verifyEventDigest,
  type EventContent,
  type EventRecord,
} from '@epoch/event-log';
import type {
  CallStep,
  EmittedEventRecord,
  IdentityObservation,
  ProvenanceRecord,
  ScenarioDefinition,
  ScenarioDriver,
  StepResult,
} from '@epoch/test-harness';
import {
  ACQUISITION_ID,
  ACTIVITY_DEPLOY_STAGING,
  ACTIVITY_EXCAVATION,
  ACTIVITY_STEEL_ERECTION,
  APPROVER,
  ATTRIBUTION_ID,
  BASELINE_RECORD_ID,
  COMMITMENT_ID,
  DELIVERY_ID,
  DELIVERY_STREAM_ID,
  DEPLOY_ACTUAL_ID,
  DEPLOY_CAPTURE_KEY,
  DEPLOY_OBSERVATION_ID,
  DIGEST,
  EXCAVATION_ACTUAL_ID,
  EXCAVATION_CAPTURE_KEY,
  EXCAVATION_OBSERVATION_ID,
  ISSUE_ID,
  LINE_CHECKOUT_UI,
  LINE_EXCAVATION,
  LINE_STEEL,
  MILESTONE_FOUNDATIONS,
  MILESTONE_STAGING_RELEASE,
  OBSERVER,
  OTHER_TENANT,
  PACKAGE_ID,
  PLATFORM_ENGINEER,
  PO_ID,
  PRINCIPAL,
  PROCUREMENT,
  PROGRAM_ID,
  QUOTE_ID,
  RECEIPT_OBSERVATION_ID,
  SELECTION_ID,
  SOLUTION_ID,
  SUPPLIER,
  T,
  TENANT,
  VARIANCE_DEPLOY_ID,
  VARIANCE_EXCAVATION_ID,
  WORK_PACKAGE_RELEASE,
  WORK_PACKAGE_SITEWORKS,
  WORLD_ENTITIES,
  asJson,
  derivedUncertainty,
  uncertainty,
} from './shared';

// --------------------------------------------------------------------------------
// The composed world.
// --------------------------------------------------------------------------------

/** The driver's composed world: every real record the scenario produced. */
export interface CrossDomainWorld {
  readonly scenario: ScenarioDefinition;
  readonly evidence: ReturnType<typeof EvidenceStore.create>;
  readonly log: EventLog;
  constructionPackDigest: string | null;
  softwarePackDigest: string | null;
  solution: SealedSolutionVersion | null;
  approval: BaselineApproval | null;
  program: SealedProgramOfWork | null;
  boq: BoqView | null;
  programme: ConstructionProgrammeView | null;
  roadmap: RoadmapView | null;
  backlog: BacklogView | null;
  delivery: SealedDeliveryRecord | null;
  deliveryChain: string[];
  acquisitionRequest: AcquisitionRequestRecord | null;
  packages: AcquisitionPackageStore | null;
  quotes: QuoteStore | null;
  selections: SelectionStore | null;
  commitment: SealedDistinctionRecord | null;
  orders: PurchaseOrderStore | null;
  supplierDelivery: SupplierDeliveryLog | null;
  tracking: ExecutionTrackingStore | null;
  issue: SealedIssueRecord | null;
  fieldObservations: SealedDistinctionRecord[];
  receiptObservation: SealedDistinctionRecord | null;
  actualization: ActualizationStore | null;
  assessments: readonly SealedValidationAssessment[];
  baselineRecord: SealedDistinctionRecord | null;
  varianceLedger: VarianceLedger | null;
  variances: SealedVarianceRecord[];
  attribution: SealedAttributionRecord | null;
  supervision: {
    actuals: DeliveryActualsSummary;
    actualizationState: ActualizationStateProjection;
    varianceSummary: readonly VarianceClassSummary[];
    links: DeliveryLinkIndex;
    executionState: ExecutionStateProjection;
  } | null;
  recovery: {
    replayedStateDigest: string;
    tamperIndex: number;
    prefixDigest: string;
    tamperedPrefixDigest: string;
    continued: boolean;
  } | null;
  eventSequence: number;
}

/** Every world this driver has begun (test-tree access for detail assertions). */
const worlds: CrossDomainWorld[] = [];

/** The latest completed world (the runner's double-run leaves two identical worlds). */
export function latestWorld(): CrossDomainWorld {
  return worlds[worlds.length - 1]!;
}

/** Unwrap helper: driver steps fail LOUDLY on impossible admissions. */
function need<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, label: string): T {
  if (!result.ok) {
    throw new Error(`cross-domain driver: ${label} failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** A provenance record over a SEALED record (digest field stripped). */
function sealedProvenance(record: { contentDigest: string } & Record<string, unknown>, parentDigest: string | null): ProvenanceRecord {
  const content: Record<string, unknown> = { ...record };
  delete content.contentDigest;
  return { content: content as unknown as JsonValue, claimedDigest: record.contentDigest, parentDigest };
}

/** A provenance record over a plain record (digest computed here). */
function plainProvenance(record: Record<string, unknown>, parentDigest: string | null): ProvenanceRecord {
  return { content: asJson(record), claimedDigest: canonicalDigest(asJson(record)), parentDigest };
}

// --------------------------------------------------------------------------------
// The driver op table.
// --------------------------------------------------------------------------------

export const CROSS_DOMAIN_DRIVER_OPS = [
  'packs.admit-construction',
  'packs.admit-software',
  'solution.seal',
  'solution.approve-baseline',
  'program.build',
  'projection.boq',
  'projection.construction-programme',
  'projection.roadmap',
  'delivery.open',
  'procurement.request',
  'procurement.package',
  'procurement.quote',
  'procurement.select',
  'procurement.commit',
  'procurement.order',
  'tracking.open',
  'field.observe-excavation',
  'field.observe-deploy',
  'issue.record',
  'delivery.record-excavation',
  'delivery.record-deploy',
  'delivery.record-receipt',
  'procurement.receive',
  'actualization.intake',
  'actualization.assess',
  'actualization.apply',
  'projection.backlog',
  'evidence.add',
  'variance.baseline-record',
  'variance.compute-excavation',
  'variance.compute-deploy',
  'variance.attribute',
  'supervision.fold',
  'recovery.replay',
  'recovery.tamper',
  'recovery.prefix-continue',
  'delivery.observe-foreign',
  'baseline.revise',
] as const;

// --------------------------------------------------------------------------------
// Content builders (fixture-driven; deterministic).
// --------------------------------------------------------------------------------

function solutionContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: SOLUTION_ID,
    version: '1.0.0',
    tenantId: TENANT,
    title: 'Hybrid plant extension',
    description:
      'One solution, two domains: the plant steel-frame extension (construction) and the checkout release unit (software)',
    objective: 'Deliver the hybrid plant extension within the site constraint set',
    solutionLines: [
      {
        lineId: LINE_EXCAVATION,
        title: 'Bulk excavation to formation level',
        description: 'Excavation of the plant foundation footprint to the specified formation level',
        quantity: { value: '120', unit: 'm3' },
        unitCost: { amount: '18.50', currency: 'EUR' },
        worldEntityId: 'element-foundations',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: LINE_CHECKOUT_UI,
        title: 'Checkout web UI',
        description: 'The checkout user interface delivered as a deployable web frontend',
        quantity: { value: '24', unit: 'deliverable' },
        unitCost: { amount: '620.00', currency: 'EUR' },
        worldEntityId: 'service-checkout',
        acquisitionVariant: 'cloud-service-provisioning',
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
    constraintReferences: [],
    previousVersionDigest: null,
    createdAt: T[0],
    createdBy: PRINCIPAL,
  };
}

function programContent(sealed: SealedSolutionVersion): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.program-of-work',
    schemaVersion: 1,
    programId: PROGRAM_ID,
    tenantId: sealed.tenantId,
    solutionId: sealed.solutionId,
    solutionVersion: sealed.version,
    solutionVersionDigest: sealed.contentDigest,
    title: 'Hybrid plant extension programme',
    workPackages: [
            {
        // The SOFTWARE work-package (the W027 lens) — SAME program.
        workPackageId: WORK_PACKAGE_RELEASE,
        title: 'Release rollout',
        description: 'Staging deployment of the checkout release unit',
        solutionLineId: LINE_CHECKOUT_UI,
        worldEntityId: 'service-checkout',
        realizationVariant: 'software-implementation-deployment',
        plannedStart: T[4],
        plannedFinish: T[6],
        responsibleActor: PLATFORM_ENGINEER,
        resources: [],
        constraintReferences: [],
        approvals: [],
        verificationGates: [],
        activities: [
          {
            activityId: ACTIVITY_DEPLOY_STAGING,
            workPackageId: WORK_PACKAGE_RELEASE,
            title: 'Deploy checkout UI to staging',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '24', unit: 'deliverable' },
            plannedCost: { amount: '14880.00', currency: 'EUR' },
            plannedStart: T[4],
            plannedFinish: T[6],
            predecessors: [],
            successors: [],
            resources: [],
            responsibleActor: PLATFORM_ENGINEER,
            constraintReferences: [],
            actualProgress: 0.75,
            actualStart: T[4],
            blockers: [],
            evidence: [],
          },
        ],
      },
      {
        // The CONSTRUCTION work-package (the W026 lens).
        workPackageId: WORK_PACKAGE_SITEWORKS,
        title: 'Site works',
        description: 'Bulk excavation and structural steel erection',
        solutionLineId: LINE_EXCAVATION,
        worldEntityId: 'element-foundations',
        realizationVariant: 'construction-build',
        plannedStart: T[3],
        plannedFinish: T[6],
        responsibleActor: PRINCIPAL,
        resources: [{ resourceId: 'resource:excavator', quantity: '1', unit: 'machine' }],
        constraintReferences: [],
        approvals: [{ approvedBy: APPROVER, approvedAt: T[2] }],
        verificationGates: [
          {
            gateId: 'gate:formation-inspection',
            activityId: ACTIVITY_EXCAVATION,
            title: 'Formation level inspection',
            method: 'construction.verify.inspection',
            criteria: 'Formation level within tolerance',
            evidence: [],
          },
        ],
        activities: [
          {
            activityId: ACTIVITY_EXCAVATION,
            workPackageId: WORK_PACKAGE_SITEWORKS,
            title: 'Bulk excavation to formation level',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '120', unit: 'm3' },
            plannedCost: { amount: '2220.00', currency: 'EUR' },
            plannedStart: T[3],
            plannedFinish: T[4],
            predecessors: [],
            successors: [ACTIVITY_STEEL_ERECTION],
            resources: [{ resourceId: 'resource:excavator', quantity: '1', unit: 'machine' }],
            responsibleActor: PRINCIPAL,
            constraintReferences: [],
            actualProgress: 1,
            actualStart: T[3],
            actualFinish: T[4],
            blockers: [],
            evidence: [{ digest: DIGEST('a') }],
          },
          {
            activityId: ACTIVITY_STEEL_ERECTION,
            workPackageId: WORK_PACKAGE_SITEWORKS,
            title: 'Erect structural steel frame',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '4', unit: 'tonne' },
            plannedCost: { amount: '9600.00', currency: 'EUR' },
            plannedStart: T[5],
            plannedFinish: T[6],
            predecessors: [ACTIVITY_EXCAVATION],
            successors: [],
            resources: [],
            responsibleActor: PRINCIPAL,
            constraintReferences: [],
            actualProgress: 0.5,
            actualStart: T[5],
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
        targetDate: T[5],
        activityIds: [ACTIVITY_EXCAVATION, ACTIVITY_STEEL_ERECTION],
        status: 'reached',
        reachedAt: T[5],
        evidence: [{ digest: DIGEST('b') }],
      },
      {
        milestoneId: MILESTONE_STAGING_RELEASE,
        title: 'Staging release',
        targetDate: T[6],
        activityIds: [ACTIVITY_DEPLOY_STAGING],
        status: 'reached',
        reachedAt: T[6],
        evidence: [],
      },
    ],
    createdAt: T[1],
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
    requestedAt: T[3],
    requestedBy: PROCUREMENT,
    neededBy: T[6],
    note: 'Steel supply against the BOQ quantities',
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
    acquisitionRequestDigest: canonicalDigest(asJson(request as unknown as Record<string, unknown>)),
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
    validUntil: T[8],
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
    lines: [
      {
        description: 'Structural steel sections grade S355',
        quantity: '4',
        unit: 'tonne',
        unitCost: { amount: '2350.00', currency: 'EUR' },
      },
    ],
    totalCost: { amount: '2350', currency: 'EUR' },
    issuedAt: T[7],
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
      workPackageIds: [WORK_PACKAGE_SITEWORKS],
      activityIds: [ACTIVITY_EXCAVATION],
      milestoneIds: [],
    },
    raisedAt: T[4],
    raisedBy: OBSERVER,
    recordedAt: T[4],
    evidenceLinks: [],
    uncertainty: uncertainty({ provenance: { kind: 'observed', sourceRef: 'source:site-instruction', actor: OBSERVER } }),
  };
}

function excavationCapture(): Record<string, unknown> {
  return {
    captureKey: EXCAVATION_CAPTURE_KEY,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    deliveryId: DELIVERY_ID,
    observedAt: T[4],
    observedBy: OBSERVER,
    subjectRef: { kind: 'activity', id: ACTIVITY_EXCAVATION },
    measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    uncertainty: uncertainty(),
  };
}

function deployCapture(): Record<string, unknown> {
  return {
    captureKey: DEPLOY_CAPTURE_KEY,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    deliveryId: DELIVERY_ID,
    observedAt: T[4],
    observedBy: PLATFORM_ENGINEER,
    subjectRef: { kind: 'activity', id: ACTIVITY_DEPLOY_STAGING },
    measure: { kind: 'quantity', value: '18', unit: 'deliverable' },
    uncertainty: uncertainty({
      provenance: { kind: 'observed', sourceRef: 'source:delivery-pipeline', actor: PLATFORM_ENGINEER },
    }),
  };
}

function receiptObservationContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'observation',
    recordId: RECEIPT_OBSERVATION_ID,
    tenantId: TENANT,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'work-package',
      subjectId: WORK_PACKAGE_SITEWORKS,
    },
    measure: { kind: 'quantity', value: '4', unit: 'tonne' },
    payload: {
      deliveryId: DELIVERY_ID,
      observedAt: T[8],
      observedBy: OBSERVER,
      evidence: [{ digest: DIGEST('c') }],
    },
    recordedAt: T[8],
    recordedBy: OBSERVER,
    uncertainty: uncertainty({
      provenance: { kind: 'observed', sourceRef: 'source:goods-receipt', actor: OBSERVER },
      confidence: { method: 'measured', value: 0.99, rationale: 'counted at the gate' },
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
    recordedAt: T[2],
    recordedBy: PRINCIPAL,
    uncertainty: derivedUncertainty(),
  };
}

// --------------------------------------------------------------------------------
// The lifecycle event stream + the recovery fold.
// --------------------------------------------------------------------------------

function emit(world: CrossDomainWorld, discriminator: string, data: Record<string, JsonValue>, occurredAt: string, actor: string): EmittedEventRecord {
  world.eventSequence += 1;
  const sequence = world.eventSequence;
  const event: EventContent = {
    schemaVersion: 1,
    streamId: DELIVERY_STREAM_ID,
    sequence,
    tenantId: TENANT,
    actor,
    causalParent: sequence === 1 ? null : { streamId: DELIVERY_STREAM_ID, sequence: sequence - 1 },
    payload: { discriminator, data },
    occurredAt,
  };
  const sealed = need(sealEvent(event), `seal lifecycle event ${sequence}`);
  need(world.log.appendEvent(sealed), `append lifecycle event ${sequence}`);
  return {
    streamId: event.streamId,
    sequence,
    discriminator,
    contentDigest: sealed.digest,
  };
}

/** The derived state folded from the lifecycle stream (the replay model). */
interface LifecycleFoldState {
  solutionDigest: string | null;
  baselineApprovalDigest: string | null;
  programDigest: string | null;
  observations: Record<string, string>;
  deliveryDigest: string | null;
  varianceDigests: string[];
}

function emptyLifecycleState(): LifecycleFoldState {
  return { solutionDigest: null, baselineApprovalDigest: null, programDigest: null, observations: {}, deliveryDigest: null, varianceDigests: [] };
}

function applyLifecycleEvent(state: LifecycleFoldState, event: EventContent): LifecycleFoldState {
  const data = event.payload.data as Record<string, unknown>;
  switch (event.payload.discriminator) {
    case 'delivery:solution-sealed':
      return { ...state, solutionDigest: String(data.contentDigest) };
    case 'delivery:baseline-approved':
      return { ...state, baselineApprovalDigest: String(data.baselineDigest) };
    case 'delivery:program-built':
      return { ...state, programDigest: String(data.contentDigest) };
    case 'delivery:observation-recorded':
      return {
        ...state,
        observations: { ...state.observations, [String(data.observationId)]: String(data.contentDigest) },
      };
    case 'delivery:actualization-applied':
      return { ...state, deliveryDigest: String(data.deliveryDigest) };
    case 'delivery:variance-computed':
      return { ...state, varianceDigests: [...state.varianceDigests, String(data.contentDigest)].sort() };
    default:
      return state;
  }
}

function lifecycleStateDigest(state: LifecycleFoldState): string {
  return canonicalDigest(state as unknown as JsonValue);
}

/** The verified fold: per-record digest verification; halts at the first failure. */
function foldVerified(records: readonly EventRecord[]): { state: LifecycleFoldState; verifiedCount: number; failure: { code: string } | null } {
  let state = emptyLifecycleState();
  for (const [index, record] of records.entries()) {
    const verified = verifyEventDigest({ event: record.event, digest: record.contentDigest });
    if (!verified.ok) {
      return { state, verifiedCount: index, failure: { code: verified.error.code } };
    }
    state = applyLifecycleEvent(state, record.event);
  }
  return { state, verifiedCount: records.length, failure: null };
}

// --------------------------------------------------------------------------------
// The report helpers.
// --------------------------------------------------------------------------------

interface ReportParts {
  ok: boolean;
  valueDigest: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  denial?: { code: string; expectedTenantId: string; encounteredTenantId: string } | null;
  authorityRejection?: { code: string; message: string } | null;
  events?: EmittedEventRecord[];
  provenance?: ProvenanceRecord[];
  identities?: IdentityObservation[];
}

function reportOf(step: CallStep, parts: ReportParts): StepResult<CrossDomainWorld> {
  return {
    world: currentWorld,
    report: {
      stepId: step.stepId,
      ok: parts.ok,
      valueDigest: parts.valueDigest ?? null,
      errorCode: parts.errorCode ?? null,
      errorMessage: parts.errorMessage ?? null,
      denial: parts.denial ?? null,
      authorityRejection: parts.authorityRejection ?? null,
      events: parts.events ?? [],
      provenance: parts.provenance ?? [],
      identities: parts.identities ?? [],
    },
  };
}

// The carry-forward world cursor (the runner owns the world lifecycle).
let currentWorld: CrossDomainWorld = undefined as unknown as CrossDomainWorld;

// --------------------------------------------------------------------------------
// The driver.
// --------------------------------------------------------------------------------

export const crossDomainDriver: ScenarioDriver<CrossDomainWorld> = {
  name: 'cross-domain-delivery',
  driverOps: CROSS_DOMAIN_DRIVER_OPS,

  begin(scenario: ScenarioDefinition): CrossDomainWorld {
    const world: CrossDomainWorld = {
      scenario,
      evidence: EvidenceStore.create(),
      log: new EventLog({ expectedTenantId: TENANT }),
      constructionPackDigest: null,
      softwarePackDigest: null,
      solution: null,
      approval: null,
      program: null,
      boq: null,
      programme: null,
      roadmap: null,
      backlog: null,
      delivery: null,
      deliveryChain: [],
      acquisitionRequest: null,
      packages: null,
      quotes: null,
      selections: null,
      commitment: null,
      orders: null,
      supplierDelivery: null,
      tracking: null,
      issue: null,
      fieldObservations: [],
      receiptObservation: null,
      actualization: null,
      assessments: [],
      baselineRecord: null,
      varianceLedger: null,
      variances: [],
      attribution: null,
      supervision: null,
      recovery: null,
      eventSequence: 0,
    };
    worlds.push(world);
    return world;
  },

  stateDigest(world: CrossDomainWorld): string {
    return canonicalDigest({
      constructionPackDigest: world.constructionPackDigest,
      softwarePackDigest: world.softwarePackDigest,
      solution: world.solution?.contentDigest ?? null,
      program: world.program?.contentDigest ?? null,
      boq: world.boq?.contentDigest ?? null,
      programme: world.programme?.contentDigest ?? null,
      roadmap: world.roadmap?.contentDigest ?? null,
      backlog: world.backlog?.contentDigest ?? null,
      delivery: world.delivery?.contentDigest ?? null,
      deliveryChain: world.deliveryChain,
      acquisitionRequest: world.acquisitionRequest === null ? null : canonicalDigest(asJson(world.acquisitionRequest as unknown as Record<string, unknown>)),
      package: world.packages?.packages[0]?.contentDigest ?? null,
      quote: world.quotes?.quotes[0]?.contentDigest ?? null,
      selection: world.selections?.selections[0]?.contentDigest ?? null,
      commitment: world.commitment?.contentDigest ?? null,
      purchaseOrder: world.orders?.orders[0]?.contentDigest ?? null,
      supplierDelivery: world.supplierDelivery === null ? null : foldSupplierDelivery(world.supplierDelivery).state,
      tracking: world.tracking === null ? null : canonicalDigest(projectExecutionState(world.tracking) as unknown as JsonValue),
      issue: world.issue?.contentDigest ?? null,
      fieldObservations: world.fieldObservations.map((observation) => observation.contentDigest),
      receiptObservation: world.receiptObservation?.contentDigest ?? null,
      actualization: world.actualization === null ? null : canonicalDigest({ observations: world.actualization.observations.map((o) => o.contentDigest) }),
      varianceLedger: world.varianceLedger === null ? null : canonicalDigest({ variances: foldVarianceRecords(world.varianceLedger).map((v) => v.contentDigest) }),
      attribution: world.attribution?.contentDigest ?? null,
      supervision: world.supervision === null ? null : canonicalDigest(world.supervision as unknown as JsonValue),
      recovery: world.recovery === null ? null : canonicalDigest(world.recovery as unknown as JsonValue),
      events: world.log.snapshot().records.map((record) => record.contentDigest),
    } as unknown as JsonValue);
  },

  runStep(world: CrossDomainWorld, step: CallStep): StepResult<CrossDomainWorld> {
    currentWorld = world;
    switch (step.driverOp) {
      // ------------------------------------------------------------------
      // The two domain packs (W026 + W027), admitted through W036.
      // ------------------------------------------------------------------
      case 'packs.admit-construction': {
        const profile = constructionPackProfile(TENANT);
        const admitted = need(admitConstructionPackProfile(profile), 'admit construction pack profile');
        world.constructionPackDigest = digestPackProfile(admitted);
        const event = emit(world, 'delivery:pack-admitted', { domain: 'construction', packProfileDigest: world.constructionPackDigest }, T[0], PRINCIPAL);
        return reportOf(step, {
          ok: true,
          valueDigest: world.constructionPackDigest,
          events: [event],
          provenance: [plainProvenance(profile, null)],
          identities: [{ surface: 'pack-profiles', ids: [String((admitted as unknown as Record<string, unknown>).packId ?? 'pack:construction')] }],
        });
      }
      case 'packs.admit-software': {
        const profile = softwarePackProfile(TENANT);
        const admitted = need(admitSoftwarePackProfile(profile), 'admit software pack profile');
        world.softwarePackDigest = digestPackProfile(admitted);
        const event = emit(world, 'delivery:pack-admitted', { domain: 'software', packProfileDigest: world.softwarePackDigest }, T[0], PRINCIPAL);
        return reportOf(step, {
          ok: true,
          valueDigest: world.softwarePackDigest,
          events: [event],
          provenance: [plainProvenance(profile, null)],
          identities: [{ surface: 'pack-profiles', ids: [String((admitted as unknown as Record<string, unknown>).packId ?? 'pack:software')] }],
        });
      }

      // ------------------------------------------------------------------
      // The W036 spine: solution -> baseline -> program.
      // ------------------------------------------------------------------
      case 'solution.seal': {
        const solution = need(sealSolutionVersion(solutionContent()), 'seal solution version');
        world.solution = solution;
        const event = emit(world, 'delivery:solution-sealed', { solutionId: SOLUTION_ID, version: solution.version, contentDigest: solution.contentDigest }, T[1], PRINCIPAL);
        return reportOf(step, {
          ok: true,
          valueDigest: solution.contentDigest,
          events: [event],
          provenance: [sealedProvenance(solution as unknown as { contentDigest: string } & Record<string, unknown>, null)],
          identities: [{ surface: 'solution-lines', ids: solution.solutionLines.map((line) => line.lineId).sort() }],
        });
      }
      case 'solution.approve-baseline': {
        const solution = world.solution!;
        need(admitSolutionVersion([], solution), 'admit solution version');
        const outcome = need(
          approveSolutionBaseline(solution, {
            schema: 'epoch.solution-delivery.baseline-approval',
            schemaVersion: 1,
            approvalId: 'approval:hybrid-baseline-v1',
            solutionId: SOLUTION_ID,
            tenantId: TENANT,
            version: solution.version,
            baselineDigest: solution.contentDigest,
            approvedBy: APPROVER,
            approvedAt: T[2],
            decisionNote: 'approved after cross-domain review',
          }),
          'approve solution baseline',
        );
        world.approval = outcome.approval;
        const event = emit(world, 'delivery:baseline-approved', { approvalId: outcome.approval.approvalId, baselineDigest: outcome.approval.baselineDigest }, T[2], APPROVER);
        return reportOf(step, {
          ok: true,
          valueDigest: outcome.approval.baselineDigest,
          events: [event],
          // The structural proof: the approval pins the EXACT solution bytes.
          provenance: [sealedProvenance(solution as unknown as { contentDigest: string } & Record<string, unknown>, null)],
        });
      }
      case 'program.build': {
        const solution = world.solution!;
        const program = need(buildProgramOfWork(programContent(solution)), 'build program of work');
        need(verifySealedProgramOfWork(program), 'verify sealed program of work');
        world.program = program;
        const event = emit(world, 'delivery:program-built', { programId: PROGRAM_ID, contentDigest: program.contentDigest }, T[1], PRINCIPAL);
        return reportOf(step, {
          ok: true,
          valueDigest: program.contentDigest,
          events: [event],
          provenance: [sealedProvenance(program as unknown as { contentDigest: string } & Record<string, unknown>, solution.contentDigest)],
          identities: [
            { surface: 'program-work-packages', ids: program.workPackages.map((pkg) => pkg.workPackageId).sort() },
            { surface: 'program-activities', ids: program.workPackages.flatMap((pkg) => pkg.activities.map((activity) => activity.activityId)).sort() },
            { surface: 'program-milestones', ids: program.milestones.map((milestone) => milestone.milestoneId).sort() },
          ],
        });
      }

      // ------------------------------------------------------------------
      // The synchronized projections — BOTH packs over the SAME program.
      // ------------------------------------------------------------------
      case 'projection.boq': {
        const boq = need(
          projectBoq({ solution: world.solution!, program: world.program!, worldEntities: [...WORLD_ENTITIES] }),
          'project BOQ',
        );
        world.boq = boq;
        return reportOf(step, {
          ok: true,
          valueDigest: boq.contentDigest,
          provenance: [sealedProvenance(boq as unknown as { contentDigest: string } & Record<string, unknown>, world.program!.contentDigest)],
          identities: [{ surface: 'boq-line-items', ids: boq.lineItems.map((item) => item.lineId).sort() }],
        });
      }
      case 'projection.construction-programme': {
        const programme = need(projectConstructionProgramme(world.program!), 'project construction programme');
        world.programme = programme;
        return reportOf(step, {
          ok: true,
          valueDigest: programme.contentDigest,
          provenance: [sealedProvenance(programme as unknown as { contentDigest: string } & Record<string, unknown>, world.program!.contentDigest)],
          identities: [
            { surface: 'programme-activities', ids: programme.activities.map((activity) => activity.activityId).sort() },
            { surface: 'programme-milestones', ids: programme.milestones.map((milestone) => milestone.milestoneId).sort() },
          ],
        });
      }
      case 'projection.roadmap': {
        const roadmap = need(projectRoadmap(world.program!), 'project roadmap');
        world.roadmap = roadmap;
        return reportOf(step, {
          ok: true,
          valueDigest: roadmap.contentDigest,
          provenance: [sealedProvenance(roadmap as unknown as { contentDigest: string } & Record<string, unknown>, world.program!.contentDigest)],
          identities: [{ surface: 'roadmap-releases', ids: roadmap.releases.map((release) => release.releaseId).sort() }],
        });
      }

      // ------------------------------------------------------------------
      // The SHARED delivery record (one spine for BOTH domains).
      // ------------------------------------------------------------------
      case 'delivery.open': {
        const solution = world.solution!;
        const delivery = need(
          openDeliveryRecord({
            schema: 'epoch.solution-delivery.delivery-record',
            schemaVersion: 1,
            deliveryId: DELIVERY_ID,
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            solutionVersion: solution.version,
            solutionVersionDigest: solution.contentDigest,
            openedAt: T[2],
            openedBy: PRINCIPAL,
            status: 'open',
            observations: [],
            acceptedObservationIds: [],
            rejectedObservationIds: [],
            actuals: [],
          }),
          'open delivery record',
        );
        world.delivery = delivery;
        world.deliveryChain = [delivery.contentDigest];
        return reportOf(step, {
          ok: true,
          valueDigest: delivery.contentDigest,
          provenance: [sealedProvenance(delivery as unknown as { contentDigest: string } & Record<string, unknown>, solution.contentDigest)],
        });
      }

      // ------------------------------------------------------------------
      // The W037 procurement chain (Acquire, for the steel line).
      // ------------------------------------------------------------------
      case 'procurement.request': {
        const request = need(admitAcquisitionRequest(acquisitionRequestContent()), 'admit acquisition request');
        world.acquisitionRequest = request;
        return reportOf(step, {
          ok: true,
          valueDigest: canonicalDigest(asJson(request as unknown as Record<string, unknown>)),
          provenance: [plainProvenance(request as unknown as Record<string, unknown>, world.delivery!.contentDigest)],
          identities: [{ surface: 'acquisition-lines', ids: [LINE_STEEL] }],
        });
      }
      case 'procurement.package': {
        const request = world.acquisitionRequest!;
        const pkg = need(sealAcquisitionPackage(packageContent(request)), 'seal acquisition package');
        const packages = need(admitAcquisitionPackage([request], emptyPackageStore(), pkg), 'admit acquisition package');
        world.packages = packages;
        return reportOf(step, {
          ok: true,
          valueDigest: packages.packages[0]!.contentDigest,
          provenance: [sealedProvenance(packages.packages[0] as unknown as { contentDigest: string } & Record<string, unknown>, null)],
        });
      }
      case 'procurement.quote': {
        const packageDigest = world.packages!.packages[0]!.contentDigest;
        const quote = need(sealQuote(quoteContent(packageDigest)), 'seal quote');
        const quotes = need(admitQuote(world.packages!, emptyQuoteStore(), quote), 'admit quote');
        world.quotes = quotes;
        return reportOf(step, {
          ok: true,
          valueDigest: quotes.quotes[0]!.contentDigest,
          provenance: [sealedProvenance(quotes.quotes[0] as unknown as { contentDigest: string } & Record<string, unknown>, packageDigest)],
        });
      }
      case 'procurement.select': {
        const packageDigest = world.packages!.packages[0]!.contentDigest;
        const quoteDigest = world.quotes!.quotes[0]!.contentDigest;
        const selection = need(sealQuoteSelection(selectionContent(packageDigest, quoteDigest)), 'seal quote selection');
        const selections = need(admitQuoteSelection(world.packages!, world.quotes!, emptySelectionStore(), selection), 'admit quote selection');
        world.selections = selections;
        return reportOf(step, {
          ok: true,
          valueDigest: selections.selections[0]!.contentDigest,
          provenance: [sealedProvenance(selections.selections[0] as unknown as { contentDigest: string } & Record<string, unknown>, quoteDigest)],
        });
      }
      case 'procurement.commit': {
        const commitment = need(
          sealProcurementCommitment({
            recordId: COMMITMENT_ID,
            tenantId: TENANT,
            subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
            quote: world.quotes!.quotes[0]!,
            acquisitionId: ACQUISITION_ID,
            committedBy: PROCUREMENT,
            committedAt: T[5],
            recordedAt: T[5],
            uncertainty: uncertainty({ provenance: { kind: 'observed', sourceRef: 'source:purchase-commitment', actor: PROCUREMENT } }) as never,
          }),
          'seal procurement commitment',
        );
        world.commitment = commitment;
        return reportOf(step, {
          ok: true,
          valueDigest: commitment.contentDigest,
          provenance: [sealedProvenance(commitment as unknown as { contentDigest: string } & Record<string, unknown>, world.quotes!.quotes[0]!.contentDigest)],
        });
      }
      case 'procurement.order': {
        const po = need(
          sealPurchaseOrder(
            purchaseOrderContent(
              world.packages!.packages[0]!.contentDigest,
              world.selections!.selections[0]!.contentDigest,
              world.commitment!.contentDigest,
            ),
          ),
          'seal purchase order',
        );
        const orders = need(
          admitPurchaseOrder(world.packages!, world.quotes!, world.selections!, [world.commitment!], emptyPurchaseOrderStore(), po),
          'admit purchase order',
        );
        world.orders = orders;
        const event = emit(world, 'delivery:po-issued', { poId: PO_ID, contentDigest: orders.orders[0]!.contentDigest }, T[7], PROCUREMENT);
        return reportOf(step, {
          ok: true,
          valueDigest: orders.orders[0]!.contentDigest,
          events: [event],
          provenance: [sealedProvenance(orders.orders[0] as unknown as { contentDigest: string } & Record<string, unknown>, world.commitment!.contentDigest)],
        });
      }

      // ------------------------------------------------------------------
      // The W038 execution tracking (Realize, BOTH domains).
      // ------------------------------------------------------------------
      case 'tracking.open': {
        const programIndex = need(buildProgramIndex(world.program!), 'build program index');
        const tracking = need(
          openExecutionTrackingStore({ tenantId: TENANT, solutionId: SOLUTION_ID, programIndex }),
          'open execution tracking store',
        );
        world.tracking = tracking;
        return reportOf(step, { ok: true, valueDigest: canonicalDigest({ workPackages: programIndex.workPackages.length } as unknown as JsonValue) });
      }
      case 'field.observe-excavation': {
        const intake = need(intakeFieldObservation(world.tracking!, excavationCapture()), 'intake excavation observation');
        world.tracking = intake.store;
        world.fieldObservations.push(intake.observation.record);
        return reportOf(step, {
          ok: true,
          valueDigest: intake.observation.record.contentDigest,
          provenance: [sealedProvenance(intake.observation.record as unknown as { contentDigest: string } & Record<string, unknown>, null)],
          identities: [{ surface: 'field-observations', ids: [intake.observation.record.recordId] }],
        });
      }
      case 'field.observe-deploy': {
        const intake = need(intakeFieldObservation(world.tracking!, deployCapture()), 'intake deploy observation');
        world.tracking = intake.store;
        world.fieldObservations.push(intake.observation.record);
        // The release-rollout tracking state (W038, the software package).
        const stateAdmission = need(
          admitTrackingState(
            world.tracking!,
            need(sealTrackingStateRecord({
              schema: 'epoch.execution-tracking.tracking-state',
              schemaVersion: 1,
              recordId: 'state:release-rollout-started',
              tenantId: TENANT,
              solutionId: SOLUTION_ID,
              subject: { workPackageId: WORK_PACKAGE_RELEASE },
              fromState: 'not-started',
              toState: 'in-progress',
              cause: 'staging deployment authorized and running',
              observedAt: T[4],
              recordedAt: T[4],
              recordedBy: PLATFORM_ENGINEER,
              evidenceLinks: [],
              uncertainty: uncertainty(),
            }), 'seal tracking state record'),
          ),
          'admit tracking state',
        );
        world.tracking = stateAdmission.store;
        return reportOf(step, {
          ok: true,
          valueDigest: intake.observation.record.contentDigest,
          provenance: [
            sealedProvenance(intake.observation.record as unknown as { contentDigest: string } & Record<string, unknown>, null),
            sealedProvenance(stateAdmission.record as unknown as { contentDigest: string } & Record<string, unknown>, null),
          ],
          identities: [{ surface: 'field-observations', ids: [intake.observation.record.recordId] }],
        });
      }
      case 'issue.record': {
        const admission = need(admitIssue(world.tracking!, need(sealIssueRecord(issueContent()), 'seal issue record')), 'admit issue');
        world.tracking = admission.store;
        world.issue = admission.record;
        return reportOf(step, {
          ok: true,
          valueDigest: admission.record.contentDigest,
          provenance: [sealedProvenance(admission.record as unknown as { contentDigest: string } & Record<string, unknown>, null)],
          identities: [{ surface: 'change-records', ids: [admission.record.recordId] }],
        });
      }

      // ------------------------------------------------------------------
      // The observation intake through the W036 AUTHORITY path.
      // ------------------------------------------------------------------
      case 'delivery.record-excavation':
      case 'delivery.record-deploy': {
        const observation =
          step.driverOp === 'delivery.record-excavation'
            ? world.fieldObservations.find((record) => record.recordId === EXCAVATION_OBSERVATION_ID)!
            : world.fieldObservations.find((record) => record.recordId === DEPLOY_OBSERVATION_ID)!;
        const recorded = need(recordObservation(world.delivery!, observation), `record ${step.driverOp} observation`);
        world.delivery = recorded;
        world.deliveryChain.push(recorded.contentDigest);
        const event = emit(world, 'delivery:observation-recorded', { observationId: observation.recordId, contentDigest: observation.contentDigest }, observation.recordedAt, OBSERVER);
        return reportOf(step, {
          ok: true,
          valueDigest: recorded.contentDigest,
          events: [event],
          provenance: [sealedProvenance(recorded as unknown as { contentDigest: string } & Record<string, unknown>, world.deliveryChain[world.deliveryChain.length - 2] ?? null)],
        });
      }
      case 'delivery.record-receipt': {
        const receipt = need(sealDistinctionRecord(receiptObservationContent()), 'seal receipt observation');
        const recorded = need(recordObservation(world.delivery!, receipt), 'record receipt observation');
        world.receiptObservation = receipt;
        world.delivery = recorded;
        world.deliveryChain.push(recorded.contentDigest);
        const event = emit(world, 'delivery:observation-recorded', { observationId: RECEIPT_OBSERVATION_ID, contentDigest: receipt.contentDigest }, T[8], OBSERVER);
        return reportOf(step, {
          ok: true,
          valueDigest: recorded.contentDigest,
          events: [event],
          provenance: [sealedProvenance(recorded as unknown as { contentDigest: string } & Record<string, unknown>, world.deliveryChain[world.deliveryChain.length - 2] ?? null)],
        });
      }
      case 'procurement.receive': {
        const receipt = world.receiptObservation!;
        let supplierDelivery = emptyDeliveryLog(PO_ID, TENANT);
        const poVersionDigest = world.orders!.orders[0]!.contentDigest;
        for (const [from, to] of [['ordered', 'confirmed'], ['confirmed', 'shipped']] as const) {
          supplierDelivery = need(
            appendSupplierDeliveryTransition(
              world.orders!,
              [receipt],
              supplierDelivery,
              need(sealSupplierDeliveryTransition({
                schema: 'epoch.procurement.supplier-delivery-transition',
                schemaVersion: 1,
                transitionId: `po-transition:steel-${to}`,
                tenantId: TENANT,
                poId: PO_ID,
                poVersionDigest,
                from,
                to,
                occurredAt: T[7],
                recordedBy: PROCUREMENT,
              }), `seal supplier transition (${to})`),
            ),
            `append supplier transition (${to})`,
          );
        }
        supplierDelivery = need(
          appendSupplierDeliveryTransition(
            world.orders!,
            [receipt],
            supplierDelivery,
            need(sealSupplierDeliveryTransition({
              schema: 'epoch.procurement.supplier-delivery-transition',
              schemaVersion: 1,
              transitionId: 'po-transition:steel-received',
              tenantId: TENANT,
              poId: PO_ID,
              poVersionDigest,
              from: 'shipped',
              to: 'received',
              receipt: {
                observationRef: { recordId: RECEIPT_OBSERVATION_ID, contentDigest: receipt.contentDigest },
                lines: [{ description: 'Structural steel sections grade S355', quantity: '4', unit: 'tonne' }],
                receivedAt: T[8],
                receivedBy: OBSERVER,
                note: 'Full delivery received at the gate',
              },
              occurredAt: T[8],
              recordedBy: OBSERVER,
            }), 'seal supplier transition (received)'),
          ),
          'append supplier transition (received)',
        );
        world.supplierDelivery = supplierDelivery;
        return reportOf(step, {
          ok: true,
          valueDigest: canonicalDigest({ state: foldSupplierDelivery(supplierDelivery).state, receiptCount: foldSupplierDelivery(supplierDelivery).receiptCount } as unknown as JsonValue),
          provenance: [sealedProvenance(supplierDelivery.transitions[supplierDelivery.transitions.length - 1] as unknown as { contentDigest: string } & Record<string, unknown>, poVersionDigest)],
        });
      }

      // ------------------------------------------------------------------
      // The SHARED W039 actualization fold (BOTH domains' observations).
      // ------------------------------------------------------------------
      case 'actualization.intake': {
        let actualization = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
        for (const observation of [...world.fieldObservations, world.receiptObservation!]) {
          const intaken = need(intakeObservation(actualization, observation), `intake observation (${observation.recordId})`);
          actualization = intaken.store;
        }
        world.actualization = actualization;
        return reportOf(step, {
          ok: true,
          valueDigest: canonicalDigest({ observations: actualization.observations.map((o) => o.recordId).sort() } as unknown as JsonValue),
          provenance: world.fieldObservations.concat(world.receiptObservation!).map((observation) =>
            sealedProvenance(observation as unknown as { contentDigest: string } & Record<string, unknown>, null),
          ),
        });
      }
      case 'actualization.assess': {
        const assessments = need(currentAssessments(world.actualization!, { mode: 'exact' }), 'current assessments');
        world.assessments = assessments;
        return reportOf(step, {
          ok: true,
          valueDigest: canonicalDigest({ assessments: assessments.map((a) => a.assessmentId).sort() } as unknown as JsonValue),
        });
      }
      case 'actualization.apply': {
        const assessments = [...world.assessments].sort((a, b) => (a.assessmentId < b.assessmentId ? -1 : 1));
        const foldProvenance: ProvenanceRecord[] = [];
        for (const assessment of assessments) {
          const observations = assessment.observationRefs.map((ref) =>
            world.actualization!.observations.find((observation) => observation.recordId === ref.recordId)!,
          );
          const applied = need(
            applyActualization(world.delivery!, assessment, observations, {
              acceptedBy: APPROVER,
              acceptedAt: T[9],
              actualizedBy: PRINCIPAL,
              actualizedAt: T[9],
            }),
            `apply actualization (${assessment.assessmentId})`,
          );
          // Every intermediate delivery head is a provenance record,
          // chained to its predecessor (the delivery digest chain, in-trace).
          foldProvenance.push(
            sealedProvenance(
              applied.delivery as unknown as { contentDigest: string } & Record<string, unknown>,
              world.delivery!.contentDigest,
            ),
          );
          world.delivery = applied.delivery;
          world.deliveryChain.push(applied.delivery.contentDigest);
        }
        need(verifySealedDeliveryRecord(world.delivery!), 'verify final sealed delivery record');
        const event = emit(
          world,
          'delivery:actualization-applied',
          { deliveryDigest: world.delivery!.contentDigest, actualIds: world.delivery!.actuals.map((actual) => actual.recordId).sort() },
          T[9],
          PRINCIPAL,
        );
        return reportOf(step, {
          ok: true,
          valueDigest: world.delivery!.contentDigest,
          events: [event],
          provenance: [
            ...foldProvenance,
            ...assessments.map((assessment) =>
              sealedProvenance(assessment as unknown as { contentDigest: string } & Record<string, unknown>, null),
            ),
          ],
          identities: [
            { surface: 'delivery-actuals', ids: world.delivery!.actuals.map((actual) => actual.recordId).sort() },
            { surface: 'delivery-observations', ids: world.delivery!.observations.map((observation) => observation.recordId).sort() },
          ],
        });
      }

      // ------------------------------------------------------------------
      // The W027 backlog projection over the SHARED (post-actualization)
      // delivery — the cross-domain projection check.
      // ------------------------------------------------------------------
      case 'projection.backlog': {
        const backlog = need(projectBacklog({ program: world.program!, delivery: world.delivery! }), 'project backlog');
        world.backlog = backlog;
        return reportOf(step, {
          ok: true,
          valueDigest: backlog.contentDigest,
          provenance: [sealedProvenance(backlog as unknown as { contentDigest: string } & Record<string, unknown>, world.delivery!.contentDigest)],
          identities: [
            { surface: 'backlog-epics', ids: backlog.epics.map((epic) => epic.workPackageId).sort() },
            { surface: 'backlog-issues', ids: backlog.issues.map((issue) => issue.activityId).sort() },
          ],
        });
      }

      // ------------------------------------------------------------------
      // W006 evidence (the variance evidence backbone).
      // ------------------------------------------------------------------
      case 'evidence.add': {
        const artifact = {
          note: 'field measurement of the excavated pit volume',
          observationId: EXCAVATION_OBSERVATION_ID,
          value: '118.5',
          unit: 'm3',
        };
        const receipt = world.evidence.add({
          schemaVersion: 1,
          kind: 'measurement',
          subject: { artifactId: `observation:${EXCAVATION_CAPTURE_KEY}`, revision: '1', digest: canonicalDigest(artifact) },
          producedBy: { runId: 'run:field-monday', actorId: OBSERVER },
          observedAt: T[4],
          content: { mediaType: 'application/json', data: artifact },
          confidence: { distribution: { kind: 'interval', lower: 0.9, upper: 0.99, bias: 'none' }, method: 'measured' },
        });
        if (!receipt.ok) {
          throw new Error(`cross-domain driver: evidence add failed: ${JSON.stringify(receipt.issues)}`);
        }
        return reportOf(step, {
          ok: true,
          valueDigest: receipt.receipt.digest,
          provenance: [{ content: artifact as unknown as JsonValue, claimedDigest: canonicalDigest(artifact), parentDigest: null }],
        });
      }

      // ------------------------------------------------------------------
      // The SHARED variance computation (BOTH domains, ONE ledger).
      // ------------------------------------------------------------------
      case 'variance.baseline-record': {
        const baseline = need(sealDistinctionRecord(baselineRecordContent(world.solution!)), 'seal baseline record');
        world.baselineRecord = baseline;
        return reportOf(step, {
          ok: true,
          valueDigest: baseline.contentDigest,
          provenance: [sealedProvenance(baseline as unknown as { contentDigest: string } & Record<string, unknown>, world.solution!.contentDigest)],
        });
      }
      case 'variance.compute-excavation':
      case 'variance.compute-deploy': {
        const isExcavation = step.driverOp === 'variance.compute-excavation';
        const varianceId = isExcavation ? VARIANCE_EXCAVATION_ID : VARIANCE_DEPLOY_ID;
        const subjectId = isExcavation ? ACTIVITY_EXCAVATION : ACTIVITY_DEPLOY_STAGING;
        const actualId = isExcavation ? EXCAVATION_ACTUAL_ID : DEPLOY_ACTUAL_ID;
        const actual = world.delivery!.actuals.find((candidate) => candidate.recordId === actualId);
        if (actual === undefined) {
          throw new Error(`cross-domain driver: actual ${actualId} missing after the shared fold`);
        }
        const variance = need(
          computeVariance({
            varianceId,
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            subjectKind: 'activity',
            subjectId,
            varianceClass: 'quantity',
            baselineRef: {
              kind: 'baseline',
              recordId: BASELINE_RECORD_ID,
              contentDigest: world.baselineRecord!.contentDigest,
            },
            actualRef: { kind: 'actual', recordId: actualId, contentDigest: actual.contentDigest },
            baselineMeasure: isExcavation
              ? { kind: 'quantity', value: '120', unit: 'm3' }
              : { kind: 'quantity', value: '24', unit: 'deliverable' },
            actualMeasure: isExcavation
              ? { kind: 'quantity', value: '118.5', unit: 'm3' }
              : { kind: 'quantity', value: '18', unit: 'deliverable' },
            evidence: [world.evidence.digests()[0]!],
            confidence: { method: 'measured', value: 0.95, rationale: 'grounded in the accepted delivery actuals' },
            thresholds: { minor: '10', material: '100', severe: '1000' },
            computedAt: T[8],
            computedBy: PRINCIPAL,
          }),
          `compute variance (${varianceId})`,
        );
        let ledger = world.varianceLedger ?? openVarianceLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
        ledger = need(admitVarianceRecord(ledger, variance), `admit variance record (${varianceId})`);
        world.varianceLedger = ledger;
        world.variances.push(variance);
        const event = emit(world, 'delivery:variance-computed', { varianceId, contentDigest: variance.contentDigest }, T[8], PRINCIPAL);
        return reportOf(step, {
          ok: true,
          valueDigest: variance.contentDigest,
          events: [event],
          provenance: [sealedProvenance(variance as unknown as { contentDigest: string } & Record<string, unknown>, world.delivery!.contentDigest)],
          identities: [{ surface: 'variance-records', ids: [...world.variances.map((record) => record.varianceId).sort()] }],
        });
      }
      case 'variance.attribute': {
        const variance = world.variances.find((record) => record.varianceId === VARIANCE_EXCAVATION_ID)!;
        const attribution = need(
          sealAttributionRecord({
            schema: 'epoch.variance.attribution-record',
            schemaVersion: 1,
            attributionId: ATTRIBUTION_ID,
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            varianceRef: { recordId: VARIANCE_EXCAVATION_ID, contentDigest: variance.contentDigest },
            cause: { causeKind: 'issue-record', recordId: ISSUE_ID, contentDigest: world.issue!.contentDigest },
            evidence: [world.evidence.digests()[0]!],
            note: 'the geometry revision changed the measured pit volume',
            attributedAt: T[8],
            attributedBy: PRINCIPAL,
          }),
          'seal attribution record',
        );
        const ledger = need(
          admitAttributionRecord(
            openAttributionLedger({ tenantId: TENANT, solutionId: SOLUTION_ID }),
            foldVarianceRecords(world.varianceLedger!),
            attribution,
          ),
          'admit attribution record',
        );
        world.attribution = attribution;
        const causes = causesOf(ledger, VARIANCE_EXCAVATION_ID);
        const event = emit(world, 'delivery:attribution-recorded', { attributionId: ATTRIBUTION_ID, contentDigest: attribution.contentDigest, varianceId: VARIANCE_EXCAVATION_ID }, T[8], PRINCIPAL);
        return reportOf(step, {
          ok: true,
          valueDigest: attribution.contentDigest,
          events: [event],
          provenance: [sealedProvenance(attribution as unknown as { contentDigest: string } & Record<string, unknown>, variance.contentDigest)],
          identities: [{ surface: 'attribution-causes', ids: causes.map((cause) => cause.cause.recordId).sort() }],
        });
      }

      // ------------------------------------------------------------------
      // The supervision-visible fold (cross-surface agreement).
      // ------------------------------------------------------------------
      case 'supervision.fold': {
        const actuals = foldDeliveryActuals(world.delivery!);
        const actualizationState = need(
          projectActualizationState(world.actualization!, world.delivery!, { mode: 'exact' }),
          'project actualization state',
        );
        const varianceSummary = foldVarianceSummary(world.varianceLedger!);
        const links = need(
          foldDeliveryLinks({ solution: world.solution!, program: world.program!, acquisitions: [world.acquisitionRequest!], delivery: world.delivery! }),
          'fold delivery links',
        );
        const executionState = projectExecutionState(world.tracking!);
        world.supervision = { actuals, actualizationState, varianceSummary, links, executionState };
        // The tamper-detection sweep: every sealed record verifies.
        need(verifySealedDeliveryRecord(world.delivery!), 'supervision: verify delivery');
        need(verifySealedProgramOfWork(world.program!), 'supervision: verify program');
        for (const observation of world.delivery!.observations) {
          need(verifySealedDistinctionRecord(observation), 'supervision: verify observation');
        }
        return reportOf(step, {
          ok: true,
          valueDigest: canonicalDigest({
            deliveryDigest: world.delivery!.contentDigest,
            total: actuals.totals.length,
            varianceClasses: varianceSummary.length,
            linkRows: links.rows.length,
          } as unknown as JsonValue),
          identities: [
            { surface: 'solution-lines', ids: world.solution!.solutionLines.map((line) => line.lineId).sort() },
            { surface: 'delivery-link-lines', ids: links.rows.map((row) => row.solutionLineId).sort() },
          ],
        });
      }

      // ------------------------------------------------------------------
      // Recovery: replay, tamper detection, verified-prefix continuation.
      // ------------------------------------------------------------------
      case 'recovery.replay': {
        const records = need(world.log.readStream(DELIVERY_STREAM_ID), 'read lifecycle stream');
        const fold = foldVerified(records);
        if (fold.failure !== null) {
          throw new Error(`cross-domain driver: untampered replay failed: ${fold.failure.code}`);
        }
        world.recovery = {
          replayedStateDigest: lifecycleStateDigest(fold.state),
          tamperIndex: 0,
          prefixDigest: '',
          tamperedPrefixDigest: '',
          continued: false,
        };
        return reportOf(step, {
          ok: true,
          valueDigest: lifecycleStateDigest(fold.state),
          provenance: records.map((record) => ({
            content: record.event as unknown as JsonValue,
            claimedDigest: record.contentDigest,
            parentDigest:
              record.event.causalParent === null
                ? null
                : (records.find((candidate) => candidate.event.sequence === record.event.causalParent?.sequence)?.contentDigest ?? null),
          })),
        });
      }
      case 'recovery.tamper': {
        const input = (step.input ?? {}) as Record<string, unknown>;
        const tamperIndex = Number(input.tamperIndex ?? 4);
        const records = need(world.log.readStream(DELIVERY_STREAM_ID), 'read lifecycle stream (tamper)');
        if (tamperIndex >= records.length) {
          throw new Error(`cross-domain driver: tamper index ${tamperIndex} out of range (${records.length} records)`);
        }
        // Mutate a mid-stream record's payload, KEEP the claimed digest.
        const tampered: EventRecord[] = records.map((record, index) => {
          if (index !== tamperIndex) return record;
          return {
            event: {
              ...record.event,
              payload: {
                ...record.event.payload,
                data: { ...(record.event.payload.data as Record<string, unknown>), contentDigest: 'f'.repeat(64) },
              },
            },
            contentDigest: record.contentDigest,
          };
        });
        // The append of the tampered record is REFUSED by the log (typed
        // digest-mismatch): the integrity gate, exercised for real.
        const refused = world.log.appendEvent({
          event: tampered[tamperIndex]!.event,
          digest: tampered[tamperIndex]!.contentDigest,
        });
        if (refused.ok) {
          throw new Error('cross-domain driver: the log ACCEPTED a tampered record (integrity gate open)');
        }
        const fold = foldVerified(tampered);
        if (fold.failure === null) {
          throw new Error('cross-domain driver: the verified fold did not detect the tamper');
        }
        // NO world mutation here: a refused append must leave zero state
        // delta (asserted by the authority-routing invariant). The prefix
        // evidence is recomputed + recorded by recovery.prefix-continue.
        return reportOf(step, {
          ok: false,
          valueDigest: null,
          errorCode: refused.error.code,
          errorMessage: (refused.error as { message?: string }).message ?? 'tampered append refused',
          authorityRejection: { code: refused.error.code, message: 'the event log refuses a tampered record (digest verification failed)' },
        });
      }
      case 'recovery.prefix-continue': {
        // Recompute the tamper + prefix folds from the pristine stream and
        // record the continuation evidence (a public read-only analysis).
        const input = (step.input ?? {}) as Record<string, unknown>;
        const tamperIndex = Number(input.tamperIndex ?? (world.recovery?.tamperIndex ?? 5));
        const pristine = need(world.log.readStream(DELIVERY_STREAM_ID), 'read lifecycle stream (prefix-continue)');
        const tamperedRecords = pristine.map((record, index) => {
          if (index !== tamperIndex) return record;
          return {
            event: {
              ...record.event,
              payload: {
                ...record.event.payload,
                data: { ...(record.event.payload.data as Record<string, unknown>), contentDigest: 'f'.repeat(64) },
              },
            },
            contentDigest: record.contentDigest,
          };
        });
        const tamperedFold = foldVerified(tamperedRecords);
        const prefixFold = foldVerified(pristine.slice(0, tamperIndex));
        const value = {
          prefixDigest: lifecycleStateDigest(prefixFold.state),
          tamperedPrefixDigest: lifecycleStateDigest(tamperedFold.state),
          continuedAtIndex: tamperIndex,
          tamperDetectedAt: tamperedFold.verifiedCount,
          prefixContinuationVerified:
            lifecycleStateDigest(prefixFold.state) === lifecycleStateDigest(tamperedFold.state) &&
            tamperedFold.verifiedCount === tamperIndex,
        };
        world.recovery = {
          replayedStateDigest: world.recovery?.replayedStateDigest ?? '',
          tamperIndex,
          prefixDigest: value.prefixDigest,
          tamperedPrefixDigest: value.tamperedPrefixDigest,
          continued: value.prefixContinuationVerified,
        };
        return reportOf(step, {
          ok: true,
          valueDigest: canonicalDigest(value as unknown as JsonValue),
        });
      }

      // ------------------------------------------------------------------
      // The negatives: cross-tenant denial + authority-bypass rejection.
      // ------------------------------------------------------------------
      case 'delivery.observe-foreign': {
        const foreign = need(
          sealDistinctionRecord({
            schema: 'epoch.solution-delivery.distinction-record',
            schemaVersion: 1,
            kind: 'observation',
            recordId: 'observation:foreign-pit-volume',
            tenantId: OTHER_TENANT,
            subject: {
              solutionId: SOLUTION_ID,
              subjectKind: 'activity',
              subjectId: ACTIVITY_EXCAVATION,
            },
            measure: { kind: 'quantity', value: '1', unit: 'm3' },
            payload: {
              deliveryId: DELIVERY_ID,
              observedAt: T[4],
              observedBy: OBSERVER,
              evidence: [],
            },
            recordedAt: T[4],
            recordedBy: OBSERVER,
            uncertainty: uncertainty(),
          }),
          'seal foreign observation',
        );
        const denied = recordObservation(world.delivery!, foreign);
        if (denied.ok) {
          throw new Error('cross-domain driver: a cross-tenant observation was ACCEPTED (boundary open)');
        }
        return reportOf(step, {
          ok: false,
          valueDigest: null,
          errorCode: denied.error.code,
          errorMessage: (denied.error as { message?: string }).message ?? 'cross-tenant denial',
          denial: {
            code: denied.error.code,
            expectedTenantId: String((denied.error as Record<string, unknown>).expectedTenantId ?? TENANT),
            encounteredTenantId: String((denied.error as Record<string, unknown>).encounteredTenantId ?? OTHER_TENANT),
          },
        });
      }
      case 'baseline.revise': {
        const refused = reviseSolutionBaseline(world.approval!, { note: 'attempted scope edit' });
        if (refused.ok) {
          throw new Error('cross-domain driver: a baseline revision was ACCEPTED (authority bypassed)');
        }
        return reportOf(step, {
          ok: false,
          valueDigest: null,
          errorCode: refused.error.code,
          errorMessage: (refused.error as { message?: string }).message ?? 'baseline mutation refused',
          authorityRejection: {
            code: refused.error.code,
            message: (refused.error as { message?: string }).message ?? 'the baseline is immutable once approved',
          },
        });
      }
      default:
        throw new Error(`cross-domain driver: unknown op "${step.driverOp}"`);
    }
  },
};
