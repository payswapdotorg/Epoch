/**
 * Quote selection: the offer comparison and decision are RECORDED
 * records (sealed, hash-chained), never an in-place flag on the quote.
 *
 * - A selection references the winning quote by EXACT digest and carries
 *   the full considered-quote comparison set (also by exact digest) plus
 *   a bounded rationale: offer comparison is a RECORDED decision.
 * - Re-selections chain through `previousSelectionDigest` (the W023
 *   hash-chain convention): one package's decisions form a chain.
 * - A selection not backed by a LIVE quote digest is the typed
 *   `dangling-quote-rejected`: the quote must exist (latest revision),
 *   be in the `submitted` state, and be within its validity window at
 *   the decision instant. A digest mismatch is `digest-mismatch`; a
 *   cross-tenant selection is `tenant-isolation-rejected`.
 */
import { z } from 'zod';
import type { JsonValue } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/solution-delivery';
import {
  PackageIdSchema,
  PrincipalIdSchema,
  SelectionIdSchema,
  Sha256HexSchema,
  TimestampSchema,
  canonicalDigest,
} from './primitives';
import { QUOTE_SELECTION_SCHEMA_NAME, PROCUREMENT_RECORD_VERSION } from './version';
import { authorityViolationError, hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ProcurementResult, DanglingQuoteReason } from './errors';
import type { AcquisitionPackageStore } from './package';
import type { QuoteStore } from './quote';
import { isQuoteLive } from './quote';

/** One considered-quote comparison entry (by exact digest). */
export const ConsideredQuoteSchema = z
  .strictObject({
    quoteId: z.string().regex(/^quote:[a-z0-9][a-z0-9-]{0,62}$/),
    quoteDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'ConsideredQuote',
    title: 'ConsideredQuote',
    description:
      'One considered-quote comparison entry: the quote id plus its exact content digest (the offer comparison is recorded).',
  });

/** One considered quote. */
export type ConsideredQuote = z.infer<typeof ConsideredQuoteSchema>;

/**
 * The immutable content of one quote-selection record: the recorded
 * offer comparison and decision over one acquisition package.
 */
const quoteSelectionShape = z.strictObject({
  schema: z.literal(QUOTE_SELECTION_SCHEMA_NAME),
  schemaVersion: z.literal(PROCUREMENT_RECORD_VERSION),
  selectionId: SelectionIdSchema,
  tenantId: TenantIdSchema,
  packageId: PackageIdSchema,
  packageDigest: Sha256HexSchema,
  selectedQuoteId: z.string().regex(/^quote:[a-z0-9][a-z0-9-]{0,62}$/),
  selectedQuoteDigest: Sha256HexSchema,
  consideredQuotes: z.array(ConsideredQuoteSchema).min(1).max(64),
  rationale: z.string().min(1).max(4096),
  previousSelectionDigest: Sha256HexSchema.nullable(),
  decidedAt: TimestampSchema,
  decidedBy: PrincipalIdSchema,
});

export const QuoteSelectionContentSchema = quoteSelectionShape
  .readonly()
  .superRefine((selection, ctx) => {
    for (let i = 1; i < selection.consideredQuotes.length; i += 1) {
      if (selection.consideredQuotes[i]!.quoteId < selection.consideredQuotes[i - 1]!.quoteId) {
        ctx.addIssue({
          code: 'custom',
          message: 'consideredQuotes must be sorted by quoteId ascending (deterministic serialization)',
          path: ['consideredQuotes'],
        });
        break;
      }
      if (selection.consideredQuotes[i]!.quoteId === selection.consideredQuotes[i - 1]!.quoteId) {
        ctx.addIssue({
          code: 'custom',
          message: 'consideredQuotes must be duplicate-free by quoteId',
          path: ['consideredQuotes'],
        });
        break;
      }
    }
    if (!selection.consideredQuotes.some((entry) => entry.quoteId === selection.selectedQuoteId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'the selected quote must be a member of the considered-quote comparison set',
        path: ['consideredQuotes'],
      });
    }
  })
  .meta({
    id: 'QuoteSelectionContent',
    title: 'QuoteSelectionContent',
    description:
      'The immutable content of one quote-selection record: the winning quote (by exact digest), the recorded comparison set, the rationale, and the hash-chain link to the previous selection of the same package.',
  });

/** One quote-selection content. */
export type QuoteSelectionContent = z.infer<typeof QuoteSelectionContentSchema>;

/** The SEALED quote-selection record: content plus its content digest. */
export const SealedQuoteSelectionSchema = z
  .strictObject({
    ...quoteSelectionShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedQuoteSelection',
    title: 'SealedQuoteSelection',
    description:
      'The sealed quote-selection record: the recorded offer comparison and decision plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed quote-selection record. */
export type SealedQuoteSelection = z.infer<typeof SealedQuoteSelectionSchema>;

/** Compute the content digest of selection content (canonical JSON). */
export function computeQuoteSelectionDigest(content: QuoteSelectionContent): string {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid quote-selection content into its published record. */
export function sealQuoteSelection(content: unknown): ProcurementResult<SealedQuoteSelection> {
  const pre = authorityViolationError(content);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = QuoteSelectionContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed quote-selection record (schema + digest recomputation). */
export function verifySealedQuoteSelection(
  sealed: unknown,
): ProcurementResult<SealedQuoteSelection> {
  const pre = authorityViolationError(sealed);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = SealedQuoteSelectionSchema.safeParse(sealed);
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
        message:
          'sealed quote-selection record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The append-only selection store (reference in-memory). */
export interface SelectionStore {
  readonly selections: readonly SealedQuoteSelection[];
}

/** An empty selection store. */
export function emptySelectionStore(): SelectionStore {
  return { selections: [] };
}

/** The latest sealed selection of one package id (the chain head), if any. */
export function selectionHead(
  store: SelectionStore,
  packageId: string,
): SealedQuoteSelection | undefined {
  const chain = store.selections.filter((selection) => selection.packageId === packageId);
  return chain.length === 0 ? undefined : chain[chain.length - 1];
}

/**
 * Admit a sealed quote-selection record:
 *
 * - the record verifies (tamper detection);
 * - the package exists and the selection is tenant-consistent with it
 *   (`tenant-isolation-rejected`); the selection's `packageDigest` must
 *   equal the package's content digest (`digest-mismatch`);
 * - the selected quote resolves to the LATEST revision of its quote id
 *   — a missing quote is `dangling-quote-rejected` (reason `missing`);
 * - the selected quote's digest matches the recorded digest
 *   (`digest-mismatch` — the selection references the exact quote
 *   revision);
 * - the selected quote is LIVE at the decision instant — a withdrawn
 *   quote is `dangling-quote-rejected` (reason `withdrawn`), an expired
 *   one reason `expired`;
 * - every considered quote resolves with a matching digest
 *   (`dangling-reference-rejected` / `digest-mismatch`);
 * - the selection chain is sound: the first selection of a package
 *   chains `null`; a re-selection chains the head's exact digest
 *   (`dangling-reference-rejected` / `version-conflict` — never a
 *   silent rewrite);
 * - an exact re-admission is idempotent; the same selection id with
 *   different content is a typed `version-conflict`.
 */
export function admitQuoteSelection(
  packages: AcquisitionPackageStore,
  quotes: QuoteStore,
  store: SelectionStore,
  selection: unknown,
): ProcurementResult<SelectionStore> {
  const verified = verifySealedQuoteSelection(selection);
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
        message: `quote selection "${admitted.selectionId}" references acquisition package "${admitted.packageId}", which does not resolve`,
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
        message: `quote selection "${admitted.selectionId}" belongs to tenant "${admitted.tenantId}" but the acquisition package is scoped to "${pkg.tenantId}" (R12)`,
        expectedTenantId: pkg.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.selectionId,
      },
    };
  }
  if (admitted.packageDigest !== pkg.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `quote selection "${admitted.selectionId}" grounds package digest "${admitted.packageDigest}" but the admitted package's exact digest is "${pkg.contentDigest}"`,
        expected: pkg.contentDigest,
        encountered: admitted.packageDigest,
      },
    };
  }
  const selectedLatest = [...quotes.quotes]
    .filter((quote) => quote.quoteId === admitted.selectedQuoteId)
    .sort((a, b) => a.revision - b.revision)
    .pop();
  if (selectedLatest === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-quote-rejected',
        message: `quote selection "${admitted.selectionId}" selects quote "${admitted.selectedQuoteId}", which does not resolve — a selection must be backed by a live quote digest`,
        selectionId: admitted.selectionId,
        quoteId: admitted.selectedQuoteId,
        reason: 'missing',
      },
    };
  }
  if (selectedLatest.contentDigest !== admitted.selectedQuoteDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `quote selection "${admitted.selectionId}" references quote digest "${admitted.selectedQuoteDigest}" but the quote's latest revision digest is "${selectedLatest.contentDigest}" — the selection must reference the exact live quote revision`,
        expected: selectedLatest.contentDigest,
        encountered: admitted.selectedQuoteDigest,
      },
    };
  }
  const liveReason: DanglingQuoteReason | null = !isQuoteLive(quotes, selectedLatest, admitted.decidedAt)
    ? selectedLatest.state === 'withdrawn'
      ? 'withdrawn'
      : 'expired'
    : null;
  if (liveReason !== null) {
    return {
      ok: false,
      error: {
        code: 'dangling-quote-rejected',
        message: `quote selection "${admitted.selectionId}" selects quote "${admitted.selectedQuoteId}", which is not live at the decision instant (${liveReason}) — a selection must be backed by a live quote digest`,
        selectionId: admitted.selectionId,
        quoteId: admitted.selectedQuoteId,
        reason: liveReason,
      },
    };
  }
  for (const considered of admitted.consideredQuotes) {
    const consideredLatest = [...quotes.quotes]
      .filter((quote) => quote.quoteId === considered.quoteId)
      .sort((a, b) => a.revision - b.revision)
      .pop();
    if (consideredLatest === undefined) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `quote selection "${admitted.selectionId}" considers quote "${considered.quoteId}", which does not resolve`,
          referenceKind: 'quote',
          referenceId: considered.quoteId,
        },
      };
    }
    if (consideredLatest.contentDigest !== considered.quoteDigest) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `quote selection "${admitted.selectionId}" considers quote "${considered.quoteId}" at digest "${considered.quoteDigest}" but the quote's latest revision digest is "${consideredLatest.contentDigest}"`,
          expected: consideredLatest.contentDigest,
          encountered: considered.quoteDigest,
        },
      };
    }
  }
  const existingById = store.selections.find(
    (record) => record.selectionId === admitted.selectionId,
  );
  if (existingById !== undefined) {
    if (existingById.contentDigest === admitted.contentDigest) {
      return { ok: true, value: store };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `quote selection "${admitted.selectionId}" is already sealed with different content — a sealed selection is immutable; a changed decision ships as a NEW selection id chained onto the package's selection chain`,
        subject: 'quote-selection',
        subjectId: admitted.selectionId,
        publishedDigest: existingById.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  const head = selectionHead(store, admitted.packageId);
  if (head === undefined) {
    if (admitted.previousSelectionDigest !== null) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `quote selection "${admitted.selectionId}" chains a previous selection digest but the package has no selection chain`,
          referenceKind: 'selection',
          referenceId: admitted.packageId,
        },
      };
    }
    return { ok: true, value: { selections: [...store.selections, admitted] } };
  }
  if (admitted.previousSelectionDigest === null) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `acquisition package "${admitted.packageId}" already has a recorded selection ("${head.selectionId}") — a re-selection must chain the head selection digest, never silently replace it`,
        subject: 'quote-selection-chain',
        subjectId: admitted.packageId,
        publishedDigest: head.contentDigest,
      },
    };
  }
  if (admitted.previousSelectionDigest !== head.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `quote selection "${admitted.selectionId}" chains previous selection digest "${admitted.previousSelectionDigest}" but the package's chain head is "${head.contentDigest}" (selection "${head.selectionId}")`,
        referenceKind: 'selection',
        referenceId: admitted.selectionId,
      },
    };
  }
  return { ok: true, value: { selections: [...store.selections, admitted] } };
}

/** The selection-store fold: selections sorted by selectionId (deterministic). */
export function foldQuoteSelections(
  store: SelectionStore,
): readonly SealedQuoteSelection[] {
  return [...store.selections].sort((a, b) => (a.selectionId < b.selectionId ? -1 : 1));
}
