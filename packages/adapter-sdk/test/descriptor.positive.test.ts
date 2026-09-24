// Positive tests: descriptor validation, deterministic serialization,
// and content addressing.
import { describe, expect, it } from 'vitest';
import { CAPABILITY_FABRIC_CATEGORIES } from '@epoch/agent-protocol';
import type { AdapterDescriptor } from '../src/index';
import {
  computeAdapterDescriptorDigest,
  parseAdapterDescriptor,
  serializeAdapterDescriptor,
  validateAdapterDescriptor,
} from '../src/index';
import { descriptor } from './helpers';

/** Unwrap a successful parse (asserts success for the test reader). */
function parsedOf(input: unknown): AdapterDescriptor {
  const result = parseAdapterDescriptor(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected a valid descriptor fixture');
  return result.value;
}

describe('adapter descriptor validation (positive)', () => {
  it.each([...CAPABILITY_FABRIC_CATEGORIES])('accepts a valid %s-category descriptor', (category) => {
    const result = parseAdapterDescriptor(
      descriptor({
        category,
        adapterId: `adapter:fixture-${category.replace(/-/g, '')}`,
      }),
    );
    expect(result.ok, category).toBe(true);
    if (!result.ok) return;
    expect(result.value.category).toBe(category);
  });

  it('accepts exact-pinned and caret version ranges', () => {
    expect(
      parseAdapterDescriptor(
        descriptor({ binding: { capabilityId: 'engineering.stress-analysis', versionRange: { kind: 'exact', version: '1.2.3' } } }),
      ).ok,
    ).toBe(true);
    expect(parseAdapterDescriptor(descriptor()).ok).toBe(true);
  });

  it('the throwing variant returns the parsed descriptor', () => {
    const value = validateAdapterDescriptor(descriptor());
    expect(value.adapterId).toBe('adapter:stress-solver');
  });
});

describe('deterministic descriptor serialization (positive)', () => {
  it('equivalent descriptors (different key order) serialize identically', () => {
    const left = serializeAdapterDescriptor(parsedOf(descriptor()));
    const right = serializeAdapterDescriptor(
      parsedOf({
        binding: {
          versionRange: { version: '1.0.0', kind: 'caret' },
          capabilityId: 'engineering.stress-analysis',
        },
        description: 'Runs the registered stress-analysis capability.',
        displayName: 'Stress Solver Adapter',
        category: 'simulation',
        adapterId: 'adapter:stress-solver',
        schemaVersion: 1,
      }),
    );
    expect(left).toBe(right);
  });

  it('the digest is stable across key orders and equal to the canonical-JSON SHA-256', () => {
    const one = parsedOf(descriptor());
    const two = parsedOf({
      binding: {
        versionRange: { version: '1.0.0', kind: 'caret' },
        capabilityId: 'engineering.stress-analysis',
      },
      description: 'Runs the registered stress-analysis capability.',
      displayName: 'Stress Solver Adapter',
      category: 'simulation',
      adapterId: 'adapter:stress-solver',
      schemaVersion: 1,
    });
    expect(computeAdapterDescriptorDigest(one)).toBe(computeAdapterDescriptorDigest(two));
  });

  it('serializing an invalid descriptor throws (programming-error discipline)', () => {
    const bogus = descriptor({ adapterId: 'not-an-adapter-id' }) as never;
    expect(() => serializeAdapterDescriptor(bogus)).toThrow(/invalid adapter descriptor/);
  });
});
