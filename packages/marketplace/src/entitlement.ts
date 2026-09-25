/**
 * Marketplace entitlements (architecture lock rule 11, binding):
 * "Marketplace entitlement is separate from payment processor state."
 *
 * - An entitlement is ALWAYS an explicit, Epoch-owned record: a grant with
 *   full provenance (`direct` from an Epoch-side actor, or `payment-sync`
 *   PROPOSED from a payment port's check outcome — the grant record is the
 *   authority, the payment state never is).
 * - {@link checkEntitlement} is a PURE function over Epoch-owned records
 *   ONLY: it structurally cannot read payment state, clocks, or registries.
 *   A revocation record flips the check IMMEDIATELY and totally — there are
 *   no grace-period semantics anywhere in the model (a future grace period
 *   would have to be typed data, never implicit behavior).
 * - Tenant isolation (R12): grants are scoped to the acquiring tenant; the
 *   check answers per (tenant, listing, optional workspace) query; another
 *   tenant's grants never satisfy a query (they are simply not visible to
 *   the check), while host-level reads of another tenant's records are the
 *   typed `cross-tenant-denied` rejection.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import {
  EntitlementIdSchema,
  ListingIdSchema,
  PaymentPortIdSchema,
  PrincipalIdSchema,
  RevocationIdSchema,
  Sha256HexSchema,
  TenantIdSchema,
  WorkspaceIdSchema,
} from './primitives';
import type { MarketplaceResult } from './errors';

/** The scope of an entitlement: tenant-wide or one workspace. */
export const EntitlementScopeSchema = z
  .discriminatedUnion('kind', [
    z
      .strictObject({
        kind: z.literal('tenant'),
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('workspace'),
        workspaceId: WorkspaceIdSchema,
      })
      .readonly(),
  ])
  .meta({
    id: 'EntitlementScope',
    title: 'EntitlementScope',
    description: 'Entitlement scope: tenant-wide, or narrowed to one workspace (W009 workspace id).',
  });

/** One entitlement scope. */
export type EntitlementScope = z.infer<typeof EntitlementScopeSchema>;

/**
 * The provenance of a grant: `direct` (an Epoch-side actor granted it) or
 * `payment-sync` (a payment port's CHECK outcome proposed the record —
 * payment state can AT BEST propose/sync an Epoch-owned grant; it never
 * grants by itself).
 */
export const EntitlementProvenanceSchema = z
  .discriminatedUnion('kind', [
    z
      .strictObject({
        kind: z.literal('direct'),
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('payment-sync'),
        portId: PaymentPortIdSchema,
        portReference: z.string().min(1).max(256).optional(),
      })
      .readonly(),
  ])
  .meta({
    id: 'EntitlementProvenance',
    title: 'EntitlementProvenance',
    description:
      'Grant provenance: direct (Epoch-side actor) or payment-sync (proposed from a payment port check outcome; the grant record is the authority, never the payment state).',
  });

/** One entitlement provenance. */
export type EntitlementProvenance = z.infer<typeof EntitlementProvenanceSchema>;

/**
 * One Epoch-owned entitlement grant record: tenant-scoped, attached to one
 * exact published listing version (content digest), with scope, optional
 * seat count, provenance, and the granting actor/instant. The record is
 * serialization-friendly, plain JSON.
 */
export const EntitlementGrantRecordSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    entitlementId: EntitlementIdSchema,
    tenantId: TenantIdSchema,
    listingId: ListingIdSchema,
    listingVersionDigest: Sha256HexSchema,
    scope: EntitlementScopeSchema,
    seats: z
      .number()
      .int('seats must be an integer')
      .min(1, 'seats must be at least 1')
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    grantedAt: TimestampSchema,
    grantedBy: PrincipalIdSchema,
    provenance: EntitlementProvenanceSchema,
  })
  .readonly()
  .meta({
    id: 'EntitlementGrantRecord',
    title: 'EntitlementGrantRecord',
    description:
      'One Epoch-owned entitlement grant: acquiring tenant, exact published listing version digest, scope (tenant/workspace), optional seats, grant instant/actor, and full provenance (direct or payment-sync).',
  });

/** One entitlement grant record. */
export type EntitlementGrantRecord = z.infer<typeof EntitlementGrantRecordSchema>;

/**
 * One Epoch-owned entitlement revocation record: the explicit typed record
 * whose existence flips {@link checkEntitlement} IMMEDIATELY — no grace
 * semantics (extension-architecture.md, binding).
 */
export const EntitlementRevokeRecordSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    revocationId: RevocationIdSchema,
    entitlementId: EntitlementIdSchema,
    tenantId: TenantIdSchema,
    revokedAt: TimestampSchema,
    revokedBy: PrincipalIdSchema,
    reason: z.string().max(1024).optional(),
  })
  .readonly()
  .meta({
    id: 'EntitlementRevokeRecord',
    title: 'EntitlementRevokeRecord',
    description:
      'One Epoch-owned entitlement revocation: the explicit typed record whose existence flips the entitlement check immediately (no grace-period semantics).',
  });

/** One entitlement revocation record. */
export type EntitlementRevokeRecord = z.infer<typeof EntitlementRevokeRecordSchema>;

/** The query shape checked by the pure entitlement check. */
export interface EntitlementQuery {
  readonly tenantId: string;
  readonly listingId: string;
  readonly workspaceId?: string | undefined;
}

/** The positive outcome of the pure entitlement check. */
export interface EntitlementCheckPositive {
  /** The grant that satisfies the query (latest grantedAt, ties by entitlementId). */
  readonly entitlement: EntitlementGrantRecord;
  /** How many grants matched the query (before revocation filtering). */
  readonly matchedGrantCount: number;
  /** How many matching grants are revoked (superseded, e.g. re-granted after revoke). */
  readonly revokedMatchingCount: number;
}

/**
 * The PURE entitlement check (immediate revocation at the capability
 * boundary). Inputs are Epoch-owned records ONLY — payment state is not an
 * input, structurally:
 *
 * 1. collect grants matching the query: same tenant, same listing, and a
 *    scope that covers the query (tenant-wide scope covers any workspace
 *    query; workspace scope covers only its own workspace);
 * 2. no matching grant — `entitlement-denied` (payment state cannot change
 *    this answer; only a grant record can);
 * 3. every matching grant is covered by a revocation record —
 *    `entitlement-revoked` (IMMEDIATE: the revocation flips the check the
 *    moment the record exists);
 * 4. otherwise the check passes with the deterministic witness: the LATEST
 *    grantedAt, ties broken by entitlementId ascending.
 *
 * Deterministic: no clocks, no randomness, no insertion-order dependence.
 */
export function checkEntitlement(input: {
  grants: readonly EntitlementGrantRecord[];
  revocations: readonly EntitlementRevokeRecord[];
  query: EntitlementQuery;
}): MarketplaceResult<EntitlementCheckPositive> {
  const { grants, revocations, query } = input;
  const matching = grants.filter((grant) => {
    if (grant.tenantId !== query.tenantId) return false;
    if (grant.listingId !== query.listingId) return false;
    if (grant.scope.kind === 'tenant') return true;
    return query.workspaceId !== undefined && grant.scope.workspaceId === query.workspaceId;
  });
  if (matching.length === 0) {
    return {
      ok: false,
      error: {
        code: 'entitlement-denied',
        message: `no Epoch-owned entitlement record satisfies the query (tenant "${query.tenantId}", listing "${query.listingId}") — payment state is never entitlement authority`,
        query: {
          listingId: query.listingId,
          tenantId: query.tenantId,
          workspaceId: query.workspaceId,
        },
      },
    };
  }
  const revokedIds = new Set(revocations.map((revocation) => revocation.entitlementId));
  const active = matching.filter((grant) => !revokedIds.has(grant.entitlementId));
  if (active.length === 0) {
    // Every matching grant is revoked — the check flips immediately. The
    // deterministic witness: latest revokedAt, ties by entitlementId.
    const revokedGrants = matching
      .map((grant) => {
        const revocation = revocations.find(
          (candidate) => candidate.entitlementId === grant.entitlementId,
        );
        return { grant, revocation };
      })
      .sort((a, b) => {
        const at = a.revocation?.revokedAt ?? '';
        const bt = b.revocation?.revokedAt ?? '';
        if (at !== bt) return at < bt ? 1 : -1;
        return a.grant.entitlementId < b.grant.entitlementId ? 1 : -1;
      });
    const witness = revokedGrants[0]!;
    return {
      ok: false,
      error: {
        code: 'entitlement-revoked',
        message: `entitlement "${witness.grant.entitlementId}" is revoked (immediate revocation at the Epoch capability boundary — no grace semantics)`,
        entitlementId: witness.grant.entitlementId,
        revokedAt: witness.revocation?.revokedAt ?? '',
      },
    };
  }
  const entitlement = [...active].sort((a, b) => {
    if (a.grantedAt !== b.grantedAt) return a.grantedAt < b.grantedAt ? 1 : -1;
    return a.entitlementId < b.entitlementId ? 1 : -1;
  })[0]!;
  return {
    ok: true,
    value: {
      entitlement,
      matchedGrantCount: matching.length,
      revokedMatchingCount: matching.length - active.length,
    },
  };
}
