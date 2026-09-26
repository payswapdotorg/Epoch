/**
 * The SupplierPort adapter seam + the ONE in-memory reference adapter.
 *
 * External supplier systems live BEHIND this seam (architecture lock
 * rule 13: provider-specific behavior is adapterized). The reference
 * adapter is fully provider-neutral: it replays caller-seeded quote
 * submissions deterministically (no clocks, no randomness, no network,
 * no vendor names) — concrete integrations replace it with real
 * adapters of the same interface.
 */
import type {
  SupplierPort,
  SupplierQuoteRequest,
  SupplierQuoteSubmission,
  SupplierPortResult,
} from './types';

/** One seeded quote submission of the reference adapter. */
export interface ReferenceSupplierSeed {
  readonly quoteId: string;
  readonly supplierId: string;
  readonly lines: readonly {
    readonly description: string;
    readonly quantity: string;
    readonly unit: string;
    readonly unitCost: { readonly amount: string; readonly currency: string };
    readonly allocation?: {
      readonly state: 'reserved' | 'allocated';
      readonly quantity: string;
      readonly allocatedAt: string;
    } | undefined;
  }[];
  readonly leadTimes: readonly {
    readonly semantics: 'prediction' | 'estimate';
    readonly recordId: string;
    readonly contentDigest: string;
    readonly uncertainty: import('@epoch/procurement').UncertaintyState;
  }[];
  readonly validUntil?: string | undefined;
  readonly submittedAt: string;
  readonly submittedBy?: string | undefined;
}

/**
 * The IN-MEMORY REFERENCE ADAPTER: replays the caller-seeded
 * submissions for every quote request, echoing the request's package
 * scope. Deterministic: the same seeds and the same request yield the
 * same submissions; no vendor is named anywhere.
 */
export class InMemorySupplierAdapter implements SupplierPort {
  private readonly submissions: readonly SupplierQuoteSubmission[];

  constructor(seeds: readonly ReferenceSupplierSeed[] = []) {
    this.submissions = seeds.map((seed) => ({ ...seed }));
  }

  requestQuotes(request: SupplierQuoteRequest): SupplierPortResult<readonly SupplierQuoteSubmission[]> {
    if (request.packageId === undefined || request.packageId.length === 0) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'the quote request must name a package',
          issues: [{ path: 'packageId', message: 'packageId is required' }],
        },
      };
    }
    // The reference adapter replays every seeded submission (the quote
    // contents themselves are caller-seeded; the adapter adds nothing).
    const replayed = this.submissions.map((submission) => ({
      ...submission,
      lines: submission.lines.map((line) => ({
        ...line,
        unitCost: { ...line.unitCost },
        ...(line.allocation !== undefined ? { allocation: { ...line.allocation } } : {}),
      })),
      leadTimes: submission.leadTimes.map((observation) => ({
        ...observation,
        uncertainty: { ...observation.uncertainty },
      })),
    }));
    return { ok: true, value: replayed };
  }
}
