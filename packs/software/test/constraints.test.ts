// NAMED POSITIVE: constraint descriptors — W004-compatible policy bindings
// (parity-pinned in test/parity.test.ts), category coverage, the lookup
// fold.
import { describe, expect, it } from 'vitest';
import {
  CONSTRAINT_ID_PATTERN,
  SOFTWARE_CONSTRAINT_DESCRIPTORS,
  findConstraintDescriptor,
} from '../src/index';

describe('NAMED POSITIVE: software constraint descriptors', () => {
  it('every descriptor carries a W004-grammar constraint id and a matching policy binding', () => {
    for (const descriptor of SOFTWARE_CONSTRAINT_DESCRIPTORS) {
      expect(descriptor.constraintId).toMatch(CONSTRAINT_ID_PATTERN);
      expect(descriptor.policyBinding.constraintId).toBe(descriptor.constraintId);
      expect(descriptor.schema).toBe('epoch.pack-software.constraint-descriptor');
    }
  });

  it('the categories cover security/compliance/technical/operational/commercial', () => {
    const categories = SOFTWARE_CONSTRAINT_DESCRIPTORS.map((d) => d.category).sort();
    expect(categories).toEqual([
      'commercial',
      'compliance',
      'operational',
      'security',
      'technical',
    ]);
  });

  it('the fixture constraint references resolve through the lookup fold', () => {
    expect(findConstraintDescriptor(SOFTWARE_CONSTRAINT_DESCRIPTORS, 'deployment-change-freeze')).toBeDefined();
    expect(findConstraintDescriptor(SOFTWARE_CONSTRAINT_DESCRIPTORS, 'service-level-objective')).toBeDefined();
    expect(
      findConstraintDescriptor(SOFTWARE_CONSTRAINT_DESCRIPTORS, 'data-residency-region'),
    ).toBeDefined();
    expect(
      findConstraintDescriptor(SOFTWARE_CONSTRAINT_DESCRIPTORS, 'an-unknown-constraint'),
    ).toBeUndefined();
  });

  it('the lookup fold is deterministic under descriptor permutation', () => {
    const forward = findConstraintDescriptor(
      SOFTWARE_CONSTRAINT_DESCRIPTORS,
      'deployment-change-freeze',
    );
    const permuted = findConstraintDescriptor(
      [...SOFTWARE_CONSTRAINT_DESCRIPTORS].reverse(),
      'deployment-change-freeze',
    );
    expect(permuted).toEqual(forward);
  });
});
