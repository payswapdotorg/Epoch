// Device-descriptor slot (positive + negative + boundary): the abstract,
// provider-neutral W019 slot validates typed capability/limit data and
// rejects vendor vocabulary, unsorted modality sets, and malformed shapes.
import { describe, expect, it } from 'vitest';
import { validateDeviceDescriptor } from '../src/index';
import {
  desktopDevice,
  expectFailure,
  headsetDevice,
  phoneDevice,
} from './fixtures';

describe('device descriptor validation', () => {
  it('admits the neutral desktop/headset/phone descriptors', () => {
    for (const device of [desktopDevice(), headsetDevice(), phoneDevice()]) {
      const result = validateDeviceDescriptor(device);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.deviceClass).toBe(device.deviceClass);
      }
    }
  });

  it('admits a minimal descriptor with only the required fields', () => {
    const result = validateDeviceDescriptor({
      descriptorVersion: 1,
      deviceClass: 'wall-display',
      interaction: ['gesture'],
      display: { stereoscopic: false },
      spatial: { poseTracking: 'none', worldAnchored: false },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown device class (vendor products are not classes)', () => {
    const error = expectFailure(
      validateDeviceDescriptor({ ...desktopDevice(), deviceClass: 'vision-pro' }),
      'malformed-descriptor',
    );
    expect(error.issues.some((i) => i.path === 'deviceClass')).toBe(true);
  });

  it('rejects an unknown interaction modality', () => {
    const error = expectFailure(
      validateDeviceDescriptor({ ...desktopDevice(), interaction: ['hand-tracking-sdk'] }),
      'malformed-descriptor',
    );
    expect(error.issues.some((i) => i.path === 'interaction.0')).toBe(true);
  });

  it('rejects an empty interaction set', () => {
    const result = validateDeviceDescriptor({ ...desktopDevice(), interaction: [] });
    expect(result.ok).toBe(false);
  });

  it('rejects unsorted or duplicate interaction modalities (deterministic set semantics)', () => {
    const unsorted = expectFailure(
      validateDeviceDescriptor({ ...desktopDevice(), interaction: ['pointer', 'keyboard'] }),
      'malformed-descriptor',
    );
    expect(unsorted.issues.some((i) => i.message.includes('sorted ascending'))).toBe(true);

    const duplicated = validateDeviceDescriptor({
      ...desktopDevice(),
      interaction: ['keyboard', 'keyboard'],
    });
    expect(duplicated.ok).toBe(false);
  });

  it('rejects a wrong descriptor version', () => {
    const error = expectFailure(
      validateDeviceDescriptor({ ...desktopDevice(), descriptorVersion: 2 }),
      'malformed-descriptor',
    );
    expect(error.issues.some((i) => i.path === 'descriptorVersion')).toBe(true);
  });

  it('rejects non-positive budgets and non-integer refresh rates', () => {
    const badPixels = validateDeviceDescriptor({
      ...desktopDevice(),
      display: { stereoscopic: false, maxPixels: -1 },
    });
    expect(badPixels.ok).toBe(false);

    const badRefresh = validateDeviceDescriptor({
      ...desktopDevice(),
      display: { stereoscopic: false, refreshHz: 59.5 },
    });
    expect(badRefresh.ok).toBe(false);
  });

  it('rejects an unknown vendor field on the descriptor (strict object)', () => {
    const error = expectFailure(
      validateDeviceDescriptor({ ...desktopDevice(), gpuVendor: 'acme-graphics' } as object),
      'malformed-descriptor',
    );
    expect(error.issues.some((i) => i.path === 'gpuVendor')).toBe(true);
  });

  it('a non-object root is a typed malformed-descriptor, never a throw', () => {
    for (const input of [null, 'device', 7, []]) {
      expectFailure(validateDeviceDescriptor(input), 'malformed-descriptor');
    }
  });
});
