// RUNTIME PARITY with the REAL sibling kernels (devDependencies only —
// no runtime coupling; the W036 pattern):
//
// - W010 event-log: the mirrored procurement-event shape is admitted by
//   the REAL @epoch/event-log seal path, digests agree with the REAL
//   computeEventDigest, the stream/actor grammars are pattern-identical,
//   and the record versions are equal;
// - W036 solution-delivery: procurement-created commitment records are
//   admitted by the REAL W036 DistinctionLedger; the receipt-observation
//   linkage verifies through the REAL W036 verifySealedDistinctionRecord;
//   real W036 acquisition-request ids validate through the mirrored
//   acquisition-id grammar; the composed uncertainty state parses through
//   the REAL W036 UncertaintyStateSchema;
// - W004 constraint-language/policy-contracts: a REAL composed policy
//   evaluation outcome is content-addressable by the shared SHA-256
//   grammar and admitted by the mirrored constraint-evaluation reference.
import { describe, expect, it } from 'vitest';
import {
  computeEventDigest,
  EVENT_ACTOR_PATTERN,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
  sealEvent,
} from '@epoch/event-log';
import {
  UncertaintyStateSchema,
  admitDistinctionRecord,
  verifySealedDistinctionRecord,
  type DistinctionLedger,
} from '@epoch/solution-delivery';
import { composeConstraintEvaluations as composeW004 } from '@epoch/policy-contracts';
import { sha256Hex } from '@epoch/agent-protocol';
import {
  AcquisitionIdSchema,
  ConstraintEvaluationReferenceSchema,
  PROCUREMENT_EVENT_RECORD_VERSION,
  PROCUREMENT_PRINCIPAL_ID_PATTERN,
  PROCUREMENT_STREAM_ID_PATTERN,
  computeProcurementEventDigest,
  procurementStreamIdOf,
  sealProcurementCommitment,
  sealProcurementEvent,
  type SealedProcurementEvent,
} from '../src/index';
import {
  ACQUISITION_ID,
  SOLUTION_ID,
  TENANT,
  T1,
  T4,
  acquisitionRequest,
  receiptObservation,
  sealedQuote,
  uncertainty,
  unwrap,
} from './fixtures';

describe('W010 event-log parity (runtime)', () => {
  it('the mirrored stream pattern is exactly the W010 stream pattern', () => {
    expect(PROCUREMENT_STREAM_ID_PATTERN.source).toBe(EVENT_STREAM_ID_PATTERN.source);
    expect(PROCUREMENT_STREAM_ID_PATTERN.flags).toBe(EVENT_STREAM_ID_PATTERN.flags);
  });

  it('the mirrored actor grammar is exactly the W010 actor pattern (the W009 grammar)', () => {
    expect(PROCUREMENT_PRINCIPAL_ID_PATTERN.source).toBe(EVENT_ACTOR_PATTERN.source);
    expect(PROCUREMENT_PRINCIPAL_ID_PATTERN.flags).toBe(EVENT_ACTOR_PATTERN.flags);
  });

  it('the mirrored record version equals the W010 record version', () => {
    expect(PROCUREMENT_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });

  it('the derived package stream satisfies the W010 stream grammar', () => {
    const streamId = procurementStreamIdOf('package:earthworks-steel-a');
    expect(streamId).toBe('stream:procurement-earthworks-steel-a');
    expect(new RegExp(EVENT_STREAM_ID_PATTERN).test(streamId)).toBe(true);
  });

  it('a procurement event is admitted by the REAL W010 seal path and digests identically', () => {
    const content = {
      schemaVersion: PROCUREMENT_EVENT_RECORD_VERSION,
      streamId: 'stream:procurement-earthworks-steel-a',
      sequence: 1,
      tenantId: TENANT,
      actor: 'principal:procurement-lead',
      causalParent: null,
      payload: {
        discriminator: 'procurement:package-assembled',
        data: {
          packageId: 'package:earthworks-steel-a',
          acquisitionId: ACQUISITION_ID,
          variant: 'external-procurement',
          assembledAt: T1,
        },
      },
      occurredAt: T1,
    };
    const ours = sealProcurementEvent(content);
    expect(ours.ok, JSON.stringify(ours)).toBe(true);
    if (!ours.ok) return;
    const theirs = sealEvent(content);
    expect(theirs.ok, JSON.stringify(theirs)).toBe(true);
    if (!theirs.ok) return;
    expect(ours.value.contentDigest).toBe(theirs.value.digest);
    expect(computeProcurementEventDigest(content)).toBe(computeEventDigest(content));
  });

  it('every procurement:* discriminator of the vocabulary seals through the REAL W010 path', () => {
    const base = {
      schemaVersion: PROCUREMENT_EVENT_RECORD_VERSION,
      streamId: 'stream:procurement-parity-probe',
      sequence: 1,
      tenantId: TENANT,
      actor: 'principal:procurement-lead',
      causalParent: null,
      payload: {
        discriminator: 'procurement:status-projected',
        data: {
          packageId: 'package:earthworks-steel-a',
          state: 'quoted',
          asOf: T1,
        },
      },
      occurredAt: T1,
    };
    for (const discriminator of [
      'procurement:package-assembled',
      'procurement:quote-received',
      'procurement:quote-selected',
      'procurement:commitment-linked',
      'procurement:po-issued',
      'procurement:po-amended',
      'procurement:delivery-transition-recorded',
      'procurement:receipt-recorded',
      'procurement:substitution-requested',
      'procurement:substitution-decided',
      'procurement:status-projected',
    ]) {
      const content = {
        ...base,
        payload: { ...base.payload, discriminator },
      };
      const sealed = sealProcurementEvent(content);
      expect(sealed.ok, discriminator).toBe(true);
      const real = sealEvent(content);
      expect(real.ok, discriminator).toBe(true);
    }
    void (null as unknown as SealedProcurementEvent);
  });
});

describe('W036 solution-delivery parity (runtime)', () => {
  it('a procurement-created commitment is admitted by the REAL W036 DistinctionLedger', () => {
    const commitment = unwrap(
      sealProcurementCommitment({
        recordId: 'commitment:parity-probe',
        tenantId: TENANT,
        subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
        quote: sealedQuote(),
        acquisitionId: ACQUISITION_ID,
        committedBy: 'principal:procurement-lead',
        committedAt: T4,
        recordedAt: T4,
        uncertainty: uncertainty() as never,
      }),
    );
    const ledger: DistinctionLedger = {
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      records: [],
    };
    const admitted = admitDistinctionRecord(ledger, commitment);
    expect(admitted.ok, JSON.stringify(admitted)).toBe(true);
  });

  it('the receipt-observation linkage verifies through the REAL W036 verifier', () => {
    const observation = receiptObservation();
    const verified = verifySealedDistinctionRecord(observation);
    expect(verified.ok, JSON.stringify(verified)).toBe(true);
  });

  it('a REAL W036 acquisition-request id validates through the mirrored acquisition-id grammar', () => {
    const request = acquisitionRequest();
    expect(AcquisitionIdSchema.safeParse(request.acquisitionId).success).toBe(true);
    expect(AcquisitionIdSchema.safeParse('acquisition:BAD_SLUG').success).toBe(false);
    expect(AcquisitionIdSchema.safeParse('acquisition:').success).toBe(false);
  });

  it('the composed uncertainty state parses through the REAL W036 UncertaintyStateSchema', () => {
    const parsed = UncertaintyStateSchema.safeParse(uncertainty());
    expect(parsed.success, JSON.stringify(parsed.error)).toBe(true);
  });
});

describe('W004 constraint/policy parity (runtime)', () => {
  it('a REAL composed policy evaluation is content-addressable by the shared SHA-256 grammar', () => {
    // Compose a real W004 outcome set (empty composition is
    // not-applicable — a real, valid evaluation result).
    const composed = composeW004([]);
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    // Content-address the real evaluation document with the shared
    // SHA-256 discipline and admit it through the mirrored
    // constraint-evaluation reference grammar.
    const evaluationDigest = sha256Hex(JSON.parse(JSON.stringify(composed.decision)) as never);
    const parsed = ConstraintEvaluationReferenceSchema.safeParse({ evaluationDigest });
    expect(parsed.success, JSON.stringify(parsed.error)).toBe(true);
  });
});
