import { describe, expect, it } from 'vitest';
import { WorldModel } from '../src/index';
import { entityAssertion, propertyAssertion, provenance, stepClock } from './helpers';

describe('temporal history and point-in-time reconstruction (positive)', () => {
  it('resolves property values as of arbitrary instants', () => {
    const { clock, advance } = stepClock();
    const world = WorldModel.create({ clock });
    const t0 = clock();
    world.applyAssertion(entityAssertion('b-1', 'core:entity', { height: 10 }));
    const t1 = advance();
    world.applyAssertion(propertyAssertion('b-1', 'height', 12));
    const t2 = advance();
    world.applyAssertion(propertyAssertion('b-1', 'height', 15));
    const t3 = advance();

    expect(world.getEntity('b-1', t0)?.properties).toEqual({ height: 10 });
    expect(world.getEntity('b-1', t1)?.properties).toEqual({ height: 12 });
    expect(world.getEntity('b-1', t2)?.properties).toEqual({ height: 15 });
    expect(world.getEntity('b-1', t3)?.properties).toEqual({ height: 15 });
    expect(world.getEntity('b-1')?.properties).toEqual({ height: 15 });
  });

  it('honors validity windows: assertions expire and fall back', () => {
    const { clock, advance } = stepClock();
    const world = WorldModel.create({ clock });
    world.applyAssertion(entityAssertion('b-1', 'core:entity', { status: 'planned' }));
    const t1 = advance();
    const t2 = advance();
    const t3 = advance();
    const t4 = advance();
    // an occupancy state valid only over [t2, t3)
    world.applyAssertion(
      propertyAssertion('b-1', 'status', 'occupied', { validity: { from: t2, to: t3 }, at: t1 }),
    );

    expect(world.getEntity('b-1', t1)?.properties).toEqual({ status: 'planned' });
    expect(world.getEntity('b-1', t2)?.properties).toEqual({ status: 'occupied' }); // from is inclusive
    expect(world.getEntity('b-1', t3)?.properties).toEqual({ status: 'planned' }); // to is exclusive
    expect(world.getEntity('b-1', t4)?.properties).toEqual({ status: 'planned' });
  });

  it('honors future validity: an assertion is invisible before its window opens', () => {
    const { clock, advance } = stepClock();
    const world = WorldModel.create({ clock });
    const t1 = advance();
    world.applyAssertion(entityAssertion('b-1', 'core:entity', { state: 'old' }));
    const t2 = advance();
    const t3 = advance();
    world.applyAssertion(propertyAssertion('b-1', 'state', 'new', { validity: { from: t3 }, at: t2 }));

    expect(world.getEntity('b-1', t1)?.properties).toEqual({ state: 'old' });
    expect(world.getEntity('b-1', t2)?.properties).toEqual({ state: 'old' });
    expect(world.getEntity('b-1', t3)?.properties).toEqual({ state: 'new' });
  });

  it('retraction only affects the view from the retraction instant onward', () => {
    const { clock, advance } = stepClock();
    const world = WorldModel.create({ clock });
    world.applyAssertion(entityAssertion('b-1', 'core:entity', { height: 10 }));
    const t1 = advance();
    const update = world.applyAssertion(propertyAssertion('b-1', 'height', 12, { at: t1 }));
    const t2 = advance();
    const t3 = advance();
    world.retractAssertion({
      assertionId: update.id,
      reason: 'bad sensor',
      provenance: provenance(),
      at: t3,
    });

    expect(world.getEntity('b-1', t2)?.properties).toEqual({ height: 12 });
    expect(world.getEntity('b-1', t3)?.properties).toEqual({ height: 10 });
  });

  it('asOf returns a coherent point-in-time read view', () => {
    const { clock, advance } = stepClock();
    const world = WorldModel.create({ clock });
    const t0 = clock();
    world.applyAssertion(entityAssertion('b-1', 'core:entity', { height: 10 }));
    world.applyAssertion(entityAssertion('b-2', 'core:entity', {}));
    const t1 = advance();
    world.applyAssertion(propertyAssertion('b-1', 'height', 12));
    const t2 = advance();

    const past = world.asOf(t1);
    expect(past.at).toBe(t1);
    expect(past.getEntity('b-1')?.properties).toEqual({ height: 12 });
    expect(past.listEntities().map((entity) => entity.id)).toEqual(['b-1', 'b-2']);
    const before = world.asOf(t0);
    expect(before.getEntity('b-1')?.properties).toEqual({ height: 10 });
    expect(world.asOf(t2).getEntity('b-1')?.properties).toEqual({ height: 12 });
  });

  it('entity epochs: superseding existence starts a new createdAt without losing history', () => {
    const { clock, advance } = stepClock();
    const world = WorldModel.create({ clock });
    const t0 = clock();
    const first = world.applyAssertion(entityAssertion('b-1', 'core:entity', { v: 1 }));
    const t1 = advance();
    world.applyAssertion(entityAssertion('b-1', 'core:entity', { v: 2 }, { supersedes: first.id }));
    expect(world.getEntity('b-1')?.createdAt).toBe(t1);
    expect(world.getEntity('b-1', t0)?.createdAt).toBe(t0);
    expect(world.entityHistory('b-1')).toHaveLength(2);
  });

  it('events are filterable by sequence and type', () => {
    const { clock, advance } = stepClock();
    const world = WorldModel.create({ clock });
    world.applyAssertion(entityAssertion('b-1', 'core:entity', {}));
    advance();
    world.applyAssertion(propertyAssertion('b-1', 'height', 1));
    const all = world.events();
    const midSequence = all[all.length - 1].sequence - 1;
    expect(world.events({ sinceSequence: midSequence }).every((event) => event.sequence > midSequence)).toBe(true);
    expect(world.events({ type: 'assertion-applied' })).toHaveLength(2);
  });
});

describe('temporal boundaries (negative)', () => {
  it('rejects malformed instants in asOf', () => {
    const world = WorldModel.create();
    expect(() => world.asOf('not-an-instant')).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
    expect(() => world.asOf('2026-01-01T00:00:00+01:00')).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
  });
});
