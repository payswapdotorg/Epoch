/**
 * The Developer Portal HOST (service layer, W025): the thin typed runtime
 * facade for Developer Portal/Publishing.
 *
 * - **Capability browsing (W007)** — deterministic filtered listings and
 *   version-constrained resolution over the REAL registry browse surface
 *   (`CapabilityRegistry` satisfies the seam structurally). The registry
 *   stays the authority; the portal never registers, mutates, or
 *   re-creates it.
 * - **Listing authoring/publishing sessions (W023)** — draft creation and
 *   updates validated through the REAL marketplace kernel admission (the
 *   draft probe seals a listing-version content; pricing, trust evidence,
 *   and canonical ordering are the kernel's); `draft -> submitted ->
 *   published -> retired` follows the REAL lifecycle transition table;
 *   publication seals the IMMUTABLE, content-addressed, hash-chained
 *   version through the REAL kernel sealer, admits every capability
 *   reference against the REAL W007 registry (dangling references are
 *   typed rejections), and verifies the chain BEFORE any state commits.
 *   Publication is idempotent: replaying the head version with identical
 *   content returns `duplicate: true`; different content is the typed
 *   `version-conflict` (mutation of a published version).
 * - **Developer analytics adoption** — W023 entitlement grant/revocation
 *   records and developer revenue records, plus the W024 sealed billing
 *   account, enter through the REAL upstream validators and are adopted
 *   idempotently (same identity + same content is a duplicate; same
 *   identity + different content is the typed `idempotency-conflict`).
 *   Adoptions must concern the developer's OWN listings.
 * - **Developer dashboard** — a pure deterministic projection: listing
 *   counts by lifecycle, active vs revoked entitlement analytics through
 *   the REAL marketplace `checkEntitlement`, revenue folds per currency
 *   through the REAL decimal arithmetic, the adopted payout account, and
 *   registry/stream counters.
 * - **Tenant isolation (R12)** — every read/write is tenant-scoped;
 *   cross-tenant access is the typed `cross-tenant-denied` rejection
 *   (plus the single-tenant `expectedTenantId` guard).
 * - **Events** — every lifecycle step emits a sealed `portal:*` event over
 *   the W010 event shapes (one stream per listing
 *   `stream:portal-listing-<suffix>`, one developer stream
 *   `stream:portal-developer-<tenantSuffix>`); digests are sealed
 *   in-package and parity-pinned against the REAL W010 sealEvent.
 * - **Health/liveness as typed data** — a pure state projection: no wall
 *   clock, no randomness, deterministic key order.
 *
 * The W009 authorization gate denies unauthorized operations BEFORE any
 * kernel admission (the W022/W024/W043 pattern).
 *
 * In-memory reference behavior only: NO persistence, NO network, NO real
 * processes (later Work Orders add those behind this seam).
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  AUTHORIZATION_RECORD_VERSION,
  evaluate,
  parseAuthorizationContext,
} from '@epoch/authorization';
import type { AuthorizationDecision } from '@epoch/authorization';
import { CapabilityRegistry, compareSemver } from '@epoch/capability-registry';
import type { CapabilityRecord } from '@epoch/capability-registry';
import { verifySealedBillingAccount } from '@epoch/entitlements';
import type { SealedBillingAccount } from '@epoch/entitlements';
import {
  LISTING_LIFECYCLE_STATES,
  LISTING_LIFECYCLE_TRANSITIONS,
  LISTING_VERSION_SCHEMA_NAME,
  MARKETPLACE_RECORD_VERSION,
  addNonNegativeDecimals,
  admitCapabilityReferences,
  checkEntitlement,
  parseEntitlementGrant,
  parseEntitlementRevoke,
  sealListingVersion,
  validateRevenueRecord,
  verifyListingVersionChain,
} from '@epoch/marketplace';
import type {
  EntitlementGrantRecord,
  EntitlementRevokeRecord,
  MarketplaceError,
  RevenueRecord,
  SealedListingVersion,
} from '@epoch/marketplace';
import { sealPortalEvent } from './events';
import type { SealedPortalEvent } from './events';
import type {
  AdoptionReceipt,
  ChainSummary,
  DeveloperDashboard,
  HealthReport,
  ListingCreationReceipt,
  ListingSnapshot,
  PayoutAccountSummary,
  PublicationReceipt,
  ServiceDescription,
} from './projections';
import { HOST_RECORD_VERSION } from './version';
import {
  DEVELOPER_PORTAL_CONTRACT_VERSION,
  DEVELOPER_PORTAL_HOST_SERVICE_NAME,
  IDEMPOTENCY_KEY_PATTERN,
  portalDeveloperStreamIdOf,
  portalListingStreamIdOf,
} from './version';
import type {
  AdoptBillingAccountInput,
  AdoptGrantInput,
  AdoptRevenueInput,
  AdoptRevocationInput,
  AuthorizationInput,
  BrowseCapabilitiesInput,
  CreateListingDraftInput,
  DashboardInput,
  DeveloperPortalError,
  HostResult,
  IdempotencyKey,
  ListingDraftInput,
  ListingOperationInput,
  ListingVersionReadInput,
  ListListingsInput,
  PublishListingVersionInput,
  ResolveCapabilityInput,
  RetireListingInput,
  StreamReadInput,
  SubmitListingInput,
  UpdateListingDraftInput,
} from './types';

function ok<T>(value: T): HostResult<T> {
  return { ok: true, value };
}

function fail<T>(error: DeveloperPortalError): HostResult<T> {
  return { ok: false, error };
}

/**
 * Map a W009 authorization error onto the service union: `validation`
 * passes through (malformed contexts are typed validation failures);
 * every other authorization failure is the fail-closed
 * `authorization-rejected` service code.
 */
function mapAuthorizationError(
  error: {
    readonly code: string;
    readonly message: string;
    readonly issues?: readonly { path: string; message: string }[] | undefined;
  },
  principalId = 'unknown',
  operation = 'authorization',
): DeveloperPortalError {
  if (error.code === 'validation') {
    return {
      code: 'validation',
      message: error.message,
      issues: error.issues ?? [],
    };
  }
  return {
    code: 'authorization-rejected',
    message: `the authorization decision point failed (${error.code}): ${error.message}`,
    denialCode: error.code,
    principalId,
    operation,
  };
}

/** Map a W007 registry error onto the kernel carrier codes (adapter boundary). */
function mapRegistryError(
  error: { readonly code: string; readonly message: string },
  capabilityId: string,
): MarketplaceError {
  switch (error.code) {
    case 'unknown-capability':
      return {
        code: 'unknown-capability-reference',
        message: `capability "${capabilityId}" does not resolve in the W007 registry (${error.message}) — the registry is the authority`,
        capabilityId,
        version: '',
        path: ['capabilityId'],
      };
    case 'lifecycle-conflict':
      return {
        code: 'lifecycle-conflict',
        message: `the W007 registry rejected the capability lookup (${error.message})`,
        listingId: capabilityId,
        from: 'retired',
        to: 'retired',
      };
    default:
      return {
        code: 'validation',
        message: `the W007 registry rejected the capability lookup (${error.code}): ${error.message}`,
        issues: [],
      };
  }
}

/** Map a W024 entitlements error onto the kernel carrier codes. */
function mapEntitlementsError(
  error: { readonly code: string; readonly message: string; readonly issues?: unknown },
): MarketplaceError {
  switch (error.code) {
    case 'digest-mismatch':
      return {
        code: 'digest-mismatch',
        message: `the W024 billing account failed digest verification (${error.message})`,
        expected: '',
        encountered: '',
      };
    case 'validation':
      return {
        code: 'validation',
        message: error.message,
        issues: (error.issues as readonly { path: string; message: string }[]) ?? [],
      };
    default:
      return {
        code: 'validation',
        message: `the W024 entitlements authority rejected the account (${error.code}): ${error.message}`,
        issues: [],
      };
  }
}

/** Deterministic composite key: `<tenantId>#<id>`. */
function tenantKey(tenantId: string, id: string): string {
  return `${tenantId}#${id}`;
}

/** Derive a deterministic kind-prefixed slug id from digest input. */
function deriveSlugId(prefix: string, input: Record<string, unknown>): string {
  return `${prefix}:${canonicalDigest(input as unknown as JsonValue).slice(0, 16)}`;
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

/** The closed key set of the listing-creation input. */
const CREATE_KEYS = new Set([
  'asTenant',
  'authorization',
  'idempotencyKey',
  'draft',
  'createdAt',
]);

/** The probe instant for draft validation (kernel admission only). */
const EPOCH_INSTANT = '1970-01-01T00:00:00.000Z';

/** Reject a draft carrying unknown structural fields (vendor discipline). */
function draftVendorFields(unknownKeys: readonly string[]): MarketplaceError {
  return {
    code: 'vendor-fields-rejected',
    message:
      'draft carries unknown structural fields — provider/vendor fields cannot enter listing records (strict objects; provider semantics stay behind the marketplace kernel vocabulary)',
    issues: unknownKeys.map((key) => ({
      path: key,
      message: `unknown draft field "${key}"`,
    })),
    path: ['draft', unknownKeys[0]!],
  };
}

/** Internal listing session record: the draft plus in-memory state. */
interface ListingSession {
  readonly listingId: string;
  readonly developerTenantId: string;
  readonly idempotencyKey: IdempotencyKey;
  draft: ListingDraftInput;
  draftDigest: string;
  lifecycle: (typeof LISTING_LIFECYCLE_STATES)[number];
  /** Published sealed versions in publication order (append-only). */
  versions: SealedListingVersion[];
}

/**
 * The in-memory Developer Portal host. Construct with
 * `new DeveloperPortalHost(options)`.
 */
export class DeveloperPortalHost {
  /** tenantId#listingId -> the listing session. */
  private readonly listings = new Map<string, ListingSession>();

  /** listingId -> the session (globally unique derived ids). */
  private readonly listingsById = new Map<string, ListingSession>();

  /** idempotencyKey -> listingId (draft-creation dedup). */
  private readonly listingByKey = new Map<IdempotencyKey, string>();

  /** entitlementId -> the adopted W023 grant. */
  private readonly grants = new Map<string, EntitlementGrantRecord>();

  /** entitlementId -> the adopted W023 revocations (append-only). */
  private readonly revocations = new Map<string, EntitlementRevokeRecord[]>();

  /** revenueId -> the adopted W023 revenue record. */
  private readonly revenueRecords = new Map<string, RevenueRecord>();

  /** tenantId -> the adopted W024 sealed billing account. */
  private readonly billingAccounts = new Map<string, SealedBillingAccount>();

  /** streamId -> sealed portal events (append-only). */
  private readonly streams = new Map<string, SealedPortalEvent[]>();

  private readonly expectedTenantId: string | undefined;

  private readonly registry: import('./types').CapabilityBrowseSurface;

  constructor(options: import('./types').DeveloperPortalHostOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
    this.registry = options.registry ?? new CapabilityRegistry();
  }

  // --------------------------------------------------------------------------------
  // The authorization gate (W009 — the W022/W024/W043 pattern).
  // --------------------------------------------------------------------------------

  private authorizationGate(
    operation: string,
    tenantId: string,
    authorization: AuthorizationInput,
    resourceId: string,
    resourceType: string,
  ): HostResult<{ principalId: string }> {
    const context = parseAuthorizationContext(authorization.context);
    if (!context.ok) {
      return { ok: false, error: mapAuthorizationError(context.error) };
    }
    const request = {
      schemaVersion: AUTHORIZATION_RECORD_VERSION,
      principalId: authorization.principalId,
      actionKind: `portal.${operation}`,
      resource: { resourceType, resourceId, tenantId },
      ...(authorization.justification !== undefined
        ? { justification: authorization.justification }
        : {}),
    };
    const decision = evaluate(request, context.value);
    if (!decision.ok) {
      return { ok: false, error: mapAuthorizationError(decision.error) };
    }
    const value: AuthorizationDecision = decision.value;
    if (value.outcome === 'deny') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `principal "${authorization.principalId}" is not authorized for portal.${operation} (${value.denial.code}): ${value.denial.message}`,
          denialCode: value.denial.code,
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    if (value.outcome === 'not-applicable') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `principal "${authorization.principalId}" received no authorization decision for portal.${operation} (${value.reason}) — fail-closed`,
          denialCode: 'not-applicable',
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    return { ok: true, value: { principalId: authorization.principalId } };
  }

  /** The single-tenant guard (R12) + the shared gate wrapper. */
  private guard(
    operation: string,
    input: { readonly asTenant: string; readonly authorization: AuthorizationInput },
    resourceId: string,
    resourceType: string,
  ): HostResult<{ principalId: string }> {
    if (this.expectedTenantId !== undefined && input.asTenant !== this.expectedTenantId) {
      return fail({
        code: 'tenant-isolation-rejected',
        message: `this developer portal host is scoped to tenant "${this.expectedTenantId}" but the operation names "${input.asTenant}" (R12 single-tenant guard)`,
        expectedTenantId: this.expectedTenantId,
        encounteredTenantId: input.asTenant,
      });
    }
    return this.authorizationGate(operation, input.asTenant, input.authorization, resourceId, resourceType);
  }

  /** Validate one idempotency key against the typed grammar. */
  private requireKey(key: string): HostResult<IdempotencyKey> {
    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      return fail({
        code: 'validation',
        message: `idempotency key "${key}" does not match the typed key grammar`,
        issues: [
          {
            path: 'idempotencyKey',
            message: 'must match /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/',
          },
        ],
      });
    }
    return ok(key);
  }

  // --------------------------------------------------------------------------------
  // Event emission (sealed in-package over the W010 shapes).
  // --------------------------------------------------------------------------------

  private emit(
    streamId: string,
    tenantId: string,
    actor: string,
    discriminator: string,
    data: Record<string, unknown>,
    occurredAt: string,
  ): void {
    const events = this.streams.get(streamId) ?? [];
    const previous = events.length > 0 ? events[events.length - 1]! : null;
    const sealed = sealPortalEvent({
      schemaVersion: 1,
      streamId,
      sequence: events.length + 1,
      tenantId,
      actor,
      causalParent: previous === null ? null : { streamId, sequence: previous.sequence },
      payload: { discriminator, data: data as never },
      occurredAt,
    });
    if (sealed.ok) {
      this.streams.set(streamId, [...events, sealed.value]);
    }
  }

  // --------------------------------------------------------------------------------
  // Listing session resolution (tenant-scoped).
  // --------------------------------------------------------------------------------

  private resolveListing(tenantId: string, listingId: string): HostResult<ListingSession> {
    const session = this.listingsById.get(listingId);
    if (session === undefined) {
      return fail({
        code: 'unknown-listing-reference',
        message: `no developer listing "${listingId}" is owned by this portal surface (unknown id)`,
        listingId,
      });
    }
    if (session.developerTenantId !== tenantId) {
      return fail({
        code: 'cross-tenant-denied',
        message: `listing "${listingId}" belongs to developer tenant "${session.developerTenantId}" but the caller acts for "${tenantId}" (R12 multi-tenant isolation)`,
        expectedTenantId: tenantId,
        encounteredTenantId: session.developerTenantId,
      });
    }
    return ok(session);
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

  /** Validate draft fields by sealing a probe version (REAL kernel admission). */
  private validateDraft(
    listingId: string,
    developerTenantId: string,
    draft: ListingDraftInput,
  ): HostResult<true> {
    // Unknown (vendor/provider) keys on the draft input are rejected at
    // the host boundary (strict-object discipline).
    const unknownKeys = Object.keys(draft).filter((key) => !DRAFT_KEYS.has(key));
    if (unknownKeys.length > 0) {
      return fail(draftVendorFields(unknownKeys));
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

  // --------------------------------------------------------------------------------
  // Listing authoring + publication (W023 kernel admission).
  // --------------------------------------------------------------------------------

  /**
   * Create a listing-draft session (idempotent): the listing id derives
   * from (idempotencyKey, developer tenant) — the SAME derivation as the
   * W023 marketplace host, so the same (key, tenant) names the same
   * listing on both surfaces. Draft fields are validated through the
   * REAL kernel listing-version admission (pricing, trust evidence,
   * canonical ordering).
   */
  createListingDraft(input: CreateListingDraftInput): HostResult<ListingCreationReceipt> {
    for (const key of Object.keys(input)) {
      if (!CREATE_KEYS.has(key)) {
        return fail({
          code: 'vendor-fields-rejected',
          message:
            'input carries unknown structural fields — provider/vendor fields cannot enter developer portal inputs (strict objects)',
          issues: [{ path: key, message: `unrecognized key: "${key}"` }],
          path: [],
        });
      }
    }
    const key = this.requireKey(input.idempotencyKey);
    if (!key.ok) {
      return key;
    }
    const gate = this.guard('create-listing', input, input.idempotencyKey, 'listing-draft');
    if (!gate.ok) {
      return gate;
    }
    const listingId = deriveSlugId('listing', {
      idempotencyKey: input.idempotencyKey,
      developerTenantId: input.asTenant,
    });
    const draftDigest = this.draftDigestOf(input.draft);
    const existing = this.listingsById.get(listingId);
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
    const session: ListingSession = {
      listingId,
      developerTenantId: input.asTenant,
      idempotencyKey: input.idempotencyKey,
      draft: input.draft,
      draftDigest,
      lifecycle: 'draft',
      versions: [],
    };
    this.listings.set(tenantKey(input.asTenant, listingId), session);
    this.listingsById.set(listingId, session);
    this.listingByKey.set(input.idempotencyKey, listingId);
    this.emit(
      portalListingStreamIdOf(listingId),
      input.asTenant,
      input.authorization.principalId,
      'portal:listing-created',
      { listingId, draftDigest, displayName: input.draft.displayName },
      input.createdAt,
    );
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      listingId,
      lifecycle: 'draft',
      draftDigest,
      duplicate: false,
    });
  }

  /** Update the mutable draft fields of a listing (any state but retired). */
  updateListingDraft(input: UpdateListingDraftInput): HostResult<ListingCreationReceipt> {
    const gate = this.guard('update-draft', input, input.listingId, 'listing-draft');
    if (!gate.ok) {
      return gate;
    }
    const session = this.resolveListing(input.asTenant, input.listingId);
    if (!session.ok) {
      return session;
    }
    if (session.value.lifecycle === 'retired') {
      return fail({
        code: 'lifecycle-conflict',
        message: 'retired listings cannot be edited (legal transitions: none)',
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
    session.value.draft = input.draft;
    session.value.draftDigest = draftDigest;
    this.emit(
      portalListingStreamIdOf(input.listingId),
      input.asTenant,
      input.authorization.principalId,
      'portal:draft-updated',
      { listingId: input.listingId, draftDigest },
      input.updatedAt,
    );
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      listingId: input.listingId,
      lifecycle: session.value.lifecycle,
      draftDigest,
      duplicate: false,
    });
  }

  /** Submit a listing for publication (draft -> submitted). */
  submitListing(input: SubmitListingInput): HostResult<ListingSnapshot> {
    const gate = this.guard('submit-listing', input, input.listingId, 'listing');
    if (!gate.ok) {
      return gate;
    }
    const transitioned = this.transitionListing(input, input.listingId, 'submitted');
    if (!transitioned.ok) {
      return transitioned;
    }
    this.emit(
      portalListingStreamIdOf(input.listingId),
      input.asTenant,
      input.authorization.principalId,
      'portal:listing-submitted',
      { listingId: input.listingId },
      input.submittedAt,
    );
    return ok(this.snapshotOf(transitioned.value));
  }

  /** Retire a published listing (published -> retired). */
  retireListing(input: RetireListingInput): HostResult<ListingSnapshot> {
    const gate = this.guard('retire-listing', input, input.listingId, 'listing');
    if (!gate.ok) {
      return gate;
    }
    const transitioned = this.transitionListing(input, input.listingId, 'retired');
    if (!transitioned.ok) {
      return transitioned;
    }
    this.emit(
      portalListingStreamIdOf(input.listingId),
      input.asTenant,
      input.authorization.principalId,
      'portal:listing-retired',
      { listingId: input.listingId },
      input.retiredAt,
    );
    return ok(this.snapshotOf(transitioned.value));
  }

  private transitionListing(
    input: ListingOperationInput,
    listingId: string,
    to: (typeof LISTING_LIFECYCLE_STATES)[number],
  ): HostResult<ListingSession> {
    const session = this.resolveListing(input.asTenant, listingId);
    if (!session.ok) {
      return session;
    }
    const legal = LISTING_LIFECYCLE_TRANSITIONS[session.value.lifecycle];
    if (!legal.includes(to)) {
      return fail({
        code: 'lifecycle-conflict',
        message: `illegal listing lifecycle transition ${session.value.lifecycle} -> ${to} for "${listingId}" (legal transitions: ${legal.join(', ') || 'none'})`,
        listingId,
        from: session.value.lifecycle,
        to,
      });
    }
    session.value.lifecycle = to;
    return ok(session.value);
  }

  /**
   * Publish the next immutable version of a listing (publication seals the
   * sealed envelope through the REAL W023 kernel). Idempotent: publishing
   * the head version with IDENTICAL content returns `duplicate: true`;
   * different content at the same version is the typed `version-conflict`
   * (mutation of a published version); a version at or below the head is
   * `version-conflict` too. Every capability reference resolves against
   * the REAL W007 registry (dangling references never publish), and the
   * chain is verified BEFORE any state commits.
   */
  publishListingVersion(input: PublishListingVersionInput): HostResult<PublicationReceipt> {
    const gate = this.guard('publish-version', input, input.listingId, 'listing');
    if (!gate.ok) {
      return gate;
    }
    const session = this.resolveListing(input.asTenant, input.listingId);
    if (!session.ok) {
      return session;
    }
    if (session.value.lifecycle !== 'submitted' && session.value.lifecycle !== 'published') {
      return fail({
        code: 'lifecycle-conflict',
        message: `listing "${input.listingId}" is in state "${session.value.lifecycle}"; publication requires "submitted" or "published" (draft -> submitted -> published)`,
        listingId: input.listingId,
        from: session.value.lifecycle,
        to: 'published',
      });
    }
    const head = session.value.versions[session.value.versions.length - 1];
    if (head !== undefined) {
      if (head.version === input.version) {
        // Replay detection: rebuild the envelope at the ORIGINAL chain
        // position (the head's own link) — identical inputs yield the
        // identical digest and are an idempotent no-op; different content
        // at the same version is the mutation rejection.
        const replay = this.sealFor(session.value, input, head.previousVersionDigest);
        if (replay.ok && replay.value.contentDigest === head.contentDigest) {
          return ok({
            schemaVersion: HOST_RECORD_VERSION,
            listingId: input.listingId,
            version: head.version,
            contentDigest: head.contentDigest,
            previousVersionDigest: head.previousVersionDigest,
            chainLength: session.value.versions.length,
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
      if (compareSemver(input.version, head.version) <= 0) {
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
    const sealed = this.sealFor(session.value, input, link);
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
    const chain = verifyListingVersionChain([...session.value.versions, sealed.value]);
    if (!chain.ok) {
      return fail(chain.error);
    }
    session.value.versions.push(sealed.value);
    session.value.lifecycle = 'published';
    this.emit(
      portalListingStreamIdOf(input.listingId),
      input.asTenant,
      input.authorization.principalId,
      'portal:version-published',
      {
        listingId: input.listingId,
        version: sealed.value.version,
        contentDigest: sealed.value.contentDigest,
        previousVersionDigest: sealed.value.previousVersionDigest,
        chainLength: session.value.versions.length,
      },
      input.publishedAt,
    );
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      listingId: input.listingId,
      version: sealed.value.version,
      contentDigest: sealed.value.contentDigest,
      previousVersionDigest: sealed.value.previousVersionDigest,
      chainLength: session.value.versions.length,
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

  // --------------------------------------------------------------------------------
  // Capability browsing (W007 — the registry stays the authority).
  // --------------------------------------------------------------------------------

  /** Browse the W007 capability registry (deterministic, filtered, read-only). */
  browseCapabilities(input: BrowseCapabilitiesInput): HostResult<readonly CapabilityRecord[]> {
    const gate = this.guard('browse-capabilities', input, 'capability-registry', 'capability-registry');
    if (!gate.ok) {
      return gate;
    }
    return ok(
      this.registry.list(
        input.category === undefined && input.lifecycle === undefined
          ? undefined
          : {
              ...(input.category !== undefined ? { category: input.category } : {}),
              ...(input.lifecycle !== undefined ? { lifecycle: input.lifecycle } : {}),
            },
      ),
    );
  }

  /**
   * Resolve one capability under a version constraint (new-binding
   * semantics: retired records never resolve; deprecation is advisory;
   * the best match is the HIGHEST satisfying version — the W007 rules).
   */
  resolveCapability(input: ResolveCapabilityInput): HostResult<CapabilityRecord> {
    const gate = this.guard('resolve-capability', input, input.capabilityId, 'capability');
    if (!gate.ok) {
      return gate;
    }
    const resolved = this.registry.resolve({
      capabilityId: input.capabilityId,
      constraint: input.constraint,
    });
    if (!resolved.ok) {
      return fail(mapRegistryError(resolved.error, input.capabilityId));
    }
    return ok(resolved.value);
  }

  // --------------------------------------------------------------------------------
  // Developer analytics adoption (W023 records + the W024 account).
  // --------------------------------------------------------------------------------

  /**
   * Adopt one W023 entitlement grant record for developer analytics
   * (validated through the REAL parser; the referenced listing must be
   * OWNED by the acting developer tenant; idempotent by entitlement id
   * with typed `idempotency-conflict` on same-id-different-content).
   */
  adoptEntitlementGrant(input: AdoptGrantInput): HostResult<AdoptionReceipt> {
    const gate = this.guard('adopt-grant', input, 'grants', 'entitlement-grant');
    if (!gate.ok) {
      return gate;
    }
    const parsed = parseEntitlementGrant(input.grant);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    const grant = parsed.value;
    const listing = this.resolveListing(input.asTenant, grant.listingId);
    if (!listing.ok) {
      return fail({
        code: 'unknown-listing-reference',
        message: `grant "${grant.entitlementId}" references listing "${grant.listingId}", which is not owned by developer tenant "${input.asTenant}" — adoptions concern the developer's OWN listings`,
        listingId: grant.listingId,
      });
    }
    const existing = this.grants.get(grant.entitlementId);
    if (existing !== undefined) {
      const existingDigest = canonicalDigest(existing as unknown as JsonValue);
      const encounteredDigest = canonicalDigest(grant as unknown as JsonValue);
      if (existingDigest === encounteredDigest) {
        return ok(this.adoptionReceipt(grant.entitlementId, 'entitlement-grant', true));
      }
      return fail({
        code: 'idempotency-conflict',
        message: `entitlement "${grant.entitlementId}" is already adopted with different content (same id, different grant record)`,
        idempotencyKey: grant.entitlementId,
        boundDigest: existingDigest,
        encounteredDigest,
      });
    }
    this.grants.set(grant.entitlementId, grant);
    this.emit(
      portalListingStreamIdOf(grant.listingId),
      input.asTenant,
      input.authorization.principalId,
      'portal:grant-adopted',
      {
        entitlementId: grant.entitlementId,
        listingId: grant.listingId,
        acquiringTenantId: grant.tenantId,
      },
      grant.grantedAt,
    );
    return ok(this.adoptionReceipt(grant.entitlementId, 'entitlement-grant', false));
  }

  /**
   * Adopt one W023 entitlement revocation record (validated through the
   * REAL parser; the entitlement must already be adopted; idempotent by
   * revocation id).
   */
  adoptEntitlementRevocation(input: AdoptRevocationInput): HostResult<AdoptionReceipt> {
    const gate = this.guard('adopt-revocation', input, 'revocations', 'entitlement-revocation');
    if (!gate.ok) {
      return gate;
    }
    const parsed = parseEntitlementRevoke(input.revocation);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    const revocation = parsed.value;
    const grant = this.grants.get(revocation.entitlementId);
    if (grant === undefined) {
      return fail({
        code: 'unknown-entitlement',
        message: `revocation "${revocation.revocationId}" concerns entitlement "${revocation.entitlementId}", which is not adopted on this portal surface`,
        entitlementId: revocation.entitlementId,
      });
    }
    const existing = this.revocations.get(revocation.entitlementId) ?? [];
    if (existing.some((prior) => prior.revocationId === revocation.revocationId)) {
      return ok(this.adoptionReceipt(revocation.revocationId, 'entitlement-revocation', true));
    }
    this.revocations.set(revocation.entitlementId, [...existing, revocation]);
    this.emit(
      portalListingStreamIdOf(grant.listingId),
      input.asTenant,
      input.authorization.principalId,
      'portal:grant-revoked',
      { entitlementId: revocation.entitlementId, listingId: grant.listingId },
      revocation.revokedAt,
    );
    return ok(this.adoptionReceipt(revocation.revocationId, 'entitlement-revocation', false));
  }

  /**
   * Adopt one W023 developer revenue record (validated through the REAL
   * validator; the developer tenant and referenced listing must be the
   * acting developer's; idempotent by revenue id with typed
   * `idempotency-conflict`).
   */
  adoptRevenueRecord(input: AdoptRevenueInput): HostResult<AdoptionReceipt> {
    const gate = this.guard('adopt-revenue', input, 'revenue', 'revenue-record');
    if (!gate.ok) {
      return gate;
    }
    const parsed = validateRevenueRecord(input.record);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    const record = parsed.value;
    if (record.developerTenantId !== input.asTenant) {
      return fail({
        code: 'cross-tenant-denied',
        message: `revenue record "${record.revenueId}" accrues to developer tenant "${record.developerTenantId}" but the adoption is scoped to "${input.asTenant}" (R12)`,
        expectedTenantId: input.asTenant,
        encounteredTenantId: record.developerTenantId,
      });
    }
    const listing = this.resolveListing(input.asTenant, record.listingId);
    if (!listing.ok) {
      return fail({
        code: 'unknown-listing-reference',
        message: `revenue record "${record.revenueId}" references listing "${record.listingId}", which is not owned by developer tenant "${input.asTenant}"`,
        listingId: record.listingId,
      });
    }
    const existing = this.revenueRecords.get(record.revenueId);
    if (existing !== undefined) {
      const existingDigest = canonicalDigest(existing as unknown as JsonValue);
      const encounteredDigest = canonicalDigest(record as unknown as JsonValue);
      if (existingDigest === encounteredDigest) {
        return ok(this.adoptionReceipt(record.revenueId, 'revenue-record', true));
      }
      return fail({
        code: 'idempotency-conflict',
        message: `revenue record "${record.revenueId}" is already adopted with different content`,
        idempotencyKey: record.revenueId,
        boundDigest: existingDigest,
        encounteredDigest,
      });
    }
    this.revenueRecords.set(record.revenueId, record);
    this.emit(
      portalListingStreamIdOf(record.listingId),
      input.asTenant,
      input.authorization.principalId,
      'portal:revenue-adopted',
      {
        revenueId: record.revenueId,
        listingId: record.listingId,
        amount: record.amount,
        currency: record.currency,
      },
      record.recordedAt,
    );
    return ok(this.adoptionReceipt(record.revenueId, 'revenue-record', false));
  }

  /**
   * Adopt the developer's sealed W024 billing account — the payout
   * surface where marketplace revenue settles (verified through the REAL
   * `verifySealedBillingAccount`; the account's tenant must be the acting
   * developer tenant; idempotent by account id with typed
   * `idempotency-conflict`).
   */
  adoptBillingAccount(input: AdoptBillingAccountInput): HostResult<AdoptionReceipt> {
    const gate = this.guard('adopt-billing-account', input, 'billing-accounts', 'billing-account');
    if (!gate.ok) {
      return gate;
    }
    const verified = verifySealedBillingAccount(input.account);
    if (!verified.ok) {
      return fail(mapEntitlementsError(verified.error as { code: string; message: string; issues?: unknown }));
    }
    const account = verified.value;
    if (account.tenantId !== input.asTenant) {
      return fail({
        code: 'cross-tenant-denied',
        message: `billing account "${account.accountId}" belongs to tenant "${account.tenantId}" but the adoption is scoped to "${input.asTenant}" (R12)`,
        expectedTenantId: input.asTenant,
        encounteredTenantId: account.tenantId,
      });
    }
    const existing = this.billingAccounts.get(input.asTenant);
    if (existing !== undefined) {
      if (existing.accountId === account.accountId && existing.contentDigest === account.contentDigest) {
        return ok(this.adoptionReceipt(account.accountId, 'billing-account', true));
      }
      return fail({
        code: 'idempotency-conflict',
        message: `developer tenant "${input.asTenant}" has a different adopted billing account ("${existing.accountId}", digest ${existing.contentDigest}) — one payout account per developer tenant`,
        idempotencyKey: account.accountId,
        boundDigest: existing.contentDigest,
        encounteredDigest: account.contentDigest,
      });
    }
    this.billingAccounts.set(input.asTenant, account);
    this.emit(
      portalDeveloperStreamIdOf(input.asTenant),
      input.asTenant,
      input.authorization.principalId,
      'portal:billing-account-adopted',
      { accountId: account.accountId, accountDigest: account.contentDigest, currency: account.currency },
      account.openedAt,
    );
    return ok(this.adoptionReceipt(account.accountId, 'billing-account', false));
  }

  private adoptionReceipt(
    recordId: string,
    recordKind: AdoptionReceipt['recordKind'],
    duplicate: boolean,
  ): AdoptionReceipt {
    return { schemaVersion: HOST_RECORD_VERSION, recordId, recordKind, duplicate };
  }

  // --------------------------------------------------------------------------------
  // Reads.
  // --------------------------------------------------------------------------------

  /** One developer-owned listing snapshot (tenant-scoped). */
  getListing(input: ListingOperationInput): HostResult<ListingSnapshot> {
    const gate = this.guard('get-listing', input, input.listingId, 'listing');
    if (!gate.ok) {
      return gate;
    }
    const session = this.resolveListing(input.asTenant, input.listingId);
    if (!session.ok) {
      return session;
    }
    return ok(this.snapshotOf(session.value));
  }

  /** The developer's OWN listings, sorted by listingId ascending. */
  listListings(input: ListListingsInput): HostResult<readonly ListingSnapshot[]> {
    const gate = this.guard('list-listings', input, 'listings', 'listing-listing');
    if (!gate.ok) {
      return gate;
    }
    const snapshots: ListingSnapshot[] = [];
    const ids = [...this.listingsById.keys()].sort();
    for (const id of ids) {
      const session = this.listingsById.get(id)!;
      if (session.developerTenantId === input.asTenant) {
        snapshots.push(this.snapshotOf(session));
      }
    }
    return ok(snapshots);
  }

  /**
   * One published version (by version pin or content digest), verified
   * through the REAL kernel verifier (tamper detection).
   */
  getListingVersion(input: ListingVersionReadInput): HostResult<SealedListingVersion> {
    if (input.version === undefined && input.contentDigest === undefined) {
      return fail({
        code: 'validation',
        message: 'a version pin or a content digest is required',
        issues: [{ path: 'version', message: 'version or contentDigest must be provided' }],
      });
    }
    const gate = this.guard('get-listing-version', input, input.listingId, 'listing-version');
    if (!gate.ok) {
      return gate;
    }
    const session = this.resolveListing(input.asTenant, input.listingId);
    if (!session.ok) {
      return session;
    }
    for (const sealed of session.value.versions) {
      if (input.version !== undefined && sealed.version !== input.version) continue;
      if (input.contentDigest !== undefined && sealed.contentDigest !== input.contentDigest) continue;
      // Tamper detection on the stored envelope (defense in depth).
      const chain = verifyListingVersionChain(session.value.versions);
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

  /** The listing's published versions, ascending by semver (deterministic). */
  listListingVersions(
    input: ListingOperationInput,
  ): HostResult<readonly SealedListingVersion[]> {
    const gate = this.guard('list-listing-versions', input, input.listingId, 'listing-version');
    if (!gate.ok) {
      return gate;
    }
    const session = this.resolveListing(input.asTenant, input.listingId);
    if (!session.ok) {
      return session;
    }
    return ok([...session.value.versions].sort((a, b) => compareSemver(a.version, b.version)));
  }

  /** The verified publication-chain summary of one listing. */
  verifyListingChain(input: ListingOperationInput): HostResult<ChainSummary> {
    const gate = this.guard('verify-listing-chain', input, input.listingId, 'listing-chain');
    if (!gate.ok) {
      return gate;
    }
    const session = this.resolveListing(input.asTenant, input.listingId);
    if (!session.ok) {
      return session;
    }
    const chain = verifyListingVersionChain(session.value.versions);
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

  /** Read one event stream (tenant-scoped, chronological). */
  readStream(input: StreamReadInput): HostResult<readonly SealedPortalEvent[]> {
    const gate = this.guard('read-stream', input, input.streamId, 'event-stream');
    if (!gate.ok) {
      return gate;
    }
    const events = this.streams.get(input.streamId) ?? [];
    const scoped = events.filter((event) => event.tenantId === input.asTenant);
    return ok(scoped);
  }

  // --------------------------------------------------------------------------------
  // The developer dashboard (pure deterministic projection).
  // --------------------------------------------------------------------------------

  /**
   * The developer dashboard: listing/lifecycle counts, active vs revoked
   * entitlement analytics through the REAL marketplace check, revenue
   * folds per currency, the adopted payout account, and registry/stream
   * counters. Fail-closed: an unexpected entitlement-check error
   * propagates as the typed carrier.
   */
  getDeveloperDashboard(input: DashboardInput): HostResult<DeveloperDashboard> {
    const gate = this.guard('get-dashboard', input, input.asTenant, 'developer-dashboard');
    if (!gate.ok) {
      return gate;
    }
    const listingsByLifecycle: Record<string, number> = {};
    for (const state of LISTING_LIFECYCLE_STATES) {
      listingsByLifecycle[state] = 0;
    }
    let publishedVersionCount = 0;
    let listingCount = 0;
    for (const session of this.listingsById.values()) {
      if (session.developerTenantId !== input.asTenant) continue;
      listingCount += 1;
      listingsByLifecycle[session.lifecycle] = (listingsByLifecycle[session.lifecycle] ?? 0) + 1;
      publishedVersionCount += session.versions.length;
    }
    let activeEntitlementCount = 0;
    let revokedEntitlementCount = 0;
    for (const grant of this.grants.values()) {
      const owned = this.listingsById.get(grant.listingId);
      if (owned === undefined || owned.developerTenantId !== input.asTenant) continue;
      const checked = checkEntitlement({
        grants: [grant],
        revocations: this.revocations.get(grant.entitlementId) ?? [],
        query: {
          listingId: grant.listingId,
          tenantId: grant.tenantId,
          ...(grant.scope.kind === 'workspace' ? { workspaceId: grant.scope.workspaceId } : {}),
        },
      });
      if (checked.ok) {
        activeEntitlementCount += 1;
      } else if (checked.error.code === 'entitlement-revoked') {
        revokedEntitlementCount += 1;
      } else {
        return fail(checked.error);
      }
    }
    const revenueByCurrency: Record<string, string> = {};
    let revenueRecordCount = 0;
    for (const record of this.revenueRecords.values()) {
      const owned = this.listingsById.get(record.listingId);
      if (owned === undefined || owned.developerTenantId !== input.asTenant) continue;
      revenueRecordCount += 1;
      const total = revenueByCurrency[record.currency];
      revenueByCurrency[record.currency] =
        total === undefined ? record.amount : addNonNegativeDecimals(total, record.amount);
    }
    let eventCount = 0;
    for (const events of this.streams.values()) {
      eventCount += events.length;
    }
    const account = this.billingAccounts.get(input.asTenant);
    const payoutAccount: PayoutAccountSummary | null =
      account === undefined
        ? null
        : {
            schemaVersion: HOST_RECORD_VERSION,
            accountId: account.accountId,
            currency: account.currency,
            displayName: account.displayName,
            openedAt: account.openedAt,
            contentDigest: account.contentDigest,
          };
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      developerTenantId: input.asTenant,
      listingCount,
      listingsByLifecycle,
      publishedVersionCount,
      adoptedGrantCount: this.grants.size,
      activeEntitlementCount,
      revokedEntitlementCount,
      revenueRecordCount,
      revenueByCurrency,
      payoutAccount,
      registeredCapabilityCount: this.registry.size,
      eventCount,
    });
  }

  // --------------------------------------------------------------------------------
  // Health + describe.
  // --------------------------------------------------------------------------------

  /** Health/liveness as typed data (pure state projection). */
  health(): HealthReport {
    const listingsByLifecycle: Record<string, number> = {};
    for (const state of LISTING_LIFECYCLE_STATES) {
      listingsByLifecycle[state] = 0;
    }
    let publishedVersionCount = 0;
    for (const session of this.listingsById.values()) {
      listingsByLifecycle[session.lifecycle] = (listingsByLifecycle[session.lifecycle] ?? 0) + 1;
      publishedVersionCount += session.versions.length;
    }
    let adoptedRevocationCount = 0;
    for (const revocations of this.revocations.values()) {
      adoptedRevocationCount += revocations.length;
    }
    let eventCount = 0;
    for (const events of this.streams.values()) {
      eventCount += events.length;
    }
    return {
      schemaVersion: HOST_RECORD_VERSION,
      service: DEVELOPER_PORTAL_HOST_SERVICE_NAME,
      status: 'ready',
      listingCount: this.listingsById.size,
      listingsByLifecycle,
      publishedVersionCount,
      adoptedGrantCount: this.grants.size,
      adoptedRevocationCount,
      adoptedRevenueCount: this.revenueRecords.size,
      adoptedBillingAccountCount: this.billingAccounts.size,
      registrySize: this.registry.size,
      eventCount,
    };
  }

  /** The typed service surface description. */
  describe(): ServiceDescription {
    return {
      schemaVersion: HOST_RECORD_VERSION,
      service: DEVELOPER_PORTAL_HOST_SERVICE_NAME,
      contractVersion: DEVELOPER_PORTAL_CONTRACT_VERSION,
      operations: [
        'createListingDraft',
        'updateListingDraft',
        'submitListing',
        'publishListingVersion',
        'retireListing',
        'browseCapabilities',
        'resolveCapability',
        'adoptEntitlementGrant',
        'adoptEntitlementRevocation',
        'adoptRevenueRecord',
        'adoptBillingAccount',
        'getListing',
        'listListings',
        'getListingVersion',
        'listListingVersions',
        'verifyListingChain',
        'readStream',
        'getDeveloperDashboard',
      ],
      invariants: [
        'the W009 authorization gate denies unauthorized operations before any kernel admission',
        'tenant isolation (R12): every record is tenant-scoped; cross-tenant access is a typed rejection',
        'the W007 registry is the capability authority — the portal browses and resolves, never registers or mutates',
        'listing versions are W023 kernel records: sealed, immutable, hash-chained, capability-admitted, chain-verified before commit',
        'dangling capability references never publish (typed rejections)',
        'adopted grants/revocations/revenue/billing accounts are W023/W024 records verified through the real validators — never redefined',
        'the developer dashboard is a pure projection (real entitlement checks, real decimal folds) — never a second authority',
        'zero wall-clock reads and zero randomness — every instant is caller-supplied',
      ],
    };
  }
}
