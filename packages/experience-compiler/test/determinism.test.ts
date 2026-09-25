// Deterministic compilation: identical (envelope, device) inputs compile
// to byte-identical plans (canonical JSON, sorted iteration, stable
// digests); key-order permutations of the envelope JSON do not change the
// plan; contract emission is deterministic. The negative halves (unsorted
// stage/op orders rejected) live in plan.admission.test.ts.
import { describe, expect, it } from 'vitest';
import type { JsonValue } from '@epoch/agent-protocol';
import {
  compileExperienceGraph,
  renderExperienceCompilerContractFiles,
  serializeRenderPlan,
} from '../src/index';
import {
  compiledPlan,
  desktopDevice,
  sealedGraph,
} from './fixtures';

/** Recursively shuffles object key order (deterministic permutation). */
function permuteKeys(value: JsonValue, flip: boolean): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => permuteKeys(item, !flip));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => [k, permuteKeys(v, !flip)] as const);
    const ordered = flip ? [...entries].reverse() : entries;
    return Object.fromEntries(ordered);
  }
  return value;
}

describe('deterministic compilation (positive)', () => {
  it('identical (envelope, device) inputs compile to byte-identical plans', () => {
    for (const kind of [
      '2d',
      '3d',
      'animation',
      'narrative',
      'timeline-replay',
      'presence',
      'controls',
    ] as const) {
      const first = compileExperienceGraph({ envelope: sealedGraph(kind), device: desktopDevice() });
      const second = compileExperienceGraph({ envelope: sealedGraph(kind), device: desktopDevice() });
      expect(first.ok, `${kind} must compile`).toBe(true);
      expect(second.ok, `${kind} must compile`).toBe(true);
      if (first.ok && second.ok) {
        expect(serializeRenderPlan(first.value)).toBe(serializeRenderPlan(second.value));
        expect(first.value.digest).toBe(second.value.digest);
      }
    }
  });

  it('key-order permutations of the envelope JSON produce identical plan bytes', () => {
    const envelope = JSON.parse(JSON.stringify(sealedGraph('timeline-replay'))) as JsonValue;
    const permuted = permuteKeys(envelope, true);
    const first = compileExperienceGraph({ envelope, device: desktopDevice() });
    const second = compileExperienceGraph({ envelope: permuted, device: desktopDevice() });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(serializeRenderPlan(first.value)).toBe(serializeRenderPlan(second.value));
      expect(first.value.digest).toBe(second.value.digest);
    }
  });

  it('compiling the same envelope twice from parsed serializations is stable', () => {
    const plan = compiledPlan('narrative');
    const serialized = serializeRenderPlan(plan);
    const reparsed = compileExperienceGraph({
      envelope: JSON.parse(JSON.stringify(sealedGraph('narrative'))),
      device: JSON.parse(JSON.stringify(desktopDevice())),
    });
    expect(reparsed.ok).toBe(true);
    if (reparsed.ok) {
      expect(serializeRenderPlan(reparsed.value)).toBe(serialized);
    }
  });

  it('a different target device yields a different plan digest (device is compiled-in)', () => {
    const desktop = compileExperienceGraph({
      envelope: sealedGraph('2d'),
      device: desktopDevice(),
    });
    const phoneDevice = {
      descriptorVersion: 1,
      deviceClass: 'phone' as const,
      interaction: ['touch', 'voice'] as const,
      display: { stereoscopic: false, maxPixels: 2_272_512, refreshHz: 120 },
      spatial: { poseTracking: 'none' as const, worldAnchored: false },
      latencyBudgetMs: 50,
    };
    const phone = compileExperienceGraph({ envelope: sealedGraph('2d'), device: phoneDevice });
    expect(desktop.ok).toBe(true);
    expect(phone.ok).toBe(true);
    if (desktop.ok && phone.ok) {
      expect(desktop.value.digest).not.toBe(phone.value.digest);
    }
  });

  it('contract emission is deterministic (two renders are byte-identical)', () => {
    expect(renderExperienceCompilerContractFiles()).toEqual(
      renderExperienceCompilerContractFiles(),
    );
  });
});
