/**
 * Construction work templates (DP1.0 "work templates"): versioned,
 * content-addressed construction work-package/activity templates as PURE
 * DATA. Template INSTANTIATION is a caller-side fold — `instantiateWorkTemplate`
 * returns a plan-compatible `WorkPackage`-shaped value the caller may feed
 * to the W036 `buildProgramOfWork` admission; the pack itself performs NO
 * canonical write anywhere.
 *
 * Content addressing follows the W036 sealed-envelope discipline: the
 * template content is canonically ordered and sealed with its SHA-256
 * content digest (`sealWorkTemplate` / `verifyWorkTemplate`,
 * `digest-mismatch` on tamper).
 */
import { z } from 'zod';
import {
  NonNegativeDecimalSchema,
  QualifiedNameSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  TimestampSchema,
  UnitLabelSchema,
  WorkPackageIdSchema,
  type WorkPackage,
} from '@epoch/solution-delivery';
import {
  CONSTRUCTION_PACK_RECORD_VERSION,
  TEMPLATE_SLOT_ID_PATTERN,
  WORK_TEMPLATE_SCHEMA_NAME,
} from './version';
import { classifyPackRecord, digestOf, parsePackRecord, refineSortedUnique } from './util';
import type { PackError, PackResult } from './errors';

// --------------------------------------------------------------------------------
// The template record.
// --------------------------------------------------------------------------------

/** One template activity slot: a template-local activity definition. */
export const TemplateActivitySlotSchema = z
  .strictObject({
    slotId: z.string().regex(TEMPLATE_SLOT_ID_PATTERN),
    title: z.string().min(1).max(256),
    plannedQuantity: z
      .strictObject({
        value: NonNegativeDecimalSchema,
        unit: UnitLabelSchema,
      })
      .readonly()
      .optional(),
    predecessorSlots: z.array(z.string().regex(TEMPLATE_SLOT_ID_PATTERN)).max(64),
    responsibleRole: z.string().min(1).max(128).optional(),
  })
  .readonly()
  .superRefine((slot, ctx) => {
    for (let i = 1; i < slot.predecessorSlots.length; i += 1) {
      if (slot.predecessorSlots[i]! < slot.predecessorSlots[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'predecessorSlots must be sorted ascending (deterministic serialization)',
          path: ['predecessorSlots'],
        });
        break;
      }
      if (slot.predecessorSlots[i]! === slot.predecessorSlots[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'predecessorSlots must be duplicate-free',
          path: ['predecessorSlots'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'TemplateActivitySlot',
    title: 'TemplateActivitySlot',
    description:
      'One template activity slot: a template-local slug, title, optional planned quantity, sorted predecessor slots and an optional responsible role.',
  });

/** One template activity slot. */
export type TemplateActivitySlot = z.infer<typeof TemplateActivitySlotSchema>;

/** The immutable content of one construction work template. */
const WORK_TEMPLATE_BASE = z.strictObject({
  schema: z.literal(WORK_TEMPLATE_SCHEMA_NAME),
  schemaVersion: z.literal(CONSTRUCTION_PACK_RECORD_VERSION),
  templateId: QualifiedNameSchema,
  templateVersion: SemverCoreSchema,
  title: z.string().min(1).max(256),
  description: z.string().max(4096).optional(),
  realizationVariant: z.literal('construction-build'),
  activitySlots: z.array(TemplateActivitySlotSchema).min(1).max(128),
});

/** The immutable content of one construction work template (validated). */
export const WorkTemplateContentSchema = WORK_TEMPLATE_BASE.readonly().superRefine(
  (template, ctx) => {
    refineSortedUnique(template.activitySlots, ctx, 'activitySlots', 'slotId');
    const slotIds = new Set(template.activitySlots.map((slot) => slot.slotId));
    for (const slot of template.activitySlots) {
      for (const predecessor of slot.predecessorSlots) {
        if (!slotIds.has(predecessor)) {
          ctx.addIssue({
            code: 'custom',
            message: `slot "${slot.slotId}" lists unknown predecessor slot "${predecessor}"`,
            path: ['activitySlots'],
          });
        }
        if (predecessor === slot.slotId) {
          ctx.addIssue({
            code: 'custom',
            message: `slot "${slot.slotId}" lists itself as a predecessor (template slots are acyclic)`,
            path: ['activitySlots'],
          });
        }
      }
    }
    // CYCLE detection over the predecessor edges (iterative coloring — the
    // W036 schedule-cycle pattern, template-local).
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    for (const slot of template.activitySlots) {
      color.set(slot.slotId, WHITE);
    }
    const predecessorsOf = (slotId: string): readonly string[] =>
      template.activitySlots.find((slot) => slot.slotId === slotId)?.predecessorSlots ?? [];
    for (const root of template.activitySlots.map((slot) => slot.slotId)) {
      if (color.get(root) !== WHITE) {
        continue;
      }
      const stack: Array<{ id: string; nextIndex: number; path: string[] }> = [
        { id: root, nextIndex: 0, path: [root] },
      ];
      color.set(root, GRAY);
      while (stack.length > 0) {
        const frame = stack[stack.length - 1]!;
        const edges = predecessorsOf(frame.id);
        if (frame.nextIndex >= edges.length) {
          color.set(frame.id, BLACK);
          stack.pop();
          continue;
        }
        const nextId = edges[frame.nextIndex]!;
        frame.nextIndex += 1;
        const nextColor = color.get(nextId) ?? BLACK;
        if (nextColor === BLACK) {
          continue;
        }
        if (nextColor === GRAY) {
          const cycleStart = frame.path.indexOf(nextId);
          const cycle =
            cycleStart === -1
              ? [nextId, ...frame.path, nextId]
              : [...frame.path.slice(cycleStart), nextId];
          ctx.addIssue({
            code: 'custom',
            message: `template activity slots contain a dependency cycle: ${cycle.join(' -> ')} (template slots are acyclic)`,
            path: ['activitySlots'],
          });
          stack.length = 0;
          break;
        }
        color.set(nextId, GRAY);
        stack.push({ id: nextId, nextIndex: 0, path: [...frame.path, nextId] });
      }
    }
  },
)
  .meta({
    id: 'WorkTemplateContent',
    title: 'WorkTemplateContent',
    description:
      'The immutable content of one construction work template: qualified id, semver version, construction realization variant, and sorted acyclic activity slots.',
  });

/** One work-template content. */
export type WorkTemplateContent = z.infer<typeof WorkTemplateContentSchema>;

/** The SEALED construction work template: content plus its SHA-256 digest. */
export const SealedWorkTemplateSchema = z
  .strictObject({ ...WORK_TEMPLATE_BASE.shape, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedWorkTemplate',
    title: 'SealedWorkTemplate',
    description:
      'The sealed construction work template: canonically ordered immutable content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed construction work template. */
export type SealedWorkTemplate = z.infer<typeof SealedWorkTemplateSchema>;

/**
 * Seal a construction work template: write-intent pre-classification
 * (`boq-direct-write-rejected` / `parallel-ledger-rejected` / the W036
 * authority classifier applies at profile admission), schema validation,
 * then the SHA-256 content digest. Total — errors are values.
 */
export function sealWorkTemplate(content: unknown): PackResult<SealedWorkTemplate> {
  const writeIntent = classifyPackRecord(content);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = parsePackRecord(WorkTemplateContentSchema, content);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, value: { ...parsed.value, contentDigest: digestOf(parsed.value) } };
}

/**
 * Verify a sealed construction work template: schema validation + digest
 * recomputation (`digest-mismatch` on tamper).
 */
export function verifyWorkTemplate(sealed: unknown): PackResult<SealedWorkTemplate> {
  const writeIntent = classifyPackRecord(sealed);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = parsePackRecord(SealedWorkTemplateSchema, sealed);
  if (!parsed.ok) {
    return parsed;
  }
  const { contentDigest, ...content } = parsed.value;
  const expected = digestOf(content);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed work template digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      } satisfies PackError,
    };
  }
  return { ok: true, value: parsed.value };
}

// --------------------------------------------------------------------------------
// The construction work-template catalog (pure data, content-addressed at
// seal time by `constructionWorkTemplates()` below).
// --------------------------------------------------------------------------------

/** The substructure work-package template content (loose JSON data). */
const SUBSTRUCTURE_TEMPLATE: WorkTemplateContent = {
  schema: 'epoch.pack-construction.work-template',
  schemaVersion: 1,
  templateId: 'construction.template.substructure',
  templateVersion: '1.0.0',
  title: 'Substructure works package',
  description:
    'Excavation, blinding and reinforced concrete foundation works for one building substructure zone.',
  realizationVariant: 'construction-build',
  activitySlots: [
    {
      slotId: 'blind',
      title: 'Blinding layer to formation',
      plannedQuantity: { value: '40', unit: 'm3' },
      predecessorSlots: ['excavate'],
      responsibleRole: 'Concrete gang lead',
    },
    {
      slotId: 'excavate',
      title: 'Bulk excavation to formation level',
      plannedQuantity: { value: '120', unit: 'm3' },
      predecessorSlots: [],
      responsibleRole: 'Earthworks foreman',
    },
    {
      slotId: 'foundations',
      title: 'Reinforced concrete foundations',
      plannedQuantity: { value: '85', unit: 'm3' },
      predecessorSlots: ['blind'],
      responsibleRole: 'Concrete gang lead',
    },
  ],
};

/** The superstructure work-package template content (loose JSON data). */
const SUPERSTRUCTURE_TEMPLATE: WorkTemplateContent = {
  schema: 'epoch.pack-construction.work-template',
  schemaVersion: 1,
  templateId: 'construction.template.superstructure',
  templateVersion: '1.0.0',
  title: 'Superstructure frame works package',
  description:
    'Reinforced concrete frame and structural steel erection for one building frame zone.',
  realizationVariant: 'construction-build',
  activitySlots: [
    {
      slotId: 'deck',
      title: 'Composite floor deck',
      plannedQuantity: { value: '320', unit: 'm2' },
      predecessorSlots: ['steel-beams'],
      responsibleRole: 'Steel erection supervisor',
    },
    {
      slotId: 'frame-columns',
      title: 'Concrete frame columns',
      plannedQuantity: { value: '60', unit: 'm3' },
      predecessorSlots: [],
      responsibleRole: 'Concrete gang lead',
    },
    {
      slotId: 'steel-beams',
      title: 'Structural steel beams and bracing',
      plannedQuantity: { value: '4', unit: 'tonne' },
      predecessorSlots: ['frame-columns'],
      responsibleRole: 'Steel erection supervisor',
    },
  ],
};

/** The envelope works-package template content (loose JSON data). */
const ENVELOPE_TEMPLATE: WorkTemplateContent = {
  schema: 'epoch.pack-construction.work-template',
  schemaVersion: 1,
  templateId: 'construction.template.envelope',
  templateVersion: '1.0.0',
  title: 'Building envelope works package',
  description: 'Facade wall assemblies and window installation to weathertight state.',
  realizationVariant: 'construction-build',
  activitySlots: [
    {
      slotId: 'facade-walls',
      title: 'Facade wall assemblies',
      plannedQuantity: { value: '240', unit: 'm2' },
      predecessorSlots: [],
      responsibleRole: 'Facade works lead',
    },
    {
      slotId: 'windows',
      title: 'Window installation',
      plannedQuantity: { value: '24', unit: 'number' },
      predecessorSlots: ['facade-walls'],
      responsibleRole: 'Facade works lead',
    },
  ],
};

/**
 * The construction work-template catalog, sealed and sorted by templateId
 * ascending. Deterministic: the same catalog content yields the same
 * digests on every call.
 */
export function constructionWorkTemplates(): readonly SealedWorkTemplate[] {
  const contents = [ENVELOPE_TEMPLATE, SUBSTRUCTURE_TEMPLATE, SUPERSTRUCTURE_TEMPLATE].sort((a, b) =>
    a.templateId < b.templateId ? -1 : 1,
  );
  const sealed: SealedWorkTemplate[] = [];
  for (const content of contents) {
    const result = sealWorkTemplate(content);
    if (!result.ok) {
      throw new Error(
        `construction work template "${content.templateId}" failed to seal (pack data invariant broken): ${JSON.stringify(result.error)}`,
      );
    }
    sealed.push(result.value);
  }
  return sealed;
}

// --------------------------------------------------------------------------------
// Template instantiation (a caller-side fold; NO canonical writes).
// --------------------------------------------------------------------------------

/** The instantiation parameters: canonical ids for the instantiated package. */
export const TemplateInstantiationParamsSchema = z
  .strictObject({
    workPackageId: WorkPackageIdSchema,
    title: z.string().min(1).max(256),
    activityIds: z.record(
      z.string().regex(TEMPLATE_SLOT_ID_PATTERN),
      z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
    ),
    plannedStart: TimestampSchema.optional(),
    plannedFinish: TimestampSchema.optional(),
  })
  .readonly()
  .superRefine((params, ctx) => {
    const slotIds = Object.keys(params.activityIds);
    const seen = new Set<string>();
    for (const id of Object.values(params.activityIds)) {
      if (seen.has(id)) {
        ctx.addIssue({
          code: 'custom',
          message: 'activityIds must be injective (one canonical activity id per slot)',
          path: ['activityIds'],
        });
        break;
      }
      seen.add(id);
    }
    if (slotIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'activityIds must cover every template slot',
        path: ['activityIds'],
      });
    }
    if (params.plannedStart !== undefined && params.plannedFinish !== undefined) {
      if (params.plannedFinish < params.plannedStart) {
        ctx.addIssue({
          code: 'custom',
          message: 'plannedFinish must not precede plannedStart',
          path: ['plannedFinish'],
        });
      }
    }
  })
  .meta({
    id: 'TemplateInstantiationParams',
    title: 'TemplateInstantiationParams',
    description:
      'The caller-supplied instantiation parameters: the canonical work-package id, title, one canonical activity id per slot, and optional planned dates.',
  });

/** One instantiation parameter set. */
export type TemplateInstantiationParams = z.infer<typeof TemplateInstantiationParamsSchema>;

/**
 * Instantiate one sealed work template into a PLAN-COMPATIBLE work-package
 * shape: a pure fold binding the template slots to the caller-supplied
 * canonical ids, filling the predecessor/successor mirrors the W036
 * `buildProgramOfWork` admission requires. The returned value is DATA —
 * the pack writes nothing; the caller admits it through the kernel.
 *
 * Total: unknown slots in `activityIds`, or a slot missing from it, are
 * typed `validation` errors.
 */
export function instantiateWorkTemplate(
  template: SealedWorkTemplate,
  params: unknown,
): PackResult<WorkPackage> {
  const parsedParams = parsePackRecord(TemplateInstantiationParamsSchema, params);
  if (!parsedParams.ok) {
    return parsedParams;
  }
  const { workPackageId, title, activityIds, plannedStart, plannedFinish } = parsedParams.value;
  const slotIds = new Set(template.activitySlots.map((slot) => slot.slotId));
  for (const slot of Object.keys(activityIds)) {
    if (!slotIds.has(slot)) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `activityIds maps unknown template slot "${slot}"`,
          issues: [{ path: 'activityIds', message: `unknown slot "${slot}"` }],
        } satisfies PackError,
      };
    }
  }
  for (const slot of template.activitySlots) {
    if (activityIds[slot.slotId] === undefined) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `activityIds does not cover template slot "${slot.slotId}"`,
          issues: [{ path: 'activityIds', message: `missing slot "${slot.slotId}"` }],
        } satisfies PackError,
      };
    }
  }
  const activities = template.activitySlots
    .map((slot) => {
      const activityId = activityIds[slot.slotId]!;
      const predecessors = slot.predecessorSlots
        .map((predecessorSlot) => activityIds[predecessorSlot]!)
        .sort();
      return {
        activityId,
        workPackageId,
        title: slot.title,
        realizationVariant: template.realizationVariant,
        plannedQuantity: slot.plannedQuantity,
        plannedStart,
        plannedFinish,
        predecessors,
        successors: [] as string[],
        resources: [],
        constraintReferences: [],
        blockers: [],
        evidence: [],
      };
    })
    .sort((a, b) => (a.activityId < b.activityId ? -1 : 1));
  // Fill the successor mirrors from the predecessor edges (the W036
  // dependency-mirror consistency requirement).
  const byId = new Map(activities.map((activity) => [activity.activityId, activity]));
  for (const activity of activities) {
    for (const predecessorId of activity.predecessors) {
      const predecessor = byId.get(predecessorId);
      if (predecessor !== undefined && predecessorId !== activity.activityId) {
        predecessor.successors.push(activity.activityId);
      }
    }
  }
  for (const activity of activities) {
    activity.successors.sort();
  }
  return {
    ok: true,
    value: {
      workPackageId,
      title,
      description: template.description,
      realizationVariant: template.realizationVariant,
      plannedStart,
      plannedFinish,
      resources: [],
      constraintReferences: [],
      approvals: [],
      verificationGates: [],
      activities,
    } satisfies WorkPackage,
  };
}