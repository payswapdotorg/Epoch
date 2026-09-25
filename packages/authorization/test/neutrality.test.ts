// Provider-neutrality evidence (acceptance criterion 4, lock rule 13): no
// vendor tokens in the emitted contract surface; no schema property key
// names a vendor, framework, model, or API surface; requests and contexts
// reject vendor fields (strict objects).
import { describe, expect, it } from 'vitest';
import {
  AuthorizationContextSchema,
  AuthorizationRequestSchema,
  renderAuthorizationContractFiles,
} from '../src/index';
import { context, request } from './helpers';

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
];

describe('authorization contract provider neutrality', () => {
  it('contains no framework- or vendor-specific tokens in any emitted schema or manifest', () => {
    const rendered = renderAuthorizationContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a vendor, framework, model, or API surface', () => {
    const rendered = renderAuthorizationContractFiles();
    const forbiddenKeys =
      /^(provider|vendor|framework|model|modelName|apiUrl|apiKey|endpoint|deployment|role|roles|permission|permissions)$/i;
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

  it('requests and contexts reject vendor/provider fields (strict objects)', () => {
    expect(
      AuthorizationRequestSchema.safeParse({ ...request(), provider: 'acme-authz' }).success,
    ).toBe(false);
    expect(
      AuthorizationRequestSchema.safeParse({
        ...request(),
        resource: { ...(request().resource as Record<string, unknown>), vendor: 'acme' },
      }).success,
    ).toBe(false);
    expect(
      AuthorizationContextSchema.safeParse({ ...context(), deployment: 'prod-eu' }).success,
    ).toBe(false);
  });

  it('requests reject vendor-shaped action kinds and resource types only by bounds (opaque strings)', () => {
    // Opaque strings with vendor TOKENS are not structurally detectable at
    // the schema layer (they are opaque ids), but the emitted surface never
    // DECLARES a vendor field — asserted above. Bounds parity with the W004
    // policy-target strings is asserted in w004-parity.test.ts.
    expect(
      AuthorizationRequestSchema.safeParse(request({ actionKind: 'x'.repeat(257) })).success,
    ).toBe(false);
    expect(AuthorizationRequestSchema.safeParse(request({ actionKind: '' })).success).toBe(false);
  });
});
