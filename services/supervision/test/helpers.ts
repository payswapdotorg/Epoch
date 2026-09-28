// Shared fixtures for the supervision-runtime service tests. Builders
// return loose JSON objects so negative tests can corrupt single
// fields precisely. ZERO clock reads. W036 records are built through
// the REAL @epoch/solution-delivery pipelines; the authorization
// contexts are REAL @epoch/authorization shapes (W009).
import { buildProgramOfWork, openDeliveryRecord, sealSolutionVersion } from '@epoch/solution-delivery';
import type {
  SealedDeliveryRecord,
  SealedProgramOfWork,
  SealedSolutionVersion,
} from '@epoch/solution-delivery';
import type { AuthorizationContext } from '@epoch/authorization';

export const T0 = '2026-03-02T09:00:00.000Z';
export const T1 = '2026-03-02T09:00:01.000Z';
export const T2 = '2026-03-02T09:00:02.000Z';
export const T3 = '2026-03-02T09:00:03.000Z';
export const T4 = '2026-03-02T09:00:04.000Z';
export const T5 = '2026-03-02T09:00:05.000Z';
export const T6 = '2026-03-02T09:00:06.000Z';
export const T7 = '2026-03-02T09:00:07.000Z';
export const T8 = '2026-03-02T09:00:08.000Z';

// The synthetic schedule window (a controlled clock).
export const PLAN_START = '2026-03-01T08:00:00.000Z';
export const PLAN_MID = '2026-03-03T08:00:00.000Z';
export const PLAN_FINISH = '2026-03-05T08:00:00.000Z';
export const PLAN_FINISH_LATE = '2026-03-10T08:00:00.000Z';
export const EVAL_IN_WINDOW = '2026-03-02T12:00:00.000Z';
export const EVAL_PAST_FINISH = '2026-03-06T12:00:00.000Z';
export const REQUIRED_BY = '2026-03-08T08:00:00.000Z';

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
export const ISSUE_DIGEST = 'c'.repeat(64);
export const LEAD_TIME_DIGEST = 'd'.repeat(64);
export const POLICY_ID = 'alert-policy:standard-escalation';
export const SUPERVISION_STREAM = 'stream:supervision-tower-retrofit-v1';
export const HOST_STREAM = 'stream:supervision-host-globex';

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

/** The sealed W036 program (three-activity chain + one verification gate). */
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
          verificationGates: [],
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
          verificationGates: [
            {
              gateId: 'gate:pour-inspection',
              activityId: ACTIVITY_ID_3,
              title: 'Pour inspection',
              method: 'method:visual-inspection',
              evidence: [],
            },
          ],
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
          milestoneId: 'milestone:earthworks-complete',
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

/** One escalation-policy content fixture (loose JSON). */
export function policyContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.alerts.escalation-policy',
    schemaVersion: 1,
    policyId: POLICY_ID,
    tenantId: TENANT,
    policyVersion: '1.0.0',
    title: 'Standard delivery-supervision escalation policy',
    defaultSeverity: 'warning',
    defaultEscalation: {
      notify: [{ targetKind: 'role', targetRef: 'role:delivery-supervisor' }],
      escalationDelaySeconds: '3600',
      reNotifyCadenceSeconds: '86400',
      escalateTo: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
    },
    rules: [
      {
        ruleId: 'rule:late-activities',
        findingClass: 'planned-vs-actual',
        severity: 'major',
        escalation: {
          notify: [{ targetKind: 'role', targetRef: 'role:site-manager' }],
          escalationDelaySeconds: '1800',
          reNotifyCadenceSeconds: '43200',
          escalateTo: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
        },
      },
      {
        ruleId: 'rule:blocked-activities',
        findingClass: 'planned-vs-actual',
        findingStatus: 'blocked',
        severity: 'critical',
        escalation: {
          notify: [
            { targetKind: 'role', targetRef: 'role:program-manager' },
            { targetKind: 'role', targetRef: 'role:site-manager' },
          ],
          escalationDelaySeconds: '900',
          reNotifyCadenceSeconds: '14400',
          escalateTo: [{ targetKind: 'role', targetRef: 'role:operations-director' }],
        },
      },
    ],
    activatedAt: T1,
    activatedBy: PRINCIPAL,
    ...overrides,
  };
}

/** One W038-shaped execution-issue summary fixture. */
export function issueSummary(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.supervision.execution-issue-summary',
    schemaVersion: 1,
    recordId: 'blocker:awaiting-survey',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    issueKind: 'blocker',
    severity: 'major',
    resolutionState: 'open',
    impact: { workPackageIds: [], activityIds: [ACTIVITY_ID], milestoneIds: [] },
    raisedAt: T3,
    contentDigest: ISSUE_DIGEST,
    ...overrides,
  };
}

/** One W037-shaped lead-time risk input fixture. */
export function leadTimeInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.supervision.lead-time-risk-input',
    schemaVersion: 1,
    leadTimeInputId: 'lead-time:cement-delivery',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    acquisitionRef: 'acquisition:bulk-cement',
    requiredBy: REQUIRED_BY,
    realisticLeadTimeDays: '5',
    observedAt: T3,
    sourceRecord: { recordId: 'estimate:cement-lead', contentDigest: LEAD_TIME_DIGEST },
    uncertainty: {
      schemaVersion: 1,
      provenance: { kind: 'observed', sourceRef: 'source:supplier-quote', actor: OBSERVER },
      freshness: { state: 'fresh', assessedAt: T3 },
      confidence: { method: 'measured', value: 0.9, rationale: 'synthesized supplier data' },
    },
    impactedActivityIds: [ACTIVITY_ID_3],
    ...overrides,
  };
}

/** One W036 info-request fixture. */
export function infoRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.info-request',
    schemaVersion: 1,
    requestId: 'info-request:soil-bearing-capacity',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    requestedInformation: 'the verified soil bearing capacity at foundation depth',
    decisionImpact: {
      stage: 'realize',
      decisionKind: 'verification-result',
      materiality: 'material',
      rationale: 'the foundation design verification depends on the bearing capacity',
    },
    freshnessRequirement: { state: 'aging', assessedAt: T3 },
    issuedAt: T3,
    issuedBy: PRINCIPAL,
    status: 'open',
    ...overrides,
  };
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

/** The authorization context with an INACTIVE principal. */
export function inactivePrincipalContextBuilder(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'suspended', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: TENANT }],
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
