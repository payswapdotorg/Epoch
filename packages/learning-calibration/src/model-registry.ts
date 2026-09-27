/**
 * THE MODEL REGISTRY (the W040 pins: "model/version/applicability
 * lineage" + "controlled model/parameter update interfaces"): typed
 * model REVISIONS with MANDATORY lineage, admitted ONLY through typed
 * PROPOSAL records.
 *
 * - A MODEL REVISION carries the applicability scope it applies to
 *   (measure class + optional pack/variant selectors), the exact
 *   non-negative decimal PARAMETER set (adjustment factors, band
 *   thresholds, weights — NO ML runtime, NO training: parameters are
 *   governed values, not learned weights), the revision CHAIN link
 *   (supersedes: the exact prior revision), and the LINEAGE: the
 *   dataset references (exact digests) + the CHANGING OBSERVATIONS (the
 *   specific comparison-fact/outcome-record digests that changed this
 *   revision);
 * - a revision without lineage is a typed
 *   `model-revision-lineage-required` rejection (the acceptance pin:
 *   model revisions RETAIN lineage to the observations that changed
 *   them — no dataset references or no changing-observation references
 *   is inexpressible);
 * - references that do not resolve against the supplied dataset
 *   evidence are typed `stale-reference-rejected` rejections (a dataset
 *   id/digest that does not match the registered evidence, or a
 *   changing observation that does not resolve inside the referenced
 *   datasets' row provenance — tampered or stale digests);
 * - updates flow ONLY through TYPED PROPOSALS (draft revision + W005
 *   machine-referenceable justification + proposed-by principal)
 *   admitted through the validation gate below — there is NO direct
 *   revision admission path (controlled update interfaces);
 * - history is IMMUTABLE: the same revision id re-admitted with
 *   different content is a typed `history-immutable`; the revision
 *   chain is append-only (sequence continuity is enforced — a revision
 *   must continue its model's chain exactly, superseding the exact
 *   prior revision).
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  LearningApplicabilitySchema,
  MetricJustificationSchema,
} from './metrics';
import {
  MODEL_REVISION_PROPOSAL_SCHEMA_NAME,
  MODEL_REVISION_SCHEMA_NAME,
  LEARNING_CALIBRATION_RECORD_VERSION,
} from './version';
import {
  LearningModelIdSchema,
  LearningProposalIdSchema,
  LearningRevisionIdSchema,
  NonNegativeDecimalSchema,
  PrincipalIdSchema,
  QualifiedNameSchema,
  Sha256HexSchema,
} from './primitives';
import { TenantIdSchema } from '@epoch/tenancy';
import { LearningDatasetIdSchema, SolutionIdSchema } from './primitives';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { LearningResult } from './errors';
import type { SealedLearningDataset } from './dataset';

// --------------------------------------------------------------------------------
// The model revision.
// --------------------------------------------------------------------------------

/** One exact-revision dataset reference (the lineage's dataset leg). */
export const DatasetLineageRefSchema = z
  .strictObject({
    datasetId: LearningDatasetIdSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'DatasetLineageRef',
    title: 'DatasetLineageRef',
    description:
      'One exact-revision dataset reference of a model revision lineage: dataset id plus content digest.',
  });

/** One dataset lineage reference. */
export type DatasetLineageRef = z.infer<typeof DatasetLineageRefSchema>;

/** One exact-revision changing-observation reference (the lineage's observation leg). */
export const ChangingObservationRefSchema = z
  .strictObject({
    recordId: z.string().min(1).max(128),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'ChangingObservationRef',
    title: 'ChangingObservationRef',
    description:
      'One exact-revision changing-observation reference of a model revision lineage: the comparison-fact or outcome-record id plus the content digest of the observation that changed the revision.',
  });

/** One changing-observation reference. */
export type ChangingObservationRef = z.infer<typeof ChangingObservationRefSchema>;

/**
 * The immutable content of one MODEL REVISION — the governed
 * (model, version, applicability) triple: the applicability scope, the
 * exact decimal parameter set, the revision-chain link (supersedes the
 * exact prior revision; null only for the first revision), and the
 * MANDATORY lineage (dataset references + the changing observations).
 */
const modelRevisionShape = z.strictObject({
  schema: z.literal(MODEL_REVISION_SCHEMA_NAME),
  schemaVersion: z.literal(LEARNING_CALIBRATION_RECORD_VERSION),
  revisionId: LearningRevisionIdSchema,
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  modelId: LearningModelIdSchema,
  sequence: z.number().int().min(1).max(1024),
  supersedes: z
    .strictObject({
      revisionId: LearningRevisionIdSchema,
      contentDigest: Sha256HexSchema,
    })
    .readonly()
    .nullable(),
  applicability: LearningApplicabilitySchema,
  parameters: z
    .array(
      z
        .strictObject({
          name: QualifiedNameSchema,
          value: NonNegativeDecimalSchema,
        })
        .readonly(),
    )
    .min(1)
    .max(64),
  lineage: z
    .strictObject({
      datasets: z.array(DatasetLineageRefSchema).max(64),
      changingObservations: z.array(ChangingObservationRefSchema).max(512),
    })
    .readonly(),
  revisedAt: TimestampSchema,
  revisedBy: PrincipalIdSchema,
  note: z.string().max(2048).optional(),
});

export const ModelRevisionContentSchema = modelRevisionShape
  .readonly()
  .superRefine((revision, ctx) => {
    // Parameters: sorted by name, duplicate-free.
    for (let i = 1; i < revision.parameters.length; i += 1) {
      if (revision.parameters[i]!.name <= revision.parameters[i - 1]!.name) {
        ctx.addIssue({
          code: 'custom',
          message: 'parameters must be sorted by name ascending, duplicate-free',
          path: ['parameters'],
        });
        break;
      }
    }
    // Lineage legs: sorted + duplicate-free (deterministic serialization).
    for (let i = 1; i < revision.lineage.datasets.length; i += 1) {
      if (revision.lineage.datasets[i]!.datasetId <= revision.lineage.datasets[i - 1]!.datasetId) {
        ctx.addIssue({
          code: 'custom',
          message: 'lineage datasets must be sorted by datasetId ascending, duplicate-free',
          path: ['lineage', 'datasets'],
        });
        break;
      }
    }
    for (let i = 1; i < revision.lineage.changingObservations.length; i += 1) {
      if (
        revision.lineage.changingObservations[i]!.recordId <=
        revision.lineage.changingObservations[i - 1]!.recordId
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            'lineage changingObservations must be sorted by recordId ascending, duplicate-free',
          path: ['lineage', 'changingObservations'],
        });
        break;
      }
    }
    // The chain link: the first revision supersedes nothing; later
    // revisions supersede exactly one prior revision.
    if (revision.sequence === 1 && revision.supersedes !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'the first revision of a model supersedes nothing (supersedes is null)',
        path: ['supersedes'],
      });
    }
    if (revision.sequence > 1 && revision.supersedes === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'a continuing revision supersedes the exact prior revision of its model',
        path: ['supersedes'],
      });
    }
  })
  .meta({
    id: 'ModelRevisionContent',
    title: 'ModelRevisionContent',
    description:
      'The immutable content of one model revision: applicability scope, exact decimal parameters, the revision-chain link, the mandatory dataset + changing-observation lineage, and the revision provenance.',
  });

/** One model-revision content. */
export type ModelRevisionContent = z.infer<typeof ModelRevisionContentSchema>;

/** The SEALED model revision: content plus its SHA-256 content digest. */
export const SealedModelRevisionSchema = z
  .strictObject({
    ...modelRevisionShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedModelRevision',
    title: 'SealedModelRevision',
    description:
      'The sealed model revision: immutable content plus its SHA-256 content digest (exact-revision addressing in the model registry).',
  });

/** One sealed model revision. */
export type SealedModelRevision = z.infer<typeof SealedModelRevisionSchema>;

/** Compute the content digest of a model-revision content (canonical JSON). */
export function computeModelRevisionDigest(content: ModelRevisionContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid model-revision content into its published record. */
export function sealModelRevision(content: unknown): LearningResult<SealedModelRevision> {
  const parsed = ModelRevisionContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed model revision (schema + digest recomputation). */
export function verifySealedModelRevision(
  sealed: unknown,
): LearningResult<SealedModelRevision> {
  const parsed = SealedModelRevisionSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed model revision digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The controlled update interface: the typed proposal.
// --------------------------------------------------------------------------------

/**
 * The immutable content of one MODEL-REVISION PROPOSAL — the ONLY
 * update interface of the registry (controlled model/parameter
 * updates): a DRAFT revision (the full model-revision content, lineage
 * included), the W005 machine-referenceable justification entries, and
 * the proposing principal. Proposals pass the admission gate
 * ({@link admitModelRevision}) — there is no direct revision admission
 * path.
 */
const proposalShape = z.strictObject({
  schema: z.literal(MODEL_REVISION_PROPOSAL_SCHEMA_NAME),
  schemaVersion: z.literal(LEARNING_CALIBRATION_RECORD_VERSION),
  proposalId: LearningProposalIdSchema,
  // The draft rides the READONLY revision shape (the same inference as
  // ModelRevisionContent — pinned by contracts/learning-calibration).
  draft: modelRevisionShape.readonly(),
  justification: z.array(MetricJustificationSchema).min(1).max(8),
  proposedAt: TimestampSchema,
  proposedBy: PrincipalIdSchema,
});

export const ModelRevisionProposalContentSchema = proposalShape
  .readonly()
  .superRefine((proposal, ctx) => {
    // Justification: sorted by (kind, reference), duplicate-free.
    for (let i = 1; i < proposal.justification.length; i += 1) {
      const a = proposal.justification[i - 1]!;
      const b = proposal.justification[i]!;
      if (a.kind > b.kind || (a.kind === b.kind && a.reference >= b.reference)) {
        ctx.addIssue({
          code: 'custom',
          message: 'justification entries must be sorted by (kind, reference), duplicate-free',
          path: ['justification'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'ModelRevisionProposalContent',
    title: 'ModelRevisionProposalContent',
    description:
      'The immutable content of one model-revision proposal: the draft revision (lineage included), the machine-referenceable justification, and the proposing principal — the only update interface of the model registry.',
  });

/** One model-revision-proposal content. */
export type ModelRevisionProposalContent = z.infer<typeof ModelRevisionProposalContentSchema>;

/** The SEALED model-revision proposal: content plus its SHA-256 content digest. */
export const SealedModelRevisionProposalSchema = z
  .strictObject({
    ...proposalShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedModelRevisionProposal',
    title: 'SealedModelRevisionProposal',
    description:
      'The sealed model-revision proposal: immutable content plus its SHA-256 content digest (exact-revision addressing of the controlled update).',
  });

/** One sealed model-revision proposal. */
export type SealedModelRevisionProposal = z.infer<typeof SealedModelRevisionProposalSchema>;

/** Compute the content digest of a proposal content (canonical JSON). */
export function computeModelRevisionProposalDigest(
  content: ModelRevisionProposalContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid proposal content into its published record. */
export function sealModelRevisionProposal(
  content: unknown,
): LearningResult<SealedModelRevisionProposal> {
  const parsed = ModelRevisionProposalContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed model-revision proposal (schema + digest recomputation). */
export function verifySealedModelRevisionProposal(
  sealed: unknown,
): LearningResult<SealedModelRevisionProposal> {
  const parsed = SealedModelRevisionProposalSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed model-revision proposal digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The admission gate (the controlled update interface, enforced).
// --------------------------------------------------------------------------------

/** The outcome of one registry admission. */
export interface ModelRegistryAdmission {
  /** The (possibly extended) registry. */
  readonly registry: readonly SealedModelRevision[];
  /** The admitted revision (the sealed draft). */
  readonly revision: SealedModelRevision;
  /** `admitted` when the registry grew; `duplicate-revision` on exact idempotent replay. */
  readonly admission: 'admitted' | 'duplicate-revision';
}

/** The highest sequence currently admitted for one model (0 when none). */
function currentSequenceOf(
  registry: readonly SealedModelRevision[],
  modelId: string,
): number {
  let max = 0;
  for (const revision of registry) {
    if (revision.modelId === modelId && revision.sequence > max) {
      max = revision.sequence;
    }
  }
  return max;
}

/**
 * ADMIT one model-revision proposal into the registry — the CONTROLLED
 * update gate (total; every failure a typed value):
 *
 * 1. the proposal VERIFIES (schema + digest recomputation);
 * 2. the draft scope matches (tenant R12 + solution);
 * 3. LINEAGE IS MANDATORY: the draft must reference at least one
 *    dataset AND at least one changing observation — otherwise the
 *    typed `model-revision-lineage-required` (a revision without
 *    lineage to the observations that changed it is inexpressible);
 * 4. every dataset reference resolves against the SUPPLIED dataset
 *    evidence by exact digest — otherwise
 *    `stale-reference-rejected` (tampered or stale);
 * 5. every changing observation resolves inside the REFERENCED
 *    datasets' row provenance (comparison fact or outcome record
 *    exact digests) — otherwise `stale-reference-rejected`;
 * 6. the revision id is new: an exact re-admission of the same
 *    revision is idempotent (`duplicate-revision`); the same id with
 *    different content is `history-immutable`;
 * 7. the draft CONTINUES the model's chain: sequence exactly
 *    max+1, superseding the exact prior revision (digest match) —
 *    mismatches are `stale-reference-rejected` (stale prior) or
 *    `validation` (chain break);
 * 8. the draft seals and the registry grows.
 */
export function admitModelRevision(
  registry: readonly SealedModelRevision[],
  scope: { readonly tenantId: string; readonly solutionId: string },
  datasets: readonly SealedLearningDataset[],
  proposal: unknown,
): LearningResult<ModelRegistryAdmission> {
  // 1. Verify the proposal envelope.
  const verified = verifySealedModelRevisionProposal(proposal);
  if (!verified.ok) {
    return verified;
  }
  const draft = verified.value.draft;

  // 2. Scope.
  if (draft.tenantId !== scope.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `proposal "${verified.value.proposalId}" drafts a revision for tenant "${draft.tenantId}" but the registry scope is "${scope.tenantId}" (R12)`,
        expectedTenantId: scope.tenantId,
        encounteredTenantId: draft.tenantId,
        subject: verified.value.proposalId,
      },
    };
  }
  if (draft.solutionId !== scope.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `proposal "${verified.value.proposalId}" drafts a revision for solution "${draft.solutionId}" but the registry scope is "${scope.solutionId}"`,
        issues: [{ path: 'draft.solutionId', message: 'draft/registry solution mismatch' }],
      },
    };
  }

  // 3. Lineage is mandatory (the acceptance pin).
  if (draft.lineage.datasets.length === 0 || draft.lineage.changingObservations.length === 0) {
    return {
      ok: false,
      error: {
        code: 'model-revision-lineage-required',
        message: `proposal "${verified.value.proposalId}" drafts revision "${draft.revisionId}" without lineage — a model revision references at least one dataset AND at least one changing observation (the exact digests of the observations that changed it); lineage-less revisions are inexpressible`,
        subjectId: draft.revisionId,
      },
    };
  }

  // 4. Dataset references resolve against the supplied evidence.
  const evidence = new Map<string, string>();
  for (const dataset of datasets) {
    evidence.set(dataset.datasetId, dataset.contentDigest);
  }
  for (const reference of draft.lineage.datasets) {
    const digest = evidence.get(reference.datasetId);
    if (digest === undefined) {
      return {
        ok: false,
        error: {
          code: 'stale-reference-rejected',
          message: `proposal "${verified.value.proposalId}" references dataset "${reference.datasetId}" which is not registered evidence — a model revision lineage references registered datasets only`,
          referenceKind: 'dataset',
          referenceId: reference.datasetId,
        },
      };
    }
    if (digest !== reference.contentDigest) {
      return {
        ok: false,
        error: {
          code: 'stale-reference-rejected',
          message: `proposal "${verified.value.proposalId}" references dataset "${reference.datasetId}" @ ${reference.contentDigest.slice(0, 8)}… but the registered dataset is @ ${digest.slice(0, 8)}… — stale or tampered digest`,
          referenceKind: 'dataset',
          referenceId: reference.datasetId,
        },
      };
    }
  }

  // 5. Changing observations resolve inside the referenced datasets'
  //    row provenance (comparison facts + outcome records by exact digest).
  const provenance = new Map<string, string>();
  for (const dataset of datasets) {
    if (
      !draft.lineage.datasets.some(
        (reference) =>
          reference.datasetId === dataset.datasetId &&
          reference.contentDigest === dataset.contentDigest,
      )
    ) {
      continue;
    }
    for (const row of dataset.rows) {
      provenance.set(row.provenance.comparisonFact.recordId, row.provenance.comparisonFact.contentDigest);
      provenance.set(row.provenance.outcomeRecord.recordId, row.provenance.outcomeRecord.contentDigest);
    }
  }
  for (const observation of draft.lineage.changingObservations) {
    const digest = provenance.get(observation.recordId);
    if (digest === undefined) {
      return {
        ok: false,
        error: {
          code: 'stale-reference-rejected',
          message: `proposal "${verified.value.proposalId}" cites changing observation "${observation.recordId}" which does not resolve inside the referenced datasets' row provenance — stale or unknown observation`,
          referenceKind: 'changing-observation',
          referenceId: observation.recordId,
        },
      };
    }
    if (digest !== observation.contentDigest) {
      return {
        ok: false,
        error: {
          code: 'stale-reference-rejected',
          message: `proposal "${verified.value.proposalId}" cites changing observation "${observation.recordId}" @ ${observation.contentDigest.slice(0, 8)}… but the referenced datasets carry @ ${digest.slice(0, 8)}… — stale or tampered digest`,
          referenceKind: 'changing-observation',
          referenceId: observation.recordId,
        },
      };
    }
  }

  // 6. Revision identity: idempotent replay or history-immutable.
  const sealed = sealModelRevision(draft);
  if (!sealed.ok) {
    return sealed;
  }
  const existing = registry.find((revision) => revision.revisionId === draft.revisionId);
  if (existing !== undefined) {
    if (existing.contentDigest === sealed.value.contentDigest) {
      return {
        ok: true,
        value: { registry, revision: existing, admission: 'duplicate-revision' },
      };
    }
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `revision "${draft.revisionId}" is already admitted with different content — the model registry is append-only history; changed content ships as a NEW revision id`,
        subject: 'model-revision',
        subjectId: draft.revisionId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: sealed.value.contentDigest,
      },
    };
  }

  // 7. Chain continuity.
  const current = currentSequenceOf(registry, draft.modelId);
  const expected = current + 1;
  if (draft.sequence !== expected) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `proposal "${verified.value.proposalId}" drafts revision "${draft.revisionId}" at sequence ${draft.sequence} but the model's chain continues at sequence ${expected} — revisions append to their model's chain exactly`,
        issues: [{ path: 'draft.sequence', message: 'chain continuity' }],
      },
    };
  }
  if (expected === 1) {
    if (draft.supersedes !== null) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `the first revision of model "${draft.modelId}" supersedes nothing`,
          issues: [{ path: 'draft.supersedes', message: 'first revision supersedes null' }],
        },
      };
    }
  } else {
    const prior = registry.find(
      (revision) => revision.modelId === draft.modelId && revision.sequence === current,
    );
    if (prior === undefined || draft.supersedes === null) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `revision "${draft.revisionId}" must supersede the exact prior revision of model "${draft.modelId}" (sequence ${current})`,
          issues: [{ path: 'draft.supersedes', message: 'the chain link is mandatory' }],
        },
      };
    }
    if (
      draft.supersedes.revisionId !== prior.revisionId ||
      draft.supersedes.contentDigest !== prior.contentDigest
    ) {
      return {
        ok: false,
        error: {
          code: 'stale-reference-rejected',
          message: `revision "${draft.revisionId}" supersedes (${draft.supersedes.revisionId} @ ${draft.supersedes.contentDigest.slice(0, 8)}…) but the model's prior revision is (${prior.revisionId} @ ${prior.contentDigest.slice(0, 8)}…) — stale or tampered chain link`,
          referenceKind: 'model-revision',
          referenceId: draft.supersedes.revisionId,
        },
      };
    }
  }

  // 8. The registry grows.
  return {
    ok: true,
    value: { registry: [...registry, sealed.value], revision: sealed.value, admission: 'admitted' },
  };
}

/** The registry fold: revisions sorted by (modelId, sequence) — deterministic. */
export function foldModelRevisions(
  registry: readonly SealedModelRevision[],
): readonly SealedModelRevision[] {
  return [...registry].sort((a, b) =>
    a.modelId < b.modelId ? -1 : a.modelId > b.modelId ? 1 : a.sequence - b.sequence,
  );
}

/** The registry view of one model: its revisions in chain order. */
export function modelRevisionChain(
  registry: readonly SealedModelRevision[],
  modelId: string,
): readonly SealedModelRevision[] {
  return registry
    .filter((revision) => revision.modelId === modelId)
    .sort((a, b) => a.sequence - b.sequence);
}

/** Resolve one exact revision reference (id + digest) — the metric-fold resolver. */
export function resolveModelRevision(
  registry: readonly SealedModelRevision[],
  reference: { readonly revisionId: string; readonly contentDigest?: string | undefined },
): LearningResult<SealedModelRevision> {
  const revision = registry.find((candidate) => candidate.revisionId === reference.revisionId);
  if (revision === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `model revision "${reference.revisionId}" is not registered with this host`,
        referenceKind: 'model-revision',
        referenceId: reference.revisionId,
      },
    };
  }
  if (reference.contentDigest !== undefined && reference.contentDigest !== revision.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'stale-reference-rejected',
        message: `model revision "${reference.revisionId}" is registered @ ${revision.contentDigest.slice(0, 8)}… but the reference claims @ ${reference.contentDigest.slice(0, 8)}… — stale or tampered digest`,
        referenceKind: 'model-revision',
        referenceId: reference.revisionId,
      },
    };
  }
  return { ok: true, value: revision };
}
