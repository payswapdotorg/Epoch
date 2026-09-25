/**
 * The Marketplace HOST (service layer, W023): the long-running in-memory
 * reference model.
 *
 * - **Listing lifecycle sessions** — draft -> submitted -> published;
 *   publication seals the immutable, hash-chained version (real
 *   @epoch/marketplace kernel consumption: pricing validation, trust
 *   evidence admission, W007 capability-reference resolution against a real
 *   CapabilityRegistry, sealing, chain verification). Re-publishing the
 *   same version with identical content is an idempotent no-op
 *   (`duplicate: true`); different content is the typed `version-conflict`
 *   (mutation of a published version).
 * - **Entitlement evaluation sessions** — grant/revoke transitions with
 *   full provenance (direct or payment-sync); the check is the kernel's
 *   PURE function (payment state is NEVER authority — lock rule 11), and
 *   revocation flips it IMMEDIATELY.
 * - **Payment port registration + check passthrough** — typed
 *   `payment-port-unavailable` when the seam is absent.
 * - **Usage metering intake** — idempotent, duplicate-suppressed (same
 *   key + same event content returns the ORIGINAL receipt; same key with
 *   different content is the typed `idempotency-conflict`); one W010-shaped
 *   event stream per entitlement.
 * - **Developer revenue records** — record-keeping only, tenant-scoped on
 *   both sides, idempotent intake.
 * - **Tenant isolation (R12)** — every read/write is tenant-scoped;
 *   cross-tenant access is the typed `cross-tenant-denied` rejection.
 *   Private listings are invisible to out-of-audience tenants (existence is
 *   not disclosed — `unknown-listing-reference`).
 * - **Health/liveness as typed data** — a pure state projection: no wall
 *   clock, no randomness, deterministic key order.
 *
 * In-memory reference behavior only: NO persistence, NO network, NO real
 * processes (later Work Orders add those behind this seam).
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { CapabilityRegistry, compareSemver } from '@epoch/capability-registry';
import {
  admitCapabilityReferences,
  checkEntitlement,
  foldUsageEvents,
  parseEntitlementGrant,
  parseEntitlementRevoke,
  sealListingVersion,
  sealUsageEvent,
  usageStreamIdOf,
  validateRevenueRecord,
  verifyListingVersionChain,
  LISTING_LIFECYCLE_STATES,
  LISTING_LIFECYCLE_TRANSITIONS,
  LISTING_VERSION_SCHEMA_NAME,
  MARKETPLACE_CONTRACT_VERSION,
  MARKETPLACE_RECORD_VERSION,
  PAYMENT_PORT_ID_PATTERN,
  type CapabilityVersionResolver,
  type EntitlementCheckPositive,
  type EntitlementGrantRecord,
  type EntitlementRevokeRecord,
  type ListingLifecycleState,
  type MarketplaceError,
  type MarketplaceResult,
  type PaymentCheckOutcome,
  type PaymentPort,
  type RevenueRecord,
  type SealedListingVersion,
  type SealedUsageEvent,
} from '@epoch/marketplace';
import {
  HOST_RECORD_VERSION,
  IDEMPOTENCY_KEY_PATTERN,
  MARKETPLACE_HOST_SERVICE_NAME,
} from './version';
import type {
  CheckEntitlementInput,
  CreateListingInput,
  EntitlementGrantReceipt,
  EntitlementRevokeReceipt,
  GrantEntitlementInput,
  HealthReport,
  HostPaymentCheckInput,
  HostResult,
  IdempotencyKey,
  ListingChainSummary,
  ListingCreationReceipt,
  ListingDraftInput,
  ListingLifecycleInput,
  ListingSnapshot,
  ListingVersionInput,
  ListListingsInput,
  ListRevenueInput,
  PublishListingVersionInput,
  PublicationReceipt,
  RecordRevenueInput,
  RecordUsageInput,
  RevenueRecordReceipt,
  RevokeEntitlementInput,
  ServiceDescription,
  SyncEntitlementInput,
  UpdateDraftInput,
  UsageAccountInput,
  UsageAccountProjection,
  UsageRecordReceipt,
} from './types';

/** Internal listing session record: the draft plus in-memory state. */
interface ListingSession {
  readonly listingId: string;
  readonly developerTenantId: string;
  readonly idempotencyKey: IdempotencyKey;
  draft: ListingDraftInput;
  draftDigest: string;
  lifecycle: ListingLifecycleState;
  /** Published sealed versions in publication order (append-only). */
  versions: SealedListingVersion[];
}

/** Options of {@link MarketplaceHost.create}. */
export interface MarketplaceHostOptions {
  /**
   * The W007 registry capability references resolve against (defaults to a
   * fresh private registry). Real W007 consumption; the host never
   * recreates the registry's authority.
   */
  readonly registry?: CapabilityVersionResolver | undefined;
}

const EPOCH_INSTANT = '1970-01-01T00:00:00.000Z';

function ok<T>(value: T): HostResult<T> {
  return { ok: true, value };
}

function fail<T>(error: MarketplaceError): HostResult<T> {
  return { ok: false, error };
}

function crossTenant(expectedTenantId: string, encounteredTenantId: string): MarketplaceError {
  return {
    code: 'cross-tenant-denied',
    message:
      `record belongs to tenant "${encounteredTenantId}" but the caller acts for ` +
      `"${expectedTenantId}" (R12 multi-tenant isolation)`,
    expectedTenantId,
    encounteredTenantId,
  };
}

function unknownListing(listingId: string): MarketplaceError {
  return {
    code: 'unknown-listing-reference',
    message: `no marketplace listing "${listingId}" is visible to the caller (unknown or private-out-of-audience)`,
    listingId,
  };
}

function badIdempotencyKey(key: string): MarketplaceError {
  return {
    code: 'validation',
    message: `idempotency key "${key}" does not match the typed key grammar`,
    issues: [
      {
        path: 'idempotencyKey',
        message: 'must match /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/',
      },
    ],
  };
}

/** The closed key set of the listing draft input (strict-object discipline). */
const DRAFT_KEYS = new Set([
  'displayName',
  'description',
  'capabilityReferences',
  'pricing',
  'trustEvidence',
  'visibility',
  'privateAllowList',
]);

/** Derive a deterministic kind-prefixed slug id from digest input. */
function deriveSlugId(prefix: string, input: Record<string, unknown>): string {
  return `${prefix}:${canonicalDigest(input as unknown as JsonValue).slice(0, 16)}`;
}

/**
 * The in-memory marketplace host. Construct with
 * `MarketplaceHost.create()`.
 */
export class MarketplaceHost {
  private readonly listings = new Map<string, ListingSession>();
  private readonly listingByKey = new Map<IdempotencyKey, string>();
  private readonly grants = new Map<string, EntitlementGrantRecord>();
  private readonly grantByKey = new Map<IdempotencyKey, string>();
  private readonly revocations = new Map<string, EntitlementRevokeRecord>();
  private readonly revocationsByEntitlement = new Map<string, EntitlementRevokeRecord[]>();
  private readonly usageEvents = new Map<string, SealedUsageEvent[]>();
  private readonly usageByKey = new Map<
    IdempotencyKey,
    { inputDigest: string; receipt: UsageRecordReceipt }
  >();
  private readonly revenueRecords = new Map<string, RevenueRecord>();
  private readonly revenueByKey = new Map<IdempotencyKey, string>();
  private readonly ports = new Map<string, PaymentPort>();
  private readonly registry: CapabilityVersionResolver;

  private constructor(registry: CapabilityVersionResolver) {
    this.registry = registry;
  }

  /** Create an empty host (optionally with a provided W007 registry). */
  static create(options: MarketplaceHostOptions = {}): MarketplaceHost {
    return new MarketplaceHost(options.registry ?? new CapabilityRegistry());
  }

  // ------------------------------------------------------------------
  // Listing lifecycle sessions
  // ------------------------------------------------------------------

  /**
   * Create a listing draft session (idempotent): the listing id is derived
   * from (idempotencyKey, developer tenant); the draft fields are validated
   * through the kernel listing-version admission (pricing, trust evidence,
   * canonical ordering). The same (key, draft) returns the same listing
   * with `duplicate: true`; the same key with a different draft is the
   * typed `idempotency-conflict`.
   */
  createListing(input: CreateListingInput): HostResult<ListingCreationReceipt> {
    if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) {
      return fail(badIdempotencyKey(input.idempotencyKey));
    }
    const listingId = deriveSlugId('listing', {
      idempotencyKey: input.idempotencyKey,
      developerTenantId: input.asTenant,
    });
    const draftDigest = this.draftDigestOf(input.draft);
    const existing = this.listings.get(listingId);
    if (existing !== undefined) {
      if (existing.draftDigest === draftDigest) {
        return ok({
          schemaVersion: HOST_RECORD_VERSION,
          listingId,
          lifecycle: existing.lifecycle,
          draftDigest,
          duplicate: true,
        });
      }
      return fail({
        code: 'idempotency-conflict',
        message: `idempotency key "${input.idempotencyKey}" is bound to a different draft (digest ${existing.draftDigest} != ${draftDigest})`,
        idempotencyKey: input.idempotencyKey,
        boundDigest: existing.draftDigest,
        encounteredDigest: draftDigest,
      });
    }
    const validated = this.validateDraft(listingId, input.asTenant, input.draft);
    if (!validated.ok) {
      return validated;
    }
    this.listings.set(listingId, {
      listingId,
      developerTenantId: input.asTenant,
      idempotencyKey: input.idempotencyKey,
      draft: input.draft,
      draftDigest,
      lifecycle: 'draft',
      versions: [],
    });
    this.listingByKey.set(input.idempotencyKey, listingId);
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      listingId,
      lifecycle: 'draft',
      draftDigest,
      duplicate: false,
    });
  }

  /** Update the mutable draft fields of a listing (any state but retired). */
  updateDraft(input: UpdateDraftInput): HostResult<ListingCreationReceipt> {
    const session = this.listings.get(input.listingId);
    if (session === undefined) {
      return fail(unknownListing(input.listingId));
    }
    if (session.developerTenantId !== input.asTenant) {
      return fail(crossTenant(input.asTenant, session.developerTenantId));
    }
    if (session.lifecycle === 'retired') {
      return fail({
        code: 'lifecycle-conflict',
        message: `retired listings cannot be edited (legal transitions: none)`,
        listingId: input.listingId,
        from: 'retired',
        to: 'retired',
      });
    }
    const draftDigest = this.draftDigestOf(input.draft);
    const validated = this.validateDraft(input.listingId, input.asTenant, input.draft);
    if (!validated.ok) {
      return validated;
    }
    session.draft = input.draft;
    session.draftDigest = draftDigest;
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      listingId: input.listingId,
      lifecycle: session.lifecycle,
      draftDigest,
      duplicate: false,
    });
  }

  /** Submit a listing for publication (draft -> submitted). */
  submitListing(input: ListingLifecycleInput): HostResult<ListingSnapshot> {
    return this.transitionListing(input, 'submitted');
  }

  /** Retire a published listing (published -> retired). */
  retireListing(input: ListingLifecycleInput): HostResult<ListingSnapshot> {
    return this.transitionListing(input, 'retired');
  }

  private transitionListing(
    input: ListingLifecycleInput,
    to: ListingLifecycleState,
  ): HostResult<ListingSnapshot> {
    const session = this.listings.get(input.listingId);
    if (session === undefined) {
      return fail(unknownListing(input.listingId));
    }
    if (session.developerTenantId !== input.asTenant) {
      return fail(crossTenant(input.asTenant, session.developerTenantId));
    }
    const legal = LISTING_LIFECYCLE_TRANSITIONS[session.lifecycle];
    if (!legal.includes(to)) {
      return fail({
        code: 'lifecycle-conflict',
        message: `illegal listing lifecycle transition ${session.lifecycle} -> ${to} for "${input.listingId}" (legal transitions: ${legal.join(', ') || 'none'})`,
        listingId: input.listingId,
        from: session.lifecycle,
        to,
      });
    }
    session.lifecycle = to;
    return ok(this.snapshotOf(session));
  }

  /**
   * Publish the next immutable version (publication seals the sealed
   * envelope). Idempotent: publishing the head version with IDENTICAL
   * content returns `duplicate: true`; different content at the same
   * version is the typed `version-conflict` (mutation of a published
   * version), and a version below the head is `version-conflict` too.
   */
  publishListingVersion(input: PublishListingVersionInput): HostResult<PublicationReceipt> {
    const session = this.listings.get(input.listingId);
    if (session === undefined) {
      return fail(unknownListing(input.listingId));
    }
    if (session.developerTenantId !== input.asTenant) {
      return fail(crossTenant(input.asTenant, session.developerTenantId));
    }
    if (session.lifecycle !== 'submitted' && session.lifecycle !== 'published') {
      return fail({
        code: 'lifecycle-conflict',
        message: `listing "${input.listingId}" is in state "${session.lifecycle}"; publication requires "submitted" or "published" (draft -> submitted -> published)`,
        listingId: input.listingId,
        from: session.lifecycle,
        to: 'published',
      });
    }
    const head = session.versions[session.versions.length - 1];
    if (head !== undefined) {
      if (head.version === input.version) {
        // Replay detection: rebuild the envelope at the ORIGINAL chain
        // position (the head's own link) — identical inputs yield the
        // identical digest and are an idempotent no-op; different content
        // at the same version is the mutation rejection.
        const replay = this.sealFor(session, input, head.previousVersionDigest);
        if (replay.ok && replay.value.contentDigest === head.contentDigest) {
          return ok({
            schemaVersion: HOST_RECORD_VERSION,
            listingId: input.listingId,
            version: head.version,
            contentDigest: head.contentDigest,
            previousVersionDigest: head.previousVersionDigest,
            chainLength: session.versions.length,
            duplicate: true,
          });
        }
        return fail({
          code: 'version-conflict',
          message: `version "${input.version}" of listing "${input.listingId}" is already published with different content — a published version is immutable; changed content ships as a NEW version`,
          listingId: input.listingId,
          version: input.version,
          publishedDigest: head.contentDigest,
          encounteredDigest: replay.ok ? replay.value.contentDigest : undefined,
        });
      }
      if (this.versionCompare(input.version, head.version) <= 0) {
        return fail({
          code: 'version-conflict',
          message: `version "${input.version}" is not greater than the published head "${head.version}" of listing "${input.listingId}" — publication order is strictly ascending`,
          listingId: input.listingId,
          version: input.version,
          publishedDigest: head.contentDigest,
        });
      }
    }
    const link = head === undefined ? null : head.contentDigest;
    const sealed = this.sealFor(session, input, link);
    if (!sealed.ok) {
      return sealed;
    }
    // Dangling capability references are typed rejections (W007 vocabulary).
    const admitted = admitCapabilityReferences(
      sealed.value.capabilityReferences,
      this.registry,
    );
    if (!admitted.ok) {
      return fail(admitted.error);
    }
    // Chain integrity is verified BEFORE the state commits.
    const chain = verifyListingVersionChain([...session.versions, sealed.value]);
    if (!chain.ok) {
      return fail(chain.error);
    }
    session.versions.push(sealed.value);
    session.lifecycle = 'published';
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      listingId: input.listingId,
      version: sealed.value.version,
      contentDigest: sealed.value.contentDigest,
      previousVersionDigest: sealed.value.previousVersionDigest,
      chainLength: session.versions.length,
      duplicate: false,
    });
  }

  /** Build + seal a version content from the session's draft (explicit chain link). */
  private sealFor(
    session: ListingSession,
    input: PublishListingVersionInput,
    link: string | null,
  ): HostResult<SealedListingVersion> {
    return sealListingVersion({
      schema: LISTING_VERSION_SCHEMA_NAME,
      schemaVersion: MARKETPLACE_RECORD_VERSION,
      listingId: session.listingId,
      version: input.version,
      developerTenantId: session.developerTenantId,
      displayName: session.draft.displayName,
      description: session.draft.description,
      capabilityReferences: session.draft.capabilityReferences,
      pricing: session.draft.pricing,
      trustEvidence: session.draft.trustEvidence,
      visibility: session.draft.visibility,
      privateAllowList: session.draft.privateAllowList ?? [],
      previousVersionDigest: link,
      publishedAt: input.publishedAt,
    });
  }

  /** Validate draft fields by sealing a probe version (kernel admission). */
  private validateDraft(
    listingId: string,
    developerTenantId: string,
    draft: ListingDraftInput,
  ): HostResult<true> {
    // Unknown (vendor/provider) keys on the draft input are rejected at
    // the host boundary (strict-object discipline).
    const unknownKeys = Object.keys(draft).filter((key) => !DRAFT_KEYS.has(key));
    if (unknownKeys.length > 0) {
      return fail({
        code: 'vendor-fields-rejected',
        message:
          'draft carries unknown structural fields — provider/vendor fields cannot enter marketplace records (strict objects; adapterize provider semantics behind the PaymentPort seam instead)',
        issues: unknownKeys.map((key) => ({
          path: key,
          message: `unknown draft field "${key}"`,
        })),
        path: ['draft', unknownKeys[0]!],
      });
    }
    const probe = sealListingVersion({
      schema: LISTING_VERSION_SCHEMA_NAME,
      schemaVersion: MARKETPLACE_RECORD_VERSION,
      listingId,
      version: '0.0.0',
      developerTenantId,
      displayName: draft.displayName,
      description: draft.description,
      capabilityReferences: draft.capabilityReferences,
      pricing: draft.pricing,
      trustEvidence: draft.trustEvidence,
      visibility: draft.visibility,
      privateAllowList: draft.privateAllowList ?? [],
      previousVersionDigest: null,
      publishedAt: EPOCH_INSTANT,
    });
    if (!probe.ok) {
      return fail(probe.error);
    }
    return ok(true);
  }

  /** Canonical digest of the draft fields (idempotency comparison). */
  private draftDigestOf(draft: ListingDraftInput): string {
    return canonicalDigest(draft as unknown as JsonValue);
  }

  /** Semver-core comparison (the W007 comparator, imported directly). */
  private versionCompare(a: string, b: string): number {
    return compareSemver(a, b);
  }

  // ------------------------------------------------------------------
  // Tenant-scoped reads
  // ------------------------------------------------------------------

  /** Whether a listing is visible to the acting tenant (R12). */
  private visibleTo(session: ListingSession, asTenant: string): boolean {
    if (session.draft.visibility === 'public') {
      return true;
    }
    if (session.developerTenantId === asTenant) {
      return true;
    }
    return (session.draft.privateAllowList ?? []).includes(asTenant);
  }

  private requireVisibleListing(listingId: string, asTenant: string): HostResult<ListingSession> {
    const session = this.listings.get(listingId);
    if (session === undefined) {
      return fail(unknownListing(listingId));
    }
    if (!this.visibleTo(session, asTenant)) {
      // Privacy: a private listing outside the audience does not exist.
      return fail(unknownListing(listingId));
    }
    return ok(session);
  }

  /** One listing snapshot (tenant-scoped; private listings are hidden). */
  getListing(input: ListingLifecycleInput): HostResult<ListingSnapshot> {
    const session = this.listings.get(input.listingId);
    if (session === undefined || !this.visibleTo(session, input.asTenant)) {
      return fail(unknownListing(input.listingId));
    }
    return ok(this.snapshotOf(session));
  }

  /** The tenant-visible catalog, sorted by listingId ascending. */
  listListings(input: ListListingsInput): readonly ListingSnapshot[] {
    const snapshots: ListingSnapshot[] = [];
    const ids = [...this.listings.keys()].sort();
    for (const id of ids) {
      const session = this.listings.get(id)!;
      if (session.lifecycle !== 'retired' && this.visibleTo(session, input.asTenant)) {
        snapshots.push(this.snapshotOf(session));
      }
    }
    return snapshots;
  }

  /**
   * One published version (by version pin or content digest), digest-
   * verified (tamper detection). Tenant visibility applies.
   */
  getListingVersion(input: ListingVersionInput): HostResult<SealedListingVersion> {
    if (input.version === undefined && input.contentDigest === undefined) {
      return fail({
        code: 'validation',
        message: 'a version pin or a content digest is required',
        issues: [{ path: 'version', message: 'version or contentDigest must be provided' }],
      });
    }
    const session = this.listings.get(input.listingId);
    if (session === undefined || !this.visibleTo(session, input.asTenant)) {
      return fail(unknownListing(input.listingId));
    }
    for (const sealed of session.versions) {
      if (input.version !== undefined && sealed.version !== input.version) continue;
      if (input.contentDigest !== undefined && sealed.contentDigest !== input.contentDigest) continue;
      // Tamper detection on the stored envelope (defense in depth).
      const chain = verifyListingVersionChain(session.versions);
      if (!chain.ok) {
        return fail(chain.error);
      }
      return ok(sealed);
    }
    return fail({
      code: 'version-not-published',
      message: `listing "${input.listingId}" has no published version matching the request`,
      listingId: input.listingId,
      encounteredVersion: input.version,
      encounteredDigest: input.contentDigest,
    });
  }

  /** The verified publication chain summary of one listing. */
  verifyListingChain(input: ListingLifecycleInput): HostResult<ListingChainSummary> {
    const session = this.listings.get(input.listingId);
    if (session === undefined || !this.visibleTo(session, input.asTenant)) {
      return fail(unknownListing(input.listingId));
    }
    const chain = verifyListingVersionChain(session.versions);
    if (!chain.ok) {
      return fail(chain.error);
    }
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      listingId: chain.value.listingId,
      versionCount: chain.value.versionCount,
      headVersion: chain.value.headVersion,
      headDigest: chain.value.headDigest,
    });
  }

  private snapshotOf(session: ListingSession): ListingSnapshot {
    const head = session.versions[session.versions.length - 1];
    return {
      schemaVersion: HOST_RECORD_VERSION,
      listingId: session.listingId,
      developerTenantId: session.developerTenantId,
      lifecycle: session.lifecycle,
      visibility: session.draft.visibility,
      displayName: session.draft.displayName,
      publishedVersionCount: session.versions.length,
      headVersion: head === undefined ? null : head.version,
      headDigest: head === undefined ? null : head.contentDigest,
    };
  }

  // ------------------------------------------------------------------
  // Entitlement evaluation sessions
  // ------------------------------------------------------------------

  /** Resolve the exact published version digest a grant targets. */
  private resolveVersionDigest(
    session: ListingSession,
    requested: string | undefined,
  ): HostResult<string> {
    const head = session.versions[session.versions.length - 1];
    if (head === undefined) {
      return fail({
        code: 'version-not-published',
        message: `listing "${session.listingId}" has no published version to entitle`,
        listingId: session.listingId,
      });
    }
    if (requested === undefined) {
      return ok(head.contentDigest);
    }
    for (const sealed of session.versions) {
      if (sealed.contentDigest === requested) {
        return ok(requested);
      }
    }
    return fail({
      code: 'version-not-published',
      message: `digest "${requested}" is not a published version of listing "${session.listingId}"`,
      listingId: session.listingId,
      encounteredDigest: requested,
    });
  }

  /** Store a validated grant record (idempotent by content identity). */
  private storeGrant(record: EntitlementGrantRecord, idempotencyKey: string): HostResult<EntitlementGrantReceipt> {
    const existing = this.grants.get(record.entitlementId);
    if (existing !== undefined) {
      const existingDigest = canonicalDigest(existing as unknown as JsonValue);
      const encounteredDigest = canonicalDigest(record as unknown as JsonValue);
      if (existingDigest === encounteredDigest) {
        return ok({ schemaVersion: HOST_RECORD_VERSION, entitlement: existing, duplicate: true });
      }
      return fail({
        code: 'idempotency-conflict',
        message: `idempotency key "${idempotencyKey}" is bound to a different grant record`,
        idempotencyKey,
        boundDigest: existingDigest,
        encounteredDigest,
      });
    }
    this.grants.set(record.entitlementId, record);
    this.grantByKey.set(idempotencyKey, record.entitlementId);
    return ok({ schemaVersion: HOST_RECORD_VERSION, entitlement: record, duplicate: false });
  }

  /**
   * Grant an entitlement (an explicit Epoch-owned record with direct
   * provenance). Idempotent: the entitlement id derives from the
   * idempotency key + grant inputs; identical records return the original
   * with `duplicate: true`.
   */
  grantEntitlement(input: GrantEntitlementInput): HostResult<EntitlementGrantReceipt> {
    if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) {
      return fail(badIdempotencyKey(input.idempotencyKey));
    }
    const session = this.listings.get(input.listingId);
    if (session === undefined || !this.visibleTo(session, input.asTenant)) {
      return fail(unknownListing(input.listingId));
    }
    const versionDigest = this.resolveVersionDigest(session, input.listingVersionDigest);
    if (!versionDigest.ok) {
      return fail(versionDigest.error);
    }
    const entitlementId = deriveSlugId('entitlement', {
      idempotencyKey: input.idempotencyKey,
      tenantId: input.asTenant,
      listingId: input.listingId,
      listingVersionDigest: versionDigest.value,
    });
    const recordInput = {
      schemaVersion: 1,
      entitlementId,
      tenantId: input.asTenant,
      listingId: input.listingId,
      listingVersionDigest: versionDigest.value,
      scope: input.scope,
      seats: input.seats,
      grantedAt: input.grantedAt,
      grantedBy: input.grantedBy,
      provenance: { kind: 'direct' },
    } as const;
    const parsed = parseEntitlementGrant(recordInput);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    return this.storeGrant(parsed.value, input.idempotencyKey);
  }

  /**
   * Revoke an entitlement: the explicit typed record whose existence flips
   * the check IMMEDIATELY. Idempotent: an identical re-revocation returns
   * the original with `duplicate: true`.
   */
  revokeEntitlement(input: RevokeEntitlementInput): HostResult<EntitlementRevokeReceipt> {
    const grant = this.grants.get(input.entitlementId);
    if (grant === undefined) {
      return fail({
        code: 'unknown-entitlement',
        message: `no entitlement "${input.entitlementId}" is known to this host`,
        entitlementId: input.entitlementId,
      });
    }
    if (grant.tenantId !== input.asTenant) {
      return fail(crossTenant(input.asTenant, grant.tenantId));
    }
    const revocationId = deriveSlugId('revocation', {
      entitlementId: input.entitlementId,
      revokedAt: input.revokedAt,
      revokedBy: input.revokedBy,
      reason: input.reason ?? null,
    });
    const recordInput = {
      schemaVersion: 1,
      revocationId,
      entitlementId: input.entitlementId,
      tenantId: input.asTenant,
      revokedAt: input.revokedAt,
      revokedBy: input.revokedBy,
      reason: input.reason,
    } as const;
    const parsed = parseEntitlementRevoke(recordInput);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    const existing = this.revocations.get(revocationId);
    if (existing !== undefined) {
      const existingDigest = canonicalDigest(existing as unknown as JsonValue);
      const encounteredDigest = canonicalDigest(parsed.value as unknown as JsonValue);
      if (existingDigest === encounteredDigest) {
        return ok({ schemaVersion: HOST_RECORD_VERSION, revocation: existing, duplicate: true });
      }
      return fail({
        code: 'idempotency-conflict',
        message: `revocation inputs collide on id "${revocationId}" with different content`,
        idempotencyKey: revocationId,
        boundDigest: existingDigest,
        encounteredDigest,
      });
    }
    this.revocations.set(revocationId, parsed.value);
    const forEntitlement = this.revocationsByEntitlement.get(input.entitlementId) ?? [];
    forEntitlement.push(parsed.value);
    this.revocationsByEntitlement.set(input.entitlementId, forEntitlement);
    return ok({ schemaVersion: HOST_RECORD_VERSION, revocation: parsed.value, duplicate: false });
  }

  /**
   * Evaluate an entitlement (the kernel's PURE check over host state —
   * payment state is not an input, structurally).
   */
  checkEntitlementHost(input: CheckEntitlementInput): MarketplaceResult<EntitlementCheckPositive> {
    return checkEntitlement({
      grants: [...this.grants.values()],
      revocations: [...this.revocations.values()],
      query: {
        tenantId: input.asTenant,
        listingId: input.listingId,
        workspaceId: input.workspaceId,
      },
    });
  }

  /**
   * Sync an entitlement from a payment check outcome: the port's settled /
   * not-required outcome PROPOSES an Epoch-owned grant record with
   * payment-sync provenance (the record is the authority; the payment
   * state never is). Other port results are the typed
   * `entitlement-denied` — payment state alone never grants.
   */
  syncEntitlementFromPayment(input: SyncEntitlementInput): HostResult<EntitlementGrantReceipt> {
    if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) {
      return fail(badIdempotencyKey(input.idempotencyKey));
    }
    const session = this.listings.get(input.listingId);
    if (session === undefined || !this.visibleTo(session, input.asTenant)) {
      return fail(unknownListing(input.listingId));
    }
    const versionDigest = this.resolveVersionDigest(session, input.listingVersionDigest);
    if (!versionDigest.ok) {
      return fail(versionDigest.error);
    }
    const port = this.ports.get(input.portId);
    if (port === undefined) {
      return fail({
        code: 'payment-port-unavailable',
        message: `no payment port "${input.portId}" is registered with this host (the adapter seam is absent, never guessed)`,
        portId: input.portId,
      });
    }
    const head = session.versions[session.versions.length - 1]!;
    const outcome = port.checkPayment({
      listingId: input.listingId,
      listingVersionDigest: versionDigest.value,
      tenantId: input.asTenant,
      pricing: head.pricing,
    });
    if (!outcome.ok) {
      return fail(outcome.error);
    }
    if (outcome.value.result !== 'settled' && outcome.value.result !== 'not-required') {
      return fail({
        code: 'entitlement-denied',
        message: `payment port "${input.portId}" reported "${outcome.value.result}" — payment state never authorizes an entitlement; only an Epoch-owned grant record does`,
        query: {
          listingId: input.listingId,
          tenantId: input.asTenant,
        },
      });
    }
    const entitlementId = deriveSlugId('entitlement', {
      idempotencyKey: input.idempotencyKey,
      tenantId: input.asTenant,
      listingId: input.listingId,
      listingVersionDigest: versionDigest.value,
    });
    const recordInput = {
      schemaVersion: 1,
      entitlementId,
      tenantId: input.asTenant,
      listingId: input.listingId,
      listingVersionDigest: versionDigest.value,
      scope: input.scope,
      seats: input.seats,
      grantedAt: input.grantedAt,
      grantedBy: input.grantedBy,
      provenance: {
        kind: 'payment-sync',
        portId: input.portId,
        portReference: outcome.value.portReference,
      },
    } as const;
    const parsed = parseEntitlementGrant(recordInput);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    return this.storeGrant(parsed.value, input.idempotencyKey);
  }

  // ------------------------------------------------------------------
  // Payment port seam
  // ------------------------------------------------------------------

  /** Register a payment port adapter (the provider-neutral seam). */
  registerPaymentPort(port: PaymentPort): HostResult<true> {
    if (!PAYMENT_PORT_ID_PATTERN.test(port.portId)) {
      return fail({
        code: 'validation',
        message: `payment port id "${port.portId}" does not match the typed port grammar`,
        issues: [{ path: 'portId', message: 'must match /^port:[a-z0-9][a-z0-9-]{0,62}$/' }],
      });
    }
    this.ports.set(port.portId, port);
    return ok(true);
  }

  /** The payment check passthrough (typed data; never an entitlement). */
  checkPaymentHost(input: HostPaymentCheckInput): HostResult<PaymentCheckOutcome> {
    const session = this.listings.get(input.listingId);
    if (session === undefined || !this.visibleTo(session, input.asTenant)) {
      return fail(unknownListing(input.listingId));
    }
    const versionDigest = this.resolveVersionDigest(session, input.listingVersionDigest);
    if (!versionDigest.ok) {
      return fail(versionDigest.error);
    }
    const port = this.ports.get(input.portId);
    if (port === undefined) {
      return fail({
        code: 'payment-port-unavailable',
        message: `no payment port "${input.portId}" is registered with this host (the adapter seam is absent, never guessed)`,
        portId: input.portId,
      });
    }
    const head = session.versions[session.versions.length - 1]!;
    return port.checkPayment({
      listingId: input.listingId,
      listingVersionDigest: versionDigest.value,
      tenantId: input.asTenant,
      pricing: head.pricing,
    });
  }

  // ------------------------------------------------------------------
  // Usage metering intake
  // ------------------------------------------------------------------

  /**
   * Record metered usage (idempotent, duplicate-suppressed): one
   * W010-shaped event per unit of metered data, appended to the
   * entitlement's stream. The entitlement must be ACTIVE (the pure check —
   * a revocation flips it IMMEDIATELY). Idempotency keys bind the INPUT
   * identity (the W028 pattern): the same (key, input) returns the
   * ORIGINAL receipt with `duplicate: true` (no second event, no state
   * change); the same key with different input is the typed
   * `idempotency-conflict`.
   */
  recordUsage(input: RecordUsageInput): HostResult<UsageRecordReceipt> {
    if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) {
      return fail(badIdempotencyKey(input.idempotencyKey));
    }
    const grant = this.grants.get(input.entitlementId);
    if (grant === undefined) {
      return fail({
        code: 'unknown-entitlement',
        message: `no entitlement "${input.entitlementId}" is known to this host`,
        entitlementId: input.entitlementId,
      });
    }
    if (grant.tenantId !== input.asTenant) {
      return fail(crossTenant(input.asTenant, grant.tenantId));
    }
    // The entitlement must be active at intake (immediate revocation).
    const active = checkEntitlement({
      grants: [...this.grants.values()],
      revocations: [...this.revocations.values()],
      query: { tenantId: input.asTenant, listingId: grant.listingId },
    });
    if (!active.ok) {
      return fail(active.error);
    }
    // Idempotency keys bind the INPUT identity, checked BEFORE any state
    // change (duplicate suppression — the W028 pattern).
    const bound = this.usageByKey.get(input.idempotencyKey);
    if (bound !== undefined) {
      const encounteredDigest = this.usageInputDigestOf(input);
      if (bound.inputDigest === encounteredDigest) {
        return ok({ ...bound.receipt, duplicate: true });
      }
      return fail({
        code: 'idempotency-conflict',
        message: `idempotency key "${input.idempotencyKey}" is bound to different usage input (digest ${bound.inputDigest} != ${encounteredDigest})`,
        idempotencyKey: input.idempotencyKey,
        boundDigest: bound.inputDigest,
        encounteredDigest,
      });
    }
    const streamId = usageStreamIdOf(input.entitlementId);
    const events = this.usageEvents.get(input.entitlementId) ?? [];
    const last = events[events.length - 1];
    // The payload data must be a pure JSON record: optional keys are
    // OMITTED (never carried as undefined) so the generic event-payload
    // record validation holds (the W010 JsonValue discipline).
    const data: Record<string, unknown> = {
      entitlementId: input.entitlementId,
      listingId: grant.listingId,
      listingVersionDigest: grant.listingVersionDigest,
      units: input.units,
      meteredAt: input.meteredAt,
    };
    if (input.unitName !== undefined) {
      data['unitName'] = input.unitName;
    }
    const eventInput = {
      schemaVersion: 1,
      streamId,
      sequence: events.length + 1,
      tenantId: input.asTenant,
      actor: input.actor,
      causalParent: last === undefined ? null : { streamId, sequence: last.sequence },
      payload: {
        discriminator: 'marketplace:usage',
        data,
      },
      occurredAt: input.meteredAt,
    } as const;
    const sealed = sealUsageEvent(eventInput);
    if (!sealed.ok) {
      return fail(sealed.error);
    }
    const receipt: UsageRecordReceipt = {
      schemaVersion: HOST_RECORD_VERSION,
      entitlementId: input.entitlementId,
      streamId,
      sequence: sealed.value.sequence,
      contentDigest: sealed.value.contentDigest,
      duplicate: false,
    };
    this.usageEvents.set(input.entitlementId, [...events, sealed.value]);
    this.usageByKey.set(input.idempotencyKey, {
      inputDigest: this.usageInputDigestOf(input),
      receipt,
    });
    return ok(receipt);
  }

  /** Canonical digest of the usage input identity (idempotency binding). */
  private usageInputDigestOf(input: RecordUsageInput): string {
    const identity: Record<string, unknown> = {
      asTenant: input.asTenant,
      entitlementId: input.entitlementId,
      units: input.units,
      meteredAt: input.meteredAt,
      actor: input.actor,
    };
    if (input.unitName !== undefined) {
      identity['unitName'] = input.unitName;
    }
    return canonicalDigest(identity as unknown as JsonValue);
  }

  /** The deterministic usage account of one entitlement (tenant-scoped). */
  usageAccountHost(input: UsageAccountInput): HostResult<UsageAccountProjection> {
    const grant = this.grants.get(input.entitlementId);
    if (grant === undefined) {
      return fail({
        code: 'unknown-entitlement',
        message: `no entitlement "${input.entitlementId}" is known to this host`,
        entitlementId: input.entitlementId,
      });
    }
    if (grant.tenantId !== input.asTenant) {
      return fail(crossTenant(input.asTenant, grant.tenantId));
    }
    const events = this.usageEvents.get(input.entitlementId) ?? [];
    if (events.length === 0) {
      return fail({
        code: 'unknown-entitlement',
        message: `no usage events recorded for entitlement "${input.entitlementId}"`,
        entitlementId: input.entitlementId,
      });
    }
    return foldUsageEvents(events, {
      entitlementId: input.entitlementId,
      tenantId: input.asTenant,
    });
  }

  // ------------------------------------------------------------------
  // Developer revenue records
  // ------------------------------------------------------------------

  /**
   * Record developer revenue (record-keeping only, idempotent). The acting
   * tenant must be the listing's developer; the referenced version must be
   * published.
   */
  recordRevenue(input: RecordRevenueInput): HostResult<RevenueRecordReceipt> {
    if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) {
      return fail(badIdempotencyKey(input.idempotencyKey));
    }
    const session = this.listings.get(input.listingId);
    if (session === undefined) {
      return fail(unknownListing(input.listingId));
    }
    if (session.developerTenantId !== input.asTenant) {
      return fail(crossTenant(input.asTenant, session.developerTenantId));
    }
    if (!session.versions.some((sealed) => sealed.contentDigest === input.listingVersionDigest)) {
      return fail({
        code: 'version-not-published',
        message: `digest "${input.listingVersionDigest}" is not a published version of listing "${input.listingId}"`,
        listingId: input.listingId,
        encounteredDigest: input.listingVersionDigest,
      });
    }
    const revenueId = deriveSlugId('revenue', {
      idempotencyKey: input.idempotencyKey,
      developerTenantId: input.asTenant,
      acquiringTenantId: input.acquiringTenantId,
      listingId: input.listingId,
      listingVersionDigest: input.listingVersionDigest,
      basis: input.basis,
      amount: input.amount,
      currency: input.currency,
    });
    const recordInput = {
      schemaVersion: 1,
      revenueId,
      developerTenantId: input.asTenant,
      acquiringTenantId: input.acquiringTenantId,
      listingId: input.listingId,
      listingVersionDigest: input.listingVersionDigest,
      entitlementId: input.entitlementId,
      basis: input.basis,
      amount: input.amount,
      currency: input.currency,
      recordedAt: input.recordedAt,
      recordedBy: input.recordedBy,
      provenance: input.provenance,
    } as const;
    const parsed = validateRevenueRecord(recordInput);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    const existing = this.revenueRecords.get(revenueId);
    if (existing !== undefined) {
      const existingDigest = canonicalDigest(existing as unknown as JsonValue);
      const encounteredDigest = canonicalDigest(parsed.value as unknown as JsonValue);
      if (existingDigest === encounteredDigest) {
        return ok({ schemaVersion: HOST_RECORD_VERSION, record: existing, duplicate: true });
      }
      return fail({
        code: 'idempotency-conflict',
        message: `idempotency key "${input.idempotencyKey}" is bound to a different revenue record`,
        idempotencyKey: input.idempotencyKey,
        boundDigest: existingDigest,
        encounteredDigest,
      });
    }
    this.revenueRecords.set(revenueId, parsed.value);
    this.revenueByKey.set(input.idempotencyKey, revenueId);
    return ok({ schemaVersion: HOST_RECORD_VERSION, record: parsed.value, duplicate: false });
  }

  /** The developer revenue ledger, sorted by (recordedAt, revenueId). */
  listRevenue(input: ListRevenueInput): readonly RevenueRecord[] {
    const records: RevenueRecord[] = [];
    for (const record of this.revenueRecords.values()) {
      if (record.developerTenantId === input.asTenant) {
        records.push(record);
      }
    }
    return records.sort((a, b) => {
      if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? -1 : 1;
      return a.revenueId < b.revenueId ? -1 : 1;
    });
  }

  // ------------------------------------------------------------------
  // Health/liveness as typed data
  // ------------------------------------------------------------------

  /** Health/liveness (pure state projection: no clock, no randomness). */
  health(): HealthReport {
    const listingsByLifecycle = {} as Record<ListingLifecycleState, number>;
    for (const state of LISTING_LIFECYCLE_STATES) listingsByLifecycle[state] = 0;
    let publishedVersionCount = 0;
    for (const session of this.listings.values()) {
      listingsByLifecycle[session.lifecycle] += 1;
      publishedVersionCount += session.versions.length;
    }
    const revokedEntitlementCount = this.revocations.size;
    return {
      schemaVersion: HOST_RECORD_VERSION,
      service: MARKETPLACE_HOST_SERVICE_NAME,
      status: 'ready',
      listingCount: this.listings.size,
      listingsByLifecycle,
      publishedVersionCount,
      entitlementCount: this.grants.size,
      activeEntitlementCount: this.grants.size - revokedEntitlementCount,
      revokedEntitlementCount,
      usageEventCount: this.usageEvents.size === 0
        ? 0
        : [...this.usageEvents.values()].reduce((sum, events) => sum + events.length, 0),
      revenueRecordCount: this.revenueRecords.size,
      registeredPortCount: this.ports.size,
    };
  }

  /** The typed service surface this host exposes. */
  describeService(): ServiceDescription {
    return {
      schemaVersion: HOST_RECORD_VERSION,
      service: MARKETPLACE_HOST_SERVICE_NAME,
      contractVersion: MARKETPLACE_CONTRACT_VERSION,
      lifecycle: [...LISTING_LIFECYCLE_STATES],
      invariants: [
        'Tenant isolation (R12): cross-tenant reads and writes are typed cross-tenant-denied rejections; private listings are invisible out-of-audience.',
        'Payment state is never entitlement authority (lock rule 11): the entitlement check reads Epoch-owned records only; payment outcomes can at most propose payment-sync grant records.',
        'Entitlement revocation is immediate: a revocation record flips the check with no grace semantics.',
        'Published listing versions are immutable, content-addressed, and hash-chained: re-publishing different content at the same version is a typed version-conflict.',
        'Usage metering intake is idempotent and duplicate-suppressed; totals fold deterministically over exact decimal strings.',
        'In-memory reference behavior: no persistence, no network, no real processes.',
      ],
    };
  }
}
