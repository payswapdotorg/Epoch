/**
 * The ONE in-memory reference ObservationSourcePort adapter: a
 * deterministic pending-queue implementation of the port seam. External
 * observation sources (W038 field systems, W037 supplier systems) would
 * bind behind this port as separate adapters — the core never names a
 * vendor, and this reference adapter carries no provider vocabulary.
 *
 * Determinism: the pending queue keeps its submissions in submission
 * order; pollObservations returns them SORTED by record id (canonical)
 * and clears the queue; identical submission sequences derive identical
 * poll results.
 */
import type { SealedDistinctionRecord } from '@epoch/solution-delivery';
import type { ObservationSourcePort } from './types';
import type { ActualizationServiceResult } from './types';

/** One pending queue entry. */
interface PendingEntry {
  readonly tenantId: string;
  readonly deliveryId: string;
  readonly observation: SealedDistinctionRecord;
}

/** The in-memory reference adapter (the default port implementation). */
export class InMemoryObservationSourceAdapter implements ObservationSourcePort {
  private readonly pending: PendingEntry[] = [];

  /** Submit one sealed observation record into the pending queue. */
  submit(options: {
    readonly tenantId: string;
    readonly deliveryId: string;
    readonly observation: SealedDistinctionRecord;
  }): ActualizationServiceResult<null> {
    if (options.observation.kind !== 'observation') {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `record "${options.observation.recordId}" is of kind "${options.observation.kind}" — the observation source carries OBSERVATION records only`,
          issues: [
            { path: 'observation', message: 'only observation records enter the source queue' },
          ],
        },
      };
    }
    this.pending.push({
      tenantId: options.tenantId,
      deliveryId: options.deliveryId,
      observation: options.observation,
    });
    return { ok: true, value: null };
  }

  /** Poll the pending submissions of one delivery scope (sorted, then cleared). */
  pollObservations(options: {
    readonly tenantId: string;
    readonly deliveryId: string;
    readonly requestedAt: string;
    readonly requestedBy: string;
  }): ActualizationServiceResult<readonly SealedDistinctionRecord[]> {
    void options.requestedAt;
    void options.requestedBy;
    const matching = this.pending
      .filter(
        (entry) => entry.tenantId === options.tenantId && entry.deliveryId === options.deliveryId,
      )
      .map((entry) => entry.observation)
      .sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
    for (let i = this.pending.length - 1; i >= 0; i -= 1) {
      const entry = this.pending[i]!;
      if (entry.tenantId === options.tenantId && entry.deliveryId === options.deliveryId) {
        this.pending.splice(i, 1);
      }
    }
    return { ok: true, value: matching };
  }
}

/** Construct a seeded adapter carrying pre-submitted observations. */
export function seededObservationSource(
  submissions: readonly {
    readonly tenantId: string;
    readonly deliveryId: string;
    readonly observation: SealedDistinctionRecord;
  }[],
): InMemoryObservationSourceAdapter {
  const adapter = new InMemoryObservationSourceAdapter();
  for (const submission of submissions) {
    const submitted = adapter.submit(submission);
    if (!submitted.ok) {
      throw new Error(`seed submission failed: ${JSON.stringify(submitted.error)}`);
    }
  }
  return adapter;
}
