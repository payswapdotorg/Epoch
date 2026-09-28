// Negative battery: typed rejections — invalid ids, vendor fields,
// version skew, digest tampering, and hand-edited verdicts.
import { describe, expect, it } from 'vitest';
import {
  assessDeviceDescriptor,
  parseDeviceCapabilityAssessment,
  parsePresentationFit,
  assessPresentationFit,
  descriptorFromProfile,
} from '../src/index';
import { desktopDevice, expectFailure } from './fixtures';

describe('device capability assessment (negative)', () => {
  it('rejects an invalid assessment id as a typed malformed-record', () => {
    const result = assessDeviceDescriptor({ assessmentId: 'not-an-id', device: desktopDevice() });
    const error = expectFailure(result, 'malformed-record');
    expect(error.issues.length).toBeGreaterThan(0);
    expect(error.issues[0]?.path).toBe('$');
  });

  it('rejects a device descriptor with a vendor field (precise typed diagnostics)', () => {
    const vendored = {
      ...desktopDevice(),
      gpuVendor: 'a-vendor',
    } as unknown;
    const result = assessDeviceDescriptor({ assessmentId: 'dca-vendor', device: vendored });
    const error = expectFailure(result, 'malformed-record');
    expect(error.issues.length).toBeGreaterThan(0);
    expect(
      error.issues.some(
        (issue) => issue.path.includes('gpuVendor') || issue.message.includes('gpuVendor'),
      ),
    ).toBe(true);
  });

  it('rejects a malformed device descriptor root', () => {
    const result = assessDeviceDescriptor({ assessmentId: 'dca-root', device: 'nope' });
    expectFailure(result, 'malformed-record');
  });

  it('rejects version skew before schema validation (version-unsupported)', () => {
    const verdict = assessDeviceDescriptor({
      assessmentId: 'dca-version',
      device: desktopDevice(),
    });
    if (!verdict.ok) throw new Error('fixture failed');
    const skewed = { ...verdict.value, protocolVersion: '2.0.0' };
    const error = expectFailure(parseDeviceCapabilityAssessment(skewed), 'version-unsupported');
    expect(error.expected).toBe('1.0.0');
    expect(error.encountered).toBe('2.0.0');
  });

  it('rejects a tampered digest (digest-mismatch)', () => {
    const verdict = assessDeviceDescriptor({
      assessmentId: 'dca-tamper',
      device: desktopDevice(),
    });
    if (!verdict.ok) throw new Error('fixture failed');
    const tampered = {
      ...verdict.value,
      digest: 'f'.repeat(64),
    };
    const error = expectFailure(parseDeviceCapabilityAssessment(tampered), 'digest-mismatch');
    expect(error.expected).toBe(verdict.value.digest);
    expect(error.encountered).toBe('f'.repeat(64));
  });

  it('rejects a hand-edited tier verdict (canonical-consistency refinement)', () => {
    const verdict = assessDeviceDescriptor({
      assessmentId: 'dca-edit',
      device: desktopDevice(),
    });
    if (!verdict.ok) throw new Error('fixture failed');
    const edited = { ...verdict.value, tier: 'reduced' };
    expectFailure(parseDeviceCapabilityAssessment(edited), 'malformed-record');
  });

  it('rejects a hand-edited derivation trace', () => {
    const verdict = assessDeviceDescriptor({
      assessmentId: 'dca-edit-trace',
      device: desktopDevice(),
    });
    if (!verdict.ok) throw new Error('fixture failed');
    const edited = {
      ...verdict.value,
      derivation: { ...verdict.value.derivation, budgetFloorTier: 'reduced' },
    };
    expectFailure(parseDeviceCapabilityAssessment(edited), 'malformed-record');
  });

  it('rejects an axis snapshot that drifts from the embedded descriptor', () => {
    const verdict = assessDeviceDescriptor({
      assessmentId: 'dca-edit-axis',
      device: desktopDevice(),
    });
    if (!verdict.ok) throw new Error('fixture failed');
    const edited = {
      ...verdict.value,
      display: { ...verdict.value.display, maxPixels: 42 },
    };
    expectFailure(parseDeviceCapabilityAssessment(edited), 'malformed-record');
  });

  it('rejects a non-object root with a typed error', () => {
    expectFailure(parseDeviceCapabilityAssessment(null), 'malformed-record');
    expectFailure(parseDeviceCapabilityAssessment([1, 2, 3]), 'malformed-record');
  });

  it('rejects an unknown device class at the profile filler', () => {
    const error = expectFailure(descriptorFromProfile('smart-fridge'), 'unknown-device-class');
    expect(error.encountered).toBe('smart-fridge');
  });

  it('rejects an invalid interaction override (unknown modality) with a typed path', () => {
    const result = descriptorFromProfile('desktop', { interaction: ['mind-control'] });
    const error = expectFailure(result, 'malformed-record');
    expect(error.issues[0]?.path).toContain('interaction');
  });

  it('rejects an empty interaction override', () => {
    const result = descriptorFromProfile('desktop', { interaction: [] });
    expectFailure(result, 'malformed-record');
  });

  it('rejects a flat presentation requirement that declares spatial budgets', () => {
    const result = assessPresentationFit({
      requirement: {
        requirementVersion: 1,
        requirementId: 'prr-invalid-flat',
        spatial: false,
        stereoscopic: false,
        requiredModalities: [],
        minPoseTracking: 'none',
        minTriangles: 1_000,
      },
      device: desktopDevice(),
    });
    const error = expectFailure(result, 'malformed-record');
    expect(error.issues.some((issue) => issue.path === 'minTriangles')).toBe(true);
  });

  it('rejects a presentation-fit verdict whose fits flag contradicts its gaps', () => {
    const fit = assessPresentationFit({
      requirement: {
        requirementVersion: 1,
        requirementId: 'prr-contradiction',
        spatial: true,
        stereoscopic: true,
        requiredModalities: [],
        minPoseTracking: 'none',
      },
      device: desktopDevice(),
    });
    if (!fit.ok) throw new Error('fixture failed');
    const contradiction = { ...fit.value, fits: true };
    expectFailure(parsePresentationFit(contradiction), 'malformed-record');
  });
});
