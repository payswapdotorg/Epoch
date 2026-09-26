/**
 * Uncertainty states carried on every solution-delivery fact (USL1.0
 * binding: "otherwise preserve the uncertainty with provenance, freshness
 * and confidence").
 *
 * The decision-sufficiency rule (USL1.0): a missing field is NOT
 * automatically a blocker. Unknowns carry provenance, freshness and
 * confidence; information-acquisition requests are issued when the expected
 * decision impact is material (src/info-request.ts). `provenance.kind:
 * "unknown"` and `freshness.state: "unknown"` are therefore FIRST-CLASS
 * values — the model preserves what is not known instead of fabricating
 * completeness.
 *
 * The confidence vocabulary MIRRORS the W006/W002 CONFIDENCE_METHODS
 * grammar (stated/measured/estimated/derived/imported) so delivery
 * confidence is evidence-shaped; pinned by the runtime parity test and the
 * compile-time kernel parity module; never a runtime dependency.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { CONFIDENCE_METHODS, FRESHNESS_STATES, PROVENANCE_KINDS, SOLUTION_DELIVERY_RECORD_VERSION } from './version';
import { OpaqueReferenceSchema, PrincipalIdSchema } from './primitives';

/**
 * Where a fact came from: the provenance kind plus an optional opaque
 * source reference and an optional acting principal.
 */
export const ProvenanceStateSchema = z
  .strictObject({
    kind: z.enum(PROVENANCE_KINDS),
    sourceRef: OpaqueReferenceSchema.optional(),
    actor: PrincipalIdSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'ProvenanceState',
    title: 'ProvenanceState',
    description:
      'Provenance of one delivery fact: observed/reported/derived/assumed/imported/unknown, optional opaque source reference, optional acting principal.',
  });

/** One provenance state. */
export type ProvenanceState = z.infer<typeof ProvenanceStateSchema>;

/**
 * How current the fact's assessment is: a freshness state plus the instant
 * it was assessed (producer-supplied — this package never reads a clock).
 */
export const FreshnessStateSchema = z
  .strictObject({
    state: z.enum(FRESHNESS_STATES),
    assessedAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'FreshnessState',
    title: 'FreshnessState',
    description:
      'Freshness of one delivery fact: fresh/aging/stale/unknown plus the producer-supplied assessment instant.',
  });

/** One freshness state. */
export type FreshnessState = z.infer<typeof FreshnessStateSchema>;

/**
 * How much the fact is believed: a confidence acquisition method plus a
 * 0..1 confidence value (optionally a low/high interval).
 */
export const ConfidenceStateSchema = z
  .strictObject({
    method: z.enum(CONFIDENCE_METHODS),
    value: z.number().min(0).max(1),
    interval: z
      .strictObject({
        low: z.number().min(0).max(1),
        high: z.number().min(0).max(1),
      })
      .refine((interval) => interval.low <= interval.high, 'interval low must not exceed high')
      .readonly()
      .optional(),
    rationale: z.string().min(1).max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'ConfidenceState',
    title: 'ConfidenceState',
    description:
      'Confidence of one delivery fact: acquisition method (stated/measured/estimated/derived/imported), a 0..1 value, optional interval and rationale.',
  });

/** One confidence state. */
export type ConfidenceState = z.infer<typeof ConfidenceStateSchema>;

/**
 * The complete uncertainty state carried on every delivery fact:
 * provenance + freshness + confidence (all three REQUIRED — a fact without
 * uncertainty is inexpressible).
 */
export const UncertaintyStateSchema = z
  .strictObject({
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    provenance: ProvenanceStateSchema,
    freshness: FreshnessStateSchema,
    confidence: ConfidenceStateSchema,
  })
  .readonly()
  .meta({
    id: 'UncertaintyState',
    title: 'UncertaintyState',
    description:
      'The uncertainty state of one delivery fact: provenance, freshness and confidence (all required — the decision-sufficiency rule preserves what is not known).',
  });

/** One uncertainty state. */
export type UncertaintyState = z.infer<typeof UncertaintyStateSchema>;
