// Determinism + provider-neutrality battery: byte-identical ladders,
// canonical ordering, and zero vendor/engine vocabulary.
import { describe, expect, it } from 'vitest';
import {
  deriveProgressiveLadder,
  fitGraphToLimits,
  rungGraphAt,
  REDUCTION_STAGE_KINDS,
  PROGRESSIVE_SCENE_ERROR_CODES,
  CANONICAL_STAGE_ORDER,
  PROXY_PRIMITIVE,
  ProgressiveSceneLadderSchema,
} from '../src/index';
import { richAnimationGraph, minimalGraph, limitsOf } from './fixtures';

describe('determinism', () => {
  it('the same graph + ladder id yields byte-identical ladders', () => {
    const graph = richAnimationGraph();
    const first = deriveProgressiveLadder({ ladderId: 'psl-det', graph });
    const second = deriveProgressiveLadder({ ladderId: 'psl-det', graph });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
    }
  });

  it('a different ladder id yields a different content digest', () => {
    const graph = richAnimationGraph();
    const first = deriveProgressiveLadder({ ladderId: 'psl-det-a', graph });
    const second = deriveProgressiveLadder({ ladderId: 'psl-det-b', graph });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.digest).not.toBe(second.value.digest);
    }
  });

  it('rung re-derivation reproduces byte-identical rung graphs', () => {
    const graph = richAnimationGraph();
    const derived = deriveProgressiveLadder({ ladderId: 'psl-rederive', graph });
    if (!derived.ok) throw new Error('fixture failed');
    for (const rung of derived.value.rungs) {
      const first = rungGraphAt({ ladderId: 'psl-rederive', graph }, rung.rungIndex);
      const second = rungGraphAt({ ladderId: 'psl-rederive', graph }, rung.rungIndex);
      expect(first.ok && second.ok).toBe(true);
      if (first.ok && second.ok) {
        expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
      }
    }
  });

  it('input key order does not change the ladder digest', () => {
    const graph = richAnimationGraph();
    const reordered = {
      device: graph.device,
      edges: graph.edges,
      nodes: graph.nodes,
      projectedFrom: graph.projectedFrom,
      tenantScope: graph.tenantScope,
      graphKind: graph.graphKind,
      graphId: graph.graphId,
      protocolVersion: graph.protocolVersion,
      schema: graph.schema,
      digest: graph.digest,
    };
    const first = deriveProgressiveLadder({ ladderId: 'psl-order', graph });
    const second = deriveProgressiveLadder({ ladderId: 'psl-order', graph: reordered });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.digest).toBe(second.value.digest);
    }
  });

  it('fitting is deterministic across repeated calls', () => {
    const graph = richAnimationGraph();
    const limits = limitsOf({ maxGraphNodes: 3, maxTextureBytes: 1_048_576 });
    const first = fitGraphToLimits({ ladderId: 'psl-fit-det', graph, limits });
    const second = fitGraphToLimits({ ladderId: 'psl-fit-det', graph, limits });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
    }
  });
});

describe('provider neutrality (lock rule 13)', () => {
  const VENDOR_WORDS = [
    'webgl',
    'webgpu',
    'opengl',
    'vulkan',
    'directx',
    'metal',
    'three',
    'babylon',
    'cesium',
    'unity',
    'unreal',
    'godot',
    'react',
    'nvidia',
    'apple',
    'android',
    'ios',
    'chrome',
  ];

  it('the closed vocabularies carry no vendor/engine words', () => {
    for (const vocabulary of [REDUCTION_STAGE_KINDS, PROGRESSIVE_SCENE_ERROR_CODES]) {
      const joined = vocabulary.join(',').toLowerCase();
      for (const word of VENDOR_WORDS) {
        expect(joined, `vocabulary must not contain "${word}"`).not.toContain(word);
      }
    }
  });

  it('the stage vocabulary is sorted and duplicate-free', () => {
    expect([...REDUCTION_STAGE_KINDS]).toEqual([...REDUCTION_STAGE_KINDS].sort());
    expect(new Set(REDUCTION_STAGE_KINDS).size).toBe(REDUCTION_STAGE_KINDS.length);
  });

  it('the canonical stage order covers every stage exactly once', () => {
    expect([...CANONICAL_STAGE_ORDER].sort()).toEqual([...REDUCTION_STAGE_KINDS].sort());
    expect(new Set(CANONICAL_STAGE_ORDER).size).toBe(CANONICAL_STAGE_ORDER.length);
  });

  it('a ladder record with a vendor field fails strict admission', () => {
    const derived = deriveProgressiveLadder({ ladderId: 'psl-strict', graph: minimalGraph() });
    if (!derived.ok) throw new Error('fixture failed');
    const vendored = { ...derived.value, engine: 'some-engine' };
    expect(ProgressiveSceneLadderSchema.safeParse(vendored).success).toBe(false);
  });

  it('the proxy primitive is a neutral geometric primitive, never an engine mesh', () => {
    expect(PROXY_PRIMITIVE).toBe('box');
  });
});
