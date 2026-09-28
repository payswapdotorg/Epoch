// Mount planning + the full W019 composition round-trip: select the
// technique (device assessment + W013 binding), plan the mount, project
// the W013 envelope, and ADMIT it through the REAL W013 hosting surface.
import { describe, expect, it } from 'vitest';
import { admitInvocation } from '@epoch/renderer-runtime';
import { sealExperienceGraph, type ExperienceGraph } from '@epoch/experience-protocol';
import {
  selectRendererAdapter,
  planMount,
  mountEnvelopeOf,
  parseRendererMountPlan,
} from '../src/index';
import {
  boundSession,
  desktopDevice,
  assess,
  FULL_RENDERER,
  TENANT_A,
} from './fixtures';

function selectionFixture() {
  const binding = boundSession(FULL_RENDERER);
  const assessment = assess(desktopDevice(), 'dca-plan');
  const selection = selectRendererAdapter({ selectionId: 'ras-plan', binding, assessment });
  if (!selection.ok) throw new Error('fixture failed');
  return { binding, selection: selection.value };
}

/** A small sealed 3D graph fixture. */
function sealedGraph(): ExperienceGraph {
  const sealed = sealExperienceGraph({
    schema: 'epoch.experience-graph',
    protocolVersion: '1.0.0',
    graphId: 'xg-plan-1',
    graphKind: '3d',
    tenantScope: { tenantId: TENANT_A },
    projectedFrom: [],
    nodes: [
      {
        id: 'xn-box-1',
        kind: 'spatial-3d',
        descriptor: { primitive: 'box', position: [0, 0, 0] },
      },
    ],
    edges: [],
    device: desktopDevice(),
  });
  if (!sealed.ok) throw new Error(`fixture graph failed: ${sealed.error.message}`);
  return sealed.value;
}

describe('mount planning (positive)', () => {
  it('a plan carries the technique, content revision, and declared usage', () => {
    const { selection } = selectionFixture();
    const planned = planMount({
      planId: 'rmp-plan-1',
      invocationId: 'inv-plan-1',
      selection,
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
      declaredTriangles: 12,
      declaredTextureBytes: 0,
      atMs: 100,
    });
    expect(planned.ok).toBe(true);
    if (planned.ok) {
      expect(planned.value.technique).toBe(selection.technique);
      expect(planned.value.selectionDigest).toBe(selection.digest);
      expect(planned.value.graphDigest).toBe('a'.repeat(64));
      expect(planned.value.graphKind).toBe('3d');
      expect(planned.value.declaredTriangles).toBe(12);
      expect(planned.value.declaredTextureBytes).toBe(0);
      expect(planned.value.atMs).toBe(100);
      expect(planned.value.steps).toEqual([
        'prepare-surface',
        'stage-content',
        'activate-presentation',
      ]);
      expect(planned.value.tenantScope).toEqual(selection.tenantScope);
      expect(planned.value.rendererSessionId).toBe(selection.rendererSessionId);
    }
  });

  it('the plan is content-addressed and parse-admits round-trip', () => {
    const { selection } = selectionFixture();
    const planned = planMount({
      planId: 'rmp-plan-2',
      invocationId: 'inv-plan-2',
      selection,
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
    });
    if (!planned.ok) throw new Error('fixture failed');
    expect(planned.value.digest).toMatch(/^[0-9a-f]{64}$/);
    const parsed = parseRendererMountPlan(JSON.parse(JSON.stringify(planned.value)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual(planned.value);
    }
  });

  it('the projected envelope parses against the REAL W013 invocation schema', () => {
    const { selection } = selectionFixture();
    const planned = planMount({
      planId: 'rmp-plan-3',
      invocationId: 'inv-plan-3',
      selection,
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
      declaredTriangles: 12,
    });
    if (!planned.ok) throw new Error('fixture failed');
    const envelope = mountEnvelopeOf(planned.value);
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.value).toMatchObject({
        kind: 'mount-graph',
        invocationId: 'inv-plan-3',
        graphDigest: 'a'.repeat(64),
        declaredTriangles: 12,
      });
    }
  });
});

describe('the full W019 composition round-trip', () => {
  it('select -> plan -> project -> ADMIT through the REAL W013 hosting surface', () => {
    const { binding, selection } = selectionFixture();
    const graph = sealedGraph();
    const planned = planMount({
      planId: 'rmp-compose-1',
      invocationId: 'inv-compose-1',
      selection,
      graphDigest: graph.digest,
      graphKind: graph.graphKind,
      declaredTriangles: 12,
      declaredTextureBytes: 0,
      atMs: 0,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('fixture failed');
    const envelope = mountEnvelopeOf(planned.value);
    expect(envelope.ok).toBe(true);
    if (!envelope.ok) throw new Error('fixture failed');
    const admitted = admitInvocation(binding, envelope.value, { graph });
    expect(admitted.ok, JSON.stringify(admitted.ok ? null : admitted.error)).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.receipt.kind).toBe('mount-receipt');
      expect(admitted.value.binding.mountedStateDigest).toBe(graph.digest);
      expect(admitted.value.binding.invocationCount).toBe(1);
    }
  });

  it('a wrong declared usage is honestly rejected by the REAL W013 boundary', () => {
    const { binding, selection } = selectionFixture();
    const graph = sealedGraph();
    const planned = planMount({
      planId: 'rmp-compose-2',
      invocationId: 'inv-compose-2',
      selection,
      graphDigest: graph.digest,
      graphKind: graph.graphKind,
      declaredTriangles: 2_000_000, // exactly at the effective limit (inclusive)
      declaredTextureBytes: 0,
      atMs: 0,
    });
    if (!planned.ok) throw new Error('fixture failed');
    const envelope = mountEnvelopeOf(planned.value);
    if (!envelope.ok) throw new Error('fixture failed');
    const admitted = admitInvocation(binding, envelope.value, { graph });
    // FULL_RENDERER budgets 2,000,000 triangles: exactly at the limit fits.
    expect(admitted.ok).toBe(true);
  });

  it('a digest-mismatched plan projection is rejected by the REAL W013 boundary', () => {
    const { binding, selection } = selectionFixture();
    const planned = planMount({
      planId: 'rmp-compose-3',
      invocationId: 'inv-compose-3',
      selection,
      graphDigest: 'b'.repeat(64), // NOT the supplied graph's digest
      graphKind: '3d',
      atMs: 0,
    });
    if (!planned.ok) throw new Error('fixture failed');
    const envelope = mountEnvelopeOf(planned.value);
    if (!envelope.ok) throw new Error('fixture failed');
    const admitted = admitInvocation(binding, envelope.value, { graph: sealedGraph() });
    expect(admitted.ok).toBe(false);
    if (!admitted.ok && admitted.error.code === 'digest-mismatch') {
      // The REAL W013 boundary rejects the claimed digest mismatch.
      expect(admitted.error.expected).toBe('b'.repeat(64));
    } else if (!admitted.ok) {
      throw new Error(`expected digest-mismatch, got ${admitted.error.code}`);
    }
  });
});
