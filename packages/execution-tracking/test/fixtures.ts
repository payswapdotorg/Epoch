// Shared fixtures for the execution-tracking kernel tests. Builders return
// loose JSON objects so negative tests can corrupt single fields precisely
// (the W006/W007/W023/W036 helpers pattern). ZERO clock reads: every
// instant is a fixed constant (producer-supplied payload data). W036
// records are built through the REAL @epoch/solution-delivery pipelines.
import {
  buildProgramOfWork,
  openDeliveryRecord,
  sealSolutionVersion,
  sealDistinctionRecord,
  type SealedSolutionVersion,
  type SealedProgramOfWork,
  type SealedDeliveryRecord,
  type SealedDistinctionRecord,
  type UncertaintyState,
} from '@epoch/solution-delivery';
import {
  buildProgramIndex,
  openExecutionTrackingStore,
  type ExecutionTrackingStore,
  type ProgramIndex,
} from '../src/store';
import { unwrap } from './helpers';

export const T0 = '2026-03-02T09:00:00.000Z';
export const T1 = '2026-03-02T09:00:01.000Z';
export const T2 = '2026-03-02T09:00:02.000Z';
export const T3 = '2026-03-02T09:00:03.000Z';
export const T4 = '2026-03-02T09:00:04.000Z';
export const T5 = '2026-03-02T09:00:05.000Z';
export const T6 = '2026-03-02T09:00:06.000Z';
export const T7 = '2026-03-02T09:00:07.000Z';
export const T8 = '2026-03-02T09:00:08.000Z';
export const T9 = '2026-03-02T09:00:09.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const PRINCIPAL = 'principal:execution-lead';
export const OBSERVER = 'principal:field-engineer';
export const FOREMAN = 'principal:site-foreman';
export const WORK_PACKAGE_ID = 'work-package:earthworks';
export const WORK_PACKAGE_ID_2 = 'work-package:structure';
export const ACTIVITY_ID = 'activity:excavate';
export const ACTIVITY_ID_2 = 'activity:grade';
export const ACTIVITY_ID_3 = 'activity:brace-frame';
export const MILESTONE_ID = 'milestone:earthworks-complete';
export const AMBIGUOUS_MILESTONE_ID = 'milestone:phase-gate';
export const DELIVERY_ID = 'delivery:tower-retrofit-v1';
export const EVIDENCE_DIGEST = 'a'.repeat(64);
export const EVIDENCE_DIGEST_2 = 'b'.repeat(64);
export const EVIDENCE_DIGEST_3 = 'c'.repeat(64);

/** One valid uncertainty state (observed provenance, fresh, measured confidence). */
export function uncertainty(
  overrides: Record<string, unknown> = {},
): UncertaintyState {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:field-report', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'measured', value: 0.92, rationale: 'direct field measurement' },
    ...overrides,
  } as UncertaintyState;
}

/** One solution version content as loose JSON (v1.0.0). */
function solutionVersionContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: SOLUTION_ID,
    version: '1.0.0',
    tenantId: TENANT,
    title: 'Tower retrofit solution',
    objective: 'Restore structural margin within the site constraint set',
    solutionLines: [
      {
        lineId: 'line:earthworks',
        title: 'Excavation and grading',
        quantity: { value: '120', unit: 'm3' },
        unitCost: { amount: '18.50', currency: 'EUR' },
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: 'line:structure',
        title: 'Steel bracing frame',
        quantity: { value: '4', unit: 'tonne' },
        unitCost: { amount: '2400.00', currency: 'EUR' },
        acquisitionVariant: 'fabrication-request',
      },
    ],
    worldReferences: [{ entityId: 'site-tower-a' }],
    constraintReferences: [{ constraintId: 'max-height-limit' }],
    previousVersionDigest: null,
    createdAt: T0,
    createdBy: PRINCIPAL,
  };
}

/** The sealed v1.0.0 solution version. */
export function sealedSolution(): SealedSolutionVersion {
  return unwrap(sealSolutionVersion(solutionVersionContent()));
}

/** One activity as loose JSON. */
function activity(id: string, workPackageId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    activityId: id,
    workPackageId,
    title: `Activity ${id}`,
    predecessors: [],
    successors: [],
    resources: [],
    blockers: [],
    evidence: [],
    constraintReferences: [],
    ...overrides,
  };
}

/** One work package as loose JSON. */
function workPackage(id: string, activities: Record<string, unknown>[]): Record<string, unknown> {
  return {
    workPackageId: id,
    title: `Package ${id}`,
    realizationVariant: 'construction-build',
    resources: [],
    constraintReferences: [],
    approvals: [{ approvedBy: PRINCIPAL, approvedAt: T0 }],
    verificationGates: [],
    activities,
  };
}

/** One program of work content as loose JSON (two work packages, two milestones). */
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
    workPackages: [
      workPackage(WORK_PACKAGE_ID, [
        activity(ACTIVITY_ID, WORK_PACKAGE_ID),
        activity(ACTIVITY_ID_2, WORK_PACKAGE_ID),
      ]),
      workPackage(WORK_PACKAGE_ID_2, [activity(ACTIVITY_ID_3, WORK_PACKAGE_ID_2)]),
    ],
    milestones: [
      {
        milestoneId: MILESTONE_ID,
        title: 'Earthworks complete',
        activityIds: [ACTIVITY_ID],
        status: 'planned',
        evidence: [],
      },
      {
        milestoneId: AMBIGUOUS_MILESTONE_ID,
        title: 'Phase gate (spans packages)',
        activityIds: [ACTIVITY_ID_3, ACTIVITY_ID],
        status: 'planned',
        evidence: [],
      },
    ],
    createdAt: T1,
    createdBy: PRINCIPAL,
  };
}

/** The sealed program of work. */
export function sealedProgram(sealed: SealedSolutionVersion): SealedProgramOfWork {
  return unwrap(buildProgramOfWork(programContent(sealed)));
}

/** The program index extracted from the sealed program. */
export function programIndex(sealed: SealedSolutionVersion): ProgramIndex {
  return unwrap(buildProgramIndex(sealedProgram(sealed)));
}

/** An empty (just-opened) delivery record state. */
export function openedDelivery(sealed: SealedSolutionVersion): SealedDeliveryRecord {
  return unwrap(
    openDeliveryRecord({
      schema: 'epoch.solution-delivery.delivery-record',
      schemaVersion: 1,
      deliveryId: DELIVERY_ID,
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
    }),
  );
}

/** One open execution tracking store for the fixture program. */
export function trackingStore(): ExecutionTrackingStore {
  const sealed = sealedSolution();
  return unwrap(
    openExecutionTrackingStore({
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      programIndex: programIndex(sealed),
    }),
  );
}

/** One W036 observation record content as loose JSON. */
export function observationContent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'observation',
    recordId: 'observation:pit-volume',
    tenantId: TENANT,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_ID,
    },
    measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    payload: {
      deliveryId: DELIVERY_ID,
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

/** The sealed W036 observation record. */
export function sealedObservation(
  overrides: Record<string, unknown> = {},
): SealedDistinctionRecord {
  return unwrap(sealDistinctionRecord(observationContent(overrides)));
}

/** One W036 ACTUAL record (sealed) — the bypass-attempt fixture. */
export function sealedActualRecord(): SealedDistinctionRecord {
  return unwrap(
    sealDistinctionRecord({
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'actual',
      recordId: 'actual:pit-volume',
      tenantId: TENANT,
      subject: {
        solutionId: SOLUTION_ID,
        subjectKind: 'activity',
        subjectId: ACTIVITY_ID,
      },
      measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
      payload: {
        deliveryId: DELIVERY_ID,
        derivedFromObservationId: 'observation:pit-volume',
        actualizedAt: T5,
        actualizedBy: PRINCIPAL,
      },
      recordedAt: T5,
      recordedBy: PRINCIPAL,
      uncertainty: uncertainty(),
    }),
  );
}

/** One field-evidence link as loose JSON. */
export function evidenceLink(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    digest: EVIDENCE_DIGEST,
    evidenceKind: 'photo',
    capturedAt: T3,
    capturedBy: OBSERVER,
    captureMethod: 'method:mobile-capture',
    note: 'pit geometry photo from the north face',
    ...overrides,
  };
}

/** One low-friction field capture as loose JSON. */
export function fieldCapture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    captureKey: 'pit-progress-monday',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    deliveryId: DELIVERY_ID,
    observedAt: T3,
    observedBy: OBSERVER,
    subjectRef: { kind: 'activity', id: ACTIVITY_ID },
    measure: { kind: 'progress', fraction: 0.6 },
    resourceUsages: [
      {
        resourceKind: 'labor',
        resourceId: 'resource:crew-alpha',
        quantity: '8',
        unit: 'hour',
        usageAt: T3,
      },
      {
        resourceKind: 'equipment',
        resourceId: 'resource:excavator-1',
        quantity: '6.5',
        unit: 'hour',
        usageAt: T3,
      },
    ],
    evidenceLinks: [
      { ...evidenceLink(), digest: EVIDENCE_DIGEST },
      { ...evidenceLink(), digest: EVIDENCE_DIGEST_2, evidenceKind: 'sensor-reading' },
    ],
    uncertainty: uncertainty(),
    ...overrides,
  };
}
