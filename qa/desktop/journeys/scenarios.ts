/**
 * qa/desktop — W048 journey scenario inputs (the deterministic journey
 * payloads per domain).
 *
 * These are HARNESS-side reference payloads: records earlier product
 * stages would have produced (the W046 fixture generator's own pattern —
 * "records are built through the REAL kernels"). The desktop PRODUCT
 * code never imports kernels (the named-negative (a) import scan pins
 * it); the harness plays the reference-data role exactly like
 * services/application-gateway/test/helpers.ts does for the action
 * proposal.
 *
 * Determinism: every instant comes from the frozen FIXTURE_INSTANTS
 * series (the W046 fixture clock), every id is a fixed slug.
 */
import { admitAcquisitionRequest } from '@epoch/solution-delivery';
import { admitEscalationPolicy } from '@epoch/alerts';
import { compileConstraint } from '@epoch/policy-contracts';
import {
  admitAcquisitionPackage,
  canonicalDigest,
  emptyPackageStore,
  emptyQuoteStore,
  sealAcquisitionPackage,
} from '@epoch/procurement';
import { DEFAULT_SUPERVISION_THRESHOLDS } from '@epoch/supervision';

export const T = {
  t1: '2026-03-02T09:00:00.000Z',
  t2: '2026-03-02T10:00:00.000Z',
  t3: '2026-03-02T11:00:00.000Z',
  t4: '2026-03-02T12:00:00.000Z',
  t5: '2026-03-02T13:00:00.000Z',
  t6: '2026-03-02T14:00:00.000Z',
  t7: '2026-03-02T15:00:00.000Z',
  t8: '2026-03-02T16:00:00.000Z',
  t9: '2026-03-02T17:00:00.000Z',
  t10: '2026-03-02T18:00:00.000Z',
} as const;

/** The frozen journey clock (one-hour steps over the fixture day). */
export function frozenJourneyClock(): () => string {
  let index = 0;
  const series = Object.values(T);
  return () => series[Math.min(index++, series.length - 1)]!;
}

/** One domain's journey scenario bundle. */
export interface DomainScenario {
  readonly domain: 'construction' | 'software';
  readonly tenantId: string;
  readonly principalId: string;
  readonly approverId: string;
  readonly observerId: string;
  readonly projectId: string;
  readonly solutionId: string;
  readonly workPackageId: string;
  readonly activityId: string;
  /** The J01 project node + the J02 evidence digest (from the fixtures). */
  readonly evidenceArtifactId: string;
  /** The J04 action proposal (a REAL W003-shaped proposal). */
  actionProposal(): Record<string, unknown>;
  /** The J04 compiled policy set gating the action (reference data). */
  actionPolicies(): Record<string, unknown>[];
  /** The J04 constraint pair (compiled through the policy kernel — reference data). */
  constraintPair(): { compiledConstraint: unknown; context: unknown };
  /** The J04 verification chain (empty valid chain — the authority validates). */
  verificationChain(): Record<string, unknown>;
  /** The J05 solution content (reconstructed from the sealed fixture). */
  solutionContent(solutionFixture: Record<string, unknown>): Record<string, unknown>;
  /** The J05 procurement quote assembly (built through the REAL kernels). */
  procurementQuote(): {
    content: unknown;
    packages: unknown;
    store: unknown;
  };
  /** The J06 field-capture shape (valid for intakeFieldObservation). */
  fieldCapture(captureKey: string): Record<string, unknown>;
  /** The J06 forecast input. */
  forecastInput(): Record<string, unknown>;
  /** The J06 delivery close input. */
  deliveryClosing(): Record<string, unknown>;
  /** The J09 supervision input. */
  supervisionInput(program: Record<string, unknown>, delivery: Record<string, unknown>): Record<string, unknown>;
  /** The J09 alert raise pair. */
  alertRaise(): { chain: readonly unknown[]; options: Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// The construction-domain scenario.
// ---------------------------------------------------------------------------

function constructionScenario(): DomainScenario {
  const tenantId = 'tenant:nordstrand';
  const principalId = 'principal:delivery-lead';
  const scenario: DomainScenario = {
    domain: 'construction',
    tenantId,
    principalId,
    approverId: 'principal:chief-engineer',
    observerId: 'principal:field-engineer',
    projectId: 'project:steel-warehouse-b',
    solutionId: 'solution:warehouse-extension-steel',
    workPackageId: 'work-package:warehouse-substructure',
    activityId: 'activity:warehouse-excavation',
    evidenceArtifactId: 'construction-field-capture',
    actionProposal() {
      return {
        protocolVersion: '1.0.0',
        messageKind: 'action.proposal',
        messageId: 'desktop-msg-proposal-1',
        createdAt: T.t1,
        proposalId: 'desktop-prop-0001',
        proposedBy: 'agent:desktop-journey',
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
        rationale: 'W048 desktop journey action fixture.',
        evidenceRefs: ['simrun:desktop-journey-1'],
        expiresAt: '2026-04-02T09:00:00.000Z',
      };
    },
    actionPolicies() {
      return [
        {
          languageVersion: '1.0.0',
          id: 'desktop-journey-tenant-policy',
          version: '1.0.0',
          name: 'Desktop journey tenant policy',
          enabled: true,
          applicability: { tenantId, actionKinds: ['structural.element.reinforce'] },
          bindings: [{ constraintId: 'desktop-journey-budget' }],
          precedence: { tier: 'tenant', rank: 5 },
          composition: 'additive',
        },
      ];
    },
    constraintPair() {
      // A compiled constraint is the REAL W004 compile output: the authored
      // ECL document goes through the policy-contracts compiler exactly like
      // services/action-gateway/test/helpers.ts (the fixture generator's own
      // pattern — the digest-sealed CompiledConstraint the constraint
      // authority evaluates; a hand-rolled shape fails closed).
      const authored = {
        languageVersion: '1.0.0',
        id: 'desktop-journey-budget',
        version: '1.0.0',
        inputs: [{ name: 'spend', type: 'number' }],
        class: 'hard',
        predicate: { node: 'lt', left: { node: 'input', name: 'spend' }, right: { node: 'lit', type: 'number', value: 100 } },
      };
      const compiled = compileConstraint(authored);
      if (!compiled.ok) throw new Error(`constraint compile failed: ${JSON.stringify(compiled.errors)}`);
      return { compiledConstraint: compiled.compiled, context: { inputs: { spend: 42 } } };
    },
    verificationChain() {
      return { schemaVersion: 1, requirements: [], claims: [], methods: [], runs: [], results: [], evidence: [], approvals: [] };
    },
    solutionContent(solutionFixture) {
      // The sealed record embeds every content field; strip ONLY the seal
      // envelope fields (schema + schemaVersion + content stay in the content).
      const { contentDigest, ...content } = solutionFixture;
      void contentDigest;
      return content as Record<string, unknown>;
    },
    procurementQuote() {
      // The REAL kernel chain: acquisition request -> sealed package ->
      // admitted package store -> quote content referencing the package
      // digest (reference data earlier product stages produce; assembled
      // through the kernels exactly like the W046 fixture generator).
      const requestContent = {
        schema: 'epoch.solution-delivery.acquisition-request',
        schemaVersion: 1,
        acquisitionId: 'acquisition:desktop-journey-steel',
        tenantId,
        solutionId: 'solution:warehouse-extension-steel',
        deliveryId: 'delivery:warehouse-b-001',
        detail: {
          variant: 'external-procurement',
          lines: [
            { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne', solutionLineId: 'line:steel-frame' },
          ],
        },
        requestedAt: T.t3,
        requestedBy: principalId,
        neededBy: T.t8,
      };
      const request = admitAcquisitionRequest(requestContent);
      if (!request.ok) throw new Error(`acquisition request failed: ${request.error}`);
      const packageContent = {
        schema: 'epoch.procurement.acquisition-package',
        schemaVersion: 1,
        packageId: 'package:desktop-journey-steel',
        tenantId,
        solutionId: 'solution:warehouse-extension-steel',
        acquisitionId: 'acquisition:desktop-journey-steel',
        acquisitionRequestDigest: canonicalDigest(
          JSON.parse(JSON.stringify(request.value)) as never,
        ),
        variant: 'external-procurement',
        lines: [{ description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne', solutionLineId: 'line:steel-frame' }],
        assembledAt: T.t3,
        assembledBy: principalId,
      };
      const sealedPackage = sealAcquisitionPackage(packageContent);
      if (!sealedPackage.ok) throw new Error(`package seal failed: ${sealedPackage.error}`);
      const packageStore = admitAcquisitionPackage([request.value], emptyPackageStore(), sealedPackage.value);
      if (!packageStore.ok) throw new Error(`package admission failed: ${packageStore.error}`);
      const quoteContent = {
        schema: 'epoch.procurement.quote',
        schemaVersion: 1,
        quoteId: 'quote:desktop-journey-steel',
        tenantId,
        packageId: 'package:desktop-journey-steel',
        packageDigest: sealedPackage.value.contentDigest,
        supplierId: 'supplier:nordsteel',
        state: 'submitted',
        revision: 1,
        previousQuoteRevisionDigest: null,
        lines: [
          {
            description: 'Structural steel HEB 200',
            quantity: '4',
            unit: 'tonne',
            unitCost: { amount: '2400.00', currency: 'EUR' },
          },
        ],
        leadTimes: [
          {
            semantics: 'estimate',
            recordId: 'estimate:desktop-journey-lead-time',
            contentDigest: 'a'.repeat(64),
            uncertainty: {
              schemaVersion: 1,
              provenance: { kind: 'reported', sourceRef: 'source:supplier-system', actor: 'principal:field-engineer' },
              freshness: { state: 'fresh', assessedAt: T.t3 },
              confidence: { method: 'stated', value: 0.9, rationale: 'supplier statement' },
            },
          },
        ],
        validUntil: T.t9,
        submittedAt: T.t3,
        submittedBy: principalId,
      };
      return { content: quoteContent, packages: packageStore.value, store: emptyQuoteStore() };
    },
    fieldCapture(captureKey) {
      return {
        captureKey,
        tenantId,
        solutionId: 'solution:warehouse-extension-steel',
        deliveryId: 'delivery:warehouse-b-001',
        observedAt: T.t5,
        observedBy: 'principal:field-engineer',
        subjectRef: { kind: 'activity', id: 'activity:warehouse-excavation' },
        measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'observed', sourceRef: 'source:desktop-journey', actor: 'principal:field-engineer' },
          freshness: { state: 'fresh', assessedAt: T.t5 },
          confidence: { method: 'measured', value: 0.95, rationale: 'direct field measurement' },
        },
      };
    },
    forecastInput() {
      return {
        recordId: 'forecast:desktop-journey-excavation-r1',
        tenantId,
        subject: { solutionId: 'solution:warehouse-extension-steel', subjectKind: 'activity', subjectId: 'activity:warehouse-excavation' },
        planned: { kind: 'quantity', value: '120', unit: 'm3' },
        actualsToDate: { kind: 'quantity', value: '60', unit: 'm3' },
        performanceFactor: '1.25',
        asOf: T.t6,
        refines: null,
        recordedAt: T.t6,
        recordedBy: principalId,
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'observed', sourceRef: 'source:desktop-journey', actor: 'principal:field-engineer' },
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
        closedBy: principalId,
        outcome: 'delivered',
        note: 'W048 desktop journey closing',
      };
    },
    supervisionInput(program, delivery) {
      return {
        passId: 'pass:desktop-journey-1',
        tenantId,
        evaluatedAt: T.t6,
        evaluatedBy: 'principal:chief-engineer',
        program,
        delivery,
        thresholds: DEFAULT_SUPERVISION_THRESHOLDS,
        executionIssues: [],
        leadTimeInputs: [],
        infoRequests: [],
      };
    },
    alertRaise() {
      const policyContent = {
        schema: 'epoch.alerts.escalation-policy',
        schemaVersion: 1,
        policyId: 'alert-policy:desktop-journey-standard',
        tenantId,
        policyVersion: '1.0.0',
        title: 'Desktop journey escalation policy',
        defaultSeverity: 'warning',
        defaultEscalation: {
          notify: [{ targetKind: 'role', targetRef: 'role:delivery-supervisor' }],
          escalationDelaySeconds: '3600',
          reNotifyCadenceSeconds: '86400',
          escalateTo: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
        },
        rules: [],
        activatedAt: T.t3,
        activatedBy: 'principal:chief-engineer',
      };
      const policy = admitEscalationPolicy(policyContent);
      if (!policy.ok) throw new Error(`escalation policy failed: ${JSON.stringify(policy.error)}`);
      return {
        chain: [],
        options: {
          alertId: 'alert:desktop-journey-1',
          tenantId,
          summary: {
            findingId: 'finding:desktop-journey-1',
            findingDigest: 'd'.repeat(64),
            findingClass: 'planned-vs-actual',
            findingStatus: 'due',
            subjectKind: 'activity',
            subjectId: 'activity:warehouse-excavation',
            title: 'Activity activity:warehouse-excavation is due',
            detectedAt: T.t5,
          },
          policy: policy.value,
          raisedAt: T.t6,
          raisedBy: 'principal:chief-engineer',
        },
      };
    },
  };
  return scenario;
}

// ---------------------------------------------------------------------------
// The software-domain scenario (repo/ticket/release vocabulary).
// ---------------------------------------------------------------------------

function softwareScenario(): DomainScenario {
  // The software fixture's OWN identifiers (qa/fixtures/software): the
  // tenant/project/solution/activity ids align with the registry-verified
  // world the embedded gateway restores (tenant:lightspeed, the checkout-v2
  // program and its release-train activity).
  const tenantId = 'tenant:lightspeed';
  const principalId = 'principal:tech-lead';
  const scenario: DomainScenario = {
    domain: 'software',
    tenantId,
    principalId,
    approverId: 'principal:staff-engineer',
    observerId: 'principal:tech-lead',
    projectId: 'project:checkout-v2',
    solutionId: 'solution:checkout-v2',
    workPackageId: 'work-package:checkout-release',
    activityId: 'activity:release-train',
    evidenceArtifactId: 'software-field-capture',
    actionProposal() {
      return {
        protocolVersion: '1.0.0',
        messageKind: 'action.proposal',
        messageId: 'desktop-msg-proposal-sw-1',
        createdAt: T.t1,
        proposalId: 'desktop-prop-sw-0001',
        proposedBy: 'agent:desktop-journey',
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
        rationale: 'W048 desktop software-domain action fixture.',
        evidenceRefs: ['simrun:desktop-journey-sw-1'],
        expiresAt: '2026-04-02T09:00:00.000Z',
      };
    },
    actionPolicies() {
      return [
        {
          languageVersion: '1.0.0',
          id: 'desktop-journey-sw-tenant-policy',
          version: '1.0.0',
          name: 'Desktop software journey tenant policy',
          enabled: true,
          applicability: { tenantId, actionKinds: ['software.release.promote'] },
          bindings: [{ constraintId: 'desktop-journey-latency' }],
          precedence: { tier: 'tenant', rank: 5 },
          composition: 'additive',
        },
      ];
    },
    constraintPair() {
      const authored = {
        languageVersion: '1.0.0',
        id: 'desktop-journey-latency',
        version: '1.0.0',
        inputs: [{ name: 'p95', type: 'number' }],
        class: 'hard',
        predicate: { node: 'lt', left: { node: 'input', name: 'p95' }, right: { node: 'lit', type: 'number', value: 250 } },
      };
      const compiled = compileConstraint(authored);
      if (!compiled.ok) throw new Error(`constraint compile failed: ${JSON.stringify(compiled.errors)}`);
      return { compiledConstraint: compiled.compiled, context: { inputs: { p95: 180 } } };
    },
    verificationChain() {
      return { schemaVersion: 1, requirements: [], claims: [], methods: [], runs: [], results: [], evidence: [], approvals: [] };
    },
    solutionContent(solutionFixture) {
      // The sealed record embeds every content field; strip ONLY the seal
      // envelope fields (schema + schemaVersion + content stay in the content).
      const { contentDigest, ...content } = solutionFixture;
      void contentDigest;
      return content as Record<string, unknown>;
    },
    procurementQuote() {
      const requestContent = {
        schema: 'epoch.solution-delivery.acquisition-request',
        schemaVersion: 1,
        acquisitionId: 'acquisition:desktop-journey-release',
        tenantId,
        solutionId: 'solution:checkout-v2',
        deliveryId: 'delivery:checkout-v2-001',
        detail: {
          variant: 'external-procurement',
          lines: [
            { description: 'Release engineering support', quantity: '13', unit: 'storypoint', solutionLineId: 'line:release-engineering' },
          ],
        },
        requestedAt: T.t3,
        requestedBy: principalId,
        neededBy: T.t8,
      };
      const request = admitAcquisitionRequest(requestContent);
      if (!request.ok) throw new Error(`acquisition request failed: ${request.error}`);
      const packageContent = {
        schema: 'epoch.procurement.acquisition-package',
        schemaVersion: 1,
        packageId: 'package:desktop-journey-release',
        tenantId,
        solutionId: 'solution:checkout-v2',
        acquisitionId: 'acquisition:desktop-journey-release',
        acquisitionRequestDigest: canonicalDigest(
          JSON.parse(JSON.stringify(request.value)) as never,
        ),
        variant: 'external-procurement',
        lines: [{ description: 'Release engineering support', quantity: '13', unit: 'storypoint', solutionLineId: 'line:release-engineering' }],
        assembledAt: T.t3,
        assembledBy: principalId,
      };
      const sealedPackage = sealAcquisitionPackage(packageContent);
      if (!sealedPackage.ok) throw new Error(`package seal failed: ${sealedPackage.error}`);
      const packageStore = admitAcquisitionPackage([request.value], emptyPackageStore(), sealedPackage.value);
      if (!packageStore.ok) throw new Error(`package admission failed: ${packageStore.error}`);
      const quoteContent = {
        schema: 'epoch.procurement.quote',
        schemaVersion: 1,
        quoteId: 'quote:desktop-journey-release',
        tenantId,
        packageId: 'package:desktop-journey-release',
        packageDigest: sealedPackage.value.contentDigest,
        supplierId: 'supplier:release-consultancy',
        state: 'submitted',
        revision: 1,
        previousQuoteRevisionDigest: null,
        lines: [
          {
            description: 'Release engineering support',
            quantity: '13',
            unit: 'storypoint',
            unitCost: { amount: '0', currency: 'EUR' },
          },
        ],
        leadTimes: [],
        validUntil: T.t9,
        submittedAt: T.t3,
        submittedBy: principalId,
      };
      return { content: quoteContent, packages: packageStore.value, store: emptyQuoteStore() };
    },
    fieldCapture(captureKey) {
      return {
        captureKey,
        tenantId,
        solutionId: 'solution:checkout-v2',
        deliveryId: 'delivery:checkout-v2-001',
        observedAt: T.t5,
        observedBy: 'principal:tech-lead',
        subjectRef: { kind: 'activity', id: 'activity:release-train' },
        measure: { kind: 'quantity', value: '2', unit: 'pipeline' },
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'observed', sourceRef: 'source:desktop-journey', actor: 'principal:tech-lead' },
          freshness: { state: 'fresh', assessedAt: T.t5 },
          confidence: { method: 'measured', value: 0.9, rationale: 'pipeline run measurement' },
        },
      };
    },
    forecastInput() {
      return {
        recordId: 'forecast:desktop-journey-pipeline-r1',
        tenantId,
        subject: { solutionId: 'solution:checkout-v2', subjectKind: 'activity', subjectId: 'activity:release-train' },
        planned: { kind: 'quantity', value: '2', unit: 'pipeline' },
        actualsToDate: { kind: 'quantity', value: '1', unit: 'pipeline' },
        performanceFactor: '1.0',
        asOf: T.t6,
        refines: null,
        recordedAt: T.t6,
        recordedBy: principalId,
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'observed', sourceRef: 'source:desktop-journey', actor: 'principal:tech-lead' },
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
        closedBy: principalId,
        outcome: 'delivered',
        note: 'W048 desktop software-domain journey closing',
      };
    },
    supervisionInput(program, delivery) {
      return {
        passId: 'pass:desktop-journey-sw-1',
        tenantId,
        evaluatedAt: T.t6,
        evaluatedBy: 'principal:staff-engineer',
        program,
        delivery,
        thresholds: DEFAULT_SUPERVISION_THRESHOLDS,
        executionIssues: [],
        leadTimeInputs: [],
        infoRequests: [],
      };
    },
    alertRaise() {
      const policyContent = {
        schema: 'epoch.alerts.escalation-policy',
        schemaVersion: 1,
        policyId: 'alert-policy:desktop-journey-sw-standard',
        tenantId,
        policyVersion: '1.0.0',
        title: 'Desktop software journey escalation policy',
        defaultSeverity: 'warning',
        defaultEscalation: {
          notify: [{ targetKind: 'role', targetRef: 'role:release-supervisor' }],
          escalationDelaySeconds: '3600',
          reNotifyCadenceSeconds: '86400',
          escalateTo: [{ targetKind: 'role', targetRef: 'role:engineering-manager' }],
        },
        rules: [],
        activatedAt: T.t3,
        activatedBy: 'principal:tech-lead',
      };
      const policy = admitEscalationPolicy(policyContent);
      if (!policy.ok) throw new Error(`escalation policy failed: ${JSON.stringify(policy.error)}`);
      return {
        chain: [],
        options: {
          alertId: 'alert:desktop-journey-sw-1',
          tenantId,
          summary: {
            findingId: 'finding:desktop-journey-sw-1',
            findingDigest: 'e'.repeat(64),
            findingClass: 'planned-vs-actual',
            findingStatus: 'due',
            subjectKind: 'activity',
            subjectId: 'activity:release-train',
            title: 'Activity activity:release-train is due',
            detectedAt: T.t5,
          },
          policy: policy.value,
          raisedAt: T.t6,
          raisedBy: 'principal:staff-engineer',
        },
      };
    },
  };
  return scenario;
}

/** The scenario registry. */
export const DOMAIN_SCENARIOS: Readonly<Record<'construction' | 'software', DomainScenario>> = {
  construction: constructionScenario(),
  software: softwareScenario(),
};
