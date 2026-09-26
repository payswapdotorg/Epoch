/**
 * The FieldCapturePort adapter seam + the ONE in-memory reference adapter.
 *
 * External field systems (mobile capture, IoT, scanners) live BEHIND this
 * seam (architecture lock rule 13: provider-specific behavior is
 * adapterized). The reference adapter is fully provider-neutral: it
 * replays caller-seeded capture submissions deterministically (no clocks,
 * no randomness, no network, no vendor names) — concrete integrations
 * replace it with real adapters of the same interface.
 */
import type {
  FieldCapturePort,
  FieldCapturePollRequest,
  FieldCapturePortResult,
  FieldCaptureSubmission,
} from './types';

/** One seeded capture submission of the reference adapter. */
export type ReferenceCaptureSeed = FieldCaptureSubmission;

/**
 * The IN-MEMORY REFERENCE ADAPTER: replays the caller-seeded
 * submissions for every capture poll, echoing the request's scope.
 * Deterministic: the same seeds and the same poll yield the same
 * submissions; no vendor is named anywhere.
 */
export class InMemoryFieldCaptureAdapter implements FieldCapturePort {
  private readonly submissions: readonly FieldCaptureSubmission[];

  constructor(seeds: readonly ReferenceCaptureSeed[] = []) {
    this.submissions = seeds.map((seed) => ({ ...seed }));
  }

  pollCaptures(request: FieldCapturePollRequest): FieldCapturePortResult<readonly FieldCaptureSubmission[]> {
    if (request.tenantId.length === 0) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'the capture poll must name a tenant',
          issues: [{ path: 'tenantId', message: 'tenantId is required' }],
        },
      };
    }
    // The reference adapter replays every seeded submission whose scope
    // matches the poll (tenant + optional work package). The capture
    // contents themselves are caller-seeded; the adapter adds nothing.
    const replayed = this.submissions
      .filter((submission) => submission.tenantId === request.tenantId)
      .map((submission) => ({ ...submission }))
      .sort((a, b) => (a.captureKey < b.captureKey ? -1 : a.captureKey > b.captureKey ? 1 : 0));
    return { ok: true, value: replayed };
  }
}
