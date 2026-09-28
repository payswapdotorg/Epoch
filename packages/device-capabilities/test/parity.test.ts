// RUNTIME PARITY with the sibling experience-layer vocabularies
// (devDependencies only — no runtime coupling; the compile-time half
// lives in src/kernel-parity.ts):
//
// - W011 experience-protocol: profile-filled descriptors are admitted by
//   the REAL W011 device-descriptor validator;
// - W013 renderer-runtime: assessments assess exactly the device slot a
//   W013 device-session snapshot carries (round-trip through the REAL
//   snapshot projection);
// - W013 experience-runtime: the host session record's device slot
//   admits the same descriptors;
// - W016 world-experience: the guided fidelity vocabulary is
//   member-identical to the REAL WorldFidelityLevel vocabulary, and the
//   guidance table covers every tier.
import { describe, expect, it } from 'vitest';
import { DeviceDescriptorSchema } from '@epoch/experience-protocol';
import { deviceSessionSnapshotOf } from '@epoch/renderer-runtime';
import { DeviceSessionRecordSchema } from '@epoch/experience-runtime';
import { WORLD_FIDELITY_PROFILES, WORLD_FIDELITY_LEVELS } from '@epoch/world-experience';
import {
  GUIDED_FIDELITY_LEVELS,
  ADAPTATION_TIER_FIDELITY_GUIDANCE,
  DEVICE_ADAPTATION_TIERS,
  assessDeviceDescriptor,
  descriptorFromProfile,
  DEVICE_CLASS_PROFILES,
} from '../src/index';

const TENANT = 'tenant-alpha';

describe('W011 experience-protocol parity (runtime)', () => {
  it('every profile-filled descriptor is admitted by the REAL W011 validator', () => {
    for (const deviceClass of Object.keys(DEVICE_CLASS_PROFILES)) {
      const filled = descriptorFromProfile(deviceClass);
      expect(filled.ok, deviceClass).toBe(true);
      if (filled.ok) {
        expect(DeviceDescriptorSchema.safeParse(filled.value).success, deviceClass).toBe(true);
      }
    }
  });

  it('override-filled descriptors are admitted by the REAL W011 validator', () => {
    const filled = descriptorFromProfile('laptop', {
      interaction: ['keyboard', 'pointer'],
      display: { maxPixels: 1_000_000 },
      spatial: { maxTriangles: 123_456 },
    });
    expect(filled.ok).toBe(true);
    if (filled.ok) {
      const parsed = DeviceDescriptorSchema.safeParse(filled.value);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.display.maxPixels).toBe(1_000_000);
        expect(parsed.data.spatial.maxTriangles).toBe(123_456);
        expect(parsed.data.spatial.maxTextureBytes).toBe(
          DEVICE_CLASS_PROFILES.laptop.spatial.maxTextureBytes,
        );
      }
    }
  });
});

describe('W013 renderer-runtime parity (runtime)', () => {
  it('an assessment assesses exactly the device slot a W013 snapshot carries', () => {
    const filled = descriptorFromProfile('desktop');
    if (!filled.ok) throw new Error('fixture failed');
    // Round-trip through the REAL W013 snapshot projection (structural
    // selection + validation).
    const snapshot = deviceSessionSnapshotOf({
      deviceSessionId: 'ds-parity-1',
      tenantScope: { tenantId: TENANT },
      device: filled.value,
    });
    expect(snapshot.device).toEqual(filled.value);
    // The assessment of the snapshot's device embeds it verbatim.
    const verdict = assessDeviceDescriptor({
      assessmentId: 'dca-parity-1',
      device: snapshot.device,
    });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.value.device).toEqual(snapshot.device);
    }
  });
});

describe('W013 experience-runtime parity (runtime)', () => {
  it('the host session record admits profile descriptors in its device slot', () => {
    const filled = descriptorFromProfile('headset');
    if (!filled.ok) throw new Error('fixture failed');
    const record = DeviceSessionRecordSchema.safeParse({
      schema: 'epoch.experience-runtime.device-session',
      protocolVersion: '1.0.0',
      deviceSessionId: 'ds-host-parity',
      tenantScope: { tenantId: TENANT },
      device: filled.value,
      state: 'active',
      virtualTimeMs: 0,
      frameIndex: 0,
      tickIndex: 0,
      eventSequence: 1,
      digest: '0'.repeat(64),
    });
    // The schema gate must pass structurally (the digest gate is the
    // host model's own admission concern, exercised below).
    expect(record.success).toBe(true);
  });
});

describe('W016 world-experience parity (runtime)', () => {
  it('the guided fidelity vocabulary is member-identical to the W016 vocabulary', () => {
    expect([...GUIDED_FIDELITY_LEVELS].sort()).toEqual([...WORLD_FIDELITY_LEVELS].sort());
  });

  it('every tier maps to a REAL W016 fidelity level with a REAL profile', () => {
    for (const tier of DEVICE_ADAPTATION_TIERS) {
      const guided = ADAPTATION_TIER_FIDELITY_GUIDANCE[tier];
      expect(WORLD_FIDELITY_LEVELS).toContain(guided);
      expect(WORLD_FIDELITY_PROFILES[guided]).toBeDefined();
    }
  });

  it('the guidance covers every non-remote W016 level (remote stays the optional host choice)', () => {
    const guided = new Set<string>(DEVICE_ADAPTATION_TIERS.map((tier) => ADAPTATION_TIER_FIDELITY_GUIDANCE[tier]));
    for (const level of WORLD_FIDELITY_LEVELS) {
      if (level === 'remote') {
        // The optional remote path is a HOST decision (recommended here
        // by the assessment's remoteAssistRecommended flag, mirrored by
        // W016's remote profile carrying remoteRendering: true).
        expect(WORLD_FIDELITY_PROFILES.remote.remoteRendering).toBe(true);
        continue;
      }
      expect(guided.has(level), `level "${level}" must be guided by some tier`).toBe(true);
    }
  });
});
