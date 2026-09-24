// Provider-neutrality evidence: no framework-, vendor-, or model-specific
// vocabulary may leak into the published contract surface — neither into
// the emitted JSON Schemas nor into the TypeScript declarations. The agent
// protocol must represent a human, a deterministic solver, and an LLM agent
// without protocol changes.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderAgentContractFiles } from '../src/contract-emission';
import { EXECUTOR_KINDS } from '../src/registration';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', '..', '..', 'contracts', 'agent');

/**
 * Provider/framework blocklist — none of these tokens may appear anywhere
 * in the published contract artifacts. The neutral word "provider" itself
 * is allowed (it appears in "provider-neutral" documentation language).
 */
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
  'typescript-eslint', // tooling names are equally forbidden in the contract
];

describe('agent contract provider neutrality', () => {
  it('contains no framework- or vendor-specific tokens in any emitted schema or manifest', () => {
    const rendered = renderAgentContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('contains no framework- or vendor-specific tokens in the TypeScript declarations', () => {
    const source = readFileSync(path.join(CONTRACTS_DIR, 'index.d.ts'), 'utf8').toLowerCase();
    for (const token of BLOCKLIST) {
      expect(source.includes(token), `index.d.ts contains "${token}"`).toBe(false);
    }
  });

  it('executor schema properties are exactly {kind, deterministic}', () => {
    const rendered = renderAgentContractFiles();
    const executor = JSON.parse(
      rendered['schemas/executor.schema.json']!,
    ) as { $defs: { Executor: { properties: Record<string, unknown> } } };
    expect(Object.keys(executor.$defs.Executor!.properties).sort()).toEqual([
      'deterministic',
      'kind',
    ]);
  });

  it('executor kinds are exactly the neutral set (human/program/model/hybrid)', () => {
    const rendered = renderAgentContractFiles();
    const kind = JSON.parse(rendered['schemas/executor-kind.schema.json']!) as {
      $defs: { ExecutorKind: { enum: string[] } };
    };
    expect([...kind.$defs.ExecutorKind!.enum].sort()).toEqual([...EXECUTOR_KINDS].sort());
  });

  it('no schema property key names a vendor, framework, model, or API surface', () => {
    const rendered = renderAgentContractFiles();
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

  it('registration schema marks the safety-relevant declarations required', () => {
    const rendered = renderAgentContractFiles();
    const registration = JSON.parse(
      rendered['schemas/agent-registration.schema.json']!,
    ) as { $defs: { AgentRegistration: { required: string[] } } };
    const required = registration.$defs.AgentRegistration!.required;
    for (const field of [
      'protocolVersion',
      'messageKind',
      'messageId',
      'createdAt',
      'agentId',
      'executor',
      'capabilities',
      'authority',
      'costProfile',
      'latencyProfile',
      'evidenceRequirements',
    ]) {
      expect(required).toContain(field);
    }
  });
});
