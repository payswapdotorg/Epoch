// W048 acceptance — THE NAMED NEGATIVE (a): the desktop product cannot
// bypass the Action Gateway.
//
// Four pins:
//  1. the declared IPC semantic surface is EXACTLY the frozen 32-operation
//     Application Gateway vocabulary (set equality BOTH directions);
//  2. the bridge REFUSES every unlisted operation locally — a kernel-style
//     or invented operation never reaches a transport, so there is no
//     syntax for reaching an authority directly;
//  3. a static import scan: no semantic authority is imported anywhere in
//     the native zone outside the SANCTIONED embedded-gateway composition
//     module (the W046 single-process binding);
//  4. the committed native host configs stay pinned to the same surfaces:
//     the Rust operations.rs allowlist mirrors the 32 names, commands.rs +
//     lib.rs register EXACTLY the frozen host-command list, and
//     tauri.conf.json carries the per-OS packaging matrix.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPLICATION_GATEWAY_OPERATION_NAMES } from '@epoch/client-runtime';
import { IPC_GATEWAY_OPERATIONS, IPC_HOST_COMMANDS, isIpcGatewayOperation } from '../src/native/ipc/surface';
import { DesktopIpcBridge, BRIDGE_OPERATION_SURFACE } from '../src/native/ipc/bridge';
import type { GatewayTransport } from '../src/native/ipc/transport';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(here, '..');

/** A recording transport: any call that reaches it is a boundary breach. */
function recordingTransport(): { transport: GatewayTransport; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    transport: {
      kind: 'embedded',
      async call(request) {
        calls.push(request.operation);
        return {
          ok: false,
          error: {
            schemaVersion: 1,
            class: 'unrecoverable',
            code: 'internal-invariant-violated',
            message: 'the recording transport must never be reached in this test',
            operation: request.operation,
            correlationId: request.correlation.correlationId,
            retryable: false,
          },
        };
      },
    },
  };
}

describe('the frozen IPC semantic surface (named negative a)', () => {
  it('is EXACTLY the frozen 32-operation Application Gateway vocabulary (both directions)', () => {
    expect([...IPC_GATEWAY_OPERATIONS].sort()).toEqual([...APPLICATION_GATEWAY_OPERATION_NAMES].sort());
    expect(IPC_GATEWAY_OPERATIONS.length).toBe(32);
    expect(APPLICATION_GATEWAY_OPERATION_NAMES.length).toBe(32);
    expect(BRIDGE_OPERATION_SURFACE.length).toBe(32);
  });

  it('recognizes every frozen name and nothing else', () => {
    for (const name of APPLICATION_GATEWAY_OPERATION_NAMES) {
      expect(isIpcGatewayOperation(name)).toBe(true);
    }
    expect(isIpcGatewayOperation('world.append')).toBe(false);
    expect(isIpcGatewayOperation('solution.seal')).toBe(false);
    expect(isIpcGatewayOperation('kernel.invoke')).toBe(false);
  });
});

describe('the bridge refuses every off-vocabulary operation locally (named negative a)', () => {
  const OFF_VOCABULARY = [
    // Kernel-style operations that do not exist on the gateway surface.
    'world.append',
    'eventLog.append',
    'solution.seal',
    'program.compile',
    // Invented authority shortcuts.
    'action.bypassExecute',
    'action.gateway.direct',
    // Plausible but unlisted variants.
    'session.refresh',
    'world.rebuild',
  ];

  it.each(OFF_VOCABULARY)('refuses "%s" without ever reaching a transport', async (operation) => {
    const { transport, calls } = recordingTransport();
    const bridge = new DesktopIpcBridge({ transport, clock: () => '2026-03-02T09:00:00.000Z' });
    bridge.setContext({
      session: { schemaVersion: 1, sessionId: 'session:test' },
      tenant: { tenantId: 'tenant:nordstrand' },
    });
    const outcome = await bridge.call({ operation, payload: {} });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok && 'error' in outcome) {
      expect(outcome.error.class).toBe('validation');
      expect(outcome.error.code).toBe('operation-unknown');
    }
    expect(calls).toEqual([]);
  });

  it('refuses even with an idempotency key and a session bound (no syntax reaches an authority)', async () => {
    const { transport, calls } = recordingTransport();
    const bridge = new DesktopIpcBridge({ transport, clock: () => '2026-03-02T09:00:00.000Z' });
    bridge.setContext({
      session: { schemaVersion: 1, sessionId: 'session:test' },
      tenant: { tenantId: 'tenant:nordstrand' },
    });
    const outcome = await bridge.call({
      operation: 'action.execute-direct',
      payload: { actionId: 'action:test' },
      idempotencyKey: 'idem:test-1',
      correlationId: 'corr:test-1',
    });
    expect(outcome.ok).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe('the static import scan (named negative a)', () => {
  // The semantic-authority packages: importing any of these from product
  // code would create a path around the Application Gateway.
  const SEMANTIC_AUTHORITIES = [
    '@epoch/action-gateway',
    '@epoch/application-gateway',
    '@epoch/solution-delivery',
    '@epoch/procurement',
    '@epoch/supervision',
    '@epoch/alerts',
    '@epoch/policy-contracts',
    '@epoch/constraint-language',
    '@epoch/world-model',
    '@epoch/event-log',
    '@epoch/evidence',
    '@epoch/authentication',
    '@epoch/object-storage',
  ];
  // The SANCTIONED composition module: the W046 single-process Application
  // Gateway binding (it builds the REAL gateway over the REAL authorities —
  // it IS the gateway deployment, not a bypass).
  const SANCTIONED = ['embedded/embedded-gateway.ts'];

  function listTypeScriptFiles(dir: string): string[] {
    const entries: string[] = [];
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) entries.push(...listTypeScriptFiles(full));
      else if (name.endsWith('.ts')) entries.push(full);
    }
    return entries;
  }

  it('imports no semantic authority outside the sanctioned embedded-gateway composition', () => {
    const nativeRoot = path.join(APP_ROOT, 'src', 'native');
    const files = listTypeScriptFiles(nativeRoot);
    expect(files.length).toBeGreaterThan(10);
    const violations: string[] = [];
    for (const file of files) {
      const relative = path.relative(nativeRoot, file).split(path.sep).join('/');
      if (SANCTIONED.includes(relative)) continue;
      const text = readFileSync(file, 'utf8');
      for (const authority of SEMANTIC_AUTHORITIES) {
        if (text.includes(`from '${authority}'`) || text.includes(`from "${authority}"`)) {
          violations.push(`${relative} imports ${authority}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('the committed native host configs stay pinned (named negative a, config surface)', () => {
  const SRC_TAURI = path.join(APP_ROOT, 'src-tauri');

  it('registers EXACTLY the frozen host-command surface in the Rust host', () => {
    const libSource = readFileSync(path.join(SRC_TAURI, 'src', 'lib.rs'), 'utf8');
    const commandsSource = readFileSync(path.join(SRC_TAURI, 'src', 'commands.rs'), 'utf8');
    for (const command of IPC_HOST_COMMANDS) {
      expect(commandsSource.includes(`pub fn ${command}(`)).toBe(true);
      expect(libSource.includes(`commands::${command},`)).toBe(true);
    }
    // The gateway forwarder is the one addition (the remote transport).
    expect(libSource.includes('commands::epoch_gateway_call,')).toBe(true);
    // No stray command beyond the frozen list + the forwarder.
    const registered = [...libSource.matchAll(/commands::(epoch_[a-z0-9_]+),/g)].map((match) => match[1] ?? '');
    expect([...registered].sort()).toEqual([...IPC_HOST_COMMANDS, 'epoch_gateway_call'].sort());
  });

  it('mirrors the frozen 32-operation vocabulary in the Rust allowlist', () => {
    const operationsSource = readFileSync(path.join(SRC_TAURI, 'src', 'operations.rs'), 'utf8');
    const quoted = [...operationsSource.matchAll(/"([a-z]+[a-zA-Z.]*)"/g)].map((match) => match[1] ?? '');
    const rustAllowlist = quoted.filter((name) => name.includes('.') && !name.startsWith('epoch.'));
    expect(rustAllowlist.sort()).toEqual([...APPLICATION_GATEWAY_OPERATION_NAMES].sort());
  });

  it('carries the per-OS packaging matrix in tauri.conf.json', () => {
    const config = JSON.parse(readFileSync(path.join(SRC_TAURI, 'tauri.conf.json'), 'utf8')) as {
      bundle: Record<string, unknown>;
      build: Record<string, unknown>;
      app: Record<string, unknown>;
    };
    expect(config.build.frontendDist).toBe('../out');
    expect(config.build.devUrl).toBe('http://localhost:4310');
    const bundle = config.bundle as {
      targets: string;
      icon: string[];
      linux: { deb: Record<string, unknown>; appimage: Record<string, unknown> };
      windows: { nsis: Record<string, unknown>; certificateThumbprint: unknown; digestAlgorithm: string; timestampUrl: string };
      macOS: { signingIdentity: unknown; dmg: Record<string, unknown>; minimumSystemVersion: string };
    };
    // Linux: AppImage + Debian-family package.
    expect(bundle.linux.deb.depends).toContain('libwebkit2gtk-4.1-0');
    // Windows: NSIS installer + signing-ready fields.
    expect(bundle.windows.nsis.installMode).toBe('currentUser');
    expect(bundle.windows.digestAlgorithm).toBe('sha256');
    expect(typeof bundle.windows.timestampUrl).toBe('string');
    // macOS: DMG/app bundle + signing/notarization-ready fields.
    expect(bundle.macOS.signingIdentity).toBeNull();
    expect(typeof bundle.macOS.dmg).toBe('object');
    expect(bundle.macOS.minimumSystemVersion).toBe('10.15');
    // The deterministic icon set exists on disk.
    for (const icon of bundle.icon) {
      expect(existsSync(path.join(SRC_TAURI, icon))).toBe(true);
    }
  });

  it('declares the Tauri capability set (core + dialog only)', () => {
    const capability = JSON.parse(readFileSync(path.join(SRC_TAURI, 'capabilities', 'default.json'), 'utf8')) as {
      windows: string[];
      permissions: string[];
    };
    expect(capability.windows).toEqual(['main']);
    expect(capability.permissions).toContain('core:default');
    expect(capability.permissions).toContain('dialog:allow-open');
    expect(capability.permissions).toContain('dialog:allow-save');
  });
});
