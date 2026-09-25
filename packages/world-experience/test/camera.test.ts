// Camera/follow semantics: explicit transitions, follow-agent cursor
// updates, and zoom steps (typed data, pure functions).
import { describe, expect, it } from 'vitest';
import {
  transitionCamera,
  updateFollowCursor,
  zoomCamera,
  type CameraState,
} from '../src/camera';
import { AGENT_REF, expectFailure } from './fixtures';

const orbit: CameraState = {
  mode: 'orbit',
  position: [30, 20, 30],
  orientation: [0, 0, 0, 1],
  target: [0, 0, 10],
  fovRadians: 1.2,
};

describe('camera transitions', () => {
  it('transitions orbit -> follow-agent with an explicit cut transition record', () => {
    const result = transitionCamera(orbit, {
      target: { mode: 'follow-agent', agentRef: AGENT_REF, followDistance: 12 },
      transitionKind: 'cut',
      atMs: 500,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.camera.mode).toBe('follow-agent');
    expect(result.value.transition).toEqual({
      transitionKind: 'cut',
      fromMode: 'orbit',
      toMode: 'follow-agent',
      atMs: 500,
    });
  });

  it('a smooth transition requires durationMs (typed rejection otherwise)', () => {
    const result = transitionCamera(orbit, {
      target: { mode: 'free', position: [1, 2, 3] },
      transitionKind: 'smooth',
      atMs: 0,
    });
    expectFailure(result, 'malformed-record');
  });

  it('a cut transition cannot carry durationMs (typed rejection)', () => {
    const result = transitionCamera(orbit, {
      target: { mode: 'free', position: [1, 2, 3] },
      transitionKind: 'cut',
      atMs: 0,
      durationMs: 250,
    });
    expectFailure(result, 'malformed-record');
  });

  it('the source camera is never mutated (pure transition)', () => {
    const before = JSON.stringify(orbit);
    transitionCamera(orbit, {
      target: { mode: 'free', position: [9, 9, 9] },
      transitionKind: 'cut',
      atMs: 0,
    });
    expect(JSON.stringify(orbit)).toBe(before);
  });

  it('schema-invalid targets are typed malformed-record rejections', () => {
    const result = transitionCamera(orbit, {
      target: { mode: 'orbit' } as unknown as CameraState,
      transitionKind: 'cut',
      atMs: 0,
    });
    expectFailure(result, 'malformed-record');
  });
});

describe('follow-agent cursor state', () => {
  const follow: CameraState = {
    mode: 'follow-agent',
    agentRef: AGENT_REF,
    followDistance: 8,
    cursor: { position3d: [1, 2, 3], atMs: 100 },
  };

  it('updates the cursor of a follow-agent camera (new record)', () => {
    const result = updateFollowCursor(follow, { position2d: { x: 4, y: 5 }, atMs: 200 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mode).toBe('follow-agent');
    if (result.value.mode !== 'follow-agent') return;
    expect(result.value.cursor).toEqual({ position2d: { x: 4, y: 5 }, atMs: 200 });
    // The source cursor is untouched.
    if (follow.mode !== 'follow-agent') throw new Error('expected follow-agent');
    expect(follow.cursor).toEqual({ position3d: [1, 2, 3], atMs: 100 });
  });

  it('cursor updates on a non-follow camera are typed rejections', () => {
    const result = updateFollowCursor(orbit, { position3d: [1, 2, 3] });
    expectFailure(result, 'malformed-record');
  });

  it('a cursor with neither position is malformed', () => {
    const result = updateFollowCursor(follow, { atMs: 300 });
    expectFailure(result, 'malformed-record');
  });
});

describe('camera zoom', () => {
  it('zooms an orbit camera by moving its position toward/away from the anchor', () => {
    const zoomed = zoomCamera(orbit, { factor: 0.5 });
    expect(zoomed.mode).toBe('orbit');
    if (zoomed.mode !== 'orbit') return;
    expect(zoomed.position).toEqual([15, 10, 20]);
    expect(zoomed.target).toEqual([0, 0, 10]);
  });

  it('an orbit camera without an anchor is unchanged', () => {
    const free: CameraState = { mode: 'free', position: [1, 2, 3] };
    expect(zoomCamera(free, { factor: 2 })).toEqual(free);
  });

  it('zooms a follow-agent camera by scaling its follow distance', () => {
    const follow: CameraState = {
      mode: 'follow-agent',
      agentRef: AGENT_REF,
      followDistance: 8,
      cursor: { position3d: [1, 2, 3] },
    };
    const zoomed = zoomCamera(follow, { factor: 2 });
    if (zoomed.mode !== 'follow-agent') throw new Error('expected follow-agent');
    expect(zoomed.followDistance).toBe(16);
    // The agent's cursor is the AGENT's state — never rescaled by zoom.
    if (follow.mode !== 'follow-agent') throw new Error('expected follow-agent');
    if (follow.cursor === undefined) throw new Error('expected cursor');
    expect(follow.cursor.position3d).toEqual([1, 2, 3]);
  });

  it('a follow-agent camera without a follow distance is unchanged', () => {
    const follow: CameraState = { mode: 'follow-agent', agentRef: AGENT_REF };
    expect(zoomCamera(follow, { factor: 2 })).toEqual(follow);
  });
});
