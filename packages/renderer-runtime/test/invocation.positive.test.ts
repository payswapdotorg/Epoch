// Positive battery of the enforcement boundary: the mount-graph /
// advance-frame / submit-intent happy paths, mounted-state flow into frame
// receipts, invocation replays producing identical receipts, and close.
import { describe, expect, it } from 'vitest';
import {
  admitInvocation,
  bindRendererSession,
  closeRendererSession,
  parseRendererBinding,
  parseRendererReceipt,
  type InvocationEnvelope,
  type RendererBinding,
} from '../src/index';
import { FULL_RENDERER, TENANT_A, boundSession, desktopSnapshot, sealedGraph } from './fixtures';

function mountEnvelope(graphDigest: string, invocationId = 'inv-mount-1', atMs = 50) {
  return {
    schema: 'epoch.renderer-invocation',
    protocolVersion: '1.0.0',
    kind: 'mount-graph',
    invocationId,
    rendererSessionId: 'rs-alpha-1',
    graphDigest,
    atMs,
  } as const;
}

function frameEnvelope(frameIndex: number, invocationId: string, atMs: number) {
  return {
    schema: 'epoch.renderer-invocation',
    protocolVersion: '1.0.0',
    kind: 'advance-frame',
    invocationId,
    rendererSessionId: 'rs-alpha-1',
    frameIndex,
    atMs,
  } as const;
}

function intentEnvelope(invocationId: string, modality = 'pointer') {
  return {
    schema: 'epoch.renderer-invocation',
    protocolVersion: '1.0.0',
    kind: 'submit-intent',
    invocationId,
    rendererSessionId: 'rs-alpha-1',
    modality,
    intent: { id: 'world.view.refresh', version: '1.0.0' },
  } as const;
}

describe('mount-graph admission (positive)', () => {
  it('admits a declared graph kind, mounts the state, and seals a mount receipt', () => {
    const graph = sealedGraph('2d');
    const admitted = admitInvocation(
      boundSession(),
      mountEnvelope(graph.digest),
      { graph },
    );
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const { binding, receipt } = admitted.value;
    expect(binding.mountedStateDigest).toBe(graph.digest);
    expect(binding.mountedAtMs).toBe(50);
    expect(binding.invocationCount).toBe(1);
    expect(receipt.kind).toBe('mount-receipt');
    if (receipt.kind !== 'mount-receipt') return;
    expect(receipt.graphDigest).toBe(graph.digest);
    expect(receipt.graphKind).toBe('2d');
    expect(receipt.nodeCount).toBe(1);
    expect(receipt.edgeCount).toBe(0);
    expect(receipt.mountedAtMs).toBe(50);
    expect(receipt.tenantScope.tenantId).toBe(TENANT_A);
    expect(receipt.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('admits declared triangle/texture usage on a bounded binding', () => {
    const graph = sealedGraph('3d');
    const admitted = admitInvocation(
      boundSession(),
      mountEnvelope(graph.digest, 'inv-mount-3d', 60),
      {
        graph,
        expectedTenantId: TENANT_A,
      },
    );
    // The full renderer bounds triangles/texture; the fixture graph is a
    // single box — declared usage must be supplied and admitted.
    expect(admitted.ok).toBe(false); // missing declarations are invalid
    const admittedWithUsage = admitInvocation(
      boundSession(),
      {
        ...mountEnvelope(graph.digest, 'inv-mount-3d', 60),
        declaredTriangles: 12,
        declaredTextureBytes: 1024,
      },
      { graph },
    );
    expect(admittedWithUsage.ok).toBe(true);
  });
});

describe('advance-frame admission (positive)', () => {
  it('executes frames against the previously mounted state, monotonically', () => {
    const graph = sealedGraph('2d');
    const binding = boundSession();
    const mounted = admitInvocation(binding, mountEnvelope(graph.digest), { graph });
    if (!mounted.ok) throw new Error('fixture mount');
    const first = admitInvocation(
      mounted.value.binding,
      frameEnvelope(0, 'inv-frame-0', 66),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.receipt.kind).toBe('frame-receipt');
    if (first.value.receipt.kind !== 'frame-receipt') return;
    expect(first.value.receipt.frameIndex).toBe(0);
    expect(first.value.receipt.stateDigest).toBe(graph.digest);
    expect(first.value.binding.lastFrameIndex).toBe(0);
    expect(first.value.binding.invocationCount).toBe(2);

    const second = admitInvocation(
      first.value.binding,
      frameEnvelope(1, 'inv-frame-1', 82),
    );
    expect(second.ok).toBe(true);
  });

  it('a frame receipt without mounted state omits the state digest', () => {
    const first = admitInvocation(boundSession(), frameEnvelope(0, 'inv-frame-0', 16));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const receipt = first.value.receipt;
    if (receipt.kind !== 'frame-receipt') throw new Error('fixture receipt');
    expect(receipt.stateDigest).toBeUndefined();
    expect(parseRendererReceipt(receipt).ok).toBe(true);
  });
});

describe('submit-intent admission (positive)', () => {
  it('admits a typed intent from a declared modality and seals an intent receipt', () => {
    const admitted = admitInvocation(boundSession(), intentEnvelope('inv-intent-1', 'voice'));
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const { receipt, binding } = admitted.value;
    expect(receipt.kind).toBe('intent-receipt');
    if (receipt.kind !== 'intent-receipt') return;
    expect(receipt.modality).toBe('voice');
    expect(receipt.intent.id).toBe('world.view.refresh');
    expect(binding.invocationCount).toBe(1);
  });
});

describe('invocation replay determinism (positive)', () => {
  it('replaying the same invocation against the same revision yields identical receipts', () => {
    const graph = sealedGraph('2d');
    const binding = boundSession();
    const envelope = mountEnvelope(graph.digest, 'inv-replay', 50);
    const first = admitInvocation(binding, envelope, { graph });
    const second = admitInvocation(binding, envelope, { graph });
    if (!first.ok || !second.ok) throw new Error('fixture replay');
    expect(second.value.receipt).toEqual(first.value.receipt);
    expect(second.value.binding).toEqual(first.value.binding);
  });
});

describe('binding close semantics (positive)', () => {
  it('a closed binding still serializes and re-admits, but rejects invocations', () => {
    const binding = boundSession();
    const closed = closeRendererSession(binding);
    if (!closed.ok) throw new Error('fixture close');
    expect(closed.value.state).toBe('closed');
    // The closed record is still a well-formed, admissible document.
    expect(parseRendererBinding(closed.value).ok).toBe(true);
    // But invocations against it are rejected (session-closed).
    const rejected = admitInvocation(closed.value, intentEnvelope('inv-after-close'));
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe('session-closed');
    }
  });
});

describe('full composition (positive)', () => {
  it('bind -> mount -> frame -> intent -> close with receipts at every step', () => {
    const graph = sealedGraph('controls');
    const bound = bindRendererSession({
      rendererSessionId: 'rs-compose-1',
      renderer: FULL_RENDERER,
      device: desktopSnapshot({ deviceSessionId: 'ds-compose-1' }),
      boundAtMs: 0,
    });
    if (!bound.ok) throw new Error('fixture bind');
    let binding: RendererBinding = bound.value;

    const mounted = admitInvocation(
      binding,
      {
        schema: 'epoch.renderer-invocation',
        protocolVersion: '1.0.0',
        kind: 'mount-graph',
        invocationId: 'inv-compose-mount',
        rendererSessionId: 'rs-compose-1',
        graphDigest: graph.digest,
        atMs: 10,
      },
      { graph },
    );
    if (!mounted.ok) throw new Error('fixture mount');
    binding = mounted.value.binding;

    const framed = admitInvocation(
      binding,
      {
        schema: 'epoch.renderer-invocation',
        protocolVersion: '1.0.0',
        kind: 'advance-frame',
        invocationId: 'inv-compose-frame',
        rendererSessionId: 'rs-compose-1',
        frameIndex: 0,
        atMs: 16,
      },
    );
    if (!framed.ok) throw new Error('fixture frame');
    binding = framed.value.binding;

    const intented = admitInvocation(
      binding,
      {
        schema: 'epoch.renderer-invocation',
        protocolVersion: '1.0.0',
        kind: 'submit-intent',
        invocationId: 'inv-compose-intent',
        rendererSessionId: 'rs-compose-1',
        modality: 'pointer',
        intent: { id: 'world.view.refresh', version: '1.0.0' },
      } satisfies InvocationEnvelope,
    );
    if (!intented.ok) throw new Error('fixture intent');
    binding = intented.value.binding;

    expect(binding.invocationCount).toBe(3);
    expect(binding.lastFrameIndex).toBe(0);
    expect(binding.mountedStateDigest).toBe(graph.digest);

    const closed = closeRendererSession(binding);
    if (!closed.ok) throw new Error('fixture close');
    expect(closed.value.state).toBe('closed');
  });
});
