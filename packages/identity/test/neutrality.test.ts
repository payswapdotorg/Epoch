// Provider-neutrality evidence (acceptance criterion 4, lock rule 13): no
// vendor tokens in the emitted contract surface; no schema property key
// names a vendor, protocol product, or API surface; credential assertions
// and authentication results reject secret-shaped fields (strict objects)
// — zero secrets storage.
import { describe, expect, it } from 'vitest';
import {
  AuthenticationResultSchema,
  CredentialAssertionSchema,
  PrincipalSchema,
  renderIdentityContractFiles,
} from '../src/index';
import { assertion, humanPrincipal, verifiedResult } from './helpers';

const BLOCKLIST = [
  'openai',
  'anthropic',
  'chatgpt',
  'gpt-',
  'gpt4',
  'claude',
  'gemini',
  'mistral',
  'llama',
  'azure',
  'bedrock',
  'vertex',
  'huggingface',
  'langchain',
  'langgraph',
  'langsmith',
  'pydantic',
  'pydanticai',
  'autogen',
  'crewai',
  'llamaindex',
  'semantic-kernel',
  'haystack',
  'okta',
  'auth0',
  'keycloak',
  'cognito',
  'authy',
  'azuread',
  'google-oauth',
  'github-oauth',
  'entra',
];

describe('identity contract provider neutrality', () => {
  it('contains no framework- or vendor-specific tokens in any emitted schema or manifest', () => {
    const rendered = renderIdentityContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a vendor, protocol product, or API surface', () => {
    const rendered = renderIdentityContractFiles();
    const forbiddenKeys =
      /^(provider|vendor|framework|model|modelName|apiUrl|apiKey|endpoint|deployment|issuer|audience|clientId|clientSecret|jwksUrl|domain|connection)$/i;
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

  it('credential assertions reject secret-shaped fields (zero secrets storage)', () => {
    for (const secretField of [
      { secret: 'hunter2' },
      { token: 'eyJhbGciOi.example.jwt' },
      { password: 'hunter2' },
      { apiKey: 'sk-live-123' },
      { privateKey: '-----BEGIN PRIVATE KEY-----' },
      { clientSecret: 'hunter2' },
    ]) {
      expect(CredentialAssertionSchema.safeParse({ ...assertion(), ...secretField }).success).toBe(
        false,
      );
    }
  });

  it('authentication results reject vendor/idp fields (strict objects)', () => {
    expect(
      AuthenticationResultSchema.safeParse({ ...verifiedResult(), idp: 'example-vendor' })
        .success,
    ).toBe(false);
    expect(
      AuthenticationResultSchema.safeParse({
        ...verifiedResult(),
        oauthSubject: 'vendor|123',
      }).success,
    ).toBe(false);
  });

  it('principals carry no tenant, membership, or credential material', () => {
    expect(
      PrincipalSchema.safeParse({ ...humanPrincipal(), tenantId: 'tenant:acme' }).success,
    ).toBe(false);
    expect(
      PrincipalSchema.safeParse({ ...humanPrincipal(), workspaces: ['workspace:acme-eng'] })
        .success,
    ).toBe(false);
    expect(
      PrincipalSchema.safeParse({ ...humanPrincipal(), credential: 'hunter2' }).success,
    ).toBe(false);
  });
});
