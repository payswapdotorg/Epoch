/**
 * The ONE in-memory reference LearningRecordSourcePort adapter: a
 * deterministic pending-queue implementation of the port seam.
 * External learning-record sources (W039 actualization/variance
 * pipelines, W038 field systems) would bind behind this port as
 * separate adapters — the core never names a vendor, and this
 * reference adapter carries no provider vocabulary.
 *
 * Determinism: the pending queue keeps its submissions in submission
 * order; pollLearningRecords returns them SORTED by candidate id
 * (canonical) and clears the queue; identical submission sequences
 * derive identical poll results.
 */
import type { SealedOutcomeLearningCandidate } from '@epoch/learning-calibration';
import type { LearningCalibrationServiceResult, LearningRecordSourcePort } from './types';

/** One pending queue entry. */
interface PendingEntry {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly candidate: SealedOutcomeLearningCandidate;
}

/** The in-memory reference adapter (the default port implementation). */
export class InMemoryLearningRecordSourceAdapter implements LearningRecordSourcePort {
  private readonly pending: PendingEntry[] = [];

  /** Submit one sealed outcome-learning candidate into the pending queue. */
  submit(options: {
    readonly tenantId: string;
    readonly solutionId: string;
    readonly candidate: SealedOutcomeLearningCandidate;
  }): LearningCalibrationServiceResult<null> {
    if (
      options.candidate.tenantId !== options.tenantId ||
      options.candidate.solutionId !== options.solutionId
    ) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `candidate "${options.candidate.candidateId}" is scoped to (${options.candidate.tenantId}, ${options.candidate.solutionId}) but the source submission is scoped to (${options.tenantId}, ${options.solutionId}) (R12)`,
          expectedTenantId: options.tenantId,
          encounteredTenantId: options.candidate.tenantId,
          subject: options.candidate.candidateId,
        },
      };
    }
    this.pending.push({
      tenantId: options.tenantId,
      solutionId: options.solutionId,
      candidate: options.candidate,
    });
    return { ok: true, value: null };
  }

  /** Poll the pending submissions of one solution scope (sorted, then cleared). */
  pollLearningRecords(options: {
    readonly tenantId: string;
    readonly solutionId: string;
    readonly requestedAt: string;
    readonly requestedBy: string;
  }): LearningCalibrationServiceResult<readonly SealedOutcomeLearningCandidate[]> {
    void options.requestedAt;
    void options.requestedBy;
    const matching = this.pending
      .filter(
        (entry) => entry.tenantId === options.tenantId && entry.solutionId === options.solutionId,
      )
      .map((entry) => entry.candidate)
      .sort((a, b) => (a.candidateId < b.candidateId ? -1 : 1));
    for (let i = this.pending.length - 1; i >= 0; i -= 1) {
      const entry = this.pending[i]!;
      if (entry.tenantId === options.tenantId && entry.solutionId === options.solutionId) {
        this.pending.splice(i, 1);
      }
    }
    return { ok: true, value: matching };
  }
}

/** Construct a seeded adapter carrying pre-submitted learning records. */
export function seededLearningRecordSource(
  submissions: readonly {
    readonly tenantId: string;
    readonly solutionId: string;
    readonly candidate: SealedOutcomeLearningCandidate;
  }[],
): InMemoryLearningRecordSourceAdapter {
  const adapter = new InMemoryLearningRecordSourceAdapter();
  for (const submission of submissions) {
    const submitted = adapter.submit(submission);
    if (!submitted.ok) {
      throw new Error(`seed submission failed: ${JSON.stringify(submitted.error)}`);
    }
  }
  return adapter;
}
