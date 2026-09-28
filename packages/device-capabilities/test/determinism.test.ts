// Determinism + provider-neutrality battery: byte-identical derivations,
// content addressing, and zero vendor/engine vocabulary.
import { describe, expect, it } from 'vitest';
import {
  assessDeviceDescriptor,
  assessPresentationFit,
  descriptorFromProfile,
  DEVICE_CLASS_PROFILES,
  DEVICE_ADAPTATION_TIERS,
  CAPABILITY_GAP_KINDS,
  GUIDED_FIDELITY_LEVELS,
  ADAPTATION_TIER_FIDELITY_GUIDANCE,
} from '../src/index';
import { desktopDevice, FLAT_REQUIREMENT, SPATIAL_REQUIREMENT } from './fixtures';

describe('determinism', () => {
  it('the same descriptor + id yields byte-identical assessments', () => {
    const first = assessDeviceDescriptor({ assessmentId: 'dca-det', device: desktopDevice() });
    const second = assessDeviceDescriptor({ assessmentId: 'dca-det', device: desktopDevice() });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
      expect(first.value.digest).toBe(second.value.digest);
    }
  });

  it('a different assessment id yields a different content digest', () => {
    const first = assessDeviceDescriptor({ assessmentId: 'dca-det-a', device: desktopDevice() });
    const second = assessDeviceDescriptor({ assessmentId: 'dca-det-b', device: desktopDevice() });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.digest).not.toBe(second.value.digest);
    }
  });

  it('key order in the input descriptor does not change the assessment digest', () => {
    const base = desktopDevice();
    const reordered = {
      latencyBudgetMs: base.latencyBudgetMs,
      spatial: base.spatial,
      interaction: base.interaction,
      deviceClass: base.deviceClass,
      display: base.display,
      descriptorVersion: base.descriptorVersion,
    };
    const first = assessDeviceDescriptor({ assessmentId: 'dca-order', device: base });
    const second = assessDeviceDescriptor({ assessmentId: 'dca-order', device: reordered });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.digest).toBe(second.value.digest);
    }
  });

  it('profile filling is deterministic', () => {
    const first = descriptorFromProfile('phone');
    const second = descriptorFromProfile('phone');
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('unsorted interaction overrides are canonicalized (sorted, duplicate-free)', () => {
    const filled = descriptorFromProfile('desktop', {
      interaction: ['voice', 'keyboard', 'pointer'],
    });
    expect(filled.ok).toBe(true);
    if (filled.ok) {
      expect(filled.value.interaction).toEqual(['keyboard', 'pointer', 'voice']);
    }
  });
});

describe('provider neutrality (lock rule 13)', () => {
  const VENDOR_WORDS = [
    'webgl',
    'webgpu',
    'opengl',
    'vulkan',
    'directx',
    'metal',
    'three',
    'babylon',
    'cesium',
    'unity',
    'unreal',
    'godot',
    'react',
    'nvidia',
    'apple',
    'android',
    'ios',
    'chrome',
    'firefox',
    'safari',
    'quest',
    'hololens',
    'ipad',
    'iphone',
    'galaxy',
  ];

  it('the closed vocabularies carry no vendor/engine words', () => {
    const vocabularies = [
      DEVICE_ADAPTATION_TIERS.join(','),
      CAPABILITY_GAP_KINDS.join(','),
      GUIDED_FIDELITY_LEVELS.join(','),
      Object.values(ADAPTATION_TIER_FIDELITY_GUIDANCE).join(','),
      Object.keys(DEVICE_CLASS_PROFILES).join(','),
    ];
    for (const vocabulary of vocabularies) {
      const lower = vocabulary.toLowerCase();
      for (const word of VENDOR_WORDS) {
        expect(lower, `vocabulary "${vocabulary}" must not contain "${word}"`).not.toContain(word);
      }
    }
  });

  it('a descriptor with vendor fields is rejected with precise typed diagnostics', () => {
    const vendored = { ...desktopDevice(), engine: 'some-engine' } as unknown;
    const result = assessDeviceDescriptor({ assessmentId: 'dca-neutral', device: vendored });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === 'malformed-record') {
      expect(
        result.error.issues.some(
          (issue) => issue.path.includes('engine') || issue.message.includes('engine'),
        ),
      ).toBe(true);
    } else if (!result.ok) {
      throw new Error(`expected malformed-record, got ${result.error.code}`);
    }
  });

  it('a presentation requirement with vendor fields is rejected with precise typed diagnostics', () => {
    const result = assessPresentationFit({
      requirement: { ...SPATIAL_REQUIREMENT, framework: 'some-framework' },
      device: desktopDevice(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === 'malformed-record') {
      expect(
        result.error.issues.some(
          (issue) => issue.path.includes('framework') || issue.message.includes('framework'),
        ),
      ).toBe(true);
    } else if (!result.ok) {
      throw new Error(`expected malformed-record, got ${result.error.code}`);
    }
  });

  it('the assessment record carries no vendor fields (strict admission)', async () => {
    const { DeviceCapabilityAssessmentSchema } = await import('../src/index');
    const verdict = assessDeviceDescriptor({
      assessmentId: 'dca-strict',
      device: desktopDevice(),
    });
    if (!verdict.ok) throw new Error('fixture failed');
    const withVendor = { ...verdict.value, renderer: 'vendor-name' };
    expect(DeviceCapabilityAssessmentSchema.safeParse(withVendor).success).toBe(false);
  });

  it('fit verdicts reject vendor fields too', async () => {
    const { PresentationFitSchema } = await import('../src/index');
    const verdict = assessPresentationFit({
      requirement: FLAT_REQUIREMENT,
      device: desktopDevice(),
    });
    if (!verdict.ok) throw new Error('fixture failed');
    const withVendor = { ...verdict.value, engine: 'vendor-name' };
    expect(PresentationFitSchema.safeParse(withVendor).success).toBe(false);
  });
});
