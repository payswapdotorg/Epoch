// Shared fixtures for the execution-tracking-runtime service tests.
// Builders return loose JSON objects so negative tests can corrupt
// single fields precisely. ZERO clock reads. W036 records are built
// through the REAL @epoch/solution-delivery pipelines; the authorization
// contexts are REAL @epoch/authorization shapes (W009).
import { buildProgramOfWork, openDeliveryRecord, sealSolutionVersion } from '@epoch/solution-delivery';
import type {
  SealedDeliveryRecord,
  SealedProgramOfWork,
  SealedSolutionVersion,
  UncertaintyState,
} from '@epoch/solution-delivery';
import type { AuthorizationContext } from '@epoch/authorization';
import { sealReconciliationProposal } from '@epoch/execution-tracking';
import type { SealedReconciliationProposal } from '@epoch/execution-tracking';
import { InMemoryFieldCaptureAdapter } from '../src/index';
import type { ReferenceCaptureSeed } from '../src/index';

export const T0 = '2026-03-02T09:00:00.000Z';
export const T1 = '2026-03-02T09:00:01.000Z';
export const T2 = '2026-03-02T09:00:02.000Z';
export const T3 = '2026-03-02T09:00:03.000Z';
export const T4 = '2026-03-02T09:00:04.000Z';
export const T5 = '2026-03-02T09:00:05.000Z';
export const T6 = '2026-03-02T09:00:06.000Z';
export const T7 = '2026-03-02T09:00:07.000Z';
export const T8 = '2026-03-02T09:00:08.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:execution-lead';
export const OBSERVER = 'principal:field-engineer';
export const FOREMAN = 'principal:site-foreman';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const WORK_PACKAGE_ID = 'work-package:earthworks';
export const WORK_PACKAGE_ID_2 = 'work-package:structure';
export const ACTIVITY_ID = 'activity:excavate';
export const ACTIVITY_ID_2 = 'activity:grade';
export const ACTIVITY_ID_3 = 'activity:brace-frame';
export const MILESTONE_ID = 'milestone:earthworks-complete';
export const DELIVERY_ID = 'delivery:tower-retrofit-v1';
export const EVIDENCE_DIGEST = 'a'.repeat(64);
export const EVIDENCE_DIGEST_2 = 'b'.repeat(64);

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

function activity(id: string, workPackageId: string): Record<string, unknown> {
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
  };
}

/** The sealed W036 program of work (two work packages, two milestones). */
export function sealedProgram(): SealedProgramOfWork {
  const sealed = sealedSolution();
  return unwrap(
    buildProgramOfWork({
      schema: 'epoch.solution-delivery.program-of-work',
      schemaVersion: 1,
      programId: 'program:tower-retrofit-v1',
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
          verificationGates: [],
          activities: [activity(ACTIVITY_ID, WORK_PACKAGE_ID), activity(ACTIVITY_ID_2, WORK_PACKAGE_ID)],
        },
        {
          workPackageId: WORK_PACKAGE_ID_2,
          title: 'Structure package',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [{ approvedBy: PRINCIPAL, approvedAt: T0 }],
          verificationGates: [],
          activities: [activity(ACTIVITY_ID_3, WORK_PACKAGE_ID_2)],
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

/** One low-friction field capture seed. */
export function captureSeed(overrides: Record<string, unknown> = {}): ReferenceCaptureSeed {
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
    ],
    evidenceLinks: [
      {
        digest: EVIDENCE_DIGEST,
        evidenceKind: 'photo',
        capturedAt: T3,
        capturedBy: OBSERVER,
      },
    ],
    uncertainty: uncertainty(),
    ...overrides,
  } as ReferenceCaptureSeed;
}

/** The in-memory reference adapter over the default seeds. */
export function seededAdapter(seeds: readonly ReferenceCaptureSeed[] = [captureSeed()]): InMemoryFieldCaptureAdapter {
  return new InMemoryFieldCaptureAdapter(seeds);
}

/** The sealed reconciliation proposal over the intake observations. */
export function reconciliationProposal(
  observationIds: readonly string[],
  overrides: Record<string, unknown> = {},
): SealedReconciliationProposal {
  return unwrap(
    sealReconciliationProposal({
      schema: 'epoch.execution-tracking.reconciliation-proposal',
      schemaVersion: 1,
      recordId: 'reconciliation:pit-progress-w1',
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      deliveryId: DELIVERY_ID,
      entries: observationIds.map((observationId, index) => ({
        observationId,
        proposedActualId: `actual:pit-progress-w1-${index + 1}`,
      })),
      proposedAt: T5,
      proposedBy: PRINCIPAL,
      rationale: 'captures verified against the survey evidence',
      ...overrides,
    }),
  );
}

/** The authorization context granting `principal` full membership in the tenant. */
export function allowContext(
  principalId: string = PRINCIPAL,
  tenantId: string = TENANT,
): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId, status: 'active', authenticated: true }],
    memberships: [{ principalId, tenantId }],
    knownTenants: [tenantId],
  };
}

/** The authorization context with an UNKNOWN principal (fail-closed deny). */
export function unknownPrincipalContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [],
    memberships: [],
    knownTenants: [TENANT],
  };
}

/** The authorization context with a membership in ANOTHER tenant (R12 deny). */
export function foreignMembershipContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: OTHER_TENANT }],
    knownTenants: [TENANT, OTHER_TENANT],
  };
}

/** The authorization context with an INACTIVE principal. */
export function inactivePrincipalContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'suspended', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: TENANT }],
    knownTenants: [TENANT],
  };
}
