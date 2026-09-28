// RUNTIME PARITY with the sibling vocabularies (devDependencies only —
// no runtime coupling; the compile-time half lives in
// src/kernel-parity.ts):
//
// - W012 experience-compiler: the mirrored primitive triangle estimate
//   table is member-identical to the REAL PRIMITIVE_TRIANGLE_ESTIMATES;
// - W013 renderer-runtime: a fitted rung ADMITS through a REAL W013
//   binding end-to-end (bind -> fit -> mount the fitted rung graph with
//   the fit's declared usage — the full hosting round-trip, proving the
//   rungs are mountable through the unchanged W013 mount-graph path);
// - W013 experience-runtime: the host session model's device slot is the
//   device our rungs carry verbatim.
import { describe, expect, it } from 'vitest';
import { PRIMITIVE_TRIANGLE_ESTIMATES } from '@epoch/experience-compiler';
import {
  bindRendererSession,
  admitInvocation,
  deviceSessionSnapshotOf,
} from '@epoch/renderer-runtime';
import { openDeviceSession } from '@epoch/experience-runtime';
import { WORLD_PRIMITIVE_TRIANGLE_ESTIMATES } from '@epoch/world-experience';
import {
  PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES,
  deriveProgressiveLadder,
  fitGraphToLimits,
  rungGraphAt,
} from '../src/index';
import { richAnimationGraph, DESKTOP_DEVICE, SCOPE_A } from './fixtures';

describe('W012 experience-compiler parity (runtime)', () => {
  it('the mirrored estimate table is member-identical to the W012 table', () => {
    expect(PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES).toEqual(PRIMITIVE_TRIANGLE_ESTIMATES);
  });

  it('the mirrored estimate table also agrees with the W016 mirror', () => {
    expect(PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES).toEqual(WORLD_PRIMITIVE_TRIANGLE_ESTIMATES);
  });
});

describe('W013 renderer-runtime parity (runtime)', () => {
  it('a fitted rung mounts through a REAL W013 binding end-to-end', () => {
    const graph = richAnimationGraph();
    // A tight renderer binding: small node budget + bounded triangles and
    // texture memory, forcing the fit to walk down the ladder.
    const renderer = {
      descriptorVersion: 1,
      rendererId: 'rr-parity-tight',
      graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'] as const,
      interaction: ['keyboard', 'pointer', 'voice'] as const,
      output: { stereoscopic: false },
      budgets: {
        maxGraphNodes: 2,
        maxGraphEdges: 1,
        maxTriangles: 30,
        maxTextureBytes: 1_048_576,
      },
    };
    const bound = bindRendererSession({
      rendererSessionId: 'rs-parity-1',
      renderer,
      device: deviceSessionSnapshotOf({
        deviceSessionId: 'ds-parity-1',
        tenantScope: SCOPE_A,
        device: DESKTOP_DEVICE,
      }),
      boundAtMs: 0,
    });
    expect(bound.ok).toBe(true);
    if (!bound.ok) throw new Error('fixture binding failed');

    const fit = fitGraphToLimits({
      ladderId: 'psl-parity-1',
      graph,
      limits: bound.value.effective,
    });
    expect(fit.ok).toBe(true);
    if (!fit.ok) throw new Error('fixture fit failed');

    const rung = rungGraphAt({ ladderId: 'psl-parity-1', graph }, fit.value.rungIndex);
    expect(rung.ok).toBe(true);
    if (!rung.ok) throw new Error('fixture rung failed');

    // Mount the fitted rung through the REAL W013 admission path with the
    // fit's declared usage — the full hosting round-trip.
    const mounted = admitInvocation(bound.value, {
      schema: 'epoch.renderer-invocation',
      protocolVersion: '1.0.0',
      kind: 'mount-graph',
      invocationId: 'inv-parity-mount-1',
      rendererSessionId: 'rs-parity-1',
      graphDigest: rung.value.digest,
      atMs: 0,
      declaredTriangles: fit.value.declaredUsage.declaredTriangles,
      declaredTextureBytes: fit.value.declaredUsage.declaredTextureBytes,
    }, { graph: rung.value });
    expect(mounted.ok, JSON.stringify(mounted.ok ? null : mounted.error)).toBe(true);
    if (mounted.ok) {
      expect(mounted.value.receipt.kind).toBe('mount-receipt');
      expect(mounted.value.binding.mountedStateDigest).toBe(rung.value.digest);
    }
  });

  it('the unfitted source graph would be REJECTED by the same W013 binding', () => {
    const graph = richAnimationGraph();
    const renderer = {
      descriptorVersion: 1,
      rendererId: 'rr-parity-tight',
      graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'] as const,
      interaction: ['keyboard', 'pointer', 'voice'] as const,
      output: { stereoscopic: false },
      budgets: {
        maxGraphNodes: 2,
        maxGraphEdges: 1,
        maxTriangles: 30,
        maxTextureBytes: 1_048_576,
      },
    };
    const bound = bindRendererSession({
      rendererSessionId: 'rs-parity-2',
      renderer,
      device: deviceSessionSnapshotOf({
        deviceSessionId: 'ds-parity-2',
        tenantScope: SCOPE_A,
        device: DESKTOP_DEVICE,
      }),
      boundAtMs: 0,
    });
    if (!bound.ok) throw new Error('fixture binding failed');

    // The source graph exceeds the node budget: mounting it directly is a
    // typed W013 budget-exceeded rejection — adaptation (the fit) is what
    // makes it mountable, which is exactly the W019 contract.
    const mounted = admitInvocation(bound.value, {
      schema: 'epoch.renderer-invocation',
      protocolVersion: '1.0.0',
      kind: 'mount-graph',
      invocationId: 'inv-parity-mount-2',
      rendererSessionId: 'rs-parity-2',
      graphDigest: graph.digest,
      atMs: 0,
      declaredTriangles: 2_572,
      declaredTextureBytes: 8_388_608,
    }, { graph });
    expect(mounted.ok).toBe(false);
    if (!mounted.ok) {
      expect(mounted.error.code).toBe('budget-exceeded');
    }
  });
});

describe('W013 experience-runtime parity (runtime)', () => {
  it('the host session model produces the device slot our rungs carry', () => {
    // A REAL W013 host session over the same device descriptor: the
    // rungs' device slot is exactly the host model's device vocabulary.
    const opened = openDeviceSession({
      deviceSessionId: 'ds-host-parity',
      device: DESKTOP_DEVICE,
      tenantScope: SCOPE_A,
    });
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      const derived = deriveProgressiveLadder({
        ladderId: 'psl-host-parity',
        graph: richAnimationGraph(),
      });
      expect(derived.ok).toBe(true);
      if (derived.ok) {
        expect(derived.value.tenantScope).toEqual(opened.value.session.tenantScope);
        const rung = rungGraphAt(
          { ladderId: 'psl-host-parity', graph: richAnimationGraph() },
          derived.value.rungs.length - 1,
        );
        expect(rung.ok).toBe(true);
        if (rung.ok) {
          expect(rung.value.device).toEqual(opened.value.session.device);
        }
      }
    }
  });
});
