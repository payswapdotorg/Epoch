// Provider-neutrality evidence (acceptance criterion 2/4, lock rule 13):
// no vendor tokens in the service source; vendor/model/provider fields
// are structurally rejected at every typed boundary (agents, plans,
// events); the host carries no provider vocabulary.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRuntime } from '../src/index';
import {
  SESSION_ID,
  TENANT,
  T1,
  agentFixture,
  fixtureRegistry,
  fixtureRuntime,
  lifecycleEventFixture,
  startedSession,
} from './helpers';

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

describe('agent-runtime provider neutrality', () => {
  it('the service source contains no vendor tokens', () => {
    for (const file of readdirSrc()) {
      const lower = file.content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${file.name} must not contain "${token}"`).toBe(false);
      }
    }
  });

  it('strict boundaries reject vendor/model fields on agent descriptors', () => {
    const runtime = new AgentRuntime();
    for (const vendorField of [
      { provider: 'acme-cloud' },
      { model: 'model-x-1' },
      { apiKey: 'sk-live-000' },
      { baseUrl: 'https://api.example.invalid' },
      { temperature: 0.7 },
    ]) {
      const bound = runtime.bindAgent({
        tenantId: TENANT,
        agent: agentFixture(vendorField),
        registry: fixtureRegistry(),
      });
      expect(bound.ok, JSON.stringify(vendorField)).toBe(false);
      if (!bound.ok) {
        expect(bound.error.code).toBe('validation');
      }
    }
  });

  it('strict boundaries reject vendor envelope extensions on ingested events', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const event = lifecycleEventFixture({ phase: 'executed', sequence: 1 }) as unknown as Record<
      string,
      unknown
    >;
    const smuggled = {
      ...event,
      extraVendorField: { producer: 'confluent', kafkaOffset: 42 },
    };
    const ingested = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: smuggled,
      at: T1,
    });
    expect(ingested.ok).toBe(false);
    if (!ingested.ok) {
      expect(ingested.error.code).toBe('validation');
    }
  });
});

function readdirSrc(): Array<{ name: string; content: string }> {
  const dir = path.resolve(here, '..', 'src');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => ({ name: file, content: readFileSync(path.join(dir, file), 'utf8') }));
}
