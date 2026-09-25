// Provider-neutrality evidence (acceptance criterion 4, lock rule 13):
// no vendor tokens in the emitted contract surface or the source; no
// schema property key names a collaboration vendor, transport product,
// or API surface (strict objects reject unknown fields — the
// vendor-smuggling negative).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCollaborationContractFiles, sealEvent, sealSession } from '../src/index';
import { joinEvent, session } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));

const BLOCKLIST = [
  'slack',
  'discord',
  'teams',
  'zoom',
  'figma',
  'miro',
  'liveblocks',
  'yjs',
  'automerge',
  'ot-js',
  'shareddb',
  'pusher',
  'ably',
  'pubnub',
  'websocket',
  'socket.io',
  'socketio',
  'webrtc',
  'janus',
  'twilio',
  'firebase',
  'supabase',
  'openai',
  'anthropic',
];

describe('collaboration contract provider neutrality', () => {
  it('the emitted contract artifacts contain no vendor tokens', () => {
    const files = renderCollaborationContractFiles();
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
      { slackChannel: '#design' },
      { liveblocksRoom: 'room-42' },
      { transport: 'websocket' },
      { cursorColor: '#ff0000' },
    ]) {
      const sealedSession = sealSession(session(vendorField));
      expect(sealedSession.ok, JSON.stringify(vendorField)).toBe(false);
      const sealedEvent = sealEvent(joinEvent(vendorField));
      expect(sealedEvent.ok, JSON.stringify(vendorField)).toBe(false);
    }
  });
});
