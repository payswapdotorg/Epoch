import type { FixtureBundle, FixtureDomain } from '../../src/native/web';

/**
 * The UI-side journey payload assembly (W048).
 *
 * The visible product carries NO harness fixtures: compiled constraints,
 * policy sets, verification chains with content, and procurement quote
 * assemblies live in qa/desktop (the journey harness — they are built
 * through the REAL kernels as reference data). What the UI DOES need is
 * the plain reference-data shapes the paste-based and fixture-driven
 * forms assemble: the W003 action-proposal example, the field-capture /
 * forecast / closing records for J06, and the fixture-derived delivery
 * and solution content. These are pure data (no kernel imports, no
 * second semantic store) — every semantic value still arrives through
 * the gateway authorities.
 */

/** The frozen fixture-day instants (reference-data timestamps). */
const T = {
  t3: '2026-03-02T11:00:00.000Z',
  t5: '2026-03-02T13:00:00.000Z',
  t6: '2026-03-02T14:00:00.000Z',
  t7: '2026-03-02T15:00:00.000Z',
} as const;

/** The delivery id the UI's realize flow opens (one per product run). */
export const UI_DELIVERY_ID = 'delivery:ui-j06-001';

/** One domain's UI reference payloads. */
export interface UiScenario {
  readonly domain: FixtureDomain;
  readonly tenantId: string;
  readonly principalId: string;
  readonly approverId: string;
  readonly approverRole: string;
  readonly solutionId: string;
  readonly activityId: string;
  /** A REAL W003-shaped example proposal for the J04 paste form. */
  readonly exampleActionProposal: Record<string, unknown>;
  /** The J06 field-capture shape (delivery ids point at the UI delivery). */
  fieldCapture(captureKey: string): Record<string, unknown>;
  /** The J06 rolling-forecast input. */
  forecastInput(): Record<string, unknown>;
  /** The J06 delivery-closing input. */
  deliveryClosing(): Record<string, unknown>;
}

const CONSTRUCTION: UiScenario = {
  domain: 'construction',
  tenantId: 'tenant:nordstrand',
  principalId: 'principal:delivery-lead',
  approverId: 'principal:chief-engineer',
  approverRole: 'senior-structural-engineer',
  solutionId: 'solution:warehouse-extension-steel',
  activityId: 'activity:warehouse-excavation',
  exampleActionProposal: {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: 'desktop-msg-proposal-ui-1',
    createdAt: T.t3,
    proposalId: 'desktop-prop-ui-0001',
    proposedBy: 'agent:desktop-ui',
    actionType: { id: 'structural.element.reinforce', version: '1.0.0' },
    target: { kind: 'world-entity', ref: 'entity:beam-b-12' },
    parameters: { 'reinforcement-class': 'B' },
    preconditions: [],
    predictedEffects: [
      { description: 'Utilization drops below unity.', confidence: { kind: 'quantified', value: 0.9 } },
    ],
    sideEffects: [{ description: 'Crew rework scheduling.', reversible: false }],
    reversibility: { kind: 'partially-reversible', notes: 'Removable reinforcement; labor unrecoverable.' },
    authorityRequirements: {
      requiredScopes: ['world:write'],
      requiresHumanApproval: true,
      approvalQuorum: { approvals: 1, roles: ['senior-structural-engineer'] },
    },
    rationale: 'W048 desktop UI action example (paste your own proposal).',
    evidenceRefs: ['simrun:desktop-ui-1'],
    expiresAt: '2026-04-02T09:00:00.000Z',
  },
  fieldCapture(captureKey) {
    return {
      captureKey,
      tenantId: 'tenant:nordstrand',
      solutionId: 'solution:warehouse-extension-steel',
      deliveryId: UI_DELIVERY_ID,
      observedAt: T.t5,
      observedBy: 'principal:field-engineer',
      subjectRef: { kind: 'activity', id: 'activity:warehouse-excavation' },
      measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
      uncertainty: {
        schemaVersion: 1,
        provenance: { kind: 'observed', sourceRef: 'source:desktop-ui', actor: 'principal:field-engineer' },
        freshness: { state: 'fresh', assessedAt: T.t5 },
        confidence: { method: 'measured', value: 0.95, rationale: 'direct field measurement' },
      },
    };
  },
  forecastInput() {
    return {
      recordId: 'forecast:ui-excavation-r1',
      tenantId: 'tenant:nordstrand',
      subject: { solutionId: 'solution:warehouse-extension-steel', subjectKind: 'activity', subjectId: 'activity:warehouse-excavation' },
      planned: { kind: 'quantity', value: '120', unit: 'm3' },
      actualsToDate: { kind: 'quantity', value: '60', unit: 'm3' },
      performanceFactor: '1.25',
      asOf: T.t6,
      refines: null,
      recordedAt: T.t6,
      recordedBy: 'principal:delivery-lead',
      uncertainty: {
        schemaVersion: 1,
        provenance: { kind: 'observed', sourceRef: 'source:desktop-ui', actor: 'principal:field-engineer' },
        freshness: { state: 'fresh', assessedAt: T.t6 },
        confidence: { method: 'measured', value: 0.92, rationale: 'direct field measurement' },
      },
    };
  },
  deliveryClosing() {
    return {
      schema: 'epoch.solution-delivery.delivery-closing',
      schemaVersion: 1,
      closedAt: T.t7,
      closedBy: 'principal:delivery-lead',
      outcome: 'delivered',
      note: 'W048 desktop UI closing',
    };
  },
};

const SOFTWARE: UiScenario = {
  domain: 'software',
  tenantId: 'tenant:lightspeed',
  principalId: 'principal:tech-lead',
  approverId: 'principal:staff-engineer',
  approverRole: 'release-manager',
  solutionId: 'solution:checkout-v2',
  activityId: 'activity:release-train',
  exampleActionProposal: {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: 'desktop-msg-proposal-ui-sw-1',
    createdAt: T.t3,
    proposalId: 'desktop-prop-ui-sw-0001',
    proposedBy: 'agent:desktop-ui',
    actionType: { id: 'software.release.promote', version: '1.0.0' },
    target: { kind: 'world-entity', ref: 'entity:release-checkout-v2-alpha' },
    parameters: { environment: 'production' },
    preconditions: [],
    predictedEffects: [
      { description: 'Release train advances to production.', confidence: { kind: 'quantified', value: 0.85 } },
    ],
    sideEffects: [{ description: 'Customer-facing rollout.', reversible: false }],
    reversibility: { kind: 'irreversible', notes: 'Production rollout.' },
    authorityRequirements: {
      requiredScopes: ['world:write'],
      requiresHumanApproval: true,
      approvalQuorum: { approvals: 1, roles: ['release-manager'] },
    },
    rationale: 'W048 desktop software-domain UI action example (paste your own proposal).',
    evidenceRefs: ['simrun:desktop-ui-sw-1'],
    expiresAt: '2026-04-02T09:00:00.000Z',
  },
  fieldCapture(captureKey) {
    return {
      captureKey,
      tenantId: 'tenant:lightspeed',
      solutionId: 'solution:checkout-v2',
      deliveryId: UI_DELIVERY_ID,
      observedAt: T.t5,
      observedBy: 'principal:tech-lead',
      subjectRef: { kind: 'activity', id: 'activity:release-train' },
      measure: { kind: 'quantity', value: '2', unit: 'pipeline' },
      uncertainty: {
        schemaVersion: 1,
        provenance: { kind: 'observed', sourceRef: 'source:desktop-ui', actor: 'principal:tech-lead' },
        freshness: { state: 'fresh', assessedAt: T.t5 },
        confidence: { method: 'measured', value: 0.9, rationale: 'pipeline run measurement' },
      },
    };
  },
  forecastInput() {
    return {
      recordId: 'forecast:ui-pipeline-r1',
      tenantId: 'tenant:lightspeed',
      subject: { solutionId: 'solution:checkout-v2', subjectKind: 'activity', subjectId: 'activity:release-train' },
      planned: { kind: 'quantity', value: '2', unit: 'pipeline' },
      actualsToDate: { kind: 'quantity', value: '1', unit: 'pipeline' },
      performanceFactor: '1.0',
      asOf: T.t6,
      refines: null,
      recordedAt: T.t6,
      recordedBy: 'principal:tech-lead',
      uncertainty: {
        schemaVersion: 1,
        provenance: { kind: 'observed', sourceRef: 'source:desktop-ui', actor: 'principal:tech-lead' },
        freshness: { state: 'fresh', assessedAt: T.t6 },
        confidence: { method: 'measured', value: 0.9, rationale: 'pipeline run measurement' },
      },
    };
  },
  deliveryClosing() {
    return {
      schema: 'epoch.solution-delivery.delivery-closing',
      schemaVersion: 1,
      closedAt: T.t7,
      closedBy: 'principal:tech-lead',
      outcome: 'delivered',
      note: 'W048 desktop software-domain UI closing',
    };
  },
};

/** The UI scenario registry (construction + software). */
export const UI_SCENARIOS: Readonly<Record<FixtureDomain, UiScenario>> = {
  construction: CONSTRUCTION,
  software: SOFTWARE,
};

/** The empty (valid) verification chain the UI passes to J06. */
export function uiVerificationChain(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    requirements: [],
    claims: [],
    methods: [],
    runs: [],
    results: [],
    evidence: [],
    approvals: [],
  };
}

/**
 * The J05 solution content: the sealed fixture solution minus its seal
 * envelope (contentDigest) — the runner's solutionContent() pattern
 * (schema + schemaVersion + content stay in the content).
 */
export function solutionContentFromBundle(bundle: FixtureBundle): Record<string, unknown> {
  const solutionFixture = bundle.files['solution.json'] as Record<string, unknown>;
  const { contentDigest, ...content } = solutionFixture;
  void contentDigest;
  return content as Record<string, unknown>;
}

/**
 * The J06 delivery-record content: the runner's deliveryContentFor()
 * pattern with the UI delivery id — solutionId / version / digest from
 * the sealed fixture solution.
 */
export function deliveryContentFor(bundle: FixtureBundle, scenario: UiScenario): Record<string, unknown> {
  const solutionFixture = bundle.files['solution.json'] as Record<string, unknown>;
  return {
    schema: 'epoch.solution-delivery.delivery-record',
    schemaVersion: 1,
    deliveryId: UI_DELIVERY_ID,
    tenantId: scenario.tenantId,
    solutionId: solutionFixture['solutionId'] ?? scenario.solutionId,
    solutionVersion: solutionFixture['version'] ?? '1.0.0',
    solutionVersionDigest: solutionFixture['contentDigest'] ?? '0'.repeat(64),
    openedAt: T.t3,
    openedBy: scenario.principalId,
    status: 'open',
    observations: [],
    acceptedObservationIds: [],
    rejectedObservationIds: [],
    actuals: [],
  };
}
