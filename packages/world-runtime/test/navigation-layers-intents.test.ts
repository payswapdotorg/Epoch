// W057 — navigation + layer derivation + intent builders (pure units).
import { describe, expect, it } from 'vitest';
import type { PortableCameraState } from '@epoch/renderer-runtime';
import {
  NAVIGATION_LIMITS,
  applyNavigationGesture,
  applyZoomFactor,
  eyeOf,
  lookAtBasis,
  navigationFromCamera,
  navigationToCamera,
  projectPoint,
} from '../src/navigation';
import { deriveLayers, layerIdOfEntityType, namespaceOfEntityType } from '../src/layers';
import {
  buildAnnotateIntent,
  buildBranchIntent,
  buildFilterIntent,
  buildFollowAgentIntent,
  buildHideIntent,
  buildMeasureIntent,
  buildPauseIntent,
  buildReplayIntent,
  buildResumeIntent,
  buildShowIntent,
  buildSimulateIntent,
  intentForControl,
} from '../src/intents';
import { admitWorldIntent, type WorldScene } from '@epoch/world-experience';
import { SCENE } from './fixtures';

const ORBIT_CAMERA: PortableCameraState = {
  mode: 'orbit',
  position: [24, 18, 24],
  target: [6, 4, 0],
  fovRadians: Math.PI / 4,
};

describe('navigation', () => {
  it('derives the orbit state from a portable camera (and round-trips)', () => {
    const state = navigationFromCamera(ORBIT_CAMERA);
    expect(state.target).toEqual([6, 4, 0]);
    expect(state.distance).toBeCloseTo(Math.hypot(18, 14, 24), 10);
    const roundTrip = navigationToCamera(state);
    // Round-trip through azimuth/elevation recovers the eye position.
    expect(roundTrip.position[0]).toBeCloseTo(24, 6);
    expect(roundTrip.position[1]).toBeCloseTo(18, 6);
    expect(roundTrip.position[2]).toBeCloseTo(24, 6);
    expect(roundTrip.target).toEqual([6, 4, 0]);
  });

  it('non-orbit cameras enter at a neutral orbit (presentation anchor only)', () => {
    const state = navigationFromCamera({ mode: 'free', position: [1, 2, 3] });
    expect(state.distance).toBeGreaterThan(0);
    expect(eyeOf(state)).toBeDefined();
  });

  it('orbit gestures wrap azimuth and clamp elevation', () => {
    const state = navigationFromCamera(ORBIT_CAMERA);
    const orbited = applyNavigationGesture(
      applyNavigationGesture(state, { kind: 'orbit', deltaX: Math.PI * 3, deltaY: -10 }),
      { kind: 'orbit', deltaX: 0, deltaY: 0 },
    );
    expect(orbited.azimuthRad).toBeLessThan(Math.PI * 2);
    expect(orbited.elevationRad).toBeGreaterThanOrEqual(NAVIGATION_LIMITS.minElevationRad);
    expect(orbited.elevationRad).toBeLessThanOrEqual(NAVIGATION_LIMITS.maxElevationRad);
  });

  it('pan translates the anchor without changing the orbit shape', () => {
    const state = navigationFromCamera(ORBIT_CAMERA);
    const panned = applyNavigationGesture(state, { kind: 'pan', deltaX: 40, deltaY: 40 });
    expect(panned.azimuthRad).toBeCloseTo(state.azimuthRad, 10);
    expect(panned.distance).toBeCloseTo(state.distance, 10);
    expect(panned.target).not.toEqual(state.target);
  });

  it('zoom rescales the orbit distance within bounds', () => {
    const state = navigationFromCamera(ORBIT_CAMERA);
    const zoomed = applyNavigationGesture(state, { kind: 'zoom', deltaX: 0, deltaY: 1 });
    expect(zoomed.distance).toBeCloseTo(state.distance * 0.9, 10);
    const tracking = applyZoomFactor(state, 1.25);
    expect(tracking.distance).toBeCloseTo(state.distance / 0.9, 10);
  });

  it('projects the anchor into the frustum center and behind-eye points out', () => {
    const state = navigationFromCamera(ORBIT_CAMERA);
    const center = projectPoint(state, state.target);
    expect(center.inFrustum).toBe(true);
    expect(Math.abs(center.x)).toBeLessThan(0.01);
    expect(Math.abs(center.y)).toBeLessThan(0.01);
    // A point behind the eye (beyond the eye, opposite the target).
    const eye = eyeOf(state);
    const behind = projectPoint(state, [
      eye[0] + (eye[0] - state.target[0]),
      eye[1] + (eye[1] - state.target[1]),
      eye[2] + (eye[2] - state.target[2]),
    ]);
    expect(behind.inFrustum).toBe(false);
  });

  it('the look-at basis is orthonormal', () => {
    const state = navigationFromCamera(ORBIT_CAMERA);
    const { right, up, forward } = lookAtBasis(state);
    const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(right, up)).toBeCloseTo(0, 10);
    expect(dot(right, forward)).toBeCloseTo(0, 10);
    expect(dot(up, forward)).toBeCloseTo(0, 10);
    expect(Math.hypot(...right)).toBeCloseTo(1, 10);
    expect(Math.hypot(...up)).toBeCloseTo(1, 10);
    expect(Math.hypot(...forward)).toBeCloseTo(1, 10);
  });
});

describe('semantic layers', () => {
  it('derives sorted layers from entity types with visibility state', () => {
    const layers = deriveLayers(SCENE);
    expect(layers.map((layer) => layer.layerId)).toEqual(['lyr-mep', 'lyr-site']);
    const mep = layers[0]!;
    expect(mep.entityIds).toEqual(['we-mep-hidden-node', 'we-mep-panel']);
    expect(mep.mixed).toBe(true); // one visible, one hidden
    expect(mep.visible).toBe(false);
    const site = layers[1]!;
    expect(site.visible).toBe(true);
    expect(site.mixed).toBe(false);
  });

  it('layer ids follow the entity-type namespace grammar', () => {
    expect(namespaceOfEntityType('site:structure')).toBe('site');
    expect(layerIdOfEntityType('mep:panel')).toBe('lyr-mep');
    expect(() => namespaceOfEntityType('malformed')).toThrow();
  });
});

describe('intent builders (the EXISTING vocabulary, admitted)', () => {
  it('every builder produces a W016-admissible typed intent', () => {
    const builders: readonly (() => ReturnType<typeof buildPauseIntent>)[] = [
      () => buildReplayIntent({ invocationId: 'inv-1', fromMs: 3_000 }),
      () => buildPauseIntent({ invocationId: 'inv-2' }),
      () => buildResumeIntent({ invocationId: 'inv-3' }),
      () => buildBranchIntent({ invocationId: 'inv-4', atMs: 4_000 }),
      () => buildHideIntent({ invocationId: 'inv-5', entityIds: ['we-a', 'we-b'] }),
      () => buildShowIntent({ invocationId: 'inv-6', entityIds: ['we-a'] }),
      () => buildFilterIntent({ invocationId: 'inv-7', includeEntityIds: ['we-a', 'we-b'] }),
      () => buildFollowAgentIntent({ invocationId: 'inv-8', agentId: 'agent:x' }),
      () => buildMeasureIntent({ invocationId: 'inv-9', fromEntityId: 'we-a', toEntityId: 'we-b' }),
      () => buildAnnotateIntent({ invocationId: 'inv-10', entityId: 'we-a', text: 'note' }),
      () => buildSimulateIntent({ invocationId: 'inv-11', scenarioRef: 'scenario:s1' }),
    ];
    for (const builder of builders) {
      const built = builder();
      expect(built.ok, JSON.stringify(built)).toBe(true);
      if (built.ok) {
        expect(admitWorldIntent(built.value).ok).toBe(true);
      }
    }
  });

  it('empty entity sets are typed rejections', () => {
    expect(buildHideIntent({ invocationId: 'inv-x', entityIds: [] }).ok).toBe(false);
    expect(buildShowIntent({ invocationId: 'inv-x', entityIds: [] }).ok).toBe(false);
    expect(buildFilterIntent({ invocationId: 'inv-x', includeEntityIds: [] }).ok).toBe(false);
  });

  it('scene controls map to the world-subset intents; unknown ids are typed rejections', () => {
    const pauseControl = { id: 'epoch.world.interaction.pause', version: '1.0.0' };
    const mapped = intentForControl(pauseControl, SCENE, { invocationId: 'inv-c1' });
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.value.kind).toBe('pause');
    }
    const unknown = intentForControl(
      { id: 'epoch.vendor.magic', version: '1.0.0' },
      SCENE,
      { invocationId: 'inv-c2' },
    );
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error.code).toBe('input-unsupported');
    }
  });

  it('the fixture scene itself stays canonically valid (digest stability)', () => {
    const scene: WorldScene = SCENE;
    expect(scene.digest).toHaveLength(64);
    expect(scene.entities.length).toBe(4);
    expect(scene.controls.length).toBe(3);
  });
});
