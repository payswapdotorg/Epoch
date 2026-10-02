// THE KNOWN-ISSUE RECORD (W061) — the precise repro of the W057-discovered
// W016 marker-time ordering defect, pinned against the REAL W016 admission
// surface (`admitWorldScene` of @epoch/world-experience — the exact entry
// point every scene producer, including the harness fixture and the web /
// desktop world hosts, goes through).
//
// THE DEFECT (ledgered P2, advisory-only for W061): the scene-timeline
// refinement in packages/world-experience/src/timeline.ts compares
// `${atMs}\u0000${markerId}` as STRINGS (lexicographic), so marker times of
// MIXED DIGIT WIDTH mis-sort:
//   - a numerically ASCENDING timeline (5000 then 12000) is REFUSED
//     ("markers must be sorted by (atMs, markerId) ascending") because
//     "5000\0…" > "12000\0…" lexicographically — the honest scene author
//     is rejected;
//   - the mirrored symptom: a numerically DESCENDING timeline (12000 then
//     5000) is ADMITTED (because "12000\0…" < "5000\0…" lexicographically),
//     and the admitted scene then computes a WRONG timeline end bound (the
//     last marker's 5000 instead of the 12000 marker), rejecting in-bounds
//     replay positions.
//
// THE DISCIPLINE CHAIN (observe -> record -> reproduce): observed during the
// W057 journey bring-up; recorded in docs/journeys/interactive-world.md
// (defect ledger) + the harness README advisory; REPRODUCED HERE against the
// real W016 surface. The remaining links (fix -> rerun -> close) belong to
// the W016 package owner (packages/world-experience is NOT a W061 surface —
// frozen to this Work Order): the suggested fix is a numeric-aware
// comparator (compare atMs numerically, tie-break on markerId).
//
// This battery deliberately PINS THE CURRENT (defective) behavior so it is
// green while the defect stands: when the W016 comparator is fixed in a
// future ACR, the "refused" and "wrong end bound" assertions below FLIP and
// force the ledger update — the defect can never silently drift. The
// harness fixture keeps working either way (it uses same-digit-width marker
// times, the documented authoring workaround).
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

describe('KNOWN ISSUE (W016 P2, ledgered) — mixed-width marker times compare lexicographically', () => {
  it('reproduces the refusal: a NUMERICALLY ASCENDING mixed-width timeline (5000 then 12000) fails the real W016 admission', () => {
    // The honest author's scene: markers in ascending (atMs, markerId) order
    // — 5000 < 12000 numerically. The lexicographic comparator
    // ("5000\0mrk-first" > "12000\0mrk-second", because "5" > "1") rejects
    // it with the canonical-ordering malformed-record issue.
    const admitted = admitWorldScene(
      sceneWithMarkers([
        { markerId: 'mrk-first', atMs: 5_000, markerKind: 'event' },
        { markerId: 'mrk-second', atMs: 12_000, markerKind: 'event' },
      ]),
      { expectedTenantId: TENANT },
    );
    expect(admitted.ok).toBe(false);
    if (admitted.ok || admitted.error.code !== 'malformed-record') {
      throw new Error('the repro must fail admission under the current comparator');
    }
    const orderingIssue = admitted.error.issues.find((issue) =>
      issue.message.includes('markers must be sorted by (atMs, markerId) ascending'),
    );
    expect(orderingIssue).toBeDefined();
    expect(orderingIssue?.path).toBe('timeline.markers');
  });

  it('reproduces the mirror: a NUMERICALLY DESCENDING mixed-width timeline (12000 then 5000) is ADMITTED and computes a WRONG timeline end', () => {
    // The mirrored symptom of the same comparator: "12000\0mrk-alpha" <
    // "5000\0mrk-beta" lexicographically, so a scene whose markers run
    // DOWNHILL in virtual time passes admission.
    const admitted = admitWorldScene(
      sceneWithMarkers([
        { markerId: 'mrk-alpha', atMs: 12_000, markerKind: 'event' },
        { markerId: 'mrk-beta', atMs: 5_000, markerKind: 'event' },
      ]),
      { expectedTenantId: TENANT },
    );
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) {
      throw new Error(`the mirrored scene must admit under the current comparator: ${admitted.error.message}`);
    }
    // The admitted timeline is numerically descending — the defect made
    // deterministic: the accepted order is the LEXICOGRAPHIC one.
    expect(admitted.value.timeline.markers.map((marker) => marker.atMs)).toEqual([12_000, 5_000]);
    // The wrong end bound: timelineEndMs takes the LAST marker's time (the
    // 5000ms marker), not the track's actual latest event (12000ms).
    expect(timelineEndMs(admitted.value.timeline)).toBe(5_000);
    // The typed consequence: an in-bounds replay position (8000ms — inside
    // the track, below the admitted 12000ms marker) is rejected as
    // out-of-bounds by the replay gate.
    const position = validateTimelinePosition(admitted.value.timeline, {
      atMs: 8_000,
      frameIndex: 1,
      paused: false,
    });
    expect(position.ok).toBe(false);
    if (position.ok) {
      throw new Error('the wrong end bound must reject the in-track position');
    }
    expect(position.error.code).toBe('invalid-replay-position');
  });

  it('the control: same-digit-width marker times (5000 then 9000) admit cleanly — the trigger is exactly the mixed digit width', () => {
    // The documented authoring workaround the harness fixture relies on:
    // equal-width times sort identically lexicographically and numerically.
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
