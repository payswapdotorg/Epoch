import { describe, expect, it } from 'vitest';
import type { WorldSnapshot } from '@epoch/world-contracts';
import { WorldModel, canonicalJson, sha256Hex } from '../src/index';
import { deepClone } from '../src/immutable';
import {
  entityAssertion,
  propertyAssertion,
  provenance,
  relationAssertion,
  stepClock,
} from './helpers';

function buildWorld(): WorldModel {
  const { clock, advance } = stepClock();
  const world = WorldModel.create({ clock });
  world.registerEntityType({
    key: 'geo:building',
    extends: 'core:entity',
    properties: { floors: { type: 'integer', required: true } },
  });
  world.applyAssertion(entityAssertion('site-1', 'core:entity', { name: 'Campus' }));
  advance();
  world.applyAssertion(entityAssertion('b-1', 'geo:building', { floors: 3 }));
  advance();
  const height = world.applyAssertion(propertyAssertion('b-1', 'height', 12));
  advance();
  world.applyAssertion(propertyAssertion('b-1', 'height', 14, { supersedes: height.id }));
  advance();
  world.applyAssertion(relationAssertion('core:part-of', 'b-1', 'site-1'));
  advance();
  world.registerExternalMapping({
    id: 'ifc-basic',
    standard: 'ifc',
    entityTypes: [{ external: 'IfcBuilding', target: 'geo:building' }],
    relationTypes: [],
  });
  advance();
  const relationRecord = world.relationHistory('core:part-of', 'b-1', 'site-1')[0];
  world.retractAssertion({
    assertionId: relationRecord.id,
    reason: 'wrong parent',
    provenance: provenance(),
  });
  return world;
}

/** Recompute the digest after tampering, so the failure isolates the targeted integrity check. */
function reDigest(snapshot: WorldSnapshot): WorldSnapshot {
  const { digest: _digest, ...content } = snapshot;
  void _digest;
  return { ...content, digest: sha256Hex(canonicalJson(content)) } as unknown as WorldSnapshot;
}

describe('snapshot serialization (positive)', () => {
  it('carries the versioned envelope and the full history', () => {
    const world = buildWorld();
    const snapshot = world.serialize();
    expect(snapshot.schema).toBe('epoch.world-model');
    expect(snapshot.version).toBe('1.0.0');
    expect(snapshot.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.entityTypes.map((type) => type.key)).toContain('geo:building');
    expect(snapshot.externalMappings.map((mapping) => mapping.id)).toEqual(['ifc-basic']);
    // full history: nothing discarded
    expect(snapshot.assertions.length).toBe(5);
    expect(snapshot.events.length).toBeGreaterThan(5);
    expect(snapshot.assertions.some((record) => record.status === 'retracted')).toBe(true);
    expect(snapshot.assertions.some((record) => record.status === 'superseded')).toBe(true);
  });

  it('is deterministic: repeated serialization is byte-identical', () => {
    const world = buildWorld();
    const first = world.serialize();
    const second = world.serialize();
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(world.digest()).toBe(first.digest);
  });

  it('is deterministic across identical independent runs (fixed clock)', () => {
    const a = buildWorld().serialize();
    const b = buildWorld().serialize();
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('round-trips exactly: fromSnapshot(serialize()) preserves digest and statistics', () => {
    const world = buildWorld();
    const snapshot = world.serialize();
    const restored = WorldModel.fromSnapshot(snapshot);

    expect(restored.digest()).toBe(snapshot.digest);
    expect(restored.canonicalContent()).toBe(world.canonicalContent());
    expect(restored.statistics()).toEqual(world.statistics());
    // history survives
    expect(restored.entityHistory('b-1')).toHaveLength(3);
    expect(restored.listEntities().map((entity) => entity.id)).toEqual(
      world.listEntities().map((entity) => entity.id),
    );
  });

  it('restored worlds accept new writes and stay deterministic', () => {
    const world = buildWorld();
    const restored = WorldModel.fromSnapshot(world.serialize());
    restored.applyAssertion(propertyAssertion('b-1', 'height', 20, { provenance: provenance() }));
    const next = restored.serialize();
    expect(next.assertions).toHaveLength(world.serialize().assertions.length + 1);
    expect(next.digest).not.toBe(world.digest());
  });
});

describe('snapshot integrity (negative)', () => {
  it('rejects snapshots whose content was tampered with (digest mismatch)', () => {
    const world = buildWorld();
    const snapshot = deepClone(world.serialize()) as WorldSnapshot;
    for (const record of snapshot.assertions) {
      if (record.statement.kind === 'entity-property') {
        (record.statement as { value: number }).value = 999;
        break;
      }
    }
    expect(() => WorldModel.fromSnapshot(snapshot)).toThrow(
      expect.objectContaining({ code: 'WM_INTEGRITY' }),
    );
  });

  it('rejects snapshots with a foreign contract version even when the digest is valid', () => {
    const world = buildWorld();
    const snapshot = deepClone(world.serialize()) as WorldSnapshot;
    (snapshot as { version: string }).version = '0.9.0';
    expect(() => WorldModel.fromSnapshot(snapshot)).toThrow(
      expect.objectContaining({ code: 'WM_VERSION_MISMATCH' }),
    );
  });

  it('rejects malformed snapshot payloads', () => {
    expect(() => WorldModel.fromSnapshot(null as unknown as WorldSnapshot)).toThrow(
      expect.objectContaining({ code: 'WM_SCHEMA' }),
    );
    expect(() => WorldModel.fromSnapshot('nope' as unknown as WorldSnapshot)).toThrow(
      expect.objectContaining({ code: 'WM_SCHEMA' }),
    );
    expect(() => WorldModel.fromSnapshot([] as unknown as WorldSnapshot)).toThrow(
      expect.objectContaining({ code: 'WM_SCHEMA' }),
    );
    const world = buildWorld();
    const withExtra = { ...deepClone(world.serialize()), bogusField: true };
    expect(() => WorldModel.fromSnapshot(withExtra as unknown as WorldSnapshot)).toThrow(
      expect.objectContaining({ code: 'WM_SCHEMA' }),
    );
  });

  it('rejects snapshots whose assertion records carry mismatched reconciliation keys', () => {
    const world = buildWorld();
    const snapshot = reDigest(deepClone(world.serialize()) as WorldSnapshot);
    const record = snapshot.assertions[0];
    if (record.statement.kind === 'entity') {
      (record.statement as { entityId: string }).entityId = 'swapped-id';
    }
    const redigested = reDigest(snapshot);
    expect(() => WorldModel.fromSnapshot(redigested)).toThrow(
      expect.objectContaining({ code: 'WM_INTEGRITY' }),
    );
  });

  it('rejects snapshots with reordered history (ordering invariants)', () => {
    const world = buildWorld();
    const snapshot = deepClone(world.serialize()) as WorldSnapshot;
    (snapshot as unknown as { assertions: unknown[] }).assertions.reverse();
    const redigested = reDigest(snapshot);
    expect(() => WorldModel.fromSnapshot(redigested)).toThrow(
      expect.objectContaining({ code: 'WM_SCHEMA' }),
    );
  });

  it('rejects snapshots with a tampered core vocabulary definition', () => {
    const world = buildWorld();
    const snapshot = deepClone(world.serialize()) as WorldSnapshot;
    const coreEntity = snapshot.entityTypes.find((type) => type.key === 'core:entity')!;
    (coreEntity as { description: string }).description = 'sneaky redefinition';
    const redigested = reDigest(snapshot);
    expect(() => WorldModel.fromSnapshot(redigested)).toThrow(
      expect.objectContaining({ code: 'WM_INTEGRITY' }),
    );
  });

  it('rejects snapshots with dangling supersession links', () => {
    const world = buildWorld();
    const snapshot = deepClone(world.serialize()) as WorldSnapshot;
    for (const record of snapshot.assertions) {
      if (record.supersededBy !== undefined) {
        (record as { supersededBy: string }).supersededBy = 'ass-424242';
        break;
      }
    }
    const redigested = reDigest(snapshot);
    expect(() => WorldModel.fromSnapshot(redigested)).toThrow(
      expect.objectContaining({ code: 'WM_INTEGRITY' }),
    );
  });

  it('rejects snapshots missing the world-created genesis event', () => {
    const world = buildWorld();
    const snapshot = deepClone(world.serialize()) as WorldSnapshot;
    (snapshot as unknown as { events: unknown[] }).events = (snapshot as unknown as { events: unknown[] }).events.slice(1);
    const redigested = reDigest(snapshot);
    expect(() => WorldModel.fromSnapshot(redigested)).toThrow(
      expect.objectContaining({ code: 'WM_INTEGRITY' }),
    );
  });
});
