// Provider-neutrality evidence (acceptance criterion 4): no vendor/IdP
// tokens in the emitted contract surface; no schema property key names
// a vendor, IdP, OAuth/OIDC surface, API endpoint, or credential
// material (architecture lock rule 13).
import { describe, expect, it } from 'vitest';
import { renderIdentityContractFiles } from '../src/index';

// Content-level vendor scan: vendor/IdP names and credential formats
// must never appear in the emitted surface. Credential-MATERIAL field
// names (secret/token/password/...) are covered by the property-key
// scan below — descriptions legitimately SAY "carries no secret".
const BLOCKLIST = [
  'oauth',
  'oidc',
  'saml',
  'okta',
  'auth0',
  'cognito',
  'keycloak',
  'azuread',
  'azure',
  'entra',
  'google',
  'github',
  'gitlab',
  'ldap',
  'active-directory',
  'jwt',
  'bearer',
  'apikey',
  'api-key',
];

describe('identity contract provider neutrality', () => {
  it('contains no vendor- or IdP-specific tokens in any emitted schema or manifest', () => {
    const rendered = renderIdentityContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a vendor, IdP, endpoint, or credential material', () => {
    const rendered = renderIdentityContractFiles();
    const forbiddenKeys =
      /^(provider|vendor|issuer|endpoint|apiUrl|apiKey|secret|token|password|credential|jwt|accessToken|refreshToken)$/i;
    for (const [rel, content] of Object.entries(rendered)) {
      const schema = JSON.parse(content) as unknown;
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) {
          for (const child of node) visit(child);
          return;
        }
        if (node !== null && typeof node === 'object') {
          const record = node as Record<string, unknown>;
          if (
            'properties' in record &&
            record.properties !== null &&
            typeof record.properties === 'object'
          ) {
            for (const key of Object.keys(record.properties as Record<string, unknown>)) {
              expect(forbiddenKeys.test(key), `${rel} declares property "${key}"`).toBe(false);
            }
          }
          for (const child of Object.values(record)) visit(child);
        }
      };
      visit(schema);
    }
  });

  it('the credential-method vocabulary names factor classes, never vendors', () => {
    const rendered = renderIdentityContractFiles();
    const method = JSON.parse(rendered['credential-method.schema.json']!) as {
      $defs: Record<string, { enum?: string[] }>;
    };
    expect(method.$defs['CredentialMethod']?.enum).toEqual([
      'knowledge',
      'possession',
      'inherence',
      'signature',
      'attestation',
    ]);
  });

  it('the principal-kind vocabulary names principal classes, never models or vendors', () => {
    const rendered = renderIdentityContractFiles();
    const kind = JSON.parse(rendered['principal-kind.schema.json']!) as {
      $defs: Record<string, { enum?: string[] }>;
    };
    expect(kind.$defs['PrincipalKind']?.enum).toEqual([
      'human',
      'agent',
      'solver',
      'robot',
      'service',
    ]);
  });
});
