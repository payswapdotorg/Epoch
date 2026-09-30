// Shared W049 test helpers: the fixture record loader (from the committed
// qa/fixtures tree), the deterministic clock, and the host factory used by
// every product/journey test. Node-only (vitest); the native bundle carries
// digest-pinned copies (native/fixtures) validated by fixtures.test.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFixtureGateway, type FieldFixtureRecords, type SeededGateway } from '../../src/product/fixture-gateway';
import { MemorySecureStore } from '../../src/product/secure-store';
import { MemoryCameraPort } from '../../src/product/camera';
import { ScriptedNetworkState } from '../../src/product/offline';
import { MobileFieldHost } from '../../src/product/field-host';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..', '..');

/** Read one fixture file from the committed qa/fixtures tree. */
export function loadFixtureFile(domain: 'construction' | 'software', file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, 'qa', 'fixtures', domain, file), 'utf8')) as Record<
    string,
    unknown
  >;
}

/** The committed construction fixture record set (the field product domain). */
export function loadConstructionRecords(): FieldFixtureRecords {
  return {
    fixtureId: 'epoch-fixture-construction-v1.0.0',
    domain: 'construction',
    tenantId: 'tenant:nordstrand',
    tenancy: loadFixtureFile('construction', 'tenancy.json'),
    identity: loadFixtureFile('construction', 'identity.json'),
    world: loadFixtureFile('construction', 'world.json'),
    solution: loadFixtureFile('construction', 'solution.json'),
    program: loadFixtureFile('construction', 'program-of-work.json'),
    delivery: loadFixtureFile('construction', 'delivery.json'),
    evidence: loadFixtureFile('construction', 'evidence.json'),
  };
}

/** The frozen fixture instants (the W046 clock series — deterministic tests). */
export const T08 = '2026-03-02T08:00:00.000Z';
export const T09 = '2026-03-02T09:00:00.000Z';
export const T10 = '2026-03-02T10:00:00.000Z';
export const T11 = '2026-03-02T11:00:00.000Z';
export const T12 = '2026-03-02T12:00:00.000Z';
export const T13 = '2026-03-02T13:00:00.000Z';
export const T14 = '2026-03-02T14:00:00.000Z';
export const T15 = '2026-03-02T15:00:00.000Z';
export const T16 = '2026-03-02T16:00:00.000Z';

/** A deterministic clock pinned at one fixture instant (advance with `advanceTo`). */
export class FrozenClock {
  private instant: string;

  constructor(at: string = T09) {
    this.instant = at;
  }

  now(): string {
    return this.instant;
  }

  advanceTo(at: string): void {
    this.instant = at;
  }
}

/** One deterministic field photo frame (bytes vary per test scenario). */
export function photoFrame(seed: string): Uint8Array {
  return new TextEncoder().encode(`epoch-field-photo:${seed}`);
}

/** The W036 uncertainty state used by the field captures (deterministic). */
export function fieldUncertainty(at: string, actor: string) {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:mobile-field-camera', actor },
    freshness: { state: 'fresh', assessedAt: at },
    confidence: { method: 'measured', value: 0.95, rationale: 'direct field measurement from the mobile capture surface' },
  };
}

/** The standard test host bundle (gateway + host + seams). */
export interface HostBundle {
  readonly gateway: SeededGateway;
  readonly host: MobileFieldHost;
  readonly secureStore: MemorySecureStore;
  readonly camera: MemoryCameraPort;
  readonly network: ScriptedNetworkState;
  readonly clock: FrozenClock;
}

/** Build a signed-in test host over the fixture gateway (deterministic). */
export async function buildSignedInHost(options: {
  readonly principalId?: string;
  readonly nonce?: string;
  readonly at?: string;
  readonly frames?: readonly Uint8Array[];
  readonly online?: boolean;
} = {}): Promise<HostBundle> {
  const clock = new FrozenClock(options.at ?? T09);
  const gateway = buildFixtureGateway({
    records: loadConstructionRecords(),
    clock: () => clock.now(),
  });
  const secureStore = new MemorySecureStore();
  const camera = new MemoryCameraPort(options.frames ?? [photoFrame('w049-default')]);
  const network = new ScriptedNetworkState(options.online ?? true);
  const host = new MobileFieldHost({
    transport: gateway.transport,
    clock: () => clock.now(),
    records: gateway.records,
    secureStore,
    camera,
    network,
    principalId: options.principalId ?? 'principal:delivery-lead',
    sessionNonce: options.nonce ?? 'nonce:w049-field-test',
    sessionTtlMs: 86_400_000,
    correlationPrefix: 'w049-test',
  });
  const signed = await host.signIn();
  if (!signed.ok) {
    throw new Error(`test host sign-in failed: ${JSON.stringify(signed.failure)}`);
  }
  return { gateway, host, secureStore, camera, network, clock };
}

/** A valid quantity measure (the W036 grammar). */
export function quantityMeasure(value: string, unit: string) {
  return { kind: 'quantity', value, unit };
}

/** A valid progress measure (the W036 grammar, 0..1 fraction). */
export function progressMeasure(fraction: number) {
  return { kind: 'progress', fraction };
}
