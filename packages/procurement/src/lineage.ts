/**
 * The requirement → acquisition-package lineage (the W037 pin): typed,
 * content-addressed lineage records binding a ProgramOfWork
 * work-package requirement reference (an OPAQUE id into W036's
 * ProgramOfWork — `work-package:<slug>` or `solution:<version>`-scoped
 * solution line) to an acquisition package.
 *
 * - ONE requirement may FAN OUT to multiple acquisition attempts: many
 *   lineage records may reference the same requirement (each naming a
 *   different package); every lineage link carries provenance
 *   (recordedAt/recordedBy) and tenant scope.
 * - The lineage link is SEALED (SHA-256 content addressing) and
 *   append-only: exact re-admission is idempotent; the same lineage id
 *   with different content is a typed `version-conflict`.
 * - Admission resolves the requirement against the caller-supplied
 *   known requirement ids (extracted from the sealed W036
 *   ProgramOfWork / solution version — opaque, never embedded objects)
 *   and the package against the admitted package store: dangling
 *   references are typed `dangling-reference-rejected`; cross-tenant
 *   links are `tenant-isolation-rejected`.
 */
import { z } from 'zod';
import type { JsonValue } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/solution-delivery';
import {
  LineageIdSchema,
  PackageIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  SolutionLineIdSchema,
  TimestampSchema,
  WorkPackageIdSchema,
  canonicalDigest,
} from './primitives';
import {
  REQUIREMENT_LINEAGE_SCHEMA_NAME,
  PROCUREMENT_RECORD_VERSION,
} from './version';
import { authorityViolationError, hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ProcurementResult } from './errors';
import type { AcquisitionPackageStore } from './package';

/** The requirement-reference kinds (opaque ids into W036 records). */
export const REQUIREMENT_REF_KINDS = ['work-package', 'solution-line'] as const;

/** One requirement-reference kind. */
export type RequirementRefKind = (typeof REQUIREMENT_REF_KINDS)[number];

/** One opaque requirement reference into a W036 ProgramOfWork. */
export const RequirementRefSchema = z
  .discriminatedUnion('kind', [
    z
      .strictObject({
        kind: z.literal('work-package'),
        workPackageId: WorkPackageIdSchema,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('solution-line'),
        solutionLineId: SolutionLineIdSchema,
      })
      .readonly(),
  ])
  .meta({
    id: 'RequirementRef',
    title: 'RequirementRef',
    description:
      'One opaque requirement reference into a W036 ProgramOfWork: a work-package id or a solution-line id (never an embedded object).',
  });

/** One requirement reference. */
export type RequirementRef = z.infer<typeof RequirementRefSchema>;

/** The opaque id string of a requirement reference (the resolution key). */
export function requirementRefId(ref: RequirementRef): string {
  return ref.kind === 'work-package' ? ref.workPackageId : ref.solutionLineId;
}

/**
 * The immutable content of one requirement-lineage record: one
 * requirement → one acquisition-package link with provenance and tenant
 * scope.
 */
const requirementLineageShape = z.strictObject({
  schema: z.literal(REQUIREMENT_LINEAGE_SCHEMA_NAME),
  schemaVersion: z.literal(PROCUREMENT_RECORD_VERSION),
  lineageId: LineageIdSchema,
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  requirementRef: RequirementRefSchema,
  packageId: PackageIdSchema,
  recordedAt: TimestampSchema,
  recordedBy: PrincipalIdSchema,
  note: z.string().max(2048).optional(),
});

export const RequirementLineageContentSchema = requirementLineageShape
  .readonly()
  .meta({
    id: 'RequirementLineageContent',
    title: 'RequirementLineageContent',
    description:
      'The immutable content of one requirement-lineage record: one opaque ProgramOfWork requirement reference bound to one acquisition package, with provenance and tenant scope (fan-out: many lineage records may name one requirement).',
  });

/** One requirement-lineage content. */
export type RequirementLineageContent = z.infer<typeof RequirementLineageContentSchema>;

/** The SEALED requirement-lineage record: content plus its content digest. */
export const SealedRequirementLineageSchema = z
  .strictObject({
    ...requirementLineageShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedRequirementLineage',
    title: 'SealedRequirementLineage',
    description:
      'The sealed requirement-lineage record: immutable requirement-to-package link plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed requirement-lineage record. */
export type SealedRequirementLineage = z.infer<typeof SealedRequirementLineageSchema>;

/** Compute the content digest of lineage content (canonical JSON). */
export function computeRequirementLineageDigest(content: RequirementLineageContent): string {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid requirement-lineage content into its published record. */
export function sealRequirementLineage(
  content: unknown,
): ProcurementResult<SealedRequirementLineage> {
  const pre = authorityViolationError(content);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = RequirementLineageContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed requirement-lineage record (schema + digest recomputation). */
export function verifySealedRequirementLineage(
  sealed: unknown,
): ProcurementResult<SealedRequirementLineage> {
  const pre = authorityViolationError(sealed);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = SealedRequirementLineageSchema.safeParse(sealed);
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
          'sealed requirement-lineage record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The append-only lineage ledger (reference in-memory). */
export interface RequirementLineageStore {
  readonly lineages: readonly SealedRequirementLineage[];
}

/** An empty lineage ledger. */
export function emptyLineageStore(): RequirementLineageStore {
  return { lineages: [] };
}

/**
 * Admit a sealed requirement-lineage record:
 *
 * - the record verifies (tamper detection);
 * - the requirement resolves against the caller-supplied known
 *   requirement ids — dangling requirement references are typed
 *   `dangling-reference-rejected` (kind `requirement`);
 * - the package exists in the admitted package store (kind
 *   `acquisition-package`) and belongs to the same tenant
 *   (`tenant-isolation-rejected`);
 * - the lineage's solution scope matches the package's
 *   (`validation`);
 * - an exact re-admission is idempotent; the same lineage id with
 *   different content is a typed `version-conflict`;
 * - FAN-OUT is allowed: multiple lineage records (different lineage ids)
 *   may bind the SAME requirement to DIFFERENT packages — one
 *   requirement, many acquisition attempts. The same (requirement,
 *   package) pair under a NEW lineage id is a typed `version-conflict`
 *   (one link identity grounds exactly one pair).
 */
export function admitRequirementLineage(
  requirements: readonly string[],
  packages: AcquisitionPackageStore,
  store: RequirementLineageStore,
  lineage: unknown,
): ProcurementResult<RequirementLineageStore> {
  const verified = verifySealedRequirementLineage(lineage);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  const refId = requirementRefId(admitted.requirementRef);
  if (!requirements.includes(refId)) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `requirement lineage "${admitted.lineageId}" references requirement "${refId}", which does not resolve in the supplied ProgramOfWork requirement set`,
        referenceKind: 'requirement',
        referenceId: refId,
      },
    };
  }
  const pkg = packages.packages.find((candidate) => candidate.packageId === admitted.packageId);
  if (pkg === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `requirement lineage "${admitted.lineageId}" references acquisition package "${admitted.packageId}", which does not resolve`,
        referenceKind: 'acquisition-package',
        referenceId: admitted.packageId,
      },
    };
  }
  if (admitted.tenantId !== pkg.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `requirement lineage "${admitted.lineageId}" belongs to tenant "${admitted.tenantId}" but the acquisition package is scoped to "${pkg.tenantId}" (R12)`,
        expectedTenantId: pkg.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.lineageId,
      },
    };
  }
  if (admitted.solutionId !== pkg.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `requirement lineage "${admitted.lineageId}" subjects solution "${admitted.solutionId}" but the package subjects "${pkg.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'lineage must subject the package solution' }],
      },
    };
  }
  const existingById = store.lineages.find((record) => record.lineageId === admitted.lineageId);
  if (existingById !== undefined) {
    if (existingById.contentDigest === admitted.contentDigest) {
      return { ok: true, value: store };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `requirement lineage "${admitted.lineageId}" is already sealed with different content — a sealed lineage record is immutable; changed content ships as a NEW lineage id`,
        subject: 'requirement-lineage',
        subjectId: admitted.lineageId,
        publishedDigest: existingById.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  const existingPair = store.lineages.find(
    (record) =>
      requirementRefId(record.requirementRef) === refId && record.packageId === admitted.packageId,
  );
  if (existingPair !== undefined) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `requirement "${refId}" is already linked to package "${admitted.packageId}" by lineage "${existingPair.lineageId}" — one link identity grounds exactly one (requirement, package) pair; use a new package id for a new acquisition attempt`,
        subject: 'requirement-lineage-pair',
        subjectId: `${refId}->${admitted.packageId}`,
        publishedDigest: existingPair.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  return { ok: true, value: { lineages: [...store.lineages, admitted] } };
}

/**
 * Deterministic lineage fold: the acquisition attempts of one
 * requirement, sorted by lineage id — the fan-out view (input order
 * never leaks).
 */
export function acquisitionAttemptsOf(
  store: RequirementLineageStore,
  refId: string,
): readonly SealedRequirementLineage[] {
  return store.lineages
    .filter((record) => requirementRefId(record.requirementRef) === refId)
    .sort((a, b) => (a.lineageId < b.lineageId ? -1 : 1));
}

/** The lineage-store fold: records sorted by lineageId (deterministic). */
export function foldRequirementLineages(
  store: RequirementLineageStore,
): readonly SealedRequirementLineage[] {
  return [...store.lineages].sort((a, b) => (a.lineageId < b.lineageId ? -1 : 1));
}
