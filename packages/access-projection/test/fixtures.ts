// Shared fixtures for the access-projection kernel tests. Builders
// return loose JSON objects so negative tests can corrupt single fields
// precisely (the W036/W006/W007/W037/W038 helpers pattern). ZERO clock
// reads: every instant is a fixed constant (caller-supplied payload
// data). W036 records are built through the REAL
// @epoch/solution-delivery pipelines — never hand-rolled digests; W009
// decisions come from the REAL @epoch/authorization evaluator.
import {
  buildProgramOfWork,
  openDeliveryRecord,
  recordObservation,
  sealDistinctionRecord,
  sealSolutionVersion,
  type SealedDeliveryRecord,
  type SealedDistinctionRecord,
  type SealedProgramOfWork,
  type SealedSolutionVersion,
} from '@epoch/solution-delivery';

export const T0 = '2026-04-01T09:00:00.000Z';
export const T1 = '2026-04-01T09:00:01.000Z';
export const T2 = '2026-04-01T09:00:02.000Z';
export const T3 = '2026-04-01T09:00:03.000Z';
export const T4 = '2026-04-01T09:00:04.000Z';
export const T5 = '2026-04-01T09:00:05.000Z';
export const T6 = '2026-04-01T09:00:06.000Z';
export const T7 = '2026-04-01T09:00:07.000Z';
export const T8 = '2026-04-01T09:00:08.000Z';
export const T9 = '2026-04-01T09:00:09.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const HOST = 'principal:access-host';
export const CLIENT = 'principal:client-viewer';
export const ENGINEER = 'principal:site-engineer';
export const SERVICE_PRINCIPAL = 'principal:reporting-service';
export const AGENT = 'principal:field-agent';
export const ROLE_CLIENT = 'role:client-viewer';
export const ROLE_ENGINEER = 'role:site-engineer';
export const ROLE_SERVICE = 'role:reporting-service';
export const ROLE_AGENT = 'role:field-agent';
export const TASK_CLASS = 'task-class:progress-capture';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const PROGRAM_ID = 'program:tower-retrofit';
export const DELIVERY_ID = 'delivery:tower-retrofit-v1';
export const OBSERVATION_ID = 'observation:earthworks-progress-1';
export const COMMITMENT_ID = 'commitment:steel-order-1';
export const SOLUTION_VERSION = '1.0.0';

const DIGEST = (char: string): string => char.repeat(64);
export const EVIDENCE_DIGEST_A = DIGEST('a');
export const EVIDENCE_DIGEST_B = DIGEST('b');
export const EVIDENCE_DIGEST_C = DIGEST('c');
export const SOLUTION_VERSION_DIGEST = DIGEST('d');

/** One valid uncertainty state (reported provenance, fresh, stated confidence). */
export function uncertainty(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    provenance: { kind: 'reported', sourceRef: 'source:site-system', actor: ENGINEER },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'stated', value: 0.9, rationale: 'site statement' },
    ...overrides,
  };
}

// --------------------------------------------------------------------------------
// REAL W036 canonical records.
// --------------------------------------------------------------------------------

/** One activity (loose) with cost + evidence, for workPackageOf(). */
function activity(id: string, workPackageId: string, evidenceDigest: string): Record<string, unknown> {
  return {
    activityId: id,
    workPackageId,
    title: `Activity ${id}`,
    predecessors: [],
    successors: [],
    resources: [
      { resourceId: 'resource:crew-a', quantity: '4', unit: 'crew-day' },
    ],
    constraintReferences: [],
    blockers: [],
    evidence: [{ digest: evidenceDigest }],
    ...(evidenceDigest === EVIDENCE_DIGEST_B
      ? { plannedCost: { amount: '1200.50', currency: 'EUR' } }
      : {}),
    actualProgress: 0.5,
  };
}

/** One work package (loose) with two activities. */
function workPackage(id: string, activityIds: [string, string]): Record<string, unknown> {
  return {
    workPackageId: id,
    title: `Work package ${id}`,
    realizationVariant: 'construction-build',
    resources: [],
    constraintReferences: [],
    approvals: [{ approvedBy: 'principal:chief-engineer', approvedAt: T0 }],
    verificationGates: [],
    activities: [
      activity(activityIds[0], id, EVIDENCE_DIGEST_A),
      activity(activityIds[1], id, EVIDENCE_DIGEST_B),
    ],
  };
}

/** Build a REAL sealed program of work (two work packages, one milestone). */
export function sealedProgram(tenantId: string = TENANT): SealedProgramOfWork {
  const result = buildProgramOfWork({
    schema: 'epoch.solution-delivery.program-of-work',
    schemaVersion: 1,
    programId: PROGRAM_ID,
    tenantId,
    solutionId: SOLUTION_ID,
    solutionVersion: SOLUTION_VERSION,
    solutionVersionDigest: SOLUTION_VERSION_DIGEST,
    title: 'Tower Retrofit Program',
    workPackages: [
      workPackage('work-package:earthworks', ['activity:backfill', 'activity:excavation']),
      workPackage('work-package:steelwork', ['activity:bolting', 'activity:erection']),
    ],
    milestones: [
      {
        milestoneId: 'milestone:foundation-complete',
        title: 'Foundation complete',
        activityIds: ['activity:backfill'],
        status: 'planned',
        evidence: [{ digest: EVIDENCE_DIGEST_C }],
      },
    ],
    createdAt: T0,
    createdBy: 'principal:chief-engineer',
  });
  if (!result.ok) throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** Build a REAL sealed solution version (two lines with unit costs). */
export function sealedSolutionVersion(): SealedSolutionVersion {
  const result = sealSolutionVersion({
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: SOLUTION_ID,
    version: SOLUTION_VERSION,
    tenantId: TENANT,
    title: 'Tower Retrofit Solution',
    solutionLines: [
      {
        lineId: 'line:earthworks',
        title: 'Earthworks line',
        quantity: { value: '120', unit: 'm3' },
        unitCost: { amount: '45.00', currency: 'EUR' },
      },
      {
        lineId: 'line:steelwork',
        title: 'Steelwork line',
        quantity: { value: '12', unit: 'tonne' },
        unitCost: { amount: '890.00', currency: 'EUR' },
      },
    ],
    worldReferences: [],
    constraintReferences: [],
    previousVersionDigest: null,
    createdAt: T0,
    createdBy: 'principal:chief-engineer',
  });
  if (!result.ok) throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** Build a REAL sealed delivery record with one observation. */
export function sealedDelivery(): SealedDeliveryRecord {
  const observation = sealDistinctionRecord({
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    recordId: OBSERVATION_ID,
    tenantId: TENANT,
    subject: { solutionId: SOLUTION_ID, subjectKind: 'work-package', subjectId: 'work-package:earthworks' },
    recordedAt: T1,
    recordedBy: ENGINEER,
    uncertainty: uncertainty(),
    kind: 'observation',
    measure: { kind: 'progress', fraction: 0.35 },
    payload: {
      deliveryId: DELIVERY_ID,
      observedAt: T1,
      observedBy: ENGINEER,
      evidence: [{ digest: EVIDENCE_DIGEST_A }],
    },
  });
  if (!observation.ok) throw new Error(`fixture failed: ${JSON.stringify(observation.error)}`);
  const delivery = openDeliveryRecord({
    schema: 'epoch.solution-delivery.delivery-record',
    schemaVersion: 1,
    deliveryId: DELIVERY_ID,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    solutionVersion: SOLUTION_VERSION,
    solutionVersionDigest: SOLUTION_VERSION_DIGEST,
    openedAt: T0,
    openedBy: 'principal:chief-engineer',
    status: 'open',
    observations: [],
    acceptedObservationIds: [],
    rejectedObservationIds: [],
    actuals: [],
  });
  if (!delivery.ok) throw new Error(`fixture failed: ${JSON.stringify(delivery.error)}`);
  const withObservation = recordObservation(delivery.value, observation.value);
  if (!withObservation.ok) throw new Error(`fixture failed: ${JSON.stringify(withObservation.error)}`);
  return withObservation.value;
}

/** Build a REAL sealed commitment distinction record (supplier scope fixture). */
export function sealedCommitment(): SealedDistinctionRecord {
  const result = sealDistinctionRecord({
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    recordId: COMMITMENT_ID,
    tenantId: TENANT,
    subject: { solutionId: SOLUTION_ID, subjectKind: 'solution-line', subjectId: 'line:steelwork' },
    recordedAt: T2,
    recordedBy: 'principal:procurement-lead',
    uncertainty: uncertainty(),
    kind: 'commitment',
    measure: { kind: 'cost', amount: '10680.00', currency: 'EUR' },
    payload: {
      committedBy: 'principal:procurement-lead',
      committedAt: T2,
      acquisitionId: 'acquisition:steel-materials',
    },
  });
  if (!result.ok) throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  return result.value;
}

// --------------------------------------------------------------------------------
// Projection policies (loose builders).
// --------------------------------------------------------------------------------

/** The minimum-necessary client allowlist (cost struck by scope, not by list). */
export const CLIENT_ALLOWLIST = [
  'schema',
  'schemaVersion',
  'programId',
  'tenantId',
  'solutionId',
  'solutionVersion',
  'solutionVersionDigest',
  'title',
  'workPackages[].workPackageId',
  'workPackages[].title',
  'workPackages[].realizationVariant',
  'workPackages[].activities[].activityId',
  'workPackages[].activities[].title',
  'workPackages[].activities[].actualProgress',
  'workPackages[].activities[].evidence[].digest',
  'milestones[].milestoneId',
  'milestones[].title',
  'milestones[].evidence[].digest',
  'contentDigest',
];

/** The engineer allowlist (everything the fixture program carries). */
export const ENGINEER_ALLOWLIST = [
  ...CLIENT_ALLOWLIST,
  'createdAt',
  'createdBy',
  'workPackages[].plannedStart',
  'workPackages[].plannedFinish',
  'workPackages[].approvals[].approvedBy',
  'workPackages[].approvals[].approvedAt',
  'workPackages[].activities[].plannedCost.amount',
  'workPackages[].activities[].plannedCost.currency',
  'workPackages[].resources[].resourceId',
  'workPackages[].resources[].quantity',
  'workPackages[].resources[].unit',
  'milestones[].status',
];

/** The agent role baseline allowlist (between client and engineer). */
export const AGENT_ROLE_ALLOWLIST = [
  ...CLIENT_ALLOWLIST,
  'workPackages[].activities[].evidence[].digest',
];

/** The task-class allowlist (a strict subset of the agent baseline). */
export const TASK_CLASS_ALLOWLIST = [
  'schema',
  'programId',
  'tenantId',
  'title',
  'workPackages[].workPackageId',
  'workPackages[].title',
  'workPackages[].activities[].activityId',
  'workPackages[].activities[].title',
  'workPackages[].activities[].actualProgress',
];

/** One policy binding (loose). */
export function binding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    selector: { principalKind: 'human', role: ROLE_CLIENT },
    objectClass: 'program-of-work',
    allowedActions: ['view'],
    fieldAllowlist: [...CLIENT_ALLOWLIST].sort(),
    redactionRules: [
      { fieldPath: 'workPackages[].activities[].plannedCost', redactionClass: 'commercial-sensitive' },
    ],
    defaultRedactionClass: 'policy-scoped',
    scopeFilters: {
      evidence: { mode: 'none' },
      commercial: 'hidden',
      supplier: 'hidden',
    },
    ...overrides,
  };
}

/**
 * The standard multi-role policy content (loose): client (view-only,
 * no commercial, no evidence), engineer (view+export+share, commercial
 * visible, evidence listed), reporting service (view, commercial
 * totals), field agent role baseline + task class (narrower).
 */
export function standardPolicyContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.access-projection.policy',
    schemaVersion: 1,
    policyId: 'policy:tower-retrofit-access',
    revision: 1,
    tenantId: TENANT,
    title: 'Tower Retrofit access policy',
    status: 'active',
    bindings: [
      binding({
        selector: { principalKind: 'agent', agentTaskClass: TASK_CLASS },
        allowedActions: ['view'],
        fieldAllowlist: [...TASK_CLASS_ALLOWLIST].sort(),
        redactionRules: [],
        scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
      }),
      binding({
        selector: { principalKind: 'human', role: ROLE_CLIENT },
        allowedActions: ['view'],
        fieldAllowlist: [...CLIENT_ALLOWLIST].sort(),
        scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
      }),
      binding({
        selector: { principalKind: 'human', role: ROLE_ENGINEER },
        allowedActions: ['export', 'share', 'view'],
        fieldAllowlist: [...ENGINEER_ALLOWLIST].sort(),
        redactionRules: [],
        scopeFilters: {
          evidence: { mode: 'listed', allowedDigests: [EVIDENCE_DIGEST_A, EVIDENCE_DIGEST_B].sort() },
          commercial: 'visible',
          supplier: 'hidden',
        },
      }),
      binding({
        selector: { principalKind: 'service', role: ROLE_SERVICE },
        allowedActions: ['view'],
        fieldAllowlist: [...CLIENT_ALLOWLIST].sort(),
        scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
      }),
    ],
    ...overrides,
  };
}
