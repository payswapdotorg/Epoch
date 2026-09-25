// Provider-neutrality evidence (acceptance criterion 4, lock rule 13):
// no vendor tokens in the emitted contract surface or the source; no
// schema property key names a provider, broker, database or API surface
// (strict objects reject unknown fields — the vendor-smuggling negative).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderEventLogContractFiles, sealEvent } from '../src/index';
import { firstEvent } from './helpers';

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
  'vercel',
  'cloudflare',
];

describe('event-log contract provider neutrality', () => {
  it('the emitted contract artifacts contain no vendor tokens', () => {
    const files = renderEventLogContractFiles();
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

  it('strict objects reject vendor envelope extensions', () => {
    for (const vendorField of [
      { kafkaOffset: 42 },
      { _cloudEventId: 'urn:x' },
      { producer: 'confluent' },
      { partitionKey: 'world-a' },
    ]) {
      const sealed = sealEvent(firstEvent(vendorField));
      expect(sealed.ok, JSON.stringify(vendorField)).toBe(false);
      if (!sealed.ok) {
        expect(sealed.error.code).toBe('validation');
      }
    }
  });
});
