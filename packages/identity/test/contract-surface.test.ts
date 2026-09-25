// Contract surface: the versioned index export and the schema surface
// cover every published data type, and the strict validators reject
// unknown fields (vendor/provider/credential-material leakage).
import { describe, expect, it } from 'vitest';
import * as index from '../src/index';
import { IDENTITY_SCHEMA_SURFACE } from '../src/index';
import { assertion, principal, verifiedResult } from './helpers';

describe('packages/identity contract surface', () => {
  it('exports the version constants', () => {
    expect(index.IDENTITY_CONTRACT_VERSION).toBe('1.0.0');
    expect(index.IDENTITY_RECORD_VERSION).toBe(1);
  });

  it('the schema surface is complete, sorted, and duplicate-free', () => {
    const types = IDENTITY_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toEqual([...types].sort());
    for (const entry of IDENTITY_SCHEMA_SURFACE) {
      expect(typeof entry.schema.safeParse, entry.type).toBe('function');
    }
  });

  it('every surface schema is exported from the index under its name', () => {
    const schemaExportNames: Record<string, string> = {
      AuthenticationReason: 'AuthenticationReasonSchema',
      AuthenticationReasonCode: 'AuthenticationReasonCodeSchema',
      AuthenticationResult: 'AuthenticationResultSchema',
      CredentialAssertion: 'CredentialAssertionSchema',
      CredentialMethod: 'CredentialMethodSchema',
      IdentityRecordVersion: 'IdentityRecordVersionSchema',
      Principal: 'PrincipalSchema',
      PrincipalId: 'PrincipalIdSchema',
      PrincipalKind: 'PrincipalKindSchema',
      PrincipalLifecycleState: 'PrincipalLifecycleStateSchema',
      SealedAuthenticationResult: 'SealedAuthenticationResultSchema',
      SealedCredentialAssertion: 'SealedCredentialAssertionSchema',
      Sha256Digest: 'Sha256DigestSchema',
    };
    for (const [type, exportName] of Object.entries(schemaExportNames)) {
      expect(IDENTITY_SCHEMA_SURFACE.some((entry) => entry.type === type), type).toBe(true);
      expect((index as Record<string, unknown>)[exportName], exportName).toBeDefined();
    }
  });

  it('strict validators reject unknown fields on identity documents', () => {
    expect(index.PrincipalSchema.safeParse({ ...principal(), tenantId: 'tenant:acme' }).success).toBe(false);
    expect(
      index.CredentialAssertionSchema.safeParse({ ...assertion(), issuer: 'https://idp.example' })
        .success,
    ).toBe(false);
    expect(
      index.AuthenticationResultSchema.safeParse({ ...verifiedResult(), ipAddress: '10.0.0.1' })
        .success,
    ).toBe(false);
  });

  it('the principal lifecycle transition table is pinned', () => {
    expect(index.PRINCIPAL_LIFECYCLE_TRANSITIONS.active).toEqual(['suspended', 'disabled']);
    expect(index.PRINCIPAL_LIFECYCLE_TRANSITIONS.suspended).toEqual(['active', 'disabled']);
    expect(index.PRINCIPAL_LIFECYCLE_TRANSITIONS.disabled).toEqual(['active']);
  });
});
