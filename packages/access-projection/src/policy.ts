/**
 * The ProjectionPolicy family — POLICY IS DATA (the W041 dispatch pin,
 * following the W004 policy-document and the W043 alerts-policy
 * precedent): a typed, versioned, sealed record that binds
 *
 *     (principal role OR agent-task class) x object class
 *       -> allowed actions (view/export/share — the export/share ruling)
 *       -> minimum-necessary field allowlist (path templates)
 *       -> scope filters (evidence / commercial / supplier sections)
 *       -> redaction rules (path -> redaction class, plus a default).
 *
 * Swapping a policy record changes the projection with ZERO code change
 * (the named `policy-as-data` fixture): policies are content-addressed
 * and versioned (monotonic 1-based revisions; a re-registration of the
 * same revision with different content is a `version-conflict`).
 *
 * There is NO hard-coded branching on roles, task classes, object
 * classes, sections or vendors anywhere in this kernel: the evaluator
 * reads the selected binding's DATA. A role/task/object vocabulary entry
 * the policy names is an opaque slug the kernel never interprets.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { templateCovers } from './walk';
import { TenantIdSchema } from '@epoch/solution-delivery';
import { AgentTaskClassSchema, PolicyIdSchema, PositiveIntegerSchema, RoleIdSchema } from './primitives';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import {
  ACCESS_PROJECTION_RECORD_VERSION,
  OBJECT_CLASSES,
  POLICY_STATUSES,
  PROJECTION_ACTIONS,
  PROJECTION_POLICY_SCHEMA_NAME,
  PROJECTION_PRINCIPAL_KINDS,
  REDACTION_CLASSES,
  SECTION_VISIBILITY_MODES,
  type ObjectClass,
  type RedactionClass,
} from './version';
import type { AccessProjectionIssue, AccessProjectionResult } from './errors';

// --------------------------------------------------------------------------------
// Scope filters (applied AFTER the field walk — the dispatch pin).
// --------------------------------------------------------------------------------

/**
 * The evidence scope: which evidence references stay visible. `all`
 * releases every evidence reference; `none` strikes them all;
 * `listed` releases only the referenced W006 digests (the
 * minimum-necessary evidence set a role/task needs).
 */
export const EvidenceScopeSchema = z
  .discriminatedUnion('mode', [
    z.strictObject({ mode: z.literal('all') }).readonly(),
    z.strictObject({ mode: z.literal('none') }).readonly(),
    z
      .strictObject({
        mode: z.literal('listed'),
        allowedDigests: z
          .array(z.string().regex(/^[0-9a-f]{64}$/))
          .min(1)
          .max(512),
      })
      .readonly(),
  ])
  .meta({
    id: 'EvidenceScope',
    title: 'EvidenceScope',
    description:
      'The evidence scope filter: all, none, or a sorted minimum-necessary allowlist of W006 evidence digests.',
  });

/** One evidence scope. */
export type EvidenceScope = z.infer<typeof EvidenceScopeSchema>;

/** The commercial/supplier section visibility (`hidden` strikes the section). */
export const SectionVisibilitySchema = z.enum(SECTION_VISIBILITY_MODES).meta({
  id: 'SectionVisibility',
  title: 'SectionVisibility',
  description: 'One governed section visibility: visible or hidden (hidden strikes the section after the field walk).',
});

/** One section visibility. */
export type SectionVisibility = z.infer<typeof SectionVisibilitySchema>;

/**
 * The scope filters of one policy binding: evidence (which evidence
 * references are visible), commercial (cost/rate fields) and supplier
 * (supplier identity/commitment visibility). Each is a typed scope
 * filter applied AFTER the field walk.
 */
export const ScopeFiltersSchema = z
  .strictObject({
    evidence: EvidenceScopeSchema,
    commercial: SectionVisibilitySchema,
    supplier: SectionVisibilitySchema,
  })
  .readonly()
  .superRefine((filters, ctx) => {
    if (filters.evidence.mode === 'listed') {
      const digests = filters.evidence.allowedDigests;
      for (let i = 1; i < digests.length; i += 1) {
        if (digests[i]! < digests[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: 'allowedDigests must be sorted ascending (deterministic serialization)',
            path: ['evidence', 'allowedDigests'],
          });
          break;
        }
        if (digests[i]! === digests[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: 'allowedDigests must be duplicate-free',
            path: ['evidence', 'allowedDigests'],
          });
          break;
        }
      }
    }
  })
  .meta({
    id: 'ScopeFilters',
    title: 'ScopeFilters',
    description:
      'The scope filters of one policy binding: evidence (all/none/listed W006 digests), commercial and supplier section visibility.',
  });

/** One scope-filter set. */
export type ScopeFilters = z.infer<typeof ScopeFiltersSchema>;

// --------------------------------------------------------------------------------
// Redaction rules.
// --------------------------------------------------------------------------------

/** One redaction rule: the redaction class a struck field path carries. */
export const RedactionRuleSchema = z
  .strictObject({
    fieldPath: z.string().min(1).max(512),
    redactionClass: z.enum(REDACTION_CLASSES),
  })
  .readonly()
  .meta({
    id: 'RedactionRule',
    title: 'RedactionRule',
    description:
      'One redaction rule: the redaction class carried by the RedactionMarker of a struck field-path template.',
  });

/** One redaction rule. */
export type RedactionRule = z.infer<typeof RedactionRuleSchema>;

// --------------------------------------------------------------------------------
// Policy bindings.
// --------------------------------------------------------------------------------

/** The binding-key selector of one policy row (role rows for humans/services/agents; task rows for agents). */
export const BindingSelectorSchema = z
  .discriminatedUnion('principalKind', [
    z
      .strictObject({
        principalKind: z.literal('human'),
        role: RoleIdSchema,
      })
      .readonly(),
    z
      .strictObject({
        principalKind: z.literal('service'),
        role: RoleIdSchema,
      })
      .readonly(),
    z
      .strictObject({
        principalKind: z.literal('agent'),
        role: RoleIdSchema.optional(),
        agentTaskClass: AgentTaskClassSchema.optional(),
      })
      .readonly()
      .superRefine((selector, ctx) => {
        if ((selector.role !== undefined) === (selector.agentTaskClass !== undefined)) {
          ctx.addIssue({
            code: 'custom',
            message:
              'an agent row carries EXACTLY ONE of (role, agentTaskClass) — the role baseline row or a task-class row',
            path: ['role'],
          });
        }
      }),
  ])
  .meta({
    id: 'BindingSelector',
    title: 'BindingSelector',
    description:
      'The selector of one policy row: a principal kind plus exactly one of (role, agent-task class). Agents may hold BOTH a role baseline row and task-class rows (the task rows must be narrower).',
  });

/** One binding selector. */
export type BindingSelector = z.infer<typeof BindingSelectorSchema>;

/** The canonical sort key of one binding selector. */
export function bindingSelectorKey(selector: BindingSelector): string {
  if (selector.principalKind !== 'agent') {
    return `${selector.principalKind}#${selector.role}`;
  }
  return `${selector.principalKind}#${selector.agentTaskClass ?? selector.role}`;
}

/**
 * One policy binding (a policy ROW): the selector (principal role OR
 * agent-task class) x object class -> allowed actions -> minimum-necessary
 * field allowlist -> scope filters -> redaction rules -> default
 * redaction class. `view` MUST be granted (a row that cannot view cannot
 * project); export/share are DISTINCT actions with their own rows.
 */
export const PolicyBindingSchema = z
  .strictObject({
    selector: BindingSelectorSchema,
    objectClass: z.enum(OBJECT_CLASSES),
    allowedActions: z.array(z.enum(PROJECTION_ACTIONS)).min(1).max(3),
    fieldAllowlist: z
      .array(z.string().min(1).max(512))
      .min(1, 'a binding must allow at least one field (minimum-necessary is never zero-necessary)')
      .max(1024),
    redactionRules: z.array(RedactionRuleSchema).max(256),
    defaultRedactionClass: z.enum(REDACTION_CLASSES),
    scopeFilters: ScopeFiltersSchema,
  })
  .readonly()
  .superRefine((binding, ctx) => {
    if (!binding.allowedActions.includes('view')) {
      ctx.addIssue({
        code: 'custom',
        message: 'every binding must grant view (a row that cannot view cannot project)',
        path: ['allowedActions'],
      });
    }
    for (let i = 1; i < binding.allowedActions.length; i += 1) {
      if (binding.allowedActions[i]! < binding.allowedActions[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'allowedActions must be sorted ascending (deterministic serialization)',
          path: ['allowedActions'],
        });
        break;
      }
      if (binding.allowedActions[i]! === binding.allowedActions[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'allowedActions must be duplicate-free',
          path: ['allowedActions'],
        });
        break;
      }
    }
    for (let i = 1; i < binding.fieldAllowlist.length; i += 1) {
      if (binding.fieldAllowlist[i]! < binding.fieldAllowlist[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'fieldAllowlist must be sorted ascending (deterministic serialization)',
          path: ['fieldAllowlist'],
        });
        break;
      }
      if (binding.fieldAllowlist[i]! === binding.fieldAllowlist[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'fieldAllowlist must be duplicate-free',
          path: ['fieldAllowlist'],
        });
        break;
      }
    }
    for (let i = 1; i < binding.redactionRules.length; i += 1) {
      if (binding.redactionRules[i]!.fieldPath < binding.redactionRules[i - 1]!.fieldPath) {
        ctx.addIssue({
          code: 'custom',
          message: 'redactionRules must be sorted by fieldPath ascending (deterministic serialization)',
          path: ['redactionRules'],
        });
        break;
      }
      if (binding.redactionRules[i]!.fieldPath === binding.redactionRules[i - 1]!.fieldPath) {
        ctx.addIssue({
          code: 'custom',
          message: 'redactionRules must be duplicate-free by fieldPath',
          path: ['redactionRules'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'PolicyBinding',
    title: 'PolicyBinding',
    description:
      'One projection policy row: (principal role OR agent-task class) x object class -> allowed actions (the export/share ruling) -> minimum-necessary field allowlist -> scope filters -> redaction rules.',
  });

/** One policy binding. */
export type PolicyBinding = z.infer<typeof PolicyBindingSchema>;

/** The canonical sort key of one binding (selector, then object class). */
export function policyBindingKey(binding: PolicyBinding): string {
  return `${bindingSelectorKey(binding.selector)}#${binding.objectClass}`;
}

// --------------------------------------------------------------------------------
// The policy record family (content / sealed / digest discipline).
// --------------------------------------------------------------------------------

/** The immutable content of one projection policy revision. */
export const ProjectionPolicyContentSchema = z
  .strictObject({
    schema: z.literal(PROJECTION_POLICY_SCHEMA_NAME),
    schemaVersion: z.literal(ACCESS_PROJECTION_RECORD_VERSION),
    policyId: PolicyIdSchema,
    revision: PositiveIntegerSchema,
    tenantId: TenantIdSchema,
    title: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    status: z.enum(POLICY_STATUSES),
    bindings: z.array(PolicyBindingSchema).min(1).max(256),
  })
  .readonly()
  .superRefine((policy, ctx) => {
    for (let i = 1; i < policy.bindings.length; i += 1) {
      const a = policyBindingKey(policy.bindings[i]!);
      const b = policyBindingKey(policy.bindings[i - 1]!);
      if (a < b) {
        ctx.addIssue({
          code: 'custom',
          message: 'bindings must be sorted by (selector, objectClass) ascending (deterministic serialization)',
          path: ['bindings'],
        });
        break;
      }
      if (a === b) {
        ctx.addIssue({
          code: 'custom',
          message: 'bindings must be duplicate-free by (selector, objectClass)',
          path: ['bindings'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'ProjectionPolicyContent',
    title: 'ProjectionPolicyContent',
    description:
      'The immutable content of one projection policy revision: policy id, monotonic revision, tenant scope, lifecycle status, and the sorted binding rows (policy is DATA).',
  });

/** One projection policy content. */
export type ProjectionPolicyContent = z.infer<typeof ProjectionPolicyContentSchema>;

/**
 * The SEALED projection policy revision: content plus its SHA-256 digest
 * over the canonical JSON of the content (the exact-revision content
 * address — the digest a projection cites as its policy revision).
 */
export const SealedProjectionPolicySchema = z
  .strictObject({
    schema: z.literal(PROJECTION_POLICY_SCHEMA_NAME),
    schemaVersion: z.literal(ACCESS_PROJECTION_RECORD_VERSION),
    policyId: PolicyIdSchema,
    revision: PositiveIntegerSchema,
    tenantId: TenantIdSchema,
    title: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    status: z.enum(POLICY_STATUSES),
    bindings: z.array(PolicyBindingSchema).min(1).max(256),
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .superRefine((policy, ctx) => {
    for (let i = 1; i < policy.bindings.length; i += 1) {
      const a = policyBindingKey(policy.bindings[i]!);
      const b = policyBindingKey(policy.bindings[i - 1]!);
      if (a < b || a === b) {
        ctx.addIssue({
          code: 'custom',
          message: 'bindings must be sorted and duplicate-free by (selector, objectClass)',
          path: ['bindings'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'SealedProjectionPolicy',
    title: 'SealedProjectionPolicy',
    description:
      'Published projection policy revision: immutable content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed projection policy. */
export type SealedProjectionPolicy = z.infer<typeof SealedProjectionPolicySchema>;

/** Compute the content digest of a projection policy. */
export function computeProjectionPolicyDigest(content: ProjectionPolicyContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid projection-policy content into its published revision. */
export function sealProjectionPolicy(content: unknown): AccessProjectionResult<SealedProjectionPolicy> {
  const parsed = ProjectionPolicyContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeProjectionPolicyDigest(parsed.data) },
  };
}

/** Verify a sealed projection policy: schema + recomputed digest. */
export function verifySealedProjectionPolicy(
  sealed: unknown,
): AccessProjectionResult<SealedProjectionPolicy> {
  const parsed = SealedProjectionPolicySchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const recomputed = canonicalDigest(content as unknown as JsonValue);
  if (recomputed !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `projection policy "${parsed.data.policyId}" carries a tampered content digest`,
        expected: recomputed,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// Binding selection (pure data lookup — no role/task/object semantics).
// --------------------------------------------------------------------------------

/** The subject a projection is computed for (opaque vocabulary). */
export const ProjectionSubjectSchema = z
  .strictObject({
    principalId: z.string().regex(/^principal:[a-z0-9][a-z0-9-]{0,62}$/),
    principalKind: z.enum(PROJECTION_PRINCIPAL_KINDS),
    role: RoleIdSchema.optional(),
    agentTaskClass: AgentTaskClassSchema.optional(),
  })
  .readonly()
  .superRefine((subject, ctx) => {
    if (subject.principalKind === 'agent') {
      if (subject.role !== undefined && subject.agentTaskClass === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'an agent subject names its task class (role is the optional baseline)',
          path: ['agentTaskClass'],
        });
      }
    } else if (subject.agentTaskClass !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'only agent subjects carry agentTaskClass (humans and services carry roles)',
        path: ['agentTaskClass'],
      });
    }
    if (subject.principalKind !== 'agent' && subject.role === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a human/service subject names its role (the policy binding selector)',
        path: ['role'],
      });
    }
  })
  .meta({
    id: 'ProjectionSubject',
    title: 'ProjectionSubject',
    description:
      'The subject of one projection: principal id + kind (human/agent/service — service-to-service follows the same path), plus the role and/or agent-task class the policy rows bind to.',
  });

/** One projection subject. */
export type ProjectionSubject = z.infer<typeof ProjectionSubjectSchema>;

/** The redaction class a binding assigns to one struck concrete path. */
export function redactionClassOf(
  binding: PolicyBinding,
  fieldPath: string,
): RedactionClass {
  // The nearest COVERING rule governs: rules are field-path templates,
  // and a rule on an enclosing template (`workPackages[].activities[]
  // .plannedCost`) governs the concrete paths beneath it
  // (`workPackages[0].activities[1].plannedCost.amount`).
  const candidates = binding.redactionRules
    .filter((rule) => templateCovers(rule.fieldPath, fieldPath))
    .sort((a, b) => b.fieldPath.length - a.fieldPath.length);
  if (candidates.length > 0) return candidates[0]!.redactionClass;
  return binding.defaultRedactionClass;
}

/** Whether one binding's selector matches a subject (pure data equality). */
function selectorMatches(binding: PolicyBinding, subject: ProjectionSubject): boolean {
  if (binding.selector.principalKind !== subject.principalKind) return false;
  if (binding.selector.principalKind === 'agent') {
    const selector = binding.selector;
    if (selector.agentTaskClass !== undefined) {
      return subject.agentTaskClass === selector.agentTaskClass;
    }
    return selector.role !== undefined && subject.role === selector.role;
  }
  return subject.role === binding.selector.role;
}

/**
 * Select the role binding of one subject for one object class: the row
 * whose selector matches the subject's (principalKind, role) and whose
 * object class equals the requested one. Task-class selection is
 * {@link selectTaskBinding}; both are pure data lookups.
 */
export function selectRoleBinding(
  policy: SealedProjectionPolicy,
  subject: ProjectionSubject,
  objectClass: ObjectClass,
): PolicyBinding | null {
  for (const binding of policy.bindings) {
    if (binding.objectClass !== objectClass) continue;
    if (
      binding.selector.principalKind === 'agent' &&
      binding.selector.agentTaskClass !== undefined
    ) {
      continue;
    }
    if (selectorMatches(binding, subject)) return binding;
  }
  return null;
}

/**
 * Select the agent-task binding of one task class for one object class
 * (the task-specific row a TaskProjectionContext activates).
 */
export function selectTaskBinding(
  policy: SealedProjectionPolicy,
  taskClass: string,
  objectClass: ObjectClass,
): PolicyBinding | null {
  for (const binding of policy.bindings) {
    if (binding.objectClass !== objectClass) continue;
    if (
      binding.selector.principalKind !== 'agent' ||
      binding.selector.agentTaskClass === undefined
    ) {
      continue;
    }
    if (binding.selector.agentTaskClass === taskClass) return binding;
  }
  return null;
}

/** The policy-revision reference a projection/audit cites (by digest). */
export const PolicyRevisionRefSchema = z
  .strictObject({
    policyId: PolicyIdSchema,
    revision: PositiveIntegerSchema,
    policyDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'PolicyRevisionRef',
    title: 'PolicyRevisionRef',
    description:
      'Reference to the exact projection-policy revision a projection was computed under (content-addressed).',
  });

/** One policy-revision reference. */
export type PolicyRevisionRef = z.infer<typeof PolicyRevisionRefSchema>;

/** The flattened-issue type re-exported for parity with sibling kernels. */
export type { AccessProjectionIssue };
