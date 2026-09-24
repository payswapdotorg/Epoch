// Provider-neutrality evidence (acceptance criterion 4): no framework-,
// vendor-, or model-specific vocabulary may leak into the published
// contract surface, and no schema property key names a provider surface.
// Provider-specific logic belongs behind adapters, never in kernel types
// (architecture lock rule 13). Mirrors the W003 neutrality tests.
import { describe, expect, it } from 'vitest';
import { renderVerificationContractFiles } from '../src/index';

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
];

describe('verification contract provider neutrality', () => {
  it('contains no framework- or vendor-specific tokens in any emitted schema or manifest', () => {
    const rendered = renderVerificationContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a vendor, framework, model, or API surface', () => {
    const rendered = renderVerificationContractFiles();
    const forbiddenKeys =
      /^(provider|vendor|framework|model|modelName|apiUrl|apiKey|endpoint|deployment)$/i;
    for (const [rel, content] of Object.entries(rendered)) {
      const schema = JSON.parse(content) as unknown;
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) {
          for (const child of node) visit(child);
          return;
        }
        if (node !== null && typeof node === 'object') {
          const record = node as Record<string, unknown>;
          if ('properties' in record && record.properties !== null && typeof record.properties === 'object') {
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

  it('chain identifiers stay opaque (no structured vendor-ish id pattern in the schemas)', () => {
    const rendered = renderVerificationContractFiles();
    const chain = JSON.parse(rendered['verification-chain.schema.json']!) as {
      $defs: Record<string, { properties?: Record<string, { pattern?: string }> }>;
    };
    for (const def of Object.values(chain.$defs)) {
      for (const [key, property] of Object.entries(def.properties ?? {})) {
        if (/Id$/.test(key)) {
          expect(property.pattern, `property ${key} must not encode a vendor id structure`).toBeUndefined();
        }
      }
    }
  });
});
