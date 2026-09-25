// Provider-neutrality evidence (acceptance criterion 4, lock rule 13):
// no vendor tokens in the emitted contract surface or the package
// source.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReplayContractFiles } from '../src/index';

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
  'gcp',
  'azure',
  'redis',
  'debezium',
  'pubsub',
  'firebase',
  'supabase',
  'openai',
  'anthropic',
  'claude',
  'gemini',
  'kafkaoffset',
];

describe('replay contract provider neutrality', () => {
  it('the emitted contract artifacts contain no vendor tokens', () => {
    const files = renderReplayContractFiles();
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
});
