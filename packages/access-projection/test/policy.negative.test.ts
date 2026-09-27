// Projection-policy negative evidence: malformed policies are rejected
// (typed `validation`), vendor fields are `vendor-fields-rejected`,
// authority claims are `authority-violation-rejected`, tampered digests
// are `digest-mismatch`, cross-tenant registration is
// `tenant-isolation-rejected`, revision-chain violations are
// `version-conflict` / `lifecycle-conflict`.
import { describe, expect, it } from 'vitest';
import {
  admitProjectionPolicy,
  canonicalDigest,
  openAccessProjectionStore,
  sealProjectionPolicy,
} from '../src/index';
import { expectError, unwrap } from './helpers';
import { TENANT, OTHER_TENANT, standardPolicyContent } from './fixtures';

describe('malformed policy rejected (typed validation, never an implicit accept)', () => {
  it('a revision of zero is rejected', () => {
    const error = expectError(
      sealProjectionPolicy(standardPolicyContent({ revision: 0 })),
      'validation',
    );
    expect(JSON.stringify(error)).toContain('revision');
  });

  it('a binding without view is rejected (a row that cannot view cannot project)', () => {
    const error = expectError(
      sealProjectionPolicy(
        standardPolicyContent({
          bindings: [
            {
              selector: { principalKind: 'human', role: 'role:client-viewer' },
              objectClass: 'program-of-work',
              allowedActions: ['export'],
              fieldAllowlist: ['title'],
              redactionRules: [],
              defaultRedactionClass: 'policy-scoped',
              scopeFilters: { evidence: { mode: 'all' }, commercial: 'visible', supplier: 'visible' },
            },
          ],
        }),
      ),
      'validation',
    );
    expect(JSON.stringify(error)).toContain('view');
  });

  it('an unsorted field allowlist is rejected (deterministic serialization)', () => {
    const error = expectError(
      sealProjectionPolicy(
        standardPolicyContent({
          bindings: [
            {
              selector: { principalKind: 'human', role: 'role:client-viewer' },
              objectClass: 'program-of-work',
              allowedActions: ['view'],
              fieldAllowlist: ['title', 'schema'],
              redactionRules: [],
              defaultRedactionClass: 'policy-scoped',
              scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
            },
          ],
        }),
      ),
      'validation',
    );
    expect(JSON.stringify(error)).toContain('sorted');
  });

  it('an empty field allowlist is rejected (minimum-necessary is never zero-necessary)', () => {
    expectError(
      sealProjectionPolicy(
        standardPolicyContent({
          bindings: [
            {
              selector: { principalKind: 'human', role: 'role:client-viewer' },
              objectClass: 'program-of-work',
              allowedActions: ['view'],
              fieldAllowlist: [],
              redactionRules: [],
              defaultRedactionClass: 'policy-scoped',
              scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
            },
          ],
        }),
      ),
      'validation',
    );
  });

  it('a listed evidence scope with no digests is rejected', () => {
    expectError(
      sealProjectionPolicy(
        standardPolicyContent({
          bindings: [
            {
              selector: { principalKind: 'human', role: 'role:client-viewer' },
              objectClass: 'program-of-work',
              allowedActions: ['view'],
              fieldAllowlist: ['title'],
              redactionRules: [],
              defaultRedactionClass: 'policy-scoped',
              scopeFilters: {
                evidence: { mode: 'listed', allowedDigests: [] },
                commercial: 'hidden',
                supplier: 'hidden',
              },
            },
          ],
        }),
      ),
      'validation',
    );
  });

  it('an unknown object class is rejected (the closed W036 set)', () => {
    expectError(
      sealProjectionPolicy(
        standardPolicyContent({
          bindings: [
            {
              selector: { principalKind: 'human', role: 'role:client-viewer' },
              objectClass: 'invoice-ledger',
              allowedActions: ['view'],
              fieldAllowlist: ['title'],
              redactionRules: [],
              defaultRedactionClass: 'policy-scoped',
              scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
            },
          ],
        }),
      ),
      'validation',
    );
  });

  it('duplicate bindings for one selector x object class are rejected', () => {
    const row = {
      selector: { principalKind: 'human', role: 'role:client-viewer' },
      objectClass: 'program-of-work',
      allowedActions: ['view'],
      fieldAllowlist: ['title'],
      redactionRules: [],
      defaultRedactionClass: 'policy-scoped',
      scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
    };
    expectError(
      sealProjectionPolicy(standardPolicyContent({ bindings: [row, { ...row }] })),
      'validation',
    );
  });

  it('a vendor field on a policy is vendor-fields-rejected', () => {
    const error = expectError(
      sealProjectionPolicy({
        ...standardPolicyContent(),
        oktaDomain: 'example.okta.com',
      }),
      'vendor-fields-rejected',
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });
});

describe('authority-violation-rejected (a projection layer is never an authority)', () => {
  it('a forbidden authority-claim field is classified BEFORE schema validation', () => {
    for (const field of ['lifecycleAuthority', 'baselineAuthority', 'scheduleAuthority']) {
      const error = expectError(
        admitProjectionPolicy(
          unwrap(openAccessProjectionStore({ tenantId: TENANT })),
          { ...standardPolicyContent(), [field]: true },
        ),
        'authority-violation-rejected',
      );
      expect(error.code).toBe('authority-violation-rejected');
      if (error.code === 'authority-violation-rejected') {
        expect(error.field).toBe(field);
      }
    }
  });
});

describe('tampered digest / tenant isolation / revision chain', () => {
  it('a tampered policy digest is digest-mismatch', () => {
    const sealed = unwrap(sealProjectionPolicy(standardPolicyContent()));
    const tampered = { ...sealed, contentDigest: 'e'.repeat(64) };
    const error = expectError(
      admitProjectionPolicy(unwrap(openAccessProjectionStore({ tenantId: TENANT })), tampered),
      'digest-mismatch',
    );
    if (error.code === 'digest-mismatch') {
      expect(error.encountered).toBe('e'.repeat(64));
      expect(error.expected).toBe(sealed.contentDigest);
    }
  });

  it('a cross-tenant policy is tenant-isolation-rejected', () => {
    const sealed = unwrap(
      sealProjectionPolicy(standardPolicyContent({ tenantId: OTHER_TENANT })),
    );
    const error = expectError(
      admitProjectionPolicy(unwrap(openAccessProjectionStore({ tenantId: TENANT })), sealed),
      'tenant-isolation-rejected',
    );
    if (error.code === 'tenant-isolation-rejected') {
      expect(error.expectedTenantId).toBe(TENANT);
      expect(error.encounteredTenantId).toBe(OTHER_TENANT);
    }
  });

  it('the same revision with different content is version-conflict (never an overwrite)', () => {
    const store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    const rev1 = unwrap(sealProjectionPolicy(standardPolicyContent()));
    const registered = unwrap(admitProjectionPolicy(store, rev1));
    const divergent = unwrap(
      sealProjectionPolicy(standardPolicyContent({ title: 'A different content' })),
    );
    const error = expectError(admitProjectionPolicy(registered.store, divergent), 'version-conflict');
    if (error.code === 'version-conflict') {
      expect(error.expectedDigest).toBe(rev1.contentDigest);
      expect(error.encounteredDigest).toBe(divergent.contentDigest);
    }
  });

  it('a gapped revision is lifecycle-conflict (the chain is append-only and gap-free)', () => {
    const store = unwrap(openAccessProjectionStore({ tenantId: TENANT }));
    const rev1 = unwrap(sealProjectionPolicy(standardPolicyContent()));
    const registered = unwrap(admitProjectionPolicy(store, rev1));
    const rev3 = unwrap(sealProjectionPolicy(standardPolicyContent({ revision: 3 })));
    expectError(admitProjectionPolicy(registered.store, rev3), 'lifecycle-conflict');
  });

  it('a policy digest is the canonical SHA-256 of its content (content addressing)', () => {
    const content = standardPolicyContent();
    const sealed = unwrap(sealProjectionPolicy(content));
    const { contentDigest, ...rest } = sealed;
    expect(contentDigest).toBe(canonicalDigest(rest));
  });
});
