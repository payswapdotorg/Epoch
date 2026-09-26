/**
 * Quotes, offers and allocations over one acquisition package — the
 * supplier-facing commercial projection (provider-neutral: supplier
 * identity is an OPAQUE id; concrete supplier systems stay behind the
 * service-layer SupplierPort adapter seam).
 *
 * - A quote references the package by EXACT revision digest and carries
 *   sorted commercial lines (quantity + unit + unit-cost + optional
 *   ALLOCATION state — reserved/allocated), each with an ISO 4217
 *   currency.
 * - LEAD-TIME observations are TYPED references to W036
 *   semantic-distinction records (`prediction:` / `estimate:` record
 *   ids + exact content digests) with the MANDATORY uncertainty state —
 *   never a bare number: the lead-time measure lives in the W036
 *   distinction record (Prediction/Estimate semantics), and this package
 *   only references it. A lead-time observation whose semantics does not
 *   match the referenced record's kind is a typed
 *   `distinction-collapse-rejected` (collapsing the distinctions).
 * - Quote lifecycle: a quote is `submitted`; withdrawal ships as a NEW
 *   REVISION of the same quote id (digest-chained through
 *   `previousQuoteRevisionDigest`). Liveness is DERIVED
 *   (`isQuoteLive`): the latest revision must be `submitted` and within
 *   its validity window.
 * - The record is sealed, tenant-scoped and append-only (idempotent
 *   exact re-admission; typed `version-conflict` otherwise).
 */
import { z } from 'zod';
import type { JsonValue } from '@epoch/agent-protocol';
import {
  QUOTE_ALLOCATION_STATES,
  QUOTE_STATES,
  LEAD_TIME_SEMANTICS,
  QUOTE_SCHEMA_NAME,
  PROCUREMENT_RECORD_VERSION,
} from './version';
import { TenantIdSchema, UncertaintyStateSchema } from '@epoch/solution-delivery';
import type { SemanticDistinctionKind } from '@epoch/solution-delivery';
import {
  CurrencyCodeSchema,
  DistinctionRecordIdSchema,
  NonNegativeDecimalSchema,
  PackageIdSchema,
  PositiveIntegerSchema,
  PrincipalIdSchema,
  QuoteIdSchema,
  Sha256HexSchema,
  SupplierIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  canonicalDigest,
} from './primitives';
import { kindPrefixOf } from './version';
import { authorityViolationError, hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ProcurementResult } from './errors';
import type { AcquisitionPackageStore } from './package';

// --------------------------------------------------------------------------------
// Lead-time observations (typed Prediction/Estimate references).
// --------------------------------------------------------------------------------

/**
 * One typed lead-time observation: a Prediction/Estimate-distinction
 * RECORD reference (kind-prefixed id + exact content digest) plus the
 * mandatory uncertainty state. The lead-time measure (duration or
 * expected instant) lives in the W036 distinction record — procurement
 * never flattens it to a bare number.
 */
export const LeadTimeObservationSchema = z
  .strictObject({
    semantics: z.enum(LEAD_TIME_SEMANTICS),
    recordId: DistinctionRecordIdSchema,
    contentDigest: Sha256HexSchema,
    uncertainty: UncertaintyStateSchema,
    subjectNote: z.string().max(512).optional(),
  })
  .readonly()
  .meta({
    id: 'LeadTimeObservation',
    title: 'LeadTimeObservation',
    description:
      'One typed lead-time observation: a Prediction/Estimate distinction-record reference (exact digest) with the mandatory uncertainty state — never a bare number.',
  });

/** One lead-time observation. */
export type LeadTimeObservation = z.infer<typeof LeadTimeObservationSchema>;

/**
 * The lead-time semantics that a distinction record kind may serve
 * (Prediction/Estimate only — Baseline/Commitment/Observation/Actual
 * values are NOT lead-time observations; collapsing them is a typed
 * `distinction-collapse-rejected`).
 */
export function leadTimeSemanticsOfKind(
  kind: SemanticDistinctionKind,
): 'prediction' | 'estimate' | null {
  if (kind === 'prediction') return 'prediction';
  if (kind === 'estimate') return 'estimate';
  return null;
}

// --------------------------------------------------------------------------------
// Quote lines, offers and allocations.
// --------------------------------------------------------------------------------

/** One allocation sub-record of a quote line (offers/allocations). */
export const QuoteAllocationSchema = z
  .strictObject({
    state: z.enum(QUOTE_ALLOCATION_STATES),
    quantity: NonNegativeDecimalSchema,
    allocatedAt: TimestampSchema,
    allocationRef: z.string().min(1).max(256).optional(),
  })
  .readonly()
  .meta({
    id: 'QuoteAllocation',
    title: 'QuoteAllocation',
    description:
      'One allocation of a quote line: reserved/allocated state, the allocated quantity, the allocation instant and an optional opaque allocation reference.',
  });

/** One quote allocation. */
export type QuoteAllocation = z.infer<typeof QuoteAllocationSchema>;

/** One commercial line of a supplier quote. */
export const QuoteLineSchema = z
  .strictObject({
    description: z.string().min(1).max(256),
    quantity: NonNegativeDecimalSchema,
    unit: UnitLabelSchema,
    unitCost: z
      .strictObject({
        amount: NonNegativeDecimalSchema,
        currency: CurrencyCodeSchema,
      })
      .readonly(),
    allocation: QuoteAllocationSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'QuoteLine',
    title: 'QuoteLine',
    description:
      'One commercial line of a supplier quote: description, quantity+unit, unit cost (amount + ISO 4217 currency), and an optional allocation sub-record.',
  });

/** One quote line. */
export type QuoteLine = z.infer<typeof QuoteLineSchema>;

// --------------------------------------------------------------------------------
// The quote record (sealed, revision-chained).
// --------------------------------------------------------------------------------

/**
 * The immutable content of one quote revision: the supplier's offer over
 * one EXACT acquisition-package revision, with sorted lines, typed
 * lead-time observations and a validity window. Withdrawal/amendment
 * ships as a NEW revision chained through
 * `previousQuoteRevisionDigest`.
 */
const quoteShape = z.strictObject({
  schema: z.literal(QUOTE_SCHEMA_NAME),
  schemaVersion: z.literal(PROCUREMENT_RECORD_VERSION),
  quoteId: QuoteIdSchema,
  tenantId: TenantIdSchema,
  packageId: PackageIdSchema,
  packageDigest: Sha256HexSchema,
  supplierId: SupplierIdSchema,
  state: z.enum(QUOTE_STATES),
  revision: PositiveIntegerSchema,
  previousQuoteRevisionDigest: Sha256HexSchema.nullable(),
  lines: z.array(QuoteLineSchema).max(64),
  leadTimes: z.array(LeadTimeObservationSchema).max(16),
  validUntil: TimestampSchema.optional(),
  submittedAt: TimestampSchema,
  submittedBy: PrincipalIdSchema.optional(),
  note: z.string().max(2048).optional(),
});

export const QuoteContentSchema = quoteShape
  .readonly()
  .superRefine((quote, ctx) => {
    for (let i = 1; i < quote.lines.length; i += 1) {
      if (quote.lines[i]!.description < quote.lines[i - 1]!.description) {
        ctx.addIssue({
          code: 'custom',
          message: 'lines must be sorted by description ascending (deterministic serialization)',
          path: ['lines'],
        });
        break;
      }
      if (quote.lines[i]!.description === quote.lines[i - 1]!.description) {
        ctx.addIssue({
          code: 'custom',
          message: 'lines must be duplicate-free by description within the quote',
          path: ['lines'],
        });
        break;
      }
    }
    for (let i = 1; i < quote.leadTimes.length; i += 1) {
      if (quote.leadTimes[i]!.recordId < quote.leadTimes[i - 1]!.recordId) {
        ctx.addIssue({
          code: 'custom',
          message: 'leadTimes must be sorted by recordId ascending (deterministic serialization)',
          path: ['leadTimes'],
        });
        break;
      }
    }
    for (const observation of quote.leadTimes) {
      if (kindPrefixOf(observation.recordId) !== observation.semantics) {
        ctx.addIssue({
          code: 'custom',
          message: `lead-time observation claims "${observation.semantics}" semantics but references record id "${observation.recordId}" (prefix "${kindPrefixOf(observation.recordId)}") — one distinction reference cannot serve two semantic distinctions`,
          path: ['leadTimes'],
        });
        break;
      }
    }
    if (quote.revision > 1 && quote.previousQuoteRevisionDigest === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'quote revisions beyond the first must chain the previous revision digest',
        path: ['previousQuoteRevisionDigest'],
      });
    }
    if (quote.revision === 1 && quote.previousQuoteRevisionDigest !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'the first quote revision has no previous revision digest',
        path: ['previousQuoteRevisionDigest'],
      });
    }
  })
  .meta({
    id: 'QuoteContent',
    title: 'QuoteContent',
    description:
      'The immutable content of one quote revision: the supplier offer over one exact acquisition-package revision — sorted commercial lines with optional allocations, typed Prediction/Estimate lead-time observations with uncertainty, a validity window, and the revision chain link.',
  });

/** One quote content. */
export type QuoteContent = z.infer<typeof QuoteContentSchema>;

/** The SEALED quote revision: content plus its SHA-256 content digest. */
export const SealedQuoteSchema = z
  .strictObject({
    ...quoteShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedQuote',
    title: 'SealedQuote',
    description:
      'The sealed supplier-quote revision: immutable provider-neutral offer content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed quote revision. */
export type SealedQuote = z.infer<typeof SealedQuoteSchema>;

/** Compute the content digest of quote content (canonical JSON). */
export function computeQuoteDigest(content: QuoteContent): string {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid quote content into its published record. */
export function sealQuote(content: unknown): ProcurementResult<SealedQuote> {
  const pre = authorityViolationError(content);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = QuoteContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed quote revision (schema + digest recomputation). */
export function verifySealedQuote(sealed: unknown): ProcurementResult<SealedQuote> {
  const pre = authorityViolationError(sealed);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = SealedQuoteSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed quote digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The append-only quote store (all revisions, reference in-memory). */
export interface QuoteStore {
  readonly quotes: readonly SealedQuote[];
}

/** An empty quote store. */
export function emptyQuoteStore(): QuoteStore {
  return { quotes: [] };
}

/** The latest sealed revision of one quote id, if any. */
export function quoteHead(store: QuoteStore, quoteId: string): SealedQuote | undefined {
  const revisions = store.quotes.filter((quote) => quote.quoteId === quoteId);
  return revisions.length === 0 ? undefined : revisions[revisions.length - 1];
}

/** All revisions of one quote id, by ascending revision. */
export function quoteRevisions(store: QuoteStore, quoteId: string): readonly SealedQuote[] {
  return store.quotes.filter((quote) => quote.quoteId === quoteId);
}

/**
 * Whether one sealed quote revision is LIVE at an instant: the latest
 * revision of its quote id, in the `submitted` state, within its
 * validity window. Derivation only — liveness is never stored.
 */
export function isQuoteLive(store: QuoteStore, quote: SealedQuote, at: string): boolean {
  if (quoteHead(store, quote.quoteId)?.contentDigest !== quote.contentDigest) {
    return false;
  }
  if (quote.state !== 'submitted') {
    return false;
  }
  return quote.validUntil === undefined || quote.validUntil >= at;
}

/**
 * Admit a sealed quote revision into the store:
 *
 * - the revision verifies (tamper detection);
 * - the package exists (`dangling-reference-rejected`, kind
 *   `acquisition-package`) and the quote is tenant-consistent with it
 *   (`tenant-isolation-rejected`);
 * - the quote's `packageDigest` equals the package's content digest
 *   (`digest-mismatch` — a quote may not drift from the package revision
 *   it prices);
 * - the revision chain is sound: revision 1 admits onto an empty chain;
 *   revision N chains `previousQuoteRevisionDigest` to the current head
 *   of the SAME quote id (broken chains are typed
 *   `dangling-reference-rejected` / `version-conflict`);
 * - an exact re-admission is idempotent.
 */
export function admitQuote(
  packages: AcquisitionPackageStore,
  store: QuoteStore,
  quote: unknown,
): ProcurementResult<QuoteStore> {
  const verified = verifySealedQuote(quote);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  const pkg = packages.packages.find((candidate) => candidate.packageId === admitted.packageId);
  if (pkg === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `quote "${admitted.quoteId}" references acquisition package "${admitted.packageId}", which does not resolve`,
        referenceKind: 'acquisition-package',
        referenceId: admitted.packageId,
      },
    };
  }
  if (admitted.tenantId !== pkg.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `quote "${admitted.quoteId}" belongs to tenant "${admitted.tenantId}" but the acquisition package is scoped to "${pkg.tenantId}" (R12)`,
        expectedTenantId: pkg.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.quoteId,
      },
    };
  }
  if (admitted.packageDigest !== pkg.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `quote "${admitted.quoteId}" prices package digest "${admitted.packageDigest}" but the admitted package's exact-revision digest is "${pkg.contentDigest}" — a quote may not drift from the package revision it prices`,
        expected: pkg.contentDigest,
        encountered: admitted.packageDigest,
      },
    };
  }
  const exact = store.quotes.find(
    (existing) =>
      existing.quoteId === admitted.quoteId && existing.contentDigest === admitted.contentDigest,
  );
  if (exact !== undefined) {
    return { ok: true, value: store };
  }
  const head = quoteHead(store, admitted.quoteId);
  if (admitted.revision === 1) {
    if (head !== undefined) {
      return {
        ok: false,
        error: {
          code: 'version-conflict',
          message: `quote "${admitted.quoteId}" already has revisions (head revision ${head.revision}) — revision 1 admits only onto an empty chain`,
          subject: 'quote-revision',
          subjectId: admitted.quoteId,
          publishedDigest: head.contentDigest,
        },
      };
    }
    return { ok: true, value: { quotes: [...store.quotes, admitted] } };
  }
  if (head === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `quote "${admitted.quoteId}" revision ${admitted.revision} chains digest "${admitted.previousQuoteRevisionDigest}" but the quote has no admitted revisions`,
        referenceKind: 'quote',
        referenceId: admitted.quoteId,
      },
    };
  }
  if (admitted.revision !== head.revision + 1) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `quote "${admitted.quoteId}" revision ${admitted.revision} must follow the head revision ${head.revision} contiguously`,
        subject: 'quote-revision',
        subjectId: admitted.quoteId,
        publishedDigest: head.contentDigest,
      },
    };
  }
  if (admitted.previousQuoteRevisionDigest !== head.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `quote "${admitted.quoteId}" revision ${admitted.revision} chains digest "${admitted.previousQuoteRevisionDigest}" but the head revision's exact digest is "${head.contentDigest}" (tampered or mismatched chain link)`,
        expected: head.contentDigest,
        encountered: admitted.previousQuoteRevisionDigest!,
      },
    };
  }
  return { ok: true, value: { quotes: [...store.quotes, admitted] } };
}

/** The quote-store fold: latest revisions sorted by quoteId (deterministic). */
export function foldQuoteHeads(store: QuoteStore): readonly SealedQuote[] {
  const heads = new Map<string, SealedQuote>();
  for (const quote of store.quotes) {
    heads.set(quote.quoteId, quote);
  }
  return [...heads.values()].sort((a, b) => (a.quoteId < b.quoteId ? -1 : 1));
}

