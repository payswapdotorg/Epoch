// NAMED POSITIVE: verification-method descriptors and the gate-description
// fold over the W036 verification gates of the fixture program.
import { describe, expect, it } from 'vitest';
import {
  CONSTRUCTION_VERIFICATION_METHODS,
  describeVerificationGates,
} from '../src/index';
import { sealedProgram, sealedSolution } from './fixtures';

describe('NAMED POSITIVE: verification-method descriptors', () => {
  it('the four construction verification kinds each carry exactly one descriptor', () => {
    const kinds = CONSTRUCTION_VERIFICATION_METHODS.map((method) => method.kind);
    expect([...kinds].sort()).toEqual([
      'commissioning-test',
      'inspection',
      'material-certificate',
      'measurement-against-boq',
    ]);
  });

  it('every descriptor references the W006 confidence-method and provenance conventions', () => {
    for (const method of CONSTRUCTION_VERIFICATION_METHODS) {
      expect(['stated', 'measured', 'estimated', 'derived', 'imported']).toContain(
        method.confidenceMethod,
      );
      expect(method.evidenceConvention).toContain('W006');
    }
  });
});

describe('NAMED POSITIVE: the gate-description fold (construction vocabulary over gates)', () => {
  it('the fixture gates describe with the matched construction verification methods', () => {
    const solution = sealedSolution();
    const program = sealedProgram(solution);
    const gates = program.workPackages.flatMap((workPackage) => workPackage.verificationGates);
    const described = describeVerificationGates(gates, CONSTRUCTION_VERIFICATION_METHODS);
    expect(described.map((gate) => gate.gateId)).toEqual([
      'gate:door-commissioning',
      'gate:facade-inspection',
      'gate:formation-inspection',
      'gate:foundation-measurement',
      'gate:steel-certificate',
    ]);
    const byId = new Map(described.map((gate) => [gate.gateId, gate]));
    expect(byId.get('gate:formation-inspection')?.constructionKind).toBe('inspection');
    expect(byId.get('gate:formation-inspection')?.passedAt).toBeDefined();
    expect(byId.get('gate:foundation-measurement')?.constructionKind).toBe('measurement-against-boq');
    expect(byId.get('gate:steel-certificate')?.constructionKind).toBe('material-certificate');
    expect(byId.get('gate:door-commissioning')?.constructionKind).toBe('commissioning-test');
  });

  it('an unmatched opaque method reference describes with undefined construction terms (SN1.0)', () => {
    const described = describeVerificationGates(
      [
        {
          gateId: 'gate:external-method',
          activityId: 'activity:door-install',
          title: 'External verifier method',
          method: 'method:foreign-verification',
          evidence: [],
        },
      ],
      CONSTRUCTION_VERIFICATION_METHODS,
    );
    expect(described).toHaveLength(1);
    expect(described[0]!.constructionMethodId).toBeUndefined();
    expect(described[0]!.constructionKind).toBeUndefined();
    expect(described[0]!.gateId).toBe('gate:external-method');
  });

  it('the fold is deterministic under gate-order permutation', () => {
    const solution = sealedSolution();
    const program = sealedProgram(solution);
    const gates = program.workPackages.flatMap((workPackage) => workPackage.verificationGates);
    const forward = describeVerificationGates(gates, CONSTRUCTION_VERIFICATION_METHODS);
    const backward = describeVerificationGates([...gates].reverse(), CONSTRUCTION_VERIFICATION_METHODS);
    expect(backward).toEqual(forward);
  });
});
