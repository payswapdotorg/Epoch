// Provider-neutrality evidence (acceptance criterion 4): no vendor tokens
// in the emitted contract surface; no schema property key names a vendor,
// framework, model, or API surface (architecture lock rule 13); the SDK
// ships zero concrete adapters (verified structurally in the surface test).
import { describe, expect, it } from 'vitest';
import { renderAdapterSdkContractFiles } from '../src/index';

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
  'github',
  'ifc',
  'mcp',
  'fmi',
];

describe('adapter-sdk contract provider neutrality', () => {
  it('contains no framework- or vendor-specific tokens in any emitted schema or manifest', () => {
    const rendered = renderAdapterSdkContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a vendor, framework, model, or API surface', () => {
    const rendered = renderAdapterSdkContractFiles();
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

  it('the action-failure vocabulary is neutral (no execution-product names)', () => {
    const rendered = renderAdapterSdkContractFiles();
    const payload = JSON.parse(rendered['action-response-payload.schema.json']!) as unknown;
    // Collect every enum array anywhere in the emitted document.
    const enums: string[][] = [];
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (const child of node) visit(child);
        return;
      }
      if (node !== null && typeof node === 'object') {
        const record = node as Record<string, unknown>;
        if (Array.isArray(record.enum) && record.enum.every((v) => typeof v === 'string')) {
          enums.push(record.enum as string[]);
        }
        for (const child of Object.values(record)) visit(child);
      }
    };
    visit(payload);
    expect(enums.some((value) => value.includes('precondition-not-met'))).toBe(true);
    for (const value of enums.flat()) {
      expect(/^[a-z-]+$/.test(value), `failure code "${value}" must be kebab-case neutral`).toBe(
        true,
      );
    }
  });
});
