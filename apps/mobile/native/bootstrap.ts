/**
 * @epoch/mobile — the native bootstrap (W049): constructs the field
 * product on the device.
 *
 * What runs on device:
 *
 *  - the fixture records bundled under native/fixtures/ (byte-identical
 *    copies of the committed qa/fixtures/construction set — pinned by
 *    test/product/fixtures.test.ts against qa/fixtures/registry.json);
 *  - the REAL W046 Application Gateway, in-process (the typed library
 *    surface — the single-process composition the W046 runtime delivers;
 *    the HTTP transport deployment swaps `bindInProcessGateway` for the
 *    network client, everything above the seam unchanged);
 *  - the platform adapters bound through the STRUCTURAL seams:
 *      * the secure store: `expo-secure-store` resolved at RUNTIME
 *        through the non-literal specifier (the W046 bindPgPool
 *        precedent — the catalog pins no unpinned npm module), adapted
 *        via bindExpoSecureStore; when the platform module is absent
 *        (Expo Go without the native module, tests) the bootstrap falls
 *        back to the in-memory store and the UI states it honestly;
 *      * the camera: the platform camera adapter (expo-camera) resolved
 *        the same way; absent -> the scripted frame source (the demo
 *        evidence stream) with an explicit "simulated camera" badge;
 *      * the network state: AppState + a session.validate heartbeat
 *        (typed transient failure = offline).
 *
 * Determinism preserved: the clock is a monotonic instant supplier
 * seeded from the frozen fixture series (device deployments substitute
 * the platform clock at the edge — the product core stays zero-wall-clock).
 */
import { buildFixtureGateway, fixtureWorldDigest, type FieldFixtureRecords } from '../src/product/fixture-gateway';
import { MobileFieldHost } from '../src/product/field-host';
import { MemorySecureStore, type SecureStorePort } from '../src/product/secure-store';
import { MemoryCameraPort, type FieldCameraPort } from '../src/product/camera';
import { ScriptedNetworkState } from '../src/product/offline';
import { bindExpoSecureStore, EXPO_CAMERA_MODULE, EXPO_SECURE_STORE_MODULE, type ExpoSecureStoreLike, type ExpoCameraLike } from './platform-bindings';

/** The bundled fixture records (Metro JSON imports). */
import tenancyJson from './fixtures/tenancy.json';
import identityJson from './fixtures/identity.json';
import worldJson from './fixtures/world.json';
import solutionJson from './fixtures/solution.json';
import programJson from './fixtures/program-of-work.json';
import deliveryJson from './fixtures/delivery.json';
import evidenceJson from './fixtures/evidence.json';

/** The bundled construction fixture set (digest-pinned to qa/fixtures by test). */
export const BUNDLED_RECORDS: FieldFixtureRecords = {
  fixtureId: 'epoch-fixture-construction-v1.0.0',
  domain: 'construction',
  tenantId: 'tenant:nordstrand',
  tenancy: tenancyJson as unknown as Record<string, unknown>,
  identity: identityJson as unknown as Record<string, unknown>,
  world: worldJson as unknown as Record<string, unknown>,
  solution: solutionJson as unknown as Record<string, unknown>,
  program: programJson as unknown as Record<string, unknown>,
  delivery: deliveryJson as unknown as Record<string, unknown>,
  evidence: evidenceJson as unknown as Record<string, unknown>,
};

/** The committed registry world digest (cross-device pin; fixtures.test.ts asserts equality). */
export const REGISTRY_WORLD_DIGEST = '52b9c01cd891b37ed96c8226ed0c969bd08c57ba6e0d0cdb9a0e2c656ff2e33f';

/** The module specifiers the platform deployment provides (see native/platform-bindings.ts). */
export const RUNTIME_MODULES = {
  secureStore: EXPO_SECURE_STORE_MODULE,
  camera: EXPO_CAMERA_MODULE,
} as const;

/** The boot-mode description surfaced in the UI (honest about what is bound). */
export interface BootMode {
  readonly secureStore: 'platform' | 'memory';
  readonly camera: 'platform' | 'scripted';
  readonly transport: 'in-process-gateway';
}

/** The booted field product. */
export interface BootedProduct {
  readonly host: MobileFieldHost;
  readonly secureStore: SecureStorePort;
  readonly camera: FieldCameraPort;
  readonly network: ScriptedNetworkState;
  readonly mode: BootMode;
  readonly records: FieldFixtureRecords;
}

/**
 * The monotonic device clock: seeded at the frozen fixture epoch, stepping
 * forward one second per tick. Deterministic across launches for the same
 * tick count; the device deployment may substitute the platform clock.
 */
class MonotonicClock {
  private ticks = 0;

  constructor(private readonly epoch: string) {}

  now(): string {
    this.ticks += 1;
    return addSeconds(this.epoch, this.ticks);
  }
}

/** Add N seconds to a canonical UTC instant (ISO string arithmetic). */
function addSeconds(instant: string, seconds: number): string {
  const base = new Date(instant).getTime();
  return new Date(base + seconds * 1000).toISOString().replace(/\.\d{3}Z$/, '.000Z');
}

/**
 * The platform module injection point. The deployment (or a native entry
 * shim / Expo dev client with the modules installed) sets these globals
 * BEFORE the app boots; the bootstrap duck-types them structurally (the
 * W046 bindPgPool discipline — the repo statically references NO unpinned
 * npm module, and no dynamic import is used so Metro/Hermes stay safe).
 */
declare global {
  var __epochPlatformSecureStore: ExpoSecureStoreLike | undefined;
  var __epochPlatformCamera: ExpoCameraLike | undefined;
}

/** Resolve the injected platform secure store (undefined when not injected). */
function injectedSecureStore(): ExpoSecureStoreLike | undefined {
  const candidate = globalThis.__epochPlatformSecureStore;
  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.getItemAsync === 'function' &&
    typeof candidate.setItemAsync === 'function' &&
    typeof candidate.deleteItemAsync === 'function'
  ) {
    return candidate;
  }
  return undefined;
}

/** Resolve the injected platform camera adapter (undefined when not injected). */
function injectedCamera(): ExpoCameraLike | undefined {
  const candidate = globalThis.__epochPlatformCamera;
  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.takePhoto === 'function'
  ) {
    return candidate;
  }
  return undefined;
}

/** Boot the field product on the device (or in Expo Go / tests). */
export async function bootFieldProduct(options: {
  readonly principalId: string;
  readonly sessionNonce: string;
  readonly startAt?: string;
}): Promise<BootedProduct> {
  const clock = new MonotonicClock(options.startAt ?? '2026-03-02T09:00:00.000Z');
  const gateway = buildFixtureGateway({
    records: BUNDLED_RECORDS,
    clock: () => clock.now(),
  });

  // The platform secure store (expo-secure-store) — structural binding.
  let secureStore: SecureStorePort = new MemorySecureStore();
  let secureStoreMode: 'platform' | 'memory' = 'memory';
  const secureStoreModule = injectedSecureStore();
  if (secureStoreModule !== undefined) {
    secureStore = bindExpoSecureStore(secureStoreModule);
    secureStoreMode = 'platform';
  }

  // The platform camera — structural binding; the scripted fallback
  // carries an explicit deterministic demo frame.
  let camera: FieldCameraPort = new MemoryCameraPort([
    new TextEncoder().encode('epoch-field-demo-photo'),
  ]);
  let cameraMode: 'platform' | 'scripted' = 'scripted';
  const cameraModule = injectedCamera();
  if (cameraModule !== undefined) {
    camera = {
      capturePhoto: async (request) => {
        const photo = await cameraModule.takePhoto({ quality: 1 });
        return {
          bytes: decodeBase64(photo.base64),
          kind: 'photo' as const,
          capturedAt: request.capturedAt,
          capturedBy: request.capturedBy,
          ...(photo.width !== undefined ? { width: photo.width } : {}),
          ...(photo.height !== undefined ? { height: photo.height } : {}),
          ...(request.note !== undefined ? { note: request.note } : {}),
        };
      },
    };
    cameraMode = 'platform';
  }

  const network = new ScriptedNetworkState(true);
  const host = new MobileFieldHost({
    transport: gateway.transport,
    clock: () => clock.now(),
    records: BUNDLED_RECORDS,
    secureStore,
    camera,
    network,
    principalId: options.principalId,
    sessionNonce: options.sessionNonce,
    correlationPrefix: 'device',
  });

  return {
    host,
    secureStore,
    camera,
    network,
    mode: { secureStore: secureStoreMode, camera: cameraMode, transport: 'in-process-gateway' },
    records: BUNDLED_RECORDS,
  };
}

/** The fixture world digest accessor (the cross-device J08 anchor from the bundle). */
export function bundledWorldDigest(): string {
  return fixtureWorldDigest(BUNDLED_RECORDS);
}

/** Minimal base64 decode for the device (the camera adapter hands base64). */
function decodeBase64(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const size = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = clean.slice(i, i + 4);
    if (chunk.length < 2) break;
    let word = 0;
    for (let c = 0; c < chunk.length; c += 1) {
      const char = chunk[c]!;
      const code =
        char >= 'A' && char <= 'Z'
          ? char.charCodeAt(0) - 65
          : char >= 'a' && char <= 'z'
            ? char.charCodeAt(0) - 97 + 26
            : char >= '0' && char <= '9'
              ? char.charCodeAt(0) - 48 + 52
              : char === '+'
                ? 62
                : 63;
      word |= code << (18 - c * 6);
    }
    const pad = 4 - chunk.length;
    for (let b = 0; b < 3 - pad; b += 1) {
      if (offset < size) {
        bytes[offset] = (word >>> (16 - b * 8)) & 0xff;
        offset += 1;
      }
    }
  }
  return bytes;
}
