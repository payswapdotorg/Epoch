/**
 * examples/sdk — a marketplace listing over the REAL @epoch/marketplace
 * (W023) kernel public API (W035).
 *
 * The example a developer follows to PUBLISH and OPERATE a listing:
 * register the referenced capability in the real W007 registry, build the
 * listing version content (capability references, typed pricing, W006-
 * shaped trust evidence pinned to the registered manifest digest), seal
 * TWO immutable hash-chained versions, verify the chain, resolve the
 * capability references through the real registry, grant + revoke the
 * entitlement (the check flips IMMEDIATELY — payment state is never
 * authority), meter usage as append-only W010-shaped events, fold the
 * usage account twice in different input orders (determinism), and
 * record developer revenue with full provenance back to the generating
 * usage event.
 *
 * The outcome carries the four typed marketplace-readiness EVIDENCE
 * records the release-readiness example attaches to its checklist.
 */
import {
  checkEntitlement,
  foldUsageEvents,
  sealListingVersion,
  sealUsageEvent,
  usageStreamIdOf,
  validateRevenueRecord,
  verifyListingVersionChain,
  admitCapabilityReferences,
  type EntitlementGrantRecord,
  type EntitlementRevokeRecord,
  type SealedListingVersion,
  type SealedUsageEvent,
} from '@epoch/marketplace';
import {
  CapabilityRegistry,
  computeCapabilityManifestDigest,
  type CapabilityRegistration,
} from '@epoch/capability-registry';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { BUYER_TENANT, CAPABILITY_ID, EVENT_PRINCIPAL, T, VENDOR_TENANT } from './shared';
import { exampleCapabilityManifest } from './capability-registration';

/** The listing identity the example publishes. */
export const EXAMPLE_LISTING_ID = 'listing:stress-suite';

/** The entitlement identity the example grants + revokes. */
export const EXAMPLE_ENTITLEMENT_ID = 'entitlement:grant-001';

/** W006-shaped trust evidence pinned to the registered manifest digest. */
function trustEvidenceFor(manifestDigest: string): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'computation',
    subject: {
      artifactId: CAPABILITY_ID,
      revision: '1.2.3',
      digest: manifestDigest,
    },
    producedBy: {
      runId: 'run:nightly-2026-02-09',
      actorId: 'principal:verifier-bot',
      methodId: 'method:suite-regression',
    },
    observedAt: T[0],
    content: {
      mediaType: 'application/json',
      data: { passed: true, checks: 42 },
    },
    confidence: {
      distribution: { kind: 'point', value: 1 },
      method: 'stated',
      rationale: 'deterministic regression suite',
    },
  };
}

/** The registry holding the referenced capability (real W007 consumption). */
function registryWithCapability(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  const manifest = exampleCapabilityManifest();
  const registration: CapabilityRegistration = {
    manifest: manifest as unknown as CapabilityRegistration['manifest'],
    digest: computeCapabilityManifestDigest(manifest as unknown as CapabilityRegistration['manifest']),
  };
  const registered = registry.register(registration);
  if (!registered.ok) {
    throw new Error(`fixture registration failed: ${JSON.stringify(registered.error)}`);
  }
  return registry;
}

/** The first listing version content (loose JSON — the admission path validates). */
function firstVersionContent(manifestDigest: string): Record<string, unknown> {
  return {
    schema: 'epoch.marketplace.listing-version',
    schemaVersion: 1,
    listingId: EXAMPLE_LISTING_ID,
    version: '1.0.0',
    developerTenantId: VENDOR_TENANT,
    displayName: 'Stress Analysis Suite',
    description: 'Simulation capability bundle with regression evidence.',
    capabilityReferences: [{ capabilityId: CAPABILITY_ID, version: '1.2.3' }],
    pricing: { kind: 'one-time', amount: '199.00', currency: 'USD' },
    trustEvidence: [trustEvidenceFor(manifestDigest)],
    visibility: 'public',
    privateAllowList: [],
    previousVersionDigest: null,
    publishedAt: T[1],
  };
}

/** The second listing version content, hash-chained to the first. */
function secondVersionContent(manifestDigest: string, previousDigest: string): Record<string, unknown> {
  return {
    ...firstVersionContent(manifestDigest),
    version: '1.1.0',
    pricing: { kind: 'usage-metered', unitAmount: '0.75', currency: 'USD', unitName: 'simulation-run' },
    previousVersionDigest: previousDigest,
    publishedAt: T[2],
  };
}

/** The typed outcome of the marketplace-listing example. */
export interface MarketplaceListingExample {
  readonly listingId: string;
  readonly entitlementId: string;
  readonly versionCount: number;
  readonly headVersion: string;
  readonly headDigest: string;
  readonly chainVerified: boolean;
  readonly referencesResolved: number;
  readonly grantedBeforeRevoke: boolean;
  readonly deniedAfterRevoke: boolean;
  readonly usageEventCount: number;
  readonly usageTotalUnits: string;
  readonly foldsAgree: boolean;
  readonly revenueRecords: number;
  readonly revenueProvenanceComplete: boolean;
  readonly revenueLastDigest: string;
}

/** Run the example (pure — same result every run). */
export function runMarketplaceListingExample(): MarketplaceListingExample {
  const registry = registryWithCapability();
  const manifest = exampleCapabilityManifest();
  const manifestDigest = computeCapabilityManifestDigest(
    manifest as unknown as CapabilityRegistration['manifest'],
  );

  // Publish two immutable, hash-chained versions.
  const firstContent = firstVersionContent(manifestDigest);
  const firstSealed = sealListingVersion(firstContent);
  if (!firstSealed.ok) {
    throw new Error(`first version must seal: ${firstSealed.error.message}`);
  }
  const firstDigest = firstSealed.value.contentDigest;
  const secondSealed = sealListingVersion(secondVersionContent(manifestDigest, firstDigest));
  if (!secondSealed.ok) {
    throw new Error(`second version must seal: ${secondSealed.error.message}`);
  }
  const versions: SealedListingVersion[] = [firstSealed.value, secondSealed.value];

  // Verify the publication chain (immutability + hash chain).
  const chain = verifyListingVersionChain(versions);
  if (!chain.ok) {
    throw new Error(`chain must verify: ${chain.error.message}`);
  }

  // Resolve the capability references through the REAL W007 registry.
  const admitted = admitCapabilityReferences(
    (firstContent as { capabilityReferences: { capabilityId: string; version: string }[] }).capabilityReferences,
    registry,
  );
  if (!admitted.ok) {
    throw new Error(`capability references must resolve: ${admitted.error.message}`);
  }

  // Grant, check, revoke, check — the entitlement flip.
  const headDigest = chain.value.headDigest;
  const grants: readonly EntitlementGrantRecord[] = [
    {
      schemaVersion: 1,
      entitlementId: EXAMPLE_ENTITLEMENT_ID,
      tenantId: BUYER_TENANT,
      listingId: EXAMPLE_LISTING_ID,
      listingVersionDigest: headDigest,
      scope: { kind: 'tenant' },
      grantedAt: T[3],
      grantedBy: EVENT_PRINCIPAL,
      provenance: { kind: 'direct' },
    },
  ];
  const revocations: readonly EntitlementRevokeRecord[] = [
    {
      schemaVersion: 1,
      revocationId: 'revocation:revoke-001',
      entitlementId: EXAMPLE_ENTITLEMENT_ID,
      tenantId: BUYER_TENANT,
      revokedAt: T[5],
      revokedBy: EVENT_PRINCIPAL,
      reason: 'subscription cancelled',
    },
  ];
  const query = { tenantId: BUYER_TENANT, listingId: EXAMPLE_LISTING_ID };
  const beforeRevoke = checkEntitlement({ grants, revocations: [], query });
  if (!beforeRevoke.ok) {
    throw new Error(`check after grant must pass: ${beforeRevoke.error.message}`);
  }
  const afterRevoke = checkEntitlement({ grants, revocations, query });
  if (afterRevoke.ok) {
    throw new Error('check after revocation must flip to denied immediately');
  }

  // Meter usage as append-only W010-shaped events against the head version.
  const usageStreamId = usageStreamIdOf(EXAMPLE_ENTITLEMENT_ID);
  const usageEventContent = (sequence: number, units: string, occurredAt: string): Record<string, unknown> => ({
    schemaVersion: 1,
    streamId: usageStreamId,
    sequence,
    tenantId: BUYER_TENANT,
    actor: EVENT_PRINCIPAL,
    causalParent: sequence > 1 ? { streamId: usageStreamId, sequence: sequence - 1 } : null,
    payload: {
      discriminator: 'marketplace:usage',
      data: {
        entitlementId: EXAMPLE_ENTITLEMENT_ID,
        listingId: EXAMPLE_LISTING_ID,
        listingVersionDigest: headDigest,
        units,
        unitName: 'simulation-run',
        meteredAt: occurredAt,
      },
    },
    occurredAt,
  });
  const sealedUsage = (content: Record<string, unknown>): SealedUsageEvent => {
    const sealed = sealUsageEvent(content);
    if (!sealed.ok) {
      throw new Error(`usage event must seal: ${sealed.error.message}`);
    }
    return sealed.value;
  };
  const events = [
    sealedUsage(usageEventContent(1, '2.5', T[6])),
    sealedUsage(usageEventContent(2, '4.25', T[7])),
  ];

  // Fold the usage account twice — the SAME events in DIFFERENT input
  // orders must agree byte-exactly (determinism).
  const foldA = foldUsageEvents(events, { entitlementId: EXAMPLE_ENTITLEMENT_ID, tenantId: BUYER_TENANT });
  if (!foldA.ok) {
    throw new Error(`fold must succeed: ${foldA.error.message}`);
  }
  const foldB = foldUsageEvents([events[1]!, events[0]!], {
    entitlementId: EXAMPLE_ENTITLEMENT_ID,
    tenantId: BUYER_TENANT,
  });
  if (!foldB.ok) {
    throw new Error(`reordered fold must succeed: ${foldB.error.message}`);
  }
  const foldsAgree = canonicalDigest(foldA.value as unknown as JsonValue) === canonicalDigest(foldB.value as unknown as JsonValue);

  // Record developer revenue with provenance back to the generating event.
  const revenueRecord = {
    schemaVersion: 1,
    revenueId: 'revenue:rev-001',
    developerTenantId: VENDOR_TENANT,
    acquiringTenantId: BUYER_TENANT,
    listingId: EXAMPLE_LISTING_ID,
    listingVersionDigest: headDigest,
    entitlementId: EXAMPLE_ENTITLEMENT_ID,
    basis: 'usage',
    amount: '5.0625',
    currency: 'USD',
    recordedAt: T[8],
    recordedBy: EVENT_PRINCIPAL,
    provenance: { kind: 'usage-event', usageEventDigest: events[1]!.contentDigest },
  };
  const validatedRevenue = validateRevenueRecord(revenueRecord);
  if (!validatedRevenue.ok) {
    throw new Error(`revenue record must validate: ${validatedRevenue.error.message}`);
  }
  const provenanceComplete =
    validatedRevenue.value.provenance.kind === 'usage-event' &&
    validatedRevenue.value.provenance.usageEventDigest === events[1]!.contentDigest;

  return {
    listingId: EXAMPLE_LISTING_ID,
    entitlementId: EXAMPLE_ENTITLEMENT_ID,
    versionCount: chain.value.versionCount,
    headVersion: chain.value.headVersion,
    headDigest,
    chainVerified: true,
    referencesResolved: admitted.value.length,
    grantedBeforeRevoke: true,
    deniedAfterRevoke: true,
    usageEventCount: events.length,
    usageTotalUnits: foldA.value.totalUnits,
    foldsAgree,
    revenueRecords: 1,
    revenueProvenanceComplete: provenanceComplete,
    revenueLastDigest: canonicalDigest(validatedRevenue.value as unknown as JsonValue),
  };
}

/** The canonical digest projection (the determinism gate). */
export function marketplaceListingDigestProjection(): string {
  const outcome = runMarketplaceListingExample();
  return canonicalDigest(outcome as unknown as JsonValue);
}
