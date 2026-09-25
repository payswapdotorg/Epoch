// World-model parity (RUNTIME dependency — genuine consumption): a real
// WorldModel is built through the W002 public API, and its materialized
// entities, relations, and events flow through the experience protocol's
// projected-reference schemas and digest discipline unchanged. If the
// world model's id grammars or shapes ever change, this test fails.
import { describe, expect, it } from 'vitest';
import { WorldModel, type Clock } from '@epoch/world-model';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import type { ProjectedReference } from '../src/index';
import {
  ProjectedAgentRefSchema,
  ProjectedWorldEntityRefSchema,
  ProjectedWorldEventRefSchema,
  ProjectedWorldRelationRefSchema,
  WORLD_RELATION_ID_PATTERN,
  parseExperienceGraph,
  sealExperienceGraph,
} from '../src/index';
import { TENANT_A, desktopDevice, graphContent } from './fixtures';

function stepClock(): Clock {
  let current = Date.UTC(2026, 0, 1, 9, 0, 0);
  return () => {
    current += 60_000;
    return new Date(current).toISOString();
  };
}

function provenance() {
  return {
    actor: { id: 'user:alice', role: 'human' as const, displayName: 'Alice' },
    method: 'direct-observation',
    evidence: [{ id: 'ev:doc-1', kind: 'document' as const }],
  };
}

/** Build a real world with two entities, one typed relation, and events. */
function buildWorld() {
  const world = WorldModel.create({ clock: stepClock() });
  // The 'core' namespace is reserved for kernel vocabulary; extension
  // types register under their own namespace (W002 authority rule).
  world.registerEntityType({ key: 'parity:building' });
  world.registerRelationType({
    key: 'parity:connected-to',
    sourceType: 'parity:building',
    targetType: 'parity:building',
  });
  world.applyAssertion({
    statement: { kind: 'entity', entityId: 'building-7', entityType: 'parity:building', properties: { height: 42 } },
    provenance: provenance(),
    confidence: { distribution: { kind: 'point', value: 0.95 }, method: 'measured' },
  });
  world.applyAssertion({
    statement: { kind: 'entity', entityId: 'building-8', entityType: 'parity:building', properties: { height: 30 } },
    provenance: provenance(),
    confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'measured' },
  });
  world.applyAssertion({
    statement: { kind: 'relation', relationType: 'parity:connected-to', source: 'building-7', target: 'building-8', properties: { corridor: 'north' } },
    provenance: provenance(),
    confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'measured' },
  });
  return world;
}

describe('world-model parity (runtime consumption)', () => {
  const world = buildWorld();

  it('materialized entities flow through ProjectedWorldEntityRef unchanged', () => {
    const entity = world.getEntity('building-7');
    expect(entity).not.toBeNull();
    if (entity === null) return;
    const ref = {
      kind: 'world-entity',
      tenantId: TENANT_A,
      entityId: entity.id,
      contentDigest: canonicalDigest(entity as unknown as JsonValue),
    };
    expect(ProjectedWorldEntityRefSchema.safeParse(ref).success).toBe(true);
  });

  it('materialized relations flow through ProjectedWorldRelationRef unchanged', () => {
    const relations = world.listRelations();
    expect(relations.length).toBeGreaterThan(0);
    for (const relation of relations) {
      expect(relation.id).toMatch(WORLD_RELATION_ID_PATTERN);
      const ref = {
        kind: 'world-relation',
        tenantId: TENANT_A,
        relationId: relation.id,
        contentDigest: canonicalDigest(relation as unknown as JsonValue),
      };
      expect(ProjectedWorldRelationRefSchema.safeParse(ref).success).toBe(true);
    }
  });

  it('world events flow through ProjectedWorldEventRef unchanged', () => {
    const events = world.events();
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      const ref = {
        kind: 'world-event',
        tenantId: TENANT_A,
        eventId: event.id,
        contentDigest: canonicalDigest(event as unknown as JsonValue),
      };
      expect(ProjectedWorldEventRefSchema.safeParse(ref).success).toBe(true);
    }
  });

  it('agent registrations flow through ProjectedAgentRef unchanged (agent-protocol grammar)', () => {
    const ref = {
      kind: 'agent',
      tenantId: TENANT_A,
      agentId: 'agent:planner-1',
      contentDigest: canonicalDigest({ registered: true } as JsonValue),
    };
    expect(ProjectedAgentRefSchema.safeParse(ref).success).toBe(true);
  });

  it('a full graph built from real world state admits end-to-end', () => {
    const entity = world.getEntity('building-7');
    const relation = world.listRelations()[0];
    const event = world.events()[0];
    if (entity === null || relation === undefined || event === undefined) {
      throw new Error('world fixture incomplete');
    }
    const content = graphContent('2d');
    const refs: ProjectedReference[] = [
      {
        kind: 'world-entity',
        tenantId: TENANT_A,
        entityId: entity.id,
        contentDigest: canonicalDigest(entity as unknown as JsonValue),
      },
      {
        kind: 'world-event',
        tenantId: TENANT_A,
        eventId: event.id,
        contentDigest: canonicalDigest(event as unknown as JsonValue),
      },
      {
        kind: 'world-relation',
        tenantId: TENANT_A,
        relationId: relation.id,
        contentDigest: canonicalDigest(relation as unknown as JsonValue),
      },
    ];
    refs.sort((a, b) => {
      const key = (r: ProjectedReference): string => {
        switch (r.kind) {
          case 'world-entity':
            return `world-entity:${r.entityId}`;
          case 'world-event':
            return `world-event:${r.eventId}`;
          case 'world-relation':
            return `world-relation:${r.relationId}`;
          default:
            return r.kind;
        }
      };
      return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
    });
    content.projectedFrom = refs;
    const shape = content.nodes[1];
    if (shape.kind !== 'shape-2d') throw new Error('fixture shape');
    const entityRef: ProjectedReference = {
      kind: 'world-entity',
      tenantId: TENANT_A,
      entityId: entity.id,
      contentDigest: canonicalDigest(entity as unknown as JsonValue),
    };
    shape.ref = entityRef;
    content.device = desktopDevice();
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) throw new Error(JSON.stringify(sealed.error));
    const parsed = parseExperienceGraph(sealed.value);
    expect(parsed.ok).toBe(true);
  });

  it('a foreign id grammar is rejected (parity is a two-way street)', () => {
    // World-model entity ids are opaque 1..256 strings, but relation ids
    // are strictly derived: a hand-typed relation id must be rejected.
    expect(
      ProjectedWorldRelationRefSchema.safeParse({
        kind: 'world-relation',
        tenantId: TENANT_A,
        relationId: 'rel-not-a-hash',
        contentDigest: 'a'.repeat(64),
      }).success,
    ).toBe(false);
    expect(
      ProjectedWorldEventRefSchema.safeParse({
        kind: 'world-event',
        tenantId: TENANT_A,
        eventId: 'event-3',
        contentDigest: 'a'.repeat(64),
      }).success,
    ).toBe(false);
  });
});
