// W017 acceptance: the offline/session cache — content-addressed
// projections with freshness/invalidation records, never a second
// semantic store (lock rules 8/16): tampered writes are rejected, stale
// reads are typed cache-violations, cross-tenant reads are denied, and
// the cache exposes no mutation of stored records.
import { describe, expect, it } from 'vitest';
import {
  createExperienceCache,
  verifyCacheEntry,
  parseSessionSnapshot,
  sealSessionSnapshot,
  verifySessionSnapshot,
} from '../src/index';
import { TENANT_A, TENANT_B, compiledExperience, expectFailure, goldenScenario } from './fixtures';

function storedGraphFixture() {
  const experience = compiledExperience('2d');
  return {
    record: experience.graph as unknown as Record<string, unknown>,
    address: experience.graph.digest,
  };
}

describe('the experience cache (content-addressed projections only)', () => {
  it('stores a verbatim sealed document at its content address', () => {
    const cache = createExperienceCache();
    const { record, address } = storedGraphFixture();
    const stored = cache.put({
      address,
      kind: 'experience-graph',
      record,
      tenantScope: { tenantId: TENANT_A },
      recordedAtMs: 20,
      provenance: { origin: 'host-envelope', envelopeId: 'env-host-0003' },
    });
    expect(stored.ok).toBe(true);
    if (stored.ok) {
      expect(stored.value.freshness.fresh).toBe(true);
      expect(verifyCacheEntry(stored.value)).toBe(true);
    }
    const resolved = cache.resolve(address, { expectedTenantId: TENANT_A });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.record).toEqual(record);
    }
  });

  it('rejects a tampered write (claimed address != recomputed content address)', () => {
    const cache = createExperienceCache();
    const { record } = storedGraphFixture();
    const forged = 'f'.repeat(64);
    const rejected = cache.put({
      address: forged,
      kind: 'experience-graph',
      record,
      tenantScope: { tenantId: TENANT_A },
      recordedAtMs: 20,
      provenance: { origin: 'host-envelope', envelopeId: 'env-host-0003' },
    });
    expectFailure(rejected, 'digest-mismatch');
  });

  it('rejects unknown addresses with the typed cache-violation', () => {
    const cache = createExperienceCache();
    expectFailure(cache.resolve('a'.repeat(64)), 'cache-violation');
  });

  it('rejects stale reads presented as fresh (typed cache-violation)', () => {
    const cache = createExperienceCache();
    const { record, address } = storedGraphFixture();
    const stored = cache.put({
      address,
      kind: 'experience-graph',
      record,
      tenantScope: { tenantId: TENANT_A },
      recordedAtMs: 20,
      provenance: { origin: 'host-envelope', envelopeId: 'env-host-0003' },
    });
    if (!stored.ok) {
      throw new Error(stored.error.message);
    }
    const invalidated = cache.invalidate(address, 'host-invalidated', 30);
    expect(invalidated.ok).toBe(true);
    if (invalidated.ok) {
      expect(invalidated.value.freshness.fresh).toBe(false);
      expect(invalidated.value.freshness.invalidation?.reason).toBe('host-invalidated');
      expect(invalidated.value.freshness.invalidation?.atMs).toBe(30);
    }
    expectFailure(cache.resolve(address, { requireFresh: true }), 'cache-violation');
    // The stale record is still resolvable without the freshness flag.
    expect(cache.resolve(address).ok).toBe(true);
  });

  it('records supersession with the superseding address', () => {
    const cache = createExperienceCache();
    const { record, address } = storedGraphFixture();
    cache.put({
      address,
      kind: 'experience-graph',
      record,
      tenantScope: { tenantId: TENANT_A },
      recordedAtMs: 20,
      provenance: { origin: 'host-envelope', envelopeId: 'env-host-0003' },
    });
    const next = 'b'.repeat(64);
    const superseded = cache.invalidate(address, 'superseded', 30, next);
    expect(superseded.ok).toBe(true);
    if (superseded.ok) {
      expect(superseded.value.freshness.invalidation?.supersededBy).toBe(next);
    }
    // A supersession without its successor is malformed.
    expectFailure(cache.invalidate(address, 'superseded', 31), 'malformed-record');
  });

  it('denies cross-tenant reads (cross-tenant-denied, R12)', () => {
    const cache = createExperienceCache();
    const { record, address } = storedGraphFixture();
    cache.put({
      address,
      kind: 'experience-graph',
      record,
      tenantScope: { tenantId: TENANT_A },
      recordedAtMs: 20,
      provenance: { origin: 'host-envelope', envelopeId: 'env-host-0003' },
    });
    expectFailure(cache.resolve(address, { expectedTenantId: TENANT_B }), 'cross-tenant-denied');
  });

  it('enforces kind expectations on resolution', () => {
    const cache = createExperienceCache();
    const { record, address } = storedGraphFixture();
    cache.put({
      address,
      kind: 'experience-graph',
      record,
      tenantScope: { tenantId: TENANT_A },
      recordedAtMs: 20,
      provenance: { origin: 'host-envelope', envelopeId: 'env-host-0003' },
    });
    expectFailure(cache.resolve(address, { expectedKind: 'plan-artifact' }), 'cache-violation');
  });

  it('lists addresses deterministically (sorted)', () => {
    const cache = createExperienceCache();
    const experience = compiledExperience('2d');
    cache.put({
      address: experience.graph.digest,
      kind: 'experience-graph',
      record: experience.graph as unknown as Record<string, unknown>,
      tenantScope: { tenantId: TENANT_A },
      recordedAtMs: 20,
      provenance: { origin: 'host-envelope', envelopeId: 'env-host-0003' },
    });
    cache.put({
      address: experience.plan.digest,
      kind: 'plan-artifact',
      record: experience.plan as unknown as Record<string, unknown>,
      tenantScope: { tenantId: TENANT_A },
      recordedAtMs: 20,
      provenance: { origin: 'host-envelope', envelopeId: 'env-host-0003' },
    });
    expect(cache.listAddresses()).toEqual([...cache.listAddresses()].sort());
    expect(cache.listAddresses()).toContain(experience.graph.digest);
    expect(cache.listAddresses()).toContain(experience.plan.digest);
  });

  it('never stores kernel state: entries carry only the sealed projection documents', () => {
    // The structural invariant: every stored record is the verbatim
    // offered document (already admitted through W011/W012 with their
    // authority scans); the cache API offers no field-level mutation and
    // every write verifies the content address. This test pins that a
    // mutated record cannot slip in under an existing address.
    const cache = createExperienceCache();
    const { record, address } = storedGraphFixture();
    const mutated = { ...record, nodes: [...(record.nodes as unknown[]), { smuggled: 'kernel-state' }] };
    expectFailure(
      cache.put({
        address,
        kind: 'experience-graph',
        record: mutated,
        tenantScope: { tenantId: TENANT_A },
        recordedAtMs: 21,
        provenance: { origin: 'host-envelope', envelopeId: 'env-host-0004' },
      }),
      'digest-mismatch',
    );
  });
});

describe('session-state snapshots', () => {
  it('the golden-path scenario snapshots with verified digest + provenance', () => {
    const scenario = goldenScenario();
    const snapshot = scenario.shell.snapshotSession(100);
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(verifySessionSnapshot(snapshot.value)).toBe(true);
      expect(snapshot.value.provenance.origin).toBe('desktop-shell');
      expect(snapshot.value.tenantScope.tenantId).toBe(TENANT_A);
      expect(snapshot.value.principal).toBe('principal:operator-1');
      expect(snapshot.value.windows).toHaveLength(1);
      expect(snapshot.value.windows[0].mountedGraphDigest).toBe(scenario.experience.graph.digest);
      expect(snapshot.value.receipts.length).toBeGreaterThanOrEqual(3); // mount + frame + intent
      expect(snapshot.value.cacheAddresses).toHaveLength(2); // graph + plan
    }
  });

  it('round-trip: seal -> JSON -> parse -> identical snapshot', () => {
    const scenario = goldenScenario();
    const snapshot = scenario.shell.snapshotSession(100);
    if (!snapshot.ok) {
      throw new Error(snapshot.error.message);
    }
    const parsed = parseSessionSnapshot(JSON.parse(JSON.stringify(snapshot.value)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual(snapshot.value);
    }
  });

  it('tamper detection: a mutated snapshot fails the digest gate', () => {
    const scenario = goldenScenario();
    const snapshot = scenario.shell.snapshotSession(100);
    if (!snapshot.ok) {
      throw new Error(snapshot.error.message);
    }
    const tampered = {
      ...snapshot.value,
      windows: [{ ...snapshot.value.windows[0], state: 'closed' as const }],
    };
    expectFailure(parseSessionSnapshot(tampered), 'digest-mismatch');
  });

  it('version skew fails fast (version-unsupported)', () => {
    const scenario = goldenScenario();
    const snapshot = scenario.shell.snapshotSession(100);
    if (!snapshot.ok) {
      throw new Error(snapshot.error.message);
    }
    expectFailure(
      parseSessionSnapshot({ ...snapshot.value, protocolVersion: '9.9.9' }),
      'version-unsupported',
    );
  });

  it('a hand-built snapshot content is sealable and verifiable (typed construction)', () => {
    const scenario = goldenScenario();
    const snapshot = scenario.shell.snapshotSession(100);
    if (!snapshot.ok) {
      throw new Error(snapshot.error.message);
    }
    const { digest: _d, ...content } = snapshot.value;
    void _d;
    const resealed = sealSessionSnapshot(content);
    expect(resealed.digest).toBe(snapshot.value.digest);
    expect(verifySessionSnapshot(resealed)).toBe(true);
  });
});
