// Boundary battery: tier boundaries across the selection reasons,
// stereoscopic negotiation boundaries, remote-assist thresholds, and
// catalog-coverage boundaries.
import { describe, expect, it } from 'vitest';
import { bindRendererSession, deviceSessionSnapshotOf } from '@epoch/renderer-runtime';
import { descriptorFromProfile, TIER_BUDGET_FLOORS } from '@epoch/device-capabilities';
import { selectRendererAdapter, techniqueHostsKinds, hasSpatialKinds } from '../src/index';
import {
  boundSession,
  desktopDevice,
  headsetDevice,
  assess,
  FULL_RENDERER,
  STEREO_RENDERER,
  FLAT_RENDERER,
  TENANT_A,
} from './fixtures';

/** Bind a session with an explicit device (throws on failure). */
function boundWith(renderer: typeof FULL_RENDERER, device: unknown, sessionId: string) {
  const bound = bindRendererSession({
    rendererSessionId: sessionId,
    renderer,
    device: deviceSessionSnapshotOf({
      deviceSessionId: `ds-boundary-${sessionId}`,
      tenantScope: { tenantId: TENANT_A },
      device,
    }),
    boundAtMs: 0,
  });
  if (!bound.ok) throw new Error(bound.error.message);
  return bound.value;
}

describe('tier boundary reasons', () => {
  it('a field-tier device with spatial kinds still selects local retained 3D', () => {
    // The phone profile derives the field tier (class ceiling).
    const phone = descriptorFromProfile('phone');
    if (!phone.ok) throw new Error('fixture failed');
    const binding = boundWith(FULL_RENDERER, phone.value, 'rs-tier-field');
    const assessment = assess(phone.value, 'dca-tier-field');
    expect(assessment.tier).toBe('field');
    const selection = selectRendererAdapter({
      selectionId: 'ras-tier-field',
      binding,
      assessment,
    });
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      expect(selection.value.technique).toBe('retained-scene-3d');
      expect(selection.value.reason).toBe('spatial-kinds-local');
    }
  });

  it('the reduced tier flips the reason to the degraded path at the tier boundary', () => {
    // Exactly at the reduced floors: tier 'reduced' (inclusive floors).
    const atReducedFloor = {
      descriptorVersion: 1 as const,
      deviceClass: 'phone' as const,
      interaction: ['touch' as const],
      display: { stereoscopic: false, maxPixels: TIER_BUDGET_FLOORS.reduced.minPixels, refreshHz: 60, colorDepthBits: 24 },
      spatial: {
        poseTracking: 'none' as const,
        worldAnchored: false,
        maxTriangles: TIER_BUDGET_FLOORS.reduced.minTriangles,
        maxTextureBytes: TIER_BUDGET_FLOORS.reduced.minTextureBytes,
      },
    };
    const binding = boundWith(FULL_RENDERER, atReducedFloor, 'rs-tier-reduced');
    const assessment = assess(atReducedFloor, 'dca-tier-reduced');
    expect(assessment.tier).toBe('reduced');
    const selection = selectRendererAdapter({
      selectionId: 'ras-tier-reduced',
      binding,
      assessment,
    });
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      expect(selection.value.technique).toBe('retained-scene-3d');
      expect(selection.value.reason).toBe('spatial-kinds-local-degraded');
    }
  });

  it('one below the reduced floor flips the technique to the remote path', () => {
    const belowFloor = {
      descriptorVersion: 1 as const,
      deviceClass: 'phone' as const,
      interaction: ['touch' as const],
      display: { stereoscopic: false, maxPixels: TIER_BUDGET_FLOORS.reduced.minPixels - 1, refreshHz: 60, colorDepthBits: 24 },
      spatial: {
        poseTracking: 'none' as const,
        worldAnchored: false,
        maxTriangles: TIER_BUDGET_FLOORS.reduced.minTriangles,
        maxTextureBytes: TIER_BUDGET_FLOORS.reduced.minTextureBytes,
      },
    };
    const binding = boundWith(FULL_RENDERER, belowFloor, 'rs-tier-remote');
    const assessment = assess(belowFloor, 'dca-tier-remote');
    expect(assessment.derivation.remoteAssistRecommended).toBe(true);
    const selection = selectRendererAdapter({
      selectionId: 'ras-tier-remote',
      binding,
      assessment,
    });
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      expect(selection.value.technique).toBe('remote-stream');
      expect(selection.value.reason).toBe('remote-assist-recommended');
    }
  });

  it('eligibility outranks the advisory remote recommendation (precedence order)', () => {
    // A stereo headset whose budgets cannot host even the reduced local
    // path: the remote recommendation is ADVISORY, but the mono remote
    // technique is ineligible on a negotiated stereoscopic binding — the
    // precedence falls through to the stereoscopic compositor.
    const lowBudgetHeadset = {
      ...headsetDevice(),
      display: { ...headsetDevice().display, maxPixels: 40_000 },
      spatial: { ...headsetDevice().spatial, maxTriangles: 500 },
    };
    const binding = boundWith(STEREO_RENDERER, lowBudgetHeadset, 'rs-tier-remote-stereo');
    const assessment = assess(lowBudgetHeadset, 'dca-tier-remote-stereo');
    expect(assessment.derivation.remoteAssistRecommended).toBe(true);
    expect(binding.effective.stereoscopic).toBe(true);
    const selection = selectRendererAdapter({
      selectionId: 'ras-tier-remote-stereo',
      binding,
      assessment,
    });
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      // The trace records the remote technique as stereo-ineligible.
      const remoteEntry = selection.value.trace.find((e) => e.technique === 'remote-stream');
      expect(remoteEntry?.eligible).toBe(false);
      expect(remoteEntry?.reason).toBe('stereoscopic-unsupported');
      expect(selection.value.technique).toBe('stereoscopic-compositor');
      expect(selection.value.reason).toBe('stereoscopic-negotiated');
    }
  });
});

describe('stereoscopic negotiation boundaries', () => {
  it('a stereo renderer on a mono device does NOT negotiate stereo', () => {
    // Device display.stereoscopic false -> effective stereoscopic false
    // (renderer AND device) — the mono retained technique is selected.
    const binding = boundWith(STEREO_RENDERER, desktopDevice(), 'rs-stereo-mono');
    const assessment = assess(desktopDevice(), 'dca-stereo-mono');
    expect(binding.effective.stereoscopic).toBe(false);
    const selection = selectRendererAdapter({
      selectionId: 'ras-stereo-mono',
      binding,
      assessment,
    });
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      expect(selection.value.technique).toBe('retained-scene-3d');
      expect(selection.value.reason).toBe('spatial-kinds-local');
    }
  });

  it('a mono renderer on a stereo device does NOT negotiate stereo', () => {
    const binding = boundWith(FULL_RENDERER, headsetDevice(), 'rs-mono-stereo');
    const assessment = assess(headsetDevice(), 'dca-mono-stereo');
    expect(binding.effective.stereoscopic).toBe(false);
    const selection = selectRendererAdapter({
      selectionId: 'ras-mono-stereo',
      binding,
      assessment,
    });
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      expect(selection.value.technique).toBe('retained-scene-3d');
    }
  });

  it('stereo AND stereo negotiates stereo (both sides required)', () => {
    const binding = boundWith(STEREO_RENDERER, headsetDevice(), 'rs-stereo-both');
    const assessment = assess(headsetDevice(), 'dca-stereo-both');
    expect(binding.effective.stereoscopic).toBe(true);
    const selection = selectRendererAdapter({
      selectionId: 'ras-stereo-both',
      binding,
      assessment,
    });
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      expect(selection.value.technique).toBe('stereoscopic-compositor');
    }
  });
});

describe('kind-coverage boundaries', () => {
  it('the flat techniques do not host spatial kinds (the coverage boundary)', () => {
    expect(techniqueHostsKinds('immediate-2d', ['2d'])).toBe(true);
    expect(techniqueHostsKinds('immediate-2d', ['2d', '3d'])).toBe(false);
    expect(techniqueHostsKinds('immediate-2d', ['animation'])).toBe(false);
    expect(techniqueHostsKinds('retained-scene-3d', ['3d', 'animation'])).toBe(true);
    expect(techniqueHostsKinds('remote-stream', ['2d', '3d', 'animation'])).toBe(true);
    expect(techniqueHostsKinds('stereoscopic-compositor', ['presence'])).toBe(true);
  });

  it('hasSpatialKinds is exactly the 3d/animation boundary', () => {
    expect(hasSpatialKinds(['2d'])).toBe(false);
    expect(hasSpatialKinds(['3d'])).toBe(true);
    expect(hasSpatialKinds(['animation'])).toBe(true);
    expect(hasSpatialKinds(['2d', 'controls'])).toBe(false);
    expect(hasSpatialKinds(['controls', '3d'])).toBe(true);
  });

  it('a flat binding with spatial-free kinds selects the flat path even on a headset', () => {
    const binding = boundWith(FLAT_RENDERER, headsetDevice(), 'rs-flat-headset');
    const assessment = assess(headsetDevice(), 'dca-flat-headset');
    // FLAT_RENDERER is mono: no stereo negotiation.
    expect(binding.effective.stereoscopic).toBe(false);
    const selection = selectRendererAdapter({
      selectionId: 'ras-flat-headset',
      binding,
      assessment,
    });
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      expect(selection.value.technique).toBe('immediate-2d');
      expect(selection.value.reason).toBe('flat-kinds');
    }
  });
});

describe('remote-stream eligibility boundaries', () => {
  it('the remote technique is an eligible fallback on mono bindings', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-remote-eligible');
    const selection = selectRendererAdapter({
      selectionId: 'ras-remote-eligible',
      binding,
      assessment,
    });
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      const remoteEntry = selection.value.trace.find((e) => e.technique === 'remote-stream');
      expect(remoteEntry?.eligible).toBe(true);
      expect(remoteEntry?.reason).toBe('not-preferred');
    }
  });

  it('the remote technique is INELIGIBLE on stereo bindings (mono output only)', () => {
    const binding = boundWith(STEREO_RENDERER, headsetDevice(), 'rs-remote-stereo');
    const assessment = assess(headsetDevice(), 'dca-remote-stereo');
    const selection = selectRendererAdapter({
      selectionId: 'ras-remote-stereo',
      binding,
      assessment,
    });
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      const remoteEntry = selection.value.trace.find((e) => e.technique === 'remote-stream');
      expect(remoteEntry?.eligible).toBe(false);
      expect(remoteEntry?.reason).toBe('stereoscopic-unsupported');
    }
  });
});
