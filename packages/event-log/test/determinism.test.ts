// Determinism evidence (the W010 pin): identical inputs produce
// identical digests and byte-identical snapshots; no insertion-order
// leaks; ZERO wall-clock reads and ZERO randomness in src (source scan).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventLog, sealEvent } from '../src/index';
import { appended, firstEvent, secondEvent, thirdEvent } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

describe('event-log determinism', () => {
  it('two logs fed the same events emit byte-identical snapshots', () => {
    const build = () => {
      const log = new EventLog();
      appended(log, firstEvent());
      appended(log, secondEvent());
      appended(log, thirdEvent());
      return log;
    };
    expect(build().snapshot()).toEqual(build().snapshot());
  });

  it('serialization round-trips do not drift (JSON.parse(JSON.stringify))', () => {
    const log = new EventLog();
    appended(log, firstEvent());
    appended(log, secondEvent());
    const snapshot = log.snapshot();
    const roundTripped = JSON.parse(JSON.stringify(snapshot));
    expect(roundTripped).toEqual(snapshot);
    // And the restore of the round-tripped snapshot equals the original.
    const restored = EventLog.fromSnapshot(roundTripped);
    if (!restored.ok) throw new Error(restored.error.message);
    expect(restored.value.snapshot()).toEqual(snapshot);
  });

  it('sealEvent is a pure function of the event content', () => {
    const a = sealEvent(firstEvent());
    const b = sealEvent(firstEvent());
    expect(a).toEqual(b);
  });

  it('src contains ZERO wall-clock reads and ZERO randomness', () => {
    const forbidden = [
      /Date\.now/,
      /new Date\(/,
      /Math\.random/,
      /performance\.now/,
      /process\.hrtime/,
      /crypto\.randomUUID/,
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
});
