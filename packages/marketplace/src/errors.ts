/**
 * The typed marketplace error taxonomy (W023 Tech Lead pin; mirrors the
 * issue-code style of W006/W007/W009/W010). Every entry point is total —
 * errors are values, never exceptions.
 *
 * Named codes (the dispatch pin):
 * - `unknown-listing-reference` — a listing id that does not resolve (also
 *   the privacy-preserving answer for private listings outside the
 *   visibility set — existence is not disclosed);
 * - `version-not-published` — an operation referencing a listing version
 *   that is not (yet) a published, sealed version;
 * - `entitlement-denied` — no Epoch-owned grant record satisfies the query
 *   (payment state alone can NEVER produce a different answer here);
 * - `entitlement-revoked` — a matching grant exists but an Epoch-owned
 *   revocation record flips the check immediately (no grace semantics);
 * - `cross-tenant-denied` — tenant-isolation violation (R12);
 * - `payment-port-unavailable` — a payment check with no registered port
 *   (or an unknown port id) — the adapter seam is absent, never guessed;
 * - `invalid-pricing-model` — a pricing model outside the closed vocabulary
 *   or with malformed per-model fields (precise paths carried as issues);
 * - `vendor-fields-rejected` — strict-object rejection of unknown
 *   (provider/vendor) structural fields;
 * - `digest-mismatch` — a claimed content digest that does not match the
 *   recomputed canonical SHA-256 (tamper detection), including broken
 *   version-chain links.
 *
 * Additional codes completing the taxonomy:
 * - `validation` — generic malformed-record carrier (flattened dotted-path
 *   issues; schemaVersion skew reports here at path ["schemaVersion"]);
 * - `unknown-capability-reference` — a listing version referencing a
 *   capability/version pin that does not resolve in the W007 registry
 *   (dangling references are typed rejections);
 * - `unknown-entitlement` — an entitlement id that does not resolve;
 * - `version-conflict` — publishing a version that already exists (with
 *   different content: mutation of a published version) or a version that
 *   is not semver-greater than the published head;
 * - `lifecycle-conflict` — an illegal listing-lifecycle transition;
 * - `idempotency-conflict` — the same idempotency key re-used with
 *   DIFFERENT content (duplicate suppression).
 */
import type { ListingLifecycleState } from './version';

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface MarketplaceIssue {
  readonly path: string;
  readonly message: string;
}

/** The complete marketplace error-code vocabulary. */
export type MarketplaceErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'unknown-listing-reference'
  | 'unknown-capability-reference'
  | 'unknown-entitlement'
  | 'version-not-published'
  | 'version-conflict'
  | 'lifecycle-conflict'
  | 'entitlement-denied'
  | 'entitlement-revoked'
  | 'cross-tenant-denied'
  | 'payment-port-unavailable'
  | 'invalid-pricing-model'
  | 'digest-mismatch'
  | 'idempotency-conflict';

/** The query echo carried by entitlement denials (never a payment echo). */
export interface EntitlementQueryEcho {
  readonly listingId: string;
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
}

/** The typed marketplace error taxonomy (values, never thrown). */
export type MarketplaceError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly MarketplaceIssue[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly MarketplaceIssue[];
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'unknown-listing-reference';
      readonly message: string;
      readonly listingId: string;
    }
  | {
      readonly code: 'unknown-capability-reference';
      readonly message: string;
      readonly capabilityId: string;
      readonly version: string;
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'unknown-entitlement';
      readonly message: string;
      readonly entitlementId: string;
    }
  | {
      readonly code: 'version-not-published';
      readonly message: string;
      readonly listingId: string;
      readonly encounteredVersion?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'version-conflict';
      readonly message: string;
      readonly listingId: string;
      readonly version: string;
      readonly publishedDigest?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly listingId: string;
      readonly from: ListingLifecycleState;
      readonly to: ListingLifecycleState;
    }
  | {
      readonly code: 'entitlement-denied';
      readonly message: string;
      readonly query: EntitlementQueryEcho;
    }
  | {
      readonly code: 'entitlement-revoked';
      readonly message: string;
      readonly entitlementId: string;
      readonly revokedAt: string;
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
    }
  | {
      readonly code: 'payment-port-unavailable';
      readonly message: string;
      readonly portId?: string | undefined;
    }
  | {
      readonly code: 'invalid-pricing-model';
      readonly message: string;
      readonly issues: readonly MarketplaceIssue[];
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'idempotency-conflict';
      readonly message: string;
      readonly idempotencyKey: string;
      readonly boundDigest: string;
      readonly encounteredDigest: string;
    };

/** Result of a marketplace operation: a value or a typed error. */
export type MarketplaceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MarketplaceError };
