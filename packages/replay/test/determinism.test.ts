// Determinism evidence (the W010 pin): ZERO wall-clock reads and ZERO
// randomness in src (source scan); fold results are pure functions of
// (log, stream set, spec).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { foldStream } from '../src/index';
import { countersSpec, logWithThreeEvents, unwrapFold } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

describe('replay determinism', () => {
  it('src contains ZERO wall-clock reads and ZERO randomness', () => {
    const forbidden = [
      /Date\.now/,
      /new Date\(/,
      /Math\.random/,
      /performance\.now/,
      /process\.hrtime/,
      /crypto\.randomUUID/,
      /localeCompare/,
    ];
    const violations: string[] = [];
    for (const file of readdirSync(SRC_DIR)) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(path.join(SRC_DIR, file), 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(source)) {
          violations.push(`${file}: /${pattern.source}/`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('the fold is a pure function of the log (repeated folds identical)', () => {
    const log = logWithThreeEvents();
    const first = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    const second = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    const third = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    expect(new Set([first.stateDigest, second.stateDigest, third.stateDigest]).size).toBe(1);
  });

  it('timestamps come from EVENT PAYLOAD DATA, never from a clock read', () => {
    // The reconstructed state derives from event content only: two logs
    // whose events carry the SAME instants (in different append orders
    // per stream) fold identically. (Proven structurally by the fold
    // engine's pure reducers; this test pins the trace payload.)
    const log = logWithThreeEvents();
    const folded = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    expect(folded.appliedOrder.length).toBe(3);
    const records = log.readStream('stream:world-a');
    if (!records.ok) throw new Error(records.error.message);
    // Every folded event carries its own producer-supplied instant.
    for (const record of records.value) {
      expect(record.event.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });
});
