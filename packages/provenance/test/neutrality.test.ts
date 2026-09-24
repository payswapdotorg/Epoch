// Provider-neutrality evidence (acceptance criterion 4): no vendor tokens
// in the emitted contract surface; node kinds stay open slugs.
import { describe, expect, it } from 'vitest';
import { renderProvenanceContractFiles } from '../src/index';

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

describe('provenance contract provider neutrality', () => {
  it('contains no framework- or vendor-specific tokens in any emitted schema or manifest', () => {
    const rendered = renderProvenanceContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a vendor, framework, model, or API surface', () => {
    const rendered = renderProvenanceContractFiles();
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

  it('entity and activity kinds are open slugs (domain packs own the vocabulary)', () => {
    const rendered = renderProvenanceContractFiles();
    const entity = JSON.parse(rendered['provenance-entity.schema.json']!) as {
      $defs: Record<string, { properties?: Record<string, { pattern?: string; enum?: string[] }> }>;
    };
    const activity = JSON.parse(rendered['provenance-activity.schema.json']!) as {
      $defs: Record<string, { properties?: Record<string, { pattern?: string; enum?: string[] }> }>;
    };
    for (const def of Object.values(entity.$defs)) {
      expect(def.properties?.entityKind?.enum, 'entityKind must stay an open slug').toBeUndefined();
    }
    for (const def of Object.values(activity.$defs)) {
      expect(def.properties?.activityKind?.enum, 'activityKind must stay an open slug').toBeUndefined();
    }
  });
});
