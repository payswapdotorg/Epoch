// NAMED POSITIVE: constraint descriptors (W004-compatible vocabulary) and
// the descriptor lookup fold.
import { describe, expect, it } from 'vitest';
import { policyBindingSchema } from '@epoch/policy-contracts';
import {
  CONSTRUCTION_CONSTRAINT_DESCRIPTORS,
  findConstraintDescriptor,
} from '../src/index';

describe('NAMED POSITIVE: construction constraint descriptors', () => {
  it('every descriptor policy binding PARSES through the W004 policyBindingSchema', () => {
    for (const descriptor of CONSTRUCTION_CONSTRAINT_DESCRIPTORS) {
      const parsed = policyBindingSchema.safeParse(descriptor.policyBinding);
      expect(parsed.success, descriptor.constraintId).toBe(true);
    }
  });

  it('the categories cover safety, regulatory, technical, environmental and commercial', () => {
    const categories = CONSTRUCTION_CONSTRAINT_DESCRIPTORS.map(
      (descriptor) => descriptor.category,
    );
    for (const category of ['safety', 'regulatory', 'technical', 'environmental', 'commercial']) {
      expect(categories).toContain(category);
    }
  });

  it('the fixture constraint references (max-building-height, site-access-window) resolve', () => {
    expect(findConstraintDescriptor(CONSTRUCTION_CONSTRAINT_DESCRIPTORS, 'max-building-height')?.category).toBe('regulatory');
    expect(findConstraintDescriptor(CONSTRUCTION_CONSTRAINT_DESCRIPTORS, 'site-access-window')?.category).toBe('technical');
  });

  it('an unknown constraint id describes as undefined (partial data, never a blocker)', () => {
    expect(
      findConstraintDescriptor(CONSTRUCTION_CONSTRAINT_DESCRIPTORS, 'no-such-constraint'),
    ).toBeUndefined();
  });

  it('a descriptor whose policyBinding disagrees with its constraintId is rejected', async () => {
    const { ConstructionConstraintDescriptorSchema } = await import('../src/index');
    const base = CONSTRUCTION_CONSTRAINT_DESCRIPTORS[0]!;
    const mismatched = {
      ...base,
      policyBinding: { constraintId: 'different-constraint' },
    };
    const parsed = ConstructionConstraintDescriptorSchema.safeParse(mismatched);
    expect(parsed.success).toBe(false);
  });
});
