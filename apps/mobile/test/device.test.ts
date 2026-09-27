// FIELD-FIDELITY EVIDENCE (acceptance: "the mobile DeviceDescriptor carries
// the field-fidelity capability set per the ladder"). The W011
// device-descriptor slot is filled at the FIELD rung of the
// experience-architecture device-adaptation ladder ("mobile = field").
import { describe, expect, it } from 'vitest';
import {
  validateDeviceDescriptor,
  DEVICE_CLASSES,
  INTERACTION_MODALITIES,
} from '@epoch/experience-protocol';
import {
  FIELD_DEVICE_CAPABILITY_SET,
  FIELD_DEVICE_CLASSES,
  FIELD_FIDELITY_INTERACTION_MODALITIES,
  buildFieldDeviceDescriptor,
  validateFieldDeviceDescriptor,
} from '../src/index';

describe('field device descriptor (field fidelity per the ladder)', () => {
  it('builds a descriptor that admits through the W011 machinery', () => {
    const built = buildFieldDeviceDescriptor();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const viaKernel = validateDeviceDescriptor(built.value);
    expect(viaKernel.ok).toBe(true);
  });

  it('carries the field device classes (phone and tablet, the neutral W011 classes)', () => {
    expect(FIELD_DEVICE_CLASSES).toEqual(['phone', 'tablet']);
    for (const deviceClass of FIELD_DEVICE_CLASSES) {
      expect(DEVICE_CLASSES).toContain(deviceClass);
    }
    expect(buildFieldDeviceDescriptor({ deviceClass: 'tablet' }).ok).toBe(true);
  });

  it('carries exactly the field-fidelity interaction modality set (sorted, duplicate-free)', () => {
    expect(FIELD_FIDELITY_INTERACTION_MODALITIES).toEqual(['gesture', 'touch', 'voice']);
    for (const modality of FIELD_FIDELITY_INTERACTION_MODALITIES) {
      expect(INTERACTION_MODALITIES).toContain(modality);
    }
    const built = buildFieldDeviceDescriptor();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.interaction).toEqual(['gesture', 'touch', 'voice']);
  });

  it('field fidelity excludes the higher-rung modalities (keyboard, pointer, gamepad, gaze)', () => {
    const higherRung = ['gamepad', 'gaze', 'keyboard', 'pointer'] as const;
    const rejected = buildFieldDeviceDescriptor({ interaction: [...higherRung] });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.error.code).toBe('validation');
    expect(rejected.error.message).toContain('field-fidelity modality');
  });

  it('non-stereoscopic, no spatial tracking, no world anchoring (reduced fidelity rung)', () => {
    const built = buildFieldDeviceDescriptor();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.display.stereoscopic).toBe(false);
    expect(built.value.spatial.poseTracking).toBe('none');
    expect(built.value.spatial.worldAnchored).toBe(false);
    expect(built.value.spatial.maxTriangles).toBeUndefined();
    expect(built.value.spatial.maxTextureBytes).toBeUndefined();
  });

  it('carries bounded display budgets and the field latency budget', () => {
    const built = buildFieldDeviceDescriptor();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.display.maxPixels).toBe(FIELD_DEVICE_CAPABILITY_SET.display.maxPixels);
    expect(built.value.display.refreshHz).toBe(60);
    expect(built.value.display.colorDepthBits).toBe(24);
    expect(built.value.latencyBudgetMs).toBe(100);
  });

  it('admission rejects non-field device classes (desktop/laptop/headset/wall-display)', () => {
    for (const nonField of ['desktop', 'laptop', 'headset', 'wall-display'] as const) {
      const rejected = buildFieldDeviceDescriptor({ deviceClass: nonField as 'phone' });
      expect(rejected.ok).toBe(false);
      if (rejected.ok) return;
      expect(rejected.error.code).toBe('validation');
      expect(rejected.error.message).toContain('not a field client class');
    }
  });

  it('serialized validation round-trips (validateFieldDeviceDescriptor over JSON)', () => {
    const built = buildFieldDeviceDescriptor();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const roundTripped = JSON.parse(JSON.stringify(built.value)) as unknown;
    const validated = validateFieldDeviceDescriptor(roundTripped);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.value).toEqual(built.value);
    }
  });

  it('deterministic: identical options produce identical descriptors', () => {
    const first = buildFieldDeviceDescriptor({ deviceClass: 'tablet' });
    const second = buildFieldDeviceDescriptor({ deviceClass: 'tablet' });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value).toEqual(second.value);
  });
});
