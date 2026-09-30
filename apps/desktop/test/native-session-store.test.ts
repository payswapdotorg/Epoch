// W048 acceptance — the platform-safe session store (pin 5).
//
// Session material goes to the SECURE seam ONLY: the memory host models
// the OS-keychain-backed packaged app, and the audit asserts the durable
// store (the local-projection store) NEVER receives the session record.
// Plus the static plaintext pin: the browser host's secure store section
// contains no localStorage usage (the documented memory-only fallback),
// and the persisted record survives restore only when its protocol
// envelope is compatible (the J12 refusal path lives in
// native-protocol-gate.test.ts).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryHostCommands } from '../src/native/ipc/host';
import { DesktopSessionStore, SESSION_SECURE_KEY } from '../src/native/runtime/session-store';
import { sealPersistedRecord } from '../src/native/runtime/protocol-gate';
import type { ClientSession } from '@epoch/client-runtime';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(here, '..');

/** One well-formed client session (the bridge binds this shape). */
function testSession(overrides: Partial<ClientSession> = {}): ClientSession {
  return {
    schemaVersion: 1,
    sessionId: 'session:test-1',
    principalId: 'principal:delivery-lead',
    tenantId: 'tenant:nordstrand',
    projectId: 'project:steel-warehouse-b',
    issuedAt: '2026-03-02T09:00:00.000Z',
    expiresAt: '2026-03-02T21:00:00.000Z',
    ...overrides,
  } as ClientSession;
}

describe('the memory host (the packaged-app secure-seam model)', () => {
  it('separates the secure store from the durable store', async () => {
    const host = new MemoryHostCommands({ platform: 'linux' });
    await host.secure.set('credential:test', 'secret-material');
    expect(await host.secure.get('credential:test')).toBe('secret-material');
    expect(await host.durable.get('credential:test')).toBeNull();
    const durableKeys = await host.durable.keys();
    expect(durableKeys).toEqual([]);
    const secureValue = await host.secure.get('credential:test');
    expect(secureValue).toBe('secret-material');
  });

  it('round-trips the app metadata with the frozen protocol triple', async () => {
    const host = new MemoryHostCommands({ platform: 'macos' });
    const meta = await host.appMeta();
    expect(meta.schemaVersion).toBe(1);
    expect(meta.productVersion).toBe('1.0.0');
    expect(meta.hostProtocolVersion).toBe('1.0.0');
    expect(meta.gatewayContractVersion).toBe('1.0.0');
    expect(meta.platform).toBe('macos');
  });

  it('wipe clears both stores and the audit log', async () => {
    const host = new MemoryHostCommands({ platform: 'linux' });
    await host.secure.set('credential:test', 'secret-material');
    await host.durable.set('epoch.offline.queue.v1', 'projection-record');
    await host.wipeLocalState();
    expect(await host.secure.get('credential:test')).toBeNull();
    expect(await host.durable.keys()).toEqual([]);
    expect(host.durableWriteLog).toEqual([]);
  });
});

describe('the session store (secure seam only, never durable)', () => {
  it('persists the session through the SECURE store and restores it verbatim', async () => {
    const host = new MemoryHostCommands({ platform: 'linux' });
    const store = new DesktopSessionStore(host);
    const session = testSession();
    await store.persist(session);

    // The secure seam carries the protocol-sealed record.
    const secured = await host.secure.get(SESSION_SECURE_KEY);
    expect(secured).not.toBeNull();
    const envelope = JSON.parse(secured ?? '{}') as ReturnType<typeof sealPersistedRecord<ClientSession>>;
    expect(envelope.protocol.gatewayContract).toBe('1.0.0');

    // THE AUDIT: the durable store NEVER received session material.
    const durableKeys = await host.durable.keys();
    expect(durableKeys.includes(SESSION_SECURE_KEY)).toBe(false);
    for (const entry of host.durableWriteLog) {
      expect(entry.value.includes(session.sessionId)).toBe(false);
    }

    // The restore round-trips the session.
    const restored = await store.restore();
    expect('absent' in restored).toBe(false);
    if (!('absent' in restored) && restored.ok) {
      expect(restored.record).toEqual(session);
    }
  });

  it('restores nothing when no session was persisted (fresh install)', async () => {
    const host = new MemoryHostCommands({ platform: 'windows' });
    const store = new DesktopSessionStore(host);
    const restored = await store.restore();
    expect('absent' in restored).toBe(true);
  });

  it('discards an unparseable persisted record (typed absence, never a coerced open)', async () => {
    const host = new MemoryHostCommands({ platform: 'linux' });
    await host.secure.set(SESSION_SECURE_KEY, 'not-json{{');
    const store = new DesktopSessionStore(host);
    const restored = await store.restore();
    expect('absent' in restored).toBe(true);
  });

  it('clear removes the persisted session (sign-out)', async () => {
    const host = new MemoryHostCommands({ platform: 'linux' });
    const store = new DesktopSessionStore(host);
    await store.persist(testSession());
    await store.clear();
    expect(await host.secure.get(SESSION_SECURE_KEY)).toBeNull();
    const restored = await store.restore();
    expect('absent' in restored).toBe(true);
  });
});

describe('the browser host plaintext pin (static)', () => {
  it('keeps localStorage OUT of the secure store section (memory-only fallback)', () => {
    const source = readFileSync(path.join(APP_ROOT, 'src', 'native', 'ipc', 'host.ts'), 'utf8');
    // The BrowserHostCommands class body: from its declaration to the next
    // class/section boundary.
    const start = source.indexOf('export class BrowserHostCommands');
    const end = source.indexOf('function navigatorLanguage');
    expect(start).toBeGreaterThan(-1);
    const browserHost = source.slice(start, end);

    // The secure store field block must contain no web storage reference.
    const secureStart = browserHost.indexOf('private readonly secureMap');
    const secureEnd = browserHost.indexOf('readonly durable');
    const secureSection = browserHost.slice(secureStart, secureEnd);
    expect(secureSection.includes('localStorage')).toBe(false);
    expect(secureSection.includes('sessionStorage')).toBe(false);

    // And the durable block (the sanctioned localStorage use) must carry
    // the epoch.durable prefix only.
    const durableStart = browserHost.indexOf('readonly durable');
    const durableEnd = browserHost.indexOf('async pickOpenFile');
    const durableSection = browserHost.slice(durableStart, durableEnd);
    expect(durableSection.includes("BROWSER_DURABLE_PREFIX + key")).toBe(true);
    const prefixMatch = /BROWSER_DURABLE_PREFIX = '([^']+)'/.exec(source);
    expect(prefixMatch?.[1]).toBe('epoch.durable.');
  });
});
