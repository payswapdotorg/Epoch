// The W049 platform seams + the digest-addressing invariant battery:
//   - the secure store: the seam contract, the closed key vocabulary, the
//     structural platform binding, and the no-plaintext discipline (the
//     session persists ONLY through the secure store — nothing
//     session-shaped ever touches another storage surface);
//   - the camera: the seam contract, the scripted determinism;
//   - the digest-addressing invariant: the digest is computed BEFORE
//     upload, the AUTHORITY recomputes it server-side, the records
//     reference the digest (never a local path/bytes), and a client/
//     authority digest divergence is a typed defect signal.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MemoryCameraPort } from '../../src/product/camera';
import { MemorySecureStore, SECURE_STORE_KEYS } from '../../src/product/secure-store';
import { sha256Hex } from '../../src/product/sha256';
import { captureEvidence } from '../../src/product/evidence-capture';
import { GatewayClient, CorrelationSequence } from '../../src/product/gateway-client';
import { buildSignedInHost, fieldUncertainty, photoFrame, quantityMeasure, T12 } from './helpers';

describe('the secure store seam (W049 pin 6: tokens NEVER in AsyncStorage/plaintext)', () => {
  it('the memory implementation satisfies the port contract (get/set/delete/has)', async () => {
    const store = new MemorySecureStore();
    expect(await store.getItem('epoch.field.session')).toBeUndefined();
    await store.setItem('epoch.field.session', 'value-1');
    expect(await store.getItem('epoch.field.session')).toBe('value-1');
    expect(await store.hasItem('epoch.field.session')).toBe(true);
    await store.deleteItem('epoch.field.session');
    expect(await store.hasItem('epoch.field.session')).toBe(false);
    // Absent-key deletes are a no-op.
    await store.deleteItem('epoch.field.session');
  });

  it('the closed key vocabulary: only the sanctioned keys are ever used', async () => {
    expect(SECURE_STORE_KEYS).toContain('epoch.field.session');
    const bundle = await buildSignedInHost();
    expect(await bundle.secureStore.usesOnlyKnownKeys()).toBe(true);
    expect(bundle.secureStore.size).toBe(1);
  });

  it('the session record NEVER persists outside the secure store (the persisted host state carries no session material)', async () => {
    const bundle = await buildSignedInHost();
    const persisted = await bundle.secureStore.getItem('epoch.field.session');
    expect(persisted).toBeDefined();
    // The ONLY session-shaped storage surface: no other keys exist.
    expect(bundle.secureStore.size).toBe(1);
    const parsed = JSON.parse(persisted!) as { session: { sessionId: string; principalId: string } };
    expect(parsed.session.sessionId).toMatch(/^session:/);
    expect(parsed.session.principalId).toBe('principal:delivery-lead');
  });

  it('the structural platform binding: bindExpoSecureStore duck-types the platform module (adapter layer)', async () => {
    const { bindExpoSecureStore, EXPO_SECURE_STORE_MODULE } = await import('../../native/platform-bindings');
    // The documented binding target name (the adapter layer owns it).
    expect(EXPO_SECURE_STORE_MODULE).toBe('expo-secure-store');
    const calls: string[] = [];
    const values = new Map<string, string>();
    const platformModule = {
      getItemAsync: async (key: string) => {
        calls.push(`get:${key}`);
        return values.get(key) ?? null;
      },
      setItemAsync: async (key: string, value: string) => {
        calls.push(`set:${key}=${value}`);
        values.set(key, value);
      },
      deleteItemAsync: async (key: string) => {
        calls.push(`delete:${key}`);
        values.delete(key);
      },
    };
    const port = bindExpoSecureStore(platformModule);
    await port.setItem('epoch.field.session', 'token-1');
    expect(await port.getItem('epoch.field.session')).toBe('token-1');
    expect(await port.hasItem('epoch.field.session')).toBe(true);
    await port.deleteItem('epoch.field.session');
    expect(await port.getItem('epoch.field.session')).toBeUndefined();
    expect(calls.join(',')).toContain('set:epoch.field.session=token-1');
  });
});

describe('the camera seam (W049 pin 4: camera/evidence capture)', () => {
  it('the scripted camera replays deterministic frames (zero randomness)', async () => {
    const camera = new MemoryCameraPort([photoFrame('a'), photoFrame('b')]);
    const first = await camera.capturePhoto({ capturedAt: T12, capturedBy: 'principal:delivery-lead' });
    const second = await camera.capturePhoto({ capturedAt: T12, capturedBy: 'principal:delivery-lead' });
    expect(sha256Hex(first.bytes)).toBe(sha256Hex(photoFrame('a')));
    expect(sha256Hex(second.bytes)).toBe(sha256Hex(photoFrame('b')));
    expect(first.kind).toBe('photo');
    expect(first.capturedAt).toBe(T12);
  });

  it('the frame source repeats the last frame when exhausted (never randomness)', async () => {
    const camera = new MemoryCameraPort([photoFrame('only')]);
    await camera.capturePhoto({ capturedAt: T12, capturedBy: 'p' });
    const repeat = await camera.capturePhoto({ capturedAt: T12, capturedBy: 'p' });
    expect(sha256Hex(repeat.bytes)).toBe(sha256Hex(photoFrame('only')));
  });

  it('the structural platform camera binding adapts base64 photo data (adapter layer)', async () => {
    const { bindExpoCamera } = await import('../../native/platform-bindings');
    const { decodeBase64ToBytes } = await import('../../src/product/camera');
    const bytes = photoFrame('platform');
    const base64 = Buffer.from(bytes).toString('base64');
    const camera = bindExpoCamera({ takePhoto: async () => ({ base64 }) }, (b64) => decodeBase64ToBytes(b64));
    const photo = await camera.capturePhoto({ capturedAt: T12, capturedBy: 'principal:delivery-lead', note: 'n' });
    expect(sha256Hex(photo.bytes)).toBe(sha256Hex(bytes));
    expect(photo.note).toBe('n');
  });
});

describe('the digest-addressing invariant (W049 acceptance: evidence is digest-addressed)', () => {
  it('the digest is computed BEFORE upload: the client pre-computation equals the authority recomputation', async () => {
    const bundle = await buildSignedInHost({ frames: [photoFrame('digest-proof')] });
    bundle.clock.advanceTo(T12);
    const client = bundle.host.gatewayClient;
    const result = await captureEvidence(bundle.camera, client, {
      sessionId: bundle.host.currentSession!.sessionId,
      tenantId: 'tenant:nordstrand',
      capturedAt: T12,
      capturedBy: 'principal:delivery-lead',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The client-side pre-computed digest (sha256 over the raw bytes).
      const precomputed = sha256Hex(photoFrame('digest-proof'));
      expect(result.evidence.digest).toBe(precomputed);
      expect(result.evidence.digestVerified).toBe(true);
    }
  });

  it('the records reference the DIGEST only — no local path, no embedded bytes (structural scan)', async () => {
    const bundle = await buildSignedInHost({ frames: [photoFrame('shape-proof')] });
    bundle.clock.advanceTo(T12);
    const result = await captureEvidence(bundle.camera, bundle.host.gatewayClient, {
      sessionId: bundle.host.currentSession!.sessionId,
      tenantId: 'tenant:nordstrand',
      capturedAt: T12,
      capturedBy: 'principal:delivery-lead',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const evidence = result.evidence;
      // The record keys: digest + kind + provenance (+ optional note) ONLY.
      const refKeys = Object.keys(evidence.ref).sort();
      expect(refKeys).toEqual(['capturedAt', 'digest', 'kind']);
      const linkKeys = Object.keys(evidence.link).sort();
      expect(linkKeys).toEqual(['capturedAt', 'capturedBy', 'digest', 'evidenceKind']);
      // No path/uri/bytes/base64 fields anywhere on the evidence records.
      for (const record of [evidence.ref, evidence.link]) {
        const serialized = JSON.stringify(record);
        expect(serialized).not.toMatch(/"(path|uri|url|bytes|base64|data)"/);
      }
    }
  });

  it('the digest survives the capture round-trip: the capture envelope carries the SAME evidence digest the authority stored', async () => {
    const bundle = await buildSignedInHost({ frames: [photoFrame('roundtrip')] });
    bundle.clock.advanceTo(T12);
    const capture = await bundle.host.captureObservation({
      anchor: { kind: 'work-package', id: 'work-package:warehouse-substructure' },
      measure: quantityMeasure('10', 'm3'),
      uncertainty: fieldUncertainty(T12, 'principal:delivery-lead'),
      observedAt: T12,
      captureId: 'digest-roundtrip-1',
      evidence: [{ note: 'roundtrip photo' }],
    });
    expect(capture.ok).toBe(true);
    if (capture.ok) {
      const authorityDigest = capture.evidence[0]!.digest;
      // The W018 envelope's evidence references carry the SAME digest.
      expect(capture.capture.evidence[0]!.digest).toBe(authorityDigest);
      // And it is the true SHA-256 of the captured bytes.
      expect(authorityDigest).toBe(createHash('sha256').update(photoFrame('roundtrip')).digest('hex'));
    }
  });

  it('the idempotency key derivation is deterministic over (operation, payload)', () => {
    const client = new GatewayClient({
      transport: {
        async call() {
          throw new TypeError('not used');
        },
      },
      clock: () => T12,
      tenant: { tenantId: 'tenant:nordstrand' },
      correlation: new CorrelationSequence('digest-test'),
    });
    const payload = { solutionId: 'solution:x', capture: { captureKey: 'k1' } } as never;
    expect(client.idempotencyKeyFor('delivery.observe', payload)).toBe(
      client.idempotencyKeyFor('delivery.observe', payload),
    );
    expect(client.idempotencyKeyFor('delivery.observe', payload)).toMatch(/^idem:mobile-[0-9a-f]{24}$/);
    // A different payload derives a different key.
    const other = { solutionId: 'solution:x', capture: { captureKey: 'k2' } } as never;
    expect(client.idempotencyKeyFor('delivery.observe', other)).not.toBe(
      client.idempotencyKeyFor('delivery.observe', payload),
    );
  });
});
