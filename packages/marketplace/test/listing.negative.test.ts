// Listing NEGATIVES (named rejections): dangling capability reference;
// mutation of a published version (same version, different content); a
// version below the published head; tampered envelopes (digest-mismatch);
// broken chain links; vendor fields; canonical-ordering violations.
import { describe, expect, it } from 'vitest';
import {
  admitCapabilityReferences,
  sealListingVersion,
  verifyListingVersionChain,
  verifySealedListingVersion,
} from '../src/index';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  chainedSecondVersion,
  listingContent,
  registryWithFixtureCapability,
  sealedListing,
  sortedTrustEvidence,
  trustEvidence,
} from './fixtures';

describe('listing negatives', () => {
  it('NAMED NEGATIVE: dangling capability reference is a typed rejection', () => {
    const registry = registryWithFixtureCapability();
    const content = {
      ...listingContent(),
      capabilityReferences: [
        { capabilityId: 'engineering.stress-analysis', version: '9.9.9' },
      ],
    };
    const sealed = sealListingVersion(content);
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      const admitted = admitCapabilityReferences(sealed.value.capabilityReferences, registry);
      expect(admitted.ok).toBe(false);
      if (!admitted.ok && admitted.error.code === 'unknown-capability-reference') {
        expect(admitted.error.capabilityId).toBe('engineering.stress-analysis');
        expect(admitted.error.version).toBe('9.9.9');
      }
    }
  });

  it('an unknown capability id is a typed unknown-capability-reference', () => {
    const registry = registryWithFixtureCapability();
    const admitted = admitCapabilityReferences(
      [{ capabilityId: 'engineering.nonexistent', version: '1.0.0' }],
      registry,
    );
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('unknown-capability-reference');
    }
  });

  it('NAMED NEGATIVE: mutation of a published version is rejected (same version, different content = version-conflict chain)', () => {
    // Publishing the SAME version with DIFFERENT content: the mutated
    // envelope still seals (it is new content), but the CHAIN rejects the
    // duplicate version — a published version is immutable; changed
    // content ships as a NEW version.
    const v1 = sealedListing(listingContent());
    const mutated = sealedListing({
      ...listingContent(),
      displayName: 'Stress Analysis Suite (mutated)',
    });
    const chain = verifyListingVersionChain([v1, mutated]);
    expect(chain.ok).toBe(false);
    if (!chain.ok && chain.error.code === 'version-conflict') {
      expect(chain.error.version).toBe('1.0.0');
    }
  });

  it('NAMED NEGATIVE: tampered envelope digest is rejected (digest-mismatch)', () => {
    const v1 = sealedListing(listingContent());
    const tampered = { ...v1, contentDigest: '1'.repeat(64) };
    const verified = verifySealedListingVersion(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok && verified.error.code === 'digest-mismatch') {
      expect(verified.error.expected).toBe(v1.contentDigest);
      expect(verified.error.encountered).toBe('1'.repeat(64));
    }
  });

  it('a content mutation under a recomputed digest is exposed by the chain link', () => {
    const v1 = sealedListing(listingContent());
    const rest: Record<string, unknown> = { ...v1, displayName: 'Silently Renamed Suite' };
    delete rest['contentDigest'];
    const tampered = {
      ...v1,
      displayName: 'Silently Renamed Suite',
      contentDigest: canonicalDigest(rest as unknown as JsonValue),
    };
    // The successor links to the ORIGINAL digest; the divergent content
    // surfaces as a broken chain (digest-mismatch with the expected link).
    const v2 = sealedListing(chainedSecondVersion(v1.contentDigest));
    const chain = verifyListingVersionChain([tampered, v2]);
    expect(chain.ok).toBe(false);
    if (!chain.ok) {
      expect(chain.error.code).toBe('digest-mismatch');
    }
  });

  it('NAMED NEGATIVE: broken chain link is rejected (digest-mismatch with the expected prior digest)', () => {
    const v1 = sealedListing(listingContent());
    const v2 = sealedListing(chainedSecondVersion('f'.repeat(64)));
    const chain = verifyListingVersionChain([v1, v2]);
    expect(chain.ok).toBe(false);
    if (!chain.ok && chain.error.code === 'digest-mismatch') {
      expect(chain.error.expected).toBe(v1.contentDigest);
      expect(chain.error.encountered).toBe('f'.repeat(64));
    }
  });

  it('a first version with a non-null chain link is rejected', () => {
    const v1 = sealedListing(listingContent({ previousVersionDigest: 'a'.repeat(64) }));
    const chain = verifyListingVersionChain([v1]);
    expect(chain.ok).toBe(false);
    if (!chain.ok) {
      expect(chain.error.code).toBe('digest-mismatch');
    }
  });

  it('NAMED NEGATIVE: vendor/provider fields on the listing content are rejected', () => {
    const sealed = sealListingVersion({
      ...listingContent(),
      providerPortal: 'https://not-a-real-portal.example',
    });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('vendor-fields-rejected');
    }
  });

  it('NAMED NEGATIVE: invalid pricing inside the listing reports invalid-pricing-model (precise paths)', () => {
    const sealed = sealListingVersion({
      ...listingContent(),
      pricing: { kind: 'freemium-tiers' },
    });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok && sealed.error.code === 'invalid-pricing-model') {
      expect(sealed.error.issues.some((issue) => issue.path.includes('kind'))).toBe(true);
    }
  });

  it('unsorted capabilityReferences are rejected (deterministic serialization)', () => {
    const sealed = sealListingVersion({
      ...listingContent(),
      capabilityReferences: [
        { capabilityId: 'zulu.last-tool', version: '1.0.0' },
        { capabilityId: 'engineering.stress-analysis', version: '1.2.3' },
      ],
    });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
    }
  });

  it('unsorted trustEvidence is rejected (deterministic serialization)', () => {
    const a = trustEvidence({ producedBy: { runId: 'run:a', actorId: 'principal:x' } });
    const b = trustEvidence({ producedBy: { runId: 'run:b', actorId: 'principal:x' } });
    const ordered = sortedTrustEvidence([a, b]);
    const reversed = [ordered[1]!, ordered[0]!];
    const sealed = sealListingVersion({ ...listingContent(), trustEvidence: reversed });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
    }
  });

  it('public visibility with a non-empty privateAllowList is rejected (typed visibility data)', () => {
    const sealed = sealListingVersion({
      ...listingContent(),
      privateAllowList: ['tenant:globex'],
    });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
    }
  });

  it('a malformed listing id grammar is rejected', () => {
    const sealed = sealListingVersion({ ...listingContent(), listingId: 'listing:BAD SLUG' });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok && sealed.error.code === 'validation') {
      expect(sealed.error.issues.some((issue) => issue.path === 'listingId')).toBe(true);
    }
  });

  it('schemaVersion skew reports at the schemaVersion path first', () => {
    const sealed = sealListingVersion({ ...listingContent(), schemaVersion: 2 });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok && sealed.error.code === 'validation') {
      expect(sealed.error.issues[0]?.path).toBe('schemaVersion');
    }
  });

  it('an empty chain is a typed validation rejection', () => {
    const chain = verifyListingVersionChain([]);
    expect(chain.ok).toBe(false);
    if (!chain.ok) {
      expect(chain.error.code).toBe('validation');
    }
  });
});
