// NAMED POSITIVE: the DP1.0 pack profile (profile admits through the W036
// path; determinism; round-trip serialization + digest verification).
import { describe, expect, it } from 'vitest';
import {
  admitSoftwarePackProfile,
  softwarePackProfile,
  SOFTWARE_PACK_ID,
  SOFTWARE_PACK_VERSION,
  SOFTWARE_PROJECTION_RULES,
  SOFTWARE_STAGE_VOCABULARY,
  digestPackProfile,
  sealSoftwareProfile,
  verifySoftwareProfile,
} from '../src/index';
import { UNIVERSAL_LIFECYCLE_STAGES } from '@epoch/solution-delivery';
import { TENANT, OTHER_TENANT } from './fixtures';

describe('NAMED POSITIVE: the software pack profile admits through the W036 path', () => {
  it('the profile for a tenant admits through admitPackProfile (DP1.0 acceptance)', () => {
    const profile = softwarePackProfile(TENANT);
    const admitted = admitSoftwarePackProfile(profile);
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.packId).toBe(SOFTWARE_PACK_ID);
      expect(admitted.value.packVersion).toBe(SOFTWARE_PACK_VERSION);
      expect(admitted.value.supportedLifecycleVersion).toBe('1.0.0');
      expect(admitted.value.stageVocabulary['realize']).toBe('Build & Deploy');
    }
  });

  it('the profile binds display vocabulary onto EVERY universal stage (never invents stages)', () => {
    const profile = softwarePackProfile(TENANT);
    expect(Object.keys(profile.stageVocabulary).sort()).toEqual([...UNIVERSAL_LIFECYCLE_STAGES].sort());
    for (const stage of UNIVERSAL_LIFECYCLE_STAGES) {
      expect(profile.stageVocabulary[stage].length).toBeGreaterThan(0);
    }
  });

  it('the profile realizes the Work Order pin: realize -> "Build & Deploy"', () => {
    expect(SOFTWARE_STAGE_VOCABULARY.realize).toBe('Build & Deploy');
  });

  it('the projection rules bind the Navigator projections, sorted and duplicate-free', () => {
    const projections = SOFTWARE_PROJECTION_RULES.map((rule) => rule.projection);
    const sorted = [...projections].sort();
    expect(projections).toEqual(sorted);
    expect(new Set(projections).size).toBe(projections.length);
    expect(projections).toContain('schedule');
    expect(projections).toContain('program-of-work');
    expect(projections).toContain('realization');
    expect(projections).toContain('acquisition');
  });

  it('the profile is deterministic: the same tenant yields the byte-identical profile + digest', () => {
    expect(softwarePackProfile(TENANT)).toEqual(softwarePackProfile(TENANT));
    expect(digestPackProfile(softwarePackProfile(TENANT))).toBe(
      digestPackProfile(softwarePackProfile(TENANT)),
    );
  });

  it('different tenants yield different profiles (tenant-scoped profiles)', () => {
    const a = softwarePackProfile(TENANT);
    const b = softwarePackProfile(OTHER_TENANT);
    expect(a.tenantId).not.toBe(b.tenantId);
    expect(digestPackProfile(a)).not.toBe(digestPackProfile(b));
  });
});

describe('NAMED POSITIVE: sealed profile round-trip + digest verification', () => {
  it('seal -> JSON round-trip -> verify admits the identical envelope', () => {
    const sealed = sealSoftwareProfile(softwarePackProfile(TENANT));
    const roundTripped = verifySoftwareProfile(JSON.parse(JSON.stringify(sealed)));
    expect(roundTripped.ok).toBe(true);
    if (roundTripped.ok) {
      expect(roundTripped.value).toEqual(sealed);
    }
  });

  it('the sealed profile content ALSO admits through the W036 kernel path', () => {
    const sealed = sealSoftwareProfile(softwarePackProfile(TENANT));
    const { contentDigest, ...content } = sealed;
    expect(contentDigest).toMatch(/^[0-9a-f]{64}$/);
    const admitted = admitSoftwarePackProfile(content);
    expect(admitted.ok).toBe(true);
  });
});
