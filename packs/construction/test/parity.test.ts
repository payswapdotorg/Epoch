// Runtime parity with the sibling kernel vocabularies (the devDependency
// parity test — mirrors src/parity.ts at runtime; never a runtime
// dependency): the W036 universal stages, the W006 confidence methods, the
// W004 policy-binding grammar, the W007 capability-id grammar, the W002
// type-key grammar, and the agent-protocol digest machinery.
import { describe, expect, it } from 'vitest';
import { UNIVERSAL_LIFECYCLE_STAGES } from '@epoch/solution-delivery';
import { CONFIDENCE_METHODS } from '@epoch/evidence';
import { policyBindingSchema, type PolicyBinding } from '@epoch/policy-contracts';
import { CapabilityIdSchema } from '@epoch/capability-registry';
import { TypeKeySchema } from '@epoch/world-model';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  CONSTRUCTION_CAPABILITY_DEPENDENCIES,
  CONSTRUCTION_ENTITY_BINDINGS,
  CONSTRUCTION_STAGE_VOCABULARY,
  CONSTRUCTION_VERIFICATION_METHODS,
  digestPackProfile,
  constructionPackProfile,
  sealConstructionProfile,
  PACK_CONFIDENCE_METHODS,
} from '../src/index';
import { TENANT } from './fixtures';

describe('runtime parity: the pack vocabulary references the kernel grammars', () => {
  it('the stage vocabulary keys ARE the eleven universal lifecycle stages (W036 parity)', () => {
    expect(Object.keys(CONSTRUCTION_STAGE_VOCABULARY).sort()).toEqual(
      [...UNIVERSAL_LIFECYCLE_STAGES].sort(),
    );
  });

  it('the mirrored confidence-method vocabulary IS the W006 CONFIDENCE_METHODS (W006 parity)', () => {
    expect([...PACK_CONFIDENCE_METHODS].sort()).toEqual([...CONFIDENCE_METHODS].sort());
    for (const method of CONSTRUCTION_VERIFICATION_METHODS) {
      expect(CONFIDENCE_METHODS).toContain(method.confidenceMethod);
    }
  });

  it('every constraint descriptor policyBinding parses through the W004 schema (W004 parity)', async () => {
    const { CONSTRUCTION_CONSTRAINT_DESCRIPTORS } = await import('../src/index');
    for (const descriptor of CONSTRUCTION_CONSTRAINT_DESCRIPTORS) {
      const parsed = policyBindingSchema.safeParse(descriptor.policyBinding);
      expect(parsed.success, descriptor.constraintId).toBe(true);
      if (parsed.success) {
        const binding: PolicyBinding = parsed.data;
        expect(binding.constraintId).toBe(descriptor.policyBinding.constraintId);
      }
    }
  });

  it('the capability dependencies parse through the W007 CapabilityIdSchema (W007 parity)', () => {
    for (const capabilityId of CONSTRUCTION_CAPABILITY_DEPENDENCIES) {
      expect(CapabilityIdSchema.safeParse(capabilityId).success, capabilityId).toBe(true);
    }
  });

  it('the entity-binding type keys parse through the W002 TypeKeySchema (W002 parity)', () => {
    for (const binding of CONSTRUCTION_ENTITY_BINDINGS) {
      expect(TypeKeySchema.safeParse(binding.entityTypeKey).success, binding.entityTypeKey).toBe(true);
    }
  });

  it('the pack digest machinery IS the agent-protocol canonicalDigest (digest parity)', () => {
    const profile = constructionPackProfile(TENANT);
    expect(digestPackProfile(profile)).toBe(canonicalDigest(profile as never));
    const sealed = sealConstructionProfile(profile);
    expect(sealed.contentDigest).toBe(canonicalDigest(profile as never));
  });
});
