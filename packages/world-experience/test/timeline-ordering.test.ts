// The W062 / ACR-008 comparator regression (additive): the scene-timeline
// marker ordering is NUMERIC on `atMs` with the lexicographic `markerId`
// tie-break — the ALREADY-SPECIFIED intent the W016 defect violated by
// comparing `${atMs}\u0000${markerId}` string keys (mixed-digit-width times
// mis-sorted lexicographically). These tests pin the restored ordering at
// the schema seam itself; the flipped journey-level record lives in
// qa/world-experience/w016-marker-time-known-issue.test.ts.
import { describe, expect, it } from 'vitest';
import { SceneTimelineSchema, type SceneTimelineMarker } from '../src/timeline';

/** A minimal, otherwise-valid timeline carrying the marker set under test. */
function timelineWithMarkers(markers: readonly SceneTimelineMarker[]) {
  return {
    markers: [...markers],
    trackLabel: 'Comparator regression track',
    trackStartMs: 0,
    trackEndMs: 20_000,
    position: { atMs: 0, frameIndex: 0, paused: false },
  };
}

/** The canonical ordering issue of a refused parse, or undefined. */
function orderingIssueOf<I extends { readonly message: string }>(failure: {
  readonly issues: readonly I[];
}): I | undefined {
  return failure.issues.find((issue) =>
    issue.message.includes('markers must be sorted by (atMs, markerId) ascending'),
  );
}

describe('scene timeline marker ordering (the W062 numeric comparator)', () => {
  it('admits a numerically ascending mixed-digit-width timeline (500 -> 5000 -> 12000)', () => {
    // The honest author's chain: 3-, 4-, and 5-digit times in ascending
    // numeric order. The old lexicographic comparator refused this
    // ("5000\0…" > "12000\0…" because "5" > "1").
    const parsed = SceneTimelineSchema.safeParse(
      timelineWithMarkers([
        { markerId: 'mrk-zero', atMs: 500, markerKind: 'event' },
        { markerId: 'mrk-first', atMs: 5_000, markerKind: 'event' },
        { markerId: 'mrk-second', atMs: 12_000, markerKind: 'event' },
      ]),
    );
    expect(parsed.success).toBe(true);
  });

  it('refuses a numerically descending mixed-digit-width timeline (12000 then 5000) with the ordering issue', () => {
    // The mirrored symptom of the old comparator: a scene whose markers
    // run DOWNHILL in virtual time passed admission and computed the wrong
    // timeline end. The numeric comparator refuses it.
    const parsed = SceneTimelineSchema.safeParse(
      timelineWithMarkers([
        { markerId: 'mrk-alpha', atMs: 12_000, markerKind: 'event' },
        { markerId: 'mrk-beta', atMs: 5_000, markerKind: 'event' },
      ]),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const orderingIssue = orderingIssueOf(parsed.error);
    expect(orderingIssue).toBeDefined();
    expect(orderingIssue?.path).toEqual(['markers']);
  });

  it('refuses a duplicate (atMs, markerId) pair — strictly ascending pairs, unchanged', () => {
    // Duplicate-free semantics are unchanged by the fix: an EQUAL pair is
    // a duplicate and still refused with the same canonical issue.
    const parsed = SceneTimelineSchema.safeParse(
      timelineWithMarkers([
        { markerId: 'mrk-same', atMs: 5_000, markerKind: 'event' },
        { markerId: 'mrk-same', atMs: 5_000, markerKind: 'event' },
      ]),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(orderingIssueOf(parsed.error)).toBeDefined();
  });

  it('tie-breaks equal atMs on markerId lexicographically: ascending admits, descending refuses', () => {
    const ascending = SceneTimelineSchema.safeParse(
      timelineWithMarkers([
        { markerId: 'mrk-a', atMs: 7_000, markerKind: 'event' },
        { markerId: 'mrk-b', atMs: 7_000, markerKind: 'event' },
      ]),
    );
    expect(ascending.success).toBe(true);

    const descending = SceneTimelineSchema.safeParse(
      timelineWithMarkers([
        { markerId: 'mrk-b', atMs: 7_000, markerKind: 'event' },
        { markerId: 'mrk-a', atMs: 7_000, markerKind: 'event' },
      ]),
    );
    expect(descending.success).toBe(false);
    if (descending.success) return;
    expect(orderingIssueOf(descending.error)).toBeDefined();
  });

  it('the control: same-digit-width marker times (5000 then 9000) admit — identical under both orderings', () => {
    // The documented authoring workaround every fixture relies on:
    // equal-width times sort identically lexicographically and
    // numerically, so the fix changes nothing for them.
    const parsed = SceneTimelineSchema.safeParse(
      timelineWithMarkers([
        { markerId: 'mrk-first', atMs: 5_000, markerKind: 'event' },
        { markerId: 'mrk-second', atMs: 9_000, markerKind: 'event' },
      ]),
    );
    expect(parsed.success).toBe(true);
  });
});
