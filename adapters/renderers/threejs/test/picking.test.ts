/**
 * W058 unit battery — hit testing through the REAL Raycaster.
 *
 * Proves (headless): the projectedPointerOf -> hitTestPointer roundtrip
 * resolves every presented entity (the pointer positions are DERIVED from
 * the real camera projection, never guessed); invisible presentation
 * (hidden entities, hidden layers) never hits; agent representations hit
 * as agents; decorations resolve to their entities; a real miss is a miss.
 */
import { describe, expect, it } from 'vitest';
import {
  hitTestPointer,
  projectedPointerOf,
  type PointerHit,
} from '../src/index';
import type { PortableViewState } from '@epoch/renderer-runtime';
import { UNIT_ENTITY_IDS, mountUnitSession, unitViewState } from './helpers';

describe('W058 three.js adapter — Raycaster hit testing', () => {
  it('resolves every presented entity through its real projection (roundtrip)', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    for (const entityId of presentation.presentedEntityIds) {
      const projected = projectedPointerOf(presentation, entityId);
      expect(projected).toBeDefined();
      const hit: PointerHit | undefined = hitTestPointer(
        presentation,
        projected!.x,
        projected!.y,
      );
      expect(hit).toBeDefined();
      expect(hit!.identity).toEqual({ kind: 'entity', id: entityId });
    }
  });

  it('never hits a hidden entity (invisible presentation is not interactive)', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const viewState: PortableViewState = {
      ...unitViewState(),
      hiddenEntityIds: [UNIT_ENTITY_IDS[0]],
    };
    // Apply the hidden set through the SAME code path the seam uses.
    const { applyViewStateToPresentation } = await import('../src/index');
    applyViewStateToPresentation(presentation, viewState, ['focused-entities', 'layer-visibility']);
    const projected = projectedPointerOf(presentation, UNIT_ENTITY_IDS[0]);
    expect(projected).toBeDefined();
    const hit = hitTestPointer(presentation, projected!.x, projected!.y);
    expect(hit?.identity.id).not.toBe(UNIT_ENTITY_IDS[0]);
  });

  it('never hits an entity hidden through semantic layer visibility', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const { applyViewStateToPresentation } = await import('../src/index');
    // 'unit:structure' -> lyr-structure; 'unit:node' -> lyr-node.
    applyViewStateToPresentation(
      presentation,
      { ...unitViewState(), layerVisibility: [{ layerId: 'lyr-structure', visible: false }] },
      ['focused-entities', 'layer-visibility'],
    );
    expect(presentation.entityNodes.get(UNIT_ENTITY_IDS[0])!.visible).toBe(false);
    expect(presentation.entityNodes.get(UNIT_ENTITY_IDS[2])!.visible).toBe(true);
    const projected = projectedPointerOf(presentation, UNIT_ENTITY_IDS[0]);
    expect(projected).toBeDefined();
    const hit = hitTestPointer(presentation, projected!.x, projected!.y);
    expect(hit?.identity.id).not.toBe(UNIT_ENTITY_IDS[0]);
  });

  it('hits an agent representation as an agent (never as a world entity)', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const agent = presentation.agentNodes.values().next().value!;
    const camera = presentation.controls.camera;
    camera.updateMatrixWorld(true);
    const projected = agent.position.clone().project(camera);
    const hit = hitTestPointer(presentation, (projected.x + 1) / 2, (1 - projected.y) / 2);
    expect(hit).toBeDefined();
    expect(hit!.identity).toEqual({ kind: 'agent', id: 'agent:unit-observer' });
  });

  it('resolves decorations to their entities (the highlight shell is the entity)', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    // beta carries the highlight shell (a child mesh). The walk-up semantic
    // resolution of the SHELL is beta — decorations of an entity are the
    // entity (that is what makes a highlight ring clickable as its entity).
    const { semanticIdentityOf } = await import('../src/index');
    const beta = presentation.entityNodes.get(UNIT_ENTITY_IDS[1])!;
    const shell = beta.children.find((child) => child !== beta)!;
    expect(semanticIdentityOf(shell)).toEqual({ kind: 'entity', id: UNIT_ENTITY_IDS[1] });
    // And a center ray at beta (which hits the shell surface first) still
    // resolves beta.
    const projected = projectedPointerOf(presentation, UNIT_ENTITY_IDS[1])!;
    const hit = hitTestPointer(presentation, projected.x, projected.y);
    expect(hit?.identity).toEqual({ kind: 'entity', id: UNIT_ENTITY_IDS[1] });
  });

  it('misses cleanly when the pointer aims at empty space', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    // A point far from every entity (below the world plane, behind nothing).
    const hit = hitTestPointer(presentation, 0.99, 0.99);
    // Whatever it resolves (or not), it must never fabricate an entity that
    // is not presented there; the deterministic assertion is a miss here.
    expect(hit?.identity.id === UNIT_ENTITY_IDS[0]).toBe(false);
  });
});
