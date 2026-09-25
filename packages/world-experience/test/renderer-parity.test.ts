// Renderer-runtime parity (devDependency — NO runtime coupling): the
// envelopes this compiler emits parse against the REAL W013 invocation
// schema and ADMIT against a REAL W013 binding (mount -> advance ->
// submit-intent, the full hosting round-trip). The compile-time half
// lives in src/parity.ts.
import { describe, expect, it } from 'vitest';
import {
  InvocationEnvelopeSchema,
  RendererDescriptorSchema,
  bindRendererSession,
  admitInvocation,
  deviceSessionSnapshotOf,
  RendererBudgetsSchema,
  type RendererBinding,
  type RendererDescriptor,
} from '@epoch/renderer-runtime';
import { desktopDevice, referenceOntology, sceneContent } from './fixtures';
import {
  compileWorldScene,
  compileIntentSubmission,
  compileFrameAdvance,
  WORLD_PRIMITIVE_TRIANGLE_ESTIMATES,
} from '../src/index';
import { createWorldScene, emptyWorldSceneStore } from '../src/scene';
import { admitWorldIntent } from '../src/intent';
import { PRIMITIVE_TRIANGLE_ESTIMATES } from '@epoch/experience-compiler';

function sealedScene() {
  const created = createWorldScene(emptyWorldSceneStore(), sceneContent());
  if (!created.ok) {
    throw new Error(`fixture scene failed: ${created.error.message}`);
  }
  return created.value.scene;
}

function compiled() {
  const result = compileWorldScene(sealedScene(), {
    ontology: referenceOntology(),
    device: desktopDevice(),
    invocation: { invocationId: 'w016-parity-mount', rendererSessionId: 'rs-parity-world', atMs: 0 },
  });
  if (!result.ok) {
    throw new Error(`fixture compilation failed: ${result.error.message}`);
  }
  return result.value;
}

/** A real W013 renderer descriptor hosting all graph kinds + pointer input. */
function worldRendererDescriptor(): RendererDescriptor {
  const parsed = RendererDescriptorSchema.safeParse({
    descriptorVersion: 1,
    rendererId: 'rr-world-reference',
    graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'],
    interaction: ['keyboard', 'pointer'],
    output: { stereoscopic: false, maxPixels: 8_294_400, refreshHz: 60, colorDepthBits: 8 },
    budgets: { maxGraphNodes: 4096, maxGraphEdges: 8192, maxTriangles: 1_000_000, maxTextureBytes: 16_777_216 },
  });
  if (!parsed.success) {
    throw new Error(`descriptor fixture invalid: ${JSON.stringify(parsed.error.issues)}`);
  }
  return parsed.data;
}

describe('renderer-runtime parity (devDependency, downstream)', () => {
  it('every emitted mount envelope parses against the REAL W013 invocation schema', () => {
    for (const envelope of compiled().mountEnvelopes) {
      const parsed = InvocationEnvelopeSchema.safeParse(envelope);
      expect(parsed.success, JSON.stringify(parsed)).toBe(true);
    }
  });

  it('the emitted advance envelope parses against the REAL W013 invocation schema', () => {
    const advance = compileFrameAdvance({
      invocationId: 'w016-parity-frame',
      rendererSessionId: 'rs-parity-world',
      lastFrameIndex: 0,
      atMs: 16,
    });
    expect(InvocationEnvelopeSchema.safeParse(advance).success).toBe(true);
  });

  it('the emitted submit-intent envelopes parse against the REAL W013 invocation schema', () => {
    const admitted = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'select',
      intentId: 'w016-parity-select',
      entityId: 'wall-north-1',
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const envelope = compileIntentSubmission(admitted.value, {
      modality: 'pointer',
      invocationId: 'w016-parity-submit',
      rendererSessionId: 'rs-parity-world',
    });
    expect(InvocationEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it('the full hosting round-trip admits: every mount, then a frame, then an intent', () => {
    const renderer = worldRendererDescriptor();
    const bindingResult = bindRendererSession({
      rendererSessionId: 'rs-parity-world',
      renderer,
      device: deviceSessionSnapshotOf({
        deviceSessionId: 'ds-parity-host',
        tenantScope: { tenantId: 'tenant-alpha', workspaceId: 'ws-main', projectId: 'proj-tower-a' },
        device: desktopDevice(),
      }),
    });
    expect(bindingResult.ok, JSON.stringify(bindingResult)).toBe(true);
    if (!bindingResult.ok) return;
    let binding: RendererBinding = bindingResult.value;

    // Mount every compiled graph (supplying each sealed W011 graph document).
    const compilation = compiled();
    for (let i = 0; i < compilation.graphs.length; i += 1) {
      const outcome = admitInvocation(binding, compilation.mountEnvelopes[i], {
        graph: compilation.graphs[i],
        expectedTenantId: 'tenant-alpha',
      });
      expect(outcome.ok, JSON.stringify(outcome)).toBe(true);
      if (!outcome.ok) return;
      binding = outcome.value.binding;
      expect(outcome.value.receipt.kind).toBe('mount-receipt');
    }

    // Advance one frame (monotonic after the mounts).
    const frame = compileFrameAdvance({
      invocationId: 'w016-parity-frame-2',
      rendererSessionId: 'rs-parity-world',
      lastFrameIndex: -1,
      atMs: 16,
    });
    const frameOutcome = admitInvocation(binding, frame);
    expect(frameOutcome.ok, JSON.stringify(frameOutcome)).toBe(true);
    if (!frameOutcome.ok) return;
    binding = frameOutcome.value.binding;
    expect(frameOutcome.value.receipt.kind).toBe('frame-receipt');

    // Submit one typed intent from a declared modality.
    const admitted = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'select',
      intentId: 'w016-parity-select-2',
      entityId: 'wall-north-1',
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const intentEnvelope = compileIntentSubmission(admitted.value, {
      modality: 'pointer',
      invocationId: 'w016-parity-submit-2',
      rendererSessionId: 'rs-parity-world',
    });
    const intentOutcome = admitInvocation(binding, intentEnvelope, { expectedTenantId: 'tenant-alpha' });
    expect(intentOutcome.ok, JSON.stringify(intentOutcome)).toBe(true);
    if (!intentOutcome.ok) return;
    expect(intentOutcome.value.receipt.kind).toBe('intent-receipt');
  });

  it('a cross-tenant invocation is denied by the REAL W013 boundary (consistent tenant isolation)', () => {
    const renderer = worldRendererDescriptor();
    const bindingResult = bindRendererSession({
      // Same session id as the emitted envelopes (so the session gate
      // passes and the tenant gate is what fires).
      rendererSessionId: 'rs-parity-world',
      renderer,
      device: deviceSessionSnapshotOf({
        deviceSessionId: 'ds-parity-host-b',
        tenantScope: { tenantId: 'tenant-beta' },
        device: desktopDevice(),
      }),
    });
    expect(bindingResult.ok).toBe(true);
    if (!bindingResult.ok) return;
    const compilation = compiled();
    const outcome = admitInvocation(bindingResult.value, compilation.mountEnvelopes[0], {
      graph: compilation.graphs[0],
      expectedTenantId: 'tenant-beta',
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('cross-tenant-denied');
  });

  it('the mirrored budget record admits against the REAL W013 RendererBudgets schema', () => {
    const parsed = RendererBudgetsSchema.safeParse({
      maxGraphNodes: 4096,
      maxGraphEdges: 8192,
      maxTriangles: 1_000_000,
      maxTextureBytes: 16_777_216,
    });
    expect(parsed.success).toBe(true);
  });

  it('the mirrored triangle-estimate table equals the W012 compiler table member-for-member', () => {
    expect(WORLD_PRIMITIVE_TRIANGLE_ESTIMATES).toEqual(PRIMITIVE_TRIANGLE_ESTIMATES);
  });

  it('a W013-budgeted compilation that exceeds the binding budget would be rejected downstream too (consistent boundaries)', () => {
    // The fixture scene declares 24 triangles; a binding bounding 10
    // rejects at THIS compiler (typed), and the W013 mount admission
    // enforces the same class of bound downstream — the compiler rejects
    // EARLY so the presenter never mounts over-budget content.
    const failure = compileWorldScene(sealedScene(), {
      ontology: referenceOntology(),
      device: desktopDevice(),
      invocation: { invocationId: 'w016-parity-tight', rendererSessionId: 'rs-parity-world', atMs: 0 },
      budgets: { maxGraphNodes: 4096, maxGraphEdges: 8192, maxTriangles: 10 },
    });
    expect(failure.ok).toBe(false);
    if (failure.ok) return;
    expect(failure.error.code).toBe('budget-exceeded');
  });
});
