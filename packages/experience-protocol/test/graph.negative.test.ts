// Negative battery (schema, version, digest, resolvability): every
// malformed shape, version skew, tampered digest, and unresolvable
// reference is rejected with the precise typed error and a precise path.
// These are FIRST-CLASS negatives of the Work Order acceptance.
import { describe, expect, it } from 'vitest';
import {
  parseExperienceGraph,
  parseProjectionRequest,
  sealExperienceGraph,
  type ExperienceGraph,
  type ProjectedReference,
} from '../src/index';
import {
  expectFailure,
  graphContent,
  projectionRequest,
  sealedGraph,
} from './fixtures';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('version gate (negative)', () => {
  it('rejects a graph with a future protocol version as version-unsupported', () => {
    const graph = clone(sealedGraph('2d')) as unknown as Record<string, unknown>;
    graph.protocolVersion = '2.0.0';
    const error = expectFailure(parseExperienceGraph(graph), 'version-unsupported');
    expect(error).toMatchObject({ expected: '1.0.0', encountered: '2.0.0' });
  });

  it('rejects a request with a different protocol version as version-unsupported', () => {
    const request = clone(projectionRequest('2d')) as Record<string, unknown>;
    request.protocolVersion = '0.9.0';
    expectFailure(parseProjectionRequest(request), 'version-unsupported');
  });

  it('version skew beats schema violations (fixed precedence)', () => {
    const graph = clone(sealedGraph('2d')) as unknown as Record<string, unknown>;
    graph.protocolVersion = '9.9.9';
    graph.graphKind = 'not-a-kind'; // would be a schema violation
    expectFailure(parseExperienceGraph(graph), 'version-unsupported');
  });

  it('a non-object root is a malformed-descriptor, never a throw', () => {
    for (const input of [null, 42, 'graph', true, [1, 2, 3]]) {
      expectFailure(parseExperienceGraph(input), 'malformed-descriptor');
    }
  });
});

describe('schema gate (negative — malformed descriptors)', () => {
  it('rejects an unknown node field (vendor/engine smuggling) with a precise path', () => {
    const content = graphContent('2d');
    (content.nodes[1] as unknown as Record<string, unknown>).renderer = 'three';
    const error = expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
    expect(error.issues[0]?.path).toBe('nodes.1.renderer');
  });

  it('rejects an unknown envelope field with a precise path', () => {
    const graph = clone(sealedGraph('narrative')) as ExperienceGraph & {
      semanticAuthority?: string;
    };
    graph.semanticAuthority = 'experience-runtime';
    const error = expectFailure(parseExperienceGraph(graph), 'malformed-descriptor');
    expect(error.issues.some((issue) => issue.path.includes('semanticAuthority'))).toBe(true);
  });

  it('rejects an invalid graph-kind discriminator', () => {
    const content = graphContent('2d') as unknown as Record<string, unknown>;
    content.graphKind = 'hologram';
    expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
  });

  it('rejects a node kind that is illegal for the graph kind (vocabulary pin)', () => {
    const content = graphContent('2d');
    // A narrative beat inside a 2d graph is foreign vocabulary.
    content.nodes = [
      {
        id: 'xn-beat-1',
        kind: 'narrative-beat',
        descriptor: { title: 'Out of place' },
      },
    ];
    content.edges = [];
    const error = expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
    expect(error.issues.some((i) => i.path === 'nodes.0.kind')).toBe(true);
  });

  it('rejects a bad node-id grammar', () => {
    const content = graphContent('controls');
    (content.nodes[0] as unknown as Record<string, unknown>).id = 'Node One!';
    expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
  });

  it('rejects a malformed content digest on a reference', () => {
    const content = graphContent('2d');
    (content.projectedFrom[0] as unknown as Record<string, unknown>).contentDigest =
      'not-a-digest';
    expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
  });

  it('rejects an invalid color hex', () => {
    const content = graphContent('2d');
    const shape = content.nodes[1];
    if (shape.kind !== 'shape-2d') throw new Error('fixture shape');
    shape.descriptor.fill = { color: '#FF0000' }; // uppercase is non-canonical
    expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
  });

  it('rejects a mesh primitive without a mesh binding', () => {
    const content = graphContent('3d');
    const meshNode = content.nodes[0];
    if (meshNode.kind !== 'spatial-3d') throw new Error('fixture mesh');
    delete (meshNode.descriptor as { mesh?: unknown }).mesh;
    const error = expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
    expect(error.issues.some((i) => i.path === 'nodes.0.descriptor.mesh')).toBe(true);
  });

  it('rejects a mesh binding on a non-mesh primitive', () => {
    const content = graphContent('3d');
    const box = content.nodes[1];
    if (box.kind !== 'spatial-3d') throw new Error('fixture box');
    box.descriptor.mesh = { assetDigest: 'b'.repeat(64) };
    expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
  });

  it('rejects non-finite numbers in spatial data', () => {
    const content = graphContent('3d');
    const box = content.nodes[1];
    if (box.kind !== 'spatial-3d') throw new Error('fixture box');
    box.descriptor.position = [Number.NaN, 0, 0];
    expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
  });

  it('rejects a selector control without options and options on a button', () => {
    const noOptions = graphContent('controls');
    const selector = noOptions.nodes[1];
    if (selector.kind !== 'control') throw new Error('fixture selector');
    delete (selector.descriptor as { options?: unknown }).options;
    expectFailure(sealExperienceGraph(noOptions), 'malformed-descriptor');

    const withOptions = graphContent('controls');
    const button = withOptions.nodes[0];
    if (button.kind !== 'control') throw new Error('fixture button');
    button.descriptor.options = ['a', 'b'];
    expectFailure(sealExperienceGraph(withOptions), 'malformed-descriptor');
  });

  it('rejects unsorted selector options (deterministic set semantics)', () => {
    const content = graphContent('controls');
    const selector = content.nodes[1];
    if (selector.kind !== 'control') throw new Error('fixture selector');
    selector.descriptor.options = ['top-down', 'isometric'];
    const error = expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
    expect(error.issues.some((i) => i.path === 'nodes.1.descriptor.options')).toBe(true);
  });

  it('rejects a presence cursor with no position at all', () => {
    const content = graphContent('presence');
    const cursor = content.nodes[0];
    if (cursor.kind !== 'presence-cursor') throw new Error('fixture cursor');
    delete (cursor.descriptor as { position2d?: unknown }).position2d;
    expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
  });

  it('rejects a timeline track where endMs <= startMs', () => {
    const content = graphContent('timeline-replay');
    const track = content.nodes[2];
    if (track.kind !== 'timeline-track') throw new Error('fixture track');
    track.descriptor.endMs = 0;
    const error = expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
    expect(error.issues.some((i) => i.path === 'nodes.2.descriptor.endMs')).toBe(true);
  });

  it('rejects keyframes that are not strictly time-ordered', () => {
    const content = graphContent('animation');
    const clip = content.nodes[1];
    if (clip.kind !== 'animation-clip') throw new Error('fixture clip');
    clip.descriptor.tracks[0].keyframes = [
      { atMs: 1000, value: 1 },
      { atMs: 500, value: 2 },
    ];
    expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
  });

  it('rejects a keyframe beyond the clip duration', () => {
    const content = graphContent('animation');
    const clip = content.nodes[1];
    if (clip.kind !== 'animation-clip') throw new Error('fixture clip');
    clip.descriptor.tracks[0].keyframes = [
      { atMs: 0, value: 1 },
      { atMs: 5000, value: 2 },
    ];
    expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
  });

  it('rejects a graph with zero nodes', () => {
    const content = graphContent('2d');
    content.nodes = [];
    content.edges = [];
    expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
  });

  it('rejects a request with zero references', () => {
    const request = projectionRequest('2d', { references: [] });
    expectFailure(parseProjectionRequest(request), 'malformed-descriptor');
  });

  it('rejects an invalid requestedAt timestamp form', () => {
    const request = projectionRequest('2d', { requestedAt: '2026-02-05T12:00:00Z' });
    expectFailure(parseProjectionRequest(request), 'malformed-descriptor');
  });

  it('rejects a replay window where toSequence <= fromSequence', () => {
    const request = projectionRequest('timeline-replay', {
      replayWindow: { fromSequence: 10, toSequence: 10 },
    });
    const error = expectFailure(parseProjectionRequest(request), 'malformed-descriptor');
    expect(error.issues.some((i) => i.path === 'replayWindow.toSequence')).toBe(true);
  });
});

describe('digest gate (negative)', () => {
  it('rejects a tampered digest as digest-mismatch with expected and encountered', () => {
    const graph = clone(sealedGraph('2d')) as ExperienceGraph;
    graph.digest = 'e'.repeat(64);
    const error = expectFailure(parseExperienceGraph(graph), 'digest-mismatch');
    expect(error.expected).toBe((sealedGraph('2d') as ExperienceGraph).digest);
    expect(error.encountered).toBe('e'.repeat(64));
    expect(error.path).toEqual(['digest']);
  });

  it('rejects content edits that invalidate the claimed digest', () => {
    const graph = clone(sealedGraph('2d')) as ExperienceGraph;
    const label = graph.nodes[0];
    if (label.kind !== 'label') throw new Error('fixture label');
    label.descriptor.text = 'Tampered text';
    expectFailure(parseExperienceGraph(graph), 'digest-mismatch');
  });
});

describe('resolvability gate (negative — unknown references)', () => {
  it('rejects a node ref outside the projection inputs as unknown-reference', () => {
    const content = graphContent('2d');
    // Building-9 is not in projectedFrom (which references building-7).
    const forged: ProjectedReference = {
      kind: 'world-entity',
      tenantId: content.tenantScope.tenantId,
      entityId: 'building-9',
      contentDigest: '9'.repeat(64),
    };
    (content.nodes[1] as { ref?: ProjectedReference }).ref = forged;
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const error = expectFailure(parseExperienceGraph(sealed.value), 'unknown-reference');
    expect(error.path).toEqual(['nodes', 1, 'ref']);
    expect(error.reference).toBe('world-entity:building-9');
  });

  it('rejects an edge endpoint that does not exist as unknown-reference', () => {
    const content = graphContent('2d');
    (content.edges[0] as { to: string }).to = 'xn-missing';
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const error = expectFailure(parseExperienceGraph(sealed.value), 'unknown-reference');
    expect(error.path).toEqual(['edges', 0, 'to']);
  });

  it('rejects an animation track targeting a nonexistent node', () => {
    const content = graphContent('animation');
    const clip = content.nodes[1];
    if (clip.kind !== 'animation-clip') throw new Error('fixture clip');
    clip.descriptor.tracks[0].targetNodeId = 'xn-ghost';
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const error = expectFailure(parseExperienceGraph(sealed.value), 'unknown-reference');
    expect(error.path).toEqual(['nodes', 1, 'descriptor', 'tracks', 0, 'targetNodeId']);
  });
});

describe('deterministic ordering (negative — non-determinism is rejected)', () => {
  it('rejects unsorted nodes (non-deterministic serialization)', () => {
    const content = graphContent('2d');
    const nodes = [...content.nodes].reverse();
    content.nodes = nodes;
    const error = expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
    expect(error.issues.some((i) => i.message.includes('sorted by id ascending'))).toBe(true);
  });

  it('rejects duplicate node ids', () => {
    const content = graphContent('2d');
    (content.nodes[1] as { id: string }).id = content.nodes[0].id;
    const error = expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
    expect(error.issues.some((i) => i.message.includes('unique'))).toBe(true);
  });

  it('rejects unsorted edges and duplicate edge triples', () => {
    const content = graphContent('narrative');
    // Two distinct triples in reversed canonical order: (beat-1 → beat-2)
    // sorts before (beat-2 → beat-1), so this order is non-canonical.
    content.edges = [
      { kind: 'follows', from: 'xn-beat-2', to: 'xn-beat-1' },
      { kind: 'follows', from: 'xn-beat-1', to: 'xn-beat-2' },
    ];
    expectFailure(sealExperienceGraph(content), 'malformed-descriptor');

    const content2 = graphContent('narrative');
    content2.edges = [
      { kind: 'follows', from: 'xn-beat-1', to: 'xn-beat-2' },
      { kind: 'follows', from: 'xn-beat-1', to: 'xn-beat-2' },
    ];
    expectFailure(sealExperienceGraph(content2), 'malformed-descriptor');
  });

  it('rejects self-looping edges', () => {
    const content = graphContent('narrative');
    (content.edges[0] as { to: string }).to = 'xn-beat-1';
    const error = expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
    expect(error.issues.some((i) => i.message.includes('loop'))).toBe(true);
  });

  it('rejects unsorted and duplicate projected references', () => {
    const content = graphContent('2d');
    content.projectedFrom = [content.projectedFrom[1], content.projectedFrom[0]];
    expectFailure(sealExperienceGraph(content), 'malformed-descriptor');

    const content2 = graphContent('2d');
    content2.projectedFrom = [content2.projectedFrom[0], content2.projectedFrom[0]];
    expectFailure(sealExperienceGraph(content2), 'malformed-descriptor');
  });

  it('rejects unsorted and duplicate request references', () => {
    const request = projectionRequest('2d');
    const reversed = clone(request);
    reversed.references = [reversed.references[2], ...reversed.references.slice(0, 2)];
    expectFailure(parseProjectionRequest(reversed), 'malformed-descriptor');

    const duplicated = clone(request);
    duplicated.references = [duplicated.references[0], duplicated.references[0]];
    expectFailure(parseProjectionRequest(duplicated), 'malformed-descriptor');
  });
});
