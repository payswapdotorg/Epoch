// Provider-neutrality evidence (acceptance criterion 4, lock rule 13): no
// vendor tokens in the emitted contract surface; no schema property key
// names a vendor, deployment, or API surface; tenancy records reject
// embedded provider/deployment fields (strict objects).
import { describe, expect, it } from 'vitest';
import { renderTenancyContractFiles, TenancyNodeSchema, parseTenancyNode } from '../src/index';
import { platformNode } from './helpers';

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
  'keycloak',
];

describe('tenancy contract provider neutrality', () => {
  it('contains no framework- or vendor-specific tokens in any emitted schema or manifest', () => {
    const rendered = renderTenancyContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a vendor, framework, model, or API surface', () => {
    const rendered = renderTenancyContractFiles();
    const forbiddenKeys =
      /^(provider|vendor|framework|model|modelName|apiUrl|apiKey|endpoint|deployment|region|subscription)$/i;
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

  it('strict records reject vendor/deployment fields (no embedded provider metadata)', () => {
    const withDeployment = platformNode({
      deployment: 'acme-cloud-eu',
      vendor: 'acme-tenancy-provider',
    });
    expect(TenancyNodeSchema.safeParse(withDeployment).success).toBe(false);
    expect(parseTenancyNode(withDeployment).ok).toBe(false);
  });
});
