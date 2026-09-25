// Provider-neutrality evidence (acceptance criterion 4): no vendor
// tokens in the emitted contract surface; no schema property key names
// a vendor, IdP, OAuth/OIDC surface, or API endpoint (architecture lock
// rule 13).
import { describe, expect, it } from 'vitest';
import { renderTenancyContractFiles } from '../src/index';

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
  'openai',
  'anthropic',
  'chatgpt',
  'claude',
  'gemini',
  'aws',
  'gcp',
];

describe('tenancy contract provider neutrality', () => {
  it('contains no vendor- or IdP-specific tokens in any emitted schema or manifest', () => {
    const rendered = renderTenancyContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a vendor, provider, or API surface', () => {
    const rendered = renderTenancyContractFiles();
    const forbiddenKeys =
      /^(provider|vendor|issuer|endpoint|apiUrl|apiKey|region|cloud|tenantObject|principal)$/i;
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

  it('the kind vocabulary names hierarchy levels, never vendors', () => {
    const rendered = renderTenancyContractFiles();
    const kind = JSON.parse(rendered['tenancy-node-kind.schema.json']!) as {
      $defs: Record<string, { enum?: string[] }>;
    };
    expect(kind.$defs['TenancyNodeKind']?.enum).toEqual([
      'platform',
      'tenant',
      'workspace',
      'project',
      'world',
      'scenario',
      'evidence',
    ]);
  });
});
