// Presentation fit / gap analysis: positive fits, every typed gap kind,
// undeclared-budget semantics, and deterministic verdict ordering.
import { describe, expect, it } from 'vitest';
import { assessPresentationFit } from '../src/index';
import {
  desktopDevice,
  phoneDevice,
  profileDevice,
  FLAT_REQUIREMENT,
  SPATIAL_REQUIREMENT,
  expectFailure,
} from './fixtures';

function fit(requirement: unknown, device: unknown) {
  const result = assessPresentationFit({ requirement, device });
  if (!result.ok) {
    throw new Error(`fixture fit failed: ${result.error.message}`);
  }
  return result.value;
}

describe('presentation fit (positive)', () => {
  it('a flat requirement fits every canonical profile device', () => {
    for (const deviceClass of ['desktop', 'laptop', 'tablet', 'phone', 'headset', 'wall-display']) {
      const verdict = fit(FLAT_REQUIREMENT, profileDevice(deviceClass));
      expect(verdict.fits, deviceClass).toBe(true);
      expect(verdict.gaps).toEqual([]);
    }
  });

  it('a desktop fits a demanding spatial requirement minus the stereoscopic gap', () => {
    // The desktop profile is non-stereoscopic with pose 'none', so the
    // demanding requirement yields exactly those gaps — budgets fit.
    const verdict = fit(SPATIAL_REQUIREMENT, desktopDevice());
    expect(verdict.fits).toBe(false);
    expect(verdict.gaps.map((gap) => gap.kind)).toEqual([
      'stereoscopic-mismatch',
      'pose-tracking-insufficient',
      'modality-gap',
    ]);
  });

  it('a headset fits the stereoscopic + 6dof axes of the demanding requirement', () => {
    const headset = profileDevice('headset');
    // The demanding requirement requires pointer+touch, which the headset
    // does not service — those gaps are EXPECTED; the stereoscopic and
    // pose-tracking axes fit.
    const verdict = fit(SPATIAL_REQUIREMENT, headset);
    const kinds = verdict.gaps.map((gap) => gap.kind);
    expect(kinds).not.toContain('stereoscopic-mismatch');
    expect(kinds).not.toContain('pose-tracking-insufficient');
    expect(kinds.filter((kind) => kind === 'modality-gap')).toHaveLength(2);
  });

  it('an undeclared device budget satisfies any requirement (unconstrained)', () => {
    const undeclared = {
      descriptorVersion: 1,
      deviceClass: 'desktop',
      interaction: ['pointer'],
      display: { stereoscopic: true },
      spatial: { poseTracking: '6dof', worldAnchored: true },
    };
    const verdict = fit(
      {
        requirementVersion: 1,
        requirementId: 'prr-undeclared-budgets',
        spatial: true,
        stereoscopic: true,
        minPixels: 8_294_400,
        minTriangles: 4_000_000,
        minTextureBytes: 2_147_483_648,
        requiredModalities: [],
        minPoseTracking: '6dof',
      },
      undeclared,
    );
    expect(verdict.fits).toBe(true);
    expect(verdict.gaps).toEqual([]);
  });

  it('modality gaps carry the missing modality', () => {
    const verdict = fit(SPATIAL_REQUIREMENT, desktopDevice());
    const modalityGaps = verdict.gaps.filter((gap) => gap.kind === 'modality-gap');
    expect(modalityGaps.map((gap) => gap.modality)).toEqual(['touch']);
  });
});

describe('presentation fit (gaps + determinism)', () => {
  it('every budget gap kind carries encountered and required values', () => {
    const verdict = fit(SPATIAL_REQUIREMENT, phoneDevice());
    const pixelGap = verdict.gaps.find((gap) => gap.kind === 'pixel-budget-shortfall');
    expect(pixelGap?.encountered).toBe(phoneDevice().display.maxPixels);
    expect(pixelGap?.required).toBe(SPATIAL_REQUIREMENT.minPixels);
    const triangleGap = verdict.gaps.find((gap) => gap.kind === 'triangle-budget-shortfall');
    expect(triangleGap?.encountered).toBe(phoneDevice().spatial.maxTriangles);
    expect(triangleGap?.required).toBe(SPATIAL_REQUIREMENT.minTriangles);
    const textureGap = verdict.gaps.find((gap) => gap.kind === 'texture-budget-shortfall');
    expect(textureGap?.encountered).toBe(phoneDevice().spatial.maxTextureBytes);
    expect(textureGap?.required).toBe(SPATIAL_REQUIREMENT.minTextureBytes);
  });

  it('pose tracking insufficiency is ordered (none < 3dof < 6dof)', () => {
    const with3dof = fit(
      { ...SPATIAL_REQUIREMENT, stereoscopic: false, minPoseTracking: '3dof' },
      desktopDevice(),
    );
    expect(with3dof.gaps.map((gap) => gap.kind)).toContain('pose-tracking-insufficient');
    const headset = profileDevice('headset');
    const withNone = fit({ ...SPATIAL_REQUIREMENT, stereoscopic: false, minPoseTracking: 'none' }, headset);
    expect(withNone.gaps.map((gap) => gap.kind)).not.toContain('pose-tracking-insufficient');
  });

  it('gaps are emitted in the fixed evaluation order (stable digests)', () => {
    const first = fit(SPATIAL_REQUIREMENT, phoneDevice());
    const second = fit(SPATIAL_REQUIREMENT, phoneDevice());
    expect(first).toEqual(second);
    expect(first.digest).toBe(second.digest);
  });

  it('the fit verdict is content-addressed', () => {
    expect(fit(FLAT_REQUIREMENT, desktopDevice()).digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a malformed requirement is a typed rejection', () => {
    const result = assessPresentationFit({
      requirement: { ...SPATIAL_REQUIREMENT, requirementId: 'bad id with spaces' },
      device: desktopDevice(),
    });
    expectFailure(result, 'malformed-record');
  });
});
