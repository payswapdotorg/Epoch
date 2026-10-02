// THE CLOSED-DEFECT REGRESSION RECORD (W062 / ACR-008) — the same file,
// the same discipline chain, the final links. This battery was born as the
// W061 KNOWN-ISSUE pin against the REAL W016 admission surface
// (`admitWorldScene` of @epoch/world-experience — the exact entry point
// every scene producer, including the harness fixture and the web / desktop
// world hosts, goes through), deliberately green while the defect stood so
// it could never silently drift. W062 flipped it.
//
// THE DEFECT (ledgered P2, CLOSED): the scene-timeline refinement in
// packages/world-experience/src/timeline.ts compared
// `${atMs}\u0000${markerId}` as STRINGS (lexicographic), so marker times of
// MIXED DIGIT WIDTH mis-sorted:
//   - a numerically ASCENDING timeline (5000 then 12000) was REFUSED
//     ("markers must be sorted by (atMs, markerId) ascending") because
//     "5000\0…" > "12000\0…" lexicographically — the honest scene author
//     was rejected;
//   - the mirrored symptom: a numerically DESCENDING timeline (12000 then
//     5000) was ADMITTED, and the admitted scene computed a WRONG timeline
//     end bound (the last marker's 5000 instead of the 12000 marker),
//     rejecting in-bounds replay positions.
//
// THE DISCIPLINE CHAIN (closed): observed (W057 journey bring-up) ->
// recorded (docs/journeys/interactive-world.md defect ledger + the harness
// README advisory) -> reproduced (this file, pinned against the real W016
// surface while the defect stood) -> FIXED (W062 / ACR-008: the comparator
// now compares atMs NUMERICALLY with the lexicographic markerId tie-break
// — the ALREADY-SPECIFIED intent; no semantic change, no contract version
// bump) -> rerun (this battery flipped green against the fixed comparator;
// the focused comparator regression in packages/world-experience/test pins
// the ordering at the schema seam) -> closed (the defect-ledger entry in
// docs/journeys/interactive-world.md carries the fix -> rerun -> close
// evidence). The same-digit-width workaround consumers (the harness
// fixture, the W061 leg battery) are identical under both orderings and
// stay green UNCHANGED.
import { describe, expect, it } from 'vitest';
import {
  admitWorldScene,
  timelineEndMs,
  validateTimelinePosition,
  type SceneTimelineMarker,
  type WorldSceneContent,
} from '../../packages/world-experience/src/index';

const TENANT = 'tenant-marker-time-repro';

/** One deterministic 64-hex content digest (the exact-revision address). */
const DIGEST = '1f'.repeat(32);

/** A minimal, otherwise-VALID scene content carrying the marker set under test. */
function sceneWithMarkers(markers: readonly SceneTimelineMarker[]): WorldSceneContent {
  return {
    schema: 'epoch.world-scene',
    protocolVersion: '1.0.0',
    sceneId: 'wsc-marker-time-repro',
    tenantScope: { tenantId: TENANT },
    name: 'Marker-time ordering repro',
    entities: [
      {
        entityId: 'we-repro-slab',
        contentDigest: DIGEST,
        entityType: 'site:structure',
        representationRecordId: 'ont-rep-slab',
        label: 'Repro slab',
        position: [0, 0, 0],
        visible: true,
        isolated: false,
      },
    ],
    focusedEntityIds: [],
    overlays: [],
    appliedOverlays: [],
    animations: [],
    narrativeBlocks: [],
    timeline: {
      markers: [...markers],
      trackLabel: 'Marker-time repro track',
      trackStartMs: 0,
      trackEndMs: 20_000,
      position: { atMs: 1_000, frameIndex: 0, paused: false },
    },
    camera: { mode: 'orbit', position: [30, 22, 30], target: [4, 3, 0], fovRadians: Math.PI / 4 },
    participants: [],
    agents: [],
    evidenceReferences: [],
    controls: [],
  };
}

describe('CLOSED DEFECT (W016 P2, fixed by W062/ACR-008) — marker times now compare numerically', () => {
  it('the fix: a NUMERICALLY ASCENDING mixed-width timeline (5000 then 12000) ADMITS through the real W016 admission', () => {
    // The honest author's scene — 5000 < 12000 numerically — was rejected
    // by the lexicographic comparator ("5000\0mrk-first" > "12000\0mrk-second"
    // because "5" > "1"). The numeric comparator admits it.
    const admitted = admitWorldScene(
      sceneWithMarkers([
        { markerId: 'mrk-first', atMs: 5_000, markerKind: 'event' },
        { markerId: 'mrk-second', atMs: 12_000, markerKind: 'event' },
      ]),
      { expectedTenantId: TENANT },
    );
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) {
      throw new Error(`the honest mixed-width scene must admit: ${admitted.error.message}`);
    }
    // The admitted order is the submitted (numerically ascending) order.
    expect(admitted.value.timeline.markers.map((marker) => marker.atMs)).toEqual([5_000, 12_000]);
    // The end bound is the LAST marker's time — the track's actual latest
    // event (12000ms), not a lexicographic artifact.
    expect(timelineEndMs(admitted.value.timeline)).toBe(12_000);
    // The in-track 8000ms replay position (below the 12000ms marker)
    // validates against the correct end bound.
    const position = validateTimelinePosition(admitted.value.timeline, {
      atMs: 8_000,
      frameIndex: 1,
      paused: false,
    });
    expect(position.ok).toBe(true);
  });

  it('the mirrored fix: a NUMERICALLY DESCENDING mixed-width timeline (12000 then 5000) is REFUSED with the typed admission error — and the wrong end bound can no longer be admitted', () => {
    // The mirrored symptom of the old comparator: "12000\0mrk-alpha" <
    // "5000\0mrk-beta" lexicographically, so a scene whose markers ran
    // DOWNHILL in virtual time passed admission and then computed the WRONG
    // timeline end (5000, rejecting the in-track 8000ms position). The
    // numeric comparator refuses it with the canonical-ordering
    // malformed-record issue.
    const refused = admitWorldScene(
      sceneWithMarkers([
        { markerId: 'mrk-alpha', atMs: 12_000, markerKind: 'event' },
        { markerId: 'mrk-beta', atMs: 5_000, markerKind: 'event' },
      ]),
      { expectedTenantId: TENANT },
    );
    expect(refused.ok).toBe(false);
    if (refused.ok || refused.error.code !== 'malformed-record') {
      throw new Error('the mirrored scene must fail admission under the numeric comparator');
    }
    const orderingIssue = refused.error.issues.find((issue) =>
      issue.message.includes('markers must be sorted by (atMs, markerId) ascending'),
    );
    expect(orderingIssue).toBeDefined();
    expect(orderingIssue?.path).toBe('timeline.markers');
    // The wrong-end-bound consequence disappears: the ONLY way this marker
    // set enters is the honest ascending authoring, and there the end
    // bound is the track's 12000ms event (never the old lexicographic
    // artifact 5000ms), so the in-track 8000ms position validates.
    const honest = admitWorldScene(
      sceneWithMarkers([
        { markerId: 'mrk-beta', atMs: 5_000, markerKind: 'event' },
        { markerId: 'mrk-alpha', atMs: 12_000, markerKind: 'event' },
      ]),
      { expectedTenantId: TENANT },
    );
    expect(honest.ok).toBe(true);
    if (!honest.ok) {
      throw new Error(`the honest re-authoring must admit: ${honest.error.message}`);
    }
    expect(honest.value.timeline.markers.map((marker) => marker.atMs)).toEqual([5_000, 12_000]);
    expect(timelineEndMs(honest.value.timeline)).toBe(12_000);
    const position = validateTimelinePosition(honest.value.timeline, {
      atMs: 8_000,
      frameIndex: 1,
      paused: false,
    });
    expect(position.ok).toBe(true);
  });

  it('the control: same-digit-width marker times (5000 then 9000) admit cleanly — identical under both orderings', () => {
    // The documented authoring workaround the harness fixture relies on:
    // equal-width times sort identically lexicographically and numerically.
    // It stays green UNCHANGED across the fix.
    const admitted = admitWorldScene(
      sceneWithMarkers([
        { markerId: 'mrk-first', atMs: 5_000, markerKind: 'event' },
        { markerId: 'mrk-second', atMs: 9_000, markerKind: 'event' },
      ]),
      { expectedTenantId: TENANT },
    );
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) {
      throw new Error(`the same-digit-width control must admit: ${admitted.error.message}`);
    }
    expect(timelineEndMs(admitted.value.timeline)).toBe(9_000);
  });
});
