/**
 * RUNTIME PARITY (W056) — the contract's mirrored W016 grammars accept and
 * reject the SAME values as their canonical home
 * (@epoch/world-experience), for every member of the exemplar corpus.
 *
 * The compile-time pins live in src/parity.ts (member-for-member TYPE
 * equality). This battery adds the behavioral half: if a W016 grammar
 * changes acceptance (a new required field, a tightened bound), this test
 * fails even when the TS shapes still compile (e.g. a refinement-only
 * change), so the mirror in @epoch/renderer-runtime is updated in the
 * same change and the contract re-emitted — the W002-W004 drift
 * discipline.
 */
import { describe, expect, it } from 'vitest';
import {
  CameraStateSchema,
  FollowAgentCameraSchema,
  FollowCursorStateSchema,
  FreeCameraSchema,
  OrbitCameraSchema,
  SceneTimelinePositionSchema,
  WorldEntityIdSchema,
  WorldSceneIdSchema,
} from '@epoch/world-experience';
import {
  PortableCameraStateSchema,
  PortableFollowAgentCameraSchema,
  PortableFollowCursorStateSchema,
  PortableFreeCameraSchema,
  PortableOrbitCameraSchema,
  PortableTimelinePositionSchema,
  WorldEntityIdMirrorSchema,
  WorldSceneIdMirrorSchema,
} from '@epoch/renderer-runtime';
import type { ZodType } from 'zod';

/** Assert the mirror and the canonical grammar agree on ONE value. */
function agrees<T>(mirror: ZodType<T>, canonical: ZodType<T>, value: unknown): void {
  const mirrored = mirror.safeParse(value);
  const homed = canonical.safeParse(value);
  expect(mirrored.success).toBe(homed.success);
  if (mirrored.success && homed.success) {
    expect(mirrored.data).toEqual(homed.data);
  }
}

/** Assert the mirror and the canonical grammar agree on a whole corpus. */
function corpus<T>(name: string, mirror: ZodType<T>, canonical: ZodType<T>, values: unknown[]): void {
  it(`the ${name} mirror tracks the canonical W016 grammar`, () => {
    for (const value of values) {
      agrees(mirror, canonical, value);
    }
  });
}

// ---------------------------------------------------------------------------
// Valid exemplars (one per member of every mirrored grammar).
// ---------------------------------------------------------------------------

const validCursors = [
  {},
  { position2d: { x: 0.5, y: 0.5 } },
  { position3d: [1, 2, 3] },
  { atMs: 1_000 },
  { position3d: [0, 0, 0], atMs: 0 },
];

const validOrbitCameras = [
  { mode: 'orbit', position: [0, 0, 0] },
  { mode: 'orbit', position: [24, 18, 24], target: [5, 5, 0] },
  { mode: 'orbit', position: [1, 2, 3], orientation: [0, 0, 0, 1], fovRadians: 0.9 },
];

const validFreeCameras = [
  { mode: 'free', position: [10, 10, 10] },
  { mode: 'free', position: [0, 0, 0], orientation: [0, 0, 0, 1] },
];

const validFollowCameras = [
  {
    mode: 'follow-agent',
    agentRef: {
      kind: 'agent',
      tenantId: 'tenant-parity',
      agentId: 'agent:parity-observer',
      contentDigest: 'a'.repeat(64),
    },
  },
  {
    mode: 'follow-agent',
    agentRef: {
      kind: 'agent',
      tenantId: 'tenant-parity',
      agentId: 'agent:parity-observer',
      contentDigest: 'b'.repeat(64),
    },
    followDistance: 12.5,
    cursor: { atMs: 250 },
  },
];

const validCameraStates = [
  ...validOrbitCameras,
  ...validFreeCameras,
  ...validFollowCameras,
];

const validTimelinePositions = [
  { atMs: 0, frameIndex: 0, paused: true },
  { atMs: 3_000, frameIndex: 90, paused: false },
  { atMs: 8_000, frameIndex: 240, paused: false, replayWindow: { fromSequence: 1, toSequence: 9 } },
];

const validSceneIds = ['wsc-parity-1', 'wsc-a', 'wsc-' + 'x'.repeat(60)];
const validEntityIds = ['we-parity-alpha', 'we-a.b:c', 'e'.repeat(256)];

// ---------------------------------------------------------------------------
// Invalid exemplars (every mirrored grammar must reject these the SAME way
// its canonical home does — acceptance divergence is drift).
// ---------------------------------------------------------------------------

const invalidCameras = [
  undefined,
  null,
  'orbit',
  {},
  { mode: 'vendor-orbit', position: [0, 0, 0] },
  { mode: 'orbit' },
  { mode: 'orbit', position: [0, 0] },
  { mode: 'orbit', position: ['0', '0', '0'] },
  { mode: 'orbit', position: [0, 0, 0], vendorField: true },
  { mode: 'free', position: [1, 2, 3], fovRadians: 0.9 },
  {
    mode: 'follow-agent',
    agentRef: { kind: 'device', tenantId: 't', agentId: 'a', contentDigest: 'c'.repeat(64) },
  },
  {
    mode: 'follow-agent',
    agentRef: {
      kind: 'agent',
      tenantId: 't',
      agentId: 'a',
      contentDigest: 'not-a-digest',
    },
  },
];

const invalidCursors = [
  { position2d: { x: 0.5 } },
  { position3d: [1, 2] },
  { atMs: -1 },
  { position2d: 0.5 },
  { unknownField: true },
];

const invalidTimelinePositions = [
  {},
  { atMs: -1, frameIndex: 0, paused: true },
  { atMs: 0, frameIndex: -1, paused: true },
  { atMs: 0, frameIndex: 0 },
  { atMs: 0, frameIndex: 0, paused: 'yes' },
  { atMs: 0, frameIndex: 0, paused: true, replayWindow: { fromSequence: 9, toSequence: 1 } },
  { atMs: 0, frameIndex: 0, paused: true, replayWindow: { fromSequence: 1 } },
];

const invalidSceneIds = ['', 'wsc-', 'wsc', 'wsc-', 'scene-1', 'wsc-UPPER', 'wsc-' + 'x'.repeat(65), 7];
const invalidEntityIds = ['', 'e'.repeat(257), 7, null];

// ---------------------------------------------------------------------------
// The parity corpus battery.
// ---------------------------------------------------------------------------

describe('W056 runtime W016 parity — the contract mirrors track the canonical grammars', () => {
  corpus('camera-state', PortableCameraStateSchema, CameraStateSchema, [
    ...validCameraStates,
    ...invalidCameras,
  ]);
  corpus('orbit-camera', PortableOrbitCameraSchema, OrbitCameraSchema, [
    ...validOrbitCameras,
    ...invalidCameras,
  ]);
  corpus('free-camera', PortableFreeCameraSchema, FreeCameraSchema, [
    ...validFreeCameras,
    ...invalidCameras,
  ]);
  corpus('follow-agent-camera', PortableFollowAgentCameraSchema, FollowAgentCameraSchema, [
    ...validFollowCameras,
    ...invalidCameras,
  ]);
  corpus('follow-cursor-state', PortableFollowCursorStateSchema, FollowCursorStateSchema, [
    ...validCursors,
    ...invalidCursors,
  ]);
  corpus('timeline-position', PortableTimelinePositionSchema, SceneTimelinePositionSchema, [
    ...validTimelinePositions,
    ...invalidTimelinePositions,
  ]);
  corpus('world-scene-id', WorldSceneIdMirrorSchema, WorldSceneIdSchema, [
    ...validSceneIds,
    ...invalidSceneIds,
  ]);
  corpus('world-entity-id', WorldEntityIdMirrorSchema, WorldEntityIdSchema, [
    ...validEntityIds,
    ...invalidEntityIds,
  ]);
});
