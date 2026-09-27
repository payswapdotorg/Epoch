/**
 * The zod primitives of the access-projection kernel.
 *
 * Composition policy (the W037/W038 precedent): shared grammars are
 * REUSED from the sibling kernels — never mirrored where a runtime
 * import is legitimate. This package has REAL runtime dependencies on
 * @epoch/authorization (the decision point), @epoch/solution-delivery
 * (the canonical records), @epoch/agent-protocol (canonical digests)
 * and @epoch/tenancy (tenant scoping), so their grammars are imported
 * and re-exported; the access-projection-owned grammars (policy, role,
 * task-class, audit ids, streams) are defined here.
 */
import { z } from 'zod';
import { canonicalDigest, sha256Hex } from '@epoch/agent-protocol';
import {
  PrincipalIdSchema,
  TenantIdSchema,
  TimestampSchema,
  Sha256HexSchema,
} from '@epoch/solution-delivery';

// Re-exported shared grammars (runtime composition over the W009/W036
// kernels — the same symbols downstream consumers bind to).
export { PrincipalIdSchema, TenantIdSchema, TimestampSchema, Sha256HexSchema };
export { canonicalDigest, sha256Hex };
export type { PrincipalId, Sha256Hex, TenantId, Timestamp } from '@epoch/solution-delivery';

/**
 * The W036 activity-id grammar, MIRRORED locally (the W038 precedent:
 * `@epoch/solution-delivery` publishes the ActivityId TYPE but not the
 * schema on its barrel). Pinned by the runtime parity test, which
 * admits a REAL W036 activity-bearing program through this grammar.
 */
export const ACTIVITY_ID_MIRROR_PATTERN = /^activity:[a-z0-9][a-z0-9-]{0,62}$/;

/** The mirrored activity-id grammar under the access-projection name. */
export const ACCESS_ACTIVITY_ID_MIRROR_PATTERN = ACTIVITY_ID_MIRROR_PATTERN;

/** One activity id (the W036 grammar, mirrored). */
export const ActivityIdMirrorSchema = z
  .string()
  .regex(ACTIVITY_ID_MIRROR_PATTERN, 'must be an activity id of the form "activity:<slug>"')
  .meta({
    id: 'ActivityIdMirror',
    title: 'ActivityIdMirror',
    description:
      'One W036 activity id (mirrored grammar): activity:<slug>. Pinned by runtime parity against @epoch/solution-delivery.',
  });

/** One activity id. */
export type ActivityIdMirror = z.infer<typeof ActivityIdMirrorSchema>;

/** One projection policy id (`policy:<slug>`). */
export const PolicyIdSchema = z
  .string()
  .regex(/^policy:[a-z0-9][a-z0-9-]{0,62}$/)
  .meta({
    id: 'PolicyId',
    title: 'PolicyId',
    description: 'One projection policy id: policy:<slug> (opaque, provider-neutral).',
  });

/** One projection policy id. */
export type PolicyId = z.infer<typeof PolicyIdSchema>;

/** One principal role id (`role:<slug>`). */
export const RoleIdSchema = z
  .string()
  .regex(/^role:[a-z0-9][a-z0-9-]{0,62}$/)
  .meta({
    id: 'RoleId',
    title: 'RoleId',
    description: 'One principal role id: role:<slug> (opaque; roles are caller vocabulary).',
  });

/** One principal role id. */
export type RoleId = z.infer<typeof RoleIdSchema>;

/** One agent task class (`task-class:<slug>`). */
export const AgentTaskClassSchema = z
  .string()
  .regex(/^task-class:[a-z0-9][a-z0-9-]{0,62}$/)
  .meta({
    id: 'AgentTaskClass',
    title: 'AgentTaskClass',
    description:
      'One agent task class: task-class:<slug> (the class of work an agent task performs; task classes get their own, narrower policy rows).',
  });

/** One agent task class. */
export type AgentTaskClass = z.infer<typeof AgentTaskClassSchema>;

/** One audit record id (`audit:<16 hex>` — derived from the evaluation key). */
export const AuditRecordIdSchema = z
  .string()
  .regex(/^audit:[0-9a-f]{16}$/)
  .meta({
    id: 'AuditRecordId',
    title: 'AuditRecordId',
    description:
      'One projection audit record id: audit:<16 hex chars>, derived deterministically from the evaluation key (no randomness).',
  });

/** One audit record id. */
export type AuditRecordId = z.infer<typeof AuditRecordIdSchema>;

/** One access-projection event stream id (`stream:access-<slug>`). */
export const AccessStreamIdSchema = z
  .string()
  .regex(/^stream:[a-z0-9][a-z0-9-]{0,62}$/)
  .meta({
    id: 'AccessStreamId',
    title: 'AccessStreamId',
    description:
      'One access-projection event stream id (the W010 grammar): stream:access-<slug>, one object/policy/tenant-state = one stream.',
  });

/** One access-projection stream id. */
export type AccessStreamId = z.infer<typeof AccessStreamIdSchema>;

/** One access-projection principal id (the W009 grammar, mirrored). */
export const AccessPrincipalIdSchema = z
  .string()
  .regex(/^principal:[a-z0-9][a-z0-9-]{0,62}$/)
  .meta({
    id: 'AccessPrincipalId',
    title: 'AccessPrincipalId',
    description: 'One principal id inside access-projection records (the W009 identity grammar).',
  });

/** One access-projection principal id. */
export type AccessPrincipalId = z.infer<typeof AccessPrincipalIdSchema>;

/**
 * One field-path template of a projection policy. Grammar: dot-separated
 * object keys with `[]` marking an any-index array position — e.g.
 * `workPackages[].activities[].title` matches the concrete walk path
 * `workPackages[0].activities[2].title`. Templates are the POLICY DATA
 * that drives minimum-necessary selection; they never name vendors.
 */
export const FieldPathTemplateSchema = z
  .string()
  .regex(
    /^(?:[A-Za-z][A-Za-z0-9_]*|\[\])(?:\.(?:[A-Za-z][A-Za-z0-9_]*|\[\]))*$/,
    'field paths are dot-separated object keys with [] marking any-index array positions',
  )
  .min(1)
  .max(512)
  .meta({
    id: 'FieldPathTemplate',
    title: 'FieldPathTemplate',
    description:
      'One field-path template: dot-separated keys, [] = any array index (e.g. workPackages[].activities[].title).',
  });

/** One field-path template. */
export type FieldPathTemplate = z.infer<typeof FieldPathTemplateSchema>;

/** A positive integer (1-based revisions, binding indexes). */
export const PositiveIntegerSchema = z
  .number()
  .int('must be an integer')
  .min(1, 'must be at least 1')
  .max(Number.MAX_SAFE_INTEGER, 'must be a safe integer')
  .meta({
    id: 'PositiveInteger',
    title: 'PositiveInteger',
    description: 'A positive safe integer (policy revisions and binding indexes are 1-based).',
  });

/** One positive integer. */
export type PositiveInteger = z.infer<typeof PositiveIntegerSchema>;

/** A semver core version (the W036 solution-version grammar, reused). */
export { SemverCoreSchema } from '@epoch/solution-delivery';
export type { SemverCore } from '@epoch/solution-delivery';
