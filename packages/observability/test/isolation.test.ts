// THE ISOLATION CHECK (positive + negative): every violation code in
// the fixed check order, conformance positives, and the W008 ceiling
// table enforcement.
import { describe, expect, it } from 'vitest';
import { checkIsolation, SandboxSubjectSchema } from '../src/index';
import type { SandboxSubject } from '../src/index';
import {
  LISTING_ID,
  SOURCE_DIGEST,
  conformingSubject,
} from './fixtures';

/** Parse a loose subject fixture into the typed shape. */
function subjectOf(loose: Record<string, unknown>): SandboxSubject {
  const parsed = SandboxSubjectSchema.safeParse(loose);
  if (!parsed.success) {
    throw new Error(`fixture failed: ${JSON.stringify(parsed.error.issues)}`);
  }
  return parsed.data;
}

import type { IsolationProfile } from '../src/index';

const PROFILE: IsolationProfile = {
  maxTrustClass: 't2',
  allowedFlavors: ['declarative', 'wasm'],
  allowedDataHandling: ['sandbox-only', 'tenant-scoped'],
  requireMarketplaceListing: false,
  quarantineOnViolation: true,
};

describe('isolation check (positive)', () => {
  it('a conforming subject passes with zero violations', () => {
    const verdict = checkIsolation(subjectOf(conformingSubject()), PROFILE);
    expect(verdict.verdict).toBe('conforms');
    expect(verdict.violations).toEqual([]);
  });

  it('the check is deterministic: identical inputs, identical verdicts', () => {
    const subject = subjectOf(conformingSubject());
    const first = checkIsolation(subject, PROFILE);
    const second = checkIsolation(subject, PROFILE);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe('isolation check (negative — every typed violation code)', () => {
  it('trust-class-exceeds-ceiling: a t4 subject under a t2 profile', () => {
    const verdict = checkIsolation(subjectOf(conformingSubject({ trustClass: 't4' })), PROFILE);
    expect(verdict.verdict).toBe('violation');
    expect(verdict.violations.map((v) => v.code)).toContain('trust-class-exceeds-ceiling');
  });

  it('flavor-not-admitted: a remote-flavor subject under a declarative/wasm profile', () => {
    const verdict = checkIsolation(subjectOf(conformingSubject({ flavor: 'remote' })), PROFILE);
    expect(verdict.violations.map((v) => v.code)).toContain('flavor-not-admitted');
  });

  it('data-handling-not-admitted: an external-transfer subject', () => {
    const verdict = checkIsolation(
      subjectOf(conformingSubject({ dataHandling: 'external-transfer' })),
      PROFILE,
    );
    expect(verdict.violations.map((v) => v.code)).toContain('data-handling-not-admitted');
  });

  it('host-function-not-legal: a grant naming an unknown host function', () => {
    const verdict = checkIsolation(
      subjectOf(
        conformingSubject({
          grants: [
            {
              capabilityId: 'capability:terrain-render',
              hostFunctions: ['filesystem.write'],
              resourceScopes: [],
            },
          ],
        }),
      ),
      PROFILE,
    );
    expect(verdict.violations.map((v) => v.code)).toContain('host-function-not-legal');
  });

  it('resource-scope-not-legal: a grant naming an illegal (resource, access) pair', () => {
    const verdict = checkIsolation(
      subjectOf(
        conformingSubject({
          grants: [
            {
              capabilityId: 'capability:terrain-render',
              hostFunctions: ['world.read'],
              resourceScopes: [{ resource: 'world', access: 'write' }],
            },
          ],
        }),
      ),
      PROFILE,
    );
    expect(verdict.violations.map((v) => v.code)).toContain('resource-scope-not-legal');
  });

  it('grant-exceeds-trust-ceiling: a t1 subject with a t2 host function', () => {
    const verdict = checkIsolation(
      subjectOf(
        conformingSubject({
          trustClass: 't1',
          grants: [
            {
              capabilityId: 'capability:terrain-render',
              hostFunctions: ['capability.invoke'],
              resourceScopes: [],
            },
          ],
        }),
      ),
      PROFILE,
    );
    expect(verdict.violations.map((v) => v.code)).toContain('grant-exceeds-trust-ceiling');
  });

  it('grant-exceeds-trust-ceiling: a t0 subject with a storage.write scope', () => {
    const verdict = checkIsolation(
      subjectOf(
        conformingSubject({
          trustClass: 't0',
          grants: [
            {
              capabilityId: 'capability:terrain-render',
              hostFunctions: ['clock.read'],
              resourceScopes: [{ resource: 'storage', access: 'write' }],
            },
          ],
        }),
      ),
      PROFILE,
    );
    expect(verdict.violations.map((v) => v.code)).toContain('grant-exceeds-trust-ceiling');
  });

  it('capability-binding-missing: grants without bindings', () => {
    const verdict = checkIsolation(
      subjectOf(conformingSubject({ bindings: [] })),
      PROFILE,
    );
    expect(verdict.violations.map((v) => v.code)).toContain('capability-binding-missing');
  });

  it('listing-required: a profile requiring a listing reference', () => {
    const verdict = checkIsolation(subjectOf(conformingSubject()), {
      ...PROFILE,
      requireMarketplaceListing: true,
    });
    expect(verdict.violations.map((v) => v.code)).toContain('listing-required');
    // The same subject WITH a listing conforms.
    const conforming = checkIsolation(
      subjectOf(conformingSubject({ listingId: LISTING_ID })),
      { ...PROFILE, requireMarketplaceListing: true },
    );
    expect(conforming.verdict).toBe('conforms');
  });

  it('multiple violations list in the fixed check order (deterministic)', () => {
    const verdict = checkIsolation(
      subjectOf(
        conformingSubject({
          trustClass: 't4',
          flavor: 'remote',
          dataHandling: 'external-transfer',
          bindings: [],
        }),
      ),
      { ...PROFILE, requireMarketplaceListing: true },
    );
    expect(verdict.violations.map((v) => v.code)).toEqual([
      'trust-class-exceeds-ceiling',
      'flavor-not-admitted',
      'data-handling-not-admitted',
      'capability-binding-missing',
      'listing-required',
    ]);
  });

  it('the subject schema rejects vendor fields (lock rule 13)', () => {
    const parsed = SandboxSubjectSchema.safeParse({
      ...conformingSubject(),
      vendorSandbox: 'cloud-run',
    });
    expect(parsed.success).toBe(false);
  });

  it('the subject schema requires the manifest digest grammar', () => {
    const parsed = SandboxSubjectSchema.safeParse({
      ...conformingSubject(),
      extensionManifestDigest: 'not-a-digest',
    });
    expect(parsed.success).toBe(false);
    expect(SOURCE_DIGEST).toMatch(/^[0-9a-f]{64}$/);
  });
});
