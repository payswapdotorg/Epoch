/**
 * W056 fabric contract — positive battery: the fabric document schemas
 * admit their intended shapes, the consistency refinements hold, sealing
 * is deterministic, and every lifecycle transition rule is as documented.
 */
import { describe, expect, it } from 'vitest';
import {
  RendererAssetBindingContentSchema,
  RendererCapabilitySetSchema,
  RendererConformanceResultContentSchema,
  RendererFailureSchema,
  RendererFrameEnvelopeSchema,
  RendererHealthSchema,
  RendererInputEnvelopeSchema,
  RendererIntentReceiptContentSchema,
  RendererSessionContentSchema,
  RendererSessionSchema,
  RendererSessionSnapshotContentSchema,
  RendererSwitchReceiptContentSchema,
  RendererSwitchRequestSchema,
  WorldProjectionRefSchema,
  PortableViewStateSchema,
  canTransitionRendererSession,
  captureSessionSnapshotContent,
  captureSwitchReceiptContent,
  createRendererSessionContent,
  sealRendererSession,
  sealRendererSessionSnapshot,
  sealRendererSwitchReceipt,
  sealRendererAssetBinding,
  sealRendererConformanceResult,
  sealRendererIntentReceipt,
  RENDERER_SESSION_TRANSITIONS,
  healthyAt,
  emptyPortableViewState,
} from '../src/index';
import { canonicalDigest as agentCanonicalDigest } from '@epoch/agent-protocol';
import {
  FABRIC_SESSION,
  FULL_CAPABILITIES,
  REDUCED_CAPABILITIES,
  WORLD_PROJECTION,
  assetBindingContent,
  conformanceResultContent,
  fabricSession,
  frameEnvelope,
  intentReceiptContent,
  pointerInput,
  portableViewState,
  sessionSnapshotContent,
  switchReceiptContent,
  switchRequest,
} from './fixtures';

describe('W056 fabric contract — positive', () => {
  it('admits a valid capability set with full capabilities', () => {
    expect(RendererCapabilitySetSchema.parse(FULL_CAPABILITIES)).toEqual(FULL_CAPABILITIES);
  });

  it('admits a valid reduced capability set (no camera restore, no measurement)', () => {
    expect(RendererCapabilitySetSchema.parse(REDUCED_CAPABILITIES)).toEqual(REDUCED_CAPABILITIES);
  });

  it('admits the portable view state (camera, focus, layers, timeline, hidden)', () => {
    const state = portableViewState();
    expect(PortableViewStateSchema.parse(state)).toEqual(state);
  });

  it('emptyPortableViewState builds the paused-at-zero initial state', () => {
    const empty = emptyPortableViewState(0);
    expect(PortableViewStateSchema.parse(empty)).toEqual(empty);
    expect(empty.focusedEntityIds).toEqual([]);
    expect(empty.timelinePosition.paused).toBe(true);
  });

  it('admits the world projection reference', () => {
    expect(WorldProjectionRefSchema.parse(WORLD_PROJECTION)).toEqual(WORLD_PROJECTION);
  });

  it('admits healthy and degraded health projections', () => {
    expect(RendererHealthSchema.parse(healthyAt(1_000))).toEqual(healthyAt(1_000));
    expect(
      RendererHealthSchema.parse({
        state: 'degraded',
        degradation: 'reduced-fidelity',
        lastFailureCode: 'degraded',
        detail: 'budget pressure',
        atMs: 2_000,
      }),
    ).toBeTruthy();
  });

  it('creates the initial session content (derived rs- id, created state, healthy)', () => {
    const created = createRendererSessionContent({
      fabricSessionId: FABRIC_SESSION,
      capabilityId: 'epoch.renderer.fixture-a',
      binding: fabricSession().binding,
      capabilities: FULL_CAPABILITIES,
      worldProjection: WORLD_PROJECTION,
      viewState: portableViewState(),
      createdAtMs: 0,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.state).toBe('created');
    expect(created.value.rendererSessionId).toBe('rs-alpha-1');
    expect(created.value.invocationCount).toBe(0);
    expect(created.value.health.state).toBe('healthy');
    expect(RendererSessionContentSchema.parse(created.value)).toEqual(created.value);
  });

  it('seals the session content deterministically (digest over canonical JSON)', () => {
    const content = fabricSession();
    const sealed = sealRendererSession(content);
    expect(sealed.digest).toBe(agentCanonicalDigest(content));
    expect(RendererSessionSchema.parse(sealed)).toEqual(sealed);
    // Deterministic: sealing twice yields identical bytes.
    expect(sealRendererSession(content)).toEqual(sealed);
  });

  it('admits a mounted active session and a disposed session', () => {
    const mounted = {
      ...fabricSession(),
      state: 'active' as const,
      mountedWorldDigest: WORLD_PROJECTION.worldDigest,
      mountedAtMs: 500,
      invocationCount: 4,
      lastFrameIndex: 2,
    };
    expect(RendererSessionContentSchema.parse(mounted)).toEqual(mounted);
    const disposed = {
      ...mounted,
      state: 'disposed' as const,
      mountedWorldDigest: undefined,
      mountedAtMs: undefined,
    };
    expect(RendererSessionContentSchema.parse(disposed)).toEqual(disposed);
  });

  it('session lifecycle transitions follow the documented table', () => {
    expect(canTransitionRendererSession('created', 'active')).toBe(true);
    expect(canTransitionRendererSession('created', 'disposed')).toBe(true);
    expect(canTransitionRendererSession('created', 'degraded')).toBe(false);
    expect(canTransitionRendererSession('active', 'degraded')).toBe(true);
    expect(canTransitionRendererSession('active', 'suspended')).toBe(true);
    expect(canTransitionRendererSession('suspended', 'active')).toBe(true);
    expect(canTransitionRendererSession('degraded', 'active')).toBe(true);
    expect(canTransitionRendererSession('disposed', 'active')).toBe(false);
    expect(RENDERER_SESSION_TRANSITIONS.disposed).toEqual([]);
  });

  it('captures and seals the portable session snapshot deterministically', () => {
    const content = sessionSnapshotContent();
    const sealed = sealRendererSessionSnapshot(content);
    expect(sealed.digest).toBe(agentCanonicalDigest(content));
    expect(sealRendererSessionSnapshot(content)).toEqual(sealed);
    expect(RendererSessionSnapshotContentSchema.parse(content)).toEqual(content);
  });

  it('captureSessionSnapshotContent builds the documented snapshot content', () => {
    const captured = captureSessionSnapshotContent({
      fabricSessionId: 'fx-alpha-1',
      capturedFromRendererId: 'rr-general-1',
      worldProjection: WORLD_PROJECTION,
      viewState: portableViewState(),
      invocationCount: 3,
      switchCount: 1,
      capturedAtMs: 4_000,
    });
    expect(captured.ok).toBe(true);
    if (captured.ok) {
      expect(captured.value.switchCount).toBe(1);
      expect(captured.value.capturedFromRendererId).toBe('rr-general-1');
    }
  });

  it('admits a valid switch request (primary target, fallbacks, continuity claims)', () => {
    const request = switchRequest();
    expect(RendererSwitchRequestSchema.parse(request)).toEqual(request);
  });

  it('captures and seals the switch receipt deterministically', () => {
    const content = switchReceiptContent();
    const sealed = sealRendererSwitchReceipt(content);
    expect(sealed.digest).toBe(agentCanonicalDigest(content));
    expect(sealRendererSwitchReceipt(content)).toEqual(sealed);
    expect(RendererSwitchReceiptContentSchema.parse(content)).toEqual(content);
  });

  it('admits a switch receipt with fallback applied and sorted restored fields', () => {
    const content = switchReceiptContent({
      fallbackApplied: true,
      toRendererId: 'rr-fallback-1',
      restoredViewFields: ['focused-entities', 'timeline-position'],
    });
    expect(RendererSwitchReceiptContentSchema.parse(content)).toEqual(content);
  });

  it('admits the frame envelope (monotonic index, typed fidelity, admission link)', () => {
    const frame = frameEnvelope();
    expect(RendererFrameEnvelopeSchema.parse(frame)).toEqual(frame);
    expect(
      RendererFrameEnvelopeSchema.parse(frameEnvelope({ degradation: 'wireframe' })).degradation,
    ).toBe('wireframe');
  });

  it('admits pointer, key, and wheel input envelopes', () => {
    expect(RendererInputEnvelopeSchema.parse(pointerInput())).toBeTruthy();
    expect(
      RendererInputEnvelopeSchema.parse({
        schema: 'epoch.renderer-input-envelope',
        fabricProtocolVersion: '1.0.0',
        inputId: 'rin-fixture-2',
        fabricSessionId: 'fx-alpha-1',
        atMs: 1_300,
        modality: 'keyboard',
        inputKind: 'key-down',
        key: { key: 'escape', modifiers: [] },
      }),
    ).toBeTruthy();
    expect(
      RendererInputEnvelopeSchema.parse({
        schema: 'epoch.renderer-input-envelope',
        fabricProtocolVersion: '1.0.0',
        inputId: 'rin-fixture-3',
        fabricSessionId: 'fx-alpha-1',
        atMs: 1_400,
        modality: 'pointer',
        inputKind: 'wheel',
        delta: { x: 0, y: -120 },
      }),
    ).toBeTruthy();
  });

  it('admits and seals normalized, no-target, and rejected intent receipts', () => {
    const normalized = intentReceiptContent();
    expect(RendererIntentReceiptContentSchema.parse(normalized)).toEqual(normalized);
    expect(sealRendererIntentReceipt(normalized).digest).toBe(agentCanonicalDigest(normalized));

    const noTarget = intentReceiptContent({
      inputId: 'rin-fixture-4',
      hitEntityId: undefined,
      intent: undefined,
      intentPayloadDigest: undefined,
      admissionDigest: undefined,
      outcome: 'no-target',
    });
    expect(RendererIntentReceiptContentSchema.parse(noTarget)).toEqual(noTarget);

    const rejected = intentReceiptContent({
      inputId: 'rin-fixture-5',
      hitEntityId: undefined,
      intent: undefined,
      intentPayloadDigest: undefined,
      admissionDigest: undefined,
      outcome: 'rejected',
      rejectionDetail: 'pointer over non-interactive overlay',
    });
    expect(RendererIntentReceiptContentSchema.parse(rejected)).toEqual(rejected);
  });

  it('admits and seals validated and untrusted asset bindings', () => {
    const validated = assetBindingContent();
    expect(RendererAssetBindingContentSchema.parse(validated)).toEqual(validated);
    expect(sealRendererAssetBinding(validated).digest).toBe(agentCanonicalDigest(validated));

    const untrusted = assetBindingContent({
      trustState: 'untrusted',
      validatedAtMs: undefined,
    });
    expect(RendererAssetBindingContentSchema.parse(untrusted)).toEqual(untrusted);
  });

  it('admits and seals the conformance result (full check coverage, pass verdict)', () => {
    const content = conformanceResultContent();
    expect(RendererConformanceResultContentSchema.parse(content)).toEqual(content);
    const sealed = sealRendererConformanceResult(content);
    expect(sealed.digest).toBe(agentCanonicalDigest(content));
    expect(sealRendererConformanceResult(content)).toEqual(sealed);
  });

  it('the fabric failure taxonomy admits every documented variant', () => {
    const samples = [
      { code: 'adapter-unavailable', message: 'm', rendererId: 'rr-x', reason: 'retired' },
      { code: 'asset-rejected', message: 'm', assetDigest: 'a'.repeat(64), reason: 'untrusted' },
      {
        code: 'cross-tenant-denied',
        message: 'm',
        expectedTenantId: 'tenant-a',
        encounteredTenantId: 'tenant-b',
      },
      { code: 'degraded', message: 'm', degradation: 'wireframe', reason: 'budget' },
      {
        code: 'fallback-applied',
        message: 'm',
        fromRendererId: 'rr-a',
        toRendererId: 'rr-b',
        trigger: { code: 'probe-rejected', message: 'm' },
      },
      { code: 'input-unsupported', message: 'm', inputKind: 'wheel', reason: 'no mapping' },
      {
        code: 'invalid-fabric-record',
        message: 'm',
        issues: [{ path: '$', message: 'invalid' }],
      },
      { code: 'mount-failed', message: 'm', worldDigest: 'a'.repeat(64) },
      { code: 'probe-rejected', message: 'm', rendererId: 'rr-x', reason: 'incompatible' },
      { code: 'session-disposed', message: 'm', fabricSessionId: 'fx-x' },
      { code: 'session-failed', message: 'm', fabricSessionId: 'fx-x' },
      {
        code: 'switch-aborted',
        message: 'm',
        stage: 'mount',
        retainedFabricSessionId: 'fx-x',
        trigger: { code: 'mount-failed', message: 'm' },
      },
      {
        code: 'switch-incompatible',
        message: 'm',
        field: 'world-digest',
        expected: 'a'.repeat(64),
        encountered: 'b'.repeat(64),
      },
      { code: 'unknown-session', message: 'm', encounteredFabricSessionId: 'fx-x' },
    ];
    for (const sample of samples) {
      expect(RendererFailureSchema.parse(sample)).toEqual(sample);
    }
  });

  it('switch receipt content builds sort restored fields deterministically', () => {
    const captured = captureSwitchReceiptContent({
      switchId: 'sw-fixture-1',
      fromRendererId: 'rr-general-1',
      toRendererId: 'rr-2d-passive',
      fromFabricSessionId: 'fx-alpha-1',
      toFabricSessionId: 'fx-beta-1',
      tenantScope: WORLD_PROJECTION.tenantScope,
      worldDigest: WORLD_PROJECTION.worldDigest,
      sourceSnapshotDigest: 'b'.repeat(64),
      mountedProjectionDigest: WORLD_PROJECTION.worldDigest,
      restoredViewFields: ['timeline-position', 'focused-entities'],
      restoredViewState: portableViewState(),
      fallbackApplied: false,
      atMs: 5_000,
    });
    expect(captured.ok).toBe(true);
    if (captured.ok) {
      expect(captured.value.restoredViewFields).toEqual(['focused-entities', 'timeline-position']);
    }
  });
});
