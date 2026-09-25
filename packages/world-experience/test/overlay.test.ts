// Overlay application + ordering determinism: library validation, applied
// order canonicalization, unknown-overlay rejections, and usage.
import { describe, expect, it } from 'vitest';
import {
  applyOverlayTo,
  computeOverlayUsage,
  removeOverlayFrom,
  validateOverlayState,
} from '../src/overlay';
import { expectFailure, sceneContent } from './fixtures';

const library = () => sceneContent().overlays;
const applied = () => sceneContent().appliedOverlays;

describe('visual overlays', () => {
  it('the fixture overlay library + applied list validates', () => {
    const result = validateOverlayState(library(), applied());
    expect(result.ok).toBe(true);
  });

  it('an unsorted applied list is rejected (deterministic application order)', () => {
    const unsorted = [
      { overlayId: 'ovl-measure-span', orderIndex: 1 },
      { overlayId: 'ovl-highlight-north', orderIndex: 0 },
    ];
    expectFailure(validateOverlayState(library(), unsorted), 'malformed-record');
  });

  it('duplicate application of one overlay is rejected', () => {
    const duplicated = [
      { overlayId: 'ovl-highlight-north', orderIndex: 0 },
      { overlayId: 'ovl-highlight-north', orderIndex: 1 },
    ];
    expectFailure(validateOverlayState(library(), duplicated), 'malformed-record');
  });

  it('applying an unknown overlay is a typed unknown-overlay-reference rejection', () => {
    const failure = expectFailure(
      applyOverlayTo(library(), applied(), 'ovl-not-declared'),
      'unknown-overlay-reference',
    );
    expect(failure.overlayId).toBe('ovl-not-declared');
  });

  it('applying a declared overlay appends at the next order index', () => {
    const next = applyOverlayTo(library(), applied(), 'ovl-state-damaged');
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.value).toHaveLength(3);
    expect(next.value[2]).toEqual({ overlayId: 'ovl-state-damaged', orderIndex: 2 });
  });

  it('re-applying an applied overlay is idempotent (no duplicate, no reorder)', () => {
    const next = applyOverlayTo(library(), applied(), 'ovl-highlight-north');
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.value).toEqual(applied());
  });

  it('removing an unknown overlay is a typed rejection (removing undeclared content is a contract violation)', () => {
    expectFailure(removeOverlayFrom(library(), applied(), 'ovl-not-declared'), 'unknown-overlay-reference');
  });

  it('removing an applied overlay preserves the remaining order indices', () => {
    const next = removeOverlayFrom(library(), applied(), 'ovl-highlight-north');
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.value).toEqual([{ overlayId: 'ovl-measure-span', orderIndex: 1 }]);
  });

  it('computes the overlay usage record from the library + applied list', () => {
    const usage = computeOverlayUsage(library(), applied());
    expect(usage).toEqual({
      appliedCount: 2,
      highlightCount: 1,
      annotationCount: 0,
      measurementCount: 1,
      stateCount: 0,
    });
  });

  it('overlay application is deterministic across repeated runs', () => {
    const first = applyOverlayTo(library(), applied(), 'ovl-state-damaged');
    const second = applyOverlayTo(library(), applied(), 'ovl-state-damaged');
    expect(first).toEqual(second);
  });
});
