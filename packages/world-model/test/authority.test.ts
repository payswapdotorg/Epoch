import { describe, expect, it } from 'vitest';
import { WorldModel, WorldModelError } from '../src/index';
import type { WorldModel as WorldModelType } from '../src/index';
import { entityAssertion, provenance, stepClock } from './helpers';

/**
 * Authority and security boundaries (architecture-lock rules 1-2, 13).
 *
 * The world model is the semantic authority: agents and views are read-only
 * participants. These tests pin both enforcement layers — the runtime
 * (deep-frozen views, provenance-mandatory writes) and the type surface
 * (no mutator APIs exist to call).
 */

describe('authority: no direct mutation surface (compile-time + runtime)', () => {
  it('exposes no mutator APIs on WorldModel (typed-out by design)', () => {
    type PublicSurface = keyof WorldModelType;
    type Forbidden = Extract<
      PublicSurface,
      | 'setEntity' | 'deleteEntity' | 'updateEntity' | 'removeEntity' | 'putEntity'
      | 'setRelation' | 'deleteRelation' | 'removeRelation'
      | 'setAssertion' | 'deleteAssertion' | 'updateAssertion' | 'editAssertion'
      | 'mutate' | 'set' | 'put' | 'patch' | 'delete' | 'remove' | 'update' | 'clear' | 'reset'
    >;
    // Compiles only while no forbidden mutator name exists on the public surface.
    const proof: Forbidden extends never ? true : never = true;
    expect(proof).toBe(true);
  });

  it('exposes no mutator APIs on the point-in-time read view', () => {
    const world = WorldModel.create();
    const view = world.asOf(new Date().toISOString());
    expect(view.at).toBeDefined();
    type PublicSurface = keyof typeof view;
    type Forbidden = Extract<
      PublicSurface,
      'set' | 'put' | 'patch' | 'delete' | 'remove' | 'update' | 'mutate' | 'clear' | 'reset'
    >;
    const proof: Forbidden extends never ? true : never = true;
    expect(proof).toBe(true);
  });

  it('deep-freezes every value handed to readers', () => {
    const world = WorldModel.create();
    world.applyAssertion(entityAssertion('b-1', 'core:entity', { height: 10 }));

    const entity = world.getEntity('b-1');
    expect(entity).not.toBeNull();
    expect(Object.isFrozen(entity)).toBe(true);
    expect(Object.isFrozen(entity?.properties)).toBe(true);
    expect(Object.isFrozen(world.listEntities())).toBe(true);
    expect(Object.isFrozen(world.entityHistory('b-1'))).toBe(true);
    expect(Object.isFrozen(world.events())).toBe(true);
    expect(Object.isFrozen(world.serialize())).toBe(true);

    const view = world.asOf(new Date().toISOString());
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.listEntities())).toBe(true);
  });

  it('rejects runtime mutation attempts on frozen views (TypeError in strict mode)', () => {
    const world = WorldModel.create();
    const record = world.applyAssertion(entityAssertion('b-1', 'core:entity', { height: 10 }));
    const entity = world.getEntity('b-1');

    expect(() => {
      (entity as { type?: string }).type = 'core:agent';
    }).toThrow(TypeError);
    expect(() => {
      (entity?.properties as { height?: number }).height = 99;
    }).toThrow(TypeError);
    expect(() => {
      (record as { status?: string }).status = 'retracted';
    }).toThrow(TypeError);
    // the durable world state is unchanged
    expect(world.getEntity('b-1')?.type).toBe('core:entity');
    expect(world.getEntity('b-1')?.properties).toEqual({ height: 10 });
    expect(world.getAssertion(record.id)?.status).toBe('live');
  });

  it('the caller cannot mutate the world through a retained input object after applying', () => {
    const { clock } = stepClock();
    const world = WorldModel.create({ clock });
    const input = entityAssertion('b-1', 'core:entity', { height: 10 });
    const record = world.applyAssertion(input);
    // caller mutates their own input afterwards...
    (input.statement as { properties?: { height?: number } }).properties = { height: 999 };
    (input as { confidence: unknown }).confidence = { distribution: { kind: 'point', value: 0.01 } };
    // ...durable world state is unaffected
    expect(world.getEntity('b-1')?.properties).toEqual({ height: 10 });
    expect(world.getAssertion(record.id)?.confidence.distribution).toEqual({ kind: 'point', value: 0.95 });
  });
});

describe('authority: unattributed writes are structurally impossible', () => {
  it('every semantic write path requires provenance (schema-enforced)', () => {
    const world = WorldModel.create();
    const statement = { kind: 'entity', entityId: 'b-1', entityType: 'core:entity' } as const;
    const confidence = { distribution: { kind: 'point' as const, value: 1 } };
    const missingProvenance = { statement, confidence } as unknown as Parameters<
      typeof world.applyAssertion
    >[0];
    expect(() => world.applyAssertion(missingProvenance)).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
    const missingRetractionProvenance = {
      assertionId: 'ass-1',
      reason: 'x',
    } as unknown as Parameters<typeof world.retractAssertion>[0];
    expect(() => world.retractAssertion(missingRetractionProvenance)).toThrow(WorldModelError);
  });

  it('every applied assertion and audit event carries its attributed actor', () => {
    const world = WorldModel.create();
    const record = world.applyAssertion({
      ...entityAssertion('b-1', 'core:entity', {}),
      provenance: provenance({ actor: { id: 'agent:solver-7', role: 'agent' } }),
    });
    expect(record.provenance.actor.id).toBe('agent:solver-7');
    const event = world.events({ type: 'assertion-applied' })[0];
    expect(event.actor.id).toBe('agent:solver-7');
    expect(event.actor.role).toBe('agent');
  });
});

describe('authority: kernel vocabulary and reserved namespaces', () => {
  it("rejects extension types under the reserved 'core' namespace (WM_AUTHORITY)", () => {
    const world = WorldModel.create();
    expect(() => world.registerEntityType({ key: 'core:super-thing' })).toThrow(
      expect.objectContaining({ code: 'WM_AUTHORITY' }),
    );
    expect(() =>
      world.registerRelationType({ key: 'core:mega-link', sourceType: 'core:entity', targetType: 'core:entity' }),
    ).toThrow(expect.objectContaining({ code: 'WM_AUTHORITY' }),
    );
  });

  it("rejects external mappings claiming the reserved 'epoch' standard (WM_AUTHORITY)", () => {
    const world = WorldModel.create();
    expect(() =>
      world.registerExternalMapping({
        id: 'm-evil',
        standard: 'epoch',
        entityTypes: [{ external: 'IfcBuilding', target: 'core:entity' }],
        relationTypes: [],
      }),
    ).toThrow(expect.objectContaining({ code: 'WM_AUTHORITY' }));
  });
});

describe('provider neutrality (external standards map INTO the model)', () => {
  it('registers a valid external mapping as pure data', () => {
    const world = WorldModel.create();
    world.registerEntityType({ key: 'geo:building', properties: { floors: { type: 'integer' } } });
    const stored = world.registerExternalMapping({
      id: 'ifc-basic',
      standard: 'ifc',
      standardVersion: 'IFC4.3',
      description: 'IfcBuilding -> geo:building (reference shape only)',
      entityTypes: [{ external: 'IfcBuilding', target: 'geo:building', propertyMap: { StoreyHeights: 'floors' } }],
      relationTypes: [],
    });
    expect(world.getExternalMapping('ifc-basic')).toBe(stored);
    expect(world.listExternalMappings().map((mapping) => mapping.id)).toEqual(['ifc-basic']);
    // the registration is audited
    expect(world.events({ type: 'external-mapping-registered' })[0]?.subject).toBe('ifc-basic');
  });

  it('rejects mappings that target unregistered types (no phantom ontology)', () => {
    const world = WorldModel.create();
    expect(() =>
      world.registerExternalMapping({
        id: 'm-1',
        standard: 'custom:acme',
        entityTypes: [{ external: 'Widget', target: 'acme:widget' }],
        relationTypes: [],
      }),
    ).toThrow(expect.objectContaining({ code: 'WM_NOT_FOUND' }));
    expect(() =>
      world.registerExternalMapping({
        id: 'm-2',
        standard: 'custom:acme',
        entityTypes: [],
        relationTypes: [{ external: 'linkedTo', target: 'acme:link' }],
      }),
    ).toThrow(expect.objectContaining({ code: 'WM_NOT_FOUND' }));
  });

  it('rejects duplicate mapping ids and empty mappings', () => {
    const world = WorldModel.create();
    world.registerExternalMapping({
      id: 'm-1',
      standard: 'ifc',
      entityTypes: [{ external: 'IfcBuilding', target: 'core:entity' }],
      relationTypes: [],
    });
    expect(() =>
      world.registerExternalMapping({
        id: 'm-1',
        standard: 'git',
        entityTypes: [{ external: 'Repository', target: 'core:entity' }],
        relationTypes: [],
      }),
    ).toThrow(expect.objectContaining({ code: 'WM_CONFLICT' }));
    expect(() =>
      world.registerExternalMapping({ id: 'm-empty', standard: 'git', entityTypes: [], relationTypes: [] }),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
  });

  it('provider identifiers are legal only as opaque strings, never structure', () => {
    const world = WorldModel.create();
    // opaque provider-flavored actor ids are fine — the kernel never interprets them
    const record = world.applyAssertion({
      ...entityAssertion('agent-node', 'core:agent', {}),
      provenance: provenance({
        actor: { id: 'openai:gpt-5:run-42', role: 'external-provider' },
        method: 'llm-inference',
        recordedVia: 'mcp:acme-connector',
      }),
    });
    expect(record.provenance.actor.id).toBe('openai:gpt-5:run-42');
    // but provider fields cannot smuggle structure into the provenance shape
    const smuggled = {
      statement: { kind: 'entity', entityId: 'x', entityType: 'core:entity' },
      provenance: {
        actor: { id: 'openai:gpt-5', role: 'external-provider' },
        method: 'llm-inference',
        evidence: [],
        model: 'gpt-5',
      },
      confidence: { distribution: { kind: 'point', value: 0.8 } },
    } as unknown as Parameters<typeof world.applyAssertion>[0];
    expect(() => world.applyAssertion(smuggled)).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
  });
});
