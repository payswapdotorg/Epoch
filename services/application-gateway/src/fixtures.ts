/**
 * @epoch/application-gateway — deterministic product fixtures (W046).
 *
 * Two fixture domains for the journey system (spec/journey-validation.md):
 *  - CONSTRUCTION (BOQ/schedule/procurement shape): warehouse extension —
 *    tenancy (platform -> tenant -> workspace -> project), principals +
 *    authentication results, a seeded world (BOQ items, activities,
 *    suppliers), a sealed solution version, the program of work (the
 *    BOQ + schedule), an open delivery record, an evidence record + its
 *    digest-addressed object bytes, and the J07/J08/J11 scenario scripts.
 *  - SOFTWARE (repo/ticket/release shape): checkout service — the same
 *    record families with software vocabulary.
 *
 * BYTE-STABLE across runs: every record is built through the REAL
 * kernels with FROZEN instants (the T series) and SEEDED ids; rendering
 * is canonical JSON with sorted keys; the registry records per-file
 * SHA-256 digests. The drift test (test/fixtures-drift.test.ts)
 * re-renders and compares byte-for-byte; two renders in one process are
 * byte-identical; digests are rerun-stable.
 */
import {
  canonicalJsonStringify,
  sha256Hex,
  type JsonValue,
} from '@epoch/agent-protocol';
import { TenancyHierarchy, sealTenancyNode } from '@epoch/tenancy';
import { IdentityRegistry, authenticationResultRecordFor, sealPrincipal } from '@epoch/identity';
import { WorldModel, type Clock } from '@epoch/world-model';
import {
  buildProgramOfWork,
  openDeliveryRecord,
  sealSolutionVersion,
} from '@epoch/solution-delivery';
import { EvidenceStore } from '@epoch/evidence';

/** Version of the product fixture set. */
export const PRODUCT_FIXTURE_VERSION = '1.0.0' as const;

/** One fixture domain. */
export type ProductFixtureDomain = 'construction' | 'software';

/** One journey scenario script step. */
export interface ScenarioStep {
  readonly stepId: string;
  readonly action: string;
  readonly input: JsonValue;
  readonly expectation: string;
}

/** One journey scenario script (J07/J08/J11). */
export interface JourneyScenarioScript {
  readonly schemaVersion: 1;
  readonly scriptId: string;
  readonly journeyId: 'J07' | 'J08' | 'J11';
  readonly domain: ProductFixtureDomain;
  readonly description: string;
  readonly steps: readonly ScenarioStep[];
}

/**
 * The frozen instant series (one-hour steps, canonical UTC). Every
 * kernel API receives these; nothing reads a wall clock.
 */
export const FIXTURE_INSTANTS = [
  '2026-03-02T08:00:00.000Z', // T0 — existing conditions / repo seeded
  '2026-03-02T09:00:00.000Z', // T1 — solution authored
  '2026-03-02T10:00:00.000Z', // T2 — solution sealed / session issued
  '2026-03-02T11:00:00.000Z', // T3 — baseline approved / programme built / delivery opened
  '2026-03-02T12:00:00.000Z', // T4 — field work / tickets opened
  '2026-03-02T13:00:00.000Z', // T5 — observation captured / offline enqueue
  '2026-03-02T14:00:00.000Z', // T6 — reconnect + idempotent sync
  '2026-03-02T15:00:00.000Z', // T7 — cross-device handoff projection
  '2026-03-02T16:00:00.000Z', // T8 — session expiry (J11)
  '2026-03-02T17:00:00.000Z', // T9 — re-authentication
  '2026-03-02T18:00:00.000Z', // T10 — connector failure / retry
] as const;

const T = FIXTURE_INSTANTS;
const fixedClock: Clock = () => T[0]!;

/** Scenario scripts shared shape helpers. */
function step(stepId: string, action: string, input: JsonValue, expectation: string): ScenarioStep {
  return { stepId, action, input, expectation };
}

// ---------------------------------------------------------------------------
// Domain builders (REAL kernels, frozen clocks, seeded ids).
// ---------------------------------------------------------------------------

interface DomainFixture {
  readonly domain: ProductFixtureDomain;
  readonly fixtureId: string;
  readonly tenantId: string;
  readonly solutionId: string;
  readonly principalId: string;
  readonly observerId: string;
  readonly tenancySnapshot: JsonValue;
  readonly identity: JsonValue;
  readonly worldSnapshot: JsonValue;
  readonly worldDigest: string;
  readonly solution: JsonValue;
  readonly solutionContentDigest: string;
  readonly program: JsonValue;
  readonly programContentDigest: string;
  readonly delivery: JsonValue;
  readonly deliveryContentDigest: string;
  readonly evidence: JsonValue;
  readonly evidenceDigest: string;
  readonly objectBytesDigest: string;
}

const CONSTRUCTION = {
  tenantId: 'tenant:nordstrand',
  workspaceId: 'workspace:warehouse-extension',
  projectId: 'project:steel-warehouse-b',
  platformId: 'platform:epoch',
  principal: 'principal:delivery-lead',
  observer: 'principal:field-engineer',
  approver: 'principal:chief-engineer',
  solutionId: 'solution:warehouse-extension-steel',
  programId: 'program:warehouse-extension',
  deliveryId: 'delivery:warehouse-b-001',
  workPackageSubstructure: 'work-package:warehouse-substructure',
  workPackageSuperstructure: 'work-package:warehouse-superstructure',
  activityExcavation: 'activity:warehouse-excavation',
  activityConcrete: 'activity:warehouse-foundations',
  activityErection: 'activity:steel-erection',
  lineExcavation: 'line:warehouse-excavation',
  lineConcrete: 'line:warehouse-foundations',
  lineSteel: 'line:warehouse-steel-frame',
} as const;

const SOFTWARE = {
  tenantId: 'tenant:lightspeed',
  workspaceId: 'workspace:checkout-platform',
  projectId: 'project:checkout-v2',
  platformId: 'platform:epoch',
  principal: 'principal:tech-lead',
  observer: 'principal:oncall-engineer',
  approver: 'principal:staff-engineer',
  solutionId: 'solution:checkout-v2',
  programId: 'program:checkout-v2-delivery',
  deliveryId: 'delivery:checkout-v2-001',
  workPackageFoundation: 'work-package:checkout-foundation',
  workPackageRelease: 'work-package:checkout-release',
  activityRepo: 'activity:provision-repositories',
  activityPipeline: 'activity:build-pipelines',
  activityRelease: 'activity:release-train',
  lineRepo: 'line:checkout-repositories',
  linePipeline: 'line:checkout-pipelines',
  lineRelease: 'line:checkout-release-engineering',
} as const;

function buildTenancy(tenantId: string, workspaceId: string, projectId: string): JsonValue {
  const hierarchy = new TenancyHierarchy();
  const admit = (node: {
    readonly nodeId: string;
    readonly kind: 'platform' | 'tenant' | 'workspace' | 'project';
    readonly displayName: string;
    readonly parentId: string | null;
  }): void => {
    const sealed = sealTenancyNode({
      schemaVersion: 1,
      nodeId: node.nodeId,
      kind: node.kind,
      displayName: node.displayName,
      parentId: node.parentId,
    });
    if (!sealed.ok) throw new Error(`tenancy seal failed: ${sealed.error.message}`);
    const created = hierarchy.createNode(sealed.value);
    if (!created.ok) throw new Error(`tenancy create failed: ${created.error.message}`);
  };
  admit({ nodeId: 'platform:epoch', kind: 'platform', displayName: 'Epoch Reference Platform', parentId: null });
  admit({ nodeId: tenantId, kind: 'tenant', displayName: 'Fixture tenant', parentId: 'platform:epoch' });
  admit({ nodeId: workspaceId, kind: 'workspace', displayName: 'Fixture workspace', parentId: tenantId });
  admit({ nodeId: projectId, kind: 'project', displayName: 'Fixture project', parentId: workspaceId });
  return hierarchy.snapshot() as unknown as JsonValue;
}

function buildIdentity(tenantId: string, principalId: string, observerId: string, approverId: string): JsonValue {
  const registry = new IdentityRegistry();
  const register = (principal: { readonly principalId: string; readonly kind: 'human' | 'agent' | 'service'; readonly displayName: string }): void => {
    const sealed = sealPrincipal({
      schemaVersion: 1,
      principalId: principal.principalId,
      kind: principal.kind,
      displayName: principal.displayName,
    });
    if (!sealed.ok) throw new Error(`principal seal failed: ${sealed.error.message}`);
    const registered = registry.registerPrincipal(sealed.value);
    if (!registered.ok) throw new Error(`principal register failed: ${registered.error.message}`);
  };
  register({ principalId, kind: 'human', displayName: 'Fixture principal' });
  register({ principalId: observerId, kind: 'human', displayName: 'Fixture observer' });
  register({ principalId: approverId, kind: 'human', displayName: 'Fixture approver' });
  const authentication = authenticationResultRecordFor({
    schemaVersion: 1,
    resultId: 'fixture-auth-result-1',
    assertionId: 'fixture-auth-assertion-1',
    principalId,
    outcome: 'verified',
    decidedAt: T[2],
  });
  return {
    principals: registry.listPrincipals({}) as unknown as JsonValue,
    authenticationResults: [authentication] as unknown as JsonValue,
    tenantId,
  } as unknown as JsonValue;
}

interface WorldSeed {
  readonly entityTypes: readonly { readonly key: string; readonly description: string }[];
  readonly entities: readonly {
    readonly entityId: string;
    readonly entityType: string;
    readonly properties?: Readonly<Record<string, JsonValue>>;
  }[];
  readonly relations: readonly {
    readonly relationType: string;
    readonly source: string;
    readonly targetType: string;
    readonly target: string;
    readonly sourceType?: string | undefined;
  }[];
}

function buildWorld(seed: WorldSeed): { snapshot: JsonValue; digest: string } {
  const world = WorldModel.create({ clock: fixedClock });
  const actor = { id: 'system:fixture-seeder', role: 'system' as const, displayName: 'Fixture Seeder' };
  for (const type of seed.entityTypes) {
    world.registerEntityType({ key: type.key, description: type.description }, actor);
  }
  const entityTypeOf = (entityId: string): string => {
    const found = seed.entities.find((entity) => entity.entityId === entityId);
    if (found === undefined) throw new Error(`unknown seed entity: ${entityId}`);
    return found.entityType;
  };
  const registeredRelations = new Set<string>();
  for (const relation of seed.relations) {
    if (registeredRelations.has(relation.relationType)) continue;
    registeredRelations.add(relation.relationType);
    world.registerRelationType(
      {
        key: relation.relationType,
        description: `Fixture relation ${relation.relationType}`,
        sourceType: relation.sourceType ?? entityTypeOf(relation.source),
        targetType: relation.targetType,
      },
      actor,
    );
  }
  const confidence = {
    distribution: { kind: 'point' as const, value: 0.99 },
    method: 'stated' as const,
    rationale: 'fixture-seeded fact',
  };
  const provenance = {
    actor: { id: 'system:fixture-seeder', role: 'system' as const },
    method: 'fixture-seed',
    evidence: [],
  };
  for (const entity of seed.entities) {
    world.applyAssertion({
      statement: {
        kind: 'entity',
        entityId: entity.entityId,
        entityType: entity.entityType,
        ...(entity.properties !== undefined ? { properties: entity.properties } : {}),
      },
      provenance,
      confidence,
      at: T[0],
    });
  }
  for (const relation of seed.relations) {
    world.applyAssertion({
      statement: {
        kind: 'relation',
        relationType: relation.relationType,
        source: relation.source,
        target: relation.target,
      },
      provenance,
      confidence,
      at: T[0],
    });
  }
  return {
    snapshot: world.serialize() as unknown as JsonValue,
    digest: world.digest(),
  };
}

const constructionWorld: WorldSeed = {
  entityTypes: [
    { key: 'construct:boq-item', description: 'A bill-of-quantities line item' },
    { key: 'construct:activity', description: 'A scheduled construction activity' },
    { key: 'construct:supplier', description: 'A procurement supplier' },
    { key: 'construct:site', description: 'A construction site' },
  ],
  entities: [
    { entityId: 'site:warehouse-b', entityType: 'construct:site', properties: { location: 'Nordstrand', footprintM2: 1800 } },
    { entityId: 'boq:excavation', entityType: 'construct:boq-item', properties: { title: 'Bulk excavation', quantity: 120, unit: 'm3' } },
    { entityId: 'boq:foundations', entityType: 'construct:boq-item', properties: { title: 'Reinforced concrete foundations', quantity: 85, unit: 'm3' } },
    { entityId: 'boq:steel-frame', entityType: 'construct:boq-item', properties: { title: 'Structural steel frame', quantity: 4, unit: 'tonne' } },
    { entityId: 'activity:warehouse-excavation', entityType: 'construct:activity', properties: { title: 'Excavation to formation', plannedStart: T[4], plannedFinish: T[6] } },
    { entityId: 'activity:warehouse-foundations', entityType: 'construct:activity', properties: { title: 'Foundations pour', plannedStart: T[6], plannedFinish: T[7] } },
    { entityId: 'supplier:nordsteel', entityType: 'construct:supplier', properties: { name: 'NordSteel AS', leadTimeDays: 21 } },
    { entityId: 'supplier:balticconcrete', entityType: 'construct:supplier', properties: { name: 'Baltic Concrete OY', leadTimeDays: 14 } },
  ],
  relations: [
    { relationType: 'construct:located-on', source: 'boq:excavation', targetType: 'construct:site', target: 'site:warehouse-b' },
    { relationType: 'construct:located-on', source: 'boq:steel-frame', targetType: 'construct:site', target: 'site:warehouse-b' },
    { relationType: 'construct:supplied-by', source: 'boq:steel-frame', targetType: 'construct:supplier', target: 'supplier:nordsteel' },
    { relationType: 'construct:supplied-by', source: 'boq:foundations', targetType: 'construct:supplier', target: 'supplier:balticconcrete' },
  ],
};

const softwareWorld: WorldSeed = {
  entityTypes: [
    { key: 'software:repository', description: 'A source repository' },
    { key: 'software:ticket', description: 'A work ticket' },
    { key: 'software:release', description: 'A release train' },
    { key: 'software:service', description: 'A deployable service' },
  ],
  entities: [
    { entityId: 'service:checkout-v2', entityType: 'software:service', properties: { name: 'checkout', tier: 'critical' } },
    { entityId: 'repo:checkout-core', entityType: 'software:repository', properties: { language: 'typescript', ci: true } },
    { entityId: 'repo:checkout-payments', entityType: 'software:repository', properties: { language: 'typescript', ci: true } },
    { entityId: 'ticket:checkout-101', entityType: 'software:ticket', properties: { title: 'Idempotent order creation', points: 5 } },
    { entityId: 'ticket:checkout-102', entityType: 'software:ticket', properties: { title: 'Retry-safe payment capture', points: 8 } },
    { entityId: 'release:checkout-v2-alpha', entityType: 'software:release', properties: { train: 'v2', target: T[6] } },
  ],
  relations: [
    { relationType: 'software:composed-of', source: 'service:checkout-v2', targetType: 'software:repository', target: 'repo:checkout-core' },
    { relationType: 'software:composed-of', source: 'service:checkout-v2', targetType: 'software:repository', target: 'repo:checkout-payments' },
    { relationType: 'software:delivered-by', source: 'release:checkout-v2-alpha', sourceType: 'software:release', targetType: 'software:repository', target: 'repo:checkout-core' },
    { relationType: 'software:tracked-in', source: 'ticket:checkout-101', targetType: 'software:repository', target: 'repo:checkout-core' },
  ],
};

function constructionSolutionContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: CONSTRUCTION.solutionId,
    version: '1.0.0',
    tenantId: CONSTRUCTION.tenantId,
    title: 'Warehouse extension (steel frame)',
    description: 'Steel-framed warehouse extension: substructure and superstructure works',
    objective: 'Deliver the warehouse extension within the site constraint set',
    solutionLines: [
      {
        lineId: CONSTRUCTION.lineExcavation,
        title: 'Bulk excavation to formation level',
        description: 'Excavation of the foundation footprint to the specified formation level',
        quantity: { value: '120', unit: 'm3' },
        unitCost: { amount: '18.50', currency: 'EUR' },
        worldEntityId: 'boq:excavation',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: CONSTRUCTION.lineConcrete,
        title: 'Reinforced concrete foundations',
        quantity: { value: '85', unit: 'm3' },
        unitCost: { amount: '210.00', currency: 'EUR' },
        worldEntityId: 'boq:foundations',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: CONSTRUCTION.lineSteel,
        title: 'Structural steel frame',
        quantity: { value: '4', unit: 'tonne' },
        unitCost: { amount: '2400.00', currency: 'EUR' },
        worldEntityId: 'boq:steel-frame',
        acquisitionVariant: 'external-procurement',
      },
    ],
    worldReferences: [
      { entityId: 'boq:excavation' },
      { entityId: 'boq:foundations' },
      { entityId: 'boq:steel-frame' },
      { entityId: 'site:warehouse-b' },
    ],
    constraintReferences: [{ constraintId: 'max-building-height' }],
    previousVersionDigest: null,
    createdAt: T[1],
    createdBy: CONSTRUCTION.principal,
  };
}

function softwareSolutionContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: SOFTWARE.solutionId,
    version: '1.0.0',
    tenantId: SOFTWARE.tenantId,
    title: 'Checkout v2 (idempotent, retry-safe)',
    description: 'Rebuild of the checkout service with idempotency and retry safety',
    objective: 'Deliver checkout v2 with zero double-charges under retries',
    solutionLines: [
      {
        lineId: SOFTWARE.linePipeline,
        title: 'Build + deploy pipelines',
        quantity: { value: '2', unit: 'pipeline' },
        unitCost: { amount: '0', currency: 'EUR' },
        worldEntityId: 'repo:checkout-payments',
        acquisitionVariant: 'internal-allocation',
      },
      {
        lineId: SOFTWARE.lineRelease,
        title: 'Release engineering (alpha -> prod)',
        quantity: { value: '13', unit: 'storypoint' },
        unitCost: { amount: '0', currency: 'EUR' },
        worldEntityId: 'release:checkout-v2-alpha',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: SOFTWARE.lineRepo,
        title: 'Provision repositories + branch protection',
        quantity: { value: '2', unit: 'repo' },
        unitCost: { amount: '0', currency: 'EUR' },
        worldEntityId: 'repo:checkout-core',
        acquisitionVariant: 'internal-allocation',
      },
    ],
    worldReferences: [
      { entityId: 'release:checkout-v2-alpha' },
      { entityId: 'repo:checkout-core' },
      { entityId: 'repo:checkout-payments' },
      { entityId: 'service:checkout-v2' },
    ],
    constraintReferences: [{ constraintId: 'p95-latency-budget' }],
    previousVersionDigest: null,
    createdAt: T[1],
    createdBy: SOFTWARE.principal,
  };
}

function constructionProgramContent(solution: { version: string; contentDigest: string }): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.program-of-work',
    schemaVersion: 1,
    programId: CONSTRUCTION.programId,
    tenantId: CONSTRUCTION.tenantId,
    solutionId: CONSTRUCTION.solutionId,
    solutionVersion: solution.version,
    solutionVersionDigest: solution.contentDigest,
    title: 'Warehouse extension programme',
    workPackages: [
      {
        workPackageId: CONSTRUCTION.workPackageSubstructure,
        title: 'Substructure works',
        description: 'Excavation and reinforced concrete foundations',
        solutionLineId: CONSTRUCTION.lineExcavation,
        worldEntityId: 'boq:foundations',
        realizationVariant: 'construction-build',
        plannedStart: T[4],
        plannedFinish: T[7],
        responsibleActor: CONSTRUCTION.principal,
        resources: [{ resourceId: 'resource:excavator', quantity: '1', unit: 'machine' }],
        constraintReferences: [],
        approvals: [{ approvedBy: CONSTRUCTION.approver, approvedAt: T[3] }],
        verificationGates: [
          {
            gateId: 'gate:formation-level',
            activityId: CONSTRUCTION.activityConcrete,
            title: 'Formation level inspection',
            method: 'construction.verify.inspection',
            criteria: 'Formation level within tolerance',
            evidence: [],
          },
        ],
        activities: [
          {
            activityId: CONSTRUCTION.activityExcavation,
            workPackageId: CONSTRUCTION.workPackageSubstructure,
            title: 'Bulk excavation to formation level',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '120', unit: 'm3' },
            plannedCost: { amount: '2220.00', currency: 'EUR' },
            plannedStart: T[4],
            plannedFinish: T[6],
            predecessors: [],
            successors: [CONSTRUCTION.activityConcrete],
            resources: [{ resourceId: 'resource:excavator', quantity: '1', unit: 'machine' }],
            responsibleActor: CONSTRUCTION.principal,
            constraintReferences: [],
            actualProgress: 1,
            actualStart: T[4],
            actualFinish: T[6],
            blockers: [],
            evidence: [{ digest: 'a'.repeat(64) }],
          },
          {
            activityId: CONSTRUCTION.activityConcrete,
            workPackageId: CONSTRUCTION.workPackageSubstructure,
            title: 'Pour reinforced concrete foundations',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '85', unit: 'm3' },
            plannedCost: { amount: '17850.00', currency: 'EUR' },
            plannedStart: T[6],
            plannedFinish: T[7],
            predecessors: [CONSTRUCTION.activityExcavation],
            successors: [CONSTRUCTION.activityErection],
            resources: [{ resourceId: 'resource:concrete-pump', quantity: '1', unit: 'machine' }],
            responsibleActor: CONSTRUCTION.principal,
            constraintReferences: [],
            actualProgress: 0.5,
            actualStart: T[6],
            blockers: [],
            evidence: [],
          },
        ],
      },
      {
        workPackageId: CONSTRUCTION.workPackageSuperstructure,
        title: 'Superstructure works',
        description: 'Structural steel frame erection',
        solutionLineId: CONSTRUCTION.lineSteel,
        worldEntityId: 'boq:steel-frame',
        realizationVariant: 'construction-build',
        plannedStart: T[7],
        plannedFinish: T[9],
        responsibleActor: CONSTRUCTION.principal,
        resources: [{ resourceId: 'resource:crane', quantity: '1', unit: 'machine' }],
        constraintReferences: [],
        approvals: [{ approvedBy: CONSTRUCTION.approver, approvedAt: T[3] }],
        verificationGates: [],
        activities: [
          {
            activityId: CONSTRUCTION.activityErection,
            workPackageId: CONSTRUCTION.workPackageSuperstructure,
            title: 'Erect structural steel frame',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '4', unit: 'tonne' },
            plannedCost: { amount: '9600.00', currency: 'EUR' },
            plannedStart: T[7],
            plannedFinish: T[9],
            predecessors: [CONSTRUCTION.activityConcrete],
            successors: [],
            resources: [{ resourceId: 'resource:crane', quantity: '1', unit: 'machine' }],
            responsibleActor: CONSTRUCTION.principal,
            constraintReferences: [],
            actualProgress: 0,
            blockers: [],
            evidence: [],
          },
        ],
      },
    ],
    milestones: [
      { milestoneId: 'milestone:foundations-complete', title: 'Foundations complete', targetDate: T[7], status: 'reached', reachedAt: T[7], activityIds: [CONSTRUCTION.activityConcrete], evidence: [{ digest: 'a'.repeat(64) }] },
      { milestoneId: 'milestone:steel-erected', title: 'Steel frame erected', targetDate: T[9], status: 'planned', activityIds: [CONSTRUCTION.activityErection], evidence: [] },
    ],
    createdAt: T[3],
    createdBy: CONSTRUCTION.principal,
  };
}

function softwareProgramContent(solution: { version: string; contentDigest: string }): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.program-of-work',
    schemaVersion: 1,
    programId: SOFTWARE.programId,
    tenantId: SOFTWARE.tenantId,
    solutionId: SOFTWARE.solutionId,
    solutionVersion: solution.version,
    solutionVersionDigest: solution.contentDigest,
    title: 'Checkout v2 delivery programme',
    workPackages: [
      {
        workPackageId: SOFTWARE.workPackageFoundation,
        title: 'Foundation: repositories + pipelines',
        description: 'Provision repos, branch protection, CI/CD',
        solutionLineId: SOFTWARE.lineRepo,
        worldEntityId: 'repo:checkout-core',
        realizationVariant: 'software-implementation-deployment',
        plannedStart: T[4],
        plannedFinish: T[6],
        responsibleActor: SOFTWARE.principal,
        resources: [{ resourceId: 'resource:build-runner', quantity: '2', unit: 'runner' }],
        constraintReferences: [],
        approvals: [{ approvedBy: SOFTWARE.approver, approvedAt: T[3] }],
        verificationGates: [
          {
            gateId: 'gate:pipeline-green',
            activityId: SOFTWARE.activityPipeline,
            title: 'Pipeline green on main',
            method: 'software.verify.pipeline',
            criteria: 'All required checks pass on main',
            evidence: [],
          },
        ],
        activities: [
          {
            activityId: SOFTWARE.activityPipeline,
            workPackageId: SOFTWARE.workPackageFoundation,
            title: 'Build pipelines',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '2', unit: 'pipeline' },
            plannedCost: { amount: '0', currency: 'EUR' },
            plannedStart: T[5],
            plannedFinish: T[6],
            predecessors: [SOFTWARE.activityRepo],
            successors: [SOFTWARE.activityRelease],
            resources: [{ resourceId: 'resource:build-runner', quantity: '2', unit: 'runner' }],
            responsibleActor: SOFTWARE.principal,
            constraintReferences: [],
            actualProgress: 0.5,
            actualStart: T[5],
            blockers: [],
            evidence: [],
          },
          {
            activityId: SOFTWARE.activityRepo,
            workPackageId: SOFTWARE.workPackageFoundation,
            title: 'Provision repositories',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '2', unit: 'repo' },
            plannedCost: { amount: '0', currency: 'EUR' },
            plannedStart: T[4],
            plannedFinish: T[5],
            predecessors: [],
            successors: [SOFTWARE.activityPipeline],
            resources: [{ resourceId: 'resource:build-runner', quantity: '2', unit: 'runner' }],
            responsibleActor: SOFTWARE.principal,
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
        workPackageId: SOFTWARE.workPackageRelease,
        title: 'Release train',
        description: 'Alpha -> beta -> production rollout',
        solutionLineId: SOFTWARE.lineRelease,
        worldEntityId: 'release:checkout-v2-alpha',
        realizationVariant: 'software-implementation-deployment',
        plannedStart: T[6],
        plannedFinish: T[9],
        responsibleActor: SOFTWARE.principal,
        resources: [{ resourceId: 'resource:oncall', quantity: '1', unit: 'engineer' }],
        constraintReferences: [],
        approvals: [{ approvedBy: SOFTWARE.approver, approvedAt: T[3] }],
        verificationGates: [],
        activities: [
          {
            activityId: SOFTWARE.activityRelease,
            workPackageId: SOFTWARE.workPackageRelease,
            title: 'Release train execution',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '13', unit: 'storypoint' },
            plannedCost: { amount: '0', currency: 'EUR' },
            plannedStart: T[6],
            plannedFinish: T[9],
            predecessors: [SOFTWARE.activityPipeline],
            successors: [],
            resources: [{ resourceId: 'resource:oncall', quantity: '1', unit: 'engineer' }],
            responsibleActor: SOFTWARE.principal,
            constraintReferences: [],
            actualProgress: 0,
            blockers: [],
            evidence: [],
          },
        ],
      },
    ],
    milestones: [
      { milestoneId: 'milestone:alpha-cut', title: 'Alpha cut', targetDate: T[6], status: 'reached', reachedAt: T[6], activityIds: [SOFTWARE.activityPipeline], evidence: [] },
      { milestoneId: 'milestone:prod-rollout', title: 'Production rollout', targetDate: T[9], status: 'planned', activityIds: [SOFTWARE.activityRelease], evidence: [] },
    ],
    createdAt: T[3],
    createdBy: SOFTWARE.principal,
  };
}

function buildDomain(
  domain: ProductFixtureDomain,
  tenancy: JsonValue,
  identity: JsonValue,
  world: { snapshot: JsonValue; digest: string },
  solutionContent: Record<string, unknown>,
  programContent: (solution: { version: string; contentDigest: string }) => Record<string, unknown>,
  deliveryId: string,
  tenantId: string,
  solutionId: string,
  principalId: string,
  observerId: string,
  objectBytes: Uint8Array,
): DomainFixture {
  const solution = sealSolutionVersion(solutionContent);
  if (!solution.ok) throw new Error(`solution seal failed: ${JSON.stringify(solution.error)}`);
  const program = buildProgramOfWork(programContent({ version: solution.value.version, contentDigest: solution.value.contentDigest }));
  if (!program.ok) throw new Error(`program build failed: ${JSON.stringify(program.error)}`);
  const delivery = openDeliveryRecord({
    schema: 'epoch.solution-delivery.delivery-record',
    schemaVersion: 1,
    deliveryId,
    tenantId,
    solutionId,
    solutionVersion: solution.value.version,
    solutionVersionDigest: solution.value.contentDigest,
    openedAt: T[3],
    openedBy: principalId,
    status: 'open',
    observations: [],
    acceptedObservationIds: [],
    rejectedObservationIds: [],
    actuals: [],
  });
  if (!delivery.ok) throw new Error(`delivery open failed: ${JSON.stringify(delivery.error)}`);

  // Evidence + object bytes (digest-addressed; the digest is RECOMPUTED here).
  const evidence = EvidenceStore.create();
  const artifactBytes = objectBytes;
  const artifactDigest = sha256Hex(Buffer.from(artifactBytes).toString('latin1'));
  const record = {
    schemaVersion: 1,
    kind: 'observation' as const,
    subject: {
      artifactId: `${domain}-field-capture`,
      revision: 'r1',
      digest: artifactDigest,
    },
    producedBy: { runId: `${domain}-fixture-run`, actorId: observerId },
    observedAt: T[5],
    content: {
      mediaType: 'application/json',
      data: { domain, capture: 'fixture field capture', tenantId },
    },
    confidence: {
      distribution: { kind: 'point' as const, value: 0.9 },
      method: 'stated' as const,
      rationale: 'fixture-seeded observation',
    },
  };
  const receipt = evidence.add(record);
  if (!receipt.ok) throw new Error(`evidence add failed: ${JSON.stringify(receipt.issues)}`);

  return {
    domain,
    fixtureId: `epoch-fixture-${domain}-v${PRODUCT_FIXTURE_VERSION}`,
    tenantId,
    solutionId,
    principalId,
    observerId,
    tenancySnapshot: tenancy,
    identity,
    worldSnapshot: world.snapshot,
    worldDigest: world.digest,
    solution: solution.value as unknown as JsonValue,
    solutionContentDigest: solution.value.contentDigest,
    program: program.value as unknown as JsonValue,
    programContentDigest: program.value.contentDigest,
    delivery: delivery.value as unknown as JsonValue,
    deliveryContentDigest: delivery.value.contentDigest,
    evidence: receipt.receipt.record as unknown as JsonValue,
    evidenceDigest: receipt.receipt.digest,
    objectBytesDigest: artifactDigest,
  };
}

// ---------------------------------------------------------------------------
// Scenario scripts (J07/J08/J11) — deterministic step scripts over the
// fixture records (spec/journey-validation.md journey definitions).
// ---------------------------------------------------------------------------

function j07Script(domain: ProductFixtureDomain, fixture: DomainFixture): JourneyScenarioScript {
  const captureKey = `${domain}-j07-capture-1`;
  const idemKey = `idem:${domain}-j07-sync-1`;
  return {
    schemaVersion: 1,
    scriptId: `scenario:${domain}-j07-offline-reconnect-idempotent-sync`,
    journeyId: 'J07',
    domain,
    description: 'Offline work, queue, reconnect, idempotent sync (J07): a field intent is queued as a pending projection, the first drain fails transiently, the reconnect drain applies it through the Action Gateway path, and a replay of the same idempotency key returns the recorded outcome without double-apply.',
    steps: [
      step('j07-1-enqueue', 'offline.admitIntent', { queueId: `queue:${domain}-j07-1`, idempotencyKey: idemKey, operation: 'delivery.observe', payload: { solutionId: fixture.solutionId, capture: { captureKey, tenantId: fixture.tenantId, observedAt: T[5] } } }, 'the intent is admitted as a PENDING projection (never applied locally)'),
      step('j07-2-drain-offline', 'offline.drain', { at: T[5], network: 'unavailable' }, 'the drain fails transiently; the intent stays pending with lastErrorCode network-unavailable'),
      step('j07-3-reconnect-drain', 'gateway.recovery.replay', { at: T[6], intents: [{ queueId: `queue:${domain}-j07-1`, idempotencyKey: idemKey, operation: 'delivery.observe', payload: { solutionId: fixture.solutionId, capture: { captureKey, tenantId: fixture.tenantId } } }] }, 'the intent drains THROUGH the Action Gateway path with the idempotency key; status drained with a recorded outcomeDigest'),
      step('j07-4-idempotent-replay', 'gateway.recovery.replay', { at: T[7], intents: [{ queueId: `queue:${domain}-j07-1`, idempotencyKey: idemKey, operation: 'delivery.observe', payload: { solutionId: fixture.solutionId, capture: { captureKey, tenantId: fixture.tenantId } } }] }, 'the replay returns the RECORDED outcome (replayed: true, same outcomeDigest) — never double-apply'),
    ],
  };
}

function j08Script(domain: ProductFixtureDomain, fixture: DomainFixture): JourneyScenarioScript {
  return {
    schemaVersion: 1,
    scriptId: `scenario:${domain}-j08-cross-device-handoff-projection`,
    journeyId: 'J08',
    domain,
    description: 'Cross-device handoff (J08): the same project is inspected across devices; the authoritative state is resolved through the gateway; the world projection digest is identical on both devices.',
    steps: [
      step('j08-1-mobile-capture', 'gateway.world.snapshot', { device: 'mobile' }, `the mobile client receives the world snapshot with digest ${fixture.worldDigest}`),
      step('j08-2-desktop-inspect', 'gateway.world.snapshot', { device: 'desktop' }, `the desktop client receives the SAME snapshot digest ${fixture.worldDigest} (authoritative state resolved through Epoch)`),
      step('j08-3-session-handoff', 'gateway.session.validate', { device: 'desktop' }, 'the session scope (principal + tenant) is identical across devices; no second semantic ledger'),
      step('j08-4-projection-cache', 'runtime.admitServerProjection', { digest: fixture.worldDigest, revision: 1 }, 'the local projection cache admits the server projection by digest (read-only, immutable)'),
    ],
  };
}

function j11Script(domain: ProductFixtureDomain): JourneyScenarioScript {
  return {
    schemaVersion: 1,
    scriptId: `scenario:${domain}-j11-failure-recovery`,
    journeyId: 'J11',
    domain,
    description: 'Recovery from network/session/connector failures (J11): session expiry forces re-authentication; connector failures map to transient (retry-with-backoff); authority rejections surface with the authority error verbatim.',
    steps: [
      step('j11-1-session-expiry', 'gateway.call', { operation: 'world.entities', sessionExpiresAt: T[8] }, 'the call fails with the auth-session-expired error class; the client recovery action is re-authenticate'),
      step('j11-2-reauthenticate', 'gateway.session.issue', { at: T[9] }, 'a fresh session is issued from a verified authentication result'),
      step('j11-3-connector-failure', 'gateway.call', { operation: 'evidence.intake', connector: 'unavailable' }, 'the call fails with the transient error class; the client recovery action is retry-with-backoff (or offline requeue)'),
      step('j11-4-retry-succeeds', 'gateway.call', { operation: 'evidence.intake', connector: 'restored' }, 'the retried call succeeds; the outcome carries the correlation id of the ORIGINAL attempt (causation chain)'),
      step('j11-5-authority-rejection', 'gateway.call', { operation: 'delivery.observe', payload: 'invalid-capture' }, 'the authority rejection surfaces with the authority code verbatim (never a client-local semantic error)'),
    ],
  };
}

// ---------------------------------------------------------------------------
// Rendering (canonical JSON, per-file digests, the registry + the
// journey-fixture contract).
// ---------------------------------------------------------------------------

function renderJson(value: unknown): string {
  return `${canonicalJsonStringify(value as never)}\n`;
}

function buildConstructionFixture(): DomainFixture {
  const tenancy = buildTenancy(CONSTRUCTION.tenantId, CONSTRUCTION.workspaceId, CONSTRUCTION.projectId);
  const identity = buildIdentity(CONSTRUCTION.tenantId, CONSTRUCTION.principal, CONSTRUCTION.observer, CONSTRUCTION.approver);
  const world = buildWorld(constructionWorld);
  return buildDomain(
    'construction',
    tenancy,
    identity,
    world,
    constructionSolutionContent(),
    constructionProgramContent,
    CONSTRUCTION.deliveryId,
    CONSTRUCTION.tenantId,
    CONSTRUCTION.solutionId,
    CONSTRUCTION.principal,
    CONSTRUCTION.observer,
    new Uint8Array([99, 111, 110, 115, 116, 114, 117, 99, 116, 105, 111, 110, 45, 102, 105, 101, 108, 100, 45, 99, 97, 112, 116, 117, 114, 101]),
  );
}

function buildSoftwareFixture(): DomainFixture {
  const tenancy = buildTenancy(SOFTWARE.tenantId, SOFTWARE.workspaceId, SOFTWARE.projectId);
  const identity = buildIdentity(SOFTWARE.tenantId, SOFTWARE.principal, SOFTWARE.observer, SOFTWARE.approver);
  const world = buildWorld(softwareWorld);
  return buildDomain(
    'software',
    tenancy,
    identity,
    world,
    softwareSolutionContent(),
    softwareProgramContent,
    SOFTWARE.deliveryId,
    SOFTWARE.tenantId,
    SOFTWARE.solutionId,
    SOFTWARE.principal,
    SOFTWARE.observer,
    new Uint8Array([115, 111, 102, 116, 119, 97, 114, 101, 45, 102, 105, 101, 108, 100, 45, 99, 97, 112, 116, 117, 114, 101]),
  );
}

/**
 * Render the COMPLETE product fixture set: the construction + software
 * domain records under qa/fixtures/, and the journey-fixture contract
 * under spec/journeys/fixtures/. Ordered map of repository-relative path
 * -> exact canonical file content (byte-stable).
 */
export function renderProductFixtureFiles(): Readonly<Record<string, string>> {
  const files: Record<string, string> = {};
  const construction = buildConstructionFixture();
  const software = buildSoftwareFixture();
  const domains: readonly DomainFixture[] = [construction, software];
  const registryFiles: Array<{ path: string; sha256: string }> = [];

  const emit = (path: string, value: unknown): void => {
    const content = renderJson(value);
    files[path] = content;
    registryFiles.push({ path, sha256: sha256Hex(content) });
  };

  for (const fixture of domains) {
    emit(`qa/fixtures/${fixture.domain}/tenancy.json`, fixture.tenancySnapshot);
    emit(`qa/fixtures/${fixture.domain}/identity.json`, fixture.identity);
    emit(`qa/fixtures/${fixture.domain}/world.json`, fixture.worldSnapshot);
    emit(`qa/fixtures/${fixture.domain}/solution.json`, fixture.solution);
    emit(`qa/fixtures/${fixture.domain}/program-of-work.json`, fixture.program);
    emit(`qa/fixtures/${fixture.domain}/delivery.json`, fixture.delivery);
    emit(`qa/fixtures/${fixture.domain}/evidence.json`, {
      record: fixture.evidence,
      evidenceDigest: fixture.evidenceDigest,
      objectBytesDigest: fixture.objectBytesDigest,
    });
    const j07 = j07Script(fixture.domain, fixture);
    const j08 = j08Script(fixture.domain, fixture);
    const j11 = j11Script(fixture.domain);
    emit(`qa/fixtures/${fixture.domain}/scenario-j07.json`, j07);
    emit(`qa/fixtures/${fixture.domain}/scenario-j08.json`, j08);
    emit(`qa/fixtures/${fixture.domain}/scenario-j11.json`, j11);
  }

  // The fixture registry (per-file digests; the journey system's fixture
  // address).
  emit('qa/fixtures/registry.json', {
    schemaVersion: 1,
    fixtureVersion: PRODUCT_FIXTURE_VERSION,
    description:
      'Deterministic product fixtures for the journey system (W046): construction (BOQ/schedule/procurement) + software (repo/ticket/release) domains with seeded worlds, solutions, programs of work, delivery records, evidence and J07/J08/J11 scenario scripts. Byte-stable: frozen instants, seeded ids, canonical JSON, per-file SHA-256 digests.',
    generatedBy: 'renderProductFixtureFiles() in @epoch/application-gateway (REAL kernels: tenancy, identity, world-model, solution-delivery, evidence)',
    determinism: {
      clock: 'frozen (FIXTURE_INSTANTS, one-hour steps, canonical UTC)',
      randomness: 'none (content-addressed ids from seeded material)',
      instants: FIXTURE_INSTANTS,
    },
    domains: domains.map((fixture) => ({
      domain: fixture.domain,
      fixtureId: fixture.fixtureId,
      worldDigest: fixture.worldDigest,
      solutionContentDigest: fixture.solutionContentDigest,
      programContentDigest: fixture.programContentDigest,
      deliveryContentDigest: fixture.deliveryContentDigest,
      evidenceDigest: fixture.evidenceDigest,
      objectBytesDigest: fixture.objectBytesDigest,
      files: registryFiles
        .filter((entry) => entry.path.startsWith(`qa/fixtures/${fixture.domain}/`))
        .map((entry) => ({ file: entry.path.replace(`qa/fixtures/${fixture.domain}/`, ''), sha256: entry.sha256 })),
    })),
  });

  // The journey-fixture contract (spec/journeys/fixtures/): what the
  // journey system consumes per journey (J07/J08/J11).
  emit('spec/journeys/fixtures/journey-fixtures.json', {
    schemaVersion: 1,
    fixtureVersion: PRODUCT_FIXTURE_VERSION,
    description:
      'The journey-system fixture contract (W046): deterministic fixture + scenario-script references for the offline/reconnect (J07), cross-device handoff (J08) and failure/recovery (J11) journeys, per domain. Journey records reference these fixture ids; expected outcome digests anchor cross-client canonical equivalence.',
    journeys: domains.flatMap((fixture) => [
      {
        journeyId: 'J07',
        domain: fixture.domain,
        fixtureId: fixture.fixtureId,
        scenarioScript: `qa/fixtures/${fixture.domain}/scenario-j07.json`,
        preconditions: ['a session issued from the fixture authentication result', 'the offline queue bound to the session scope'],
        expectedOutcomeDigests: {
          worldDigest: fixture.worldDigest,
          solutionContentDigest: fixture.solutionContentDigest,
        },
      },
      {
        journeyId: 'J08',
        domain: fixture.domain,
        fixtureId: fixture.fixtureId,
        scenarioScript: `qa/fixtures/${fixture.domain}/scenario-j08.json`,
        preconditions: ['the fixture world projected through the gateway', 'two client devices sharing the session scope'],
        expectedOutcomeDigests: {
          worldDigest: fixture.worldDigest,
          programContentDigest: fixture.programContentDigest,
        },
      },
      {
        journeyId: 'J11',
        domain: fixture.domain,
        fixtureId: fixture.fixtureId,
        scenarioScript: `qa/fixtures/${fixture.domain}/scenario-j11.json`,
        preconditions: ['a session approaching expiry', 'a flaky connector + an invalid authority payload'],
        expectedOutcomeDigests: {
          worldDigest: fixture.worldDigest,
          deliveryContentDigest: fixture.deliveryContentDigest,
        },
      },
    ]),
  });

  return files;
}

/** Look up one scenario script (programmatic access for journey tooling). */
export function scenarioScriptOf(
  journey: 'J07' | 'J08' | 'J11',
  domain: ProductFixtureDomain,
): JourneyScenarioScript | null {
  const construction = buildConstructionFixture();
  const software = buildSoftwareFixture();
  const fixture = domain === 'construction' ? construction : software;
  switch (journey) {
    case 'J07':
      return j07Script(domain, fixture);
    case 'J08':
      return j08Script(domain, fixture);
    case 'J11':
      return j11Script(domain);
  }
}
