// Listing positives: listing round-trip + immutable publication + hash
// chain verification + capability reference admission (real W007
// registry consumption) + tenant scoping of the developer identity.
import { describe, expect, it } from 'vitest';
import {
  admitCapabilityReferences,
  computeListingVersionDigest,
  parseListingVersionContent,
  verifyListingVersionChain,
  verifySealedListingVersion,
} from '../src/index';
import {
  chainedSecondVersion,
  listingContent,
  registryWithFixtureCapability,
  sealedListing,
} from './fixtures';

describe('listing positives', () => {
  it('a valid listing version content parses and round-trips', () => {
    const parsed = parseListingVersionContent(listingContent());
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.listingId).toBe('listing:stress-suite');
      expect(parsed.value.pricing.kind).toBe('one-time');
    }
  });

  it('sealing computes the canonical content digest (exact-revision addressing)', () => {
    const sealed = sealedListing(listingContent());
    const parsed = parseListingVersionContent(listingContent());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const recomputed = computeListingVersionDigest(parsed.value);
      expect(sealed.contentDigest).toBe(recomputed);
    }
    expect(verifySealedListingVersion(sealed).ok).toBe(true);
  });

  it('publication is immutable: re-sealing identical content yields the identical envelope', () => {
    const first = sealedListing(listingContent());
    const second = sealedListing(listingContent());
    expect(second).toEqual(first);
    expect(second.contentDigest).toBe(first.contentDigest);
  });

  it('a new published version never mutates the prior one (hash chain)', () => {
    const v1 = sealedListing(listingContent());
    const v2Content = chainedSecondVersion(v1.contentDigest);
    const v2 = sealedListing(v2Content);
    // The first envelope is untouched.
    expect(verifySealedListingVersion(v1).ok).toBe(true);
    expect(v2.previousVersionDigest).toBe(v1.contentDigest);
    // And the chain verifies.
    const chain = verifyListingVersionChain([v1, v2]);
    expect(chain.ok, JSON.stringify(chain)).toBe(true);
    if (chain.ok) {
      expect(chain.value.versionCount).toBe(2);
      expect(chain.value.headVersion).toBe('1.1.0');
      expect(chain.value.headDigest).toBe(v2.contentDigest);
    }
  });

  it('the chain verifies regardless of input order (deterministic ordering)', () => {
    const v1 = sealedListing(listingContent());
    const v2 = sealedListing(chainedSecondVersion(v1.contentDigest));
    const forward = verifyListingVersionChain([v1, v2]);
    const backward = verifyListingVersionChain([v2, v1]);
    expect(forward.ok).toBe(true);
    expect(backward.ok).toBe(true);
    if (forward.ok && backward.ok) {
      expect(backward.value).toEqual(forward.value);
    }
  });

  it('capability references resolve against the REAL W007 registry', () => {
    const registry = registryWithFixtureCapability();
    const content = parseListingVersionContent(listingContent());
    expect(content.ok).toBe(true);
    if (content.ok) {
      const admitted = admitCapabilityReferences(content.value.capabilityReferences, registry);
      expect(admitted.ok, JSON.stringify(admitted)).toBe(true);
      if (admitted.ok) {
        expect(admitted.value).toHaveLength(1);
        expect(admitted.value[0]!.manifest.capabilityId).toBe('engineering.stress-analysis');
      }
    }
  });

  it('a three-version chain verifies head-to-tail', () => {
    const v1 = sealedListing(listingContent());
    const v2 = sealedListing(chainedSecondVersion(v1.contentDigest));
    const v3 = sealedListing({
      ...chainedSecondVersion(v2.contentDigest),
      version: '2.0.0',
      publishedAt: '2026-02-10T09:00:05.000Z',
    });
    const chain = verifyListingVersionChain([v1, v2, v3]);
    expect(chain.ok, JSON.stringify(chain)).toBe(true);
    if (chain.ok) {
      expect(chain.value.headVersion).toBe('2.0.0');
    }
  });
});
