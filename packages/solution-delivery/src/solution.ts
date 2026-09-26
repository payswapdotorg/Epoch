/**
 * Solution packages and their IMMUTABLE, content-addressed, hash-chained
 * version baselines (architecture.md, binding; the W023 marketplace
 * version-chain convention).
 *
 * - A solution version is a SEALED ENVELOPE: canonically ordered content
 *   plus its SHA-256 content digest (the exact-revision address).
 *   Publishing a new version NEVER mutates a published one — re-publishing
 *   an existing version with different content is a typed
 *   `version-conflict` rejection, and the sealed content of every
 *   published version is byte-stable for its lifetime.
 * - The HASH CHAIN: each version's `previousVersionDigest` links to the
 *   prior published version's content digest (null on the first);
 *   `verifySolutionVersionChain` walks the chain and rejects tampered
 *   digests (`digest-mismatch`) and broken links.
 * - A BASELINE is an APPROVED solution version: `approveSolutionBaseline`
 *   emits a separate approval record (approval is a distinct authority act
 *   — the W006 verification precedent); the approved content stays sealed
 *   and immutable. `reviseSolutionBaseline` is the typed rejection surface
 *   for in-place mutation attempts (`baseline-mutation-rejected`):
 *   changes to an approved baseline ship as a NEW version in the chain.
 * - World/constraint references are OPAQUE: entity ids in the W002
 *   world-model grammar, constraint ids in the W004 constraint-language
 *   grammar — referenced, never embedded. Resolution against a
 *   world/constraint-shaped lookup is a SEPARATE total admission
 *   (`resolveWorldReferences` / `resolveConstraintReferences`) and a
 *   DANGLING reference is a typed `dangling-reference-rejected`.
 * - Determinism: `solutionLines`, `worldReferences`, `constraintReferences`
 *   are canonically ordered (sorted, duplicate-free), so semantically equal
 *   versions serialize byte-identically and digest stably.
 */
import { z } from 'zod';
import {
  canonicalDigest,
  TimestampSchema,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import { compareSemver } from './semver';
import {
  TenantIdSchema,
  PrincipalIdSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  SolutionLineIdSchema,
} from './primitives';
import {
  BASELINE_APPROVAL_SCHEMA_NAME,
  SOLUTION_DELIVERY_RECORD_VERSION,
  SOLUTION_VERSION_SCHEMA_NAME,
} from './version';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import type { DeliveryResult } from './errors';

/**
 * A reference to a world-graph entity (the W002 world-model grammar:
 * opaque caller-assigned entity id, 1-256 chars). Referenced opaquely —
 * never embedded; the world model is the semantic world authority.
 */
export const WorldEntityReferenceSchema = z
  .strictObject({
    entityId: z.string().min(1).max(256),
  })
  .readonly()
  .meta({
    id: 'WorldEntityReference',
    title: 'WorldEntityReference',
    description:
      'Reference to a world-graph entity in the W002 world-model grammar (opaque entity id; referenced, never embedded).',
  });

/** One world entity reference. */
export type WorldEntityReference = z.infer<typeof WorldEntityReferenceSchema>;

/**
 * A reference to a constraint (the W004 constraint-language grammar:
 * lowercase kebab constraint id, max 127 chars). The constraint engine is
 * the constraint authority; this package only carries the reference.
 */
export const ConstraintReferenceSchema = z
  .strictObject({
    constraintId: z.string().regex(/^[a-z][a-z0-9-]{0,127}$/),
  })
  .readonly()
  .meta({
    id: 'ConstraintReference',
    title: 'ConstraintReference',
    description:
      'Reference to a constraint in the W004 constraint-language grammar (opaque constraint id; referenced, never embedded).',
  });

/** One constraint reference. */
export type ConstraintReference = z.infer<typeof ConstraintReferenceSchema>;

/**
 * A reference to evidence (the W006 grammar: content-addressed by its
 * canonical SHA-256 digest). Evidence is exact-revision addressable; the
 * evidence package is the authority.
 */
export const EvidenceReferenceSchema = z
  .strictObject({
    digest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'EvidenceReference',
    title: 'EvidenceReference',
    description:
      'Reference to evidence in the W006 grammar: canonical SHA-256 content digest (exact-revision addressing).',
  });

/** One evidence reference. */
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;

/**
 * One solution line: the atomic line item of a solution version (the BOQ
 * line in construction, the BOM line in mechanical, the epic/module line in
 * software — a domain-neutral quantity+unit line). Carries an OPTIONAL
 * link to the world entity it addresses (identity-preserving navigation:
 * world entity -> solution line) and optional unit cost.
 */
export const SolutionLineSchema = z
  .strictObject({
    lineId: SolutionLineIdSchema,
    title: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    quantity: z
      .strictObject({
        value: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
        unit: z.string().min(1).max(32),
      })
      .readonly(),
    unitCost: z
      .strictObject({
        amount: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .readonly()
      .optional(),
    worldEntityId: z.string().min(1).max(256).optional(),
    acquisitionVariant: z
      .enum([
        'external-procurement',
        'internal-allocation',
        'subscription-license',
        'cloud-service-provisioning',
        'fabrication-request',
        'specialist-capability-assignment',
        'data-evidence-acquisition',
      ])
      .optional(),
  })
  .readonly()
  .meta({
    id: 'SolutionLine',
    title: 'SolutionLine',
    description:
      'One solution line: quantity+unit line item with optional unit cost, optional world-entity link (Navigator identity preservation) and optional acquisition variant.',
  });

/** One solution line. */
export type SolutionLine = z.infer<typeof SolutionLineSchema>;

/** The shared canonical-ordering refinement of a solution version. */
function refineSolutionOrdering(
  content: {
    solutionLines: z.infer<typeof SolutionLineSchema>[];
    worldReferences: WorldEntityReference[];
    constraintReferences: ConstraintReference[];
  },
  ctx: z.RefinementCtx,
): void {
  for (let i = 1; i < content.solutionLines.length; i += 1) {
    if (content.solutionLines[i]!.lineId < content.solutionLines[i - 1]!.lineId) {
      ctx.addIssue({
        code: 'custom',
        message: 'solutionLines must be sorted by lineId ascending (deterministic serialization)',
        path: ['solutionLines'],
      });
      break;
    }
    if (content.solutionLines[i]!.lineId === content.solutionLines[i - 1]!.lineId) {
      ctx.addIssue({
        code: 'custom',
        message: 'solutionLines must be duplicate-free by lineId',
        path: ['solutionLines'],
      });
      break;
    }
  }
  for (let i = 1; i < content.worldReferences.length; i += 1) {
    if (content.worldReferences[i]!.entityId < content.worldReferences[i - 1]!.entityId) {
      ctx.addIssue({
        code: 'custom',
        message: 'worldReferences must be sorted by entityId ascending (deterministic serialization)',
        path: ['worldReferences'],
      });
      break;
    }
    if (content.worldReferences[i]!.entityId === content.worldReferences[i - 1]!.entityId) {
      ctx.addIssue({
        code: 'custom',
        message: 'worldReferences must be duplicate-free by entityId',
        path: ['worldReferences'],
      });
      break;
    }
  }
  for (let i = 1; i < content.constraintReferences.length; i += 1) {
    if (content.constraintReferences[i]!.constraintId < content.constraintReferences[i - 1]!.constraintId) {
      ctx.addIssue({
        code: 'custom',
        message: 'constraintReferences must be sorted by constraintId ascending (deterministic serialization)',
        path: ['constraintReferences'],
      });
      break;
    }
    if (content.constraintReferences[i]!.constraintId === content.constraintReferences[i - 1]!.constraintId) {
      ctx.addIssue({
        code: 'custom',
        message: 'constraintReferences must be duplicate-free by constraintId',
        path: ['constraintReferences'],
      });
      break;
    }
  }
}

/**
 * The immutable content of one solution version (everything except the
 * content digest). Strict object: unknown (vendor) fields are rejected.
 */
export const SolutionVersionContentSchema = z
  .strictObject({
    schema: z.literal(SOLUTION_VERSION_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    solutionId: SolutionIdSchema,
    version: SemverCoreSchema,
    tenantId: TenantIdSchema,
    title: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    objective: z.string().max(2048).optional(),
    solutionLines: z.array(SolutionLineSchema).max(512),
    worldReferences: z.array(WorldEntityReferenceSchema).max(512),
    constraintReferences: z.array(ConstraintReferenceSchema).max(256),
    previousVersionDigest: Sha256HexSchema.nullable(),
    createdAt: TimestampSchema,
    createdBy: PrincipalIdSchema,
  })
  .superRefine(refineSolutionOrdering)
  .readonly()
  .meta({
    id: 'SolutionVersionContent',
    title: 'SolutionVersionContent',
    description:
      'The immutable content of one solution version: discriminator, semver version, tenant scope, solution lines (quantity+unit), world and constraint references, chain link to the previous published version, and the creation provenance.',
  });

/** One solution version content. */
export type SolutionVersionContent = z.infer<typeof SolutionVersionContentSchema>;

/**
 * The SEALED solution version envelope: content plus its SHA-256 digest
 * over the canonical JSON of the content (the digest field excluded).
 * Admission recomputes the digest and rejects a mismatch
 * (`digest-mismatch` — tamper detection). Published versions are
 * immutable: the seal is never recomputed for a published record.
 */
export const SealedSolutionVersionSchema = z
  .strictObject({
    schema: z.literal(SOLUTION_VERSION_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    solutionId: SolutionIdSchema,
    version: SemverCoreSchema,
    tenantId: TenantIdSchema,
    title: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    objective: z.string().max(2048).optional(),
    solutionLines: z.array(SolutionLineSchema).max(512),
    worldReferences: z.array(WorldEntityReferenceSchema).max(512),
    constraintReferences: z.array(ConstraintReferenceSchema).max(256),
    previousVersionDigest: Sha256HexSchema.nullable(),
    createdAt: TimestampSchema,
    createdBy: PrincipalIdSchema,
    contentDigest: Sha256HexSchema,
  })
  .superRefine(refineSolutionOrdering)
  .readonly()
  .meta({
    id: 'SealedSolutionVersion',
    title: 'SealedSolutionVersion',
    description:
      'The sealed solution version envelope: canonically ordered immutable content plus its SHA-256 content digest (exact-revision addressing; hash-chained via previousVersionDigest).',
  });

/** One sealed solution version. */
export type SealedSolutionVersion = z.infer<typeof SealedSolutionVersionSchema>;

/**
 * The baseline approval record: a distinct authority act that approves a
 * SEALED solution version as THE baseline (the W006 "results do not
 * self-approve" precedent). The approval references the exact content
 * digest — the approved content is never mutated afterwards
 * (`baseline-mutation-rejected` on any attempt).
 */
export const BaselineApprovalSchema = z
  .strictObject({
    schema: z.literal(BASELINE_APPROVAL_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    approvalId: z.string().regex(/^approval:[a-z0-9][a-z0-9-]{0,62}$/),
    solutionId: SolutionIdSchema,
    tenantId: TenantIdSchema,
    version: SemverCoreSchema,
    baselineDigest: Sha256HexSchema,
    approvedBy: PrincipalIdSchema,
    approvedAt: TimestampSchema,
    decisionNote: z.string().max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'BaselineApproval',
    title: 'BaselineApproval',
    description:
      'The baseline approval record: a distinct authority act approving a sealed solution version (referenced by exact content digest) as the baseline.',
  });

/** One baseline approval. */
export type BaselineApproval = z.infer<typeof BaselineApprovalSchema>;

/** Deterministic summary of a verified solution version chain. */
export interface SolutionChainSummary {
  readonly solutionId: string;
  readonly tenantId: string;
  readonly versionCount: number;
  readonly headVersion: string;
  readonly headDigest: Sha256Hex;
}

/**
 * Compute the content digest of a solution version: the SHA-256 of the
 * canonical JSON of the content (every envelope field EXCEPT
 * `contentDigest`). Throws on invalid content; producers validate first
 * (`sealSolutionVersion` is the total form).
 */
export function computeSolutionVersionDigest(content: SolutionVersionContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid solution version content into its published envelope. */
export function sealSolutionVersion(content: unknown): DeliveryResult<SealedSolutionVersion> {
  const parsed = SolutionVersionContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/**
 * Verify a sealed solution version: schema validation + digest
 * recomputation. A claimed digest that does not match the recomputed
 * canonical SHA-256 of the content is a typed `digest-mismatch` (tamper
 * detection).
 */
export function verifySealedSolutionVersion(sealed: unknown): DeliveryResult<SealedSolutionVersion> {
  const parsed = SealedSolutionVersionSchema.safeParse(sealed);
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
          'sealed solution version digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Approve a sealed solution version as the baseline (a distinct authority
 * act). Total: the version must verify, the approval must reference the
 * version's exact digest, and the tenant scopes must agree.
 */
export function approveSolutionBaseline(
  sealed: unknown,
  approval: unknown,
): DeliveryResult<{ readonly sealed: SealedSolutionVersion; readonly approval: BaselineApproval }> {
  const verified = verifySealedSolutionVersion(sealed);
  if (!verified.ok) {
    return verified;
  }
  const parsed = BaselineApprovalSchema.safeParse(approval);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  if (parsed.data.tenantId !== verified.value.tenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: 'baseline approval tenant does not match the solution version tenant (R12)',
        expectedTenantId: verified.value.tenantId,
        encounteredTenantId: parsed.data.tenantId,
      },
    };
  }
  if (parsed.data.solutionId !== verified.value.solutionId) {
    return {
      ok: false,
      error: {
        code: 'unknown-solution-reference',
        message: `baseline approval references solution "${parsed.data.solutionId}" but the sealed version belongs to "${verified.value.solutionId}"`,
        solutionId: parsed.data.solutionId,
        encounteredVersion: parsed.data.version,
      },
    };
  }
  if (parsed.data.version !== verified.value.version || parsed.data.baselineDigest !== verified.value.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'baseline approval must reference the sealed version exactly (version + content digest)',
        expected: verified.value.contentDigest,
        encountered: parsed.data.baselineDigest,
      },
    };
  }
  if (parsed.data.approvedAt < verified.value.createdAt) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'baseline approval instant precedes the version creation instant',
        issues: [{ path: 'approvedAt', message: 'approvedAt must not precede createdAt' }],
      },
    };
  }
  return { ok: true, value: { sealed: verified.value, approval: parsed.data } };
}

/**
 * The typed rejection surface for in-place baseline mutation attempts:
 * an approved baseline is IMMUTABLE — changed content ships as a NEW
 * version in the chain (`previousVersionDigest` links to the approved
 * digest). Always a typed `baseline-mutation-rejected`.
 */
export function reviseSolutionBaseline(
  approval: BaselineApproval,
  edit: unknown,
): DeliveryResult<never> {
  void edit;
  return {
    ok: false,
    error: {
      code: 'baseline-mutation-rejected',
      message:
        `approved baseline "${approval.solutionId}" v${approval.version} is immutable — ` +
        'changed content ships as a NEW version linked via previousVersionDigest (baseline-mutation-rejected)',
      solutionId: approval.solutionId,
      version: approval.version,
      baselineDigest: approval.baselineDigest,
    },
  };
}

/**
 * Admit a candidate sealed solution version onto a published chain
 * (append semantics — the marketplace publication discipline):
 *
 * - the candidate verifies individually (tamper detection);
 * - the candidate's solution/tenant match the chain;
 * - a version that already exists with the SAME digest is an idempotent
 *   re-admission (ok, unchanged chain);
 * - a version that already exists with DIFFERENT content is a typed
 *   `version-conflict` (a published version is immutable);
 * - the candidate version must be semver-GREATER than the head
 *   (`version-conflict` otherwise);
 * - the candidate's `previousVersionDigest` must equal the head's content
 *   digest (`digest-mismatch` — broken chain).
 */
export function admitSolutionVersion(
  chain: readonly SealedSolutionVersion[],
  candidate: unknown,
): DeliveryResult<readonly SealedSolutionVersion[]> {
  const verified = verifySealedSolutionVersion(candidate);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (chain.length === 0) {
    if (admitted.previousVersionDigest !== null) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: 'the first published version must link to previousVersionDigest null',
          expected: 'null',
          encountered: admitted.previousVersionDigest,
        },
      };
    }
    return { ok: true, value: [admitted] };
  }
  const chainVerified = verifySolutionVersionChain(chain);
  if (!chainVerified.ok) {
    return chainVerified;
  }
  const head = [...chain].sort((a, b) => compareSemver(b.version, a.version))[0]!;
  if (admitted.solutionId !== head.solutionId || admitted.tenantId !== head.tenantId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'candidate version belongs to a different solution/tenant than the chain',
        issues: [{ path: '$', message: 'mixed solution identities in one chain' }],
      },
    };
  }
  const existing = chain.find(
    (sealed) => sealed.solutionId === admitted.solutionId && sealed.version === admitted.version,
  );
  if (existing !== undefined) {
    if (existing.contentDigest === admitted.contentDigest) {
      return { ok: true, value: chain };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `version "${admitted.version}" is already published with different content — a published version is immutable; changed content ships as a NEW version`,
        solutionId: admitted.solutionId,
        version: admitted.version,
        publishedDigest: existing.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  if (compareSemver(admitted.version, head.version) <= 0) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `version "${admitted.version}" is not semver-greater than the published head "${head.version}"`,
        solutionId: admitted.solutionId,
        version: admitted.version,
        publishedDigest: head.contentDigest,
      },
    };
  }
  if (admitted.previousVersionDigest !== head.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'candidate does not link to the prior published version\'s content digest (broken chain)',
        expected: head.contentDigest,
        encountered: admitted.previousVersionDigest ?? 'null',
      },
    };
  }
  return { ok: true, value: [...chain, admitted] };
}

/**
 * Verify the publication chain of one solution's sealed versions:
 *
 * - every envelope verifies individually (schema + digest);
 * - all versions share the solution id and tenant;
 * - versions are strictly ASCENDING by semver with no duplicates
 *   (`version-conflict`);
 * - the first version links to null and every later version links to the
 *   PRIOR version's content digest (broken links are `digest-mismatch`).
 *
 * Input order is irrelevant: the chain is verified over the
 * semver-ascending order.
 */
export function verifySolutionVersionChain(
  versions: readonly SealedSolutionVersion[],
): DeliveryResult<SolutionChainSummary> {
  if (versions.length === 0) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'version chain is empty',
        issues: [{ path: '$', message: 'at least one sealed version is required' }],
      },
    };
  }
  for (const sealed of versions) {
    const verified = verifySealedSolutionVersion(sealed);
    if (!verified.ok) {
      return verified;
    }
  }
  const solutionId = versions[0]!.solutionId;
  const tenantId = versions[0]!.tenantId;
  for (const sealed of versions) {
    if (sealed.solutionId !== solutionId || sealed.tenantId !== tenantId) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'version chain mixes solutions (solutionId/tenantId must be constant within a chain)',
          issues: [{ path: '$', message: 'mixed solution identities in one chain' }],
        },
      };
    }
  }
  const ordered = [...versions].sort((a, b) => compareSemver(a.version, b.version));
  for (let i = 1; i < ordered.length; i += 1) {
    if (compareSemver(ordered[i]!.version, ordered[i - 1]!.version) === 0) {
      return {
        ok: false,
        error: {
          code: 'version-conflict',
          message: `version "${ordered[i]!.version}" appears more than once — a published version is immutable; changed content ships as a NEW version`,
          solutionId,
          version: ordered[i]!.version,
        },
      };
    }
  }
  if (ordered[0]!.previousVersionDigest !== null) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'the first published version must link to previousVersionDigest null',
        expected: 'null',
        encountered: ordered[0]!.previousVersionDigest ?? 'null',
      },
    };
  }
  for (let i = 1; i < ordered.length; i += 1) {
    const expected = ordered[i - 1]!.contentDigest;
    const encountered = ordered[i]!.previousVersionDigest;
    if (encountered === null || encountered !== expected) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `version "${ordered[i]!.version}" does not link to the prior published version's content digest (broken chain)`,
          expected,
          encountered: encountered ?? 'null',
        },
      };
    }
  }
  const head = ordered[ordered.length - 1]!;
  return {
    ok: true,
    value: {
      solutionId,
      tenantId,
      versionCount: ordered.length,
      headVersion: head.version,
      headDigest: head.contentDigest,
    },
  };
}

/**
 * The structural world lookup this kernel needs (a W002 WorldModel read
 * view satisfies it structurally — the world model is the authority; this
 * package never recreates it).
 */
export interface WorldEntityLookup {
  hasEntity(entityId: string): boolean;
}

/**
 * Resolve every world reference of a solution version against a
 * world-shaped lookup. A DANGLING reference (unknown entity id) is a typed
 * `dangling-reference-rejected` — dangling world references never publish.
 */
export function resolveWorldReferences(
  references: readonly WorldEntityReference[],
  lookup: WorldEntityLookup,
): DeliveryResult<readonly WorldEntityReference[]> {
  for (const reference of references) {
    if (!lookup.hasEntity(reference.entityId)) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `world entity "${reference.entityId}" does not resolve in the world model — dangling references are typed rejections`,
          referenceKind: 'world-entity',
          referenceId: reference.entityId,
        },
      };
    }
  }
  return { ok: true, value: references };
}

/**
 * The structural constraint lookup this kernel needs (the W004 constraint
 * engine satisfies it structurally — the constraint authority; this
 * package only carries references).
 */
export interface ConstraintLookup {
  hasConstraint(constraintId: string): boolean;
}

/**
 * Resolve every constraint reference against a constraint-shaped lookup.
 * A DANGLING reference is a typed `dangling-reference-rejected`.
 */
export function resolveConstraintReferences(
  references: readonly ConstraintReference[],
  lookup: ConstraintLookup,
): DeliveryResult<readonly ConstraintReference[]> {
  for (const reference of references) {
    if (!lookup.hasConstraint(reference.constraintId)) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `constraint "${reference.constraintId}" does not resolve in the constraint engine — dangling references are typed rejections`,
          referenceKind: 'constraint',
          referenceId: reference.constraintId,
        },
      };
    }
  }
  return { ok: true, value: references };
}

/**
 * The structural evidence lookup this kernel needs (a W006 evidence store
 * satisfies it structurally — evidence is exact-revision addressable by
 * canonical digest).
 */
export interface EvidenceLookup {
  hasEvidence(digest: string): boolean;
}

/**
 * Resolve every evidence reference against an evidence-shaped lookup. A
 * DANGLING reference (unknown digest) is a typed
 * `dangling-reference-rejected`.
 */
export function resolveEvidenceReferences(
  references: readonly EvidenceReference[],
  lookup: EvidenceLookup,
): DeliveryResult<readonly EvidenceReference[]> {
  for (const reference of references) {
    if (!lookup.hasEvidence(reference.digest)) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `evidence digest "${reference.digest}" does not resolve in the evidence store — dangling references are typed rejections`,
          referenceKind: 'evidence',
          referenceId: reference.digest,
        },
      };
    }
  }
  return { ok: true, value: references };
}
