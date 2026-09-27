// Shared fixtures for the construction-pack tests: ONE synthetic
// construction solution (a warehouse extension building project) driving
// the whole chain — solution -> program -> BOQ -> programme -> links -> outcomes.
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
import type { WorldEntityView } from '../src/boq';

// --------------------------------------------------------------------------------
// Fixed constants (zero clock reads).
// --------------------------------------------------------------------------------

export const T0 = '2026-03-02T08:00:00.000Z';
export const T1 = '2026-03-02T09:00:00.000Z';
export const T2 = '2026-03-02T10:00:00.000Z';
export const T3 = '2026-03-02T11:00:00.000Z';
export const T4 = '2026-03-02T12:00:00.000Z';
export const T5 = '2026-03-02T13:00:00.000Z';
export const T6 = '2026-03-02T14:00:00.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:delivery-lead';
export const OBSERVER = 'principal:field-engineer';
export const APPROVER = 'principal:chief-engineer';
export const PROCUREMENT = 'principal:procurement-lead';

export const SOLUTION_ID = 'solution:warehouse-extension';
export const PROGRAM_ID = 'program:warehouse-extension-v1';
export const DELIVERY_ID = 'delivery:warehouse-extension-v1';

/** A deterministic 64-char lowercase-hex evidence digest. */
export const DIGEST = (char: string): string => char.repeat(64);
export const EVIDENCE_A = DIGEST('a');
export const EVIDENCE_B = DIGEST('b');
export const EVIDENCE_C = DIGEST('c');

/** The world entities of the building project (id + W002 type key). */
export const WORLD_ENTITIES: readonly WorldEntityView[] = [
  { id: 'element-foundations', type: 'construction:element' },
  { id: 'element-frame', type: 'construction:element' },
  { id: 'space-hall', type: 'construction:space' },
  { id: 'system-facade', type: 'construction:system' },
  { id: 'zone-entrance', type: 'construction:zone' },
];

/** One valid uncertainty state (observed provenance, fresh, measured confidence). */
function uncertainty(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:site-report', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T3 },
    confidence: { method: 'measured', value: 0.95, rationale: 'direct site measurement' },
  };
}

// --------------------------------------------------------------------------------
// The solution version (the building-project plan lines).
// --------------------------------------------------------------------------------

/** The warehouse-extension solution version content as loose JSON. */
export function solutionContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: SOLUTION_ID,
    version: '1.0.0',
    tenantId: TENANT,
    title: 'Warehouse extension',
    description: 'Steel-framed warehouse extension with facade and fit-out',
    objective: 'Deliver 400 m2 of additional storage volume within the site constraint set',
    solutionLines: [
      {
        lineId: 'line:bulk-excavation',
        title: 'Bulk excavation to formation level',
        description: 'Excavation of the foundation footprint to the specified formation level',
        quantity: { value: '120', unit: 'm3' },
        unitCost: { amount: '18.50', currency: 'EUR' },
        worldEntityId: 'element-foundations',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: 'line:concrete-foundations',
        title: 'Reinforced concrete foundations',
        quantity: { value: '85', unit: 'm3' },
        unitCost: { amount: '210.00', currency: 'EUR' },
        worldEntityId: 'element-foundations',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: 'line:door-sets',
        title: 'Door sets supply and install',
        quantity: { value: '24', unit: 'number' },
        unitCost: { amount: '480.00', currency: 'EUR' },
        worldEntityId: 'zone-entrance',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: 'line:facade-walls',
        title: 'Facade wall assemblies',
        quantity: { value: '240', unit: 'm2' },
        unitCost: { amount: '92.50', currency: 'EUR' },
        worldEntityId: 'system-facade',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: 'line:floor-deck',
        title: 'Composite floor deck',
        quantity: { value: '320', unit: 'm2' },
        unitCost: { amount: '64.00', currency: 'EUR' },
        worldEntityId: 'element-frame',
        acquisitionVariant: 'external-procurement',
      },
      {
        lineId: 'line:preliminaries',
        title: 'Contract preliminaries and general items',
        description: 'Site establishment, supervision and general items (lump sum)',
        quantity: { value: '1', unit: 'sum' },
        unitCost: { amount: '12500.00', currency: 'EUR' },
      },
      {
        lineId: 'line:steel-frame',
        title: 'Structural steel frame',
        quantity: { value: '4', unit: 'tonne' },
        unitCost: { amount: '2400.00', currency: 'EUR' },
        worldEntityId: 'element-frame',
        acquisitionVariant: 'external-procurement',
      },
    ],
    worldReferences: WORLD_ENTITIES.map((entity) => ({ entityId: entity.id })),
    constraintReferences: [
      { constraintId: 'max-building-height' },
      { constraintId: 'site-access-window' },
    ],
    previousVersionDigest: null,
    createdAt: T0,
    createdBy: PRINCIPAL,
    ...overrides,
  };
}

/** The sealed warehouse-extension solution version. */
export function sealedSolution(overrides: Record<string, unknown> = {}): SealedSolutionVersion {
  const sealed = sealSolutionVersion(solutionContent(overrides));
  if (!sealed.ok) {
    throw new Error(`fixture solution failed to seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

// --------------------------------------------------------------------------------
// The program of work (the construction programme).
// --------------------------------------------------------------------------------

/** The warehouse-extension program-of-work content as loose JSON. */
export function programContent(sealed: SealedSolutionVersion): Record<string, unknown> {
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
        workPackageId: 'work-package:envelope',
        title: 'Building envelope works',
        description: 'Facade assemblies and weather-tight envelope',
        solutionLineId: 'line:facade-walls',
        worldEntityId: 'system-facade',
        realizationVariant: 'construction-build',
        plannedStart: T3,
        plannedFinish: T5,
        responsibleActor: 'principal:facade-lead',
        resources: [],
        constraintReferences: [{ constraintId: 'site-access-window' }],
        approvals: [],
        verificationGates: [
          {
            gateId: 'gate:facade-inspection',
            activityId: 'activity:facade-install',
            title: 'Facade installation inspection',
            method: 'construction.verify.inspection',
            criteria: 'Assembly fixing and tolerance check per specification',
            evidence: [],
          },
        ],
        activities: [
          {
            activityId: 'activity:facade-install',
            workPackageId: 'work-package:envelope',
            title: 'Install facade wall assemblies',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '240', unit: 'm2' },
            plannedCost: { amount: '22200.00', currency: 'EUR' },
            plannedStart: T3,
            plannedFinish: T5,
            predecessors: ['activity:floor-deck-install'],
            successors: ['activity:door-install'],
            resources: [],
            responsibleActor: 'principal:facade-lead',
            constraintReferences: [],
            actualProgress: 0.25,
            actualStart: T4,
            blockers: [],
            evidence: [{ digest: EVIDENCE_B }],
          },
        ],
      },
      {
        workPackageId: 'work-package:fitout',
        title: 'Fit-out works',
        description: 'Door sets and final fit-out',
        solutionLineId: 'line:door-sets',
        realizationVariant: 'construction-build',
        plannedStart: T5,
        plannedFinish: T6,
        responsibleActor: 'principal:fitout-lead',
        resources: [],
        constraintReferences: [],
        approvals: [],
        verificationGates: [
          {
            gateId: 'gate:door-commissioning',
            activityId: 'activity:door-install',
            title: 'Door set commissioning test',
            method: 'construction.verify.commissioning-test',
            criteria: 'Opening/closing cycles and safety interlocks',
            evidence: [],
          },
        ],
        activities: [
          {
            activityId: 'activity:door-install',
            workPackageId: 'work-package:fitout',
            title: 'Install door sets',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '24', unit: 'number' },
            plannedCost: { amount: '11520.00', currency: 'EUR' },
            plannedStart: T5,
            plannedFinish: T6,
            predecessors: ['activity:facade-install'],
            successors: [],
            resources: [],
            responsibleActor: 'principal:fitout-lead',
            constraintReferences: [],
            blockers: [],
            evidence: [],
          },
        ],
      },
      {
        workPackageId: 'work-package:substructure',
        title: 'Substructure works',
        description: 'Excavation and reinforced concrete foundations',
        solutionLineId: 'line:bulk-excavation',
        worldEntityId: 'element-foundations',
        realizationVariant: 'construction-build',
        plannedStart: T1,
        plannedFinish: T3,
        responsibleActor: PRINCIPAL,
        resources: [
          { resourceId: 'resource:concrete-pump', quantity: '12', unit: 'hour' },
          { resourceId: 'resource:excavator', quantity: '1', unit: 'machine' },
        ],
        constraintReferences: [],
        approvals: [{ approvedBy: APPROVER, approvedAt: T0 }],
        verificationGates: [
          {
            gateId: 'gate:formation-inspection',
            activityId: 'activity:excavation-bulk',
            title: 'Formation level inspection',
            method: 'construction.verify.inspection',
            criteria: 'Formation level within tolerance',
            evidence: [{ digest: EVIDENCE_A }],
            passedAt: T2,
            passedBy: APPROVER,
          },
          {
            gateId: 'gate:foundation-measurement',
            activityId: 'activity:foundation-concrete',
            title: 'Foundation pour measurement against BOQ',
            method: 'construction.verify.measurement-against-boq',
            criteria: 'Poured volume re-measured against the BOQ net quantity',
            evidence: [],
          },
        ],
        activities: [
          {
            activityId: 'activity:excavation-bulk',
            workPackageId: 'work-package:substructure',
            title: 'Bulk excavation to formation level',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '120', unit: 'm3' },
            plannedCost: { amount: '2220.00', currency: 'EUR' },
            plannedStart: T1,
            plannedFinish: T2,
            predecessors: [],
            successors: ['activity:foundation-concrete'],
            resources: [{ resourceId: 'resource:excavator', quantity: '1', unit: 'machine' }],
            responsibleActor: PRINCIPAL,
            constraintReferences: [],
            actualProgress: 1,
            actualStart: T1,
            actualFinish: T2,
            blockers: [],
            evidence: [{ digest: EVIDENCE_A }],
          },
          {
            activityId: 'activity:foundation-concrete',
            workPackageId: 'work-package:substructure',
            title: 'Pour reinforced concrete foundations',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '85', unit: 'm3' },
            plannedCost: { amount: '17850.00', currency: 'EUR' },
            plannedStart: T2,
            plannedFinish: T3,
            predecessors: ['activity:excavation-bulk'],
            successors: ['activity:steel-erection'],
            resources: [{ resourceId: 'resource:concrete-pump', quantity: '12', unit: 'hour' }],
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
        workPackageId: 'work-package:superstructure',
        title: 'Superstructure frame works',
        description: 'Structural steel erection and composite floor deck',
        solutionLineId: 'line:steel-frame',
        worldEntityId: 'element-frame',
        realizationVariant: 'construction-build',
        plannedStart: T3,
        plannedFinish: T5,
        responsibleActor: 'principal:steel-lead',
        resources: [{ resourceId: 'resource:mobile-crane', quantity: '8', unit: 'day' }],
        constraintReferences: [{ constraintId: 'max-building-height' }],
        approvals: [],
        verificationGates: [
          {
            gateId: 'gate:steel-certificate',
            activityId: 'activity:steel-erection',
            title: 'Structural steel material certificates',
            method: 'construction.verify.material-certificate',
            criteria: 'Mill certificates match the specified grade',
            evidence: [{ digest: EVIDENCE_C }],
          },
        ],
        activities: [
          {
            activityId: 'activity:floor-deck-install',
            workPackageId: 'work-package:superstructure',
            title: 'Install composite floor deck',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '320', unit: 'm2' },
            plannedCost: { amount: '20480.00', currency: 'EUR' },
            plannedStart: T4,
            plannedFinish: T5,
            predecessors: ['activity:steel-erection'],
            successors: ['activity:facade-install'],
            resources: [],
            responsibleActor: 'principal:steel-lead',
            constraintReferences: [],
            blockers: [],
            evidence: [],
          },
          {
            activityId: 'activity:steel-erection',
            workPackageId: 'work-package:superstructure',
            title: 'Erect structural steel frame',
            realizationVariant: 'construction-build',
            plannedQuantity: { value: '4', unit: 'tonne' },
            plannedCost: { amount: '9600.00', currency: 'EUR' },
            plannedStart: T3,
            plannedFinish: T4,
            predecessors: ['activity:foundation-concrete'],
            successors: ['activity:floor-deck-install'],
            resources: [{ resourceId: 'resource:mobile-crane', quantity: '8', unit: 'day' }],
            responsibleActor: 'principal:steel-lead',
            constraintReferences: [],
            actualProgress: 0.5,
            actualStart: T4,
            blockers: [],
            evidence: [],
          },
        ],
      },
    ],
    milestones: [
      {
        milestoneId: 'milestone:foundations-complete',
        title: 'Foundations complete',
        targetDate: T3,
        activityIds: ['activity:excavation-bulk', 'activity:foundation-concrete'],
        status: 'reached',
        reachedAt: T3,
        evidence: [{ digest: EVIDENCE_B }],
      },
      {
        milestoneId: 'milestone:frame-complete',
        title: 'Frame complete',
        targetDate: T4,
        activityIds: ['activity:floor-deck-install', 'activity:steel-erection'],
        status: 'planned',
        evidence: [],
      },
      {
        milestoneId: 'milestone:practical-completion',
        title: 'Practical completion',
        targetDate: T6,
        activityIds: ['activity:door-install', 'activity:facade-install'],
        status: 'planned',
        evidence: [],
      },
    ],
    createdAt: T1,
    createdBy: PRINCIPAL,
  };
}

/** The sealed warehouse-extension program of work. */
export function sealedProgram(sealed: SealedSolutionVersion): SealedProgramOfWork {
  const built = buildProgramOfWork(programContent(sealed));
  if (!built.ok) {
    throw new Error(`fixture program failed to build: ${JSON.stringify(built.error)}`);
  }
  return built.value;
}

// --------------------------------------------------------------------------------
// The acquisition requests (procurement of the plan lines).
// --------------------------------------------------------------------------------

/** The warehouse-extension acquisition requests as loose JSON. */
export function acquisitionContents(sealed: SealedSolutionVersion): Record<string, unknown>[] {
  return [
    {
      schema: 'epoch.solution-delivery.acquisition-request',
      schemaVersion: 1,
      acquisitionId: 'acquisition:concrete-supply',
      tenantId: sealed.tenantId,
      solutionId: sealed.solutionId,
      deliveryId: DELIVERY_ID,
      detail: {
        variant: 'external-procurement',
        lines: [
          {
            description: 'Blinding concrete C16/20',
            quantity: '40',
            unit: 'm3',
            solutionLineId: 'line:concrete-foundations',
          },
          {
            description: 'Ready-mix concrete C30/37',
            quantity: '85',
            unit: 'm3',
            solutionLineId: 'line:concrete-foundations',
          },
        ],
      },
      requestedAt: T1,
      requestedBy: PROCUREMENT,
      neededBy: T2,
      note: 'Foundation concrete supply against the BOQ quantities',
    },
    {
      schema: 'epoch.solution-delivery.acquisition-request',
      schemaVersion: 1,
      acquisitionId: 'acquisition:site-plant',
      tenantId: sealed.tenantId,
      solutionId: sealed.solutionId,
      detail: {
        variant: 'internal-allocation',
        resourceRef: 'resource:excavator-fleet',
        quantity: '2',
        unit: 'machine',
        fromScope: 'plant-yard:east',
      },
      requestedAt: T0,
      requestedBy: PRINCIPAL,
      note: 'Internal plant allocation for the substructure package',
    },
    {
      schema: 'epoch.solution-delivery.acquisition-request',
      schemaVersion: 1,
      acquisitionId: 'acquisition:steel-supply',
      tenantId: sealed.tenantId,
      solutionId: sealed.solutionId,
      deliveryId: DELIVERY_ID,
      detail: {
        variant: 'external-procurement',
        lines: [
          {
            description: 'Metal decking sheets',
            quantity: '320',
            unit: 'm2',
            solutionLineId: 'line:floor-deck',
          },
          {
            description: 'Structural steel sections grade S355',
            quantity: '4',
            unit: 'tonne',
            solutionLineId: 'line:steel-frame',
          },
        ],
      },
      requestedAt: T2,
      requestedBy: PROCUREMENT,
      neededBy: T3,
      note: 'Superstructure steel and decking supply',
    },
  ];
}

/** The admitted warehouse-extension acquisition requests. */
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
    recordId: 'observation:excavation-progress',
    tenantId,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: 'activity:excavation-bulk',
    },
    measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
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
      recordId: 'observation:facade-measurement',
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution-line', subjectId: 'line:facade-walls' },
      measure: { kind: 'quantity', value: '60', unit: 'm2' },
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
      recordId: 'observation:milestone-check',
      subject: {
        solutionId: SOLUTION_ID,
        subjectKind: 'milestone',
        subjectId: 'milestone:foundations-complete',
      },
      measure: { kind: 'progress', fraction: 1 },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: T3,
        observedBy: OBSERVER,
        evidence: [],
      },
      recordedAt: T3,
      recordedBy: OBSERVER,
    }),
    observationContent(tenantId, {
      recordId: 'observation:steel-receipt',
      subject: {
        solutionId: SOLUTION_ID,
        subjectKind: 'work-package',
        subjectId: 'work-package:superstructure',
      },
      measure: { kind: 'quantity', value: '4', unit: 'tonne' },
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
  for (const observationId of ['observation:excavation-progress', 'observation:facade-measurement', 'observation:steel-receipt']) {
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
    { observationId: 'observation:excavation-progress', actualId: 'actual:excavation-quantity', at: T4 },
    { observationId: 'observation:facade-measurement', actualId: 'actual:facade-quantity', at: T5 },
    { observationId: 'observation:steel-receipt', actualId: 'actual:steel-received', at: T5 },
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
// The outcome records (practical completion, defects liability).
// --------------------------------------------------------------------------------

/** The sealed outcome distinction records of the building project. */
export function outcomeRecords(): SealedDistinctionRecord[] {
  const contents = [
    {
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'outcome',
      recordId: 'outcome:practical-completion',
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      payload: {
        outcomeKind: 'accepted',
        verificationRefs: [DIGEST('c')],
        note: 'Works accepted at practical completion subject to the defects liability period',
      },
      recordedAt: T6,
      recordedBy: APPROVER,
      uncertainty: uncertainty(),
    },
    {
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'outcome',
      recordId: 'outcome:defects-residual',
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      payload: {
        outcomeKind: 'residual',
        verificationRefs: [],
        note: 'Two outstanding minor defects carried into the defects liability period',
      },
      recordedAt: T6,
      recordedBy: APPROVER,
      uncertainty: uncertainty(),
    },
    {
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'outcome',
      recordId: 'outcome:handover',
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      payload: {
        outcomeKind: 'handover',
        verificationRefs: [DIGEST('d')],
        note: 'Keys and manuals handed to the employer',
      },
      recordedAt: T6,
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
    schema: 'epoch.pack-construction.cost-class-index',
    schemaVersion: 1,
    assignments: [
      { activityId: 'activity:door-install', resourceClass: 'subcontract' },
      { activityId: 'activity:excavation-bulk', resourceClass: 'plant' },
      { activityId: 'activity:facade-install', resourceClass: 'material' },
      { activityId: 'activity:foundation-concrete', resourceClass: 'material' },
      { activityId: 'activity:steel-erection', resourceClass: 'subcontract' },
    ],
  };
}

/** The resource-classification index over the fixture resources. */
export function resourceClassIndex(): ResourceClassIndex {
  return {
    schema: 'epoch.pack-construction.resource-class-index',
    schemaVersion: 1,
    assignments: [
      { resourceId: 'resource:concrete-pump', resourceClass: 'plant' },
      { resourceId: 'resource:excavator', resourceClass: 'plant' },
      { resourceId: 'resource:mobile-crane', resourceClass: 'plant' },
    ],
  };
}

// --------------------------------------------------------------------------------
// The full chain (solution -> program -> acquisitions -> delivery).
// --------------------------------------------------------------------------------

/** The full warehouse-extension fixture chain. */
export interface WarehouseChain {
  readonly solution: SealedSolutionVersion;
  readonly program: SealedProgramOfWork;
  readonly acquisitions: readonly AcquisitionRequestRecord[];
  readonly delivery: SealedDeliveryRecord;
  readonly worldEntities: readonly WorldEntityView[];
}

/** Build the full warehouse-extension fixture chain. */
export function warehouseChain(): WarehouseChain {
  const solution = sealedSolution();
  return {
    solution,
    program: sealedProgram(solution),
    acquisitions: acquisitions(solution),
    delivery: sealedDelivery(solution),
    worldEntities: WORLD_ENTITIES,
  };
}
