// Determinism + provider-neutrality battery: byte-identical selections,
// content addressing, and zero vendor/engine vocabulary.
import { describe, expect, it } from 'vitest';
import {
  selectRendererAdapter,
  planMount,
  mountEnvelopeOf,
  RENDERER_TECHNIQUES,
  SELECTION_REASONS,
  ELIGIBILITY_REASONS,
  RENDERER_ADAPTERS_ERROR_CODES,
  RENDERER_TECHNIQUE_CATALOG,
  RendererAdapterSelectionSchema,
  RendererTechniqueRecordSchema,
} from '../src/index';
import { boundSession, desktopDevice, assess, FULL_RENDERER } from './fixtures';

describe('determinism', () => {
  it('the same inputs yield byte-identical selections', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-det');
    const first = selectRendererAdapter({ selectionId: 'ras-det', binding, assessment });
    const second = selectRendererAdapter({ selectionId: 'ras-det', binding, assessment });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
    }
  });

  it('a different selection id yields a different content digest', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-det-2');
    const first = selectRendererAdapter({ selectionId: 'ras-det-a', binding, assessment });
    const second = selectRendererAdapter({ selectionId: 'ras-det-b', binding, assessment });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.digest).not.toBe(second.value.digest);
    }
  });

  it('input key order does not change the selection digest', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-det-3');
    const reorderedBinding = {
      effective: binding.effective,
      device: binding.device,
      renderer: binding.renderer,
      invocationCount: binding.invocationCount,
      state: binding.state,
      boundAtMs: binding.boundAtMs,
      rendererSessionId: binding.rendererSessionId,
      protocolVersion: binding.protocolVersion,
      schema: binding.schema,
      digest: binding.digest,
    };
    const first = selectRendererAdapter({ selectionId: 'ras-det-3', binding, assessment });
    const second = selectRendererAdapter({
      selectionId: 'ras-det-3',
      binding: reorderedBinding,
      assessment,
    });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.digest).toBe(second.value.digest);
    }
  });

  it('planning is deterministic across repeated calls', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-det-4');
    const selection = selectRendererAdapter({ selectionId: 'ras-det-4', binding, assessment });
    if (!selection.ok) throw new Error('fixture failed');
    const first = planMount({
      planId: 'rmp-det',
      invocationId: 'inv-det',
      selection: selection.value,
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
    });
    const second = planMount({
      planId: 'rmp-det',
      invocationId: 'inv-det',
      selection: selection.value,
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
    });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
    }
  });

  it('the envelope projection is deterministic', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-det-5');
    const selection = selectRendererAdapter({ selectionId: 'ras-det-5', binding, assessment });
    if (!selection.ok) throw new Error('fixture failed');
    const planned = planMount({
      planId: 'rmp-det-2',
      invocationId: 'inv-det-2',
      selection: selection.value,
      graphDigest: 'a'.repeat(64),
      graphKind: '3d',
    });
    if (!planned.ok) throw new Error('fixture failed');
    const first = mountEnvelopeOf(planned.value);
    const second = mountEnvelopeOf(planned.value);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
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
    'quest',
    'hololens',
  ];

  it('the closed vocabularies carry no vendor/engine words', () => {
    for (const vocabulary of [
      RENDERER_TECHNIQUES,
      SELECTION_REASONS,
      ELIGIBILITY_REASONS,
      RENDERER_ADAPTERS_ERROR_CODES,
    ]) {
      const joined = vocabulary.join(',').toLowerCase();
      for (const word of VENDOR_WORDS) {
        expect(joined, `vocabulary must not contain "${word}"`).not.toContain(word);
      }
    }
  });

  it('the technique catalog carries no vendor/engine words', () => {
    const joined = Object.values(RENDERER_TECHNIQUE_CATALOG)
      .map((record) => JSON.stringify(record))
      .join(',')
      .toLowerCase();
    for (const word of VENDOR_WORDS) {
      expect(joined).not.toContain(word);
    }
  });

  it('the closed vocabularies are sorted and duplicate-free', () => {
    for (const vocabulary of [
      RENDERER_TECHNIQUES,
      SELECTION_REASONS,
      ELIGIBILITY_REASONS,
      RENDERER_ADAPTERS_ERROR_CODES,
    ]) {
      expect([...vocabulary]).toEqual([...vocabulary].sort());
      expect(new Set(vocabulary).size).toBe(vocabulary.length);
    }
  });

  it('a selection record with a vendor field fails strict admission', () => {
    const binding = boundSession(FULL_RENDERER);
    const assessment = assess(desktopDevice(), 'dca-neutral');
    const selection = selectRendererAdapter({ selectionId: 'ras-neutral', binding, assessment });
    if (!selection.ok) throw new Error('fixture failed');
    const vendored = { ...selection.value, engine: 'some-engine' };
    expect(RendererAdapterSelectionSchema.safeParse(vendored).success).toBe(false);
  });

  it('a technique record that drifts from the catalog is rejected', () => {
    const drifted = {
      technique: 'immediate-2d',
      graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'],
      stereoscopic: false,
      executionClass: 'local',
    };
    expect(RendererTechniqueRecordSchema.safeParse(drifted).success).toBe(false);
  });
});
