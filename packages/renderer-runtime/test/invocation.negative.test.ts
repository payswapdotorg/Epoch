// NEGATIVE battery of the enforcement boundary — every typed error code
// of the taxonomy, by name:
//   version-unsupported, malformed-invocation, malformed-record,
//   unknown-session, session-closed, cross-tenant-denied,
//   capability-denied, budget-exceeded, invalid-invocation,
//   digest-mismatch.
import { describe, expect, it } from 'vitest';
import { sealExperienceGraph } from '@epoch/experience-protocol';
import {
  admitInvocation,
  bindRendererSession,
  closeRendererSession,
  parseRendererBinding,
  parseRendererDescriptor,
  parseRendererReceipt,
} from '../src/index';
import {
  DESKTOP_DEVICE,
  FULL_RENDERER,
  RENDERER_2D_ONLY,
  RENDERER_TIGHT_BUDGETS,
  SCOPE_A,
  SCOPE_B,
  TENANT_A,
  TENANT_B,
  boundSession,
  desktopSnapshot,
  expectFailure,
  sealedGraph,
} from './fixtures';

function mountEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'epoch.renderer-invocation',
    protocolVersion: '1.0.0',
    kind: 'mount-graph',
    invocationId: 'inv-mount-1',
    rendererSessionId: 'rs-alpha-1',
    graphDigest: 'a'.repeat(64),
    atMs: 50,
    ...overrides,
  };
}

describe('version-unsupported (envelope protocol skew)', () => {
  it('rejects a skewed envelope before any schema validation', () => {
    const failure = expectFailure(
      admitInvocation(boundSession(), mountEnvelope({ protocolVersion: '2.0.0' })),
      'version-unsupported',
    );
    expect(failure.expected).toBe('1.0.0');
    expect(failure.encountered).toBe('2.0.0');
  });

  it('rejects skewed serialized bindings and receipts', () => {
    const binding = boundSession();
    expectFailure(
      parseRendererBinding({ ...binding, protocolVersion: '0.9.0' }),
      'version-unsupported',
    );
    const graph = sealedGraph('2d');
    const admitted = admitInvocation(boundSession(), mountEnvelope({ graphDigest: graph.digest }), {
      graph,
    });
    if (!admitted.ok) throw new Error('fixture mount');
    expectFailure(
      parseRendererReceipt({ ...admitted.value.receipt, protocolVersion: '2.0.0' }),
      'version-unsupported',
    );
  });
});

describe('malformed-invocation (envelope schema + vendor fields + W011 cause)', () => {
  it('rejects a non-object envelope root', () => {
    expectFailure(admitInvocation(boundSession(), 'nope'), 'malformed-invocation');
    expectFailure(admitInvocation(boundSession(), []), 'malformed-invocation');
  });

  it('rejects vendor/engine fields on the envelope at precise paths', () => {
    const failure = expectFailure(
      admitInvocation(boundSession(), mountEnvelope({ engine: 'babylon.js' })),
      'malformed-invocation',
    );
    expect(failure.issues.some((issue) => issue.path === 'engine')).toBe(true);
  });

  it('rejects a malformed invocation id grammar', () => {
    const failure = expectFailure(
      admitInvocation(boundSession(), mountEnvelope({ invocationId: 'not an id!' })),
      'malformed-invocation',
    );
    expect(failure.issues.some((issue) => issue.path === 'invocationId')).toBe(true);
  });

  it('rejects an unknown envelope kind', () => {
    expectFailure(
      admitInvocation(boundSession(), mountEnvelope({ kind: 'render-pixels' })),
      'malformed-invocation',
    );
  });

  it('rejects a mount-graph envelope without the graph document', () => {
    const failure = expectFailure(
      admitInvocation(boundSession(), mountEnvelope()),
      'malformed-invocation',
    );
    expect(failure.issues.some((issue) => issue.path === 'graph')).toBe(true);
  });

  it('wraps a W011 admission failure as a typed cause (authority violation)', () => {
    // A W011 graph whose presentation attributes carry a kernel-reserved
    // key: the content RE-SEALS cleanly (sealing is schema-only), but W011
    // ADMISSION runs the authority scan and rejects it.
    const graph = sealedGraph('2d');
    const { digest: _stripped, ...content } = graph;
    void _stripped;
    const resealed = sealExperienceGraph({
      ...content,
      nodes: [
        {
          ...graph.nodes[0],
          attributes: { entity: { inline: 'kernel state' } },
        },
      ],
    });
    if (!resealed.ok) throw new Error('fixture resealed graph');
    const failure = expectFailure(
      admitInvocation(
        boundSession(),
        mountEnvelope({ graphDigest: resealed.value.digest }),
        { graph: resealed.value },
      ),
      'malformed-invocation',
    );
    expect(failure.cause?.code).toBe('authority-violation');
  });

  it('wraps a W011 digest-skew failure as a typed cause', () => {
    const graph = sealedGraph('2d');
    const tampered = { ...graph, digest: 'e'.repeat(64) };
    const failure = expectFailure(
      admitInvocation(boundSession(), mountEnvelope({ graphDigest: 'e'.repeat(64) }), {
        graph: tampered,
      }),
      'malformed-invocation',
    );
    expect(failure.cause?.code).toBe('digest-mismatch');
  });
});

describe('malformed-record (descriptor/binding/receipt schema)', () => {
  it('rejects engine/vendor fields on a descriptor at precise paths', () => {
    const failure = expectFailure(
      parseRendererDescriptor({ ...FULL_RENDERER, webgl: true }),
      'malformed-record',
    );
    expect(failure.issues.some((issue) => issue.path === 'webgl')).toBe(true);
  });

  it('rejects unsorted graphKinds (non-deterministic set semantics)', () => {
    const failure = expectFailure(
      parseRendererDescriptor({ ...FULL_RENDERER, graphKinds: ['3d', '2d'] }),
      'malformed-record',
    );
    expect(
      failure.issues.some((issue) => issue.message.includes('sorted ascending')),
    ).toBe(true);
  });

  it('rejects duplicate interaction modalities', () => {
    expectFailure(
      parseRendererDescriptor({ ...FULL_RENDERER, interaction: ['pointer', 'pointer'] }),
      'malformed-record',
    );
  });

  it('rejects an empty graph-kind declaration', () => {
    expectFailure(
      parseRendererDescriptor({ ...FULL_RENDERER, graphKinds: [] }),
      'malformed-record',
    );
  });

  it('rejects an out-of-bounds node budget', () => {
    expectFailure(
      parseRendererDescriptor({
        ...FULL_RENDERER,
        budgets: { ...FULL_RENDERER.budgets, maxGraphNodes: 0 },
      }),
      'malformed-record',
    );
  });

  it('rejects a binding whose effective limits drifted from the negotiation', () => {
    const binding = boundSession();
    const failure = expectFailure(
      parseRendererBinding({
        ...binding,
        effective: { ...binding.effective, maxGraphNodes: 999 },
      }),
      'malformed-record',
    );
    expect(failure.issues.some((issue) => issue.path === 'effective')).toBe(true);
  });

  it('rejects a binding with an invalid device-session id on the snapshot', () => {
    const failure = expectFailure(
      bindRendererSession({
        rendererSessionId: 'rs-alpha-1',
        renderer: FULL_RENDERER,
        device: { ...desktopSnapshot(), deviceSessionId: 'session one' },
      }),
      'malformed-record',
    );
    expect(failure.issues.some((issue) => issue.path === 'deviceSessionId')).toBe(true);
  });

  it('rejects a binding whose snapshot device descriptor carries a vendor field', () => {
    const failure = expectFailure(
      bindRendererSession({
        rendererSessionId: 'rs-alpha-1',
        renderer: FULL_RENDERER,
        device: { ...desktopSnapshot(), device: { ...DESKTOP_DEVICE, engine: 'unity' } },
      }),
      'malformed-record',
    );
    expect(failure.issues.some((issue) => issue.path === 'device.engine')).toBe(true);
  });
});

describe('unknown-session (envelope targets a foreign session)', () => {
  it('rejects an envelope addressed to another renderer session', () => {
    const failure = expectFailure(
      admitInvocation(
        boundSession(),
        mountEnvelope({ rendererSessionId: 'rs-other-9' }),
      ),
      'unknown-session',
    );
    expect(failure.expectedSessionId).toBe('rs-alpha-1');
    expect(failure.encounteredSessionId).toBe('rs-other-9');
  });
});

describe('session-closed (terminal binding)', () => {
  it('rejects invocations on a closed binding', () => {
    const closed = closeRendererSession(boundSession());
    if (!closed.ok) throw new Error('fixture close');
    const failure = expectFailure(
      admitInvocation(closed.value, mountEnvelope()),
      'session-closed',
    );
    expect(failure.rendererSessionId).toBe('rs-alpha-1');
  });

  it('rejects closing an already-closed binding', () => {
    const closed = closeRendererSession(boundSession());
    if (!closed.ok) throw new Error('fixture close');
    expectFailure(closeRendererSession(closed.value), 'session-closed');
  });
});

describe('cross-tenant-denied (R12)', () => {
  it('rejects binding a snapshot owned by another tenant', () => {
    const failure = expectFailure(
      bindRendererSession(
        {
          rendererSessionId: 'rs-alpha-1',
          renderer: FULL_RENDERER,
          device: desktopSnapshot({ tenantScope: SCOPE_A }),
        },
        { expectedTenantId: TENANT_B },
      ),
      'cross-tenant-denied',
    );
    expect(failure.expectedTenantId).toBe(TENANT_B);
    expect(failure.encounteredTenantId).toBe(TENANT_A);
  });

  it('rejects invocations when the caller tenant differs from the binding tenant', () => {
    const failure = expectFailure(
      admitInvocation(boundSession(), mountEnvelope(), { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    expect(failure.path).toEqual(['device', 'tenantScope', 'tenantId']);
  });

  it('rejects mounting a graph owned by another tenant with the boundary code', () => {
    const foreignGraph = sealedGraph('2d', { tenantScope: SCOPE_B });
    const failure = expectFailure(
      admitInvocation(boundSession(), mountEnvelope({ graphDigest: foreignGraph.digest }), {
        graph: foreignGraph,
      }),
      'cross-tenant-denied',
    );
    expect(failure.expectedTenantId).toBe(TENANT_A);
    expect(failure.encounteredTenantId).toBe(TENANT_B);
  });

  it('rejects admitting serialized bindings and receipts for another tenant', () => {
    const binding = boundSession();
    expectFailure(
      parseRendererBinding(binding, { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    const graph = sealedGraph('2d');
    const admitted = admitInvocation(boundSession(), mountEnvelope({ graphDigest: graph.digest }), {
      graph,
    });
    if (!admitted.ok) throw new Error('fixture mount');
    expectFailure(
      parseRendererReceipt(admitted.value.receipt, { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
  });
});

describe('capability-denied (the W008 permission pattern)', () => {
  it('rejects an undeclared graph kind (3d on a 2d-only renderer)', () => {
    const graph = sealedGraph('3d');
    const failure = expectFailure(
      admitInvocation(
        boundSession(RENDERER_2D_ONLY),
        mountEnvelope({ graphDigest: graph.digest }),
        { graph },
      ),
      'capability-denied',
    );
    expect(failure.path).toEqual(['graph', 'graphKind']);
    expect(failure.declared).toEqual(['2d']);
    expect(failure.encountered).toBe('3d');
  });

  it('rejects a control intent from an undeclared modality (voice on pointer-only)', () => {
    const failure = expectFailure(
      admitInvocation(
        boundSession(RENDERER_TIGHT_BUDGETS),
        {
          schema: 'epoch.renderer-invocation',
          protocolVersion: '1.0.0',
          kind: 'submit-intent',
          invocationId: 'inv-intent-1',
          rendererSessionId: 'rs-alpha-1',
          modality: 'voice',
          intent: { id: 'world.view.refresh', version: '1.0.0' },
        },
      ),
      'capability-denied',
    );
    expect(failure.path).toEqual(['modality']);
    expect(failure.declared).toEqual(['pointer']);
    expect(failure.encountered).toBe('voice');
  });

  it('rejects a modality outside the negotiated intersection (renderer-only modality)', () => {
    // FULL_RENDERER declares keyboard+pointer+voice; the desktop snapshot
    // intersects to keyboard+pointer+voice, but a headset snapshot
    // intersects to voice only — keyboard is undeclared there.
    const binding = boundSession(FULL_RENDERER, {
      snapshot: desktopSnapshot({
        device: {
          ...DESKTOP_DEVICE,
          interaction: ['voice'],
        },
      }),
    });
    expectFailure(
      admitInvocation(binding, {
        schema: 'epoch.renderer-invocation',
        protocolVersion: '1.0.0',
        kind: 'submit-intent',
        invocationId: 'inv-intent-1',
        rendererSessionId: 'rs-alpha-1',
        modality: 'keyboard',
        intent: { id: 'world.view.refresh', version: '1.0.0' },
      }),
      'capability-denied',
    );
  });
});

describe('budget-exceeded (effective limits)', () => {
  it('rejects a graph beyond the effective node budget', () => {
    const graph = sealedGraph('2d', { nodeCount: 3 });
    const failure = expectFailure(
      admitInvocation(
        boundSession(RENDERER_TIGHT_BUDGETS),
        mountEnvelope({ graphDigest: graph.digest }),
        { graph },
      ),
      'budget-exceeded',
    );
    expect(failure.resource).toBe('graph-nodes');
    expect(failure.limit).toBe(2);
    expect(failure.encountered).toBe(3);
    expect(failure.path).toEqual(['graph', 'nodes']);
  });

  it('rejects a graph beyond the effective edge budget', () => {
    const graph = sealedGraph('2d', { nodeCount: 2 });
    const { digest: _stripped, ...content } = graph;
    void _stripped;
    const resealed = sealExperienceGraph({
      ...content,
      edges: [
        { kind: 'contains', from: 'xn-fixture-000', to: 'xn-fixture-001' },
        { kind: 'follows', from: 'xn-fixture-000', to: 'xn-fixture-001' },
      ],
    });
    if (!resealed.ok) throw new Error('fixture resealed graph');
    const failure = expectFailure(
      admitInvocation(
        boundSession(RENDERER_TIGHT_BUDGETS),
        mountEnvelope({ graphDigest: resealed.value.digest }),
        { graph: resealed.value },
      ),
      'budget-exceeded',
    );
    expect(failure.resource).toBe('graph-edges');
    expect(failure.limit).toBe(1);
    expect(failure.encountered).toBe(2);
  });

  it('rejects declared triangles beyond the negotiated (device-min) limit', () => {
    const graph = sealedGraph('3d');
    // Renderer 2M, device 1M -> effective 1M; declare 1.5M.
    const failure = expectFailure(
      admitInvocation(
        boundSession(),
        mountEnvelope({
          graphDigest: graph.digest,
          declaredTriangles: 1_500_000,
        }),
        { graph },
      ),
      'budget-exceeded',
    );
    expect(failure.resource).toBe('triangles');
    expect(failure.limit).toBe(1_000_000);
    expect(failure.encountered).toBe(1_500_000);
  });

  it('rejects declared texture bytes beyond the effective limit', () => {
    const graph = sealedGraph('3d');
    const failure = expectFailure(
      admitInvocation(
        boundSession(),
        mountEnvelope({
          graphDigest: graph.digest,
          declaredTriangles: 1_000,
          declaredTextureBytes: 300_000_000,
        }),
        { graph },
      ),
      'budget-exceeded',
    );
    expect(failure.resource).toBe('texture-bytes');
    expect(failure.limit).toBe(268_435_456);
    expect(failure.encountered).toBe(300_000_000);
  });
});

describe('invalid-invocation (semantic contract violations)', () => {
  it('rejects a non-monotonic frame index (replaying a frame)', () => {
    const binding = boundSession();
    const first = admitInvocation(binding, {
      schema: 'epoch.renderer-invocation',
      protocolVersion: '1.0.0',
      kind: 'advance-frame',
      invocationId: 'inv-frame-0',
      rendererSessionId: 'rs-alpha-1',
      frameIndex: 5,
      atMs: 80,
    });
    if (!first.ok) throw new Error('fixture frame');
    const failure = expectFailure(
      admitInvocation(first.value.binding, {
        schema: 'epoch.renderer-invocation',
        protocolVersion: '1.0.0',
        kind: 'advance-frame',
        invocationId: 'inv-frame-1',
        rendererSessionId: 'rs-alpha-1',
        frameIndex: 5,
        atMs: 96,
      }),
      'invalid-invocation',
    );
    expect(failure.path).toEqual(['frameIndex']);
    expect(failure.expected).toBe('a frame index greater than 5');
    expect(failure.encountered).toBe('5');
  });

  it('rejects a frame index rewind after an executed frame', () => {
    const binding = boundSession();
    const first = admitInvocation(binding, {
      schema: 'epoch.renderer-invocation',
      protocolVersion: '1.0.0',
      kind: 'advance-frame',
      invocationId: 'inv-frame-0',
      rendererSessionId: 'rs-alpha-1',
      frameIndex: 5,
      atMs: 80,
    });
    if (!first.ok) throw new Error('fixture frame');
    expectFailure(
      admitInvocation(first.value.binding, {
        schema: 'epoch.renderer-invocation',
        protocolVersion: '1.0.0',
        kind: 'advance-frame',
        invocationId: 'inv-frame-1',
        rendererSessionId: 'rs-alpha-1',
        frameIndex: 0,
        atMs: 96,
      }),
      'invalid-invocation',
    );
  });

  it('rejects a missing declared triangle usage on a bounded binding', () => {
    const graph = sealedGraph('3d');
    const failure = expectFailure(
      admitInvocation(boundSession(), mountEnvelope({ graphDigest: graph.digest }), { graph }),
      'invalid-invocation',
    );
    expect(failure.path).toEqual(['declaredTriangles']);
    expect(failure.encountered).toBe('absent');
  });

  it('rejects a missing declared texture usage on a bounded binding', () => {
    const graph = sealedGraph('3d');
    const failure = expectFailure(
      admitInvocation(
        boundSession(),
        mountEnvelope({ graphDigest: graph.digest, declaredTriangles: 10 }),
        { graph },
      ),
      'invalid-invocation',
    );
    expect(failure.path).toEqual(['declaredTextureBytes']);
  });
});

describe('digest-mismatch (tamper detection)', () => {
  it('rejects a mount envelope claiming a foreign graph digest', () => {
    const graph = sealedGraph('2d');
    const failure = expectFailure(
      admitInvocation(boundSession(), mountEnvelope({ graphDigest: 'b'.repeat(64) }), { graph }),
      'digest-mismatch',
    );
    expect(failure.path).toEqual(['graphDigest']);
    expect(failure.expected).toBe('b'.repeat(64));
    expect(failure.encountered).toBe(graph.digest);
  });

  it('rejects a serialized binding whose claimed digest does not match its content', () => {
    const binding = boundSession();
    const failure = expectFailure(
      parseRendererBinding({ ...binding, digest: '0'.repeat(64) }),
      'digest-mismatch',
    );
    expect(failure.path).toEqual(['digest']);
    expect(failure.encountered).toBe('0'.repeat(64));
  });

  it('rejects a serialized receipt whose claimed digest does not match its content', () => {
    const graph = sealedGraph('2d');
    const admitted = admitInvocation(boundSession(), mountEnvelope({ graphDigest: graph.digest }), {
      graph,
    });
    if (!admitted.ok) throw new Error('fixture mount');
    const receipt = admitted.value.receipt;
    expectFailure(
      parseRendererReceipt({
        ...receipt,
        nodeCount: 999,
      }),
      'digest-mismatch',
    );
  });
});
