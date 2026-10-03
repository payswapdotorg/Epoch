// Interaction-intent validation across the full world subset (positive):
// every one of the 23 kinds admits, version-gates, and bridges to its
// typed ControlIntent (the `bind` kind added at 1.1.0 by W066/ACR-010,
// additive — the 22 pre-existing kinds untouched).
import { describe, expect, it } from 'vitest';
import {
  WORLD_INTERACTION_KINDS,
  controlIntentIdOf,
  controlIntentOf,
  admitWorldIntent,
  isWorldInteractionKind,
} from '../src/index';
import { intentFixtures } from './fixtures';

describe('world interaction intents (positive)', () => {
  it('the world subset covers exactly the 23 pinned universal interactions', () => {
    expect(WORLD_INTERACTION_KINDS).toHaveLength(23);
    expect([...WORLD_INTERACTION_KINDS].sort()).toEqual([
      'annotate',
      'bind',
      'branch',
      'change',
      'compare',
      'connect',
      'disconnect',
      'filter',
      'follow-agent',
      'hide',
      'inspect',
      'isolate',
      'measure',
      'move',
      'pause',
      'query',
      'replay',
      'resume',
      'rotate',
      'select',
      'show',
      'simulate',
      'zoom',
    ]);
  });

  it('the action/collaboration interactions are NOT part of the world subset', () => {
    for (const foreign of ['approve', 'reject', 'execute', 'take-control', 'release-control']) {
      expect(isWorldInteractionKind(foreign)).toBe(false);
    }
  });

  it.each(intentFixtures().map((intent) => [intent.kind, intent] as const))(
    'admits a valid "%s" intent',
    (_kind, intent) => {
      const admitted = admitWorldIntent(intent);
      expect(admitted.ok, JSON.stringify(admitted)).toBe(true);
      if (!admitted.ok) return;
      expect(admitted.value.kind).toBe(intent.kind);
    },
  );

  it('every fixture kind is covered exactly once (no gaps, no duplicates)', () => {
    const kinds = intentFixtures().map((intent) => intent.kind).sort();
    expect(kinds).toEqual([...WORLD_INTERACTION_KINDS].sort());
  });

  it('each intent bridges to its typed ControlIntent (R30)', () => {
    for (const intent of intentFixtures()) {
      expect(controlIntentOf(intent)).toEqual({
        id: `epoch.world.interaction.${intent.kind}`,
        version: '1.1.0',
      });
    }
  });

  it('control-intent ids match the qualified-name grammar', () => {
    for (const kind of WORLD_INTERACTION_KINDS) {
      expect(controlIntentIdOf(kind)).toMatch(/^[a-z0-9]+(\.[a-z0-9-]+)+$/);
    }
  });

  it('the pre-existing ControlIntent ids are unchanged by the additive bind kind (W066)', () => {
    // Closed-vocabulary extension only: every 1.0.0-era qualified id maps to
    // itself, and the new kind occupies exactly one new id.
    expect(controlIntentIdOf('bind')).toBe('epoch.world.interaction.bind');
    expect(controlIntentIdOf('select')).toBe('epoch.world.interaction.select');
    expect(controlIntentIdOf('follow-agent')).toBe('epoch.world.interaction.follow-agent');
  });

  it('unsorted entity-id sets in hide/show/filter intents are rejected (deterministic sets)', () => {
    const admitted = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'hide',
      intentId: 'intent-unsorted',
      entityIds: ['wall-b', 'wall-a'],
    });
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('invalid-intent');
  });

  it('a zoom factor of zero is rejected', () => {
    const admitted = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'zoom',
      intentId: 'intent-zoom-zero',
      factor: 0,
    });
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('invalid-intent');
  });
});
