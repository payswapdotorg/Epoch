/**
 * The acquisition package: the commercial projection of one W036
 * acquisition request. Procurement packages wrap the universal Acquire
 * contract instance (an @epoch/solution-delivery
 * `AcquisitionRequestRecord`) as a quotable commercial unit: the package
 * references the request by exact content digest and mirrors its
 * quantity-bearing lines for the commercial fold (the mirror discipline:
 * for the `external-procurement` variant the package lines MUST equal
 * the request's lines — a silent commercial rewrite is a typed
 * `validation` rejection).
 *
 * Extension points WITHOUT new authorities: the package `variant` is the
 * W036 closed acquisition-variant catalog (all seven variants are
 * projectable — external procurement, internal allocation,
 * subscription/license, cloud/service provisioning, fabrication request,
 * specialist capability assignment, data/evidence acquisition). A
 * package claiming a variant outside the catalog is rejected (closed
 * vocabulary); anything needing NEW lifecycle semantics is an
 * architecture question, never a field here.
 *
 * The record is tenant-scoped, sealed (SHA-256 content addressing) and
 * append-only: re-admitting the same id with identical content is
 * idempotent; different content is a typed `version-conflict`.
 */
import { z } from 'zod';
import type { JsonValue } from '@epoch/agent-protocol';
import { ACQUISITION_VARIANTS, TenantIdSchema } from '@epoch/solution-delivery';
import type { AcquisitionRequestRecord, AcquisitionVariant } from '@epoch/solution-delivery';
import {
  AcquisitionIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PackageIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  SolutionLineIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  canonicalDigest,
} from './primitives';
import { ACQUISITION_PACKAGE_SCHEMA_NAME, PROCUREMENT_RECORD_VERSION } from './version';
import { authorityViolationError, hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ProcurementResult } from './errors';

/** One commercial line of an acquisition package (quantity-bearing). */
export const PackageLineSchema = z
  .strictObject({
    description: z.string().min(1).max(256),
    quantity: NonNegativeDecimalSchema,
    unit: UnitLabelSchema,
    solutionLineId: SolutionLineIdSchema.optional(),
    externalPartyRef: OpaqueReferenceSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'PackageLine',
    title: 'PackageLine',
    description:
      'One commercial line of an acquisition package: description, quantity+unit, optional solution-line link and opaque external-party reference.',
  });

/** One package line. */
export type PackageLine = z.infer<typeof PackageLineSchema>;

/**
 * The immutable content of one acquisition package: the commercial
 * projection of one W036 acquisition request, referenced by exact
 * content digest with mirrored commercial lines.
 */
const acquisitionPackageShape = z.strictObject({
  schema: z.literal(ACQUISITION_PACKAGE_SCHEMA_NAME),
  schemaVersion: z.literal(PROCUREMENT_RECORD_VERSION),
  packageId: PackageIdSchema,
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  acquisitionId: AcquisitionIdSchema,
  acquisitionRequestDigest: Sha256HexSchema,
  variant: z.enum(ACQUISITION_VARIANTS),
  lines: z.array(PackageLineSchema).max(64),
  assembledAt: TimestampSchema,
  assembledBy: PrincipalIdSchema,
  note: z.string().max(2048).optional(),
});

export const AcquisitionPackageContentSchema = acquisitionPackageShape
  .readonly()
  .superRefine((pkg, ctx) => {
    for (let i = 1; i < pkg.lines.length; i += 1) {
      if (pkg.lines[i]!.description < pkg.lines[i - 1]!.description) {
        ctx.addIssue({
          code: 'custom',
          message: 'lines must be sorted by description ascending (deterministic serialization)',
          path: ['lines'],
        });
        break;
      }
      if (pkg.lines[i]!.description === pkg.lines[i - 1]!.description) {
        ctx.addIssue({
          code: 'custom',
          message: 'lines must be duplicate-free by description within the package',
          path: ['lines'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'AcquisitionPackageContent',
    title: 'AcquisitionPackageContent',
    description:
      'The immutable content of one acquisition package: the commercial projection of one W036 acquisition request (exact digest reference), a variant from the closed W036 acquisition catalog, sorted commercial lines, and assembly provenance.',
  });

/** One acquisition package content. */
export type AcquisitionPackageContent = z.infer<typeof AcquisitionPackageContentSchema>;

/** The SEALED acquisition package: content plus its SHA-256 content digest. */
export const SealedAcquisitionPackageSchema = z
  .strictObject({
    ...acquisitionPackageShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedAcquisitionPackage',
    title: 'SealedAcquisitionPackage',
    description:
      'The sealed acquisition package: immutable commercial projection content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed acquisition package. */
export type SealedAcquisitionPackage = z.infer<typeof SealedAcquisitionPackageSchema>;

/** Compute the content digest of acquisition-package content (canonical JSON). */
export function computeAcquisitionPackageDigest(
  content: AcquisitionPackageContent,
): string {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid acquisition-package content into its published record. */
export function sealAcquisitionPackage(content: unknown): ProcurementResult<SealedAcquisitionPackage> {
  const pre = authorityViolationError(content);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = AcquisitionPackageContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed acquisition package (schema + digest recomputation). */
export function verifySealedAcquisitionPackage(
  sealed: unknown,
): ProcurementResult<SealedAcquisitionPackage> {
  const pre = authorityViolationError(sealed);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = SealedAcquisitionPackageSchema.safeParse(sealed);
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
          'sealed acquisition package digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The commercial mirror of a W036 external-procurement request line. */
function mirrorsRequestLines(
  lines: readonly PackageLine[],
  request: AcquisitionRequestRecord,
): boolean {
  if (request.detail.variant !== 'external-procurement') {
    return true;
  }
  const requestLines = request.detail.lines;
  if (lines.length !== requestLines.length) {
    return false;
  }
  return lines.every((line, index) => {
    const requestLine = requestLines[index]!;
    return (
      line.description === requestLine.description &&
      line.quantity === requestLine.quantity &&
      line.unit === requestLine.unit &&
      line.solutionLineId === requestLine.solutionLineId &&
      line.externalPartyRef === requestLine.externalPartyRef
    );
  });
}

/**
 * The admitted acquisition-package store (append-only, reference
 * in-memory): one entry per package id, each carrying its full sealed
 * revision history (digest-chained).
 */
export interface AcquisitionPackageStore {
  readonly packages: readonly SealedAcquisitionPackage[];
}

/** An empty package store. */
export function emptyPackageStore(): AcquisitionPackageStore {
  return { packages: [] };
}

/** The current (latest) sealed revision of one package id, if any. */
export function packageHead(store: AcquisitionPackageStore, packageId: string): SealedAcquisitionPackage | undefined {
  const revisions = store.packages.filter((pkg) => pkg.packageId === packageId);
  return revisions.length === 0 ? undefined : revisions[revisions.length - 1];
}

/**
 * Admit a sealed acquisition package referencing known W036 acquisition
 * requests:
 *
 * - the package verifies (tamper detection);
 * - the referenced acquisition request exists (`dangling-reference-rejected`
 *   with kind `acquisition-request`) and belongs to the same tenant
 *   (`tenant-isolation-rejected`);
 * - the package's `acquisitionRequestDigest` equals the canonical digest
 *   of the EXACT admitted request (`digest-mismatch` — the commercial
 *   projection never grounds a different request revision);
 * - the package's `variant` equals the request's variant and, for the
 *   quantity-bearing `external-procurement` variant, the commercial
 *   lines MIRROR the request's lines exactly (`validation`);
 * - an exact re-admission (same id, same digest) is idempotent; the same
 *   id with different content is a typed `version-conflict` (a sealed
 *   package is immutable — changed content ships as a NEW package id).
 */
export function admitAcquisitionPackage(
  requests: readonly AcquisitionRequestRecord[],
  store: AcquisitionPackageStore,
  pkg: unknown,
): ProcurementResult<AcquisitionPackageStore> {
  const verified = verifySealedAcquisitionPackage(pkg);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  const request = requests.find((candidate) => candidate.acquisitionId === admitted.acquisitionId);
  if (request === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `acquisition package "${admitted.packageId}" references acquisition request "${admitted.acquisitionId}", which does not resolve`,
        referenceKind: 'acquisition-request',
        referenceId: admitted.acquisitionId,
      },
    };
  }
  if (admitted.tenantId !== request.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `acquisition package "${admitted.packageId}" belongs to tenant "${admitted.tenantId}" but the acquisition request is scoped to "${request.tenantId}" (R12)`,
        expectedTenantId: request.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.packageId,
      },
    };
  }
  const requestDigest = canonicalDigest(request as unknown as JsonValue);
  if (requestDigest !== admitted.acquisitionRequestDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `acquisition package "${admitted.packageId}" grounds request digest "${admitted.acquisitionRequestDigest}" but the admitted request's exact-revision digest is "${requestDigest}" — the commercial projection may not drift from its request`,
        expected: requestDigest,
        encountered: admitted.acquisitionRequestDigest,
      },
    };
  }
  if (admitted.solutionId !== request.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `acquisition package "${admitted.packageId}" subjects solution "${admitted.solutionId}" but the request subjects "${request.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'package must subject the request solution' }],
      },
    };
  }
  const requestVariant: AcquisitionVariant = request.detail.variant;
  if (admitted.variant !== requestVariant) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `acquisition package "${admitted.packageId}" projects variant "${admitted.variant}" but the request is variant "${requestVariant}" — the projection may not change the acquisition variant`,
        issues: [{ path: 'variant', message: 'variant must equal the request variant' }],
      },
    };
  }
  if (!mirrorsRequestLines(admitted.lines, request)) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `acquisition package "${admitted.packageId}" commercial lines do not mirror the acquisition request's external-procurement lines — a silent commercial rewrite is rejected`,
        issues: [{ path: 'lines', message: 'lines must mirror the request lines exactly' }],
      },
    };
  }
  const existing = packageHead(store, admitted.packageId);
  if (existing !== undefined) {
    if (existing.contentDigest === admitted.contentDigest) {
      return { ok: true, value: store };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `acquisition package "${admitted.packageId}" is already sealed with different content — a sealed package is immutable; changed content ships as a NEW package id`,
        subject: 'acquisition-package',
        subjectId: admitted.packageId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  return { ok: true, value: { packages: [...store.packages, admitted] } };
}

/** The package-store fold: packages sorted by packageId (deterministic). */
export function foldAcquisitionPackages(
  store: AcquisitionPackageStore,
): readonly SealedAcquisitionPackage[] {
  return [...store.packages].sort((a, b) => (a.packageId < b.packageId ? -1 : 1));
}
