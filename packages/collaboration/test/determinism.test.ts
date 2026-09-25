// Determinism evidence (the W010 pin): identical inputs produce
// identical digests and byte-identical snapshots; no insertion-order
// leaks; ZERO wall-clock reads and ZERO randomness in src (source scan).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CollaborationHub, sealEvent, sealSession } from '../src/index';
import { append, create, joinEvent, presenceEvent, session } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

describe('collaboration determinism', () => {
  it('two hubs fed the same facts emit byte-identical snapshots', () => {
    const build = () => {
      const hub = new CollaborationHub();
      create(hub, session());
      append(hub, joinEvent());
      append(hub, presenceEvent());
      return hub;
    };
    expect(build().snapshot()).toEqual(build().snapshot());
  });

  it('serialization round-trips do not drift', () => {
    const hub = new CollaborationHub();
    create(hub, session());
    append(hub, joinEvent());
    const snapshot = hub.snapshot();
    const roundTripped = JSON.parse(JSON.stringify(snapshot));
    expect(roundTripped).toEqual(snapshot);
    const restored = CollaborationHub.fromSnapshot(roundTripped);
    if (!restored.ok) throw new Error(restored.error.message);
    expect(restored.value.snapshot()).toEqual(snapshot);
  });

  it('sealSession and sealEvent are pure functions of their inputs', () => {
    expect(sealSession(session())).toEqual(sealSession(session()));
    expect(sealEvent(joinEvent())).toEqual(sealEvent(joinEvent()));
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
