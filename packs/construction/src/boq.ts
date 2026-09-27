/**
 * The BOQ projection (W026, the DP1.0 projection rule): a typed view model
 * of the Bill of Quantities as a PURE FOLD over the W036 sealed state —
 * the `SealedSolutionVersion` plan lines (identity-mapped to their
 * `line:<slug>` ids — the SAME ids, NEVER minted), the quantity/cost
 * schedules of the `SealedProgramOfWork`, and the derived delivery-link
 * index (BOQ <-> procurement <-> execution).
 *
 * - The BOQ is RECOMPUTED on every call: it is never stored, never
 *   admitted, never mutated — `projectBoq` is the ONLY surface and it is a
 *   projection (`boq-direct-write-rejected` /
 *   `parallel-ledger-rejected` classify any stored-BOQ attempt at the pack
 *   admission surfaces; the BOQ view model itself has NO write path).
 * - Quantities derive through the construction measurement methods
 *   (net/gross rules, exact decimal arithmetic); amounts are net quantity
 *   × unit rate; totals are exact per-currency folds.
 * - Sections group plan lines by their World Model entity bindings
 *   (element/space/system/zone) when world entities are supplied;
 *   unbound lines fall to the deterministic preliminaries section.
 * - Partial data follows SN1.0: missing program/acquisitions/delivery
 *   project as empty links; unmatched units project as `unmatched`
 *   quantities — never blockers.
 */
import { z } from 'zod';
import {
  addNonNegativeDecimals,
  Sha256HexSchema,
  verifySealedSolutionVersion,
  type SealedProgramOfWork,
  type SealedSolutionVersion,
} from '@epoch/solution-delivery';
import {
  BOQ_PRELIMINARIES_SECTION_CODE,
  BOQ_VIEW_SCHEMA_NAME,
  CONSTRUCTION_CONCEPTS,
  CONSTRUCTION_CONCEPT_TERMS,
  CONSTRUCTION_PACK_ID,
  CONSTRUCTION_PACK_RECORD_VERSION,
  CONSTRUCTION_PACK_VERSION,
} from './version';
import { classifyPackRecord, digestOf, multiplyNonNegativeDecimals } from './util';
import type { PackResult } from './errors';
import {
  CONSTRUCTION_ENTITY_BINDINGS,
  CONSTRUCTION_MEASUREMENT_METHODS,
  classifyWorldEntity,
  MeasuredQuantitySchema,
  measureQuantity,
  type EntityBinding,
  type MeasurementMethod,
} from './measurement';
import type { ConstructionConcept } from './version';
import { foldDeliveryLinks, type DeliveryLinkInputs } from './links';

// --------------------------------------------------------------------------------
// The BOQ view model.
// --------------------------------------------------------------------------------

/** One BOQ line item: identity-mapped to its canonical plan-line id. */
export const BoqLineItemSchema = z
  .strictObject({
    /** The canonical solution plan-line id — the SAME id, never minted. */
    lineId: z.string().regex(/^line:[a-z0-9][a-z0-9-]{0,62}$/),
    title: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    sectionCode: z.string().min(1).max(128),
    unit: z.string().min(1).max(32),
    quantity: MeasuredQuantitySchema,
    rate: z
      .strictObject({
        amount: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .readonly()
      .optional(),
    amount: z
      .strictObject({
        amount: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .readonly()
      .optional(),
    /** The derived delivery links of this line (Plan -> Acquire -> Realize). */
    links: z
      .strictObject({
        workPackageIds: z.array(z.string().regex(/^work-package:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
        activityIds: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(1024),
        acquisitionRequestIds: z
          .array(z.string().regex(/^acquisition:[a-z0-9][a-z0-9-]{0,62}$/))
          .max(256),
        observationIds: z
          .array(z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/))
          .max(1024),
        actualIds: z.array(z.string().regex(/^actual:[a-z0-9][a-z0-9-]{0,62}$/)).max(1024),
      })
      .readonly(),
  })
  .readonly()
  .meta({
    id: 'BoqLineItem',
    title: 'BoqLineItem',
    description:
      'One BOQ line item: the canonical plan-line id (identity-mapped, never minted), title, section, unit, measured quantity (net/gross), unit rate, line amount and the derived delivery links.',
  });

/** One BOQ line item. */
export type BoqLineItem = z.infer<typeof BoqLineItemSchema>;

/** One BOQ section: a deterministic grouping of plan lines. */
export const BoqSectionSchema = z
  .strictObject({
    sectionCode: z.string().min(1).max(128),
    title: z.string().min(1).max(256),
    /** The canonical world-entity id this section groups (preliminaries carries none). */
    worldEntityId: z.string().min(1).max(256).optional(),
    /** The construction concept of the bound entity (element/space/system/zone). */
    concept: z.enum(['element', 'space', 'system', 'zone']).optional(),
    lineIds: z.array(z.string().regex(/^line:[a-z0-9][a-z0-9-]{0,62}$/)).max(512),
  })
  .readonly()
  .meta({
    id: 'BoqSection',
    title: 'BoqSection',
    description:
      'One BOQ section: a deterministic grouping of plan lines by their world-entity binding (construction concept) — the preliminaries section groups unbound lines.',
  });

/** One BOQ section. */
export type BoqSection = z.infer<typeof BoqSectionSchema>;

/** One BOQ currency total. */
export const BoqCurrencyTotalSchema = z
  .strictObject({
    currency: z.string().regex(/^[A-Z]{3}$/),
    totalAmount: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
  })
  .readonly()
  .meta({
    id: 'BoqCurrencyTotal',
    title: 'BoqCurrencyTotal',
    description: 'One BOQ currency total: the exact sum of line amounts per currency.',
  });

/** One BOQ currency total. */
export type BoqCurrencyTotal = z.infer<typeof BoqCurrencyTotalSchema>;

/** The BOQ view: the synchronized BOQ projection of the sealed solution-delivery state. */
export const BoqViewSchema = z
  .strictObject({
    schema: z.literal(BOQ_VIEW_SCHEMA_NAME),
    schemaVersion: z.literal(CONSTRUCTION_PACK_RECORD_VERSION),
    packId: z.literal(CONSTRUCTION_PACK_ID),
    packVersion: z.literal(CONSTRUCTION_PACK_VERSION),
    tenantId: z.string().regex(/^tenant:[a-z0-9][a-z0-9-]{0,62}$/),
    solutionId: z.string().regex(/^solution:[a-z0-9][a-z0-9-]{0,62}$/),
    solutionVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    solutionVersionDigest: Sha256HexSchema,
    programId: z.string().regex(/^program:[a-z0-9][a-z0-9-]{0,62}$/).optional(),
    title: z.string().min(1).max(256),
    sections: z.array(BoqSectionSchema).max(256),
    lineItems: z.array(BoqLineItemSchema).max(512),
    totals: z.array(BoqCurrencyTotalSchema).max(32),
    /** The measurement vocabulary used by this projection (sorted provenance). */
    measurementMethodIds: z.array(z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/)).max(64),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .superRefine((view, ctx) => {
    for (let i = 1; i < view.sections.length; i += 1) {
      if (view.sections[i]!.sectionCode < view.sections[i - 1]!.sectionCode) {
        ctx.addIssue({
          code: 'custom',
          message: 'sections must be sorted by sectionCode ascending (deterministic serialization)',
          path: ['sections'],
        });
        break;
      }
    }
    for (let i = 1; i < view.lineItems.length; i += 1) {
      if (view.lineItems[i]!.lineId < view.lineItems[i - 1]!.lineId) {
        ctx.addIssue({
          code: 'custom',
          message: 'lineItems must be sorted by lineId ascending (deterministic serialization)',
          path: ['lineItems'],
        });
        break;
      }
    }
    const sectionCodes = new Set(view.sections.map((section) => section.sectionCode));
    for (const item of view.lineItems) {
      if (!sectionCodes.has(item.sectionCode)) {
        ctx.addIssue({
          code: 'custom',
          message: `line item "${item.lineId}" references unknown section "${item.sectionCode}"`,
          path: ['lineItems'],
        });
      }
    }
  })
  .meta({
    id: 'BoqView',
    title: 'BoqView',
    description:
      'The BOQ view model: the synchronized bill-of-quantities projection over the sealed solution version (plan lines, identity-mapped), its measurement derivations, rates, amounts, currency totals and delivery links — recomputed on every call, never stored.',
  });

/** One BOQ view. */
export type BoqView = z.infer<typeof BoqViewSchema>;

// --------------------------------------------------------------------------------
// The projection inputs.
// --------------------------------------------------------------------------------

/** A light world-model entity view (id + type) for section classification. */
export interface WorldEntityView {
  readonly id: string;
  readonly type: string;
}

/** The inputs of the BOQ projection (all optional except the solution). */
export interface BoqProjectionInputs extends DeliveryLinkInputs {
  readonly solution: SealedSolutionVersion;
  readonly program?: SealedProgramOfWork | undefined;
  /** World-model entity views for BOQ section classification (optional). */
  readonly worldEntities?: readonly WorldEntityView[] | undefined;
  /** The measurement vocabulary (defaults to the pack methods). */
  readonly methods?: readonly MeasurementMethod[] | undefined;
  /** The entity bindings (defaults to the pack bindings). */
  readonly bindings?: readonly EntityBinding[] | undefined;
}

// --------------------------------------------------------------------------------
// The projection fold.
// --------------------------------------------------------------------------------

/**
 * Project the BOQ view over the sealed solution-delivery state:
 *
 * - the solution must verify (`digest-mismatch` on a tampered seal);
 * - the program/delivery/acquisitions must verify and belong to the same
 *   solution and tenant (`cross-tenant-denied` — tenant isolation on every
 *   record the pack produces; the view carries the input tenant id);
 * - plan lines project as line items IDENTITY-MAPPED to their canonical
 *   `line:<slug>` ids — the pack never mints BOQ identities;
 * - quantities derive through the measurement methods (net/gross rules);
 *   amounts are net × unit rate (exact decimal arithmetic);
 * - sections group lines by world-entity bindings; unbound lines fall to
 *   the deterministic preliminaries section;
 * - line items embed their derived delivery links (BOQ <-> procurement <->
 *   execution as projections of the universal Plan/Acquire/Realize).
 *
 * Deterministic: sections, line items, totals and id lists are canonically
 * ordered; identical inputs yield identical digests. Partial data follows
 * SN1.0 — missing inputs project as empty links/sections, never blockers.
 */
export function projectBoq(inputs: BoqProjectionInputs): PackResult<BoqView> {
  const solution = verifySealedSolutionVersion(inputs.solution);
  if (!solution.ok) {
    return solution;
  }
  const head = solution.value;

  const links = foldDeliveryLinks({
    solution: inputs.solution,
    program: inputs.program,
    acquisitions: inputs.acquisitions,
    delivery: inputs.delivery,
  });
  if (!links.ok) {
    return links;
  }
  const linkIndex = links.value;
  const linksOf = (lineId: string) => {
    const row = linkIndex.rows.find((candidate) => candidate.solutionLineId === lineId);
    return {
      workPackageIds: row ? [...row.workPackageIds] : [],
      activityIds: row ? [...row.activityIds] : [],
      acquisitionRequestIds: row ? [...row.acquisitionRequestIds] : [],
      observationIds: row ? [...row.observationIds] : [],
      actualIds: row ? [...row.actualIds] : [],
    };
  };

  const methods = [...(inputs.methods ?? CONSTRUCTION_MEASUREMENT_METHODS)].sort((a, b) =>
    a.methodId < b.methodId ? -1 : 1,
  );
  const bindings = inputs.bindings ?? CONSTRUCTION_ENTITY_BINDINGS;
  const entityViews = [...(inputs.worldEntities ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
  const conceptOf = new Map<string, ConstructionConcept | undefined>();
  for (const entity of entityViews) {
    if (!conceptOf.has(entity.id)) {
      conceptOf.set(entity.id, classifyWorldEntity(bindings, entity).concept);
    }
  }

  // Sections: one per bound world entity present in the plan lines, plus
  // the deterministic preliminaries section for unbound lines.
  const sectionOfEntity = new Map<string, { worldEntityId: string; concept?: ConstructionConcept }>();
  for (const line of head.solutionLines) {
    if (line.worldEntityId === undefined) {
      continue;
    }
    if (!sectionOfEntity.has(line.worldEntityId)) {
      sectionOfEntity.set(line.worldEntityId, {
        worldEntityId: line.worldEntityId,
        concept: conceptOf.get(line.worldEntityId),
      });
    }
  }

  const sectionCodeOf = (worldEntityId: string | undefined): string =>
    worldEntityId === undefined
      ? BOQ_PRELIMINARIES_SECTION_CODE
      : `sec-${worldEntityId.replace(/[^a-z0-9-]/g, '-')}`;

  const lineItems: BoqLineItem[] = head.solutionLines.map((line) => {
    const measured = measureQuantity(methods, line.quantity.unit, line.quantity.value);
    const amount =
      line.unitCost === undefined
        ? undefined
        : {
            amount: multiplyNonNegativeDecimals(line.unitCost.amount, measured.net),
            currency: line.unitCost.currency,
          };
    const lineLinks = linksOf(line.lineId);
    return {
      lineId: line.lineId,
      title: line.title,
      description: line.description,
      sectionCode: sectionCodeOf(line.worldEntityId),
      unit: line.quantity.unit,
      quantity: measured,
      rate: line.unitCost,
      amount,
      links: {
        workPackageIds: lineLinks.workPackageIds,
        activityIds: lineLinks.activityIds,
        acquisitionRequestIds: lineLinks.acquisitionRequestIds,
        observationIds: lineLinks.observationIds,
        actualIds: lineLinks.actualIds,
      },
    };
  });

  const usedMethodIds = [...new Set(lineItems.map((item) => item.quantity.measurementMethodId).filter((id) => id !== undefined))].sort();

  // Group the line ids per section code (deterministic).
  const linesPerSection = new Map<string, string[]>();
  for (const item of lineItems) {
    const existing = linesPerSection.get(item.sectionCode) ?? [];
    existing.push(item.lineId);
    linesPerSection.set(item.sectionCode, existing);
  }
  const sections: BoqSection[] = [...sectionOfEntity.entries()]
    .map(([worldEntityId, entry]) => {
      const concept =
        entry.concept !== undefined && (CONSTRUCTION_CONCEPTS as readonly string[]).includes(entry.concept)
          ? entry.concept
          : undefined;
      const conceptTerm =
        concept !== undefined
          ? CONSTRUCTION_CONCEPT_TERMS[concept as keyof typeof CONSTRUCTION_CONCEPT_TERMS]
          : 'Works';
      return {
        sectionCode: sectionCodeOf(worldEntityId),
        title: `${conceptTerm}: ${worldEntityId}`,
        worldEntityId,
        concept,
        lineIds: (linesPerSection.get(sectionCodeOf(worldEntityId)) ?? []).sort(),
      };
    })
    .filter((section) => section.lineIds.length > 0);
  const preliminariesLineIds = (linesPerSection.get(BOQ_PRELIMINARIES_SECTION_CODE) ?? []).sort();
  if (preliminariesLineIds.length > 0) {
    sections.push({
      sectionCode: BOQ_PRELIMINARIES_SECTION_CODE,
      title: 'Preliminaries & general items',
      lineIds: preliminariesLineIds,
    });
  }
  sections.sort((a, b) => (a.sectionCode < b.sectionCode ? -1 : 1));

  // Currency totals: exact per-currency folds over the line amounts.
  const totals = new Map<string, string>();
  for (const item of lineItems) {
    if (item.amount === undefined) {
      continue;
    }
    totals.set(
      item.amount.currency,
      addNonNegativeDecimals(totals.get(item.amount.currency) ?? '0', item.amount.amount),
    );
  }
  const totalRows = [...totals.entries()]
    .map(([currency, totalAmount]) => ({ currency, totalAmount }))
    .sort((a, b) => (a.currency < b.currency ? -1 : 1));

  const content = {
    schema: BOQ_VIEW_SCHEMA_NAME,
    schemaVersion: CONSTRUCTION_PACK_RECORD_VERSION,
    packId: CONSTRUCTION_PACK_ID,
    packVersion: CONSTRUCTION_PACK_VERSION,
    tenantId: head.tenantId,
    solutionId: head.solutionId,
    solutionVersion: head.version,
    solutionVersionDigest: head.contentDigest,
    programId: inputs.program?.programId,
    title: 'Bill of quantities (BOQ)',
    sections,
    lineItems,
    totals: totalRows,
    measurementMethodIds: usedMethodIds,
  };
  return { ok: true, value: { ...content, contentDigest: digestOf(content) } };
}

/**
 * Verify a BOQ view envelope: schema validation + digest recomputation
 * (`digest-mismatch` on tamper). The view is a PROJECTION — verification
 * proves the envelope is intact, never that it is canonical state.
 */
export function verifyBoqView(sealed: unknown): PackResult<BoqView> {
  const writeIntent = classifyPackRecord(sealed);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = BoqViewSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'BOQ view failed schema validation',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = digestOf(content);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'BOQ view digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
