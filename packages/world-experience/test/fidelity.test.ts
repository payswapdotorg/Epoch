// Fidelity projections (device adaptation): the canonical profile table,
// per-level projections, deterministic truncation with explicit
// reductions, and semantic preservation.
import { describe, expect, it } from 'vitest';
import {
  WORLD_FIDELITY_PROFILES,
  fidelityProfileOf,
  isWorldFidelityLevel,
  projectWorldScene,
} from '../src/fidelity';
import { WORLD_FIDELITY_LEVELS } from '../src/version';
import type { WorldScene } from '../src/scene';
import type { FollowAgentCamera } from '../src/camera';
import { createWorldScene, emptyWorldSceneStore } from '../src/scene';
import { applyWorldIntent } from '../src/reducer';
import { admitWorldIntent } from '../src/intent';
import { sceneContent } from './fixtures';

function sealedScene() {
  const created = createWorldScene(emptyWorldSceneStore(), sceneContent());
  if (!created.ok) {
    throw new Error(`fixture scene failed: ${created.error.message}`);
  }
  return created.value.scene;
}

describe('fidelity profiles (the canonical device-adaptation table)', () => {
  it('the five pinned levels exist', () => {
    expect(WORLD_FIDELITY_LEVELS).toEqual(['desktop', 'low', 'mobile', 'remote', 'web']);
  });

  it('desktop = full fidelity (spatial, high limits, full presence/narrative, no remote)', () => {
    const profile = fidelityProfileOf('desktop');
    expect(profile).toEqual({
      fidelity: 'desktop',
      spatial: true,
      maxAppliedOverlays: 64,
      maxAnimationInstructions: 128,
      maxMarkers: 512,
      presenceDetail: 'full',
      narrativeDetail: 'full',
      remoteRendering: false,
    });
  });

  it('low = 2D/reduced (no spatial, no animations, reduced overlays)', () => {
    const profile = fidelityProfileOf('low');
    expect(profile.spatial).toBe(false);
    expect(profile.maxAnimationInstructions).toBe(0);
    expect(profile.maxAppliedOverlays).toBe(4);
  });

  it('remote = optional remote rendering', () => {
    expect(fidelityProfileOf('remote').remoteRendering).toBe(true);
    expect(fidelityProfileOf('desktop').remoteRendering).toBe(false);
  });

  it('profile lookup validates the closed vocabulary', () => {
    expect(isWorldFidelityLevel('mobile')).toBe(true);
    expect(isWorldFidelityLevel('tablet')).toBe(false);
  });

  it('the profile table covers every level (total lookup)', () => {
    for (const level of WORLD_FIDELITY_LEVELS) {
      expect(WORLD_FIDELITY_PROFILES[level].fidelity).toBe(level);
    }
  });
});

describe('fidelity projection variants', () => {
  it('desktop projection of the fixture scene retains everything (no reductions)', () => {
    const projection = projectWorldScene(sealedScene(), 'desktop');
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.reductions).toEqual([]);
    expect(projection.value.entityIds).toEqual(['wall-north-1', 'wall-south-2']);
    expect(projection.value.appliedOverlayIds).toEqual([
      'ovl-highlight-north',
      'ovl-measure-span',
    ]);
    expect(projection.value.animationInstructionIds).toEqual(['ani-lift-north']);
    expect(projection.value.narrativeBlockIds).toEqual(['nrb-status-inspect', 'nrb-status-lift']);
    expect(projection.value.presenceParticipantIds).toEqual(['agent:planner-1', 'user:alice']);
    expect(projection.value.spatial).toBe(true);
    expect(projection.value.remoteRendering).toBe(false);
  });

  it('web projection is normal fidelity (same semantics, seats-level presence)', () => {
    const projection = projectWorldScene(sealedScene(), 'web');
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.fidelity).toBe('web');
    // The fixture applies 2 overlays — under the web limit of 16, nothing truncates.
    expect(projection.value.reductions).toEqual([]);
  });

  it('mobile projection is field fidelity (headline narrative only)', () => {
    const projection = projectWorldScene(sealedScene(), 'mobile');
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    // The lift block carries a body; headline detail keeps only blocks
    // without body text (the inspect-pending block).
    expect(projection.value.narrativeBlockIds).toEqual(['nrb-status-inspect']);
    expect(projection.value.reductions).toContainEqual({
      aspect: 'narrative-blocks',
      reason: 'fidelity-narrative-detail',
      encountered: 2,
      retained: 1,
    });
  });

  it('low projection is 2D/reduced (no spatial, no animations, presence dropped)', () => {
    const projection = projectWorldScene(sealedScene(), 'low');
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.spatial).toBe(false);
    expect(projection.value.animationInstructionIds).toEqual([]);
    expect(projection.value.presenceParticipantIds).toEqual([]);
    expect(projection.value.reductions).toEqual(
      expect.arrayContaining([
        { aspect: 'animation-instructions', reason: 'fidelity-max-animation-instructions', encountered: 1, retained: 0 },
        { aspect: 'presence-participants', reason: 'fidelity-presence-detail', encountered: 2, retained: 0 },
        { aspect: 'spatial-presentation', reason: 'fidelity-spatial-disabled', encountered: 2, retained: 2 },
      ]),
    );
    // Same semantics: the entity set never changes at any fidelity.
    expect(projection.value.entityIds).toEqual(['wall-north-1', 'wall-south-2']);
  });

  it('remote projection requests remote rendering', () => {
    const projection = projectWorldScene(sealedScene(), 'remote');
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.remoteRendering).toBe(true);
  });

  it('projections are deterministic (two runs are byte-identical)', () => {
    const first = projectWorldScene(sealedScene(), 'mobile');
    const second = projectWorldScene(sealedScene(), 'mobile');
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('truncation keeps the FIRST entries in canonical order (mobile, 8-overlay limit)', () => {
    // Build a scene with 10 applied overlays (deterministic ids/orders).
    const content = sceneContent();
    const overlays = content.overlays.slice();
    const applied = content.appliedOverlays.slice();
    for (let i = 0; i < 8; i += 1) {
      overlays.push({
        overlayId: `ovl-extra-${i}`,
        overlayKind: 'highlight',
        entityId: 'wall-north-1',
        color: '#ff0000',
      });
      applied.push({ overlayId: `ovl-extra-${i}`, orderIndex: 2 + i });
    }
    overlays.sort((a, b) => (a.overlayId < b.overlayId ? -1 : 1));
    const created = createWorldScene(emptyWorldSceneStore(), {
      ...content,
      overlays,
      appliedOverlays: applied,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const projection = projectWorldScene(created.value.scene, 'mobile');
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    // Mobile limit is 8 applied overlays: the first 8 in application
    // order are retained, the last 2 dropped with an explicit reduction.
    expect(projection.value.appliedOverlayIds).toHaveLength(8);
    expect(projection.value.reductions).toContainEqual({
      aspect: 'applied-overlays',
      reason: 'fidelity-max-applied-overlays',
      encountered: 10,
      retained: 8,
    });
  });

  it('the followed agent cursor drops at seats-level presence detail (typed reduction)', () => {
    const admitted = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'follow-agent',
      intentId: 'intent-follow-fidelity',
      agentId: 'agent:planner-1',
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    let state = emptyWorldSceneStore();
    const created = createWorldScene(state, sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    state = created.value.state;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', admitted.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    // Attach a cursor to the followed camera.
    const followedCamera = applied.value.outcome.scene.camera;
    if (followedCamera.mode !== 'follow-agent') {
      throw new Error('expected follow-agent camera');
    }
    const cameraWithCursor: FollowAgentCamera = {
      ...followedCamera,
      cursor: { position3d: [1, 2, 3], atMs: 100 },
    };
    const scene: WorldScene = {
      ...applied.value.outcome.scene,
      camera: cameraWithCursor,
    };
    const webProjection = projectWorldScene(scene, 'web');
    expect(webProjection.ok).toBe(true);
    if (!webProjection.ok) return;
    expect(webProjection.value.reductions).toContainEqual({
      aspect: 'presence-participants',
      reason: 'fidelity-presence-detail',
      encountered: 3,
      retained: 2,
    });
    if (webProjection.value.camera.mode !== 'follow-agent') {
      throw new Error('expected follow-agent camera');
    }
    expect(webProjection.value.camera.cursor).toBeUndefined();
    // Desktop keeps the cursor (full presence detail).
    const desktopProjection = projectWorldScene(scene, 'desktop');
    expect(desktopProjection.ok).toBe(true);
    if (!desktopProjection.ok) return;
    if (desktopProjection.value.camera.mode !== 'follow-agent') {
      throw new Error('expected follow-agent camera');
    }
    expect(desktopProjection.value.camera.cursor).toEqual({ position3d: [1, 2, 3], atMs: 100 });
  });

  it('the fidelity level vocabulary is closed (runtime guard)', () => {
    // Compile-time closed vocabulary via WorldFidelityLevel; the runtime
    // guard is pinned above. The projection surface cannot be driven with
    // a foreign level by type.
    expect(WORLD_FIDELITY_LEVELS).toHaveLength(5);
  });
});
