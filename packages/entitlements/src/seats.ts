/**
 * Seat-assignment accounting over W023 entitlement grants (the W024
 * seat-billing seam).
 *
 * - A seat assignment is an explicit, IMMUTABLE, content-addressed
 *   record binding one principal (the W009 identity grammar) to one seat
 *   of one W023 entitlement grant. A release is a second append-only
 *   record that flips the assignment inactive — same discipline as the
 *   W023 revocation record (facts, never in-place mutation).
 * - {@link admitSeatAssignment} is a PURE admission over the CURRENT
 *   assignment/release sets plus the W023 grant/revocation records: the
 *   grant must exist, must not be revoked, must declare seat capacity,
 *   the principal must not already hold an active seat, and the active
 *   count must stay within capacity. Every rejection is typed.
 * - {@link foldSeatAssignments} is the deterministic seat account:
 *   assignments sort by seatAssignmentId; the fold is order-independent.
 * - The kernel NEVER interprets principals (identity != tenancy !=
 *   authorization != policy — lock rule 12): it only records and counts.
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  EntitlementGrantRecordSchema,
  EntitlementIdSchema,
  EntitlementRevokeRecordSchema,
} from '@epoch/marketplace';
import type {
  EntitlementGrantRecord,
  EntitlementRevokeRecord,
} from '@epoch/marketplace';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  PrincipalIdSchema,
  SeatAssignmentIdSchema,
  SeatReleaseIdSchema,
  Sha256HexSchema,
} from './primitives';
import {
  ENTITLEMENTS_RECORD_VERSION,
  SEAT_ASSIGNMENT_SCHEMA_NAME,
  SEAT_RELEASE_SCHEMA_NAME,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { EntitlementsResult } from './errors';

const SeatAssignmentObjectSchema = z.strictObject({
  schema: z.literal(SEAT_ASSIGNMENT_SCHEMA_NAME),
  schemaVersion: z.literal(ENTITLEMENTS_RECORD_VERSION),
  seatAssignmentId: SeatAssignmentIdSchema,
  entitlementId: EntitlementIdSchema,
  tenantId: TenantIdSchema,
  principalId: PrincipalIdSchema,
  assignedAt: TimestampSchema,
  assignedBy: PrincipalIdSchema,
});

/** The immutable content of one seat assignment. */
export const SeatAssignmentContentSchema = SeatAssignmentObjectSchema.readonly().meta({
  id: 'SeatAssignmentContent',
  title: 'SeatAssignmentContent',
  description:
    'Immutable content of one seat assignment: the seat id, the W023 entitlement it draws capacity from, the tenant scope, the assigned principal, and the assignment instant and actor.',
});

/** One seat-assignment content. */
export type SeatAssignmentContent = z.infer<typeof SeatAssignmentContentSchema>;

/** The SEALED seat assignment: content plus its SHA-256 content digest. */
export const SealedSeatAssignmentSchema = z
  .strictObject({ ...SeatAssignmentObjectSchema.shape, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedSeatAssignment',
    title: 'SealedSeatAssignment',
    description:
      'The sealed seat assignment: immutable binding of one principal to one seat of one W023 entitlement grant, plus the SHA-256 content digest (the exact-revision content address).',
  });

/** One sealed seat assignment. */
export type SealedSeatAssignment = z.infer<typeof SealedSeatAssignmentSchema>;

const SeatReleaseObjectSchema = z.strictObject({
  schema: z.literal(SEAT_RELEASE_SCHEMA_NAME),
  schemaVersion: z.literal(ENTITLEMENTS_RECORD_VERSION),
  releaseId: SeatReleaseIdSchema,
  seatAssignmentId: SeatAssignmentIdSchema,
  entitlementId: EntitlementIdSchema,
  tenantId: TenantIdSchema,
  releasedAt: TimestampSchema,
  releasedBy: PrincipalIdSchema,
});

/** The immutable content of one seat release. */
export const SeatReleaseContentSchema = SeatReleaseObjectSchema.readonly().meta({
  id: 'SeatReleaseContent',
  title: 'SeatReleaseContent',
  description:
    'Immutable content of one seat release: the release id, the seat assignment it flips inactive, the entitlement and tenant scope, and the release instant and actor.',
});

/** One seat-release content. */
export type SeatReleaseContent = z.infer<typeof SeatReleaseContentSchema>;

/** The SEALED seat release: content plus its SHA-256 content digest. */
export const SealedSeatReleaseSchema = z
  .strictObject({ ...SeatReleaseObjectSchema.shape, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedSeatRelease',
    title: 'SealedSeatRelease',
    description:
      'The sealed seat release: the append-only record whose existence flips a seat assignment inactive, plus the SHA-256 content digest.',
  });

/** One sealed seat release. */
export type SealedSeatRelease = z.infer<typeof SealedSeatReleaseSchema>;

/** Compute the content digest of one seat assignment (canonical JSON). */
export function computeSeatAssignmentDigest(content: SeatAssignmentContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid seat-assignment content into its published record. Total. */
export function sealSeatAssignment(content: unknown): EntitlementsResult<SealedSeatAssignment> {
  const parsed = SeatAssignmentContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: canonicalDigest(parsed.data as unknown as JsonValue) },
  };
}

/** Verify a sealed seat assignment: schema + digest recomputation. Total. */
export function verifySealedSeatAssignment(sealed: unknown): EntitlementsResult<SealedSeatAssignment> {
  const parsed = SealedSeatAssignmentSchema.safeParse(sealed);
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
        message: 'sealed seat assignment digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: parsed.data.seatAssignmentId,
      },
    };
  }
  return sealSeatAssignment(content);
}

/** Compute the content digest of one seat release (canonical JSON). */
export function computeSeatReleaseDigest(content: SeatReleaseContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid seat-release content into its published record. Total. */
export function sealSeatRelease(content: unknown): EntitlementsResult<SealedSeatRelease> {
  const parsed = SeatReleaseContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: canonicalDigest(parsed.data as unknown as JsonValue) },
  };
}

/** Verify a sealed seat release: schema + digest recomputation. Total. */
export function verifySealedSeatRelease(sealed: unknown): EntitlementsResult<SealedSeatRelease> {
  const parsed = SealedSeatReleaseSchema.safeParse(sealed);
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
        message: 'sealed seat release digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: parsed.data.releaseId,
      },
    };
  }
  return sealSeatRelease(content);
}

/** The deterministic seat account of one entitlement (the fold projection). */
export interface SeatAccount {
  readonly schemaVersion: 1;
  readonly entitlementId: string;
  readonly tenantId: string;
  /** Active assignments: not covered by any release record. */
  readonly activeCount: number;
  /** Active principals, sorted ascending. */
  readonly activePrincipalIds: readonly string[];
  /** Released assignment count. */
  readonly releasedCount: number;
}

/**
 * Fold sealed seat assignments + releases into the deterministic seat
 * account of one entitlement. Input order is irrelevant (assignments sort
 * by seatAssignmentId); a release whose tenant does not match the fold
 * scope is a typed `cross-tenant-denied` rejection; a release referencing
 * an assignment of ANOTHER entitlement is a typed `validation` rejection.
 */
export function foldSeatAssignments(
  assignments: readonly SealedSeatAssignment[],
  releases: readonly SealedSeatRelease[],
  filter: { entitlementId: string; tenantId: string },
): EntitlementsResult<SeatAccount> {
  const verified: SealedSeatAssignment[] = [];
  for (const assignment of assignments) {
    const check = verifySealedSeatAssignment(assignment);
    if (!check.ok) {
      return check;
    }
    if (check.value.tenantId !== filter.tenantId) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: `seat assignment "${check.value.seatAssignmentId}" belongs to tenant "${check.value.tenantId}" but the fold is scoped to "${filter.tenantId}" (R12 multi-tenant isolation)`,
          expectedTenantId: filter.tenantId,
          encounteredTenantId: check.value.tenantId,
        },
      };
    }
    if (check.value.entitlementId === filter.entitlementId) {
      verified.push(check.value);
    }
  }
  const releasedIds = new Set<string>();
  for (const release of releases) {
    const check = verifySealedSeatRelease(release);
    if (!check.ok) {
      return check;
    }
    if (check.value.tenantId !== filter.tenantId) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: `seat release "${check.value.releaseId}" belongs to tenant "${check.value.tenantId}" but the fold is scoped to "${filter.tenantId}" (R12 multi-tenant isolation)`,
          expectedTenantId: filter.tenantId,
          encounteredTenantId: check.value.tenantId,
        },
      };
    }
    if (check.value.entitlementId === filter.entitlementId) {
      releasedIds.add(check.value.seatAssignmentId);
    }
  }
  const ordered = verified.sort((a, b) => (a.seatAssignmentId < b.seatAssignmentId ? -1 : 1));
  const active = ordered.filter((assignment) => !releasedIds.has(assignment.seatAssignmentId));
  const activePrincipalIds = active.map((assignment) => assignment.principalId).sort();
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      entitlementId: filter.entitlementId,
      tenantId: filter.tenantId,
      activeCount: active.length,
      activePrincipalIds,
      releasedCount: ordered.length - active.length,
    },
  };
}

/**
 * PURE admission of one seat-assignment candidate against the CURRENT
 * assignment/release sets and the W023 grant/revocation records:
 *
 * 1. the candidate must seal (schema + canonical content);
 * 2. the entitlement grant must exist among the supplied W023 grants
 *    (same entitlement id AND tenant) — else `unknown-entitlement`;
 * 3. the grant must not be covered by a revocation record — else
 *    `entitlement-revoked` (immediate; the W023 semantics);
 * 4. the grant must declare seat capacity — else
 *    `seat-capacity-undefined`;
 * 5. the principal must not already hold an ACTIVE seat — else
 *    `duplicate-seat-assignment`;
 * 6. the active count after admission must stay within capacity — else
 *    `seat-limit-exceeded`.
 *
 * Returns the sealed assignment; the caller appends it (facts only).
 */
export function admitSeatAssignment(input: {
  assignments: readonly SealedSeatAssignment[];
  releases: readonly SealedSeatRelease[];
  grants: readonly EntitlementGrantRecord[];
  revocations: readonly EntitlementRevokeRecord[];
  candidate: unknown;
}): EntitlementsResult<SealedSeatAssignment> {
  const sealed = sealSeatAssignment(input.candidate);
  if (!sealed.ok) {
    return sealed;
  }
  const assignment = sealed.value;

  const grantParse = EntitlementGrantRecordSchema.safeParse(
    input.grants.find((grant) => grant.entitlementId === assignment.entitlementId),
  );
  if (!grantParse.success) {
    return {
      ok: false,
      error: {
        code: 'unknown-entitlement',
        message: `entitlement "${assignment.entitlementId}" has no W023 grant record — seat capacity cannot be resolved`,
        entitlementId: assignment.entitlementId,
      },
    };
  }
  const grant = grantParse.data;
  if (grant.tenantId !== assignment.tenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: `entitlement "${assignment.entitlementId}" belongs to tenant "${grant.tenantId}" but the seat assignment is scoped to "${assignment.tenantId}" (R12)`,
        expectedTenantId: assignment.tenantId,
        encounteredTenantId: grant.tenantId,
      },
    };
  }
  const revoked = input.revocations.find((revocation) => revocation.entitlementId === assignment.entitlementId);
  if (revoked !== undefined) {
    return {
      ok: false,
      error: {
        code: 'entitlement-revoked',
        message: `entitlement "${assignment.entitlementId}" is revoked (immediate — no seat may be assigned against a revoked grant)`,
        entitlementId: assignment.entitlementId,
        revokedAt: revoked.revokedAt,
      },
    };
  }
  if (grant.seats === undefined) {
    return {
      ok: false,
      error: {
        code: 'seat-capacity-undefined',
        message: `entitlement "${assignment.entitlementId}" declares no seat capacity (the W023 grant carries no seats field)`,
        entitlementId: assignment.entitlementId,
      },
    };
  }

  const account = foldSeatAssignments(input.assignments, input.releases, {
    entitlementId: assignment.entitlementId,
    tenantId: assignment.tenantId,
  });
  if (!account.ok) {
    return account;
  }
  if (account.value.activePrincipalIds.includes(assignment.principalId)) {
    return {
      ok: false,
      error: {
        code: 'duplicate-seat-assignment',
        message: `principal "${assignment.principalId}" already holds an active seat on entitlement "${assignment.entitlementId}"`,
        entitlementId: assignment.entitlementId,
        principalId: assignment.principalId,
      },
    };
  }
  if (account.value.activeCount >= grant.seats) {
    return {
      ok: false,
      error: {
        code: 'seat-limit-exceeded',
        message: `entitlement "${assignment.entitlementId}" seat capacity is ${grant.seats} and ${account.value.activeCount} seats are already active`,
        entitlementId: assignment.entitlementId,
        seats: grant.seats,
        activeCount: account.value.activeCount,
      },
    };
  }
  return { ok: true, value: assignment };
}

/**
 * PURE admission of one seat-release candidate: the referenced assignment
 * must resolve (same entitlement, same tenant) and must be ACTIVE (not
 * already released) — else `unknown-seat-assignment` /
 * `seat-release-conflict`. Returns the sealed release.
 */
export function admitSeatRelease(input: {
  assignments: readonly SealedSeatAssignment[];
  releases: readonly SealedSeatRelease[];
  candidate: unknown;
}): EntitlementsResult<SealedSeatRelease> {
  const sealed = sealSeatRelease(input.candidate);
  if (!sealed.ok) {
    return sealed;
  }
  const release = sealed.value;
  const assignment = input.assignments.find(
    (candidate) => candidate.seatAssignmentId === release.seatAssignmentId,
  );
  const verifiedAssignment = assignment === undefined ? undefined : verifySealedSeatAssignment(assignment);
  if (verifiedAssignment === undefined || !verifiedAssignment.ok) {
    return {
      ok: false,
      error: {
        code: 'unknown-seat-assignment',
        message: `seat assignment "${release.seatAssignmentId}" does not resolve — a release can only flip a recorded assignment`,
        seatAssignmentId: release.seatAssignmentId,
      },
    };
  }
  const target = verifiedAssignment.value;
  if (target.entitlementId !== release.entitlementId || target.tenantId !== release.tenantId) {
    return {
      ok: false,
      error: {
        code: 'unknown-seat-assignment',
        message: `seat assignment "${release.seatAssignmentId}" belongs to entitlement "${target.entitlementId}" / tenant "${target.tenantId}" but the release names "${release.entitlementId}" / "${release.tenantId}"`,
        seatAssignmentId: release.seatAssignmentId,
      },
    };
  }
  const alreadyReleased = input.releases.some(
    (existing) => existing.seatAssignmentId === release.seatAssignmentId,
  );
  if (alreadyReleased) {
    return {
      ok: false,
      error: {
        code: 'seat-release-conflict',
        message: `seat assignment "${release.seatAssignmentId}" is already released — releases are append-only facts and an assignment flips inactive exactly once`,
        seatAssignmentId: release.seatAssignmentId,
      },
    };
  }
  return { ok: true, value: release };
}

/** Validate one W023 entitlement grant record through the REAL upstream validator. */
export function parseEntitlementGrantRecord(value: unknown): EntitlementsResult<EntitlementGrantRecord> {
  const parsed = EntitlementGrantRecordSchema.safeParse(value);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Validate one W023 entitlement revocation record through the REAL upstream validator. */
export function parseEntitlementRevokeRecord(value: unknown): EntitlementsResult<EntitlementRevokeRecord> {
  const parsed = EntitlementRevokeRecordSchema.safeParse(value);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}
