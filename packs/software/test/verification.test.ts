// NAMED POSITIVE: verification-method descriptors — the four software
// verification kinds referencing the W006 provenance conventions; the
// gate-description fold over W036 verification gates.
import { describe, expect, it } from 'vitest';
import {
  describeVerificationGates,
  PACK_CONFIDENCE_METHODS,
  SOFTWARE_VERIFICATION_METHODS,
} from '../src/index';
import { sealedProgram, sealedSolution } from './fixtures';

describe('NAMED POSITIVE: verification-method descriptors', () => {
  it('every descriptor carries a W006 confidence method and evidence convention', () => {
    for (const method of SOFTWARE_VERIFICATION_METHODS) {
      expect(PACK_CONFIDENCE_METHODS).toContain(method.confidenceMethod);
      expect(method.evidenceConvention.length).toBeGreaterThan(0);
      expect(method.schema).toBe('epoch.pack-software.verification-method');
    }
  });

  it('the pack confidence methods mirror the W006 vocabulary (pinned at runtime in parity.test.ts)', () => {
    expect([...PACK_CONFIDENCE_METHODS].sort()).toEqual([
      'derived',
      'estimated',
      'imported',
      'measured',
      'stated',
    ]);
  });
});

describe('NAMED POSITIVE: the gate-description fold (descriptors, never an authority)', () => {
  it('every fixture gate describes with its matched software method', () => {
    const program = sealedProgram(sealedSolution());
    const gates = program.workPackages.flatMap((workPackage) => workPackage.verificationGates);
    const described = describeVerificationGates(gates, SOFTWARE_VERIFICATION_METHODS);
    expect(described).toHaveLength(8);
    const byId = new Map(described.map((gate) => [gate.gateId, gate]));
    expect(byId.get('gate:api-review')?.softwareKind).toBe('review-approval');
    expect(byId.get('gate:api-test-suite')?.softwareKind).toBe('test-suite-pass');
    expect(byId.get('gate:staging-deploy-gate')?.softwareKind).toBe('deploy-gate');
    expect(byId.get('gate:production-slo-check')?.softwareKind).toBe('slo-check');
    expect(byId.get('gate:staging-slo-check')?.softwareMethodId).toBe('software.verify.slo-check');
    expect(byId.get('gate:staging-slo-check')?.passedAt).toBeDefined();
  });

  it('an unknown method reference describes with undefined software terms (partial data)', () => {
    const described = describeVerificationGates(
      [
        {
          gateId: 'gate:foreign',
          activityId: 'activity:any',
          title: 'A gate with a foreign method reference',
          method: 'some.other.method',
          evidence: [],
        },
      ],
      SOFTWARE_VERIFICATION_METHODS,
    );
    expect(described[0]?.softwareMethodId).toBeUndefined();
    expect(described[0]?.softwareKind).toBeUndefined();
  });

  it('the fold is sorted by gateId and permutation-invariant', () => {
    const program = sealedProgram(sealedSolution());
    const gates = program.workPackages.flatMap((workPackage) => workPackage.verificationGates);
    const forward = describeVerificationGates(gates, SOFTWARE_VERIFICATION_METHODS);
    const permuted = describeVerificationGates([...gates].reverse(), SOFTWARE_VERIFICATION_METHODS);
    expect(permuted).toEqual(forward);
  });
});
