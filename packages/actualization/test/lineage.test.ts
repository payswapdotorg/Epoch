// LINEAGE — the exact-revision chain battery: prediction -> baseline ->
// commitment -> actual -> forecast edges across realization variants,
// bidirectional traversal, order/cycle/pair discipline, replay conflicts.
import { describe, expect, it } from 'vitest';
import {
  admitLineageEdge,
  foldLineageEdges,
  lineageEdgesOf,
  openLineageStore,
  sealLineageEdge,
  traceLineageBackward,
  traceLineageForward,
  verifySealedLineageEdge,
} from '../src/index';
import { expectError, unwrap } from './helpers';
import { SOLUTION_ID, TENANT, lineageEdgeContent } from './fixtures';

const D1 = '1'.repeat(64);
const D2 = '2'.repeat(64);
const D3 = '3'.repeat(64);
const D4 = '4'.repeat(64);
const D5 = '5'.repeat(64);
const D6 = '6'.repeat(64);

/** Seal one lineage-edge fixture (the total unwrapped form). */
function edge(overrides: Record<string, unknown> = {}): import('../src/lineage').SealedLineageEdge {
  return unwrap(sealLineageEdge(lineageEdgeContent(overrides)));
}

describe('the exact-revision lineage chain (all five lifecycle-first kinds)', () => {
  it('chains prediction -> baseline -> commitment -> actual -> forecast under one realization variant', () => {
    let store = openLineageStore({ tenantId: TENANT, solutionId: SOLUTION_ID });
    store = unwrap(
      admitLineageEdge(
        store,
        edge({
          edgeId: 'lineage:e1',
          from: { kind: 'prediction', recordId: 'prediction:pit-volume', contentDigest: D1 },
          to: { kind: 'baseline', recordId: 'baseline:pit-volume-v1', contentDigest: D2 },
        }),
      ),
    );
    store = unwrap(
      admitLineageEdge(
        store,
        edge({
          edgeId: 'lineage:e2',
          from: { kind: 'baseline', recordId: 'baseline:pit-volume-v1', contentDigest: D2 },
          to: { kind: 'commitment', recordId: 'commitment:pit-volume-supplier', contentDigest: D3 },
        }),
      ),
    );
    store = unwrap(
      admitLineageEdge(
        store,
        edge({
          edgeId: 'lineage:e3',
          from: { kind: 'commitment', recordId: 'commitment:pit-volume-supplier', contentDigest: D3 },
          to: { kind: 'actual', recordId: 'actual:pit-volume-monday', contentDigest: D4 },
        }),
      ),
    );
    store = unwrap(
      admitLineageEdge(
        store,
        edge({
          edgeId: 'lineage:e4',
          from: { kind: 'actual', recordId: 'actual:pit-volume-monday', contentDigest: D4 },
          to: { kind: 'forecast', recordId: 'forecast:pit-volume-r1', contentDigest: D5 },
        }),
      ),
    );
    expect(store.edges.length).toBe(4);

    // FORWARD traversal from the prediction reaches every later node (the
    // origin included — the full chain view).
    const forward = traceLineageForward(store, 'prediction:pit-volume');
    expect(forward.nodes.map((node) => node.kind)).toEqual([
      'prediction',
      'baseline',
      'commitment',
      'actual',
      'forecast',
    ]);
    // BACKWARD traversal from the forecast reaches every earlier node.
    const backward = traceLineageBackward(store, 'forecast:pit-volume-r1');
    expect(backward.nodes.map((node) => node.kind)).toEqual([
      'prediction',
      'baseline',
      'commitment',
      'actual',
      'forecast',
    ]);
    // Both traversals walk the same four edges.
    expect(forward.edges.map((e) => e.edgeId)).toEqual(['lineage:e1', 'lineage:e2', 'lineage:e3', 'lineage:e4']);
    expect(backward.edges.map((e) => e.edgeId)).toEqual(['lineage:e1', 'lineage:e2', 'lineage:e3', 'lineage:e4']);
    // The bidirectional adjacency of the commitment node.
    expect(lineageEdgesOf(store, 'commitment:pit-volume-supplier').map((e) => e.edgeId)).toEqual([
      'lineage:e2',
      'lineage:e3',
    ]);
  });

  it('forecast -> forecast refinement edges are admitted (rolling forecast revisions)', () => {
    let store = openLineageStore({ tenantId: TENANT, solutionId: SOLUTION_ID });
    store = unwrap(
      admitLineageEdge(
        store,
        edge({
          edgeId: 'lineage:refinement-1',
          from: { kind: 'forecast', recordId: 'forecast:pit-volume-r1', contentDigest: D5 },
          to: { kind: 'forecast', recordId: 'forecast:pit-volume-r2', contentDigest: D6 },
        }),
      ),
    );
    store = unwrap(
      admitLineageEdge(
        store,
        edge({
          edgeId: 'lineage:refinement-2',
          from: { kind: 'forecast', recordId: 'forecast:pit-volume-r2', contentDigest: D6 },
          to: { kind: 'forecast', recordId: 'forecast:pit-volume-r3', contentDigest: D5 },
        }),
      ),
    );
    const forward = traceLineageForward(store, 'forecast:pit-volume-r1');
    expect(forward.nodes.map((node) => node.recordId).sort()).toEqual([
      'forecast:pit-volume-r1',
      'forecast:pit-volume-r2',
      'forecast:pit-volume-r3',
    ]);
  });

  it('every realization variant is admissible (the universal lifecycle realizations)', () => {
    const variants = [
      'construction-build',
      'software-implementation-deployment',
      'mechanical-fabrication-assembly',
      'electrical-installation-commissioning',
      'manufacturing',
      'infrastructure-provisioning',
      'field-service-repair',
    ];
    let store = openLineageStore({ tenantId: TENANT, solutionId: SOLUTION_ID });
    variants.forEach((variant, index) => {
      store = unwrap(
        admitLineageEdge(
          store,
          edge({
            edgeId: `lineage:variant-${index}`,
            realizationVariant: variant,
            from: { kind: 'prediction', recordId: `prediction:variant-${index}`, contentDigest: D1 },
            to: { kind: 'baseline', recordId: `baseline:variant-${index}`, contentDigest: D2 },
          }),
        ),
      );
    });
    expect(store.edges.length).toBe(variants.length);
  });

  it('lineage-order-rejected: a backward edge (forecast -> baseline)', () => {
    const error = expectError(
      sealLineageEdge(
        lineageEdgeContent({
          from: { kind: 'forecast', recordId: 'forecast:pit-volume-r1', contentDigest: D5 },
          to: { kind: 'baseline', recordId: 'baseline:pit-volume-v1', contentDigest: D2 },
        }),
      ),
    );
    expect(error.code).toBe('validation');
    // A forward edge into the same kinds seals fine.
    expect(sealLineageEdge(lineageEdgeContent()).ok).toBe(true);
  });

  it('lineage-order-rejected: a same-kind non-forecast edge (baseline -> baseline)', () => {
    const error = expectError(
      sealLineageEdge(
        lineageEdgeContent({
          from: { kind: 'baseline', recordId: 'baseline:pit-volume-v1', contentDigest: D2 },
          to: { kind: 'baseline', recordId: 'baseline:pit-volume-v2', contentDigest: D3 },
        }),
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('validation: kind-prefix mismatches are rejected (the exact-revision discipline)', () => {
    const error = expectError(
      sealLineageEdge(
        lineageEdgeContent({
          from: { kind: 'prediction', recordId: 'forecast:wrong-prefix', contentDigest: D1 },
        }),
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('lineage-cycle-rejected: an edge closing a cycle in the lineage graph', () => {
    let store = openLineageStore({ tenantId: TENANT, solutionId: SOLUTION_ID });
    store = unwrap(
      admitLineageEdge(
        store,
        edge({
          edgeId: 'lineage:refinement-1',
          from: { kind: 'forecast', recordId: 'forecast:pit-volume-r1', contentDigest: D5 },
          to: { kind: 'forecast', recordId: 'forecast:pit-volume-r2', contentDigest: D6 },
        }),
      ),
    );
    const error = expectError(
      admitLineageEdge(
        store,
        edge({
          edgeId: 'lineage:refinement-back',
          from: { kind: 'forecast', recordId: 'forecast:pit-volume-r2', contentDigest: D6 },
          to: { kind: 'forecast', recordId: 'forecast:pit-volume-r1', contentDigest: D5 },
        }),
      ),
    );
    expect(error.code).toBe('lineage-cycle-rejected');
  });

  it('version-conflict: the same edge id with different content; the same node pair under a new id', () => {
    let store = openLineageStore({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const first = edge();
    store = unwrap(admitLineageEdge(store, first));
    // Same id, different content.
    const mutated = edge({ note: 'mutated content' });
    const idConflict = expectError(admitLineageEdge(store, mutated));
    expect(idConflict.code).toBe('version-conflict');
    // Same node pair, new edge id.
    const pairClone = edge({ edgeId: 'lineage:pair-clone' });
    const pairConflict = expectError(admitLineageEdge(store, pairClone));
    expect(pairConflict.code).toBe('version-conflict');
    // Exact re-admission is idempotent.
    const replay = unwrap(admitLineageEdge(store, first));
    expect(replay.edges.length).toBe(1);
  });

  it('tenant-isolation-rejected: a cross-tenant edge', () => {
    const store = openLineageStore({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const foreign = edge({ tenantId: 'tenant:initech' });
    const error = expectError(admitLineageEdge(store, foreign));
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('a tampered sealed edge is a typed digest-mismatch', () => {
    const sealed = edge();
    const tampered = { ...sealed, note: 'tampered' };
    const verified = verifySealedLineageEdge(tampered);
    expect(verified.ok).toBe(false);
    expect(!verified.ok && verified.error.code).toBe('digest-mismatch');
  });

  it('the sealed edge round-trips through JSON and the store fold is deterministic', () => {
    let store = openLineageStore({ tenantId: TENANT, solutionId: SOLUTION_ID });
    store = unwrap(admitLineageEdge(store, edge()));
    const sealed = foldLineageEdges(store)[0]!;
    const roundTrip = verifySealedLineageEdge(JSON.parse(JSON.stringify(sealed)));
    expect(roundTrip.ok).toBe(true);
    expect(roundTrip.ok && roundTrip.value.contentDigest).toBe(sealed.contentDigest);
  });
});
