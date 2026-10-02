/**
 * COMPILE-TIME W016 PARITY (W056) — the contract's mirrored W016 grammars
 * are pinned member-for-member against their canonical home
 * (@epoch/world-experience), WITHOUT adding any new dependency edge: the
 * fabric already depends on both packages at runtime, so it is the natural
 * parity host (the W011 kernel-parity pattern, inverted — the consumer
 * pins the mirror, so the contract package keeps its minimal W013 pin).
 *
 * If a W016 grammar changes, this file fails to compile AND the runtime
 * parity corpus (test/parity.test.ts — the mirror and the canonical
 * grammar must accept/reject the same values) fails; the mirror in
 * @epoch/renderer-runtime must then be updated in the same change (and
 * the contract re-emitted) — the W002-W004 drift discipline.
 *
 * This module is type-only and is deliberately NOT re-exported from the
 * package index — importing it into the public surface would be a no-op
 * (types erase), but keeping it unexported documents that it is a
 * compile-time assertion, not an API.
 */
import type { Equals, Expect } from '@epoch/renderer-runtime';
import type {
  CameraState,
  FollowAgentCamera,
  FollowCursorState,
  FreeCamera,
  OrbitCamera,
  SceneTimelinePosition,
  WorldEntityId,
  WorldSceneId,
} from '@epoch/world-experience';
import type {
  PortableCameraState,
  PortableFollowAgentCamera,
  PortableFollowCursorState,
  PortableFreeCamera,
  PortableOrbitCamera,
  PortableTimelinePosition,
  WorldEntityIdMirror,
  WorldSceneIdMirror,
} from '@epoch/renderer-runtime';

/** The portable camera state IS the W016 camera state shape. */
export type PortableCameraStateParity = Expect<
  Equals<PortableCameraState, CameraState>
>;

/** The portable follow-agent camera IS the W016 follow-agent camera shape. */
export type PortableFollowAgentCameraParity = Expect<
  Equals<PortableFollowAgentCamera, FollowAgentCamera>
>;

/** The portable free camera IS the W016 free camera shape. */
export type PortableFreeCameraParity = Expect<Equals<PortableFreeCamera, FreeCamera>>;

/** The portable orbit camera IS the W016 orbit camera shape. */
export type PortableOrbitCameraParity = Expect<Equals<PortableOrbitCamera, OrbitCamera>>;

/** The portable follow-cursor state IS the W016 follow-cursor state shape. */
export type PortableFollowCursorStateParity = Expect<
  Equals<PortableFollowCursorState, FollowCursorState>
>;

/** The portable timeline position IS the W016 scene timeline position shape. */
export type PortableTimelinePositionParity = Expect<
  Equals<PortableTimelinePosition, SceneTimelinePosition>
>;

/** The mirrored world scene id grammar IS the W016 WorldSceneId grammar. */
export type WorldSceneIdParity = Expect<Equals<WorldSceneIdMirror, WorldSceneId>>;

/** The mirrored world entity id grammar IS the W016 WorldEntityId grammar. */
export type WorldEntityIdParity = Expect<Equals<WorldEntityIdMirror, WorldEntityId>>;
