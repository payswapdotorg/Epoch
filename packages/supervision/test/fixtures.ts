// Shared fixtures for the supervision kernel tests. Builders return
// loose JSON objects so negative tests can corrupt single fields
// precisely. ZERO clock reads. W036 records are built through the REAL
// @epoch/solution-delivery pipelines.
import { buildProgramOfWork, openDeliveryRecord, sealSolutionVersion } from '@epoch/solution-delivery';
import type {
  SealedDeliveryRecord,
  SealedProgramOfWork,
  SealedSolutionVersion,
  UncertaintyState,
} from '@epoch/solution-delivery';

export const T0 = '2026-03-02T09:00:00.000Z';
export const T1 = '2026-03-02T09:00:01.000Z';
export const T2 = '2026-03-02T09:00:02.000Z';
export const T3 = '2026-03-02T09:00:03.000Z';
export const T4 = '2026-03-02T09:00:04.000Z';
export const T5 = '2026-03-02T09:00:05.000Z';
export const T6 = '2026-03-02T09:00:06.000Z';
export const T7 = '2026-03-02T09:00:07.000Z';
export const T8 = '2026-03-02T09:00:08.000Z';

// The synthetic schedule window (a controlled clock: due -> late ->
// blocked transitions drive off these instants, never a real clock).
export const PLAN_START = '2026-03-01T08:00:00.000Z';
export const PLAN_MID = '2026-03-03T08:00:00.000Z';
export const PLAN_FINISH = '2026-03-05T08:00:00.000Z';
export const PLAN_FINISH_LATE = '2026-03-10T08:00:00.000Z';
export const EVAL_IN_WINDOW = '2026-03-02T12:00:00.000Z';
export const EVAL_PAST_FINISH = '2026-03-06T12:00:00.000Z';
export const EVAL_BEFORE_WINDOW = '2026-02-20T12:00:00.000Z';
export const REQUIRED_BY = '2026-03-08T08:00:00.000Z';
export const EVAL_LEAD_TIME_TIGHT = '2026-03-06T08:00:00.000Z'; // 2 days before REQUIRED_BY

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:delivery-lead';
export const OBSERVER = 'principal:field-engineer';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const PROGRAM_ID = 'program:tower-retrofit-v1';
export const DELIVERY_ID = 'delivery:tower-retrofit-v1';
export const WORK_PACKAGE_ID = 'work-package:earthworks';
export const WORK_PACKAGE_ID_2 = 'work-package:structure';
export const ACTIVITY_ID = 'activity:excavate';
export const ACTIVITY_ID_2 = 'activity:grade';
export const ACTIVITY_ID_3 = 'activity:pour-foundations';
export const MILESTONE_ID = 'milestone:earthworks-complete';
export const GATE_ID = 'gate:excavation-inspection';
export const EVIDENCE_DIGEST = 'a'.repeat(64);
export const ISSUE_DIGEST = 'c'.repeat(64);
export const LEAD_TIME_DIGEST = 'd'.repeat(64);

/** Unwrap a total result or fail loudly (positive-path helper). */
export function unwrap<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): T {
  if (!result.ok) {
    throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Assert a typed error code (negative-path helper). */
export function expectError<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): { readonly code: string; readonly message: string } {
  if (result.ok) {
    throw new Error(`expected a typed rejection, got ok: ${JSON.stringify(result.value)}`);
  }
  return result.error as { code: string; message: string };
}

/** One valid uncertainty state. */
export function uncertainty(overrides: Record<string, unknown> = {}): UncertaintyState {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:field-report', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'measured', value: 0.92, rationale: 'direct field measurement' },
    ...overrides,
  } as UncertaintyState;
}

/** The sealed W036 solution version. */
export function sealedSolution(): SealedSolutionVersion {
  return unwrap(
    sealSolutionVersion({
      schema: 'epoch.solution-delivery.solution-version',
      schemaVersion: 1,
      solutionId: SOLUTION_ID,
      version: '1.0.0',
      tenantId: TENANT,
      title: 'Tower retrofit solution',
      solutionLines: [
        {
          lineId: 'line:earthworks',
          title: 'Excavation and grading',
          quantity: { value: '120', unit: 'm3' },
          unitCost: { amount: '18.50', currency: 'EUR' },
          acquisitionVariant: 'external-procurement',
        },
      ],
      worldReferences: [{ entityId: 'site-tower-a' }],
      constraintReferences: [{ constraintId: 'max-height-limit' }],
      previousVersionDigest: null,
      createdAt: T0,
      createdBy: PRINCIPAL,
    }),
  );
}

/** One activity fixture (loose JSON; overrides applied last). */
export function activity(
  id: string,
  workPackageId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
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

/**
 * The sealed W036 program of work (two work packages; a three-activity
 * dependency chain excavate -> grade -> pour-foundations with planned
 * dates, quantities and costs; one verification gate).
 */
export function sealedProgram(overrides: Record<string, unknown> = {}): SealedProgramOfWork {
  const sealed = sealedSolution();
  return unwrap(
    buildProgramOfWork({
      schema: 'epoch.solution-delivery.program-of-work',
      schemaVersion: 1,
      programId: PROGRAM_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      solutionVersion: sealed.version,
      solutionVersionDigest: sealed.contentDigest,
      title: 'Tower retrofit programme',
      workPackages: [
        {
          workPackageId: WORK_PACKAGE_ID,
          title: 'Earthworks package',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [{ approvedBy: PRINCIPAL, approvedAt: T0 }],
          verificationGates: [
            {
              gateId: GATE_ID,
              activityId: ACTIVITY_ID,
              title: 'Excavation inspection',
              method: 'method:visual-inspection',
              evidence: [],
            },
          ],
          activities: [
            activity(ACTIVITY_ID, WORK_PACKAGE_ID, {
              plannedStart: PLAN_START,
              plannedFinish: PLAN_MID,
              plannedQuantity: { value: '100', unit: 'm3' },
              plannedCost: { amount: '1000', currency: 'EUR' },
              successors: [ACTIVITY_ID_2],
            }),
            activity(ACTIVITY_ID_2, WORK_PACKAGE_ID, {
              plannedStart: PLAN_MID,
              plannedFinish: PLAN_FINISH,
              plannedQuantity: { value: '50', unit: 'm3' },
              plannedCost: { amount: '500', currency: 'EUR' },
              predecessors: [ACTIVITY_ID],
              successors: [ACTIVITY_ID_3],
            }),
          ],
        },
        {
          workPackageId: WORK_PACKAGE_ID_2,
          title: 'Structure package',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [{ approvedBy: PRINCIPAL, approvedAt: T0 }],
          verificationGates: [],
          activities: [
            activity(ACTIVITY_ID_3, WORK_PACKAGE_ID_2, {
              plannedStart: PLAN_FINISH,
              plannedFinish: PLAN_FINISH_LATE,
              predecessors: [ACTIVITY_ID_2],
            }),
          ],
        },
      ],
      milestones: [
        {
          milestoneId: MILESTONE_ID,
          title: 'Earthworks complete',
          activityIds: [ACTIVITY_ID],
          status: 'planned',
          evidence: [],
        },
      ],
      createdAt: T1,
      createdBy: PRINCIPAL,
      ...overrides,
    }),
  );
}

/** The opened W036 delivery record (with optional overrides). */
export function openedDelivery(overrides: Record<string, unknown> = {}): SealedDeliveryRecord {
  const sealed = sealedSolution();
  return unwrap(
    openDeliveryRecord({
      schema: 'epoch.solution-delivery.delivery-record',
      schemaVersion: 1,
      deliveryId: DELIVERY_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      solutionVersion: sealed.version,
      solutionVersionDigest: sealed.contentDigest,
      openedAt: T2,
      openedBy: PRINCIPAL,
      status: 'open',
      observations: [],
      acceptedObservationIds: [],
      rejectedObservationIds: [],
      actuals: [],
      ...overrides,
    }),
  );
}

/** One W036 observation record content (sealed through the REAL pipeline when needed). */
export function observationContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'observation',
    recordId: 'observation:pit-quantity-monday',
    tenantId: TENANT,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_ID,
    },
    measure: { kind: 'quantity', value: '130', unit: 'm3' },
    payload: {
      deliveryId: DELIVERY_ID,
      observedAt: T3,
      observedBy: OBSERVER,
      evidence: [],
    },
    recordedAt: T3,
    recordedBy: OBSERVER,
    uncertainty: uncertainty(),
    ...overrides,
  };
}
