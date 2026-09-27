/**
 * Software work templates (DP1.0 "work templates"): versioned,
 * content-addressed software work-package/activity templates as PURE DATA.
 * Template INSTANTIATION is a caller-side fold — `instantiateWorkTemplate`
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
  SOFTWARE_PACK_RECORD_VERSION,
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

/** The immutable content of one software work template. */
const WORK_TEMPLATE_BASE = z.strictObject({
  schema: z.literal(WORK_TEMPLATE_SCHEMA_NAME),
  schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
  templateId: QualifiedNameSchema,
  templateVersion: SemverCoreSchema,
  title: z.string().min(1).max(256),
  description: z.string().max(4096).optional(),
  realizationVariant: z.enum(['software-implementation-deployment', 'infrastructure-provisioning']),
  activitySlots: z.array(TemplateActivitySlotSchema).min(1).max(128),
});

/** The immutable content of one software work template (validated). */
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
      'The immutable content of one software work template: qualified id, semver version, software realization variant, and sorted acyclic activity slots.',
  });

/** One work-template content. */
export type WorkTemplateContent = z.infer<typeof WorkTemplateContentSchema>;

/** The SEALED software work template: content plus its SHA-256 digest. */
export const SealedWorkTemplateSchema = z
  .strictObject({ ...WORK_TEMPLATE_BASE.shape, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedWorkTemplate',
    title: 'SealedWorkTemplate',
    description:
      'The sealed software work template: canonically ordered immutable content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed software work template. */
export type SealedWorkTemplate = z.infer<typeof SealedWorkTemplateSchema>;

/**
 * Seal a software work template: write-intent pre-classification
 * (`parallel-tracker-rejected` / `gateway-bypass-rejected` / the W036
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
 * Verify a sealed software work template: write-intent pre-classification,
 * schema validation + digest recomputation (`digest-mismatch` on tamper).
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
// The software work-template catalog (pure data, content-addressed at
// seal time by `softwareWorkTemplates()` below).
// --------------------------------------------------------------------------------

/** The feature-delivery work-package template content (loose JSON data). */
const FEATURE_DELIVERY_TEMPLATE: WorkTemplateContent = {
  schema: 'epoch.pack-software.work-template',
  schemaVersion: 1,
  templateId: 'software.template.feature-delivery',
  templateVersion: '1.0.0',
  title: 'Feature delivery package',
  description:
    'Specify, implement and verify one user-facing feature slice through to merge readiness.',
  realizationVariant: 'software-implementation-deployment',
  activitySlots: [
    {
      slotId: 'implement',
      title: 'Implement the feature',
      plannedQuantity: { value: '40', unit: 'hour' },
      predecessorSlots: ['specify'],
      responsibleRole: 'Feature engineer',
    },
    {
      slotId: 'specify',
      title: 'Specify acceptance criteria',
      plannedQuantity: { value: '8', unit: 'hour' },
      predecessorSlots: [],
      responsibleRole: 'Product engineer',
    },
    {
      slotId: 'verify',
      title: 'Verify with automated test suite',
      plannedQuantity: { value: '8', unit: 'hour' },
      predecessorSlots: ['implement'],
      responsibleRole: 'Feature engineer',
    },
  ],
};

/** The bugfix work-package template content (loose JSON data). */
const BUGFIX_TEMPLATE: WorkTemplateContent = {
  schema: 'epoch.pack-software.work-template',
  schemaVersion: 1,
  templateId: 'software.template.bugfix',
  templateVersion: '1.0.0',
  title: 'Bugfix package',
  description: 'Reproduce, fix and verify one reported defect through to regression-green.',
  realizationVariant: 'software-implementation-deployment',
  activitySlots: [
    {
      slotId: 'fix',
      title: 'Implement the fix',
      plannedQuantity: { value: '4', unit: 'hour' },
      predecessorSlots: ['reproduce'],
      responsibleRole: 'Feature engineer',
    },
    {
      slotId: 'reproduce',
      title: 'Reproduce the defect',
      plannedQuantity: { value: '2', unit: 'hour' },
      predecessorSlots: [],
      responsibleRole: 'Quality engineer',
    },
    {
      slotId: 'verify-fix',
      title: 'Verify the fix against the report',
      plannedQuantity: { value: '2', unit: 'hour' },
      predecessorSlots: ['fix'],
      responsibleRole: 'Quality engineer',
    },
  ],
};

/** The migration work-package template content (loose JSON data). */
const MIGRATION_TEMPLATE: WorkTemplateContent = {
  schema: 'epoch.pack-software.work-template',
  schemaVersion: 1,
  templateId: 'software.template.migration',
  templateVersion: '1.0.0',
  title: 'Data/system migration package',
  description:
    'Assess, execute and verify one data or system migration with a cutover checkpoint.',
  realizationVariant: 'software-implementation-deployment',
  activitySlots: [
    {
      slotId: 'assess',
      title: 'Assess source scope and dependencies',
      plannedQuantity: { value: '8', unit: 'hour' },
      predecessorSlots: [],
      responsibleRole: 'Migration engineer',
    },
    {
      slotId: 'cutover-verify',
      title: 'Verify cutover integrity',
      plannedQuantity: { value: '4', unit: 'hour' },
      predecessorSlots: ['execute'],
      responsibleRole: 'Quality engineer',
    },
    {
      slotId: 'execute',
      title: 'Execute the migration',
      plannedQuantity: { value: '16', unit: 'hour' },
      predecessorSlots: ['assess'],
      responsibleRole: 'Migration engineer',
    },
  ],
};

/** The infrastructure-change work-package template content (loose JSON data). */
const INFRASTRUCTURE_CHANGE_TEMPLATE: WorkTemplateContent = {
  schema: 'epoch.pack-software.work-template',
  schemaVersion: 1,
  templateId: 'software.template.infrastructure-change',
  templateVersion: '1.0.0',
  title: 'Infrastructure change package',
  description:
    'Plan, apply and verify one environment/platform infrastructure change.',
  realizationVariant: 'infrastructure-provisioning',
  activitySlots: [
    {
      slotId: 'apply',
      title: 'Apply the infrastructure change',
      plannedQuantity: { value: '6', unit: 'hour' },
      predecessorSlots: ['plan'],
      responsibleRole: 'Platform engineer',
    },
    {
      slotId: 'plan',
      title: 'Plan the change and rollback',
      plannedQuantity: { value: '4', unit: 'hour' },
      predecessorSlots: [],
      responsibleRole: 'Platform engineer',
    },
    {
      slotId: 'verify-environment',
      title: 'Verify environment readiness',
      plannedQuantity: { value: '1', unit: 'environment' },
      predecessorSlots: ['apply'],
      responsibleRole: 'Platform engineer',
    },
  ],
};

/**
 * The software work-template catalog, sealed and sorted by templateId
 * ascending. Deterministic: the same catalog content yields the same
 * digests on every call.
 */
export function softwareWorkTemplates(): readonly SealedWorkTemplate[] {
  const contents = [
    BUGFIX_TEMPLATE,
    FEATURE_DELIVERY_TEMPLATE,
    INFRASTRUCTURE_CHANGE_TEMPLATE,
    MIGRATION_TEMPLATE,
  ].sort((a, b) => (a.templateId < b.templateId ? -1 : 1));
  const sealed: SealedWorkTemplate[] = [];
  for (const content of contents) {
    const result = sealWorkTemplate(content);
    if (!result.ok) {
      throw new Error(
        `software work template "${content.templateId}" failed to seal (pack data invariant broken): ${JSON.stringify(result.error)}`,
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
    if (Object.keys(params.activityIds).length === 0) {
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
