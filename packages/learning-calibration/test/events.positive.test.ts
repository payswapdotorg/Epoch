// THE learning:* EVENT VOCABULARY (positive paths): every discriminator
// seals + verifies, the typed payload data parses through the W010
// payload-family discipline, causal parents chain strictly, and
// tampering is digest-detected.
import { describe, expect, it } from 'vitest';
import {
  LEARNING_EVENT_DATA_SCHEMAS,
  computeLearningEventDigest,
  learningStreamIdOf,
  parseLearningEventData,
  sealLearningEvent,
  verifySealedLearningEvent,
} from '../src/events';
import { LEARNING_EVENT_DISCRIMINATORS } from '../src/version';
import {
  PRINCIPAL,
  SOLUTION_ID,
  T1,
  T2,
  T3,
  TENANT,
} from './fixtures';
import { expectError, unwrap } from './helpers';

const STREAM = learningStreamIdOf(SOLUTION_ID);

/** Build one event content with defaults (loose JSON). */
function eventContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    streamId: STREAM,
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
        eligibleCount: 3,
        excludedCount: 0,
        assembledAt: T1,
      },
    },
    occurredAt: T1,
    ...overrides,
  };
}

describe('the event vocabulary (all eight discriminators seal + verify + parse)', () => {
  const cases = [
    {
      discriminator: 'learning:record-intaken',
      data: {
        solutionId: SOLUTION_ID,
        candidateId: 'candidate:pit-volume-f1-a1',
        subjectKind: 'activity',
        admission: 'intaken',
        intakenAt: T1,
      },
    },
    {
      discriminator: 'learning:dataset-assembled',
      data: {
        solutionId: SOLUTION_ID,
        datasetId: 'dataset:tower-retrofit-00000000',
        datasetDigest: 'a'.repeat(64),
        eligibleCount: 3,
        excludedCount: 1,
        assembledAt: T2,
      },
    },
    {
      discriminator: 'learning:dataset-replayed',
      data: {
        solutionId: SOLUTION_ID,
        datasetId: 'dataset:tower-retrofit-00000000',
        datasetDigest: 'a'.repeat(64),
        replayedAt: T3,
      },
    },
    {
      discriminator: 'learning:metrics-folded',
      data: {
        solutionId: SOLUTION_ID,
        metricId: 'metrics:tower-retrofit-1a2b3c4d',
        modelId: 'model:pit-volume-calibration',
        revisionId: 'model-revision:pit-volume-1',
        datasetId: 'dataset:tower-retrofit-00000000',
        selectedRowCount: 3,
        foldedAt: T3,
      },
    },
    {
      discriminator: 'learning:revision-proposed',
      data: {
        solutionId: SOLUTION_ID,
        proposalId: 'proposal:pit-volume-revision-1',
        modelId: 'model:pit-volume-calibration',
        revisionId: 'model-revision:pit-volume-1',
        sequence: 1,
        proposedAt: T3,
      },
    },
    {
      discriminator: 'learning:revision-admitted',
      data: {
        solutionId: SOLUTION_ID,
        proposalId: 'proposal:pit-volume-revision-1',
        modelId: 'model:pit-volume-calibration',
        revisionId: 'model-revision:pit-volume-1',
        sequence: 1,
        admittedAt: T3,
      },
    },
    {
      discriminator: 'learning:state-projected',
      data: {
        solutionId: SOLUTION_ID,
        candidateCount: 3,
        datasetCount: 1,
        metricCount: 1,
        modelCount: 1,
        revisionCount: 1,
        projectedAt: T3,
      },
    },
    {
      discriminator: 'learning:pack-view-projected',
      data: {
        solutionId: SOLUTION_ID,
        packId: 'epoch.construction.core',
        rowCount: 2,
        projectedAt: T3,
      },
    },
  ] as const;

  it.each(cases)('seals, verifies, and parses: $discriminator', (case_) => {
    const content = eventContent({
      payload: { discriminator: case_.discriminator, data: case_.data },
    });
    const sealed = unwrap(sealLearningEvent(content));
    expect(sealed.payload.discriminator).toBe(case_.discriminator);
    expect(verifySealedLearningEvent(sealed).ok).toBe(true);
    expect(computeLearningEventDigest(content as never)).toBe(sealed.contentDigest);
    const parsed = unwrap(parseLearningEventData(sealed.payload));
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(case_.data).sort());
  });

  it('the discriminator set is exactly the closed vocabulary (8 members)', () => {
    expect(LEARNING_EVENT_DISCRIMINATORS).toHaveLength(8);
    expect(Object.keys(LEARNING_EVENT_DATA_SCHEMAS)).toHaveLength(8);
    expect([...LEARNING_EVENT_DISCRIMINATORS].every((discriminator) =>
      LEARNING_EVENT_DISCRIMINATORS.includes(discriminator),
    )).toBe(true);
  });
});

describe('causal parents + stream discipline', () => {
  it('events chain strictly earlier in-stream (the W010 shape)', () => {
    // Sequence 1 anchors the chain (its seal must succeed).
    unwrap(sealLearningEvent(eventContent()));
    const second = unwrap(
      sealLearningEvent(
        eventContent({
          sequence: 2,
          causalParent: { streamId: STREAM, sequence: 1 },
          occurredAt: T2,
        }),
      ),
    );
    expect(second.causalParent).toEqual({ streamId: STREAM, sequence: 1 });
    expect(second.sequence).toBe(2);
  });

  it('a same-stream causal parent at or after the event is a typed validation rejection', () => {
    const error = expectError(
      sealLearningEvent(
        eventContent({
          sequence: 1,
          causalParent: { streamId: STREAM, sequence: 1 },
        }),
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('the stream id derives deterministically from the solution scope', () => {
    expect(STREAM).toBe('stream:learning-tower-retrofit');
    expect(learningStreamIdOf('solution:other')).toBe('stream:learning-other');
  });
});

describe('tamper detection + payload discipline', () => {
  it('a tampered envelope digest is digest-mismatch', () => {
    const sealed = unwrap(sealLearningEvent(eventContent()));
    const tampered = { ...sealed, contentDigest: '0'.repeat(64) };
    const error = expectError(verifySealedLearningEvent(tampered));
    expect(error.code).toBe('digest-mismatch');
  });

  it('an unknown discriminator does not select a member of the vocabulary', () => {
    const error = expectError(
      parseLearningEventData({
        discriminator: 'learning:unknown-event',
        data: {},
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('typed payload data that violates its shape is a typed validation rejection', () => {
    const error = expectError(
      parseLearningEventData({
        discriminator: 'learning:dataset-assembled',
        data: {
          solutionId: SOLUTION_ID,
          datasetId: 'not-a-dataset-id',
          datasetDigest: 'a'.repeat(64),
          eligibleCount: 3,
          excludedCount: 0,
          assembledAt: T1,
        },
      }),
    );
    expect(error.code).toBe('validation');
  });
});
