import { describe, expect, it } from 'vitest';
import { WorldModel, WorldModelError } from '../src/index';
import {
  agentActor,
  entityAssertion,
  evidence,
  measuredConfidence,
  propertyAssertion,
  provenance,
  stepClock,
} from './helpers';

describe('assertion lifecycle (positive)', () => {
  it('applies an assertion with provenance, confidence and validity retained', () => {
    const { clock } = stepClock();
    const world = WorldModel.create({ clock });
    const record = world.applyAssertion({
      ...entityAssertion('b-1', 'core:entity', { height: 10 }),
      validity: { from: clock() },
    });
    expect(record.id).toMatch(/^ass-[0-9]+$/);
    expect(record.status).toBe('live');
    expect(record.sequence).toBeGreaterThan(0);
    expect(record.assertedAt).toBe(clock());
    expect(record.provenance.actor.role).toBe('human');
    expect(record.provenance.evidence[0]?.id).toBe('ev:doc-1');
    expect(record.confidence.distribution).toEqual({ kind: 'point', value: 0.95 });
    expect(record.validity).toEqual({ from: clock() });
    // the exact record stays addressable
    expect(world.getAssertion(record.id)).toBe(record);
  });

  it('supersedes explicitly and keeps both records addressable', () => {
    const { clock, advance } = stepClock();
    const world = WorldModel.create({ clock });
    world.applyAssertion(entityAssertion('b-1', 'core:entity', { height: 10 }));
    const first = world.applyAssertion(propertyAssertion('b-1', 'height', 10));
    advance();
    const second = world.applyAssertion(propertyAssertion('b-1', 'height', 12, { supersedes: first.id }));

    expect(second.supersedes).toBe(first.id);
    expect(world.getAssertion(first.id)?.status).toBe('superseded');
    expect(world.getAssertion(first.id)?.supersededBy).toBe(second.id);
    expect(world.getAssertion(second.id)?.status).toBe('live');
    expect(world.entityHistory('b-1')).toHaveLength(3);
  });

  it('retracts with a tombstone and falls back to the prior live assertion', () => {
    const { clock, advance } = stepClock();
    const world = WorldModel.create({ clock });
    world.applyAssertion(entityAssertion('b-1', 'core:entity', { height: 10 }));
    advance();
    const update = world.applyAssertion(propertyAssertion('b-1', 'height', 12));
    advance();
    const retracted = world.retractAssertion({
      assertionId: update.id,
      reason: 'measurement error',
      provenance: provenance(),
    });

    expect(retracted.status).toBe('retracted');
    expect(retracted.retractionReason).toBe('measurement error');
    // falls back to the initial property value from the entity assertion
    expect(world.getEntity('b-1')?.properties).toEqual({ height: 10 });
    // history retained, never discarded
    expect(world.getAssertion(update.id)?.status).toBe('retracted');
  });

  it('emits audit events for every lifecycle transition', () => {
    const { clock, advance } = stepClock();
    const world = WorldModel.create({ clock });
    const created = world.events()[0];
    expect(created.type).toBe('world-created');
    expect(created.sequence).toBe(1);

    const first = world.applyAssertion(entityAssertion('b-1', 'core:entity', {}));
    const applied = world.events({ type: 'assertion-applied' })[0];
    expect(applied.subject).toBe(first.id);
    expect(applied.actor.id).toBe('user:alice');

    advance();
    const second = world.applyAssertion(entityAssertion('b-1', 'core:entity', { height: 1 }, { supersedes: first.id }));
    expect(world.events({ type: 'assertion-applied' }).map((event) => event.subject)).toEqual([first.id, second.id]);
    expect(world.events({ type: 'assertion-superseded' })[0]?.subject).toBe(first.id);

    advance();
    world.retractAssertion({ assertionId: second.id, reason: 'r', provenance: provenance() });
    expect(world.events({ type: 'assertion-retracted' })[0]?.subject).toBe(second.id);
    // global monotonic ordering
    const sequences = world.events().map((event) => event.sequence);
    expect([...sequences].sort((a, b) => a - b)).toEqual(sequences);
    expect(new Set(sequences).size).toBe(sequences.length);
  });

  it('derives new assertions with explicit provenance links', () => {
    const world = WorldModel.create();
    const base = world.applyAssertion(entityAssertion('b-1', 'core:entity', {}));
    const derived = world.applyAssertion(
      propertyAssertion('b-1', 'height', 10, {
        provenance: provenance({
          actor: agentActor(),
          method: 'photogrammetry',
          derivedFrom: [base.id],
        }),
      }),
    );
    expect(derived.provenance.derivedFrom).toEqual([base.id]);
    expect(derived.provenance.actor.role).toBe('agent');
  });
});

describe('assertion input validation (negative)', () => {
  it('rejects confidence outside [0, 1]', () => {
    const world = WorldModel.create();
    expect(() =>
      world.applyAssertion(entityAssertion('b-1', 'core:entity', {}, { confidence: measuredConfidence(1.5) })),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
    expect(() =>
      world.applyAssertion(entityAssertion('b-1', 'core:entity', {}, { confidence: measuredConfidence(-0.1) })),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
  });

  it('rejects malformed confidence distributions', () => {
    const world = WorldModel.create();
    expect(() =>
      world.applyAssertion(
        entityAssertion('b-1', 'core:entity', {}, {
          confidence: { distribution: { kind: 'interval', lower: 0.8, upper: 0.2 } },
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
    expect(() =>
      world.applyAssertion(
        entityAssertion('b-1', 'core:entity', {}, {
          confidence: { distribution: { kind: 'set', values: [0.5], weights: [1, 1] } },
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
    const unknownDistribution = {
      statement: { kind: 'entity' as const, entityId: 'b-1', entityType: 'core:entity' },
      provenance: provenance(),
      confidence: { distribution: { kind: 'quantum', value: 0.5 } },
    } as unknown as Parameters<typeof world.applyAssertion>[0];
    expect(() => world.applyAssertion(unknownDistribution)).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
  });

  it('rejects malformed provenance (missing actor, empty method, unknown structural fields)', () => {
    const world = WorldModel.create();
    const good = { statement: { kind: 'entity' as const, entityId: 'b-1', entityType: 'core:entity' } };
    const conf = measuredConfidence(1);
    const asInput = (value: unknown): Parameters<typeof world.applyAssertion>[0] =>
      value as Parameters<typeof world.applyAssertion>[0];
    expect(() => world.applyAssertion(asInput({ ...good, confidence: conf }))).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
    expect(() =>
      world.applyAssertion(asInput({ ...good, provenance: { method: 'x', evidence: [] }, confidence: conf })),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
    expect(() =>
      world.applyAssertion({
        ...good,
        provenance: { actor: { id: 'a', role: 'human' }, method: '', evidence: [] },
        confidence: conf,
      }),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
    expect(() =>
      world.applyAssertion(
        asInput({
          ...good,
          provenance: {
            actor: { id: 'a', role: 'human' },
            method: 'x',
            evidence: [],
            // provider semantics cannot enter through unknown provenance structure
            'openai:assistant': 'gpt-5',
          },
          confidence: conf,
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
  });

  it('rejects malformed validity intervals', () => {
    const world = WorldModel.create();
    expect(() =>
      world.applyAssertion(
        entityAssertion('b-1', 'core:entity', {}, {
          validity: { from: '2026-01-02T00:00:00Z', to: '2026-01-01T00:00:00Z' },
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
    const malformedInstant = {
      statement: { kind: 'entity' as const, entityId: 'b-1', entityType: 'core:entity' },
      provenance: provenance(),
      confidence: measuredConfidence(1),
      validity: { from: 'yesterday' },
    } as unknown as Parameters<typeof world.applyAssertion>[0];
    expect(() => world.applyAssertion(malformedInstant)).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
  });

  it('rejects provenance that derives from unknown assertions', () => {
    const world = WorldModel.create();
    expect(() =>
      world.applyAssertion(
        entityAssertion('b-1', 'core:entity', {}, {
          provenance: provenance({ derivedFrom: ['ass-999'] }),
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'WM_NOT_FOUND' }));
  });

  it('rejects evidence references with malformed digests', () => {
    const world = WorldModel.create();
    expect(() =>
      world.applyAssertion(
        entityAssertion('b-1', 'core:entity', {}, {
          provenance: provenance({ evidence: [evidence('ev:1', { digest: 'NOT-HEX' })] }),
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
  });
});

describe('supersession and retraction state machine (negative)', () => {
  it('rejects superseding an assertion that addresses a different key', () => {
    const world = WorldModel.create();
    const first = world.applyAssertion(entityAssertion('b-1', 'core:entity', {}));
    expect(() =>
      world.applyAssertion(entityAssertion('b-2', 'core:entity', {}, { supersedes: first.id })),
    ).toThrow(expect.objectContaining({ code: 'WM_CONFLICT' }));
  });

  it('rejects superseding unknown or non-live assertions', () => {
    const world = WorldModel.create();
    expect(() =>
      world.applyAssertion(entityAssertion('b-1', 'core:entity', {}, { supersedes: 'ass-404' })),
    ).toThrow(expect.objectContaining({ code: 'WM_NOT_FOUND' }));

    const first = world.applyAssertion(entityAssertion('b-1', 'core:entity', {}));
    world.applyAssertion(entityAssertion('b-1', 'core:entity', {}, { supersedes: first.id }));
    expect(() =>
      world.applyAssertion(entityAssertion('b-1', 'core:entity', {}, { supersedes: first.id })),
    ).toThrow(expect.objectContaining({ code: 'WM_CONFLICT' }));
  });

  it('makes supersession cycles impossible (A<-B, then B<-A rejected)', () => {
    const world = WorldModel.create();
    const a = world.applyAssertion(entityAssertion('b-1', 'core:entity', { v: 1 }));
    const b = world.applyAssertion(entityAssertion('b-1', 'core:entity', { v: 2 }, { supersedes: a.id }));
    // try to close the loop: supersede B with something claiming A's lineage
    expect(world.getAssertion(a.id)?.status).toBe('superseded');
    expect(() =>
      world.applyAssertion(entityAssertion('b-1', 'core:entity', { v: 3 }, { supersedes: b.id })),
    ).toBeDefined();
    expect(() =>
      world.applyAssertion(entityAssertion('b-1', 'core:entity', { v: 1 }, { supersedes: a.id })),
    ).toThrow(expect.objectContaining({ code: 'WM_CONFLICT' }));
  });

  it('rejects retracting unknown, superseded, or already-retracted assertions', () => {
    const world = WorldModel.create();
    expect(() =>
      world.retractAssertion({ assertionId: 'ass-404', reason: 'x', provenance: provenance() }),
    ).toThrow(expect.objectContaining({ code: 'WM_NOT_FOUND' }));

    const a = world.applyAssertion(entityAssertion('b-1', 'core:entity', { v: 1 }));
    const b = world.applyAssertion(entityAssertion('b-1', 'core:entity', { v: 2 }, { supersedes: a.id }));
    expect(() =>
      world.retractAssertion({ assertionId: a.id, reason: 'x', provenance: provenance() }),
    ).toThrow(expect.objectContaining({ code: 'WM_CONFLICT' }));
    world.retractAssertion({ assertionId: b.id, reason: 'x', provenance: provenance() });
    expect(() =>
      world.retractAssertion({ assertionId: b.id, reason: 'x', provenance: provenance() }),
    ).toThrow(expect.objectContaining({ code: 'WM_CONFLICT' }));
  });

  it('rejects retractions with empty reasons or missing provenance', () => {
    const world = WorldModel.create();
    const a = world.applyAssertion(entityAssertion('b-1', 'core:entity', {}));
    expect(() =>
      world.retractAssertion({ assertionId: a.id, reason: '', provenance: provenance() }),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
    const missingProvenance = {
      assertionId: a.id,
      reason: 'x',
    } as unknown as Parameters<typeof world.retractAssertion>[0];
    expect(() => world.retractAssertion(missingProvenance)).toThrow(WorldModelError);
  });
});
