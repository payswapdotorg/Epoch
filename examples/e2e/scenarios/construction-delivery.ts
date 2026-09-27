// W031 Reference E2E slice 1 — the CONSTRUCTION DELIVERY scenario definition.
//
// The construction path, traversed end-to-end through REAL kernels (no
// mocks; every record is built through the kernel admission paths):
//
//   W026 pack profile
//     -> W036 solution version -> baseline approval
//     -> W036 program of work
//     -> W026 BOQ projection (identity-mapped plan lines)
//     -> W037 procurement chain (acquire: request -> package -> quote ->
//        selection -> commitment -> purchase order -> supplier receipt)
//     -> W038 field observation intake (realize)
//     -> W036 observation intake through the DELIVERY AUTHORITY PATH
//     -> W039 validation + actualization fold (the only bridge from
//        accepted observations to authoritative delivery state)
//     -> W039 variance record with attribution (real evidence + a real
//        W038 change record as the cause)
//     -> supervision-visible state (delivery actuals, actualization
//        projection, variance summary, delivery links, programme view)
//     -> a W010 event stream recording the delivery lifecycle facts
//        (consumed by the recovery slice).
//
// DETERMINISM: every instant is a shared constant; every id is explicit;
// the scenario is a pure function of its inputs. Running it twice in the
// same process yields byte-identical digests (asserted by the slice test
// via constructionDeliveryDigestProjection).
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
  admitAcquisitionRequest,
  admitSolutionVersion,
  approveSolutionBaseline,
  buildProgramOfWork,
  foldDeliveryActuals,
  openDeliveryRecord,
  recordObservation,
  sealDistinctionRecord,
  sealSolutionVersion,
  verifySealedDeliveryRecord,
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
  admitIssue,
  buildProgramIndex,
  intakeFieldObservation,
  openExecutionTrackingStore,
  projectExecutionState,
  sealIssueRecord,
  sealTrackingStateRecord,
  admitTrackingState,
  type ExecutionStateProjection,
  type ExecutionTrackingStore,
  type SealedIssueRecord,
} from '@epoch/execution-tracking';
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
  type SelectionStore,
  type SupplierDeliveryLog,
} from '@epoch/procurement';
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
import { canonicalDigest, type JsonValue } from '@epoch/action-policy';
import { EvidenceStore, type EvidenceStore as EvidenceStoreType } from '@epoch/evidence';
import { EventLog, sealEvent, type EventContent } from '@epoch/event-log';
import {
  APPROVER,
  DIGEST,
  FOREMAN,
  OBSERVER,
  PRINCIPAL,
  PROCUREMENT,
  T,
  TENANT,
  derivedUncertainty,
  uncertainty,
} from './shared';

// --------------------------------------------------------------------------------
// Scenario vocabulary (explicit ids — no minting, no clock).
// --------------------------------------------------------------------------------

export const SOLUTION_ID = 'solution:warehouse-extension';
export const PROGRAM_ID = 'program:warehouse-extension-v1';
export const DELIVERY_ID = 'delivery:warehouse-extension-v1';
export const DELIVERY_STREAM_ID = 'stream:delivery-warehouse-v1';
export const ACTUALIZATION_STREAM_ID = 'stream:actualization-warehouse-v1';

export const LINE_EXCAVATION = 'line:bulk-excavation';
export const LINE_CONCRETE = 'line:concrete-foundations';
export const LINE_STEEL = 'line:steel-frame';

export const WORK_PACKAGE_SUBSTRUCTURE = 'work-package:substructure';
export const WORK_PACKAGE_SUPERSTRUCTURE = 'work-package:superstructure';
export const ACTIVITY_EXCAVATION = 'activity:excavation-bulk';
export const ACTIVITY_CONCRETE = 'activity:foundation-concrete';
export const ACTIVITY_STEEL = 'activity:steel-erection';
export const MILESTONE_FOUNDATIONS = 'milestone:foundations-complete';

export const ACQUISITION_ID = 'acquisition:steel-supply';
export const PACKAGE_ID = 'package:steel-supply';
export const QUOTE_ID = 'quote:steel-supply-alpha';
export const SELECTION_ID = 'selection:steel-supply-alpha';
export const COMMITMENT_ID = 'commitment:steel-supply-order-1';
export const PO_ID = 'po:steel-supply-001';
export const SUPPLIER = 'supplier:alpha-steel';

export const FIELD_CAPTURE_KEY = 'pit-progress-monday';
export const FIELD_OBSERVATION_ID = `observation:field-${FIELD_CAPTURE_KEY}`;
export const FIELD_ACTUAL_ID = `actual:field-${FIELD_CAPTURE_KEY}`;
export const RECEIPT_OBSERVATION_ID = 'observation:steel-receipt';
export const RECEIPT_ACTUAL_ID = 'actual:steel-receipt';
export const BASELINE_RECORD_ID = 'baseline:excavation-quantity';
export const VARIANCE_ID = 'variance:excavation-quantity';
export const ATTRIBUTION_ID = 'attribution:excavation-geometry';
export const ISSUE_ID = 'change:pit-geometry-revision';

/** The scenario's world entities (W002 type keys for the pack bindings). */
const WORLD_ENTITIES = [
  { id: 'element-foundations', type: 'construction:element' },
  { id: 'element-frame', type: 'construction:element' },
] as const;

/** Unwrap helper: scenario builders fail LOUDLY on impossible admissions. */
function need<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, label: string): T {
  if (!result.ok) {
    throw new Error(`construction-delivery scenario: ${label} failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

// --------------------------------------------------------------------------------
// The scenario result: every intermediate, for cross-surface assertions.
// --------------------------------------------------------------------------------

export interface ConstructionDeliveryScenario {
  /** The admitted W026 construction pack profile digest. */
  readonly packProfileDigest: string;
  /** The sealed solution version (the baseline authority input). */
  readonly solution: SealedSolutionVersion;
  /** The baseline approval (the authority act). */
  readonly approval: BaselineApproval;
  /** The sealed program of work. */
  readonly program: SealedProgramOfWork;
  /** The W026 BOQ projection (identity-mapped plan lines). */
  readonly boq: BoqView;
  /** The W026 construction programme projection. */
  readonly programme: ConstructionProgrammeView;
  /** The W026 delivery link index (line -> packages -> observations -> actuals). */
  readonly deliveryLinks: DeliveryLinkIndex;
  /** The W036 admitted acquisition request. */
  readonly acquisitionRequest: AcquisitionRequestRecord;
  /** The W037 purchase-order store (after admission). */
  readonly orders: PurchaseOrderStore;
  /** The W037 supplier delivery log (after the receipt). */
  readonly supplierDelivery: SupplierDeliveryLog;
  /** The W038 execution tracking store (field intake + issue + tracking). */
  readonly tracking: ExecutionTrackingStore;
  /** The W038 change record used as the variance attribution cause. */
  readonly issue: SealedIssueRecord;
  /** The W036 receipt observation (procurement -> delivery intake). */
  readonly receiptObservation: SealedDistinctionRecord;
  /** The final sealed delivery record (after actualization). */
  readonly delivery: SealedDeliveryRecord;
  /** Every delivery-record digest in chain order (the state chain). */
  readonly deliveryDigestChain: readonly string[];
  /** The W039 actualization store (after intake). */
  readonly actualization: ActualizationStore;
  /** The W039 validation assessments (one per observation group). */
  readonly assessments: readonly SealedValidationAssessment[];
  /** The sealed W039 actualization events (the digest chain of the fold). */
  readonly actualizationEvents: readonly SealedActualizationEvent[];
  /** The sealed W036 baseline distinction record (the variance baseline). */
  readonly baselineRecord: SealedDistinctionRecord;
  /** The W039 variance record. */
  readonly variance: SealedVarianceRecord;
  /** The variance ledger (after admission). */
  readonly varianceLedger: VarianceLedger;
  /** The W039 attribution record. */
  readonly attribution: SealedAttributionRecord;
  /** The real W006 evidence store backing the variance evidence. */
  readonly evidence: EvidenceStoreType;
  /** The supervision-visible actuals fold. */
  readonly actuals: DeliveryActualsSummary;
  /** The supervision-visible actualization projection (validation groups). */
  readonly actualizationState: ActualizationStateProjection;
  /** The supervision-visible variance summary. */
  readonly varianceSummary: readonly VarianceClassSummary[];
  /** The supervision-visible execution state projection (W038). */
  readonly executionState: ExecutionStateProjection;
  /** The attribution causes of the variance record. */
  readonly causes: readonly SealedAttributionRecord[];
  /** The W010 event stream of the delivery lifecycle (for the recovery slice). */
  readonly events: readonly EventContent[];
  /** The event log holding the stream. */
  readonly log: EventLog;
}

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
    title: 'Warehouse extension programme',
    workPackages: [
      {
        workPackageId: WORK_PACKAGE_SUBSTRUCTURE,
        title: 'Substructure works',
        description: 'Excavation and reinforced concrete foundations',
        solutionLineId: LINE_EXCAVATION,
        worldEntityId: 'element-foundations',
        realizationVariant: 'construction-build',
        plannedStart: T[3],
        plannedFinish: T[5],
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
            workPackageId: WORK_PACKAGE_SUBSTRUCTURE,
            title: 'Bulk excavation to formation level',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '120', unit: 'm3' },
            plannedCost: { amount: '2220.00', currency: 'EUR' },
            plannedStart: T[3],
            plannedFinish: T[4],
            predecessors: [],
            successors: [ACTIVITY_CONCRETE],
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
            activityId: ACTIVITY_CONCRETE,
            workPackageId: WORK_PACKAGE_SUBSTRUCTURE,
            title: 'Pour reinforced concrete foundations',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '85', unit: 'm3' },
            plannedCost: { amount: '17850.00', currency: 'EUR' },
            plannedStart: T[4],
            plannedFinish: T[5],
            predecessors: [ACTIVITY_EXCAVATION],
            successors: [ACTIVITY_STEEL],
            resources: [],
            responsibleActor: PRINCIPAL,
            constraintReferences: [],
            actualProgress: 1,
            actualStart: T[4],
            actualFinish: T[5],
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
        plannedStart: T[5],
        plannedFinish: T[7],
        responsibleActor: 'principal:steel-lead',
        resources: [{ resourceId: 'resource:mobile-crane', quantity: '4', unit: 'day' }],
        constraintReferences: [{ constraintId: 'max-building-height' }],
        approvals: [],
        verificationGates: [
          {
            gateId: 'gate:steel-certificate',
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
            plannedStart: T[5],
            plannedFinish: T[7],
            predecessors: [ACTIVITY_CONCRETE],
            successors: [],
            resources: [{ resourceId: 'resource:mobile-crane', quantity: '4', unit: 'day' }],
            responsibleActor: 'principal:steel-lead',
            constraintReferences: [],
            actualProgress: 0.5,
            actualStart: T[6],
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
        activityIds: [ACTIVITY_EXCAVATION, ACTIVITY_CONCRETE],
        status: 'reached',
        reachedAt: T[5],
        evidence: [{ digest: DIGEST('b') }],
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
    observedAt: T[4],
    observedBy: OBSERVER,
    subjectRef: { kind: 'activity', id: ACTIVITY_EXCAVATION },
    measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    uncertainty: uncertainty(),
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
      subjectId: WORK_PACKAGE_SUPERSTRUCTURE,
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
// The scenario runner.
// --------------------------------------------------------------------------------

export function runConstructionDeliveryScenario(): ConstructionDeliveryScenario {
  // -- W026: the construction pack profile (admitted through the W036 gate).
  const profile = constructionPackProfile(TENANT);
  const admittedProfile = need(admitConstructionPackProfile(profile), 'admit construction pack profile');
  const packProfileDigest = digestPackProfile(admittedProfile);

  // -- W036: solution version -> chain admission -> baseline approval.
  const solution = need(sealSolutionVersion(solutionContent()), 'seal solution version');
  need(admitSolutionVersion([], solution), 'admit solution version');
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
      approvedAt: T[2],
      decisionNote: 'approved after simulation review',
    }),
    'approve solution baseline',
  );
  const approval = approvalOutcome.approval;

  // -- W036: the program of work (the universal schedule).
  const program = need(buildProgramOfWork(programContent(solution)), 'build program of work');
  need(verifySealedProgramOfWork(program), 'verify sealed program of work');

  // -- W026: the BOQ projection (identity-mapped plan lines) + programme +
  //    delivery links (supervision-visible cross-surface identity).
  const boq = need(
    projectBoq({
      solution,
      program,
      worldEntities: [...WORLD_ENTITIES],
    }),
    'project BOQ',
  );
  // -- W036 -> W037: the procurement chain (the Acquire projection).
  const acquisitionRequest = need(admitAcquisitionRequest(acquisitionRequestContent()), 'admit acquisition request');
  const pkg = need(sealAcquisitionPackage(packageContent(acquisitionRequest)), 'seal acquisition package');
  const packages = need(admitAcquisitionPackage([acquisitionRequest], emptyPackageStore(), pkg), 'admit acquisition package');
  const packageDigest = packages.packages[0]!.contentDigest;
  const quote = need(sealQuote(quoteContent(packageDigest)), 'seal quote');
  const quotes: QuoteStore = need(admitQuote(packages, emptyQuoteStore(), quote), 'admit quote');
  const quoteDigest = quotes.quotes[0]!.contentDigest;
  const selection = need(sealQuoteSelection(selectionContent(packageDigest, quoteDigest)), 'seal quote selection');
  const selections: SelectionStore = need(
    admitQuoteSelection(packages, quotes, emptySelectionStore(), selection),
    'admit quote selection',
  );
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

  // -- W038: the execution tracking store over the program index.
  const programIndex = need(buildProgramIndex(program), 'build program index');
  let tracking = need(
    openExecutionTrackingStore({ tenantId: TENANT, solutionId: SOLUTION_ID, programIndex }),
    'open execution tracking store',
  );

  // The low-friction field observation (REALIZE): one call carries the
  // observed measure; the intake infers the work-package linkage.
  const intake = need(intakeFieldObservation(tracking, fieldCapture()), 'intake field observation');
  tracking = intake.store;
  const fieldObservation = intake.observation.record;

  // The change record (the variance attribution cause).
  const issue = need(admitIssue(tracking, need(sealIssueRecord(issueContent()), 'seal issue record')), 'admit issue').record;

  // A tracking-state record for the substructure package (supervision view).
  const trackingState = need(
    admitTrackingState(
      tracking,
      need(sealTrackingStateRecord({
        schema: 'epoch.execution-tracking.tracking-state',
        schemaVersion: 1,
        recordId: 'state:substructure-completed',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        subject: { workPackageId: WORK_PACKAGE_SUBSTRUCTURE },
        fromState: 'not-started',
        toState: 'completed',
        cause: 'formation inspected and foundations poured',
        note: 'Formation inspection passed; foundation concrete cured to strength',
        observedAt: T[5],
        recordedAt: T[5],
        recordedBy: PRINCIPAL,
        evidenceLinks: [],
        uncertainty: uncertainty(),
      }), 'seal tracking state record'),
    ),
    'admit tracking state',
  );
  tracking = trackingState.store;

  // -- W036: the delivery record + observation intake (the AUTHORITY path).
  let delivery = need(
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
  const deliveryDigestChain: string[] = [delivery.contentDigest];

  const recordedField = need(recordObservation(delivery, fieldObservation), 'record field observation');
  delivery = recordedField;
  deliveryDigestChain.push(delivery.contentDigest);

  const receiptObservation = need(sealDistinctionRecord(receiptObservationContent()), 'seal receipt observation');
  const recordedReceipt = need(recordObservation(delivery, receiptObservation), 'record receipt observation');
  delivery = recordedReceipt;
  deliveryDigestChain.push(delivery.contentDigest);

  // -- W037: the supplier delivery log with the receipt (linked to the W036
  //    observation intake — the receipt IS the observation).
  let supplierDelivery = emptyDeliveryLog(PO_ID, TENANT);
  const poVersionDigest = orders.orders[0]!.contentDigest;
  supplierDelivery = need(
    appendSupplierDeliveryTransition(
      orders,
      [receiptObservation],
      supplierDelivery,
      need(sealSupplierDeliveryTransition({
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
      }), 'seal supplier transition (confirmed)'),
    ),
    'append supplier delivery transition (confirmed)',
  );
  supplierDelivery = need(
    appendSupplierDeliveryTransition(
      orders,
      [receiptObservation],
      supplierDelivery,
      need(sealSupplierDeliveryTransition({
        schema: 'epoch.procurement.supplier-delivery-transition',
        schemaVersion: 1,
        transitionId: 'po-transition:steel-shipped',
        tenantId: TENANT,
        poId: PO_ID,
        poVersionDigest,
        from: 'confirmed',
        to: 'shipped',
        occurredAt: T[7],
        recordedBy: PROCUREMENT,
      }), 'seal supplier transition (shipped)'),
    ),
    'append supplier delivery transition (shipped)',
  );
  supplierDelivery = need(
    appendSupplierDeliveryTransition(
      orders,
      [receiptObservation],
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
          observationRef: { recordId: RECEIPT_OBSERVATION_ID, contentDigest: receiptObservation.contentDigest },
          lines: [{ description: 'Structural steel sections grade S355', quantity: '4', unit: 'tonne' }],
          receivedAt: T[8],
          receivedBy: OBSERVER,
          note: 'Full delivery received at the gate',
        },
        occurredAt: T[8],
        recordedBy: OBSERVER,
      }), 'seal supplier transition (received)'),
    ),
    'append supplier delivery transition (received)',
  );

  // -- W039: validation + the actualization fold (the only bridge from
  //    accepted observations to authoritative delivery state — it drives
  //    the REAL W036 recordObservation -> acceptObservation ->
  //    actualizeObservation path internally).
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
        causalParent:
          actualizationSequence === 1
            ? null
            : { streamId: ACTUALIZATION_STREAM_ID, sequence: actualizationSequence - 1 },
        payload: { discriminator, data },
        occurredAt,
      }),
      `seal actualization event ${actualizationSequence}`,
    );
    need(verifySealedActualizationEvent(sealed), `verify actualization event ${actualizationSequence}`);
    actualizationEvents.push(sealed);
  };

  const intaken = need(intakeObservation(actualization, fieldObservation), 'intake field observation (actualization)');
  actualization = intaken.store;
  emitActualizationEvent(
    'actualization:observation-intaken',
    {
      deliveryId: DELIVERY_ID,
      observationId: FIELD_OBSERVATION_ID,
      subjectKind: 'activity',
      measureKind: 'quantity',
      admission: intaken.admission.kind,
      intakenAt: T[6],
    },
    T[6],
  );
  const intakenReceipt = need(intakeObservation(actualization, receiptObservation), 'intake receipt observation (actualization)');
  actualization = intakenReceipt.store;
  emitActualizationEvent(
    'actualization:observation-intaken',
    {
      deliveryId: DELIVERY_ID,
      observationId: RECEIPT_OBSERVATION_ID,
      subjectKind: 'work-package',
      measureKind: 'quantity',
      admission: intakenReceipt.admission.kind,
      intakenAt: T[8],
    },
    T[8],
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
        assessedAt: T[6],
      },
      T[6],
    );
  }

  for (const assessment of [...assessments].sort((a, b) => (a.assessmentId < b.assessmentId ? -1 : 1))) {
    const observations = assessment.observationRefs.map((ref) =>
      actualization.observations.find((observation) => observation.recordId === ref.recordId)!,
    );
    const applied = need(
      applyActualization(delivery, assessment, observations, {
        acceptedBy: APPROVER,
        acceptedAt: T[9],
        actualizedBy: PRINCIPAL,
        actualizedAt: T[9],
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
        actualizedAt: T[9],
      },
      T[9],
    );
  }
  need(verifySealedDeliveryRecord(delivery), 'verify final sealed delivery record');

  // -- W039: the baseline distinction record (the variance baseline side).
  const baselineRecord = need(sealDistinctionRecord(baselineRecordContent(solution)), 'seal baseline record');

  // -- W006: real evidence records backing the variance + attribution.
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
    subject: { artifactId: `observation:${FIELD_CAPTURE_KEY}`, revision: '1', digest: canonicalDigest(fieldArtifact) },
    producedBy: { runId: 'run:field-monday', actorId: OBSERVER },
    observedAt: T[4],
    content: { mediaType: 'application/json', data: fieldArtifact },
    confidence: { distribution: { kind: 'interval', lower: 0.9, upper: 0.99, bias: 'none' }, method: 'measured' },
  });
  if (!fieldEvidence.ok) {
    throw new Error(`construction-delivery scenario: field evidence failed: ${JSON.stringify(fieldEvidence.issues)}`);
  }

  // -- W039: the variance record (baseline vs actual, real references).
  const excavationActual = delivery.actuals.find((actual) => actual.recordId === FIELD_ACTUAL_ID);
  if (excavationActual === undefined) {
    throw new Error('construction-delivery scenario: excavation actual missing after the fold');
  }
  const variance = need(
    computeVariance({
      varianceId: VARIANCE_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_EXCAVATION,
      varianceClass: 'quantity',
      baselineRef: {
        kind: 'baseline',
        recordId: BASELINE_RECORD_ID,
        contentDigest: baselineRecord.contentDigest,
      },
      actualRef: {
        kind: 'actual',
        recordId: FIELD_ACTUAL_ID,
        contentDigest: excavationActual.contentDigest,
      },
      baselineMeasure: { kind: 'quantity', value: '120', unit: 'm3' },
      actualMeasure: { kind: 'quantity', value: '118.5', unit: 'm3' },
      evidence: [fieldEvidence.receipt.digest],
      confidence: { method: 'measured', value: 0.95, rationale: 'grounded in the accepted delivery actuals' },
      thresholds: { minor: '10', material: '100', severe: '1000' },
      computedAt: T[9],
      computedBy: PRINCIPAL,
    }),
    'compute variance',
  );
  let varianceLedger = openVarianceLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
  varianceLedger = need(admitVarianceRecord(varianceLedger, variance), 'admit variance record');

  // -- W039: the attribution (real W038 change record as the cause, real
  //    evidence digests).
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
      attributedAt: T[9],
      attributedBy: PRINCIPAL,
    }),
    'seal attribution record',
  );
  const attributionLedger = need(
    admitAttributionRecord(openAttributionLedger({ tenantId: TENANT, solutionId: SOLUTION_ID }), foldVarianceRecords(varianceLedger), attribution),
    'admit attribution record',
  );
  const causes = causesOf(attributionLedger, VARIANCE_ID);

  // -- Supervision-visible state.
  const actuals = foldDeliveryActuals(delivery);
  const actualizationState = need(
    projectActualizationState(actualization, delivery, policy),
    'project actualization state',
  );
  const varianceSummary = foldVarianceSummary(varianceLedger);
  const supervisionLinks = need(
    foldDeliveryLinks({ solution, program, acquisitions: [acquisitionRequest], delivery }),
    'fold supervision delivery links',
  );
  const executionState = projectExecutionState(tracking);
  const finalProgramme = need(projectConstructionProgramme(program), 'project final programme');

  // -- The W010 event stream of the delivery lifecycle (recovery input).
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
  emit('delivery:solution-sealed', { solutionId: SOLUTION_ID, version: solution.version, contentDigest: solution.contentDigest }, T[1], PRINCIPAL);
  emit('delivery:baseline-approved', { approvalId: approval.approvalId, baselineDigest: approval.baselineDigest }, T[2], APPROVER);
  emit('delivery:program-built', { programId: PROGRAM_ID, contentDigest: program.contentDigest }, T[2], PRINCIPAL);
  emit('delivery:po-issued', { poId: PO_ID, contentDigest: orders.orders[0]!.contentDigest }, T[6], PROCUREMENT);
  emit('delivery:observation-recorded', { observationId: FIELD_OBSERVATION_ID, contentDigest: fieldObservation.contentDigest }, T[6], OBSERVER);
  emit('delivery:observation-recorded', { observationId: RECEIPT_OBSERVATION_ID, contentDigest: receiptObservation.contentDigest }, T[8], OBSERVER);
  emit('delivery:actualization-applied', { deliveryDigest: delivery.contentDigest, actualIds: delivery.actuals.map((actual) => actual.recordId).sort() }, T[6], PRINCIPAL);
  emit('delivery:variance-computed', { varianceId: VARIANCE_ID, contentDigest: variance.contentDigest }, T[9], PRINCIPAL);
  emit('delivery:attribution-recorded', { attributionId: ATTRIBUTION_ID, contentDigest: attribution.contentDigest, varianceId: VARIANCE_ID }, T[9], PRINCIPAL);

  const log = new EventLog({ expectedTenantId: TENANT });
  for (const event of events) {
    const sealed = need(sealEvent(event), `seal lifecycle event ${event.sequence}`);
    need(log.appendEvent(sealed), `append lifecycle event ${event.sequence}`);
  }

  return {
    packProfileDigest,
    solution,
    approval,
    program,
    boq,
    programme: finalProgramme,
    deliveryLinks: supervisionLinks,
    acquisitionRequest,
    orders,
    supplierDelivery,
    tracking,
    issue,
    receiptObservation,
    delivery,
    deliveryDigestChain,
    actualization,
    assessments,
    actualizationEvents,
    baselineRecord,
    variance,
    varianceLedger,
    attribution,
    evidence,
    actuals,
    actualizationState,
    varianceSummary,
    executionState,
    causes,
    events,
    log,
  };
}

// --------------------------------------------------------------------------------
// The digest projection (determinism evidence): every key digest of the
// scenario, canonically ordered. Two runs -> byte-identical digest.
// --------------------------------------------------------------------------------

export function constructionDeliveryDigestProjection(
  scenario: ConstructionDeliveryScenario,
): Record<string, string | readonly string[]> {
  return {
    packProfileDigest: scenario.packProfileDigest,
    solutionDigest: scenario.solution.contentDigest,
    baselineApprovalDigest: scenario.approval.baselineDigest,
    programDigest: scenario.program.contentDigest,
    boqDigest: scenario.boq.contentDigest,
    programmeDigest: scenario.programme.contentDigest,
    poDigest: scenario.orders.orders[0]!.contentDigest,
    supplierDeliveryState: foldSupplierDelivery(scenario.supplierDelivery).state,
    observationDigests: [...scenario.delivery.observations]
      .map((observation) => observation.contentDigest)
      .sort(),
    deliveryDigest: scenario.delivery.contentDigest,
    deliveryDigestChain: scenario.deliveryDigestChain,
    actualizationEventDigests: scenario.actualizationEvents.map((event) => event.contentDigest),
    baselineRecordDigest: scenario.baselineRecord.contentDigest,
    varianceDigest: scenario.variance.contentDigest,
    attributionDigest: scenario.attribution.contentDigest,
    actualDigests: [...scenario.delivery.actuals].map((actual) => actual.contentDigest).sort(),
  };
}
