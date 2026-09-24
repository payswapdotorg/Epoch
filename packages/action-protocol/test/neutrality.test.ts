// Provider-neutrality evidence for the action protocol surface: no
// framework-, vendor-, or model-specific vocabulary may leak into the
// published contract artifacts, and the authorizer role set is exactly the
// narrow, agent-excluding set required by the authority split.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderActionContractFiles } from '../src/contract-emission';
import { AUTHORIZER_ROLES } from '../src/authorization';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', '..', '..', 'contracts', 'actions');

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

describe('actions contract provider neutrality', () => {
  it('contains no framework- or vendor-specific tokens in any emitted schema or manifest', () => {
    const rendered = renderActionContractFiles();
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

  it('the authorizer role set is exactly {action-gateway, human-approver} — agents excluded', () => {
    const rendered = renderActionContractFiles();
    const role = JSON.parse(rendered['schemas/authorizer-role.schema.json']!) as {
      $defs: { AuthorizerRole: { enum: string[] } };
    };
    expect(role.$defs.AuthorizerRole!.enum).toEqual([...AUTHORIZER_ROLES]);
    // And AuthorizerReference binds its role property to exactly that definition.
    const reference = JSON.parse(rendered['schemas/authorizer-reference.schema.json']!) as {
      $defs: { AuthorizerReference: { properties: { role: { $ref: string } } } };
    };
    expect(reference.$defs.AuthorizerReference!.properties.role!.$ref).toBe(
      '#/$defs/AuthorizerRole',
    );
  });

  it('no schema property key names a vendor, framework, model, or API surface', () => {
    const rendered = renderActionContractFiles();
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

  it('the proposal schema marks all safety-relevant metadata required', () => {
    const rendered = renderActionContractFiles();
    const proposal = JSON.parse(rendered['schemas/action-proposal.schema.json']!) as {
      $defs: { ActionProposal: { required: string[] } };
    };
    const required = proposal.$defs.ActionProposal!.required;
    for (const field of [
      'protocolVersion',
      'messageKind',
      'messageId',
      'createdAt',
      'proposalId',
      'proposedBy',
      'actionType',
      'target',
      'parameters',
      'preconditions',
      'predictedEffects',
      'sideEffects',
      'reversibility',
      'authorityRequirements',
    ]) {
      expect(required, `ActionProposal must require ${field}`).toContain(field);
    }
  });
});
