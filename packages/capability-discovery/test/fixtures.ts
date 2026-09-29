/**
 * Deterministic test fixtures for the capability-discovery battery:
 * neutral builders plus the two cross-domain scenarios (construction +
 * software) that run through the SAME universal machinery (W045 pin 6).
 *
 * Everything here is provider-neutral: no vendor, no model name — the
 * neutrality battery scans src/, and the fixtures deliberately exercise
 * the universal path only.
 */
import type { AgentRegistration } from '@epoch/agent-protocol';
import type {
  CandidateProfile,
  ConstraintSignal,
  DiscoveryInput,
  DomainPackContribution,
  EvaluationCriterion,
  EvidenceSignal,
  HumanDeclaration,
  OperationRef,
  SourceArtifact,
  TaskSignal,
  WorldRef,
} from '../src/types';

export const TENANT_A = 'tenant:alpha';
export const TENANT_B = 'tenant:beta';

export const AT_1 = '2026-10-05T09:00:00.000Z';
export const AT_2 = '2026-10-06T09:00:00.000Z';
export const AT_3 = '2026-10-07T09:00:00.000Z';
export const AT_WEEK_LATER = '2026-10-12T09:00:00.000Z';
export const AT_WEEK_AND_A_DAY = '2026-10-13T09:00:00.000Z';

export const DIGEST_A = 'a'.repeat(64);
export const DIGEST_B = 'b'.repeat(64);
export const DIGEST_C = 'c'.repeat(64);
export const DIGEST_D = 'd'.repeat(64);
export const DIGEST_E = 'e'.repeat(64);

import type { DiscoveryError } from '../src/types';

/** Test helper: assert a typed failure and return the narrowed error. */
export function expectFailure<C extends DiscoveryError['code']>(
  result: { readonly ok: true } | { readonly ok: false; readonly error: DiscoveryError },
  code: C,
): Extract<DiscoveryError, { readonly code: C }> {
  if (result.ok) {
    throw new Error(`expected a typed "${code}" failure, got a success`);
  }
  if (result.error.code !== code) {
    throw new Error(
      `expected a typed "${code}" failure, got "${result.error.code}": ${result.error.message}`,
    );
  }
  return result.error as Extract<DiscoveryError, { readonly code: C }>;
}

// ---------------------------------------------------------------------------
// Neutral builders.
// ---------------------------------------------------------------------------

export function op(id: string, versionConstraint = '*'): OperationRef {
  return { id, versionConstraint };
}

export function worldRef(refId: string, digest: string): WorldRef {
  return { refId, contentDigest: digest, summary: `world ref ${refId}` };
}

export function evidence(
  digest: string,
  kind: EvidenceSignal['kind'],
  summary: string,
  subjectRefs: string[] = [],
): EvidenceSignal {
  return { evidenceDigest: digest, kind, summary, subjectRefs };
}

export function signal(
  signalId: string,
  kind: TaskSignal['kind'],
  summary: string,
  extra: Partial<TaskSignal> = {},
): TaskSignal {
  return {
    signalId,
    kind,
    summary,
    subjectRefs: [],
    evidenceRefs: [],
    constraintRefs: [],
    ...extra,
  };
}

export function constraint(
  constraintId: string,
  kind: ConstraintSignal['kind'],
  summary: string,
  subjectRefs: string[] = [],
  parameters?: ConstraintSignal['parameters'],
): ConstraintSignal {
  return { constraintId, kind, summary, subjectRefs, parameters };
}

export function agentRegistration(input: {
  readonly messageId: string;
  readonly agentId: string;
  readonly displayName: string;
  readonly capabilities: readonly {
    readonly capabilityId: string;
    readonly summary: string;
    readonly domain: string;
    readonly inputs: readonly string[];
    readonly outputs: readonly string[];
  }[];
  readonly executorKind?: 'human' | 'program' | 'model' | 'hybrid';
  readonly p50?: number;
  readonly p95?: number;
}): AgentRegistration {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'agent.registration',
    messageId: input.messageId,
    createdAt: '2026-10-01T00:00:00.000Z',
    agentId: input.agentId,
    displayName: input.displayName,
    executor: { kind: input.executorKind ?? 'model', deterministic: false },
    capabilities: input.capabilities.map((capability) => ({
      protocolVersion: '1.0.0',
      capabilityId: capability.capabilityId,
      summary: capability.summary,
      domain: capability.domain,
      inputs: capability.inputs.map((name) => ({
        name,
        kind: 'json' as const,
        required: true,
        description: `${name} input`,
      })),
      outputs: capability.outputs.map((name) => ({
        name,
        kind: 'json' as const,
        required: true,
        description: `${name} output`,
      })),
      assumptions: [],
    })),
    tools: [],
    authority: {
      executionAuthority: 'none',
      proposableActionTypes: [],
      requiresHumanCosign: false,
    },
    costProfile: { basis: 'none' },
    latencyProfile: {
      p50Milliseconds: input.p50 ?? 1000,
      p95Milliseconds: input.p95 ?? 2000,
    },
    evidenceRequirements: {
      requiresRationale: true,
      requiresPredictedEffects: false,
      requiresEvidenceRefs: true,
      requiredArtifactKinds: ['rationale'],
    },
  };
}

export function humanDeclaration(input: {
  readonly declarationId: string;
  readonly displayName: string;
  readonly claims: readonly {
    readonly operation: OperationRef;
    readonly inputKinds: readonly string[];
    readonly outputKinds: readonly string[];
    readonly quality?: { readonly metric: string; readonly threshold: number; readonly unit: string; readonly direction: 'min' | 'max' };
    readonly measured?: boolean;
  }[];
}): HumanDeclaration {
  return {
    declarationId: input.declarationId,
    tenantId: TENANT_A,
    displayName: input.displayName,
    claimedCapabilities: input.claims.map((claim) => ({
      operation: claim.operation,
      inputKinds: claim.inputKinds as CandidateProfile['claimedCapabilities'][number]['inputKinds'],
      outputKinds: claim.outputKinds as CandidateProfile['claimedCapabilities'][number]['outputKinds'],
      quality: claim.quality,
      claimBasis: claim.measured === false ? ('declared' as const) : ('measured' as const),
    })),
    availability: 'available',
    environmentRequirements: [],
  };
}

export function sourceArtifact(input: {
  readonly artifactId: string;
  readonly summary: string;
  readonly claims: readonly {
    readonly operation: OperationRef;
    readonly inputKinds: readonly string[];
    readonly outputKinds: readonly string[];
    readonly quality?: { readonly metric: string; readonly threshold: number; readonly unit: string; readonly direction: 'min' | 'max' };
  }[];
}): SourceArtifact {
  return {
    artifactId: input.artifactId,
    contentDigest: `${input.artifactId}`.padEnd(64, '0').slice(0, 64).replace(/[^0-9a-f]/g, '1'),
    summary: input.summary,
    claimedCapabilities: input.claims.map((claim) => ({
      operation: claim.operation,
      inputKinds: claim.inputKinds as CandidateProfile['claimedCapabilities'][number]['inputKinds'],
      outputKinds: claim.outputKinds as CandidateProfile['claimedCapabilities'][number]['outputKinds'],
      quality: claim.quality,
      claimBasis: 'measured' as const,
    })),
    environmentNotes: [],
  };
}

/** A verified first-party capability-registry record (W007 shape). */
export function capabilityRecord(input: {
  readonly capabilityId: string;
  readonly version: string;
  readonly displayName: string;
}): {
  readonly schemaVersion: 1;
  readonly manifest: {
    readonly schemaVersion: 1;
    readonly capabilityId: string;
    readonly category: 'evaluator';
    readonly version: string;
    readonly descriptor: {
      readonly displayName: string;
      readonly inputs: readonly { readonly name: string; readonly kind: 'json'; readonly required: boolean; readonly description: string }[];
      readonly outputs: readonly { readonly name: string; readonly kind: 'json'; readonly required: boolean; readonly description: string }[];
      readonly assumptions: readonly string[];
    };
    readonly contracts: readonly [];
    readonly trust: { readonly origin: 'first-party' };
  };
  readonly lifecycle: 'registered';
  readonly manifestDigest: string;
} {
  return {
    schemaVersion: 1,
    manifest: {
      schemaVersion: 1,
      capabilityId: input.capabilityId,
      category: 'evaluator',
      version: input.version,
      descriptor: {
        displayName: input.displayName,
        inputs: [{ name: 'subject', kind: 'json' as const, required: true, description: 'subject' }],
        outputs: [{ name: 'report', kind: 'json' as const, required: true, description: 'report' }],
        assumptions: [],
      },
      contracts: [],
      trust: { origin: 'first-party' },
    },
    lifecycle: 'registered',
    manifestDigest: input.capabilityId.padEnd(64, '2').slice(0, 64).replace(/[^0-9a-f]/g, '3'),
  };
}

// ---------------------------------------------------------------------------
// Scenario A: CONSTRUCTION (structural assessment + retrofit).
// ---------------------------------------------------------------------------

export const CONSTRUCTION_SUBJECT_SITE = 'site-tower-a';
export const CONSTRUCTION_SUBJECT_STRUCTURE = 'structure-tower-a';

export function constructionInput(): DiscoveryInput {
  return {
    schemaVersion: 1,
    tenantId: TENANT_A,
    task: {
      summary: 'Assess and retrofit a two-storey structure',
      lifecycleStage: 'understand',
      domainRefs: ['construction'],
      objectives: ['safe retrofit design', 'code-compliant assessment'],
    },
    worldRefs: [
      worldRef('world:site-survey', DIGEST_A),
      worldRef('world:existing-drawings', DIGEST_B),
    ],
    evidenceSignals: [
      evidence(DIGEST_C, 'failure', 'previous structural run failed convergence', [
        CONSTRUCTION_SUBJECT_STRUCTURE,
      ]),
      evidence(DIGEST_D, 'unknown', 'as-built rebar layout is uncertain', [
        CONSTRUCTION_SUBJECT_STRUCTURE,
      ]),
    ],
    constraintSignals: [
      constraint('c-latency', 'budget', 'assessment must complete within a day', [], {
        latencyMs: 86_400_000,
      }),
      constraint('c-authority', 'authority', 'structural sign-off requires a licensed engineer', [
        CONSTRUCTION_SUBJECT_STRUCTURE,
      ]),
      constraint('c-hard', 'hard', 'local building code applies', []),
    ],
    taskSignals: [
      signal(
        's-geometry',
        'operation',
        'Reconstruct geometry from point cloud and drawings',
        {
          operationRef: op('engineering.geometry-processing'),
          subjectRefs: [CONSTRUCTION_SUBJECT_SITE, CONSTRUCTION_SUBJECT_STRUCTURE],
          representationHints: ['geometry'],
          outputHints: ['geometry'],
          weight: 0.9,
        },
      ),
      signal(
        's-stress',
        'operation',
        'Compute structural stress analysis for retrofit loading',
        {
          operationRef: op('engineering.stress-analysis'),
          subjectRefs: [CONSTRUCTION_SUBJECT_STRUCTURE],
          representationHints: ['geometry', 'numeric'],
          outputHints: ['numeric'],
          weight: 1,
        },
      ),
      signal(
        's-stress-quality',
        'quality',
        'Stress results must reach 0.95 minimum accuracy',
        {
          subjectRefs: [CONSTRUCTION_SUBJECT_STRUCTURE],
          qualityTarget: { metric: 'accuracy', threshold: 0.95, unit: 'ratio', direction: 'min' },
        },
      ),
      signal(
        's-verify',
        'verification',
        'Independent verification of the assessment evidence',
        {
          subjectRefs: [CONSTRUCTION_SUBJECT_STRUCTURE],
          outputHints: ['document'],
        },
      ),
      signal(
        's-failure',
        'failure',
        'The previous convergence attempt failed',
        {
          operationRef: op('engineering.stress-analysis'),
          subjectRefs: [CONSTRUCTION_SUBJECT_STRUCTURE],
          evidenceRefs: [DIGEST_C],
        },
      ),
      signal(
        's-unknown',
        'unknown',
        'As-built rebar layout is uncertain',
        {
          operationRef: op('investigation.unknown-resolution'),
          subjectRefs: [CONSTRUCTION_SUBJECT_STRUCTURE],
          uncertaintyConfidence: 0.7,
        },
      ),
      signal(
        's-code',
        'operation',
        'Check the retrofit design against the building code',
        {
          operationRef: op('engineering.code-compliance'),
          subjectRefs: [CONSTRUCTION_SUBJECT_STRUCTURE],
          representationHints: ['geometry'],
          outputHints: ['document'],
        },
      ),
    ],
    packContributions: [constructionPack()],
  };
}

/** The construction domain-pack contribution (DP1.0 discovery profile). */
export function constructionPack(): DomainPackContribution {
  return {
    packId: 'pack:construction',
    packVersion: '1.0.0',
    demandTemplates: [
      {
        templateId: 'tpl-site-reconstruction',
        summary: 'Site/condition reconstruction demand template',
        operation: op('engineering.geometry-processing'),
        inputRepresentations: ['geometry'],
        outputKinds: ['geometry'],
        applicability: { domainRefs: ['construction'], signalKinds: ['operation'] },
      },
      {
        templateId: 'tpl-structural-analysis',
        summary: 'Structural analysis demand template',
        operation: op('engineering.stress-analysis'),
        inputRepresentations: ['geometry'],
        outputKinds: ['numeric'],
        qualityTarget: { metric: 'accuracy', threshold: 0.98, unit: 'ratio', direction: 'min' },
        requiresHumanCosign: true,
        applicability: { domainRefs: ['construction'], signalKinds: ['operation', 'failure'] },
      },
      {
        templateId: 'tpl-quantity-derivation',
        summary: 'Quantity/cost derivation template (not triggered by these signals)',
        operation: op('construction.quantity-derivation'),
        applicability: { domainRefs: ['construction'], signalKinds: ['work'] },
      },
    ],
    roleTemplates: [
      {
        templateId: 'rtpl-engineering-lead',
        summary: 'Groups the reconstruction + analysis templates',
        mission: 'Lead the structural assessment workflow',
        demandTemplateRefs: ['tpl-site-reconstruction', 'tpl-structural-analysis'],
        knowledgeRequirements: ['structural-engineering'],
        applicability: { domainRefs: ['construction'] },
      },
    ],
    taskSignalBindings: [
      {
        bindingId: 'bind-geometry',
        signalKind: 'operation',
        domainRef: 'construction',
        impliesDemandTemplate: 'tpl-site-reconstruction',
      },
      {
        bindingId: 'bind-stress',
        signalKind: 'operation',
        domainRef: 'construction',
        impliesDemandTemplate: 'tpl-structural-analysis',
      },
      {
        bindingId: 'bind-failure',
        signalKind: 'failure',
        domainRef: 'construction',
        impliesDemandTemplate: 'tpl-structural-analysis',
      },
    ],
  };
}

/** The construction candidate pool: agent + human + capability. */
export function constructionCandidates(): {
  readonly geometryAgent: CandidateProfile;
  readonly structuralHuman: CandidateProfile;
  readonly verificationCapability: CandidateProfile;
} {
  return {
    geometryAgent: {
      schemaVersion: 1,
      candidateId: 'cand:agent-geometry',
      kind: 'agent',
      displayName: 'Geometry processing agent',
      summary: 'Processes geometry end to end',
      claimedCapabilities: [
        {
          operation: op('engineering.geometry-processing'),
          inputKinds: ['geometry'],
          outputKinds: ['geometry'],
          claimBasis: 'measured',
        },
      ],
      runtimeRequirements: [],
      environmentRequirements: [],
      latency: { p50Milliseconds: 5_000, p95Milliseconds: 20_000 },
      provenance: {
        sourceKind: 'agent-protocol',
        sourceRef: 'agent:geometry',
        contentDigest: DIGEST_A,
      },
      evaluationState: 'verified',
      security: { sandboxRequired: false, trustDomain: 'epoch-verified', notes: [] },
    },
    structuralHuman: {
      schemaVersion: 1,
      candidateId: 'cand:human-structural',
      kind: 'human',
      displayName: 'Senior structural engineer',
      summary: 'Licensed structural engineer (authorized declaration)',
      claimedCapabilities: [
        {
          operation: op('engineering.stress-analysis'),
          inputKinds: ['geometry', 'numeric'],
          outputKinds: ['numeric'],
          quality: { metric: 'accuracy', threshold: 0.99, unit: 'ratio', direction: 'min' },
          claimBasis: 'measured',
        },
        {
          operation: op('engineering.code-compliance'),
          inputKinds: ['geometry'],
          outputKinds: ['document'],
          claimBasis: 'measured',
        },
      ],
      runtimeRequirements: [],
      environmentRequirements: [],
      provenance: {
        sourceKind: 'human-declaration',
        sourceRef: 'human:structural-1',
        contentDigest: DIGEST_B,
      },
      evaluationState: 'verified',
      security: { sandboxRequired: false, trustDomain: 'epoch-verified', notes: [] },
    },
    verificationCapability: {
      schemaVersion: 1,
      candidateId: 'cand:cap-verification',
      kind: 'capability',
      displayName: 'Evidence verification capability',
      summary: 'Registered first-party verification capability',
      claimedCapabilities: [
        {
          operation: op('verification.evidence-verification'),
          inputKinds: ['structured'],
          outputKinds: ['document'],
          claimBasis: 'measured',
        },
      ],
      runtimeRequirements: [],
      environmentRequirements: [],
      provenance: {
        sourceKind: 'capability-registry',
        sourceRef: 'verification.evidence-verification',
        contentDigest: DIGEST_C,
      },
      evaluationState: 'verified',
      security: { sandboxRequired: false, trustDomain: 'epoch-verified', notes: [] },
    },
  };
}

// ---------------------------------------------------------------------------
// Scenario B: SOFTWARE (service migration).
// ---------------------------------------------------------------------------

export const SOFTWARE_SUBJECT_SERVICE = 'service-checkout';
export const SOFTWARE_SUBJECT_PIPELINE = 'pipeline-ci';

export function softwareInput(): DiscoveryInput {
  return {
    schemaVersion: 1,
    tenantId: TENANT_A,
    task: {
      summary: 'Migrate the checkout service to the new platform',
      lifecycleStage: 'realize',
      domainRefs: ['software'],
      objectives: ['zero-downtime migration', 'regression-free release'],
    },
    worldRefs: [worldRef('world:service-inventory', DIGEST_D)],
    evidenceSignals: [
      evidence(DIGEST_E, 'verification-gap', 'migration lacks a security review', [
        SOFTWARE_SUBJECT_SERVICE,
      ]),
    ],
    constraintSignals: [
      constraint('s-latency', 'budget', 'CI feedback within an hour', [SOFTWARE_SUBJECT_PIPELINE], {
        latencyMs: 3_600_000,
      }),
    ],
    taskSignals: [
      signal('t-review', 'operation', 'Review the migration diff', {
        operationRef: op('software.code-review'),
        subjectRefs: [SOFTWARE_SUBJECT_SERVICE],
        representationHints: ['code'],
        outputHints: ['document'],
      }),
      signal('t-tests', 'operation', 'Generate migration regression tests', {
        operationRef: op('software.test-generation'),
        subjectRefs: [SOFTWARE_SUBJECT_SERVICE, SOFTWARE_SUBJECT_PIPELINE],
        representationHints: ['code'],
        outputHints: ['code'],
      }),
      signal('t-deploy', 'artifact', 'Produce the deployment plan', {
        subjectRefs: [SOFTWARE_SUBJECT_SERVICE],
        artifactKind: 'deployment-plan',
        outputHints: ['document'],
      }),
      signal('t-security', 'operation', 'Security audit of the new surface', {
        operationRef: op('software.security-audit'),
        subjectRefs: [SOFTWARE_SUBJECT_SERVICE],
        representationHints: ['code'],
        outputHints: ['document'],
      }),
      signal('t-deploy-depends', 'dependency', 'The deployment plan depends on the review', {
        operationRef: op('delivery.artifact-production'),
        dependsOnOperation: op('software.code-review'),
        subjectRefs: [SOFTWARE_SUBJECT_SERVICE],
      }),
      signal('t-budget', 'budget', 'Keep the migration cheap', {
        subjectRefs: [SOFTWARE_SUBJECT_SERVICE],
        costBudget: { currency: 'USD', amount: '500' },
      }),
    ],
    packContributions: [softwarePack()],
  };
}

/** The software domain-pack contribution. */
export function softwarePack(): DomainPackContribution {
  return {
    packId: 'pack:software',
    packVersion: '1.0.0',
    demandTemplates: [
      {
        templateId: 'tpl-code-review',
        summary: 'Code review demand template',
        operation: op('software.code-review'),
        inputRepresentations: ['code'],
        outputKinds: ['document'],
        evidenceRequirements: ['review-report'],
        applicability: { domainRefs: ['software'], signalKinds: ['operation'] },
      },
      {
        templateId: 'tpl-test-generation',
        summary: 'Test generation demand template',
        operation: op('software.test-generation'),
        inputRepresentations: ['code'],
        outputKinds: ['code'],
        applicability: { domainRefs: ['software'], signalKinds: ['operation'] },
      },
    ],
    roleTemplates: [
      {
        templateId: 'rtpl-review-tests',
        summary: 'Groups review + test templates',
        mission: 'Own migration quality',
        demandTemplateRefs: ['tpl-code-review', 'tpl-test-generation'],
        applicability: { domainRefs: ['software'] },
      },
    ],
    taskSignalBindings: [
      {
        bindingId: 'bind-review',
        signalKind: 'operation',
        domainRef: 'software',
        impliesDemandTemplate: 'tpl-code-review',
      },
      {
        bindingId: 'bind-tests',
        signalKind: 'operation',
        domainRef: 'software',
        impliesDemandTemplate: 'tpl-test-generation',
      },
    ],
  };
}

/** The software candidate pool: agent + external (unverified) + gap. */
export function softwareCandidates(): {
  readonly reviewAgent: CandidateProfile;
  readonly externalTestCandidate: CandidateProfile;
} {
  return {
    reviewAgent: {
      schemaVersion: 1,
      candidateId: 'cand:agent-review',
      kind: 'agent',
      displayName: 'Code review agent',
      summary: 'Reviews diffs',
      claimedCapabilities: [
        {
          operation: op('software.code-review'),
          inputKinds: ['code'],
          outputKinds: ['document'],
          claimBasis: 'measured',
        },
      ],
      runtimeRequirements: [],
      environmentRequirements: [],
      latency: { p50Milliseconds: 30_000, p95Milliseconds: 120_000 },
      provenance: {
        sourceKind: 'agent-protocol',
        sourceRef: 'agent:reviewer',
        contentDigest: DIGEST_D,
      },
      evaluationState: 'verified',
      security: { sandboxRequired: false, trustDomain: 'epoch-verified', notes: [] },
    },
    externalTestCandidate: {
      schemaVersion: 1,
      candidateId: 'cand:ext-testgen',
      kind: 'external',
      displayName: 'External candidate testgen-artifact',
      summary: 'Discovered external artifact claiming test generation',
      claimedCapabilities: [
        {
          operation: op('software.test-generation'),
          inputKinds: ['code'],
          outputKinds: ['code'],
          quality: { metric: 'pass-rate', threshold: 0.9, unit: 'ratio', direction: 'min' },
          claimBasis: 'declared',
        },
      ],
      runtimeRequirements: [],
      environmentRequirements: [],
      provenance: {
        sourceKind: 'external-source',
        sourceRef: 'testgen-artifact',
        contentDigest: DIGEST_E,
        external: { adapterId: 'fixture-catalog', artifactId: 'testgen-artifact' },
      },
      evaluationState: 'discovered',
      security: {
        sandboxRequired: true,
        trustDomain: 'external',
        notes: ['untrusted external artifact'],
      },
    },
  };
}

/** Declared criteria used across evaluation tests. */
export function declaredCriteria(): readonly EvaluationCriterion[] {
  return [
    {
      criterionId: 'cov',
      kind: 'hard-constraint',
      metric: 'demand-coverage',
      direction: 'maximize',
      threshold: 0.4,
    },
    {
      criterionId: 'cov-obj',
      kind: 'objective',
      metric: 'demand-coverage',
      direction: 'maximize',
      weight: 0.6,
    },
    {
      criterionId: 'ev-obj',
      kind: 'objective',
      metric: 'evidence-coverage',
      direction: 'maximize',
      weight: 0.4,
    },
  ];
}
