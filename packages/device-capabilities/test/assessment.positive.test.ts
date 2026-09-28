// Positive battery: deterministic assessment derivation over the frozen
// device-adaptation table (desktop = full, laptop = normal, tablet/phone
// = field, low capability = reduced + remote assist optional).
import { describe, expect, it } from 'vitest';
import {
  assessDeviceDescriptor,
  budgetFloorTierOf,
  adaptationTierOf,
  remoteAssistRecommendedFor,
  tierDerivationOf,
  ADAPTATION_TIER_FIDELITY_GUIDANCE,
  TIER_BUDGET_FLOORS,
  DEVICE_CLASS_PROFILES,
  descriptorFromProfile,
  parseDeviceCapabilityAssessment,
  verifyAssessmentDigest,
} from '../src/index';
import {
  desktopDevice,
  phoneDevice,
  profileDevice,
  LOW_CAPABILITY_DEVICE,
  FULL_FLOOR_DEVICE,
  BELOW_FULL_FLOOR_DEVICE,
  PHONE_FULL_BUDGETS_DEVICE,
  UNDECLARED_BUDGET_DEVICE,
} from './fixtures';

function assess(device: unknown, assessmentId = 'dca-fixture-1') {
  const result = assessDeviceDescriptor({ assessmentId, device });
  if (!result.ok) {
    throw new Error(`fixture assessment failed: ${result.error.message}`);
  }
  return result.value;
}

describe('device capability assessment (positive)', () => {
  it('derives the frozen per-class tiers from the canonical profile table', () => {
    expect(assess(profileDevice('desktop')).tier).toBe('full');
    expect(assess(profileDevice('wall-display')).tier).toBe('full');
    expect(assess(profileDevice('laptop')).tier).toBe('normal');
    expect(assess(profileDevice('headset')).tier).toBe('normal');
    expect(assess(profileDevice('tablet')).tier).toBe('field');
    expect(assess(profileDevice('phone')).tier).toBe('field');
  });

  it('derives the frozen tier -> guided fidelity correspondence', () => {
    expect(ADAPTATION_TIER_FIDELITY_GUIDANCE).toEqual({
      full: 'desktop',
      normal: 'web',
      field: 'mobile',
      reduced: 'low',
    });
    expect(assess(desktopDevice()).derivation.guidedFidelity).toBe('desktop');
    expect(assess(profileDevice('laptop')).derivation.guidedFidelity).toBe('web');
    expect(assess(phoneDevice()).derivation.guidedFidelity).toBe('mobile');
    expect(assess(LOW_CAPABILITY_DEVICE).derivation.guidedFidelity).toBe('low');
  });

  it('downgrades a desktop device whose declared budgets miss the full floors', () => {
    expect(budgetFloorTierOf(BELOW_FULL_FLOOR_DEVICE)).toBe('normal');
    expect(adaptationTierOf(BELOW_FULL_FLOOR_DEVICE)).toBe('normal');
  });

  it('tier floors are inclusive: budgets exactly at the floor satisfy the tier', () => {
    expect(budgetFloorTierOf(FULL_FLOOR_DEVICE)).toBe('full');
    expect(adaptationTierOf(FULL_FLOOR_DEVICE)).toBe('full');
    expect(FULL_FLOOR_DEVICE.display.maxPixels).toBe(TIER_BUDGET_FLOORS.full.minPixels);
    expect(FULL_FLOOR_DEVICE.spatial.maxTriangles).toBe(TIER_BUDGET_FLOORS.full.minTriangles);
    expect(FULL_FLOOR_DEVICE.spatial.maxTextureBytes).toBe(TIER_BUDGET_FLOORS.full.minTextureBytes);
  });

  it('a device class ceiling caps the tier regardless of declared budgets', () => {
    expect(budgetFloorTierOf(PHONE_FULL_BUDGETS_DEVICE)).toBe('full');
    expect(adaptationTierOf(PHONE_FULL_BUDGETS_DEVICE)).toBe('field');
    expect(assess(PHONE_FULL_BUDGETS_DEVICE).derivation.classCeilingTier).toBe('field');
  });

  it('undeclared budgets never downgrade (absent = unconstrained)', () => {
    expect(budgetFloorTierOf(UNDECLARED_BUDGET_DEVICE)).toBe('full');
    expect(adaptationTierOf(UNDECLARED_BUDGET_DEVICE)).toBe('full');
  });

  it('a low-capability device derives the reduced tier and the remote-assist recommendation', () => {
    const verdict = assess(LOW_CAPABILITY_DEVICE);
    expect(verdict.tier).toBe('reduced');
    expect(verdict.derivation.remoteAssistRecommended).toBe(true);
    expect(remoteAssistRecommendedFor(LOW_CAPABILITY_DEVICE)).toBe(true);
    expect(remoteAssistRecommendedFor(desktopDevice())).toBe(false);
  });

  it('the derivation trace records every intermediate tier (never an unexplained verdict)', () => {
    const verdict = assess(PHONE_FULL_BUDGETS_DEVICE);
    expect(verdict.derivation).toEqual({
      budgetFloorTier: 'full',
      classCeilingTier: 'field',
      derivedTier: 'field',
      guidedFidelity: 'mobile',
      remoteAssistRecommended: false,
    });
    expect(verdict.derivation).toEqual(tierDerivationOf(PHONE_FULL_BUDGETS_DEVICE));
  });

  it('axis snapshots mirror the assessed descriptor member-for-member', () => {
    const verdict = assess(desktopDevice());
    expect(verdict.display).toEqual(desktopDevice().display);
    expect(verdict.spatial).toEqual(desktopDevice().spatial);
    expect(verdict.interaction).toEqual(desktopDevice().interaction);
    expect(verdict.device).toEqual(desktopDevice());
  });

  it('the assessment is content-addressed and parse-admits round-trip', () => {
    const verdict = assess(desktopDevice(), 'dca-roundtrip');
    expect(verdict.digest).toMatch(/^[0-9a-f]{64}$/);
    const parsed = parseDeviceCapabilityAssessment(JSON.parse(JSON.stringify(verdict)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual(verdict);
    }
    const verified = verifyAssessmentDigest(verdict);
    expect(verified.ok).toBe(true);
  });

  it('every canonical profile descriptor assesses without error', () => {
    for (const deviceClass of Object.keys(DEVICE_CLASS_PROFILES)) {
      const filled = descriptorFromProfile(deviceClass);
      expect(filled.ok, deviceClass).toBe(true);
      if (filled.ok) {
        expect(assess(filled.value).tier).toBe(
          DEVICE_CLASS_PROFILES[deviceClass as keyof typeof DEVICE_CLASS_PROFILES].tierCeiling,
        );
      }
    }
  });
});
