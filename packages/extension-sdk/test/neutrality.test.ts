// Provider-neutrality evidence (acceptance criterion 4): no vendor tokens
// in the emitted contract surface; no schema property key names a
// vendor, framework, model, or API surface (architecture lock rule 13).
import { describe, expect, it } from 'vitest';
import { renderExtensionSdkContractFiles } from '../src/index';

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

describe('extension-sdk contract provider neutrality', () => {
  it('contains no framework- or vendor-specific tokens in any emitted schema or manifest', () => {
    const rendered = renderExtensionSdkContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a vendor, framework, model, or API surface', () => {
    const rendered = renderExtensionSdkContractFiles();
    const forbiddenKeys = /^(provider|vendor|framework|model|modelName|apiUrl|apiKey|endpoint|deployment)$/i;
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
              expect(forbiddenKeys.test(key), `${rel}: forbidden property key "${key}"`).toBe(false);
            }
          }
          for (const child of Object.values(record)) visit(child);
        }
      };
      visit(schema);
    }
  });

  it('the remote service descriptor declares no endpoint or credential field', () => {
    const rendered = renderExtensionSdkContractFiles();
    const schema = JSON.parse(rendered['remote-service-descriptor.schema.json']!) as {
      $defs: Record<string, { properties?: Record<string, unknown> }>;
    };
    const properties = Object.keys(schema.$defs.RemoteServiceDescriptor?.properties ?? {});
    expect(properties.sort()).toEqual(['contract', 'operations', 'serviceId', 'transport']);
  });
});
