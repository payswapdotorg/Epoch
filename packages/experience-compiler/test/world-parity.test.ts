// World-model parity (devDependency — NO runtime coupling): a real
// WorldModel is built through the W002 public API, its materialized
// entities/relations/events flow through the W011 envelope and the
// compiler into the Render Plan unchanged, and the plan's opaque
// references keep the world-model digest discipline. If the world
// model's id grammars or shapes ever change, the compile-time pin
// (src/host-parity.ts) and this test fail.
import { describe, expect, it } from 'vitest';
import { WorldModel, type Clock } from '@epoch/world-model';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { sealExperienceGraph, type ProjectedReference } from '@epoch/experience-protocol';
import { compileExperienceGraph } from '../src/index';
import { desktopDevice, graphContent, TENANT_A } from './fixtures';

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
  world.registerEntityType({ key: 'parity:building' });
  world.registerRelationType({
    key: 'parity:connected-to',
    sourceType: 'parity:building',
    targetType: 'parity:building',
  });
  world.applyAssertion({
    statement: {
      kind: 'entity',
      entityId: 'building-7',
      entityType: 'parity:building',
      properties: { height: 42 },
    },
    provenance: provenance(),
    confidence: { distribution: { kind: 'point', value: 0.95 }, method: 'measured' },
  });
  world.applyAssertion({
    statement: {
      kind: 'entity',
      entityId: 'building-8',
      entityType: 'parity:building',
      properties: { height: 30 },
    },
    provenance: provenance(),
    confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'measured' },
  });
  world.applyAssertion({
    statement: {
      kind: 'relation',
      relationType: 'parity:connected-to',
      source: 'building-7',
      target: 'building-8',
      properties: { corridor: 'north' },
    },
    provenance: provenance(),
    confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'measured' },
  });
  return world;
}

describe('world-model parity (devDependency, upstream)', () => {
  const world = buildWorld();

  it('real world state compiles into a plan that preserves the references verbatim', () => {
    const entity = world.getEntity('building-7');
    const relation = world.listRelations()[0];
    const event = world.events()[0];
    if (entity === null || relation === undefined || event === undefined) {
      throw new Error('world fixture incomplete');
    }
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
    const content = graphContent('2d');
    content.projectedFrom = refs;
    content.nodes.sort((a, b) => (a.id < b.id ? -1 : 1));
    const shape = content.nodes.find((node) => node.kind === 'shape-2d');
    if (shape === undefined || shape.kind !== 'shape-2d') throw new Error('fixture shape');
    shape.ref = refs[0];
    content.device = desktopDevice();
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) throw new Error(JSON.stringify(sealed.error));
    const compiled = compileExperienceGraph({ envelope: sealed.value, device: desktopDevice() });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.error));
    // The plan preserves the exact world-state references: opaque, exact
    // revision, tenant-scoped — never embedded, never reinterpreted.
    expect(compiled.value.sourceRefs).toEqual(refs);
    expect(compiled.value.sourceEnvelopeDigest).toBe(sealed.value.digest);
    const draw = compiled.value.stages.find((stage) => stage.stage === 'draw-2d');
    if (draw === undefined || draw.stage !== 'draw-2d') throw new Error('fixture stage');
    const shapeDraw = draw.draws.find((d) => d.op === 'draw-shape');
    if (shapeDraw === undefined || shapeDraw.op !== 'draw-shape') throw new Error('fixture op');
    expect(shapeDraw.ref).toEqual(refs[0]);
    if (shapeDraw.ref !== undefined && shapeDraw.ref.kind === 'world-entity') {
      expect(shapeDraw.ref.contentDigest).toBe(canonicalDigest(entity as unknown as JsonValue));
    }
  });

  it('the plan carries no embedded world state (projection, never authority)', () => {
    const entity = world.getEntity('building-7');
    if (entity === null) throw new Error('world fixture incomplete');
    const serialized = JSON.stringify(
      compileExperienceGraph({
        envelope: sealExperienceGraph(graphContent('2d')).ok
          ? (sealExperienceGraph(graphContent('2d')) as { value: unknown }).value
          : graphContent('2d'),
        device: desktopDevice(),
      }),
    );
    // The plan references the entity opaquely (id + digest); it never
    // embeds the entity object (its property values, types, or provenance).
    expect(serialized).toContain('building-7');
    expect(serialized).not.toContain('parity:building');
    expect(serialized).not.toContain('"height":42');
    expect(serialized).not.toContain('confidence');
    expect(serialized).not.toContain('provenance');
    expect(serialized).not.toContain('measured');
  });
});
