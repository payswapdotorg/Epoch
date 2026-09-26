// Shared fixtures for the solution-delivery kernel tests. Builders return
// loose JSON objects so negative tests can corrupt single fields precisely
// (the W006/W007/W023 helpers pattern). ZERO clock reads: every instant is
// a fixed constant (producer-supplied payload data).
import {
  sealSolutionVersion,
  sealDistinctionRecord,
  ObservationRecordSchema,
  BaselineApprovalSchema,
  buildProgramOfWork,
  openDeliveryRecord,
  type SealedSolutionVersion,
  type SealedProgramOfWork,
  type SealedDeliveryRecord,
  type ObservationRecord,
  type BaselineApproval,
  type DistinctionLedger,
} from '../src/index';

export const T0 = '2026-02-10T09:00:00.000Z';
export const T1 = '2026-02-10T09:00:01.000Z';
export const T2 = '2026-02-10T09:00:02.000Z';
export const T3 = '2026-02-10T09:00:03.000Z';
export const T4 = '2026-02-10T09:00:04.000Z';
export const T5 = '2026-02-10T09:00:05.000Z';
export const T6 = '2026-02-10T09:00:06.000Z';
export const T7 = '2026-02-10T09:00:07.000Z';
export const T8 = '2026-02-10T09:00:08.000Z';
export const T9 = '2026-02-10T09:00:09.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:delivery-lead';
export const OBSERVER = 'principal:field-engineer';
export const APPROVER = 'principal:chief-engineer';
export const WORLD_ENTITY = 'site-tower-a';
export const WORLD_ENTITY_2 = 'site-tower-b';
export const CONSTRAINT_ID = 'max-height-limit';
export const CONSTRAINT_ID_2 = 'site-access-window';
export const EVIDENCE_DIGEST = 'a'.repeat(64);
export const EVIDENCE_DIGEST_2 = 'b'.repeat(64);

const DIGEST = (char: string): string => char.repeat(64);

/** One valid uncertainty state (observed provenance, fresh, stated confidence). */
export function uncertainty(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:field-report', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'stated', value: 0.9, rationale: 'direct field measurement' },
    ...overrides,
  };
}

/** One solution version content as loose JSON (v1.0.0). */
export function solutionVersionContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: 'solution:tower-retrofit',
    version: '1.0.0',
    tenantId: TENANT,
    title: 'Tower retrofit solution',
    description: 'Structural retrofit of tower A with new bracing',
    objective: 'Restore structural margin within the site constraint set',
    solutionLines: [
      {
        lineId: 'line:earthworks',
        title: 'Excavation and grading',
        quantity: { value: '120', unit: 'm3' },
        unitCost: { amount: '18.50', currency: 'EUR' },
        worldEntityId: WORLD_ENTITY,
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: 'line:structure',
        title: 'Steel bracing frame',
        quantity: { value: '4', unit: 'tonne' },
        unitCost: { amount: '2400.00', currency: 'EUR' },
        worldEntityId: WORLD_ENTITY_2,
        acquisitionVariant: 'fabrication-request',
      },
    ],
    worldReferences: [{ entityId: WORLD_ENTITY }, { entityId: WORLD_ENTITY_2 }],
    constraintReferences: [{ constraintId: CONSTRAINT_ID }, { constraintId: CONSTRAINT_ID_2 }],
    previousVersionDigest: null,
    createdAt: T0,
    createdBy: PRINCIPAL,
    ...overrides,
  };
}

/** The sealed v1.0.0 solution version. */
export function sealedV1(): SealedSolutionVersion {
  const sealed = sealSolutionVersion(solutionVersionContent());
  if (!sealed.ok) {
    throw new Error(`fixture v1 failed to seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

/** The sealed v1.1.0 solution version (chain-linked onto v1). */
export function sealedV2(previous: SealedSolutionVersion): SealedSolutionVersion {
  const content = solutionVersionContent({
    version: '1.1.0',
    title: 'Tower retrofit solution (rev B)',
    previousVersionDigest: previous.contentDigest,
    createdAt: T5,
  });
  const sealed = sealSolutionVersion(content);
  if (!sealed.ok) {
    throw new Error(`fixture v2 failed to seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

/** One baseline approval for a sealed version. */
export function baselineApproval(sealed: SealedSolutionVersion): BaselineApproval {
  return BaselineApprovalSchema.parse({
    schema: 'epoch.solution-delivery.baseline-approval',
    schemaVersion: 1,
    approvalId: 'approval:baseline-v1',
    solutionId: sealed.solutionId,
    tenantId: sealed.tenantId,
    version: sealed.version,
    baselineDigest: sealed.contentDigest,
    approvedBy: APPROVER,
    approvedAt: T2,
    decisionNote: 'approved after simulation review',
  });
}

/** One activity as loose JSON. */
function activity(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    activityId: 'activity:excavate',
    workPackageId: 'work-package:earthworks',
    title: 'Excavate foundation pit',
    plannedQuantity: { value: '120', unit: 'm3' },
    plannedCost: { amount: '2220.00', currency: 'EUR' },
    plannedStart: T1,
    plannedFinish: T2,
    predecessors: [],
    successors: ['activity:brace-frame'],
    resources: [{ resourceId: 'resource:excavator-1', quantity: '1', unit: 'machine' }],
    responsibleActor: PRINCIPAL,
    constraintReferences: [{ constraintId: CONSTRAINT_ID_2 }],
    actualProgress: 1,
    actualStart: T1,
    actualFinish: T2,
    blockers: [],
    evidence: [{ digest: EVIDENCE_DIGEST }],
    confidence: { method: 'measured', value: 0.95 },
    forecastFinish: T2,
    ...overrides,
  };
}

/** One work package as loose JSON. */
function workPackage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    workPackageId: 'work-package:earthworks',
    title: 'Earthworks package',
    description: 'Excavation and grading for the retrofit',
    solutionLineId: 'line:earthworks',
    worldEntityId: WORLD_ENTITY,
    realizationVariant: 'construction-build',
    plannedStart: T1,
    plannedFinish: T2,
    responsibleActor: PRINCIPAL,
    resources: [{ resourceId: 'resource:excavator-1', quantity: '1', unit: 'machine' }],
    constraintReferences: [{ constraintId: CONSTRAINT_ID_2 }],
    approvals: [{ approvedBy: APPROVER, approvedAt: T0 }],
    verificationGates: [
      {
        gateId: 'gate:excavation-check',
        activityId: 'activity:excavate',
        title: 'Pit geometry inspection',
        method: 'method:site-inspection',
        criteria: 'Pit dimensions within tolerance',
        evidence: [{ digest: EVIDENCE_DIGEST }],
        passedAt: T2,
        passedBy: APPROVER,
      },
    ],
    activities: [
      activity({
        activityId: 'activity:brace-frame',
        workPackageId: 'work-package:earthworks',
        title: 'Install bracing frame',
        plannedQuantity: { value: '4', unit: 'tonne' },
        plannedCost: { amount: '9600.00', currency: 'EUR' },
        plannedStart: T2,
        plannedFinish: T4,
        predecessors: ['activity:excavate'],
        successors: [],
        resources: [{ resourceId: 'resource:crane-1', quantity: '1', unit: 'machine' }],
        actualProgress: 0.5,
        actualStart: T2,
        evidence: [],
        forecastFinish: T5,
      }),
      activity(),
    ],
    ...overrides,
  };
}

/** One program of work content as loose JSON (against the v1 baseline). */
export function programContent(sealed: SealedSolutionVersion): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.program-of-work',
    schemaVersion: 1,
    programId: 'program:tower-retrofit-v1',
    tenantId: sealed.tenantId,
    solutionId: sealed.solutionId,
    solutionVersion: sealed.version,
    solutionVersionDigest: sealed.contentDigest,
    title: 'Tower retrofit programme',
    workPackages: [workPackage()],
    milestones: [
      {
        milestoneId: 'milestone:earthworks-complete',
        title: 'Earthworks complete',
        targetDate: T2,
        activityIds: ['activity:excavate'],
        status: 'reached',
        reachedAt: T2,
        evidence: [{ digest: EVIDENCE_DIGEST }],
      },
    ],
    createdAt: T1,
    createdBy: PRINCIPAL,
  };
}

/** The sealed program of work. */
export function sealedProgram(sealed: SealedSolutionVersion): SealedProgramOfWork {
  const built = buildProgramOfWork(programContent(sealed));
  if (!built.ok) {
    throw new Error(`fixture program failed to build: ${JSON.stringify(built.error)}`);
  }
  return built.value;
}

/** One observation distinction record content as loose JSON. */
export function observationContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'observation',
    recordId: 'observation:pit-volume',
    tenantId: TENANT,
    subject: {
      solutionId: 'solution:tower-retrofit',
      subjectKind: 'activity',
      subjectId: 'activity:excavate',
    },
    measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    payload: {
      deliveryId: 'delivery:tower-retrofit-v1',
      observedAt: T3,
      observedBy: OBSERVER,
      evidence: [{ digest: EVIDENCE_DIGEST }, { digest: EVIDENCE_DIGEST_2 }],
    },
    recordedAt: T3,
    recordedBy: OBSERVER,
    uncertainty: uncertainty(),
    ...overrides,
  };
}

/** The sealed observation record. */
export function sealedObservation(): ObservationRecord {
  const sealed = sealDistinctionRecord(observationContent());
  if (!sealed.ok) {
    throw new Error(`fixture observation failed to seal: ${JSON.stringify(sealed.error)}`);
  }
  return ObservationRecordSchema.parse(sealed.value);
}

/** An empty (just-opened) delivery record state. */
export function openedDelivery(sealed: SealedSolutionVersion): SealedDeliveryRecord {
  const opened = openDeliveryRecord({
    schema: 'epoch.solution-delivery.delivery-record',
    schemaVersion: 1,
    deliveryId: 'delivery:tower-retrofit-v1',
    tenantId: sealed.tenantId,
    solutionId: sealed.solutionId,
    solutionVersion: sealed.version,
    solutionVersionDigest: sealed.contentDigest,
    openedAt: T2,
    openedBy: PRINCIPAL,
    status: 'open',
    observations: [],
    acceptedObservationIds: [],
    rejectedObservationIds: [],
    actuals: [],
  });
  if (!opened.ok) {
    throw new Error(`fixture delivery failed to open: ${JSON.stringify(opened.error)}`);
  }
  return opened.value;
}

/** One distinction record content per kind (the full nine-kind fixture set). */
export function distinctionContents(): Record<string, Record<string, unknown>> {
  const subject = {
    solutionId: 'solution:tower-retrofit',
    subjectKind: 'activity',
    subjectId: 'activity:brace-frame',
  };
  const measure = { kind: 'quantity', value: '4', unit: 'tonne' };
  const base = (
    kind: string,
    recordId: string,
    payload: Record<string, unknown>,
    withMeasure = true,
  ) => ({
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind,
    recordId,
    tenantId: TENANT,
    subject,
    ...(withMeasure ? { measure } : {}),
    payload,
    recordedAt: T3,
    recordedBy: PRINCIPAL,
    uncertainty: uncertainty(),
  });
  return {
    prediction: base('prediction', 'prediction:brace-tonnage', {
      basisRef: 'run:simulation-42',
      predictedFor: T9,
    }),
    estimate: base('estimate', 'estimate:brace-tonnage', {
      method: 'method:parametric',
      range: { low: '3.5', high: '4.5' },
    }),
    baseline: base(
      'baseline',
      'baseline:tower-v1',
      {
        solutionVersion: '1.0.0',
        solutionVersionDigest: DIGEST('1'),
      },
      false,
    ),
    commitment: base('commitment', 'commitment:steel-supply', {
      committedBy: 'principal:supplier-desk',
      committedAt: T2,
      acquisitionId: 'acquisition:steel-supply',
    }),
    observation: observationContent({
      recordId: 'observation:brace-progress',
      subject,
      measure: { kind: 'progress', fraction: 0.5 },
      payload: {
        deliveryId: 'delivery:tower-retrofit-v1',
        observedAt: T4,
        observedBy: OBSERVER,
        evidence: [{ digest: EVIDENCE_DIGEST }],
      },
      recordedAt: T4,
      recordedBy: OBSERVER,
    }),
    actual: base('actual', 'actual:pit-volume', {
      deliveryId: 'delivery:tower-retrofit-v1',
      derivedFromObservationId: 'observation:pit-volume',
      actualizedAt: T5,
      actualizedBy: PRINCIPAL,
    }),
    forecast: base('forecast', 'forecast:brace-finish', {
      asOf: T6,
      refines: null,
    }),
    outcome: base(
      'outcome',
      'outcome:tower-delivered',
      {
        outcomeKind: 'delivered',
        verificationRefs: [DIGEST('c')],
        note: 'retrofit delivered and accepted',
      },
      false,
    ),
    learning: base(
      'learning',
      'learning:bracing-lesson',
      {
        lesson: 'Pre-fabricated bracing cut install time by 20%',
        links: ['outcome:tower-delivered'],
      },
      false,
    ),
  };
}

/** An empty distinction ledger for the fixture solution. */
export function emptyLedger(): DistinctionLedger {
  return { tenantId: TENANT, solutionId: 'solution:tower-retrofit', records: [] };
}
