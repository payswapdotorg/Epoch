// Renderer-runtime parity (devDependency — NO runtime coupling): the
// compiled plan feeds the W013 renderer hosting surface with no
// translation layer. The plan's usage accounting becomes the
// mount-graph envelope's declared usage; the plan's source digest chains
// to the mount envelope's graph digest; the graph-kind vocabulary agrees.
// The compile-time half lives in src/host-parity.ts.
import { describe, expect, it } from 'vitest';
import { InvocationEnvelopeSchema, ExperienceGraphKindSchema } from '@epoch/renderer-runtime';
import { compileExperienceGraph } from '../src/index';
import { budgetedHeadsetDevice, compiledPlan, expectFailure, sealedGraph } from './fixtures';

describe('renderer-runtime parity (devDependency, downstream)', () => {
  it('the plan usage fields fit the mount-graph declared usage bounds', () => {
    const plan = compiledPlan('3d', budgetedHeadsetDevice());
    expect(plan.usage.estimatedTriangles).toBeLessThanOrEqual(100_000_000);
    expect(plan.usage.assetBytes).toBeLessThanOrEqual(1_099_511_627_776);
  });

  it('a mount-graph envelope built from the plan admits against the renderer schema', () => {
    const plan = compiledPlan('3d', budgetedHeadsetDevice());
    const mount = InvocationEnvelopeSchema.safeParse({
      schema: 'epoch.renderer-invocation',
      protocolVersion: '1.0.0',
      kind: 'mount-graph',
      invocationId: 'inv-parity-mount',
      rendererSessionId: 'rs-parity',
      graphDigest: plan.sourceEnvelopeDigest,
      atMs: 0,
      declaredTriangles: plan.usage.estimatedTriangles,
      declaredTextureBytes: plan.usage.assetBytes,
    });
    expect(mount.success, JSON.stringify(mount)).toBe(true);
  });

  it('the mount envelope requires declared usage exactly when the binding bounds it — plan values satisfy the field types', () => {
    // The plan's declared values are integers within the envelope's
    // bounds (checked above); the renderer enforces them against the
    // binding's effective limits at admission — this compiler computed
    // them against the DEVICE budgets (constraints as data, mirrored).
    const plan = compiledPlan('3d');
    expect(Number.isInteger(plan.usage.estimatedTriangles)).toBe(true);
    expect(Number.isInteger(plan.usage.assetBytes)).toBe(true);
    expect(plan.constraints.maxTriangles).toBeUndefined();
  });

  it('the plan graph-kind vocabulary admits against the renderer hosting vocabulary', () => {
    for (const kind of [
      '2d',
      '3d',
      'animation',
      'narrative',
      'timeline-replay',
      'presence',
      'controls',
    ] as const) {
      expect(ExperienceGraphKindSchema.safeParse(kind).success).toBe(true);
      const plan = compiledPlan(kind);
      expect(ExperienceGraphKindSchema.safeParse(plan.sourceGraphKind).success).toBe(true);
    }
  });

  it('a compile rejected by the compiler device gate would fail the renderer budget too (consistent boundaries)', () => {
    // The 3d fixture estimates 12 triangles; a device budget of 10 rejects
    // at compile time. The renderer's mount would enforce the same class
    // of bound downstream — the compiler rejects EARLY (typed), so the
    // presenter never mounts over-budget content.
    const failure = expectFailure(
      compileExperienceGraph({
        envelope: sealedGraph('3d'),
        device: {
          ...budgetedHeadsetDevice(),
          spatial: { poseTracking: '6dof' as const, worldAnchored: true, maxTriangles: 10 },
        },
      }),
      'device-budget-exceeded',
    );
    expect(failure.encountered).toBe(12);
  });
});
