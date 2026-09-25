// Provider-neutrality evidence (acceptance criterion 2/4, lock rule 13):
// no vendor tokens in the emitted contract surface or the source; no
// schema property key names a model provider, LLM vendor, or API surface
// (strict objects reject unknown fields — the vendor-smuggling negative).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderAgentOrchestrationContractFiles, bindOrchestratedAgent } from '../src/index';
import { agentFixture, fixtureRegistry } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));

const BLOCKLIST = [
  'kafka',
  'postgres',
  'postgresql',
  'mysql',
  'mongo',
  'dynamodb',
  'nats',
  'rabbitmq',
  'eventstore',
  'eventstoredb',
  'aws',
  'sqs',
  'sns',
  'gcp',
  'azure',
  'redis',
  'consul',
  'zookeeper',
  'debezium',
  'pubsub',
  'pub/sub',
  'firebase',
  'supabase',
  'prisma',
  'openai',
  'anthropic',
  'claude',
  'gemini',
  'gpt',
  'llm',
  'copilot',
  'mistral',
  'llama',
  'bedrock',
  'vertex',
  'vercel',
  'cloudflare',
];

describe('agent-orchestration contract provider neutrality', () => {
  it('the emitted contract artifacts contain no vendor tokens', () => {
    const files = renderAgentOrchestrationContractFiles();
    for (const [name, content] of Object.entries(files)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${name} must not contain "${token}"`).toBe(false);
      }
    }
  });

  it('the package source contains no vendor tokens', () => {
    const src = readFileSync(path.resolve(here, '..', 'src', 'index.ts'), 'utf8').toLowerCase();
    for (const token of BLOCKLIST) {
      expect(src.includes(token)).toBe(false);
    }
  });

  it('strict objects reject vendor/model envelope extensions on agent descriptors', () => {
    for (const vendorField of [
      { provider: 'acme-cloud' },
      { model: 'model-x-1' },
      { apiKey: 'sk-live-000' },
      { baseUrl: 'https://api.example.invalid' },
      { temperature: 0.7 },
    ]) {
      const bound = bindOrchestratedAgent({
        agent: agentFixture(vendorField),
        registry: fixtureRegistry(),
      });
      expect(bound.ok, JSON.stringify(vendorField)).toBe(false);
      if (!bound.ok) {
        expect(bound.error.code).toBe('validation');
      }
    }
  });
});
