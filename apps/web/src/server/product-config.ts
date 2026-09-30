/**
 * @epoch/web — the server-side product configuration (W047).
 *
 * The deterministic journey payload templates the product hands to its
 * client at bootstrap: fixture-derived records (the committed solution/
 * program/delivery/evidence), the per-domain constraint compiled through
 * the REAL contracts compiler, the discovery input + candidate catalog
 * (capability claims only — never model-name->role mappings), the action
 * proposal + approval vocabulary, the marketplace entitlement ledger of
 * the fixture deployment, the supervision input base, and the kernel-sealed
 * records the frozen gateway vocabulary requires pre-sealed (the outcome
 * record, the escalation policy).
 *
 * This is DEPLOYMENT CONFIGURATION over the committed W046 fixtures, not a
 * second semantic authority: every kernel-validated value (digests, seals)
 * is produced by the owning kernel; the client can only submit these
 * payloads through Gateway envelopes where the authorities re-validate.
 */
import type { JsonValue } from '@epoch/agent-protocol';
import { canonicalDigest } from '@epoch/agent-protocol';
import { compileConstraint } from '@epoch/policy-contracts';
import { admitEscalationPolicy } from '@epoch/alerts';
import { DEFAULT_SUPERVISION_THRESHOLDS } from '@epoch/supervision';
import { sealDistinctionRecord } from '@epoch/solution-delivery';
import {
  sealAcquisitionPackage,
  sealProcurementCommitment,
  sealPurchaseOrder,
  sealQuote,
  sealQuoteSelection,
} from '@epoch/procurement';
import type { FixtureBundle, ProductDomain } from './fixture-bundle';

function asRecord(value: JsonValue): Record<string, JsonValue> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, JsonValue>;
  }
  throw new Error('expected a JSON object');
}

/** The per-domain product vocabulary (deterministic, fixture-derived). */
interface DomainVocabulary {
  readonly displayName: string;
  readonly solutionTitle: string;
  readonly constraintId: string;
  readonly constraintInputName: string;
  readonly constraintLimit: number;
  readonly constraintUnit: string;
  readonly approvalRole: string;
  readonly approverPrincipal: string;
  readonly agentPrincipal: string;
  readonly actionTypeId: string;
  readonly targetRef: string;
  readonly operations: readonly { readonly id: string; readonly note: string }[];
}

const CONSTRUCTION_VOCABULARY: DomainVocabulary = {
  displayName: 'Nordstrand — warehouse extension (construction)',
  solutionTitle: 'Warehouse extension (steel frame)',
  constraintId: 'max-building-height',
  constraintInputName: 'height',
  constraintLimit: 16,
  constraintUnit: 'm',
  approvalRole: 'senior-structural-engineer',
  approverPrincipal: 'principal:chief-engineer',
  agentPrincipal: 'agent:delivery-copilot',
  actionTypeId: 'structural.element.reinforce',
  targetRef: 'entity:beam-b-12',
  operations: [
    { id: 'engineering.earthworks-survey', note: 'survey + earthworks verification' },
    { id: 'engineering.concrete-works', note: 'substructure concrete works' },
    { id: 'engineering.steel-erection', note: 'superstructure steel erection' },
    { id: 'engineering.site-logistics', note: 'site logistics + crane coordination' },
  ],
};

const SOFTWARE_VOCABULARY: DomainVocabulary = {
  displayName: 'Lightspeed — checkout v2 (software)',
  solutionTitle: 'Checkout v2 delivery',
  constraintId: 'p95-latency-budget',
  constraintInputName: 'p95',
  constraintLimit: 250,
  constraintUnit: 'ms',
  approvalRole: 'staff-engineer',
  approverPrincipal: 'principal:staff-engineer',
  agentPrincipal: 'agent:delivery-copilot',
  actionTypeId: 'release.train.roll',
  targetRef: 'service:checkout-v2',
  operations: [
    { id: 'engineering.repository-provisioning', note: 'repository provisioning + baseline' },
    { id: 'engineering.pipeline-assembly', note: 'build + verification pipelines' },
    { id: 'engineering.release-engineering', note: 'release train + rollback drills' },
    { id: 'engineering.observability-wiring', note: 'dashboards, alerts, SLOs' },
  ],
};

/** The seed supplier of the acquisition flow, per domain. */
const SUPPLIER: Readonly<Record<ProductDomain, string>> = {
  construction: 'supplier:nordsteel',
  software: 'supplier:lightspeed-cloud',
};

/** Compile the fixture constraint through the REAL contracts compiler. */
export function compiledConstraintOf(vocabulary: 'construction' | 'software'): JsonValue {
  return compiledConstraint(vocabulary === 'construction' ? CONSTRUCTION_VOCABULARY : SOFTWARE_VOCABULARY);
}

function compiledConstraint(vocabulary: DomainVocabulary): JsonValue {
  const outcome = compileConstraint({
    languageVersion: '1.0.0',
    id: vocabulary.constraintId,
    version: '1.0.0',
    inputs: [{ name: vocabulary.constraintInputName, type: 'number' }],
    class: 'hard',
    predicate: {
      node: 'lt',
      left: { node: 'input', name: vocabulary.constraintInputName },
      right: { node: 'lit', type: 'number', value: vocabulary.constraintLimit },
    },
  });
  if (!outcome.ok) throw new Error(`constraint compile failed: ${JSON.stringify(outcome.errors)}`);
  return outcome.compiled as unknown as JsonValue;
}

/** The candidate catalog: capability CLAIMS, never model->role mappings. */
function candidateCatalog(bundle: FixtureBundle, vocabulary: DomainVocabulary): JsonValue {
  const contentDigest = (seed: string): string => {
    // Deterministic pseudo-digest from the seed (content-addressed provenance).
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < seed.length; i += 1) {
      h1 = (h1 ^ seed.charCodeAt(i)) * 0x01000193;
      h2 = (h2 + seed.charCodeAt(i) * (i + 7)) * 0x85ebca6b;
      h1 >>>= 0;
      h2 >>>= 0;
    }
    const hex = (h1.toString(16) + h2.toString(16) + 'e7b8a9c4d2f1').padEnd(16, '0');
    return (hex + hex + hex + hex).slice(0, 64);
  };
  const claim = (operationId: string, quality: number) => ({
    operation: { id: operationId, versionConstraint: '*' },
    inputKinds: ['text', 'structured'],
    outputKinds: ['structured', 'tabular'],
    quality: { metric: 'first-pass-acceptance', threshold: quality, unit: 'ratio', direction: 'min' },
    claimBasis: 'measured',
  });
  const claims = vocabulary.operations.map((operation, index) =>
    claim(operation.id, 0.86 + index * 0.03),
  );
  const candidates = [
    {
      schemaVersion: 1,
      candidateId: `candidate:${bundle.domain}-delivery-team`,
      kind: 'human',
      displayName: `${bundle.domain} delivery team`,
      summary: 'Human specialists delivering the programme (fixture staffing declaration).',
      claimedCapabilities: claims.slice(0, 2),
      runtimeRequirements: [],
      environmentRequirements: ['site-access'],
      provenance: { sourceKind: 'human-declaration', sourceRef: 'fixture:staffing', contentDigest: contentDigest(`${bundle.domain}-team`) },
      evaluationState: 'verified',
      security: { sandboxRequired: false, trustDomain: 'epoch-verified', notes: [] },
    },
    {
      schemaVersion: 1,
      candidateId: `candidate:${bundle.domain}-delivery-copilot`,
      kind: 'agent',
      displayName: `${bundle.domain} delivery copilot`,
      summary: 'Agent runtime with measured capability claims for the programme operations.',
      claimedCapabilities: claims.slice(1, 3),
      runtimeRequirements: ['epoch-agent-runtime'],
      environmentRequirements: [],
      latency: { p50Milliseconds: 1200, p95Milliseconds: 4000 },
      provenance: { sourceKind: 'agent-protocol', sourceRef: 'runtime:agent', contentDigest: contentDigest(`${bundle.domain}-copilot`) },
      evaluationState: 'verified',
      security: { sandboxRequired: false, trustDomain: 'epoch-verified', notes: [] },
    },
    {
      schemaVersion: 1,
      candidateId: `candidate:${bundle.domain}-external-analysis`,
      kind: 'external',
      displayName: 'External analysis capability (discovered)',
      summary: 'An externally discovered analysis capability, claimed only — pending promotion gates.',
      claimedCapabilities: [claims[claims.length - 1]],
      runtimeRequirements: [],
      environmentRequirements: ['network-egress'],
      provenance: {
        sourceKind: 'external-source',
        sourceRef: 'registry:external-scan',
        contentDigest: contentDigest(`${bundle.domain}-external`),
        external: { adapterId: 'adapter:web-registry', artifactId: `artifact:${bundle.domain}-analysis` },
      },
      evaluationState: 'discovered',
      security: { sandboxRequired: true, trustDomain: 'external', notes: ['unverified external claim'] },
    },
  ];
  return candidates as unknown as JsonValue;
}

/** The problem-driven discovery input (task/world/evidence/constraint signals). */
function discoveryInput(bundle: FixtureBundle, vocabulary: DomainVocabulary, worldDigest: string): JsonValue {
  const evidenceFile = asRecord(bundle.files['evidence.json']!);
  const solution = asRecord(bundle.files['solution.json']!);
  return {
    schemaVersion: 1,
    tenantId: bundle.tenantId,
    task: {
      summary: `Deliver ${vocabulary.solutionTitle} within the constraint set`,
      lifecycleStage: 'realize',
      domainRefs: [bundle.domain],
      objectives: [
        `Deliver the ${vocabulary.solutionTitle} scope to verification`,
        'Keep every domain constraint satisfied',
      ],
    },
    worldRefs: [
      { refId: bundle.projectId, contentDigest: worldDigest, summary: `${bundle.domain} project world` },
    ],
    evidenceSignals: [
      {
        evidenceDigest: String(evidenceFile['evidenceDigest']),
        kind: 'observation',
        summary: 'fixture field observation of the current state',
        subjectRefs: [bundle.projectId],
      },
      {
        evidenceDigest: String(evidenceFile['evidenceDigest']),
        kind: 'verification-gap',
        summary: 'no completed verification chain yet for the solution',
        subjectRefs: [String(solution['solutionId'])],
      },
    ],
    constraintSignals: (solution['constraintReferences'] as readonly JsonValue[]).map((ref) =>
      asRecord(ref),
    ).map((ref) => ({
      constraintId: String(ref['constraintId']),
      kind: 'hard',
      summary: `${vocabulary.constraintId}: ${vocabulary.constraintInputName} < ${vocabulary.constraintLimit} ${vocabulary.constraintUnit}`,
      subjectRefs: [bundle.projectId],
    })),
    taskSignals: [
      ...vocabulary.operations.map((operation, index) => ({
        signalId: `signal:${bundle.domain}-operation-${index + 1}`,
        kind: 'operation',
        summary: operation.note,
        operationRef: { id: operation.id, versionConstraint: '*' },
        subjectRefs: [bundle.projectId],
        evidenceRefs: [],
        constraintRefs: [vocabulary.constraintId],
      })),
      {
        signalId: `signal:${bundle.domain}-unknown-verification`,
        kind: 'unknown',
        summary: 'verification coverage of the delivered scope is unconfirmed',
        subjectRefs: [bundle.projectId],
        evidenceRefs: [],
        constraintRefs: [],
        uncertaintyConfidence: 0.8,
      },
      {
        signalId: `signal:${bundle.domain}-authority-approval`,
        kind: 'authority',
        summary: 'the baseline decision requires human approval through the Action Gateway',
        subjectRefs: [String(solution['solutionId'])],
        evidenceRefs: [],
        constraintRefs: [],
      },
    ],
    packContributions: [],
  } as unknown as JsonValue;
}

/** The W003 action proposal template (the Gateway approval path). */
function actionProposal(bundle: FixtureBundle, vocabulary: DomainVocabulary): JsonValue {
  const solution = asRecord(bundle.files['solution.json']!);
  return {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: `msg-${bundle.domain}-baseline-approval`,
    createdAt: '2026-03-02T12:00:00.000Z',
    proposalId: `proposal-${bundle.domain}-baseline`,
    proposedBy: vocabulary.agentPrincipal,
    actionType: { id: vocabulary.actionTypeId, version: '1.0.0' },
    target: { kind: 'world-entity', ref: vocabulary.targetRef },
    parameters: { 'solution-id': String(solution['solutionId']) },
    preconditions: [],
    predictedEffects: [
      {
        description: `The approved baseline of ${vocabulary.solutionTitle} becomes the delivery reference.`,
        confidence: { kind: 'quantified', value: 0.9 },
      },
    ],
    sideEffects: [
      { description: 'Delivery tracking re-anchors to the approved baseline.', reversible: false },
    ],
    reversibility: { kind: 'partially-reversible', notes: 'Baseline re-approval possible; consumed review effort is unrecoverable.' },
    authorityRequirements: {
      requiredScopes: ['world:write'],
      requiresHumanApproval: true,
      approvalQuorum: { approvals: 1, roles: [vocabulary.approvalRole] },
    },
    rationale: `Approve the sealed ${vocabulary.solutionTitle} solution version as the delivery baseline.`,
    evidenceRefs: [String(asRecord(bundle.files['evidence.json']!)['evidenceDigest'])],
    expiresAt: '2026-04-02T09:00:00.000Z',
  } as unknown as JsonValue;
}

/**
 * The sealed acquisition chain (kernel-sealed at boot through the REAL
 * procurement seals; the runtime `procurement.quote` / `procurement.order`
 * operations re-seal and re-validate the same content deterministically —
 * content-addressed digests are stable across boot and runtime).
 */
function acquisitionChain(bundle: FixtureBundle): JsonValue {
  const solution = asRecord(bundle.files['solution.json']!);
  const solutionId = String(solution['solutionId']);
  const line = asRecord((solution['solutionLines'] as readonly JsonValue[])[0]!);
  const quantity = asRecord(line['quantity']!);
  const unitCost = asRecord(line['unitCost']!);
  const lineDescription = String(line['description']);
  const lineQuantity = String(quantity['value']);
  const lineUnit = String(quantity['unit']);
  const procurementBy = bundle.committedAuthentication.principalId;
  const supplierId = SUPPLIER[bundle.domain];
  const acquisitionId = `acquisition:${bundle.domain}-steel-1`;
  const packageId = `package:${bundle.domain}-steel-1`;
  const quoteId = `quote:${bundle.domain}-nordsteel-1`;
  const selectionId = `selection:${bundle.domain}-steel-1`;
  const commitmentId = `commitment:${bundle.domain}-steel-1`;
  const poId = `po:${bundle.domain}-steel-1`;

  const acquisitionRequest = {
    schema: 'epoch.solution-delivery.acquisition-request',
    schemaVersion: 1,
    acquisitionId,
    tenantId: bundle.tenantId,
    solutionId,
    deliveryId: String(asRecord(bundle.files['delivery.json']!)['deliveryId']),
    detail: {
      variant: 'external-procurement',
      lines: [
        {
          description: lineDescription,
          quantity: lineQuantity,
          unit: lineUnit,
          solutionLineId: String(line['lineId']),
        },
      ],
    },
    requestedAt: '2026-03-02T12:00:00.000Z',
    requestedBy: procurementBy,
    neededBy: '2026-03-02T14:00:00.000Z',
    note: 'Acquisition against the BOQ quantities',
  } as Record<string, unknown>;

  const packageContent = {
    schema: 'epoch.procurement.acquisition-package',
    schemaVersion: 1,
    packageId,
    tenantId: bundle.tenantId,
    solutionId,
    acquisitionId,
    acquisitionRequestDigest: canonicalDigest(acquisitionRequest as never),
    variant: 'external-procurement',
    lines: (acquisitionRequest['detail'] as Record<string, unknown>)['lines'],
    assembledAt: '2026-03-02T12:00:00.000Z',
    assembledBy: procurementBy,
  } as Record<string, unknown>;
  const pkg = requireOk(sealAcquisitionPackage(packageContent), 'acquisition package seal');

  const quoteContent = {
    schema: 'epoch.procurement.quote',
    schemaVersion: 1,
    quoteId,
    tenantId: bundle.tenantId,
    packageId,
    packageDigest: pkg.contentDigest,
    supplierId,
    state: 'submitted',
    revision: 1,
    previousQuoteRevisionDigest: null,
    lines: [
      {
        description: lineDescription,
        quantity: lineQuantity,
        unit: lineUnit,
        unitCost: { amount: String(unitCost['amount']), currency: String(unitCost['currency']) },
        allocation: {
          state: 'reserved',
          quantity: lineQuantity,
          allocatedAt: '2026-03-02T12:00:00.000Z',
          allocationRef: `alloc:${bundle.domain}-1`,
        },
      },
    ],
    leadTimes: [],
    validUntil: '2026-03-02T18:00:00.000Z',
    submittedAt: '2026-03-02T12:00:00.000Z',
    submittedBy: procurementBy,
  } as Record<string, unknown>;
  const quote = requireOk(sealQuote(quoteContent), 'quote seal');

  const selectionContent = {
    schema: 'epoch.procurement.quote-selection',
    schemaVersion: 1,
    selectionId,
    tenantId: bundle.tenantId,
    packageId,
    packageDigest: pkg.contentDigest,
    selectedQuoteId: quoteId,
    selectedQuoteDigest: quote.contentDigest,
    consideredQuotes: [{ quoteId, quoteDigest: quote.contentDigest }],
    rationale: 'Single live quote with a reserved allocation',
    previousSelectionDigest: null,
    decidedAt: '2026-03-02T13:00:00.000Z',
    decidedBy: procurementBy,
  } as Record<string, unknown>;
  const selection = requireOk(sealQuoteSelection(selectionContent), 'selection seal');

  const commitment = requireOk(
    sealProcurementCommitment({
      recordId: commitmentId,
      tenantId: bundle.tenantId,
      subject: { solutionId, subjectKind: 'solution', subjectId: solutionId },
      quote,
      acquisitionId,
      committedBy: procurementBy,
      committedAt: '2026-03-02T13:00:00.000Z',
      recordedAt: '2026-03-02T13:00:00.000Z',
      uncertainty: {
        schemaVersion: 1,
        provenance: { kind: 'observed', sourceRef: `source:${bundle.domain}-purchase-commitment`, actor: procurementBy },
        freshness: { state: 'fresh', assessedAt: '2026-03-02T13:00:00.000Z' },
        confidence: { method: 'stated', value: 0.9, rationale: 'supplier confirmation received' },
      },
    } as never),
    'commitment seal',
  );

  const orderContent = {
    schema: 'epoch.procurement.purchase-order',
    schemaVersion: 1,
    poId,
    tenantId: bundle.tenantId,
    packageId,
    packageDigest: pkg.contentDigest,
    selectionRef: { selectionId, contentDigest: selection.contentDigest },
    commitmentRef: { recordId: commitmentId, contentDigest: commitment.contentDigest },
    supplierId,
    poVersion: 1,
    previousPOVersionDigest: null,
    lines: [
      {
        description: lineDescription,
        quantity: lineQuantity,
        unit: lineUnit,
        unitCost: { amount: String(unitCost['amount']), currency: String(unitCost['currency']) },
      },
    ],
    totalCost: { amount: normalizeDecimal(String(unitCost['amount'])), currency: String(unitCost['currency']) },
    issuedAt: '2026-03-02T14:00:00.000Z',
    issuedBy: procurementBy,
  } as Record<string, unknown>;
  const order = requireOk(sealPurchaseOrder(orderContent), 'purchase order seal');

  return {
    package: pkg as unknown as JsonValue,
    quoteContent: quoteContent as unknown as JsonValue,
    selection: selection as unknown as JsonValue,
    commitment: commitment as unknown as JsonValue,
    orderContent: orderContent as unknown as JsonValue,
    sealedQuote: quote as unknown as JsonValue,
    sealedOrder: order as unknown as JsonValue,
    supplierId,
  } as unknown as JsonValue;
}

/** Normalize a non-negative decimal string (the kernels' canonical form). */
function normalizeDecimal(amount: string): string {
  const trimmed = amount.replace(/0+$/, '');
  return trimmed.endsWith('.') ? trimmed.slice(0, -1) : (trimmed.includes('.') ? trimmed : amount);
}

function requireOk<T>(result: { readonly ok: boolean; readonly error?: unknown; readonly value?: T }, what: string): T {
  if (!result.ok) {
    throw new Error(`${what} failed: ${JSON.stringify(result.error)}`);
  }
  return result.value as T;
}

/** The kernel-sealed outcome record (learn stage input). */
function sealedOutcomeRecord(bundle: FixtureBundle): JsonValue {
  const solution = asRecord(bundle.files['solution.json']!);
  const program = asRecord(bundle.files['program-of-work.json']!);
  const firstWorkPackage = asRecord((program['workPackages'] as readonly JsonValue[])[0]!);
  const firstActivity = asRecord((firstWorkPackage['activities'] as readonly JsonValue[])[0]!);
  const activityId = String(firstActivity['activityId']);
  const sealed = sealDistinctionRecord({
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'outcome',
    recordId: `outcome:${bundle.domain}-delivered-1`,
    tenantId: bundle.tenantId,
    subject: {
      solutionId: String(solution['solutionId']),
      subjectKind: 'activity',
      subjectId: activityId,
    },
    payload: { outcomeKind: 'delivered', verificationRefs: [] },
    recordedAt: '2026-03-02T18:00:00.000Z',
    recordedBy: bundle.committedAuthentication.principalId,
    uncertainty: {
      schemaVersion: 1,
      provenance: { kind: 'observed', sourceRef: `source:${bundle.domain}-final-survey`, actor: bundle.committedAuthentication.principalId },
      freshness: { state: 'fresh', assessedAt: '2026-03-02T18:00:00.000Z' },
      confidence: { method: 'measured', value: 0.92, rationale: 'final field verification of the delivered scope' },
    },
  } as never);
  if (!sealed.ok) throw new Error(`outcome seal failed: ${sealed.error.message}`);
  return sealed.value as unknown as JsonValue;
}

/** The kernel-sealed escalation policy (alerts.raise input). */
function sealedEscalationPolicy(bundle: FixtureBundle): JsonValue {
  const policy = admitEscalationPolicy({
    schema: 'epoch.alerts.escalation-policy',
    schemaVersion: 1,
    policyId: `alert-policy:${bundle.domain}-supervision`,
    tenantId: bundle.tenantId,
    policyVersion: '1.0.0',
    title: `${bundle.domain} delivery supervision escalation policy`,
    defaultSeverity: 'warning',
    defaultEscalation: {
      notify: [{ targetKind: 'role', targetRef: 'role:delivery-supervisor' }],
      escalationDelaySeconds: '1800',
      reNotifyCadenceSeconds: '43200',
      escalateTo: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
    },
    rules: [
      {
        ruleId: `rule:${bundle.domain}-progress-drift`,
        findingClass: 'planned-vs-actual',
        severity: 'warning',
        escalation: {
          notify: [{ targetKind: 'role', targetRef: 'role:delivery-supervisor' }],
          escalationDelaySeconds: '1800',
          reNotifyCadenceSeconds: '43200',
          escalateTo: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
        },
      },
    ],
    activatedAt: '2026-03-02T10:00:00.000Z',
    activatedBy: bundle.committedAuthentication.principalId,
  });
  if (!policy.ok) throw new Error(`escalation policy admission failed: ${policy.error.message}`);
  return policy.value as unknown as JsonValue;
}

/** The fixture deployment's marketplace entitlement ledger (config, kernel decides). */
function entitlementLedger(bundle: FixtureBundle): JsonValue {
  const listingVersionDigest = String(asRecord(bundle.files['solution.json']!)['contentDigest']);
  return {
    listingId: `listing:${bundle.domain}-capability-pack`,
    listingTitle: `${bundle.domain} capability pack`,
    grants: [
      {
        schemaVersion: 1,
        entitlementId: `entitlement:${bundle.domain}-capability-pack-1`,
        tenantId: bundle.tenantId,
        listingId: `listing:${bundle.domain}-capability-pack`,
        listingVersionDigest,
        scope: { kind: 'tenant' },
        grantedAt: '2026-03-02T10:00:00.000Z',
        grantedBy: bundle.committedAuthentication.principalId,
        provenance: { kind: 'direct' },
      },
    ],
    revocations: [],
  } as unknown as JsonValue;
}

/** The full product configuration of one domain (the bootstrap payload). */
export function productConfiguration(
  bundle: FixtureBundle,
  worldDigest: string,
): Record<string, JsonValue> {
  const vocabulary = bundle.domain === 'construction' ? CONSTRUCTION_VOCABULARY : SOFTWARE_VOCABULARY;
  return {
    domain: bundle.domain,
    fixtureId: bundle.fixtureId,
    tenantId: bundle.tenantId,
    workspaceId: bundle.workspaceId,
    projectId: bundle.projectId,
    displayName: vocabulary.displayName,
    solutionTitle: vocabulary.solutionTitle,
    principals: bundle.principals as unknown as JsonValue[],
    committedAuthentication: bundle.committedAuthentication as unknown as JsonValue,
    records: {
      solution: bundle.files['solution.json']!,
      program: bundle.files['program-of-work.json']!,
      delivery: bundle.files['delivery.json']!,
      evidence: bundle.files['evidence.json']!,
      scenarioJ07: bundle.files['scenario-j07.json']!,
      scenarioJ08: bundle.files['scenario-j08.json']!,
      scenarioJ11: bundle.files['scenario-j11.json']!,
    },
    anchors: {
      worldDigest,
    },
    templates: {
      constraint: {
        compiledConstraint: compiledConstraint(vocabulary),
        inputName: vocabulary.constraintInputName,
        limit: vocabulary.constraintLimit,
        unit: vocabulary.constraintUnit,
      },
      discovery: {
        input: discoveryInput(bundle, vocabulary, worldDigest),
        candidates: candidateCatalog(bundle, vocabulary),
      },
      action: {
        proposal: actionProposal(bundle, vocabulary),
        approvalRole: vocabulary.approvalRole,
        approverPrincipal: vocabulary.approverPrincipal,
        policySet: {
          languageVersion: '1.0.0',
          id: `tenant-policy-${bundle.domain}-approval`,
          version: '1.0.0',
          name: `${bundle.domain} approval policy`,
          enabled: true,
          applicability: { tenantId: bundle.tenantId, actionKinds: [vocabulary.actionTypeId] },
          bindings: [{ constraintId: vocabulary.constraintId }],
          precedence: { tier: 'tenant', rank: 5 },
          composition: 'additive',
        },
      },
      procurement: acquisitionChain(bundle),
      outcomeRecord: sealedOutcomeRecord(bundle),
      escalationPolicy: sealedEscalationPolicy(bundle),
      entitlementLedger: entitlementLedger(bundle),
      supervisionThresholds: DEFAULT_SUPERVISION_THRESHOLDS as unknown as JsonValue,
    },
  };
}
