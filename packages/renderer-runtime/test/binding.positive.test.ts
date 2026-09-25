// Positive battery: descriptor admission, binding negotiation (effective
// limits), binding close, seal/verify round-trips, and total admission of
// serialized bindings and receipts.
import { describe, expect, it } from 'vitest';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  bindRendererSession,
  closeRendererSession,
  computeEffectiveLimits,
  computeRendererBindingDigest,
  parseRendererBinding,
  parseRendererDescriptor,
  parseRendererReceipt,
  sealRendererBinding,
  serializeRendererBinding,
  admitInvocation,
  serializeRendererReceipt,
  type RendererBinding,
} from '../src/index';
import {
  DESKTOP_DEVICE,
  FULL_RENDERER,
  HEADSET_DEVICE,
  RENDERER_2D_ONLY,
  RENDERER_TIGHT_BUDGETS,
  SCOPE_B,
  TENANT_A,
  boundSession,
  desktopSnapshot,
  sealedGraph,
} from './fixtures';

describe('renderer descriptor admission (positive)', () => {
  it('admits a canonical full-featured descriptor', () => {
    const parsed = parseRendererDescriptor(FULL_RENDERER);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.graphKinds).toHaveLength(7);
    expect(parsed.value.interaction).toEqual(['keyboard', 'pointer', 'voice']);
  });

  it('admits a passive 2D-only descriptor (no modalities, no optional budgets)', () => {
    const parsed = parseRendererDescriptor(RENDERER_2D_ONLY);
    expect(parsed.ok).toBe(true);
  });
});

describe('effective-limit negotiation (positive)', () => {
  it('negotiates the intersection of renderer and device capabilities', () => {
    const effective = computeEffectiveLimits(FULL_RENDERER, desktopSnapshot());
    expect(effective.graphKinds).toEqual(FULL_RENDERER.graphKinds);
    expect(effective.interaction).toEqual(['keyboard', 'pointer', 'voice']);
    expect(effective.stereoscopic).toBe(false); // renderer yes, device no
    expect(effective.maxGraphNodes).toBe(4_096);
    expect(effective.maxGraphEdges).toBe(8_192);
    // min(renderer 2M, device 1M)
    expect(effective.maxTriangles).toBe(1_000_000);
    // min(renderer 512MiB, device 256MiB)
    expect(effective.maxTextureBytes).toBe(268_435_456);
  });

  it('negotiates a stereoscopic binding on a headset snapshot', () => {
    const effective = computeEffectiveLimits(
      FULL_RENDERER,
      desktopSnapshot({ device: HEADSET_DEVICE }),
    );
    expect(effective.stereoscopic).toBe(true);
    // modalities: renderer {keyboard,pointer,voice} ∩ device {gesture,voice}
    expect(effective.interaction).toEqual(['voice']);
  });

  it('omits limits no bound source declares', () => {
    const effective = computeEffectiveLimits(RENDERER_2D_ONLY, {
      deviceSessionId: 'ds-alpha-1',
      tenantScope: { tenantId: 'tenant-alpha' },
      device: {
        ...DESKTOP_DEVICE,
        spatial: { poseTracking: 'none', worldAnchored: false },
      },
    });
    expect(effective.maxTriangles).toBeUndefined();
    expect(effective.maxTextureBytes).toBeUndefined();
  });
});

describe('binding lifecycle (positive)', () => {
  it('binds an open, sealed session embedding descriptor and snapshot', () => {
    const bound = bindRendererSession({
      rendererSessionId: 'rs-alpha-1',
      renderer: FULL_RENDERER,
      device: desktopSnapshot(),
      boundAtMs: 100,
    });
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    const binding = bound.value;
    expect(binding.state).toBe('open');
    expect(binding.invocationCount).toBe(0);
    expect(binding.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(binding.renderer.rendererId).toBe('rr-general-1');
    expect(binding.device.deviceSessionId).toBe('ds-alpha-1');
    expect(binding.boundAtMs).toBe(100);
  });

  it('closes an open binding (terminal) and reseals the record', () => {
    const binding = boundSession();
    const closed = closeRendererSession(binding);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.value.state).toBe('closed');
    expect(closed.value.digest).not.toBe(binding.digest);
    expect(binding.state).toBe('open'); // input record unchanged (purity)
  });

  it('honors the expected tenant gate on the owning tenant', () => {
    const bound = bindRendererSession(
      {
        rendererSessionId: 'rs-alpha-1',
        renderer: FULL_RENDERER,
        device: desktopSnapshot(),
      },
      { expectedTenantId: TENANT_A },
    );
    expect(bound.ok).toBe(true);
  });
});

describe('seal / verify / parse round-trips (positive)', () => {
  it('serializes and re-admits a binding byte-identically', () => {
    const binding = boundSession();
    const serialized = serializeRendererBinding(binding);
    const parsed = parseRendererBinding(JSON.parse(serialized));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(serializeRendererBinding(parsed.value)).toBe(serialized);
    expect(parsed.value.digest).toBe(binding.digest);
  });

  it('the binding digest equals the canonical SHA-256 of the content', () => {
    const binding = boundSession();
    const { digest, ...content } = binding;
    expect(computeRendererBindingDigest(content)).toBe(digest);
    expect(digest).toBe(canonicalDigest(content as unknown as JsonValue));
  });

  it('sealRendererBinding admits valid content', () => {
    const binding = boundSession();
    const { digest: _stripped, ...content } = binding;
    void _stripped;
    const sealed = sealRendererBinding(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.value.digest).toBe(binding.digest);
  });

  it('round-trips a mount receipt end-to-end', () => {
    const graph = sealedGraph('2d');
    const binding = boundSession();
    const admitted = admitInvocation(
      binding,
      {
        schema: 'epoch.renderer-invocation',
        protocolVersion: '1.0.0',
        kind: 'mount-graph',
        invocationId: 'inv-mount-1',
        rendererSessionId: 'rs-alpha-1',
        graphDigest: graph.digest,
        atMs: 50,
      },
      { graph },
    );
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const serialized = serializeRendererReceipt(admitted.value.receipt);
    const parsed = parseRendererReceipt(JSON.parse(serialized), { expectedTenantId: TENANT_A });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.kind).toBe('mount-receipt');
    if (parsed.value.kind !== 'mount-receipt') return;
    expect(parsed.value.graphDigest).toBe(graph.digest);
  });

  it('re-admits a binding with the expected tenant gate', () => {
    const binding: RendererBinding = boundSession(RENDERER_TIGHT_BUDGETS, {
      snapshot: desktopSnapshot({ tenantScope: SCOPE_B }),
    });
    const parsed = parseRendererBinding(binding, { expectedTenantId: 'tenant-beta' });
    expect(parsed.ok).toBe(true);
  });
});
