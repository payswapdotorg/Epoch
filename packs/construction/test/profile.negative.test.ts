// NAMED NEGATIVE: profile admission — second lifecycle authority
// (authority-violation-rejected), malformed profiles, tampered digests.
import { describe, expect, it } from 'vitest';
import {
  admitConstructionPackProfile,
  constructionPackProfile,
  sealConstructionProfile,
  verifyConstructionProfile,
} from '../src/index';
import { TENANT } from './fixtures';

/** Build a profile as loose JSON with overrides (the W036 helpers pattern). */
function profile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...constructionPackProfile(TENANT), ...overrides } as Record<string, unknown>;
}

describe('NAMED NEGATIVE: second lifecycle authority (authority-violation-rejected)', () => {
  it('a profile claiming lifecycleAuthority is rejected', () => {
    const admitted = admitConstructionPackProfile(profile({ lifecycleAuthority: true }));
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('authority-violation-rejected');
    }
  });

  it('a profile claiming scheduleAuthority is rejected (the BOQ is a projection)', () => {
    const admitted = admitConstructionPackProfile(profile({ scheduleAuthority: true }));
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('authority-violation-rejected');
    }
  });

  it('a profile declaring a mutableActual substitute is rejected (DP1.0 forbidden list)', () => {
    const admitted = admitConstructionPackProfile(profile({ mutableActual: true }));
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('authority-violation-rejected');
    }
  });

  it('a profile binding a NON-UNIVERSAL stage key is rejected (packs never invent stages)', () => {
    const admitted = admitConstructionPackProfile(
      profile({
        stageVocabulary: { plan: 'Construction programming', 'boq-generation': 'BOQ generation' },
      }),
    );
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('authority-violation-rejected');
    }
  });
});

describe('NAMED NEGATIVE: malformed profiles (validation / vendor fields)', () => {
  it('a profile targeting the WRONG universal lifecycle version is rejected', () => {
    const admitted = admitConstructionPackProfile(profile({ supportedLifecycleVersion: '2.0.0' }));
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('validation');
      if (admitted.error.code === 'validation') {
        expect(admitted.error.issues.some((issue) => issue.path === 'supportedLifecycleVersion')).toBe(true);
      }
    }
  });

  it('a profile with unsorted projectionRules is rejected (deterministic serialization)', () => {
    const admitted = admitConstructionPackProfile(
      profile({
        projectionRules: [
          { projection: 'schedule', presentation: 'BOQ' },
          { projection: 'acquisition', presentation: 'Procurement register' },
        ],
      }),
    );
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('validation');
    }
  });

  it('a profile with duplicate projectionRules is rejected', () => {
    const admitted = admitConstructionPackProfile(
      profile({
        projectionRules: [
          { projection: 'schedule', presentation: 'BOQ' },
          { projection: 'schedule', presentation: 'Bill of quantities' },
        ],
      }),
    );
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('validation');
    }
  });

  it('a profile with a vendor field is rejected (vendor-fields-rejected)', () => {
    const admitted = admitConstructionPackProfile(profile({ vendorPortal: 'supplier-hub' }));
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('vendor-fields-rejected');
    }
  });

  it('a profile with a malformed packVersion is rejected', () => {
    const admitted = admitConstructionPackProfile(profile({ packVersion: '1.0' }));
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('validation');
    }
  });
});

describe('NAMED NEGATIVE: tampered profile digest (digest-mismatch)', () => {
  it('a flipped field in the sealed profile fails digest verification', () => {
    const sealed = sealConstructionProfile(constructionPackProfile(TENANT));
    const tampered = { ...sealed, packVersion: '9.9.9' };
    const verified = verifyConstructionProfile(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('a flipped stage term in the sealed profile fails digest verification', () => {
    const sealed = sealConstructionProfile(constructionPackProfile(TENANT));
    const tampered = {
      ...sealed,
      stageVocabulary: { ...sealed.stageVocabulary, realize: 'Site works' },
    };
    const verified = verifyConstructionProfile(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });
});
