/**
 * @epoch/capability-discovery — runtime zod validators for the published
 * contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics (model names, vendor fields, authority
 * grants) cannot enter kernel types through the discovery door (same
 * policy as the W002/W003/W006/W007 validators). Every exported schema is
 * part of the published surface emitted under
 * `contracts/capability-discovery/schemas/`.
 *
 * Cross-field invariants (refinements) live here — the JSON Schema
 * projection is structural-only by convention (see the manifest).
 */
import { z } from 'zod';
import {
  CANDIDATE_EVALUATION_STATES,
  CANDIDATE_KINDS,
  CAPABILITY_GAP_STATES,
  CLAIM_BASES,
  DISCOVERY_CADENCE_KINDS,
  DISCOVERY_RUN_KINDS,
  DISCOVERY_SOURCE_KINDS,
  DISCOVERY_STAGE_NAMES,
  DISCOVERY_TRIGGERS,
  ECOSYSTEM_PROPOSAL_KINDS,
  ECOSYSTEM_PROPOSAL_STATUSES,
  EVALUATION_CRITERION_KINDS,
  EVALUATION_METRICS,
  REPRESENTATION_KINDS,
  TASK_SIGNAL_KINDS,
  UNIVERSAL_LIFECYCLE_STAGES,
  CAPABILITY_DISCOVERY_CONTRACT_VERSION,
  CAPABILITY_DISCOVERY_RECORD_VERSION,
  CANDIDATE_ID_PATTERN,
  DEMAND_ID_PATTERN,
  DISCOVERY_COMPILER_VERSION,
  DISCOVERY_RUN_ID_PATTERN,
  DISCOVERY_SLUG_PATTERN,
  DISCOVERY_TENANT_ID_PATTERN,
  DISCOVERY_TIMESTAMP_PATTERN,
  ECOSYSTEM_PROPOSAL_ID_PATTERN,
  GAP_ID_PATTERN,
  ORGANIZATION_ID_PATTERN,
  PROMOTION_ID_PATTERN,
  QUALIFIED_OPERATION_PATTERN,
  ROLE_PROPOSAL_ID_PATTERN,
  SHA256_HEX_PATTERN,
} from './version';

// ---------------------------------------------------------------------------
// Primitives.
// ---------------------------------------------------------------------------

const NonEmptyString = z.string().min(1).max(4000);
const SlugString = z.string().regex(DISCOVERY_SLUG_PATTERN);

/** Version discriminator on serialized discovery records (v1). */
export const DiscoveryRecordVersionSchema = z
  .literal(CAPABILITY_DISCOVERY_RECORD_VERSION)
  .meta({
    id: 'CapabilityDiscoveryRecordVersion',
    title: 'CapabilityDiscoveryRecordVersion',
    description: 'Version discriminator carried by every serialized discovery record (currently 1).',
  });

/** Contract version literal. */
export const DiscoveryContractVersionSchema = z
  .literal(CAPABILITY_DISCOVERY_CONTRACT_VERSION)
  .meta({
    id: 'CapabilityDiscoveryContractVersion',
    title: 'CapabilityDiscoveryContractVersion',
    description: 'Version of the published capability-discovery contract surface.',
  });

/** Compiler version literal. */
export const DiscoveryCompilerVersionSchema = z.literal(DISCOVERY_COMPILER_VERSION).meta({
  id: 'DiscoveryCompilerVersion',
  title: 'DiscoveryCompilerVersion',
  description: 'Version of the universal demand compiler + role synthesizer.',
});

/** UTC instant in the canonical wire form. */
export const DiscoveryTimestampSchema = z
  .string()
  .regex(DISCOVERY_TIMESTAMP_PATTERN, 'must be a UTC instant "YYYY-MM-DDTHH:MM:SS.mmmZ"')
  .refine(isRealCalendarInstant, 'must denote a real UTC calendar instant')
  .meta({
    id: 'DiscoveryTimestamp',
    title: 'DiscoveryTimestamp',
    description: 'UTC instant in canonical form YYYY-MM-DDTHH:MM:SS.mmmZ (caller-supplied; never wall-clock).',
  });

function isRealCalendarInstant(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d{3}Z$/.exec(value);
  if (match === null) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]!) return false;
  return hour <= 23 && minute <= 59 && second <= 59;
}

/** Lowercase hex SHA-256 digest. */
export const DiscoverySha256HexSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'DiscoverySha256Hex',
    title: 'DiscoverySha256Hex',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** Tenant id (W009 grammar mirror). */
export const DiscoveryTenantIdSchema = z
  .string()
  .regex(DISCOVERY_TENANT_ID_PATTERN, 'must be "tenant:" followed by a lowercase slug')
  .meta({
    id: 'DiscoveryTenantId',
    title: 'DiscoveryTenantId',
    description: 'Tenant identifier: "tenant:" + lowercase slug (the W009 grammar, mirrored).',
  });

/** Content-addressed discovery run id. */
export const DiscoveryRunIdSchema = z.string().regex(DISCOVERY_RUN_ID_PATTERN).meta({
  id: 'DiscoveryRunId',
  title: 'DiscoveryRunId',
  description: 'Content-addressed discovery run id: "discrun:" + 16 hex characters.',
});

/** Content-addressed capability demand id. */
export const CapabilityDemandIdSchema = z.string().regex(DEMAND_ID_PATTERN).meta({
  id: 'CapabilityDemandId',
  title: 'CapabilityDemandId',
  description: 'Content-addressed capability demand id: "demand:" + 16 hex characters.',
});

/** Content-addressed role proposal id. */
export const RoleProposalIdSchema = z.string().regex(ROLE_PROPOSAL_ID_PATTERN).meta({
  id: 'RoleProposalId',
  title: 'RoleProposalId',
  description: 'Content-addressed role proposal id: "drole:" + 16 hex characters.',
});

/** Candidate id. */
export const CandidateIdSchema = z.string().regex(CANDIDATE_ID_PATTERN).meta({
  id: 'CandidateId',
  title: 'CandidateId',
  description: 'Candidate id: "cand:" + lowercase slug.',
});

/** Content-addressed capability gap id. */
export const CapabilityGapIdSchema = z.string().regex(GAP_ID_PATTERN).meta({
  id: 'CapabilityGapId',
  title: 'CapabilityGapId',
  description: 'Content-addressed capability gap id: "gap:" + 16 hex characters.',
});

/** Content-addressed organization proposal id. */
export const OrganizationIdSchema = z.string().regex(ORGANIZATION_ID_PATTERN).meta({
  id: 'OrganizationId',
  title: 'OrganizationId',
  description: 'Content-addressed organization proposal id: "org:" + 16 hex characters.',
});

/** Content-addressed ecosystem proposal id. */
export const EcosystemProposalIdSchema = z.string().regex(ECOSYSTEM_PROPOSAL_ID_PATTERN).meta({
  id: 'EcosystemProposalId',
  title: 'EcosystemProposalId',
  description: 'Content-addressed ecosystem proposal id: "ecoprop:" + 16 hex characters.',
});

/** Content-addressed promotion record id. */
export const PromotionIdSchema = z.string().regex(PROMOTION_ID_PATTERN).meta({
  id: 'PromotionId',
  title: 'PromotionId',
  description: 'Content-addressed promotion record id: "promo:" + 16 hex characters.',
});

// ---------------------------------------------------------------------------
// Vocabularies.
// ---------------------------------------------------------------------------

export const UniversalLifecycleStageSchema = z.enum(UNIVERSAL_LIFECYCLE_STAGES).meta({
  id: 'UniversalLifecycleStage',
  title: 'UniversalLifecycleStage',
  description: 'The eleven universal lifecycle stages (USL1.0, mirrored closed union).',
});

export const TaskSignalKindSchema = z.enum(TASK_SIGNAL_KINDS).meta({
  id: 'TaskSignalKind',
  title: 'TaskSignalKind',
  description:
    'Universal task/problem signal kind: operation, decision, verification, artifact, quality, unknown, failure, work, budget, environment, authority, dependency, outcome.',
});

export const RepresentationKindSchema = z.enum(REPRESENTATION_KINDS).meta({
  id: 'RepresentationKind',
  title: 'RepresentationKind',
  description:
    'Neutral representation/modality kind: text, numeric, tabular, geometry, image, signal, document, structured, code.',
});

export const CapabilityGapStateSchema = z.enum(CAPABILITY_GAP_STATES).meta({
  id: 'CapabilityGapState',
  title: 'CapabilityGapState',
  description:
    'Capability-gap lifecycle: UNSATISFIED, CANDIDATE_FOUND, EVALUATED, VERIFIED, DEGRADED, REQUIRES_HUMAN.',
});

export const CandidateKindSchema = z.enum(CANDIDATE_KINDS).meta({
  id: 'CandidateKind',
  title: 'CandidateKind',
  description: 'Candidate nature: agent, human, capability, or external.',
});

export const CandidateEvaluationStateSchema = z.enum(CANDIDATE_EVALUATION_STATES).meta({
  id: 'CandidateEvaluationState',
  title: 'CandidateEvaluationState',
  description:
    'Candidate evaluation lifecycle (CC1.0): discovered, ingested, sandboxed, profiled, evaluated, verified, deprecated, retired.',
});

export const ClaimBasisSchema = z.enum(CLAIM_BASES).meta({
  id: 'ClaimBasis',
  title: 'ClaimBasis',
  description: 'Basis of a capability claim: measured or declared.',
});

export const EvaluationCriterionKindSchema = z.enum(EVALUATION_CRITERION_KINDS).meta({
  id: 'EvaluationCriterionKind',
  title: 'EvaluationCriterionKind',
  description: 'Declared evaluation criterion kind: hard-constraint, objective, or evidence-coverage.',
});

export const EvaluationMetricSchema = z.enum(EVALUATION_METRICS).meta({
  id: 'EvaluationMetric',
  title: 'EvaluationMetric',
  description:
    'Deterministic organization-evaluation metric: demand-coverage, unmet-demand-count, evidence-coverage, redundancy-coverage, estimated-latency, estimated-cost, gap-count, critical-single-point-count.',
});

export const DiscoveryRunKindSchema = z.enum(DISCOVERY_RUN_KINDS).meta({
  id: 'DiscoveryRunKind',
  title: 'DiscoveryRunKind',
  description: 'Discovery run kind: problem-driven (stream A) or ecosystem (stream B).',
});

export const DiscoveryTriggerSchema = z.enum(DISCOVERY_TRIGGERS).meta({
  id: 'DiscoveryTrigger',
  title: 'DiscoveryTrigger',
  description: 'What triggered a discovery run: manual, gap, scheduled, or event.',
});

export const DiscoveryStageNameSchema = z.enum(DISCOVERY_STAGE_NAMES).meta({
  id: 'DiscoveryStageName',
  title: 'DiscoveryStageName',
  description:
    'Lineage stage name: inputs, demands, roles, resolution, organizations, evaluation, selection, candidates, gap-updates, promotions.',
});

export const EcosystemProposalKindSchema = z.enum(ECOSYSTEM_PROPOSAL_KINDS).meta({
  id: 'EcosystemProposalKind',
  title: 'EcosystemProposalKind',
  description: 'Ecosystem proposal kind: adapter, extension, or domain-pack.',
});

export const EcosystemProposalStatusSchema = z.enum(ECOSYSTEM_PROPOSAL_STATUSES).meta({
  id: 'EcosystemProposalStatus',
  title: 'EcosystemProposalStatus',
  description: 'Ecosystem proposal review status: proposed, under-review, accepted, rejected.',
});

export const DiscoverySourceKindSchema = z.enum(DISCOVERY_SOURCE_KINDS).meta({
  id: 'DiscoverySourceKind',
  title: 'DiscoverySourceKind',
  description: 'Provider-neutral discovery source class: public-catalog, private-catalog, internal, fixture.',
});

export const DiscoveryCadenceKindSchema = z.enum(DISCOVERY_CADENCE_KINDS).meta({
  id: 'DiscoveryCadenceKind',
  title: 'DiscoveryCadenceKind',
  description: 'Scheduler cadence kind: weekly, interval, or event.',
});

// ---------------------------------------------------------------------------
// Operation references + shared value objects.
// ---------------------------------------------------------------------------

const SemverCoreOrAny = z
  .string()
  .refine(
    (value) => value === '*' || /^\d+\.\d+\.\d+$/.test(value),
    'must be a semver core "major.minor.patch" or "*"',
  );

export const OperationRefSchema = z
  .strictObject({
    id: z.string().regex(QUALIFIED_OPERATION_PATTERN, 'must be a dot-namespaced qualified operation name'),
    versionConstraint: SemverCoreOrAny,
  })
  .readonly()
  .meta({
    id: 'OperationRef',
    title: 'OperationRef',
    description:
      'Provider-neutral operation reference: dot-namespaced qualified id plus a version constraint (semver core or "*").',
  });

export const QualityTargetSchema = z
  .strictObject({
    metric: SlugString,
    threshold: z.number().finite(),
    unit: z.string().min(1).max(64),
    direction: z.enum(['min', 'max']),
  })
  .readonly()
  .meta({
    id: 'QualityTarget',
    title: 'QualityTarget',
    description: 'Quality/fidelity target: metric, threshold, unit, and direction (min/max).',
  });

export const MoneyAmountSchema = z
  .strictObject({
    currency: z.string().regex(/^[A-Z]{3}$/, 'must be an ISO 4217 currency code'),
    amount: z
      .string()
      .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/, 'must be a non-negative decimal amount string'),
  })
  .readonly()
  .meta({
    id: 'MoneyAmount',
    title: 'MoneyAmount',
    description: 'Cost budget/estimate: ISO 4217 currency code + non-negative decimal amount string.',
  });

// ---------------------------------------------------------------------------
// Discovery input.
// ---------------------------------------------------------------------------

export const WorldRefSchema = z
  .strictObject({
    refId: SlugString,
    contentDigest: DiscoverySha256HexSchema,
    summary: NonEmptyString.optional(),
  })
  .readonly()
  .meta({
    id: 'WorldRef',
    title: 'WorldRef',
    description:
      'Opaque reference to an affected world/solution/delivery identity (id + content digest; never an embedded copy).',
  });

export const EvidenceSignalSchema = z
  .strictObject({
    evidenceDigest: DiscoverySha256HexSchema,
    kind: z.enum(['failure', 'verification-gap', 'unknown', 'measurement', 'observation', 'outcome']),
    summary: NonEmptyString,
    subjectRefs: z.array(SlugString).readonly(),
  })
  .readonly()
  .meta({
    id: 'EvidenceSignal',
    title: 'EvidenceSignal',
    description: 'Evidence signal: a content-addressed observation about the problem (digest + kind + subjects).',
  });

export const ConstraintSignalSchema = z
  .strictObject({
    constraintId: SlugString,
    kind: z.enum(['hard', 'soft', 'authority', 'budget', 'quality', 'interface']),
    summary: NonEmptyString,
    subjectRefs: z.array(SlugString).readonly(),
    parameters: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  })
  .readonly()
  .meta({
    id: 'ConstraintSignal',
    title: 'ConstraintSignal',
    description: 'Constraint signal: a provider-neutral constraint binding on the task (hard/soft/authority/budget/quality/interface).',
  });

export const TaskSignalSchema = z
  .strictObject({
    signalId: SlugString,
    kind: TaskSignalKindSchema,
    summary: NonEmptyString,
    operationRef: OperationRefSchema.optional(),
    subjectRefs: z.array(SlugString).readonly(),
    evidenceRefs: z.array(DiscoverySha256HexSchema).readonly(),
    constraintRefs: z.array(SlugString).readonly(),
    representationHints: z.array(RepresentationKindSchema).readonly().optional(),
    outputHints: z.array(RepresentationKindSchema).readonly().optional(),
    artifactKind: SlugString.optional(),
    qualityTarget: QualityTargetSchema.optional(),
    latencyBudgetMs: z.number().int().min(0).optional(),
    costBudget: MoneyAmountSchema.optional(),
    uncertaintyConfidence: z.number().min(0).max(1).optional(),
    requirementSlugs: z.array(SlugString).readonly().optional(),
    dependsOnOperation: OperationRefSchema.optional(),
    weight: z.number().min(0).max(1).optional(),
  })
  .readonly()
  .refine(
    (signal) =>
      (signal.kind !== 'operation' && signal.kind !== 'failure' && signal.kind !== 'dependency') ||
      signal.operationRef !== undefined,
    'operation/failure/dependency signals must pin an operationRef',
  )
  .refine(
    (signal) => signal.kind !== 'dependency' || signal.dependsOnOperation !== undefined,
    'dependency signals must pin dependsOnOperation',
  )
  .meta({
    id: 'TaskSignal',
    title: 'TaskSignal',
    description:
      'One universal task/problem signal (kind + summary + operation pin + subject/evidence/constraint references + neutral hints and kind-specific payloads).',
  });

export const TaskDescriptionSchema = z
  .strictObject({
    summary: NonEmptyString,
    lifecycleStage: UniversalLifecycleStageSchema,
    domainRefs: z.array(SlugString).readonly(),
    objectives: z.array(NonEmptyString).readonly(),
  })
  .readonly()
  .meta({
    id: 'TaskDescription',
    title: 'TaskDescription',
    description: 'The task heading a discovery input: summary, universal lifecycle stage, domain refs, objectives.',
  });

export const TemplateApplicabilitySchema = z
  .strictObject({
    signalKinds: z.array(TaskSignalKindSchema).readonly().optional(),
    domainRefs: z.array(SlugString).readonly().optional(),
    lifecycleStages: z.array(UniversalLifecycleStageSchema).readonly().optional(),
  })
  .readonly()
  .meta({
    id: 'TemplateApplicability',
    title: 'TemplateApplicability',
    description: 'When a domain-pack template applies (matched against task signal kinds, domain refs, lifecycle stages).',
  });

export const CapabilityDemandTemplateSchema = z
  .strictObject({
    templateId: SlugString,
    summary: NonEmptyString,
    operation: OperationRefSchema,
    inputRepresentations: z.array(RepresentationKindSchema).readonly().optional(),
    outputKinds: z.array(RepresentationKindSchema).readonly().optional(),
    qualityTarget: QualityTargetSchema.optional(),
    evidenceRequirements: z.array(SlugString).readonly().optional(),
    requiresHumanCosign: z.boolean().optional(),
    notes: z.array(NonEmptyString).readonly().optional(),
    applicability: TemplateApplicabilitySchema,
  })
  .readonly()
  .meta({
    id: 'CapabilityDemandTemplate',
    title: 'CapabilityDemandTemplate',
    description:
      'Reusable capability-demand template from a domain pack (a PRIOR: may only add demands or tighten universal facets; never overrides).',
  });

export const RoleTemplateSchema = z
  .strictObject({
    templateId: SlugString,
    summary: NonEmptyString,
    mission: NonEmptyString,
    demandTemplateRefs: z.array(SlugString).readonly(),
    knowledgeRequirements: z.array(SlugString).readonly().optional(),
    applicability: TemplateApplicabilitySchema,
  })
  .readonly()
  .meta({
    id: 'RoleTemplate',
    title: 'RoleTemplate',
    description:
      'Reusable role template from a domain pack: proposes a grouping of demand templates (considered by the universal compiler, never authoritative).',
  });

export const TaskSignalBindingSchema = z
  .strictObject({
    bindingId: SlugString,
    signalKind: TaskSignalKindSchema,
    domainRef: SlugString.optional(),
    impliesDemandTemplate: SlugString,
  })
  .readonly()
  .meta({
    id: 'TaskSignalBinding',
    title: 'TaskSignalBinding',
    description: 'Domain-pack binding: this signal kind (+ optional domain) implies this demand template.',
  });

export const DomainPackContributionSchema = z
  .strictObject({
    packId: SlugString,
    packVersion: SemverCoreOrAny,
    demandTemplates: z.array(CapabilityDemandTemplateSchema).readonly(),
    roleTemplates: z.array(RoleTemplateSchema).readonly(),
    taskSignalBindings: z.array(TaskSignalBindingSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'DomainPackContribution',
    title: 'DomainPackContribution',
    description:
      'A domain pack\'s reusable discovery knowledge (demand templates, role templates, signal bindings) — compiler priors, never a second compiler authority.',
  });

export const DiscoveryInputSchema = z
  .strictObject({
    schemaVersion: DiscoveryRecordVersionSchema,
    tenantId: DiscoveryTenantIdSchema,
    task: TaskDescriptionSchema,
    worldRefs: z.array(WorldRefSchema).readonly(),
    evidenceSignals: z.array(EvidenceSignalSchema).readonly(),
    constraintSignals: z.array(ConstraintSignalSchema).readonly(),
    taskSignals: z.array(TaskSignalSchema).readonly(),
    packContributions: z.array(DomainPackContributionSchema).readonly(),
  })
  .readonly()
  .refine(
    (input) => new Set(input.taskSignals.map((signal) => signal.signalId)).size === input.taskSignals.length,
    'task signal ids must be unique',
  )
  .refine(
    (input) =>
      new Set(input.constraintSignals.map((signal) => signal.constraintId)).size ===
      input.constraintSignals.length,
    'constraint signal ids must be unique',
  )
  .meta({
    id: 'DiscoveryInput',
    title: 'DiscoveryInput',
    description:
      'The complete provider-neutral discovery input (task/world/evidence/constraint signals + pack contributions); every derivation is a deterministic function of this document.',
  });

// ---------------------------------------------------------------------------
// Capability demands.
// ---------------------------------------------------------------------------

export const OutputContractEntrySchema = z
  .strictObject({
    name: SlugString,
    kind: RepresentationKindSchema,
  })
  .readonly()
  .meta({
    id: 'OutputContractEntry',
    title: 'OutputContractEntry',
    description: 'One entry of a demand output contract: name + representation kind.',
  });

export const DemandAuthorityConstraintsSchema = z
  .strictObject({
    executionAuthority: z.literal('none'),
    requiresHumanCosign: z.boolean(),
    notes: z.array(NonEmptyString).readonly(),
  })
  .readonly()
  .meta({
    id: 'DemandAuthorityConstraints',
    title: 'DemandAuthorityConstraints',
    description:
      'Authority constraints on a demand: executionAuthority admits exactly "none" (structurally inexpressible); optional human-cosign requirement.',
  });

export const CapabilityDemandSchema = z
  .strictObject({
    schemaVersion: DiscoveryRecordVersionSchema,
    demandId: CapabilityDemandIdSchema,
    operation: OperationRefSchema,
    summary: NonEmptyString,
    requiredOutcome: NonEmptyString,
    inputRepresentations: z.array(RepresentationKindSchema).readonly(),
    outputContract: z.array(OutputContractEntrySchema).readonly(),
    qualityTarget: QualityTargetSchema.optional(),
    units: z.array(SlugString).readonly().optional(),
    acceptableUncertaintyConfidence: z.number().min(0).max(1).optional(),
    evidenceRequirements: z.array(SlugString).readonly(),
    verificationRequired: z.boolean(),
    toolRequirements: z.array(SlugString).readonly(),
    environmentRequirements: z.array(SlugString).readonly(),
    latencyBudgetMs: z.number().int().min(0).optional(),
    costBudget: MoneyAmountSchema.optional(),
    authorityConstraints: DemandAuthorityConstraintsSchema,
    dependsOnOperations: z.array(OperationRefSchema).readonly(),
    lifecycleStage: UniversalLifecycleStageSchema,
    domainRefs: z.array(SlugString).readonly(),
    affectedRefs: z.array(SlugString).readonly(),
    derivedFromSignals: z.array(SlugString).readonly(),
    derivedFromTemplates: z.array(SlugString).readonly(),
  })
  .readonly()
  .meta({
    id: 'CapabilityDemand',
    title: 'CapabilityDemand',
    description:
      'Provider-neutral capability demand: operation, outcome, I/O representations, quality target, uncertainty, evidence, tools, environment, budgets, authority constraints, dependencies, stage, affected identities, derivation provenance.',
  });

export const CapabilityDemandSetSchema = z
  .strictObject({
    demands: z.array(CapabilityDemandSchema).readonly(),
    setDigest: DiscoverySha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'CapabilityDemandSet',
    title: 'CapabilityDemandSet',
    description: 'The sealed, canonically-ordered demand set of one run (content-addressed set digest).',
  });

// ---------------------------------------------------------------------------
// Role proposals.
// ---------------------------------------------------------------------------

export const RoleInterfaceEntrySchema = z
  .strictObject({
    name: SlugString,
    kind: RepresentationKindSchema,
  })
  .readonly()
  .meta({
    id: 'RoleInterfaceEntry',
    title: 'RoleInterfaceEntry',
    description: 'A role interface entry (derived from member demand contracts): name + representation kind.',
  });

export const RoleAuthorityBoundarySchema = z
  .strictObject({
    executionAuthority: z.literal('none'),
    requiresHumanCosign: z.boolean(),
    proposableOperations: z.array(OperationRefSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'RoleAuthorityBoundary',
    title: 'RoleAuthorityBoundary',
    description:
      'The authority boundary of a synthesized role: executionAuthority admits exactly "none" (the W003 convention — discovery never grants execution authority).',
  });

export const RolePlanningBehaviorSchema = z
  .enum(['single-step', 'multi-step', 'supervised-multi-step'])
  .meta({
    id: 'RolePlanningBehavior',
    title: 'RolePlanningBehavior',
    description: 'Derived planning/delegation behavior of a candidate role.',
  });

export const RoleProvenanceSchema = z
  .strictObject({
    derivedFromDemands: z.array(CapabilityDemandIdSchema).readonly(),
    consultedTemplates: z.array(SlugString).readonly(),
    overriddenTemplates: z.array(SlugString).readonly(),
    compilerVersion: DiscoveryCompilerVersionSchema,
  })
  .readonly()
  .meta({
    id: 'RoleProvenance',
    title: 'RoleProvenance',
    description: 'Provenance of a synthesized role: member demands, consulted/overridden pack templates, compiler version.',
  });

export const RoleProposalSchema = z
  .strictObject({
    schemaVersion: DiscoveryRecordVersionSchema,
    roleProposalId: RoleProposalIdSchema,
    roleSlug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
    mission: NonEmptyString,
    satisfiesDemands: z.array(CapabilityDemandIdSchema).readonly(),
    inputs: z.array(RoleInterfaceEntrySchema).readonly(),
    outputs: z.array(RoleInterfaceEntrySchema).readonly(),
    knowledgeRequirements: z.array(SlugString).readonly(),
    toolRequirements: z.array(SlugString).readonly(),
    planningBehavior: RolePlanningBehaviorSchema,
    authorityBoundary: RoleAuthorityBoundarySchema,
    evidenceRequirements: z.array(SlugString).readonly(),
    environmentRequirements: z.array(SlugString).readonly(),
    evaluationSuiteRef: SlugString.optional(),
    confidence: z.number().min(0).max(1),
    provenance: RoleProvenanceSchema,
  })
  .readonly()
  .meta({
    id: 'RoleProposal',
    title: 'RoleProposal',
    description:
      'A candidate role synthesized by the universal compiler from demand evidence (no predefined role/model pair; slug derived from member operations, never a model name).',
  });

// ---------------------------------------------------------------------------
// Candidates.
// ---------------------------------------------------------------------------

export const ClaimedCapabilitySchema = z
  .strictObject({
    operation: OperationRefSchema,
    inputKinds: z.array(RepresentationKindSchema).readonly(),
    outputKinds: z.array(RepresentationKindSchema).readonly(),
    quality: QualityTargetSchema.optional(),
    claimBasis: ClaimBasisSchema,
  })
  .readonly()
  .meta({
    id: 'ClaimedCapability',
    title: 'ClaimedCapability',
    description: 'A candidate\'s claim to one operation, with neutral input/output representation kinds and quality claim basis.',
  });

export const LatencyClaimSchema = z
  .strictObject({
    p50Milliseconds: z.number().int().min(0),
    p95Milliseconds: z.number().int().min(0),
  })
  .readonly()
  .refine((claim) => claim.p95Milliseconds >= claim.p50Milliseconds, 'p95 must be >= p50')
  .meta({
    id: 'LatencyClaim',
    title: 'LatencyClaim',
    description: 'Declared latency characteristics in whole milliseconds (p95 >= p50).',
  });

export const CostClaimSchema = z
  .strictObject({
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount: z
      .string()
      .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/, 'must be a non-negative decimal amount string'),
    basis: z.enum(['per-task', 'per-hour', 'per-run', 'none']),
  })
  .readonly()
  .meta({
    id: 'CostClaim',
    title: 'CostClaim',
    description: 'Declared cost characteristics: ISO 4217 currency, decimal amount, neutral basis.',
  });

export const CandidateProvenanceSchema = z
  .strictObject({
    sourceKind: z.enum(['agent-protocol', 'capability-registry', 'human-declaration', 'external-source']),
    sourceRef: SlugString.optional(),
    contentDigest: DiscoverySha256HexSchema,
    external: z
      .strictObject({
        adapterId: SlugString,
        artifactId: SlugString,
      })
      .readonly()
      .optional(),
  })
  .readonly()
  .meta({
    id: 'CandidateProvenance',
    title: 'CandidateProvenance',
    description: 'Where a candidate comes from (source class + content digest; provider identity stays adapter metadata).',
  });

export const CandidateSecuritySchema = z
  .strictObject({
    sandboxRequired: z.boolean(),
    trustDomain: z.enum(['external', 'epoch-verified']),
    notes: z.array(NonEmptyString).readonly(),
  })
  .readonly()
  .meta({
    id: 'CandidateSecurity',
    title: 'CandidateSecurity',
    description: 'Security posture at the ingestion boundary: sandbox requirement, trust domain, notes.',
  });

export const CandidateProfileSchema = z
  .strictObject({
    schemaVersion: DiscoveryRecordVersionSchema,
    candidateId: CandidateIdSchema,
    kind: CandidateKindSchema,
    displayName: NonEmptyString,
    summary: NonEmptyString,
    claimedCapabilities: z.array(ClaimedCapabilitySchema).readonly(),
    runtimeRequirements: z.array(SlugString).readonly(),
    environmentRequirements: z.array(SlugString).readonly(),
    latency: LatencyClaimSchema.optional(),
    cost: CostClaimSchema.optional(),
    provenance: CandidateProvenanceSchema,
    evaluationState: CandidateEvaluationStateSchema,
    security: CandidateSecuritySchema,
  })
  .readonly()
  .refine(
    (profile) =>
      profile.kind !== 'external' ||
      profile.evaluationState === 'verified' ||
      (profile.security.sandboxRequired && profile.security.trustDomain === 'external'),
    'external candidates below the verified state must be sandbox-required and outside the epoch trust domain',
  )
  .refine(
    (profile) =>
      !(profile.provenance.sourceKind === 'external-source') ||
      profile.provenance.external !== undefined,
    'external-source provenance must name its adapter + artifact',
  )
  .meta({
    id: 'CandidateProfile',
    title: 'CandidateProfile',
    description:
      'Provider-neutral candidate profile: claimed capabilities + provenance only (never a name-to-role mapping); external candidates are non-consequential until the promotion gates pass.',
  });

export const HumanDeclarationSchema = z
  .strictObject({
    declarationId: SlugString,
    tenantId: DiscoveryTenantIdSchema,
    displayName: NonEmptyString,
    claimedCapabilities: z.array(ClaimedCapabilitySchema).readonly(),
    availability: z.enum(['available', 'constrained', 'unavailable']),
    environmentRequirements: z.array(SlugString).readonly(),
    latency: LatencyClaimSchema.optional(),
    cost: CostClaimSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'HumanDeclaration',
    title: 'HumanDeclaration',
    description: 'A human specialist\'s authorized capability declaration (a role is a task specialization, not a qualification).',
  });

export const CandidateMatchSchema = z
  .strictObject({
    demandId: CapabilityDemandIdSchema,
    candidateId: CandidateIdSchema,
    outcome: z.enum(['satisfied', 'claimed', 'incompatible']),
    reasons: z.array(NonEmptyString).readonly(),
  })
  .readonly()
  .meta({
    id: 'CandidateMatch',
    title: 'CandidateMatch',
    description: 'The outcome of matching one demand against one candidate: satisfied, claimed (unverified), or incompatible.',
  });

export const CandidateAssignmentSchema = z
  .strictObject({
    candidateId: CandidateIdSchema,
    matchedDemandIds: z.array(CapabilityDemandIdSchema).readonly(),
    claimedDemandIds: z.array(CapabilityDemandIdSchema).readonly(),
    incompatibleDemandIds: z.array(CapabilityDemandIdSchema).readonly(),
    score: z.number().min(0).max(1),
  })
  .readonly()
  .meta({
    id: 'CandidateAssignment',
    title: 'CandidateAssignment',
    description: 'One candidate bound to one role across matched/claimed/incompatible demands with a deterministic score.',
  });

export const RoleResolutionSchema = z
  .strictObject({
    roleProposalId: RoleProposalIdSchema,
    assignments: z.array(CandidateAssignmentSchema).readonly(),
    unmetDemandIds: z.array(CapabilityDemandIdSchema).readonly(),
    gapIds: z.array(CapabilityGapIdSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'RoleResolution',
    title: 'RoleResolution',
    description: 'The resolution of one role proposal against the candidate pool (assignments + unmet demands + opened gaps).',
  });

// ---------------------------------------------------------------------------
// Capability gaps.
// ---------------------------------------------------------------------------

export const GapTransitionSchema = z
  .strictObject({
    toState: CapabilityGapStateSchema,
    at: DiscoveryTimestampSchema,
    cause: NonEmptyString,
    evidenceDigest: DiscoverySha256HexSchema.optional(),
    actorRef: SlugString.optional(),
    previousTransitionDigest: DiscoverySha256HexSchema.nullable(),
    transitionDigest: DiscoverySha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'GapTransition',
    title: 'GapTransition',
    description: 'One append-only, hash-linked capability-gap state transition (content-addressed).',
  });

export const CapabilityGapSchema = z
  .strictObject({
    schemaVersion: DiscoveryRecordVersionSchema,
    gapId: CapabilityGapIdSchema,
    tenantId: DiscoveryTenantIdSchema,
    operation: OperationRefSchema,
    demandSummary: NonEmptyString,
    lifecycleStage: UniversalLifecycleStageSchema,
    state: CapabilityGapStateSchema,
    originatingRunId: DiscoveryRunIdSchema.optional(),
    triggeringSignalIds: z.array(SlugString).readonly(),
    firstObservedAt: DiscoveryTimestampSchema,
    notes: z.array(NonEmptyString).readonly(),
    transitions: z.array(GapTransitionSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'CapabilityGap',
    title: 'CapabilityGap',
    description:
      'An explicit capability gap with the ARCD1.0 lifecycle and an append-only, tamper-detecting transition chain.',
  });

export const EcosystemDiscoveryRequestSchema = z
  .strictObject({
    requestId: SlugString,
    gapIds: z.array(CapabilityGapIdSchema).readonly(),
    operations: z.array(OperationRefSchema).readonly(),
    reason: NonEmptyString,
  })
  .readonly()
  .meta({
    id: 'EcosystemDiscoveryRequest',
    title: 'EcosystemDiscoveryRequest',
    description: 'A request for ecosystem discovery derived from unsatisfied capability gaps.',
  });

// ---------------------------------------------------------------------------
// Organizations + evaluation.
// ---------------------------------------------------------------------------

export const OrganizationRoleBindingSchema = z
  .strictObject({
    roleProposalId: RoleProposalIdSchema,
    primaryCandidateId: CandidateIdSchema,
    backupCandidateIds: z.array(CandidateIdSchema).readonly(),
    carriedGapIds: z.array(CapabilityGapIdSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'OrganizationRoleBinding',
    title: 'OrganizationRoleBinding',
    description: 'One role binding inside a candidate organization: primary candidate, backups, carried gaps.',
  });

export const HandoffEdgeSchema = z
  .strictObject({
    fromRoleProposalId: RoleProposalIdSchema,
    toRoleProposalId: RoleProposalIdSchema,
    outputName: SlugString,
    inputName: SlugString,
    kind: RepresentationKindSchema,
  })
  .readonly()
  .meta({
    id: 'HandoffEdge',
    title: 'HandoffEdge',
    description: 'A handoff edge between two roles (one output feeding one input of a shared representation kind).',
  });

export const SupervisionEdgeSchema = z
  .strictObject({
    supervisedRoleProposalId: RoleProposalIdSchema,
    escalation: z.enum(['human-review', 'peer-review', 'automated-check']),
  })
  .readonly()
  .meta({
    id: 'SupervisionEdge',
    title: 'SupervisionEdge',
    description: 'A supervision/escalation edge attached to a role (human review, peer review, or automated check).',
  });

export const OrganizationEstimatesSchema = z
  .strictObject({
    estimatedLatencyMs: z.number().int().min(0).nullable(),
    estimatedCost: MoneyAmountSchema.nullable(),
  })
  .readonly()
  .meta({
    id: 'OrganizationEstimates',
    title: 'OrganizationEstimates',
    description: 'Rollup estimates for an organization (deterministic sums; null when undeclared).',
  });

export const OrganizationProposalSchema = z
  .strictObject({
    schemaVersion: DiscoveryRecordVersionSchema,
    organizationId: OrganizationIdSchema,
    label: NonEmptyString,
    roleBindings: z.array(OrganizationRoleBindingSchema).readonly(),
    handoffs: z.array(HandoffEdgeSchema).readonly(),
    supervision: z.array(SupervisionEdgeSchema).readonly(),
    estimates: OrganizationEstimatesSchema,
    staged: z.boolean(),
    stagingReasons: z.array(NonEmptyString).readonly(),
  })
  .readonly()
  .meta({
    id: 'OrganizationProposal',
    title: 'OrganizationProposal',
    description:
      'A candidate organization: role bindings, handoff topology, supervision, redundancy, estimates; staged organizations bind unverified candidates and can never be selected.',
  });

export const EvaluationCriterionSchema = z
  .strictObject({
    criterionId: SlugString,
    kind: EvaluationCriterionKindSchema,
    metric: EvaluationMetricSchema,
    direction: z.enum(['minimize', 'maximize']),
    threshold: z.number().finite().optional(),
    weight: z.number().min(0).max(1).optional(),
  })
  .readonly()
  .refine(
    (criterion) =>
      !(criterion.kind === 'hard-constraint' || criterion.kind === 'evidence-coverage') ||
      criterion.threshold !== undefined,
    'hard-constraint and evidence-coverage criteria must declare a threshold',
  )
  .refine(
    (criterion) => criterion.kind !== 'objective' || criterion.weight !== undefined,
    'objective criteria must declare a weight',
  )
  .meta({
    id: 'EvaluationCriterion',
    title: 'EvaluationCriterion',
    description: 'One declared evaluation criterion (objective/constraint/evidence) bound to a neutral metric.',
  });

export const CriterionResultSchema = z
  .strictObject({
    criterionId: SlugString,
    metric: EvaluationMetricSchema,
    value: z.number().finite().nullable(),
    thresholdMet: z.boolean().nullable(),
  })
  .readonly()
  .meta({
    id: 'CriterionResult',
    title: 'CriterionResult',
    description: 'The computed value of one criterion for one organization (null value when undeclared).',
  });

export const OrganizationEvaluationSchema = z
  .strictObject({
    organizationId: OrganizationIdSchema,
    criterionResults: z.array(CriterionResultSchema).readonly(),
    admissible: z.boolean(),
    rejectionReasons: z.array(NonEmptyString).readonly(),
    score: z.number().finite().nullable(),
  })
  .readonly()
  .meta({
    id: 'OrganizationEvaluation',
    title: 'OrganizationEvaluation',
    description: 'The evaluation of one candidate organization under declared criteria (hard constraints, objectives, evidence coverage).',
  });

export const OrganizationSelectionSchema = z
  .strictObject({
    selectedOrganizationId: OrganizationIdSchema.nullable(),
    stagedOrganizationIds: z.array(OrganizationIdSchema).readonly(),
    rejected: z
      .array(
        z
          .strictObject({
            organizationId: OrganizationIdSchema,
            reasons: z.array(NonEmptyString).readonly(),
          })
          .readonly(),
      )
      .readonly(),
    rationale: NonEmptyString,
  })
  .readonly()
  .meta({
    id: 'OrganizationSelection',
    title: 'OrganizationSelection',
    description: 'The selection (or staging) outcome over evaluated organizations.',
  });

// ---------------------------------------------------------------------------
// Runs + lineage.
// ---------------------------------------------------------------------------

export const DiscoveryStageLinkSchema = z
  .strictObject({
    stage: DiscoveryStageNameSchema,
    stageDigest: DiscoverySha256HexSchema,
    previousStageDigest: DiscoverySha256HexSchema.nullable(),
  })
  .readonly()
  .meta({
    id: 'DiscoveryStageLink',
    title: 'DiscoveryStageLink',
    description: 'One link of a run\'s digest chain: stage name, stage digest, previous stage digest.',
  });

export const DiscoveryRunTriggerSchema = z
  .strictObject({
    trigger: DiscoveryTriggerSchema,
    invokedBy: SlugString.optional(),
  })
  .readonly()
  .meta({
    id: 'DiscoveryRunTrigger',
    title: 'DiscoveryRunTrigger',
    description: 'The trigger record on a run (manual, gap, scheduled, or event).',
  });

export const DiscoveryRunSchema = z
  .strictObject({
    schemaVersion: DiscoveryRecordVersionSchema,
    runId: DiscoveryRunIdSchema,
    runKind: DiscoveryRunKindSchema,
    tenantId: DiscoveryTenantIdSchema,
    compilerVersion: DiscoveryCompilerVersionSchema,
    contractVersion: DiscoveryContractVersionSchema,
    trigger: DiscoveryRunTriggerSchema,
    inputDigest: DiscoverySha256HexSchema,
    stages: z.array(DiscoveryStageLinkSchema).readonly(),
    createdAt: DiscoveryTimestampSchema,
    templateOverrideRejections: z.array(NonEmptyString).readonly(),
  })
  .readonly()
  .meta({
    id: 'DiscoveryRun',
    title: 'DiscoveryRun',
    description:
      'One reproducible discovery run with a content-addressed id and digest-chained lineage (verified end-to-end by verifyDiscoveryRun).',
  });

export const DiscoveryRunArtifactSchema = z
  .strictObject({
    run: DiscoveryRunSchema,
    input: DiscoveryInputSchema,
    candidates: z.array(CandidateProfileSchema).readonly(),
    criteria: z.array(EvaluationCriterionSchema).readonly(),
    maxOrganizations: z.number().int().min(1).max(64),
    demandSet: CapabilityDemandSetSchema,
    roleProposals: z.array(RoleProposalSchema).readonly(),
    resolutions: z.array(RoleResolutionSchema).readonly(),
    organizations: z.array(OrganizationProposalSchema).readonly(),
    evaluations: z.array(OrganizationEvaluationSchema).readonly(),
    selection: OrganizationSelectionSchema.nullable(),
    gaps: z.array(CapabilityGapSchema).readonly(),
    ecosystemRequests: z.array(EcosystemDiscoveryRequestSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'DiscoveryRunArtifact',
    title: 'DiscoveryRunArtifact',
    description:
      'The full self-contained artifact of one problem-driven discovery run: run record + input + candidate pool + criteria + demands + roles + resolutions + organizations + evaluations + selection + gaps + ecosystem requests (verifiable end-to-end).',
  });

// ---------------------------------------------------------------------------
// External discovery.
// ---------------------------------------------------------------------------

export const SourceArtifactSchema = z
  .strictObject({
    artifactId: SlugString,
    contentDigest: DiscoverySha256HexSchema,
    summary: NonEmptyString,
    claimedCapabilities: z.array(ClaimedCapabilitySchema).readonly(),
    licenseNote: NonEmptyString.optional(),
    environmentNotes: z.array(SlugString).readonly(),
  })
  .readonly()
  .meta({
    id: 'SourceArtifact',
    title: 'SourceArtifact',
    description: 'One artifact discovered by a source adapter (provider-neutral claims only).',
  });

export const SourceScanQuerySchema = z
  .strictObject({
    operations: z.array(OperationRefSchema).readonly(),
    limit: z.number().int().min(1).max(1000),
  })
  .readonly()
  .meta({
    id: 'SourceScanQuery',
    title: 'SourceScanQuery',
    description: 'A scan query: the gap operations an adapter should try to satisfy, plus a result limit.',
  });

export const SourceScanResultSchema = z
  .strictObject({
    adapterId: SlugString,
    artifacts: z.array(SourceArtifactSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'SourceScanResult',
    title: 'SourceScanResult',
    description: 'A scan result from one source adapter.',
  });

export const SandboxReportSchema = z
  .strictObject({
    passed: z.boolean(),
    isolationLevel: z.enum(['none', 'process', 'vm', 'network-isolated']),
    findings: z.array(NonEmptyString).readonly(),
  })
  .readonly()
  .meta({
    id: 'SandboxReport',
    title: 'SandboxReport',
    description: 'The sandbox report required by the sandboxed promotion step.',
  });

export const CandidateEvaluationEvidenceSchema = z
  .strictObject({
    operation: OperationRefSchema,
    metric: SlugString,
    value: z.number().finite(),
    unit: z.string().min(1).max(64),
    passed: z.boolean(),
    evidenceDigest: DiscoverySha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'CandidateEvaluationEvidence',
    title: 'CandidateEvaluationEvidence',
    description: 'Evaluation evidence required by the evaluated promotion step (content-addressed).',
  });

export const PolicyApprovalSchema = z
  .strictObject({
    approvedBy: SlugString,
    policyRef: SlugString,
    note: NonEmptyString.optional(),
  })
  .readonly()
  .meta({
    id: 'PolicyApproval',
    title: 'PolicyApproval',
    description: 'The human policy approval required by the verified promotion step (security stays OUTSIDE model prompts).',
  });

export const PromotionRecordSchema = z
  .strictObject({
    schemaVersion: DiscoveryRecordVersionSchema,
    promotionId: PromotionIdSchema,
    candidateId: CandidateIdSchema,
    fromState: CandidateEvaluationStateSchema,
    toState: CandidateEvaluationStateSchema,
    evidenceDigest: DiscoverySha256HexSchema,
    sandboxReport: SandboxReportSchema.optional(),
    evaluationEvidence: z.array(CandidateEvaluationEvidenceSchema).readonly().optional(),
    policyApproval: PolicyApprovalSchema.optional(),
    note: NonEmptyString.optional(),
    promotedAt: DiscoveryTimestampSchema,
    previousPromotionDigest: DiscoverySha256HexSchema.nullable(),
    recordDigest: DiscoverySha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'PromotionRecord',
    title: 'PromotionRecord',
    description:
      'One sealed promotion record (hash-chained): the promotion gate admits only CC1.0 successor transitions with the required evidence and policy approval.',
  });

export const EcosystemScanReportSchema = z
  .strictObject({
    adapterIds: z.array(SlugString).readonly(),
    scannedOperations: z.array(OperationRefSchema).readonly(),
    ingestedCandidateIds: z.array(CandidateIdSchema).readonly(),
    duplicateArtifactDigests: z.array(DiscoverySha256HexSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'EcosystemScanReport',
    title: 'EcosystemScanReport',
    description: 'The per-run view of an ecosystem scan (stream B): adapters, operations, ingested candidates, duplicates.',
  });

// ---------------------------------------------------------------------------
// Ecosystem proposals.
// ---------------------------------------------------------------------------

export const EcosystemProposalEvidenceSchema = z
  .strictObject({
    gapIds: z.array(CapabilityGapIdSchema).readonly(),
    taskExamples: z.array(NonEmptyString).readonly(),
    missingSemantics: z.array(NonEmptyString).readonly(),
    recurringGapCount: z.number().int().min(0),
  })
  .readonly()
  .meta({
    id: 'EcosystemProposalEvidence',
    title: 'EcosystemProposalEvidence',
    description: 'Evidence carried by an ecosystem proposal (gap references, task examples, missing semantics).',
  });

export const DomainPackProposalDetailSchema = z
  .strictObject({
    proposedPackId: SlugString,
    requiredVocabulary: z.array(SlugString).readonly(),
    worldModelBindings: z.array(SlugString).readonly(),
    capabilityDependencies: z.array(SlugString).readonly(),
    evaluationRequirements: z.array(SlugString).readonly(),
    uxProjections: z.array(SlugString).readonly(),
  })
  .readonly()
  .meta({
    id: 'DomainPackProposalDetail',
    title: 'DomainPackProposalDetail',
    description: 'Domain-pack detail carried when the proposal kind is "domain-pack" (activation stays Epoch governance).',
  });

export const EcosystemProposalSchema = z
  .strictObject({
    schemaVersion: DiscoveryRecordVersionSchema,
    proposalId: EcosystemProposalIdSchema,
    kind: EcosystemProposalKindSchema,
    summary: NonEmptyString,
    evidence: EcosystemProposalEvidenceSchema,
    domainPackDetail: DomainPackProposalDetailSchema.optional(),
    status: EcosystemProposalStatusSchema,
    proposedAt: DiscoveryTimestampSchema,
    proposedByRunId: DiscoveryRunIdSchema.optional(),
    reviewNote: NonEmptyString.optional(),
  })
  .readonly()
  .refine(
    (proposal) => proposal.kind !== 'domain-pack' || proposal.domainPackDetail !== undefined,
    'domain-pack proposals must carry domainPackDetail',
  )
  .meta({
    id: 'EcosystemProposal',
    title: 'EcosystemProposal',
    description:
      'A proposal for a new adapter, extension or domain pack derived from discovery evidence (a RECORD ONLY — activation is Epoch governance).',
  });

// ---------------------------------------------------------------------------
// Scheduler.
// ---------------------------------------------------------------------------

export const DiscoveryScheduleSchema = z
  .strictObject({
    scheduleId: SlugString,
    tenantId: DiscoveryTenantIdSchema,
    cadence: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('weekly') }).readonly(),
      z
        .strictObject({
          kind: z.literal('interval'),
          intervalDays: z.number().int().min(1).max(365),
        })
        .readonly(),
      z.strictObject({ kind: z.literal('event') }).readonly(),
    ]),
    adapterIds: z.array(SlugString).readonly(),
    enabled: z.boolean(),
    lastRunAt: DiscoveryTimestampSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'DiscoverySchedule',
    title: 'DiscoverySchedule',
    description: 'A registered ecosystem-discovery schedule (tenant-scoped; weekly default cadence).',
  });

export const DueDiscoveryRunSchema = z
  .strictObject({
    scheduleId: SlugString,
    tenantId: DiscoveryTenantIdSchema,
    dueAt: DiscoveryTimestampSchema,
    adapterIds: z.array(SlugString).readonly(),
  })
  .readonly()
  .meta({
    id: 'DueDiscoveryRun',
    title: 'DueDiscoveryRun',
    description: 'A due schedule emitted by a scheduler tick (the deployment-neutral contract payload).',
  });

// ---------------------------------------------------------------------------
// Errors.
// ---------------------------------------------------------------------------

export const DiscoveryIssueSchema = z
  .strictObject({
    path: z.string().min(1),
    message: NonEmptyString,
  })
  .readonly()
  .meta({
    id: 'DiscoveryIssue',
    title: 'DiscoveryIssue',
    description: 'One flattened validation issue (dotted path + message).',
  });

export const DiscoveryErrorSchema = z.discriminatedUnion('code', [
  z
    .strictObject({
      code: z.literal('validation'),
      message: NonEmptyString,
      issues: z.array(DiscoveryIssueSchema).readonly(),
    })
    .readonly(),
  z
    .strictObject({
      code: z.enum([
        'unknown-run',
        'unknown-gap',
        'unknown-candidate',
        'unknown-template',
        'unknown-schedule',
        'duplicate-run',
        'duplicate-candidate',
        'duplicate-schedule',
        'gap-transition-conflict',
        'candidate-state-conflict',
        'promotion-gate-rejected',
        'template-override-rejected',
        'organization-composition-rejected',
        'cross-tenant-denied',
        'authorization-rejected',
      ]),
      message: NonEmptyString,
    })
    .readonly(),
  z
    .strictObject({
      code: z.literal('lineage-mismatch'),
      message: NonEmptyString,
      brokenStages: z.array(DiscoveryStageNameSchema).readonly(),
    })
    .readonly(),
]);

/** Result of a discovery operation: a value or a typed error. */
export function DiscoveryResultSchema<T extends z.ZodType>(value: T) {
  return z
    .union([
      z.strictObject({ ok: z.literal(true), value }).readonly(),
      z
        .strictObject({ ok: z.literal(false), error: DiscoveryErrorSchema })
        .readonly(),
    ])
    .readonly();
}
