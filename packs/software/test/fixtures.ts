// Shared fixtures for the software-pack tests: ONE synthetic software
// delivery (the checkout-service release) driving the whole chain —
// solution -> program -> acquisitions -> delivery -> observations ->
// actuals -> outcomes -> roadmap -> backlog -> deployment plan -> deploy
// proposal.
//
// Builders return typed W036 records built through the KERNEL admission
// paths (sealSolutionVersion / buildProgramOfWork / admitAcquisitionRequest /
// openDeliveryRecord / recordObservation / acceptObservation /
// actualizeObservation / sealDistinctionRecord) so the pack projects over
// GENUINE sealed state. ZERO clock reads: every instant is a fixed
// constant (producer-supplied payload data).
import {
  acceptObservation,
  admitAcquisitionRequest,
  buildProgramOfWork,
  openDeliveryRecord,
  actualizeObservation,
  recordObservation,
  sealDistinctionRecord,
  sealSolutionVersion,
  type AcquisitionRequestRecord,
  type SealedDeliveryRecord,
  type SealedDistinctionRecord,
  type SealedProgramOfWork,
  type SealedSolutionVersion,
} from '@epoch/solution-delivery';
import type { CostClassIndex, ResourceClassIndex } from '../src/cost';
import type { WorkItemIndex } from '../src/workitem';
import type { EnvironmentAssignmentIndex } from '../src/deployment';

// --------------------------------------------------------------------------------
// Fixed constants (zero clock reads).
// --------------------------------------------------------------------------------

export const T0 = '2026-04-06T08:00:00.000Z';
export const T1 = '2026-04-06T09:00:00.000Z';
export const T2 = '2026-04-06T10:00:00.000Z';
export const T3 = '2026-04-06T11:00:00.000Z';
export const T4 = '2026-04-06T12:00:00.000Z';
export const T5 = '2026-04-06T13:00:00.000Z';
export const T6 = '2026-04-06T14:00:00.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:delivery-lead';
export const OBSERVER = 'principal:platform-engineer';
export const APPROVER = 'principal:chief-architect';
export const PLATFORM = 'principal:platform-lead';
export const SRE = 'principal:sre-lead';
export const BACKEND = 'principal:backend-lead';
export const RELEASE_MANAGER = 'principal:release-manager';

export const SOLUTION_ID = 'solution:checkout-service';
export const PROGRAM_ID = 'program:checkout-service-v1';
export const DELIVERY_ID = 'delivery:checkout-service-v1';

/** A deterministic 64-char lowercase-hex evidence digest. */
export const DIGEST = (char: string): string => char.repeat(64);
export const EVIDENCE_A = DIGEST('a');
export const EVIDENCE_B = DIGEST('b');
export const EVIDENCE_C = DIGEST('c');
export const EVIDENCE_D = DIGEST('d');

/** The world entities of the checkout service (id + W002 type key). */
export const WORLD_ENTITIES: readonly { readonly id: string; readonly type: string }[] = [
  { id: 'environment-production', type: 'software:environment' },
  { id: 'environment-staging', type: 'software:environment' },
  { id: 'release-checkout-v1', type: 'software:release-unit' },
  { id: 'repository-checkout', type: 'software:repository' },
  { id: 'service-checkout', type: 'software:service' },
  { id: 'service-checkout-api', type: 'software:service' },
  { id: 'system-checkout', type: 'software:system' },
];

/** One valid uncertainty state (observed provenance, fresh, measured confidence). */
function uncertainty(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:delivery-pipeline', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T3 },
    confidence: { method: 'measured', value: 0.95, rationale: 'direct pipeline telemetry' },
  };
}

// --------------------------------------------------------------------------------
// The solution version (the checkout-service plan lines).
// --------------------------------------------------------------------------------

/** The checkout-service solution version content as loose JSON. */
export function solutionContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: SOLUTION_ID,
    version: '1.0.0',
    tenantId: TENANT,
    title: 'Checkout service',
    description: 'Checkout service release unit: API, web UI, data migration and observability',
    objective: 'Deliver the checkout service release unit with API, UI, data migration and observability',
    solutionLines: [
      {
        lineId: 'line:checkout-ui',
        title: 'Checkout web UI',
        description: 'The checkout user interface delivered as a deployable web frontend',
        quantity: { value: '24', unit: 'deliverable' },
        unitCost: { amount: '620.00', currency: 'EUR' },
        worldEntityId: 'service-checkout',
        acquisitionVariant: 'cloud-service-provisioning',
      },
      {
        lineId: 'line:data-migration',
        title: 'Order data migration',
        quantity: { value: '1', unit: 'deliverable' },
        unitCost: { amount: '12000.00', currency: 'EUR' },
        worldEntityId: 'repository-checkout',
        acquisitionVariant: 'specialist-capability-assignment',
      },
      {
        lineId: 'line:environment-capacity',
        title: 'Environment capacity',
        quantity: { value: '2', unit: 'environment' },
        unitCost: { amount: '2400.00', currency: 'EUR' },
        worldEntityId: 'environment-staging',
        acquisitionVariant: 'cloud-service-provisioning',
      },
      {
        lineId: 'line:payment-gateway-integration',
        title: 'Payment gateway integration',
        quantity: { value: '3', unit: 'deliverable' },
        unitCost: { amount: '4800.00', currency: 'EUR' },
        worldEntityId: 'service-checkout-api',
        acquisitionVariant: 'subscription-license',
      },
      {
        lineId: 'line:run-operations',
        title: 'Production run & support',
        description: 'Operational run and support of the checkout service',
        quantity: { value: '3', unit: 'month' },
        unitCost: { amount: '4200.00', currency: 'EUR' },
        worldEntityId: 'system-checkout',
        acquisitionVariant: 'internal-allocation',
      },
      {
        lineId: 'line:service-api',
        title: 'Checkout API service',
        quantity: { value: '12', unit: 'deliverable' },
        unitCost: { amount: '850.00', currency: 'EUR' },
        worldEntityId: 'service-checkout-api',
        acquisitionVariant: 'cloud-service-provisioning',
      },
    ],
    worldReferences: WORLD_ENTITIES.map((entity) => ({ entityId: entity.id })),
    constraintReferences: [
      { constraintId: 'deployment-change-freeze' },
      { constraintId: 'service-level-objective' },
    ],
    previousVersionDigest: null,
    createdAt: T0,
    createdBy: PRINCIPAL,
    ...overrides,
  };
}

/** The sealed checkout-service solution version. */
export function sealedSolution(overrides: Record<string, unknown> = {}): SealedSolutionVersion {
  const sealed = sealSolutionVersion(solutionContent(overrides));
  if (!sealed.ok) {
    throw new Error(`fixture solution failed to seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

// --------------------------------------------------------------------------------
// The program of work (the checkout-service realization strategy).
// --------------------------------------------------------------------------------

/** The checkout-service program-of-work content as loose JSON. */
export function programContent(sealed: SealedSolutionVersion): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.program-of-work',
    schemaVersion: 1,
    programId: PROGRAM_ID,
    tenantId: sealed.tenantId,
    solutionId: sealed.solutionId,
    solutionVersion: sealed.version,
    solutionVersionDigest: sealed.contentDigest,
    title: 'Checkout service delivery programme',
    workPackages: [
      {
        workPackageId: 'work-package:api-build',
        title: 'Checkout API implementation',
        description: 'Design, implement and test the checkout API service',
        solutionLineId: 'line:service-api',
        worldEntityId: 'service-checkout-api',
        realizationVariant: 'software-implementation-deployment',
        plannedStart: T1,
        plannedFinish: T4,
        responsibleActor: BACKEND,
        resources: [{ resourceId: 'resource:ci-pipeline', quantity: '40', unit: 'hour' }],
        constraintReferences: [],
        approvals: [{ approvedBy: APPROVER, approvedAt: T0 }],
        verificationGates: [
          {
            gateId: 'gate:api-review',
            activityId: 'activity:api-implement',
            title: 'API implementation review approval',
            method: 'software.verify.review-approval',
            criteria: 'Design and change reviewed against the acceptance criteria',
            evidence: [],
          },
          {
            gateId: 'gate:api-test-suite',
            activityId: 'activity:api-tests',
            title: 'API automated test suite pass',
            method: 'software.verify.test-suite-pass',
            criteria: 'Unit and integration suites green at the referenced revision',
            evidence: [{ digest: EVIDENCE_A }],
            passedAt: T4,
            passedBy: APPROVER,
          },
        ],
        activities: [
          {
            activityId: 'activity:api-design',
            workPackageId: 'work-package:api-build',
            title: 'Design the API contract',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '16', unit: 'hour' },
            plannedCost: { amount: '1280.00', currency: 'EUR' },
            plannedStart: T1,
            plannedFinish: T2,
            predecessors: [],
            successors: ['activity:api-implement'],
            resources: [],
            responsibleActor: BACKEND,
            constraintReferences: [],
            blockers: [],
            evidence: [],
          },
          {
            activityId: 'activity:api-implement',
            workPackageId: 'work-package:api-build',
            title: 'Implement the API endpoints',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '120', unit: 'hour' },
            plannedCost: { amount: '9600.00', currency: 'EUR' },
            plannedStart: T2,
            plannedFinish: T3,
            predecessors: ['activity:api-design'],
            successors: ['activity:api-tests'],
            resources: [],
            responsibleActor: BACKEND,
            constraintReferences: [],
            actualProgress: 0.5,
            actualStart: T3,
            blockers: [],
            evidence: [{ digest: EVIDENCE_A }],
          },
          {
            activityId: 'activity:api-tests',
            workPackageId: 'work-package:api-build',
            title: 'Verify with the automated test suite',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '24', unit: 'hour' },
            plannedCost: { amount: '1920.00', currency: 'EUR' },
            plannedStart: T3,
            plannedFinish: T4,
            predecessors: ['activity:api-implement'],
            successors: ['activity:deploy-staging'],
            resources: [],
            responsibleActor: BACKEND,
            constraintReferences: [],
            actualProgress: 1,
            actualStart: T3,
            actualFinish: T4,
            blockers: [],
            evidence: [{ digest: EVIDENCE_A }],
          },
        ],
      },
      {
        workPackageId: 'work-package:data-migration',
        title: 'Order data migration',
        description: 'Assess and execute the order data migration with a cutover verification',
        solutionLineId: 'line:data-migration',
        worldEntityId: 'repository-checkout',
        realizationVariant: 'software-implementation-deployment',
        plannedStart: T1,
        plannedFinish: T3,
        responsibleActor: PRINCIPAL,
        resources: [],
        constraintReferences: [{ constraintId: 'data-residency-region' }],
        approvals: [],
        verificationGates: [
          {
            gateId: 'gate:migration-review',
            activityId: 'activity:migration-run',
            title: 'Migration cutover review approval',
            method: 'software.verify.review-approval',
            criteria: 'Cutover integrity verified against the migration report',
            evidence: [{ digest: EVIDENCE_B }],
            passedAt: T3,
            passedBy: APPROVER,
          },
        ],
        activities: [
          {
            activityId: 'activity:migration-assess',
            workPackageId: 'work-package:data-migration',
            title: 'Assess source data scope',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '8', unit: 'hour' },
            plannedCost: { amount: '640.00', currency: 'EUR' },
            plannedStart: T1,
            plannedFinish: T2,
            predecessors: [],
            successors: ['activity:migration-run'],
            resources: [],
            responsibleActor: PRINCIPAL,
            constraintReferences: [],
            actualProgress: 1,
            actualStart: T2,
            actualFinish: T2,
            blockers: [],
            evidence: [],
          },
          {
            activityId: 'activity:migration-run',
            workPackageId: 'work-package:data-migration',
            title: 'Execute the migration',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '32', unit: 'hour' },
            plannedCost: { amount: '2560.00', currency: 'EUR' },
            plannedStart: T2,
            plannedFinish: T3,
            predecessors: ['activity:migration-assess'],
            successors: ['activity:deploy-production'],
            resources: [],
            responsibleActor: PRINCIPAL,
            constraintReferences: [],
            actualProgress: 1,
            actualStart: T2,
            actualFinish: T3,
            blockers: [],
            evidence: [{ digest: EVIDENCE_B }],
          },
        ],
      },
      {
        workPackageId: 'work-package:environments',
        title: 'Environment provisioning',
        description: 'Provision the staging and production environments and set up observability',
        solutionLineId: 'line:environment-capacity',
        worldEntityId: 'environment-staging',
        realizationVariant: 'infrastructure-provisioning',
        plannedStart: T0,
        plannedFinish: T3,
        responsibleActor: PLATFORM,
        resources: [{ resourceId: 'resource:platform-team', quantity: '2', unit: 'team' }],
        constraintReferences: [],
        approvals: [],
        verificationGates: [
          {
            gateId: 'gate:production-deploy-gate',
            activityId: 'activity:provision-production',
            title: 'Production environment deploy gate',
            method: 'software.verify.deploy-gate',
            criteria: 'Environment readiness checks pass before production rollouts',
            evidence: [],
          },
          {
            gateId: 'gate:staging-deploy-gate',
            activityId: 'activity:provision-staging',
            title: 'Staging environment deploy gate',
            method: 'software.verify.deploy-gate',
            criteria: 'Environment readiness checks pass before staging rollouts',
            evidence: [{ digest: EVIDENCE_C }],
            passedAt: T1,
            passedBy: PLATFORM,
          },
        ],
        activities: [
          {
            activityId: 'activity:observability-setup',
            workPackageId: 'work-package:environments',
            title: 'Set up monitoring and alerting',
            realizationVariant: 'infrastructure-provisioning',
            plannedQuantity: { value: '1', unit: 'deliverable' },
            plannedCost: { amount: '3600.00', currency: 'EUR' },
            plannedStart: T2,
            plannedFinish: T3,
            predecessors: ['activity:provision-staging'],
            successors: [],
            resources: [],
            responsibleActor: SRE,
            constraintReferences: [],
            blockers: [],
            evidence: [],
          },
          {
            activityId: 'activity:provision-production',
            workPackageId: 'work-package:environments',
            title: 'Provision the production environment',
            realizationVariant: 'infrastructure-provisioning',
            plannedQuantity: { value: '1', unit: 'environment' },
            plannedCost: { amount: '4800.00', currency: 'EUR' },
            plannedStart: T2,
            plannedFinish: T3,
            predecessors: ['activity:provision-staging'],
            successors: ['activity:deploy-production'],
            resources: [],
            responsibleActor: PLATFORM,
            constraintReferences: [],
            blockers: [],
            evidence: [],
          },
          {
            activityId: 'activity:provision-staging',
            workPackageId: 'work-package:environments',
            title: 'Provision the staging environment',
            realizationVariant: 'infrastructure-provisioning',
            plannedQuantity: { value: '1', unit: 'environment' },
            plannedCost: { amount: '2400.00', currency: 'EUR' },
            plannedStart: T0,
            plannedFinish: T1,
            predecessors: [],
            successors: ['activity:deploy-staging', 'activity:observability-setup', 'activity:provision-production'],
            resources: [],
            responsibleActor: PLATFORM,
            constraintReferences: [],
            actualProgress: 1,
            actualStart: T1,
            actualFinish: T1,
            blockers: [],
            evidence: [{ digest: EVIDENCE_C }],
          },
        ],
      },
      {
        workPackageId: 'work-package:release-rollout',
        title: 'Release rollout',
        description: 'Roll the checkout release unit out through staging to production',
        solutionLineId: 'line:service-api',
        worldEntityId: 'release-checkout-v1',
        realizationVariant: 'software-implementation-deployment',
        plannedStart: T4,
        plannedFinish: T6,
        responsibleActor: RELEASE_MANAGER,
        resources: [],
        constraintReferences: [{ constraintId: 'deployment-change-freeze' }],
        approvals: [],
        verificationGates: [
          {
            gateId: 'gate:production-slo-check',
            activityId: 'activity:deploy-production',
            title: 'Production SLO check',
            method: 'software.verify.slo-check',
            criteria: 'Availability and latency objectives met over the attestation window',
            evidence: [],
          },
          {
            gateId: 'gate:staging-slo-check',
            activityId: 'activity:deploy-staging',
            title: 'Staging SLO check',
            method: 'software.verify.slo-check',
            criteria: 'Staging reliability objectives met over the attestation window',
            evidence: [{ digest: EVIDENCE_C }],
            passedAt: T4,
            passedBy: SRE,
          },
        ],
        activities: [
          {
            activityId: 'activity:deploy-production',
            workPackageId: 'work-package:release-rollout',
            title: 'Deploy the release to production',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '1', unit: 'deployment' },
            plannedCost: { amount: '800.00', currency: 'EUR' },
            plannedStart: T5,
            plannedFinish: T6,
            predecessors: [
              'activity:deploy-staging',
              'activity:migration-run',
              'activity:provision-production',
            ],
            successors: [],
            resources: [{ resourceId: 'resource:release-pipeline', quantity: '1', unit: 'pipeline' }],
            responsibleActor: RELEASE_MANAGER,
            constraintReferences: [{ constraintId: 'deployment-change-freeze' }],
            blockers: [
              {
                blockerId: 'blocker:change-freeze',
                description: 'Production change freeze until the end of the quarter',
                raisedAt: T5,
                raisedBy: RELEASE_MANAGER,
                impact: 'Production rollout steps are impeded inside the freeze window',
              },
            ],
            evidence: [],
          },
          {
            activityId: 'activity:deploy-staging',
            workPackageId: 'work-package:release-rollout',
            title: 'Deploy the release to staging',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '1', unit: 'deployment' },
            plannedCost: { amount: '400.00', currency: 'EUR' },
            plannedStart: T4,
            plannedFinish: T4,
            predecessors: [
              'activity:api-tests',
              'activity:provision-staging',
              'activity:ui-tests',
            ],
            successors: ['activity:deploy-production', 'activity:rollback-plan'],
            resources: [],
            responsibleActor: RELEASE_MANAGER,
            constraintReferences: [],
            actualProgress: 1,
            actualStart: T4,
            actualFinish: T4,
            blockers: [],
            evidence: [{ digest: EVIDENCE_C }],
          },
          {
            activityId: 'activity:rollback-plan',
            workPackageId: 'work-package:release-rollout',
            title: 'Prepare the rollback runbook',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '4', unit: 'hour' },
            plannedCost: { amount: '320.00', currency: 'EUR' },
            plannedStart: T4,
            plannedFinish: T5,
            predecessors: ['activity:deploy-staging'],
            successors: [],
            resources: [],
            responsibleActor: RELEASE_MANAGER,
            constraintReferences: [],
            blockers: [],
            evidence: [],
          },
        ],
      },
      {
        workPackageId: 'work-package:ui-build',
        title: 'Checkout UI implementation',
        description: 'Implement and test the checkout web UI',
        solutionLineId: 'line:checkout-ui',
        worldEntityId: 'service-checkout',
        realizationVariant: 'software-implementation-deployment',
        plannedStart: T2,
        plannedFinish: T4,
        responsibleActor: 'principal:frontend-lead',
        resources: [],
        constraintReferences: [],
        approvals: [],
        verificationGates: [
          {
            gateId: 'gate:ui-test-suite',
            activityId: 'activity:ui-tests',
            title: 'UI automated test suite pass',
            method: 'software.verify.test-suite-pass',
            criteria: 'UI regression suites green at the referenced revision',
            evidence: [],
          },
        ],
        activities: [
          {
            activityId: 'activity:ui-implement',
            workPackageId: 'work-package:ui-build',
            title: 'Implement the checkout UI',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '80', unit: 'hour' },
            plannedCost: { amount: '6400.00', currency: 'EUR' },
            plannedStart: T2,
            plannedFinish: T3,
            predecessors: [],
            successors: ['activity:ui-tests'],
            resources: [],
            responsibleActor: 'principal:frontend-lead',
            constraintReferences: [],
            blockers: [],
            evidence: [],
          },
          {
            activityId: 'activity:ui-tests',
            workPackageId: 'work-package:ui-build',
            title: 'Verify with the UI test suite',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '16', unit: 'hour' },
            plannedCost: { amount: '1280.00', currency: 'EUR' },
            plannedStart: T3,
            plannedFinish: T4,
            predecessors: ['activity:ui-implement'],
            successors: ['activity:deploy-staging'],
            resources: [],
            responsibleActor: 'principal:frontend-lead',
            constraintReferences: [],
            blockers: [],
            evidence: [],
          },
        ],
      },
    ],
    milestones: [
      {
        milestoneId: 'milestone:data-migration-complete',
        title: 'Data migration complete',
        targetDate: T3,
        activityIds: ['activity:migration-assess', 'activity:migration-run'],
        status: 'reached',
        reachedAt: T3,
        evidence: [{ digest: EVIDENCE_B }],
      },
      {
        milestoneId: 'milestone:production-release',
        title: 'Production release checkout-v1',
        targetDate: T6,
        activityIds: ['activity:deploy-production'],
        status: 'planned',
        evidence: [],
      },
      {
        milestoneId: 'milestone:staging-release',
        title: 'Staging release checkout-v1',
        targetDate: T4,
        activityIds: ['activity:deploy-staging'],
        status: 'reached',
        reachedAt: T4,
        evidence: [{ digest: EVIDENCE_C }],
      },
    ],
    createdAt: T1,
    createdBy: PRINCIPAL,
  };
}

/** The sealed checkout-service program of work. */
export function sealedProgram(sealed: SealedSolutionVersion): SealedProgramOfWork {
  const built = buildProgramOfWork(programContent(sealed));
  if (!built.ok) {
    throw new Error(`fixture program failed to build: ${JSON.stringify(built.error)}`);
  }
  return built.value;
}

// --------------------------------------------------------------------------------
// The acquisition requests (provisioning, licensing and specialist capability).
// --------------------------------------------------------------------------------

/** The checkout-service acquisition requests as loose JSON. */
export function acquisitionContents(sealed: SealedSolutionVersion): Record<string, unknown>[] {
  return [
    {
      schema: 'epoch.solution-delivery.acquisition-request',
      schemaVersion: 1,
      acquisitionId: 'acquisition:environment-capacity',
      tenantId: sealed.tenantId,
      solutionId: sealed.solutionId,
      deliveryId: DELIVERY_ID,
      detail: {
        variant: 'cloud-service-provisioning',
        serviceKind: 'container-platform-capacity',
        capacityNote: 'Two managed environment capacities (staging, production)',
      },
      requestedAt: T0,
      requestedBy: PLATFORM,
      neededBy: T1,
      note: 'Environment capacity for the checkout service rollout',
    },
    {
      schema: 'epoch.solution-delivery.acquisition-request',
      schemaVersion: 1,
      acquisitionId: 'acquisition:migration-specialist',
      tenantId: sealed.tenantId,
      solutionId: sealed.solutionId,
      detail: {
        variant: 'specialist-capability-assignment',
        capabilityRef: 'capability:data-migration',
        assignee: 'principal:data-specialist',
      },
      requestedAt: T0,
      requestedBy: PRINCIPAL,
      note: 'Specialist data-migration capability for the order migration',
    },
    {
      schema: 'epoch.solution-delivery.acquisition-request',
      schemaVersion: 1,
      acquisitionId: 'acquisition:observability-license',
      tenantId: sealed.tenantId,
      solutionId: sealed.solutionId,
      deliveryId: DELIVERY_ID,
      detail: {
        variant: 'subscription-license',
        seats: 25,
        termNote: 'Annual observability platform seats',
      },
      requestedAt: T0,
      requestedBy: PLATFORM,
      note: 'Observability platform seats for the run organization',
    },
    {
      schema: 'epoch.solution-delivery.acquisition-request',
      schemaVersion: 1,
      acquisitionId: 'acquisition:payment-sandbox',
      tenantId: sealed.tenantId,
      solutionId: sealed.solutionId,
      deliveryId: DELIVERY_ID,
      detail: {
        variant: 'external-procurement',
        lines: [
          {
            description: 'Payment gateway sandbox access',
            quantity: '3',
            unit: 'environment',
            solutionLineId: 'line:payment-gateway-integration',
            externalPartyRef: 'external:payment-sandbox-provider',
          },
        ],
      },
      requestedAt: T1,
      requestedBy: PLATFORM,
      neededBy: T2,
      note: 'Sandbox access for the payment gateway integration line',
    },
  ];
}

/** The admitted checkout-service acquisition requests. */
export function acquisitions(sealed: SealedSolutionVersion): AcquisitionRequestRecord[] {
  const admitted = acquisitionContents(sealed).map((content) => admitAcquisitionRequest(content));
  for (const result of admitted) {
    if (!result.ok) {
      throw new Error(`fixture acquisition failed to admit: ${JSON.stringify(result.error)}`);
    }
  }
  return admitted.map((result) => (result.ok ? result.value : null)) as AcquisitionRequestRecord[];
}

// --------------------------------------------------------------------------------
// The delivery record (observations and actuals of the realization).
// --------------------------------------------------------------------------------

/** One observation distinction-record content as loose JSON. */
function observationContent(
  tenantId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'observation',
    recordId: 'observation:api-progress',
    tenantId,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: 'activity:api-implement',
    },
    measure: { kind: 'quantity', value: '60', unit: 'hour' },
    payload: {
      deliveryId: DELIVERY_ID,
      observedAt: T3,
      observedBy: OBSERVER,
      evidence: [{ digest: EVIDENCE_A }],
    },
    recordedAt: T3,
    recordedBy: OBSERVER,
    uncertainty: uncertainty(),
    ...overrides,
  };
}

/** The sealed observation records of the delivery (sorted by recordId). */
export function observationRecords(tenantId: string = TENANT): SealedDistinctionRecord[] {
  const contents = [
    observationContent(tenantId),
    observationContent(tenantId, {
      recordId: 'observation:migration-quantity',
      subject: {
        solutionId: SOLUTION_ID,
        subjectKind: 'activity',
        subjectId: 'activity:migration-run',
      },
      measure: { kind: 'quantity', value: '1', unit: 'deliverable' },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: T3,
        observedBy: OBSERVER,
        evidence: [{ digest: EVIDENCE_B }],
      },
      recordedAt: T3,
      recordedBy: OBSERVER,
    }),
    observationContent(tenantId, {
      recordId: 'observation:rollout-package',
      subject: {
        solutionId: SOLUTION_ID,
        subjectKind: 'work-package',
        subjectId: 'work-package:release-rollout',
      },
      measure: { kind: 'progress', fraction: 0.5 },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: T4,
        observedBy: OBSERVER,
        evidence: [{ digest: EVIDENCE_B }],
      },
      recordedAt: T4,
      recordedBy: OBSERVER,
    }),
    observationContent(tenantId, {
      recordId: 'observation:staging-deployment',
      subject: {
        solutionId: SOLUTION_ID,
        subjectKind: 'activity',
        subjectId: 'activity:deploy-staging',
      },
      measure: { kind: 'progress', fraction: 1 },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: T4,
        observedBy: OBSERVER,
        evidence: [{ digest: EVIDENCE_C }],
      },
      recordedAt: T4,
      recordedBy: OBSERVER,
    }),
  ];
  const sealed = contents.map((content) => sealDistinctionRecord(content));
  for (const result of sealed) {
    if (!result.ok) {
      throw new Error(`fixture observation failed to seal: ${JSON.stringify(result.error)}`);
    }
  }
  return sealed
    .map((result) => (result.ok ? result.value : null))
    .filter((record): record is SealedDistinctionRecord => record !== null)
    .sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
}

/** The sealed delivery record with observations, acceptances and actuals. */
export function sealedDelivery(
  sealed: SealedSolutionVersion,
  tenantId: string = TENANT,
): SealedDeliveryRecord {
  let delivery = openDeliveryRecord({
    schema: 'epoch.solution-delivery.delivery-record',
    schemaVersion: 1,
    deliveryId: DELIVERY_ID,
    tenantId,
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
  if (!delivery.ok) {
    throw new Error(`fixture delivery failed to open: ${JSON.stringify(delivery.error)}`);
  }
  for (const observation of observationRecords(tenantId)) {
    const recorded = recordObservation(delivery.value, observation);
    if (!recorded.ok) {
      throw new Error(`fixture observation failed to record: ${JSON.stringify(recorded.error)}`);
    }
    delivery = recorded;
  }
  for (const observationId of [
    'observation:api-progress',
    'observation:migration-quantity',
    'observation:staging-deployment',
  ]) {
    const accepted = acceptObservation(delivery.value, observationId, {
      acceptedBy: APPROVER,
      acceptedAt: T4,
    });
    if (!accepted.ok) {
      throw new Error(`fixture observation failed to accept: ${JSON.stringify(accepted.error)}`);
    }
    delivery = accepted;
  }
  const actualizations: Array<{ observationId: string; actualId: string; at: string }> = [
    { observationId: 'observation:api-progress', actualId: 'actual:api-effort', at: T4 },
    { observationId: 'observation:migration-quantity', actualId: 'actual:migration-delivered', at: T4 },
    { observationId: 'observation:staging-deployment', actualId: 'actual:staging-deployed', at: T5 },
  ];
  for (const { observationId, actualId, at } of actualizations) {
    const actualized = actualizeObservation(delivery.value, observationId, {
      actualId,
      actualizedBy: PRINCIPAL,
      actualizedAt: at,
    });
    if (!actualized.ok) {
      throw new Error(`fixture observation failed to actualize: ${JSON.stringify(actualized.error)}`);
    }
    delivery = actualized;
  }
  return delivery.value;
}

// --------------------------------------------------------------------------------
// The outcome records (release delivery, SLO attainment, handover).
// --------------------------------------------------------------------------------

/** The sealed outcome distinction records of the checkout service. */
export function outcomeRecords(): SealedDistinctionRecord[] {
  const contents = [
    {
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'outcome',
      recordId: 'outcome:service-handover',
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      payload: {
        outcomeKind: 'handover',
        verificationRefs: [EVIDENCE_D],
        note: 'Checkout service handed to the run organization with runbooks and on-call ownership',
      },
      recordedAt: T6,
      recordedBy: APPROVER,
      uncertainty: uncertainty(),
    },
    {
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'outcome',
      recordId: 'outcome:slo-attainment',
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      payload: {
        outcomeKind: 'accepted',
        verificationRefs: [EVIDENCE_A],
        note: 'Availability objective met over the attestation window',
      },
      recordedAt: T6,
      recordedBy: APPROVER,
      uncertainty: uncertainty(),
    },
    {
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'outcome',
      recordId: 'outcome:slo-breach-residual',
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      payload: {
        outcomeKind: 'residual',
        verificationRefs: [],
        note: 'Latency objective breached; remediation carried as a residual until re-attested',
      },
      recordedAt: T6,
      recordedBy: APPROVER,
      uncertainty: uncertainty(),
    },
    {
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'outcome',
      recordId: 'outcome:staging-release',
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      payload: {
        outcomeKind: 'delivered',
        verificationRefs: [EVIDENCE_C],
        note: 'Release unit checkout-v1 delivered to the staging environment',
      },
      recordedAt: T5,
      recordedBy: APPROVER,
      uncertainty: uncertainty(),
    },
  ];
  const sealed = contents.map((content) => sealDistinctionRecord(content));
  for (const result of sealed) {
    if (!result.ok) {
      throw new Error(`fixture outcome failed to seal: ${JSON.stringify(result.error)}`);
    }
  }
  return sealed
    .map((result) => (result.ok ? result.value : null))
    .filter((record): record is SealedDistinctionRecord => record !== null)
    .sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
}

// --------------------------------------------------------------------------------
// The classification indexes (typed data referencing canonical ids).
// --------------------------------------------------------------------------------

/** The cost-classification index over the fixture activities. */
export function costClassIndex(): CostClassIndex {
  return {
    schema: 'epoch.pack-software.cost-class-index',
    schemaVersion: 1,
    assignments: [
      { activityId: 'activity:api-implement', resourceClass: 'engineering' },
      { activityId: 'activity:api-tests', resourceClass: 'engineering' },
      { activityId: 'activity:deploy-production', resourceClass: 'operations' },
      { activityId: 'activity:deploy-staging', resourceClass: 'operations' },
      { activityId: 'activity:migration-run', resourceClass: 'engineering' },
      { activityId: 'activity:observability-setup', resourceClass: 'licensing' },
      { activityId: 'activity:provision-production', resourceClass: 'infrastructure' },
      { activityId: 'activity:provision-staging', resourceClass: 'infrastructure' },
      { activityId: 'activity:ui-implement', resourceClass: 'engineering' },
    ],
  };
}

/** The resource-classification index over the fixture resources. */
export function resourceClassIndex(): ResourceClassIndex {
  return {
    schema: 'epoch.pack-software.resource-class-index',
    schemaVersion: 1,
    assignments: [
      { resourceId: 'resource:ci-pipeline', resourceClass: 'infrastructure' },
      { resourceId: 'resource:platform-team', resourceClass: 'engineering' },
      { resourceId: 'resource:release-pipeline', resourceClass: 'operations' },
    ],
  };
}

/** The work-item classification index over the fixture activities. */
export function workItemIndex(): WorkItemIndex {
  return {
    schema: 'epoch.pack-software.work-item-index',
    schemaVersion: 1,
    assignments: [
      { activityId: 'activity:migration-assess', workItemKind: 'task' },
      { activityId: 'activity:migration-run', workItemKind: 'task' },
      { activityId: 'activity:observability-setup', workItemKind: 'change' },
    ],
  };
}

/** The environment-assignment index over the fixture rollout steps. */
export function environmentAssignments(): EnvironmentAssignmentIndex {
  return {
    schema: 'epoch.pack-software.environment-assignment-index',
    schemaVersion: 1,
    assignments: [
      { activityId: 'activity:deploy-production', environmentId: 'software.environment.production' },
      { activityId: 'activity:deploy-staging', environmentId: 'software.environment.staging' },
      { activityId: 'activity:observability-setup', environmentId: 'software.environment.production' },
      { activityId: 'activity:provision-production', environmentId: 'software.environment.production' },
      { activityId: 'activity:provision-staging', environmentId: 'software.environment.staging' },
      { activityId: 'activity:rollback-plan', environmentId: 'software.environment.production' },
    ],
  };
}

// --------------------------------------------------------------------------------
// The deploy-proposal render parameters (the W003/W022 authority seam).
// --------------------------------------------------------------------------------

/** The render parameters of the fixture production-rollout deploy proposal. */
export function deployProposalParams(): Record<string, unknown> {
  return {
    proposalId: 'checkout-v1-production-rollout',
    proposedBy: 'agent:delivery-orchestrator',
    createdAt: T5,
    targetRef: 'deployment:checkout-production-v1',
    parameters: {
      environment: 'software.environment.production',
      release_unit: 'release-checkout-v1',
      rollout_step: 'activity:deploy-production',
    },
    rationale: 'Roll out release unit checkout-v1 to production through the planned production rollout step.',
    evidenceRefs: [EVIDENCE_A, EVIDENCE_C],
    expiresAt: T6,
  };
}

// --------------------------------------------------------------------------------
// The full chain (solution -> program -> acquisitions -> delivery).
// --------------------------------------------------------------------------------

/** The full checkout-service fixture chain. */
export interface CheckoutChain {
  readonly solution: SealedSolutionVersion;
  readonly program: SealedProgramOfWork;
  readonly acquisitions: readonly AcquisitionRequestRecord[];
  readonly delivery: SealedDeliveryRecord;
  readonly worldEntities: readonly { readonly id: string; readonly type: string }[];
}

/** Build the full checkout-service fixture chain. */
export function checkoutChain(): CheckoutChain {
  const solution = sealedSolution();
  return {
    solution,
    program: sealedProgram(solution),
    acquisitions: acquisitions(solution),
    delivery: sealedDelivery(solution),
    worldEntities: WORLD_ENTITIES,
  };
}
