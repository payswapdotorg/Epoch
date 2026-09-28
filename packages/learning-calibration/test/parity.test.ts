// RUNTIME PARITY with the sibling kernel vocabularies (the W036/W037/W038/
// W039 kernel-parity pattern; devDependencies only — no runtime coupling):
//
// - W039 actualization: the mirrored comparison-fact input is sealed by
//   the REAL @epoch/actualization sealComparisonFact with IDENTICAL
//   digests, cross-verified in BOTH directions; the validation-state and
//   forecast-bias vocabularies are member-identical;
// - W039 variance: the variance class/direction/magnitude-band
//   vocabularies, the class polarity table, the band-thresholds grammar
//   and the root-cause grammar are member-identical;
// - W010 event-log: the mirrored learning-event shape is admitted by the
//   REAL sealEvent and digests identically through the REAL
//   computeEventDigest; the stream/actor grammars are pattern-identical;
//   the record versions are equal;
// - W036 solution-delivery: the outcome records this kernel folds are
//   sealed by the REAL W036 kernel and admitted by the outcome slot;
// - W007 capability-registry: a REAL source-category capability manifest
//   honoring the epoch/learning-calibration contract is admitted by the
//   REAL registry (external learning-record sources bind through the
//   capability fabric, never as vendor fields).
import { describe, expect, it } from 'vitest';
import {
  computeEventDigest,
  sealEvent,
  EVENT_ACTOR_PATTERN,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
} from '@epoch/event-log';
import {
  sealComparisonFact as sealRealComparisonFact,
  verifySealedComparisonFact as verifyRealComparisonFact,
  VALIDATION_STATES,
  FORECAST_BIAS_DIRECTIONS,
} from '@epoch/actualization';
import {
  VARIANCE_CLASSES,
  VARIANCE_CLASS_POLARITY,
  VARIANCE_DIRECTIONS,
  VARIANCE_MAGNITUDE_BANDS,
  ATTRIBUTION_CAUSE_KINDS,
  BandThresholdsSchema,
  AttributionCauseRefSchema,
} from '@epoch/variance';
import { CapabilityRegistry, computeCapabilityManifestDigest } from '@epoch/capability-registry';
import {
  LEARNING_CALIBRATION_CONTRACT_VERSION,
  LEARNING_EVENT_RECORD_VERSION,
  LEARNING_PRINCIPAL_ID_PATTERN,
  LEARNING_STREAM_ID_PATTERN,
  LEARNING_VALIDATION_STATES,
  LEARNING_FORECAST_BIAS_DIRECTIONS,
  LEARNING_VARIANCE_CLASS_POLARITY,
  LEARNING_VARIANCE_CLASSES,
  LEARNING_VARIANCE_DIRECTIONS,
  LEARNING_VARIANCE_MAGNITUDE_BANDS,
  LEARNING_ATTRIBUTION_CAUSE_KINDS,
  LearningBandThresholdsSchema,
  LearningCauseRefSchema,
  OutcomeRecordSlotSchema,
  PrincipalIdSchema,
  computeLearningEventDigest,
  learningStreamIdOf,
  sealLearningEvent,
  verifySealedComparisonFactInput,
} from '../src/index';
import {
  comparisonFactContent,
  outcomeContent,
  sealedComparisonFactInput,
  SOLUTION_ID,
  T3,
  TENANT,
  PRINCIPAL,
} from './fixtures';
import { unwrap } from './helpers';

describe('W039 actualization parity (runtime)', () => {
  it('the mirrored comparison fact seals IDENTICALLY through the REAL W039 kernel', () => {
    const content = comparisonFactContent();
    const ours = sealedComparisonFactInput();
    const theirs = unwrap(sealRealComparisonFact(content));
    expect(ours.contentDigest).toBe(theirs.contentDigest);
    expect(ours).toEqual(theirs);
  });

  it('the REAL W039 verify path admits the mirrored sealed fact (and vice versa)', () => {
    const ours = sealedComparisonFactInput();
    const theirs = unwrap(sealRealComparisonFact(comparisonFactContent()));
    expect(verifyRealComparisonFact(ours).ok).toBe(true);
    expect(verifySealedComparisonFactInput(theirs).ok).toBe(true);
    expect(unwrap(verifySealedComparisonFactInput(theirs)).contentDigest).toBe(
      ours.contentDigest,
    );
  });

  it('the mirrored validation-state vocabulary is member-identical', () => {
    expect([...LEARNING_VALIDATION_STATES]).toEqual([...VALIDATION_STATES]);
  });

  it('the mirrored forecast-bias vocabulary is member-identical', () => {
    expect([...LEARNING_FORECAST_BIAS_DIRECTIONS]).toEqual([...FORECAST_BIAS_DIRECTIONS]);
  });
});

describe('W039 variance parity (runtime)', () => {
  it('the variance-class vocabulary is member-identical', () => {
    expect([...LEARNING_VARIANCE_CLASSES]).toEqual([...VARIANCE_CLASSES]);
  });

  it('the class polarity table is deep-equal', () => {
    expect({ ...LEARNING_VARIANCE_CLASS_POLARITY }).toEqual({ ...VARIANCE_CLASS_POLARITY });
  });

  it('the variance-direction vocabulary is member-identical', () => {
    expect([...LEARNING_VARIANCE_DIRECTIONS]).toEqual([...VARIANCE_DIRECTIONS]);
  });

  it('the magnitude-band vocabulary is member-identical', () => {
    expect([...LEARNING_VARIANCE_MAGNITUDE_BANDS]).toEqual([...VARIANCE_MAGNITUDE_BANDS]);
  });

  it('the attribution cause-kind vocabulary is member-identical', () => {
    expect([...LEARNING_ATTRIBUTION_CAUSE_KINDS]).toEqual([...ATTRIBUTION_CAUSE_KINDS]);
  });

  it('the mirrored band-thresholds grammar admits the same records', () => {
    const thresholds = { minor: '5', material: '20', severe: '50' };
    expect(LearningBandThresholdsSchema.safeParse(thresholds).success).toBe(true);
    expect(BandThresholdsSchema.safeParse(thresholds).success).toBe(true);
    const descending = { minor: '50', material: '20', severe: '5' };
    expect(LearningBandThresholdsSchema.safeParse(descending).success).toBe(false);
    expect(BandThresholdsSchema.safeParse(descending).success).toBe(false);
  });

  it('the mirrored root-cause grammar admits the same records', () => {
    const cause = {
      causeKind: 'issue-record',
      recordId: 'delay:pit-weather-hold',
      contentDigest: 'a'.repeat(64),
    };
    expect(LearningCauseRefSchema.safeParse(cause).success).toBe(true);
    expect(AttributionCauseRefSchema.safeParse(cause).success).toBe(true);
    const foreign = { causeKind: 'vendor-record', recordId: 'x', contentDigest: 'a'.repeat(64) };
    expect(LearningCauseRefSchema.safeParse(foreign).success).toBe(false);
    expect(AttributionCauseRefSchema.safeParse(foreign).success).toBe(false);
  });
});

describe('W010 event-log parity (runtime)', () => {
  it('the mirrored learning stream pattern is exactly the W010 stream pattern', () => {
    expect(LEARNING_STREAM_ID_PATTERN.source).toBe(EVENT_STREAM_ID_PATTERN.source);
    expect(LEARNING_STREAM_ID_PATTERN.flags).toBe(EVENT_STREAM_ID_PATTERN.flags);
  });

  it('the mirrored actor grammar is exactly the W010 actor pattern (the W009 grammar)', () => {
    expect(LEARNING_PRINCIPAL_ID_PATTERN.source).toBe(EVENT_ACTOR_PATTERN.source);
    expect(LEARNING_PRINCIPAL_ID_PATTERN.flags).toBe(EVENT_ACTOR_PATTERN.flags);
  });

  it('the mirrored record version equals the W010 record version', () => {
    expect(LEARNING_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });

  it('a learning event is admitted by the REAL W010 seal path and digests identically', () => {
    const content = {
      schemaVersion: LEARNING_EVENT_RECORD_VERSION,
      streamId: learningStreamIdOf(SOLUTION_ID),
      sequence: 1,
      tenantId: TENANT,
      actor: PRINCIPAL,
      causalParent: null,
      payload: {
        discriminator: 'learning:dataset-assembled',
        data: {
          solutionId: SOLUTION_ID,
          datasetId: 'dataset:tower-retrofit-00000000',
          datasetDigest: 'a'.repeat(64),
          eligibleCount: 1,
          excludedCount: 0,
          assembledAt: T3,
        },
      },
      occurredAt: T3,
    };
    const ours = sealLearningEvent(content);
    expect(ours.ok).toBe(true);
    if (!ours.ok) return;
    const theirs = sealEvent(content);
    expect(theirs.ok, JSON.stringify(theirs)).toBe(true);
    if (!theirs.ok) return;
    expect(ours.value.contentDigest).toBe(theirs.value.digest);
    expect(computeLearningEventDigest(content as never)).toBe(theirs.value.digest);
    expect(computeEventDigest(content as never)).toBe(ours.value.contentDigest);
  });

  it('the REAL W010 digest path recomputes the sealed learning event digest', () => {
    const sealed = unwrap(
      sealLearningEvent({
        schemaVersion: LEARNING_EVENT_RECORD_VERSION,
        streamId: learningStreamIdOf(SOLUTION_ID),
        sequence: 2,
        tenantId: TENANT,
        actor: PRINCIPAL,
        causalParent: { streamId: learningStreamIdOf(SOLUTION_ID), sequence: 1 },
        payload: {
          discriminator: 'learning:state-projected',
          data: {
            solutionId: SOLUTION_ID,
            candidateCount: 1,
            datasetCount: 1,
            metricCount: 0,
            modelCount: 0,
            revisionCount: 0,
            projectedAt: T3,
          },
        },
        occurredAt: T3,
      }),
    );
    const { contentDigest, ...content } = sealed;
    expect(computeEventDigest(content as never)).toBe(contentDigest);
  });
});

describe('W036 solution-delivery parity (runtime)', () => {
  it('the outcome records this kernel folds are sealed by the REAL W036 kernel and admitted by the outcome slot', async () => {
    const { sealDistinctionRecord } = await import('@epoch/solution-delivery');
    const outcome = sealDistinctionRecord(outcomeContent());
    expect(outcome.ok, JSON.stringify(outcome)).toBe(true);
    if (!outcome.ok) return;
    expect(OutcomeRecordSlotSchema.safeParse(outcome.value).success).toBe(true);
    // A non-outcome distinction record is rejected by the slot.
    const prediction = sealDistinctionRecord({
      ...outcomeContent(),
      kind: 'prediction',
      recordId: 'prediction:rogue',
      measure: { kind: 'quantity', value: '1', unit: 'm3' },
      payload: {},
    });
    expect(prediction.ok).toBe(true);
    if (!prediction.ok) return;
    expect(OutcomeRecordSlotSchema.safeParse(prediction.value).success).toBe(false);
    // The principal grammar is the W036/W009 grammar.
    expect(PrincipalIdSchema.safeParse(PRINCIPAL).success).toBe(true);
    expect(PrincipalIdSchema.safeParse('principal:').success).toBe(false);
  });
});

describe('W007 capability-registry parity (runtime)', () => {
  it('a REAL source-category capability honoring the epoch/learning-calibration contract is admitted by the REAL registry', () => {
    const manifest = {
      schemaVersion: 1,
      capabilityId: 'epoch.learning-record-feed.reference',
      category: 'source',
      version: LEARNING_CALIBRATION_CONTRACT_VERSION,
      descriptor: {
        displayName: 'Reference learning-record capability',
        description:
          'The in-memory LearningRecordSourcePort reference adapter published as a source capability (external learning-record systems bind through the capability fabric, never as vendor fields)',
        inputs: [],
        outputs: [],
        assumptions: ['in-memory reference behavior only'],
      },
      contracts: [
        {
          contractId: 'epoch.learning-calibration',
          contractVersion: LEARNING_CALIBRATION_CONTRACT_VERSION,
        },
      ],
      trust: { origin: 'first-party' },
    };
    const digest = computeCapabilityManifestDigest(manifest as never);
    const registry = new CapabilityRegistry();
    const registered = registry.register({ manifest: manifest as never, digest });
    expect(registered.ok, JSON.stringify(registered)).toBe(true);
    expect(registered.ok && registered.value.manifest.category).toBe('source');
    expect(
      registered.ok && registered.value.manifest.contracts[0]!.contractId,
    ).toBe('epoch.learning-calibration');
  });
});
