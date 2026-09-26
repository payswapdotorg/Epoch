/**
 * Lead-time resolution (the "never flatten to a bare number" pin): a
 * lead-time observation is a TYPED reference to a W036
 * Prediction/Estimate distinction record; resolution verifies the
 * reference and returns the W036 MEASURE the referenced record carries
 * (quantity of duration or an expected instant) — never a bare number.
 */
import type { SealedDistinctionRecord, Measure } from '@epoch/solution-delivery';
import { verifySealedDistinctionRecord } from '@epoch/solution-delivery';
import type { ProcurementResult } from './errors';
import { adaptDeliveryResult } from './w036-adapter';
import type { LeadTimeObservation } from './quote';

/**
 * Resolve one lead-time observation against the supplied W036 sealed
 * distinction records:
 *
 * - the referenced record must exist (`dangling-reference-rejected`,
 *   kind `lead-time-record`);
 * - the claimed digest must match the record's exact digest
 *   (`digest-mismatch`);
 * - the record's kind must equal the observation's semantics
 *   (`prediction` / `estimate`) — any other distinction kind (a
 *   baseline, commitment, observation, actual, forecast, outcome or
 *   learning record) is a typed `distinction-collapse-rejected`;
 * - the returned value is the W036 `Measure` (quantity/instant/etc.) —
 *   the lead time is never flattened to a bare number.
 */
export function resolveLeadTimeObservation(
  observation: LeadTimeObservation,
  records: readonly SealedDistinctionRecord[],
): ProcurementResult<{ readonly record: SealedDistinctionRecord; readonly measure: Measure }> {
  const record = records.find((candidate) => candidate.recordId === observation.recordId);
  if (record === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `lead-time observation references record "${observation.recordId}", which does not resolve among the supplied W036 distinction records`,
        referenceKind: 'lead-time-record',
        referenceId: observation.recordId,
      },
    };
  }
  const verified = verifySealedDistinctionRecord(record);
  if (!verified.ok) {
    return adaptDeliveryResult(verified, observation.recordId);
  }
  if (record.contentDigest !== observation.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `lead-time observation claims digest "${observation.contentDigest}" but record "${record.recordId}"'s exact digest is "${record.contentDigest}"`,
        expected: record.contentDigest,
        encountered: observation.contentDigest,
      },
    };
  }
  if (record.kind !== observation.semantics) {
    return {
      ok: false,
      error: {
        code: 'distinction-collapse-rejected',
        message: `lead-time observation claims "${observation.semantics}" semantics but record "${record.recordId}" is a "${record.kind}" distinction record — Prediction/Estimate semantics are separate immutable records; collapsing them is rejected`,
        recordId: record.recordId,
        expectedKind: observation.semantics,
        encounteredKind: record.kind,
      },
    };
  }
  const measure = (record as { measure?: Measure }).measure;
  if (measure === undefined) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `record "${record.recordId}" carries no measure — a lead-time reference must point at a measure-bearing distinction record`,
        issues: [{ path: 'measure', message: 'the referenced record must carry a measure' }],
      },
    };
  }
  return { ok: true, value: { record, measure } };
}
