// Deterministic serialization: identical inputs serialize identically
// (sorted iteration, canonical JSON), key-order permutations of the same
// content produce identical digests, and the emission of the published
// contract artifacts is deterministic. The negative halves (unsorted
// arrays rejected) live in graph.negative.test.ts.
import { describe, expect, it } from 'vitest';
import {
  canonicalDigest,
  canonicalJsonStringify,
  sha256Hex,
} from '@epoch/agent-protocol';
import {
  computeExperienceGraphDigest,
  parseExperienceGraph,
  renderExperienceContractFiles,
  sealExperienceGraph,
  serializeExperienceGraph,
  serializeProjectionRequest,
} from '../src/index';
import { graphContent, projectionRequest, sealedGraph } from './fixtures';
import type { ExperienceGraph, JsonValue } from '../src/index';

/** Recursively shuffles object key order (deterministic permutation). */
function permuteKeys(value: JsonValue, flip: boolean): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => permuteKeys(item, !flip));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => [k, permuteKeys(v, !flip)] as const);
    const ordered = flip ? [...entries].reverse() : entries;
    return Object.fromEntries(ordered);
  }
  return value;
}

describe('deterministic serialization (positive)', () => {
  it('identical content serializes identically across sealings', () => {
    for (const kind of ['2d', '3d', 'animation', 'narrative', 'timeline-replay', 'presence', 'controls'] as const) {
      const first = sealedGraph(kind);
      const second = sealedGraph(kind);
      expect(serializeExperienceGraph(first)).toBe(serializeExperienceGraph(second));
      expect(first.digest).toBe(second.digest);
    }
  });

  it('key-order permutations produce identical canonical forms and digests', () => {
    const content = graphContent('timeline-replay');
    const permuted = permuteKeys(JSON.parse(JSON.stringify(content)) as JsonValue, true);
    const direct = sealExperienceGraph(content);
    const shuffled = sealExperienceGraph(permuted);
    expect(direct.ok).toBe(true);
    expect(shuffled.ok).toBe(true);
    if (direct.ok && shuffled.ok) {
      expect(serializeExperienceGraph(direct.value)).toBe(
        serializeExperienceGraph(shuffled.value),
      );
      expect(direct.value.digest).toBe(shuffled.value.digest);
    }
  });

  it('the parsed value of a serialization re-serializes to the same bytes', () => {
    const graph = sealedGraph('3d');
    const once = serializeExperienceGraph(graph);
    const parsed = parseExperienceGraph(JSON.parse(once));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(serializeExperienceGraph(parsed.value)).toBe(once);
    }
  });

  it('projection requests serialize deterministically under key permutation', () => {
    const request = projectionRequest('controls');
    const permuted = permuteKeys(JSON.parse(JSON.stringify(request)) as JsonValue, true);
    expect(serializeProjectionRequest(request)).toBe(
      serializeProjectionRequest(permuted as unknown as typeof request),
    );
  });

  it('content digests are the canonical SHA-256 (agent-protocol machinery reused)', () => {
    const content = graphContent('presence');
    const expected = canonicalDigest(JSON.parse(JSON.stringify(content)) as JsonValue);
    expect(computeExperienceGraphDigest(content)).toBe(expected);
    expect(computeExperienceGraphDigest(content)).toMatch(/^[0-9a-f]{64}$/);
    // The digest is over the CONTENT (digest field excluded): strip it from
    // the sealed envelope and the canonical SHA-256 of the remainder matches.
    const envelope = sealedGraph('presence');
    const { digest: claimed, ...contentView } = envelope;
    expect(sha256Hex(canonicalJsonStringify(contentView as unknown as JsonValue))).toBe(claimed);
  });

  it('the canonical form is sorted-key JSON (spot check)', () => {
    const graph = sealedGraph('2d') as ExperienceGraph;
    const serialized = serializeExperienceGraph(graph);
    // The canonical form starts with the alphabetically-first key.
    expect(serialized.startsWith('{"device":')).toBe(true);
    // And canonicalJsonStringify of the parsed value is stable.
    expect(canonicalJsonStringify(JSON.parse(serialized) as JsonValue)).toBe(serialized);
  });

  it('contract emission is deterministic (two renders are byte-identical)', () => {
    expect(renderExperienceContractFiles()).toEqual(renderExperienceContractFiles());
  });
});
