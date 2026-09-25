// The renderer-envelope compiler (negative): budget-exceeded rejections
// (never silent degradation) and unresolvable ontology references.
import { describe, expect, it } from 'vitest';
import { compileWorldScene } from '../src/compile';
import { createWorldScene, emptyWorldSceneStore } from '../src/scene';
import {
  desktopDevice,
  expectFailure,
  referenceOntology,
  sceneContent,
} from './fixtures';

const INVOCATION = {
  invocationId: 'w016-mount-base',
  rendererSessionId: 'rs-world-alpha',
  atMs: 1000,
};

function setup(content = sceneContent()) {
  const created = createWorldScene(emptyWorldSceneStore(), content);
  if (!created.ok) {
    throw new Error(`fixture scene failed: ${created.error.message}`);
  }
  return created.value;
}

describe('budget respect (typed rejections, never silent degradation)', () => {
  it('a graph-node budget violation is rejected with budget-exceeded', () => {
    const { scene } = setup();
    const failure = expectFailure(
      compileWorldScene(scene, {
        ontology: referenceOntology(),
        device: desktopDevice(),
        invocation: INVOCATION,
        budgets: { maxGraphNodes: 1, maxGraphEdges: 100 },
      }),
      'budget-exceeded',
    );
    expect(failure.resource).toBe('graph-nodes');
    expect(failure.limit).toBe(1);
    expect(failure.encountered).toBeGreaterThan(1);
  });

  it('a graph-edge budget violation is rejected with budget-exceeded', () => {
    const content = sceneContent();
    // The timeline graph carries track->marker 'contains' edges.
    const { scene } = setup(content);
    const failure = expectFailure(
      compileWorldScene(scene, {
        ontology: referenceOntology(),
        device: desktopDevice(),
        invocation: INVOCATION,
        budgets: { maxGraphNodes: 100, maxGraphEdges: 0 },
      }),
      'budget-exceeded',
    );
    expect(failure.resource).toBe('graph-edges');
  });

  it('a triangle budget violation is rejected with budget-exceeded (1292 > 10)', () => {
    const { scene } = setup();
    const failure = expectFailure(
      compileWorldScene(scene, {
        ontology: referenceOntology(),
        device: desktopDevice(),
        invocation: INVOCATION,
        budgets: { maxGraphNodes: 100, maxGraphEdges: 100, maxTriangles: 10 },
      }),
      'budget-exceeded',
    );
    expect(failure.resource).toBe('triangles');
    expect(failure.limit).toBe(10);
    expect(failure.encountered).toBe(1292);
  });

  it('a texture-byte budget violation is rejected with budget-exceeded (4096 > 1024)', () => {
    const { scene } = setup();
    const failure = expectFailure(
      compileWorldScene(scene, {
        ontology: referenceOntology(),
        device: desktopDevice(),
        invocation: INVOCATION,
        budgets: { maxGraphNodes: 100, maxGraphEdges: 100, maxTextureBytes: 1024 },
      }),
      'budget-exceeded',
    );
    expect(failure.resource).toBe('texture-bytes');
    expect(failure.encountered).toBe(4096);
  });

  it('budgets that fit admit the compilation (the boundary is exact)', () => {
    const { scene } = setup();
    const compiled = compileWorldScene(scene, {
      ontology: referenceOntology(),
      device: desktopDevice(),
      invocation: INVOCATION,
      budgets: { maxGraphNodes: 4096, maxGraphEdges: 8192, maxTriangles: 1292, maxTextureBytes: 4096 },
    });
    expect(compiled.ok).toBe(true);
  });

  it('the budget mirror bounds match the W013 ceilings', async () => {
    const { WORLD_MAX_RENDERER_GRAPH_NODES, WORLD_MAX_RENDERER_GRAPH_EDGES, WORLD_MAX_RENDERER_TRIANGLES, WORLD_MAX_RENDERER_TEXTURE_BYTES } =
      await import('../src/budget');
    expect(WORLD_MAX_RENDERER_GRAPH_NODES).toBe(65_536);
    expect(WORLD_MAX_RENDERER_GRAPH_EDGES).toBe(131_072);
    expect(WORLD_MAX_RENDERER_TRIANGLES).toBe(100_000_000);
    expect(WORLD_MAX_RENDERER_TEXTURE_BYTES).toBe(1_099_511_627_776);
  });
});

describe('ontology resolution during compilation (negative)', () => {
  it('an unresolvable ontology representation is a typed unknown-ontology-record rejection', () => {
    const content = sceneContent();
    content.entities[0] = { ...content.entities[0], representationRecordId: 'ont-missing-rep' };
    const { scene } = setup(content);
    const failure = expectFailure(
      compileWorldScene(scene, {
        ontology: referenceOntology(),
        device: desktopDevice(),
        invocation: INVOCATION,
      }),
      'unknown-ontology-record',
    );
    expect(failure.recordId).toBe('ont-missing-rep');
  });

  it('a representation record of the wrong kind is a typed rejection', () => {
    const content = sceneContent();
    content.entities[0] = { ...content.entities[0], representationRecordId: 'ont-sym-plan' };
    const { scene } = setup(content);
    expectFailure(
      compileWorldScene(scene, {
        ontology: referenceOntology(),
        device: desktopDevice(),
        invocation: INVOCATION,
      }),
      'unknown-ontology-record',
    );
  });

  it('an unresolvable material record is a typed rejection', () => {
    const content = sceneContent();
    content.entities[0] = { ...content.entities[0], representationRecordId: 'ont-rep-sphere' };
    const ontology = referenceOntology();
    const stripped = {
      records: ontology.records.filter((r) => r.recordId !== 'ont-mat-concrete'),
    };
    const { scene } = setup(content);
    expectFailure(
      compileWorldScene(scene, {
        ontology: stripped,
        device: desktopDevice(),
        invocation: INVOCATION,
      }),
      'unknown-ontology-record',
    );
  });
});
