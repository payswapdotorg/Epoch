// Provider-neutrality evidence (acceptance criterion 4): no vendor tokens
// in the emitted contract surface; out-of-band locators stay opaque strings.
import { describe, expect, it } from 'vitest';
import { renderEvidenceContractFiles } from '../src/index';

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

describe('evidence contract provider neutrality', () => {
  it('contains no framework- or vendor-specific tokens in any emitted schema or manifest', () => {
    const rendered = renderEvidenceContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a vendor, framework, model, or API surface', () => {
    const rendered = renderEvidenceContractFiles();
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

  it('the out-of-band locator is an opaque free string (no provider URL structure)', () => {
    const rendered = renderEvidenceContractFiles();
    const payload = JSON.parse(rendered['evidence-payload.schema.json']!) as {
      $defs: Record<string, { properties?: Record<string, { pattern?: string; format?: string }> }>;
    };
    for (const def of Object.values(payload.$defs)) {
      const locator = def.properties?.locator;
      if (locator !== undefined) {
        expect(locator.format, 'locator must not assume a URI format').toBeUndefined();
        expect(locator.pattern, 'locator must not assume a provider URL shape').toBeUndefined();
      }
    }
  });
});
