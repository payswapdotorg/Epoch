// ERROR AND VARIANCE FEATURES: the deterministic per-row derivations —
// direction via the class polarity table, magnitude band via
// caller-supplied thresholds, attribution cause kinds (plus the
// learning-local `unattributed`), zero float math, identical inputs
// derive identical features.
import { describe, expect, it } from 'vitest';
import {
  deriveDirection,
  deriveErrorVarianceFeatures,
  deriveMagnitudeBand,
  type ErrorVarianceFeatures,
  type LearningBandThresholds,
} from '../src/features';
import type { VarianceEvidence } from '../src/references';
import {
  ATTRIBUTION_UNATTRIBUTED,
  LEARNING_VARIANCE_CLASS_POLARITY,
  type LearningVarianceClass,
} from '../src/version';
import { expectError, unwrap } from './helpers';

const THRESHOLDS: LearningBandThresholds = { minor: '5', material: '20', severe: '50' };

function varianceEvidence(attribution: VarianceEvidence['attribution']): VarianceEvidence {
  return {
    varianceClass: 'quantity',
    varianceRecordRef: {
      recordId: 'variance:pit-volume-f1-a1',
      contentDigest: '4'.repeat(64),
    },
    attribution,
  };
}

const ATTRIBUTED: VarianceEvidence['attribution'] = {
  cause: {
    causeKind: 'change-record',
    recordId: 'change:pit-volume-design-revision',
    contentDigest: '5'.repeat(64),
  },
  evidence: ['a'.repeat(64), 'b'.repeat(64)],
};

describe('direction derivation (the class polarity table)', () => {
  it('higher-is-favorable classes: under-forecast is favorable, over-forecast is adverse', () => {
    expect(deriveDirection('quantity', 'under-forecast')).toBe('favorable');
    expect(deriveDirection('quantity', 'over-forecast')).toBe('adverse');
    expect(deriveDirection('productivity', 'under-forecast')).toBe('favorable');
  });

  it('lower-is-favorable classes: over-forecast is favorable, under-forecast is adverse', () => {
    expect(deriveDirection('price-rate', 'over-forecast')).toBe('favorable');
    expect(deriveDirection('price-rate', 'under-forecast')).toBe('adverse');
    expect(deriveDirection('waste', 'over-forecast')).toBe('favorable');
    expect(deriveDirection('schedule', 'under-forecast')).toBe('adverse');
  });

  it('direction-neutral classes (change) are always neutral; exact comparisons are always neutral', () => {
    expect(deriveDirection('change', 'over-forecast')).toBe('neutral');
    expect(deriveDirection('change', 'under-forecast')).toBe('neutral');
    for (const varianceClass of Object.keys(LEARNING_VARIANCE_CLASS_POLARITY) as LearningVarianceClass[]) {
      expect(deriveDirection(varianceClass, 'exact')).toBe('neutral');
    }
  });

  it('the polarity table covers every variance class (closed vocabulary)', () => {
    const classes = Object.keys(LEARNING_VARIANCE_CLASS_POLARITY);
    expect(classes.sort()).toEqual(
      [
        'quantity',
        'price-rate',
        'productivity',
        'schedule',
        'waste',
        'rework',
        'change',
        'external-condition',
      ].sort(),
    );
  });
});

describe('magnitude-band derivation (caller-supplied thresholds)', () => {
  it('zero deviation is immaterial; <= minor is minor; <= material is material; above material is severe (the W039 bandOf semantics)', () => {
    expect(deriveMagnitudeBand('0', THRESHOLDS)).toBe('immaterial');
    expect(deriveMagnitudeBand('5', THRESHOLDS)).toBe('minor');
    expect(deriveMagnitudeBand('5.000000001', THRESHOLDS)).toBe('material');
    expect(deriveMagnitudeBand('20', THRESHOLDS)).toBe('material');
    expect(deriveMagnitudeBand('20.5', THRESHOLDS)).toBe('severe');
    expect(deriveMagnitudeBand('50', THRESHOLDS)).toBe('severe');
    expect(deriveMagnitudeBand('50.0000001', THRESHOLDS)).toBe('severe');
    expect(deriveMagnitudeBand('999', THRESHOLDS)).toBe('severe');
  });

  it('exact decimal comparison — no float boundary drift', () => {
    expect(deriveMagnitudeBand('0.1', THRESHOLDS)).toBe('minor');
    expect(deriveMagnitudeBand('0.30000000000000004', THRESHOLDS)).toBe('minor');
    expect(deriveMagnitudeBand('19.9999999999', THRESHOLDS)).toBe('material');
  });
});

describe('the complete feature derivation', () => {
  it('derives the full typed vector deterministically (attributed case)', () => {
    const first = unwrap(
      deriveErrorVarianceFeatures('11.5', 'over-forecast', THRESHOLDS, varianceEvidence(ATTRIBUTED)),
    );
    const second = unwrap(
      deriveErrorVarianceFeatures('11.5', 'over-forecast', THRESHOLDS, varianceEvidence(ATTRIBUTED)),
    );
    expect(second).toEqual(first);
    const features = first as ErrorVarianceFeatures;
    expect(features.deviationMagnitude).toBe('11.5');
    expect(features.bias).toBe('over-forecast');
    expect(features.varianceClass).toBe('quantity');
    expect(features.direction).toBe('adverse');
    expect(features.magnitudeBand).toBe('material');
    expect(features.attributionCauseKind).toBe('change-record');
    expect(features.attributionEvidenceCount).toBe(2);
  });

  it('an unattributed comparison derives the `unattributed` feature kind with zero evidence', () => {
    const features = unwrap(
      deriveErrorVarianceFeatures('3', 'under-forecast', THRESHOLDS, varianceEvidence(null)),
    );
    expect(features.attributionCauseKind).toBe(ATTRIBUTION_UNATTRIBUTED);
    expect(features.attributionEvidenceCount).toBe(0);
    expect(features.direction).toBe('favorable');
    expect(features.magnitudeBand).toBe('minor');
  });

  it('every mirrored cause kind surfaces as the feature kind', () => {
    const causes = [
      { causeKind: 'change-record', recordId: 'change:x', contentDigest: '5'.repeat(64) },
      { causeKind: 'issue-record', recordId: 'delay:x', contentDigest: '5'.repeat(64) },
      { causeKind: 'external-condition', recordId: 'weather:storm', contentDigest: '5'.repeat(64) },
    ] as const;
    for (const cause of causes) {
      const features = unwrap(
        deriveErrorVarianceFeatures('1', 'over-forecast', THRESHOLDS, {
          varianceClass: 'quantity',
          varianceRecordRef: {
            recordId: 'variance:pit-volume-f1-a1',
            contentDigest: '4'.repeat(64),
          },
          attribution: { cause, evidence: ['c'.repeat(64)] },
        }),
      );
      expect(features.attributionCauseKind).toBe(cause.causeKind);
      expect(features.attributionEvidenceCount).toBe(1);
    }
  });

  it('descending thresholds are a typed validation rejection (never implicit defaults)', () => {
    const error = expectError(
      deriveErrorVarianceFeatures('1', 'over-forecast', { minor: '9', material: '2', severe: '5' }, varianceEvidence(null)),
    );
    expect(error.code).toBe('validation');
  });
});
