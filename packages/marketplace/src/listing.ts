/**
 * Marketplace listings and their IMMUTABLE, content-addressed, hash-chained
 * published versions (architecture.md, binding; W011 sealed-envelope style).
 *
 * - A listing version is a SEALED ENVELOPE: canonically ordered content plus
 *   its SHA-256 content digest (the exact-revision address). Publishing a
 *   new version NEVER mutates a published one — re-publishing an existing
 *   version with different content is a typed `version-conflict`
 *   rejection, and the sealed content of every published version is
 *   byte-stable for its lifetime.
 * - The HASH CHAIN: each published version's `previousVersionDigest` links
 *   to the prior published version's content digest (null on the first);
 *   `verifyListingVersionChain` walks the chain and rejects tampered
 *   digests (`digest-mismatch`) and broken links.
 * - Version references point at the W007 capability-registry vocabulary:
 *   `admitCapabilityReferences` resolves every (capabilityId, version) pin
 *   against a registry-shaped resolver; a DANGLING reference is a typed
 *   `unknown-capability-reference` rejection.
 * - Determinism: `capabilityReferences`, `privateAllowList`, and
 *   `trustEvidence` are canonically ordered (sorted, duplicate-free), so
 *   semantically equal versions serialize byte-identically and digest
 *   stably.
 */
import { z } from 'zod';
import {
  canonicalDigest,
  TimestampSchema,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import { compareSemver } from '@epoch/capability-registry';
import type {
  CapabilityLookup,
  CapabilityRecord,
  RegistryResult,
} from '@epoch/capability-registry';
import { PricingModelSchema } from './pricing';
import { computeTrustEvidenceDigest, TrustEvidenceRecordSchema } from './trust';
import {
  ListingIdSchema,
  QualifiedNameSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  TenantIdSchema,
} from './primitives';
import {
  LISTING_VISIBILITIES,
  LISTING_VERSION_SCHEMA_NAME,
  MARKETPLACE_RECORD_VERSION,
} from './version';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import { parsePricingModelValue, type PricingModelParseOutcome } from './pricing';
import type { MarketplaceResult } from './errors';

/**
 * Pricing pre-classification: an invalid pricing model reports with its
 * precise taxonomy code (invalid-pricing-model / vendor-fields-rejected)
 * rather than surfacing as generic record validation. Returns null when
 * there is nothing to pre-classify.
 */
function classifyPricingFirst(value: unknown): PricingModelParseOutcome | null {
  if (typeof value !== 'object' || value === null || !('pricing' in value)) {
    return null;
  }
  return parsePricingModelValue((value as { pricing: unknown }).pricing);
}

/**
 * A versioned capability reference: a (capabilityId, version) pin into the
 * W007 registry vocabulary. The referenced capability is REFERENCED
 * OPAQUELY — never embedded — and resolves at publication time.
 */
export const CapabilityVersionReferenceSchema = z
  .strictObject({
    capabilityId: QualifiedNameSchema,
    version: SemverCoreSchema,
  })
  .readonly()
  .meta({
    id: 'CapabilityVersionReference',
    title: 'CapabilityVersionReference',
    description:
      'Reference to a versioned capability in the W007 registry vocabulary: dot-namespaced capability id plus semver core version (referenced opaquely, never embedded).',
  });

/** One capability version reference. */
export type CapabilityVersionReference = z.infer<typeof CapabilityVersionReferenceSchema>;

/**
 * The structural resolver this kernel needs from the W007 registry
 * (`CapabilityRegistry` satisfies it structurally — the registry is the
 * authority, the marketplace never recreates it).
 */
export interface CapabilityVersionResolver {
  get(lookup: CapabilityLookup): RegistryResult<CapabilityRecord>;
}

/** Listing visibility literal schema. */
export const ListingVisibilitySchema = z.enum(LISTING_VISIBILITIES).meta({
  id: 'ListingVisibility',
  title: 'ListingVisibility',
  description: 'Listing visibility: public (every tenant catalog) or private (developer tenant + allow-list only).',
});

/** One listing visibility. */
export type ListingVisibility = z.infer<typeof ListingVisibilitySchema>;

/** The shared canonical-ordering refinement of a listing version. */
function refineListingOrdering(
  content: {
    capabilityReferences: z.infer<typeof CapabilityVersionReferenceSchema>[];
    trustEvidence: z.infer<typeof TrustEvidenceRecordSchema>[];
    visibility: ListingVisibility;
    privateAllowList: string[];
  },
  ctx: z.RefinementCtx,
): void {
  for (let i = 1; i < content.capabilityReferences.length; i += 1) {
    if (content.capabilityReferences[i]!.capabilityId < content.capabilityReferences[i - 1]!.capabilityId) {
      ctx.addIssue({
        code: 'custom',
        message: 'capabilityReferences must be sorted by capabilityId ascending (deterministic serialization)',
        path: ['capabilityReferences'],
      });
      break;
    }
    if (content.capabilityReferences[i]!.capabilityId === content.capabilityReferences[i - 1]!.capabilityId) {
      ctx.addIssue({
        code: 'custom',
        message: 'capabilityReferences must be duplicate-free by capabilityId',
        path: ['capabilityReferences'],
      });
      break;
    }
  }
  const trustKeys = content.trustEvidence.map((record) => computeTrustEvidenceDigest(record));
  for (let i = 1; i < trustKeys.length; i += 1) {
    if (trustKeys[i]! < trustKeys[i - 1]!) {
      ctx.addIssue({
        code: 'custom',
        message: 'trustEvidence must be sorted by content digest ascending (deterministic serialization)',
        path: ['trustEvidence'],
      });
      break;
    }
    if (trustKeys[i]! === trustKeys[i - 1]!) {
      ctx.addIssue({
        code: 'custom',
        message: 'trustEvidence must be duplicate-free by content digest',
        path: ['trustEvidence'],
      });
      break;
    }
  }
  for (let i = 1; i < content.privateAllowList.length; i += 1) {
    if (content.privateAllowList[i]! < content.privateAllowList[i - 1]!) {
      ctx.addIssue({
        code: 'custom',
        message: 'privateAllowList must be sorted ascending (deterministic serialization)',
        path: ['privateAllowList'],
      });
      break;
    }
    if (content.privateAllowList[i]! === content.privateAllowList[i - 1]!) {
      ctx.addIssue({
        code: 'custom',
        message: 'privateAllowList must be duplicate-free',
        path: ['privateAllowList'],
      });
      break;
    }
  }
  if (content.visibility === 'public' && content.privateAllowList.length > 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'privateAllowList must be empty when visibility is "public" (visibility is typed data)',
      path: ['privateAllowList'],
    });
  }
}

/**
 * The immutable content of one published listing version (everything except
 * the content digest). Strict object: unknown (vendor) fields are rejected.
 */
export const ListingVersionContentSchema = z
  .strictObject({
    schema: z.literal(LISTING_VERSION_SCHEMA_NAME),
    schemaVersion: z.literal(MARKETPLACE_RECORD_VERSION),
    listingId: ListingIdSchema,
    version: SemverCoreSchema,
    developerTenantId: TenantIdSchema,
    displayName: z.string().min(1).max(128),
    description: z.string().max(4096).optional(),
    capabilityReferences: z.array(CapabilityVersionReferenceSchema).min(1).max(64),
    pricing: PricingModelSchema,
    trustEvidence: z.array(TrustEvidenceRecordSchema).max(64),
    visibility: ListingVisibilitySchema,
    privateAllowList: z.array(TenantIdSchema).max(256),
    previousVersionDigest: Sha256HexSchema.nullable(),
    publishedAt: TimestampSchema,
  })
  .superRefine(refineListingOrdering)
  .readonly()
  .meta({
    id: 'ListingVersionContent',
    title: 'ListingVersionContent',
    description:
      'The immutable content of one published listing version: discriminator, version, tenant-scoped developer identity, capability references (W007 vocabulary), pricing model, W006-shaped trust evidence, visibility, chain link to the previous published version, and the publication instant.',
  });

/** One listing version content. */
export type ListingVersionContent = z.infer<typeof ListingVersionContentSchema>;

/**
 * The SEALED listing version envelope: content plus its SHA-256 digest over
 * the canonical JSON of the content (the digest field excluded). Admission
 * recomputes the digest and rejects a mismatch (`digest-mismatch` — tamper
 * detection). Published versions are immutable: the seal is never recomputed
 * for a published record.
 */
export const SealedListingVersionSchema = z
  .strictObject({
    schema: z.literal(LISTING_VERSION_SCHEMA_NAME),
    schemaVersion: z.literal(MARKETPLACE_RECORD_VERSION),
    listingId: ListingIdSchema,
    version: SemverCoreSchema,
    developerTenantId: TenantIdSchema,
    displayName: z.string().min(1).max(128),
    description: z.string().max(4096).optional(),
    capabilityReferences: z.array(CapabilityVersionReferenceSchema).min(1).max(64),
    pricing: PricingModelSchema,
    trustEvidence: z.array(TrustEvidenceRecordSchema).max(64),
    visibility: ListingVisibilitySchema,
    privateAllowList: z.array(TenantIdSchema).max(256),
    previousVersionDigest: Sha256HexSchema.nullable(),
    publishedAt: TimestampSchema,
    contentDigest: Sha256HexSchema,
  })
  .superRefine(refineListingOrdering)
  .readonly()
  .meta({
    id: 'SealedListingVersion',
    title: 'SealedListingVersion',
    description:
      'The sealed listing version envelope: canonically ordered immutable content plus its SHA-256 content digest (exact-revision addressing; hash-chained via previousVersionDigest).',
  });

/** One sealed listing version. */
export type SealedListingVersion = z.infer<typeof SealedListingVersionSchema>;

/** Deterministic summary of a verified version chain. */
export interface ListingChainSummary {
  readonly listingId: string;
  readonly developerTenantId: string;
  readonly versionCount: number;
  readonly headVersion: string;
  readonly headDigest: Sha256Hex;
}

/**
 * Compute the content digest of a listing version: the SHA-256 of the
 * canonical JSON of the content (every envelope field EXCEPT
 * `contentDigest`). Throws on invalid content; producers validate first
 * (`sealListingVersion` is the total form).
 */
export function computeListingVersionDigest(content: ListingVersionContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/**
 * Seal valid listing version content into its published envelope (content +
 * recomputed digest). Total; invalid content yields a typed error —
 * strict-object rejections classify as `vendor-fields-rejected`, everything
 * else as `validation` with flattened dotted-path issues.
 */
export function sealListingVersion(content: unknown): MarketplaceResult<SealedListingVersion> {
  const pricing = classifyPricingFirst(content);
  if (pricing !== null && !pricing.ok) {
    return { ok: false, error: pricing.error };
  }
  const parsed = ListingVersionContentSchema.safeParse(content);
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
 * Verify a sealed listing version: schema validation + digest recomputation.
 * A claimed digest that does not match the recomputed canonical SHA-256 of
 * the content is a typed `digest-mismatch` (tamper detection).
 */
export function verifySealedListingVersion(sealed: unknown): MarketplaceResult<SealedListingVersion> {
  const pricing = classifyPricingFirst(sealed);
  if (pricing !== null && !pricing.ok) {
    return { ok: false, error: pricing.error };
  }
  const parsed = SealedListingVersionSchema.safeParse(sealed);
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
          'sealed listing version digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Resolve every capability reference of a listing version against the W007
 * registry vocabulary. A DANGLING reference (unknown capability id or
 * unknown version) is a typed `unknown-capability-reference` rejection —
 * dangling refs never publish.
 */
export function admitCapabilityReferences(
  references: readonly CapabilityVersionReference[],
  resolver: CapabilityVersionResolver,
): MarketplaceResult<readonly CapabilityRecord[]> {
  const records: CapabilityRecord[] = [];
  for (const reference of references) {
    const record = resolver.get({
      capabilityId: reference.capabilityId,
      version: reference.version,
    });
    if (!record.ok) {
      return {
        ok: false,
        error: {
          code: 'unknown-capability-reference',
          message: `listing references capability "${reference.capabilityId}" at version "${reference.version}", which does not resolve in the W007 registry (${record.error.code}: ${record.error.message}) — dangling capability references are typed rejections`,
          capabilityId: reference.capabilityId,
          version: reference.version,
          path: ['capabilityReferences', reference.capabilityId],
        },
      };
    }
    records.push(record.value);
  }
  return { ok: true, value: records };
}

/**
 * Verify the publication chain of one listing's sealed versions:
 *
 * - every envelope verifies individually (schema + digest — tamper
 *   detection surfaces as `digest-mismatch`);
 * - all versions share the listing id and developer tenant;
 * - versions are strictly ASCENDING by semver with no duplicates
 *   (`version-conflict` — mutation of a published version / replayed
 *   publications are typed rejections);
 * - the first version links to null and every later version links to the
 *   PRIOR version's content digest (broken links are `digest-mismatch`
 *   with the expected prior digest).
 *
 * Input order is irrelevant: the chain is verified over the
 * semver-ascending order, so equivalent sets always verify identically.
 */
export function verifyListingVersionChain(
  versions: readonly SealedListingVersion[],
): MarketplaceResult<ListingChainSummary> {
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
    const verified = verifySealedListingVersion(sealed);
    if (!verified.ok) {
      return verified;
    }
  }
  const listingId = versions[0]!.listingId;
  const developerTenantId = versions[0]!.developerTenantId;
  for (const sealed of versions) {
    if (sealed.listingId !== listingId || sealed.developerTenantId !== developerTenantId) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message:
            'version chain mixes listings (listingId/developerTenantId must be constant within a chain)',
          issues: [{ path: '$', message: 'mixed listing identities in one chain' }],
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
          listingId,
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
      listingId,
      developerTenantId,
      versionCount: ordered.length,
      headVersion: head.version,
      headDigest: head.contentDigest,
    },
  };
}
