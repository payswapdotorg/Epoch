// W017 acceptance: the fidelity claim — the desktop DeviceDescriptor
// carries the full-fidelity capability set per the device adaptation
// ladder (spec/experience-architecture.md: "desktop = full"), expressed
// in the W011 device-descriptor slot, and it is admitted by the W011
// validator. A non-desktop descriptor is a typed device-mismatch, never
// a silent adaptation.
import { describe, expect, it } from 'vitest';
import { validateDeviceDescriptor } from '@epoch/experience-protocol';
import { computeEffectiveLimits } from '@epoch/renderer-runtime';
import {
  DESKTOP_DEVICE,
  DESKTOP_FIDELITY,
  DESKTOP_SERVICEABLE_MODALITIES,
  FULL_FIDELITY_GRAPH_KINDS,
  KIND_COMPLETE_RENDERER,
  MAX_RENDERER_TEXTURE_BYTES,
  MAX_RENDERER_TRIANGLES,
  admitDeviceDescriptor,
  assessDesktopFidelity,
} from '../src/index';
import { expectFailure } from './fixtures';

describe('the full-fidelity desktop device descriptor', () => {
  it('is admitted by the W011 device-descriptor validator verbatim', () => {
    const admitted = validateDeviceDescriptor(DESKTOP_DEVICE);
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value).toEqual(DESKTOP_DEVICE);
    }
  });

  it('declares the desktop class of the adaptation ladder', () => {
    expect(DESKTOP_DEVICE.deviceClass).toBe('desktop');
    expect(DESKTOP_DEVICE.descriptorVersion).toBe(1);
  });

  it('declares every desktop-serviceable interaction modality (sorted, duplicate-free)', () => {
    expect(DESKTOP_DEVICE.interaction).toEqual(DESKTOP_SERVICEABLE_MODALITIES);
    expect(DESKTOP_DEVICE.interaction).toEqual([...DESKTOP_DEVICE.interaction].sort());
    expect(new Set(DESKTOP_DEVICE.interaction).size).toBe(DESKTOP_DEVICE.interaction.length);
    // The primary pair is always present.
    expect(DESKTOP_DEVICE.interaction).toContain('keyboard');
    expect(DESKTOP_DEVICE.interaction).toContain('pointer');
  });

  it('carries spatial budgets at the renderer ceilings so it never downgrades any lawful renderer', () => {
    expect(DESKTOP_DEVICE.spatial.maxTriangles).toBe(MAX_RENDERER_TRIANGLES);
    expect(DESKTOP_DEVICE.spatial.maxTextureBytes).toBe(MAX_RENDERER_TEXTURE_BYTES);
    // The never-downgrade property, exercised through the W013 negotiation:
    // for renderer budgets at every scale, the effective limits equal the
    // renderer's own declaration (the device is never the minimum).
    for (const triangles of [1, 1_000, 2_000_000, MAX_RENDERER_TRIANGLES]) {
      for (const textureBytes of [1, 1_048_576, MAX_RENDERER_TEXTURE_BYTES]) {
        const renderer = {
          ...KIND_COMPLETE_RENDERER,
          budgets: {
            ...KIND_COMPLETE_RENDERER.budgets,
            maxTriangles: triangles,
            maxTextureBytes: textureBytes,
          },
        };
        const effective = computeEffectiveLimits(renderer, {
          deviceSessionId: 'ds-fidelity-test',
          tenantScope: { tenantId: 'tenant:alpha' },
          device: DESKTOP_DEVICE,
        });
        expect(effective.maxTriangles).toBe(triangles);
        expect(effective.maxTextureBytes).toBe(textureBytes);
      }
    }
  });

  it('keeps every Experience Graph kind hostable through a kind-complete renderer', () => {
    const effective = computeEffectiveLimits(KIND_COMPLETE_RENDERER, {
      deviceSessionId: 'ds-fidelity-test',
      tenantScope: { tenantId: 'tenant:alpha' },
      device: DESKTOP_DEVICE,
    });
    for (const kind of FULL_FIDELITY_GRAPH_KINDS) {
      expect(effective.graphKinds).toContain(kind);
    }
    expect(effective.graphKinds).toHaveLength(7);
    // The negotiated interaction set still services the primary pair.
    expect(effective.interaction).toContain('keyboard');
    expect(effective.interaction).toContain('pointer');
  });

  it('is assessed full-fidelity by the typed ladder assessment', () => {
    expect(DESKTOP_FIDELITY.isFullFidelity).toBe(true);
    expect(DESKTOP_FIDELITY.isDesktopClass).toBe(true);
    expect(DESKTOP_FIDELITY.declaresServiceableModalities).toBe(true);
    expect(DESKTOP_FIDELITY.declaresPrimaryModalities).toBe(true);
    expect(DESKTOP_FIDELITY.neverDowngradesSpatialBudgets).toBe(true);
    expect(DESKTOP_FIDELITY.hostsAllGraphKinds).toBe(true);
    expect(DESKTOP_FIDELITY.effectivePrimaryModalities).toBe(true);
    expect(assessDesktopFidelity(DESKTOP_DEVICE)).toEqual(DESKTOP_FIDELITY);
  });

  it('downgrades the assessment honestly for reduced descriptors (no false full-fidelity)', () => {
    const reduced = {
      ...DESKTOP_DEVICE,
      interaction: ['keyboard' as const, 'pointer' as const],
      spatial: { ...DESKTOP_DEVICE.spatial, maxTriangles: 500_000 },
    };
    const assessment = assessDesktopFidelity(reduced);
    expect(assessment.isFullFidelity).toBe(false);
    expect(assessment.declaresServiceableModalities).toBe(false);
    expect(assessment.neverDowngradesSpatialBudgets).toBe(false);
    const laptop = { ...DESKTOP_DEVICE, deviceClass: 'laptop' as const };
    expect(assessDesktopFidelity(laptop).isFullFidelity).toBe(false);
  });
});

describe('desktop device-descriptor admission', () => {
  it('admits the canonical descriptor', () => {
    const admitted = admitDeviceDescriptor(DESKTOP_DEVICE);
    expect(admitted.ok).toBe(true);
  });

  it('rejects a non-desktop descriptor with the typed device-mismatch (never a silent adaptation)', () => {
    const headset = {
      ...DESKTOP_DEVICE,
      deviceClass: 'headset' as const,
      interaction: ['gesture', 'voice'],
      display: { ...DESKTOP_DEVICE.display, stereoscopic: true },
      spatial: { ...DESKTOP_DEVICE.spatial, poseTracking: '6dof' as const, worldAnchored: true },
    };
    const rejected = admitDeviceDescriptor(headset);
    expectFailure(rejected, 'device-mismatch');
  });

  it('rejects version skew with the typed version-unsupported (before schema diagnostics)', () => {
    const skewed = { ...DESKTOP_DEVICE, descriptorVersion: 2 };
    expectFailure(admitDeviceDescriptor(skewed), 'version-unsupported');
  });

  it('rejects malformed descriptors with the typed malformed-record', () => {
    expectFailure(admitDeviceDescriptor({ ...DESKTOP_DEVICE, interaction: 'pointer' }), 'malformed-record');
    expectFailure(admitDeviceDescriptor(null), 'malformed-record');
    expectFailure(admitDeviceDescriptor('desktop'), 'malformed-record');
  });

  it('rejects unknown (vendor) fields on the descriptor via the W011 strict object', () => {
    const smuggled = { ...DESKTOP_DEVICE, graphicsEngine: 'anything' };
    expectFailure(admitDeviceDescriptor(smuggled), 'malformed-record');
  });
});
