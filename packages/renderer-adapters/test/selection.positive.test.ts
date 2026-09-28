// Positive battery: deterministic technique selection over the frozen
// device-adaptation table — full traces, fallback chains, and the
// integrity gates.
import { describe, expect, it } from 'vitest';
import {
  selectRendererAdapter,
  RENDERER_TECHNIQUE_CATALOG,
  parseRendererAdapterSelection,
  verifySelectionDigest,
} from '../src/index';
import {
  boundSession,
  desktopDevice,
  headsetDevice,
  REDUCED_TIER_DEVICE,
  REMOTE_ASSIST_DEVICE,
  assess,
  FULL_RENDERER,
  STEREO_RENDERER,
  FLAT_RENDERER,
  TENANT_A,
  expectFailure,
} from './fixtures';

function select(input: {
  readonly selectionId: unknown;
  readonly binding: unknown;
  readonly assessment: unknown;
}) {
  const result = selectRendererAdapter(input);
  if (!result.ok) {
    throw new Error(`fixture selection failed: ${result.error.message}`);
  }
  return result.value;
}

describe('adapter selection (positive)', () => {
  it('a full-tier desktop with spatial kinds selects the local retained technique', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-sel-desktop');
    const selection = select({ selectionId: 'ras-desktop', binding, assessment });
    expect(selection.technique).toBe('retained-scene-3d');
    expect(selection.reason).toBe('spatial-kinds-local');
    expect(selection.tenantScope).toEqual(binding.device.tenantScope);
    expect(selection.rendererSessionId).toBe(binding.rendererSessionId);
    expect(selection.bindingDigest).toBe(binding.digest);
    expect(selection.assessmentDigest).toBe(assessment.digest);
  });

  it('a negotiated stereoscopic binding selects the stereoscopic compositor', () => {
    const binding = boundSession(STEREO_RENDERER, { device: headsetDevice() });
    const assessment = assess(headsetDevice(), 'dca-sel-headset');
    const selection = select({ selectionId: 'ras-headset', binding, assessment });
    expect(binding.effective.stereoscopic).toBe(true);
    expect(selection.technique).toBe('stereoscopic-compositor');
    expect(selection.reason).toBe('stereoscopic-negotiated');
  });

  it('a flat binding selects the immediate 2D technique', () => {
    const binding = boundSession(FLAT_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-sel-flat');
    const selection = select({ selectionId: 'ras-flat', binding, assessment });
    expect(selection.technique).toBe('immediate-2d');
    expect(selection.reason).toBe('flat-kinds');
  });

  it('a reduced-tier device with spatial kinds selects degraded local 3D (the frozen 2D/reduced row)', () => {
    const binding = boundSession(FULL_RENDERER, { device: REDUCED_TIER_DEVICE });
    const assessment = assess(REDUCED_TIER_DEVICE, 'dca-sel-reduced');
    expect(assessment.tier).toBe('reduced');
    const selection = select({ selectionId: 'ras-reduced', binding, assessment });
    expect(selection.technique).toBe('retained-scene-3d');
    expect(selection.reason).toBe('spatial-kinds-local-degraded');
  });

  it('a remote-assist-recommended device selects the optional remote path', () => {
    const binding = boundSession(FULL_RENDERER, { device: REMOTE_ASSIST_DEVICE });
    const assessment = assess(REMOTE_ASSIST_DEVICE, 'dca-sel-remote');
    expect(assessment.derivation.remoteAssistRecommended).toBe(true);
    const selection = select({ selectionId: 'ras-remote', binding, assessment });
    expect(selection.technique).toBe('remote-stream');
    expect(selection.reason).toBe('remote-assist-recommended');
  });

  it('the decision trace covers every technique in canonical order with typed verdicts', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-sel-trace');
    const selection = select({ selectionId: 'ras-trace', binding, assessment });
    expect(selection.trace.map((entry) => entry.technique)).toEqual([
      'immediate-2d',
      'remote-stream',
      'retained-scene-3d',
      'stereoscopic-compositor',
    ]);
    // The flat technique does not host the spatial kinds.
    expect(selection.trace.find((e) => e.technique === 'immediate-2d')).toEqual({
      technique: 'immediate-2d',
      eligible: false,
      reason: 'kind-not-hosted',
    });
    // The compositor is eligible but unmatched (mono binding) — never a
    // silent upgrade.
    expect(selection.trace.find((e) => e.technique === 'stereoscopic-compositor')).toEqual({
      technique: 'stereoscopic-compositor',
      eligible: true,
      reason: 'stereoscopic-unmatched',
    });
  });

  it('the fallback chain carries eligible alternatives in preference order', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-sel-fallback');
    const selection = select({ selectionId: 'ras-fallback', binding, assessment });
    // immediate-2d is INELIGIBLE on this spatial binding (kind-not-hosted),
    // so the chain carries the compositor (unmatched but eligible) and the
    // remote stream.
    expect(selection.fallbackChain).toEqual(['stereoscopic-compositor', 'remote-stream']);
  });

  it('a stereoscopic binding leaves mono techniques ineligible (no silent downgrade)', () => {
    const binding = boundSession(STEREO_RENDERER, { device: headsetDevice() });
    const assessment = assess(headsetDevice(), 'dca-sel-stereo-trace');
    const selection = select({ selectionId: 'ras-stereo-trace', binding, assessment });
    for (const entry of selection.trace) {
      if (entry.technique !== 'stereoscopic-compositor') {
        expect(entry.eligible, entry.technique).toBe(false);
        // The flat technique fails kind coverage first (fixed precedence:
        // kinds, then stereo); the spatial mono techniques fail stereo.
        expect(['kind-not-hosted', 'stereoscopic-unsupported']).toContain(entry.reason);
      }
    }
    expect(
      selection.trace.find((e) => e.technique === 'retained-scene-3d')?.reason,
    ).toBe('stereoscopic-unsupported');
    expect(
      selection.trace.find((e) => e.technique === 'remote-stream')?.reason,
    ).toBe('stereoscopic-unsupported');
    expect(selection.fallbackChain).toEqual([]);
  });

  it('the effective-limits snapshot mirrors the binding member-for-member', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-sel-limits');
    const selection = select({ selectionId: 'ras-limits', binding, assessment });
    expect(selection.effectiveLimits).toEqual(binding.effective);
  });

  it('the selection is content-addressed and parse-admits round-trip', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-sel-roundtrip');
    const selection = select({ selectionId: 'ras-roundtrip', binding, assessment });
    expect(selection.digest).toMatch(/^[0-9a-f]{64}$/);
    const parsed = parseRendererAdapterSelection(JSON.parse(JSON.stringify(selection)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual(selection);
    }
    expect(verifySelectionDigest(selection).ok).toBe(true);
  });

  it('every catalog entry hosts its declared kinds (catalog self-consistency)', () => {
    for (const technique of Object.keys(RENDERER_TECHNIQUE_CATALOG)) {
      const record = RENDERER_TECHNIQUE_CATALOG[technique as keyof typeof RENDERER_TECHNIQUE_CATALOG];
      expect(record.technique).toBe(technique);
      expect([...record.graphKinds]).toEqual([...record.graphKinds].sort());
      expect(new Set(record.graphKinds).size).toBe(record.graphKinds.length);
    }
  });
});

describe('adapter selection (tenant isolation, R12)', () => {
  it('cross-tenant selection is a typed cross-tenant-denied rejection', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-sel-x-tenant');
    const result = selectRendererAdapter(
      { selectionId: 'ras-x-tenant', binding, assessment },
      { expectedTenantId: 'tenant-beta' },
    );
    const error = expectFailure(result, 'cross-tenant-denied');
    expect(error.expectedTenantId).toBe('tenant-beta');
    expect(error.encounteredTenantId).toBe(TENANT_A);
  });

  it('same-tenant selection succeeds', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-sel-same-tenant');
    const result = selectRendererAdapter(
      { selectionId: 'ras-same-tenant', binding, assessment },
      { expectedTenantId: TENANT_A },
    );
    expect(result.ok).toBe(true);
  });
});
