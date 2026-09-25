/**
 * The typed error taxonomy of the world experience layer. Every admission,
 * lifecycle, projection, or compilation failure is one of these typed
 * records (never a bare throw) — the house Result discipline shared with
 * the W011/W012/W013 experience packages.
 */
import { z } from 'zod';
import type { JsonValue } from '@epoch/agent-protocol';

/** One typed issue: a dotted path plus a human-readable message. */
export const WorldIssueSchema = z
  .strictObject({
    path: z.string().min(1),
    message: z.string().min(1),
  })
  .meta({
    id: 'WorldIssue',
    title: 'WorldIssue',
    description: 'One typed world-experience issue: dotted path plus message.',
  });

/** One typed issue. */
export type WorldIssue = z.infer<typeof WorldIssueSchema>;

/**
 * The typed world-experience error union (discriminated on `code`). Each
 * variant carries precisely the fields its code needs; strict objects
 * reject unknown fields.
 */
const VersionUnsupportedErrorSchema = z
  .strictObject({
    code: z.literal('version-unsupported'),
    message: z.string().min(1),
    expected: z.string(),
    encountered: z.string(),
  })
  .meta({ id: 'WorldVersionUnsupportedError', title: 'WorldVersionUnsupportedError' });

const MalformedRecordErrorSchema = z
  .strictObject({
    code: z.literal('malformed-record'),
    message: z.string().min(1),
    issues: z.array(WorldIssueSchema),
  })
  .meta({ id: 'WorldMalformedRecordError', title: 'WorldMalformedRecordError' });

const DigestMismatchErrorSchema = z
  .strictObject({
    code: z.literal('digest-mismatch'),
    message: z.string().min(1),
    path: z.array(z.union([z.string(), z.number()])),
    expected: z.string(),
    encountered: z.string(),
  })
  .meta({ id: 'WorldDigestMismatchError', title: 'WorldDigestMismatchError' });

const UnknownSceneReferenceErrorSchema = z
  .strictObject({
    code: z.literal('unknown-scene-reference'),
    message: z.string().min(1),
    path: z.array(z.union([z.string(), z.number()])),
    encountered: z.string(),
  })
  .meta({ id: 'WorldUnknownSceneReferenceError', title: 'WorldUnknownSceneReferenceError' });

const CrossTenantDeniedErrorSchema = z
  .strictObject({
    code: z.literal('cross-tenant-denied'),
    message: z.string().min(1),
    path: z.array(z.union([z.string(), z.number()])),
    expectedTenantId: z.string(),
    encounteredTenantId: z.string(),
  })
  .meta({ id: 'WorldCrossTenantDeniedError', title: 'WorldCrossTenantDeniedError' });

const InvalidIntentErrorSchema = z
  .strictObject({
    code: z.literal('invalid-intent'),
    message: z.string().min(1),
    issues: z.array(WorldIssueSchema),
  })
  .meta({ id: 'WorldInvalidIntentError', title: 'WorldInvalidIntentError' });

const UnknownOverlayReferenceErrorSchema = z
  .strictObject({
    code: z.literal('unknown-overlay-reference'),
    message: z.string().min(1),
    path: z.array(z.union([z.string(), z.number()])),
    overlayId: z.string(),
  })
  .meta({ id: 'WorldUnknownOverlayReferenceError', title: 'WorldUnknownOverlayReferenceError' });

const UnknownOntologyRecordErrorSchema = z
  .strictObject({
    code: z.literal('unknown-ontology-record'),
    message: z.string().min(1),
    path: z.array(z.union([z.string(), z.number()])),
    recordId: z.string().optional(),
    discriminator: z.string().optional(),
  })
  .meta({ id: 'WorldUnknownOntologyRecordError', title: 'WorldUnknownOntologyRecordError' });

const BudgetExceededErrorSchema = z
  .strictObject({
    code: z.literal('budget-exceeded'),
    message: z.string().min(1),
    path: z.array(z.union([z.string(), z.number()])),
    resource: z.enum(['graph-edges', 'graph-nodes', 'texture-bytes', 'triangles']),
    limit: z.number(),
    encountered: z.number(),
  })
  .meta({ id: 'WorldBudgetExceededError', title: 'WorldBudgetExceededError' });

const ExecutableUiRejectedErrorSchema = z
  .strictObject({
    code: z.literal('executable-ui-rejected'),
    message: z.string().min(1),
    path: z.array(z.union([z.string(), z.number()])),
    offendingKey: z.string(),
  })
  .meta({ id: 'WorldExecutableUiRejectedError', title: 'WorldExecutableUiRejectedError' });

const InvalidReplayPositionErrorSchema = z
  .strictObject({
    code: z.literal('invalid-replay-position'),
    message: z.string().min(1),
    path: z.array(z.union([z.string(), z.number()])),
    boundMs: z.number().optional(),
    encounteredMs: z.number().optional(),
  })
  .meta({ id: 'WorldInvalidReplayPositionError', title: 'WorldInvalidReplayPositionError' });

const UnknownEvidenceReferenceErrorSchema = z
  .strictObject({
    code: z.literal('unknown-evidence-reference'),
    message: z.string().min(1),
    path: z.array(z.union([z.string(), z.number()])),
    evidenceDigest: z.string(),
  })
  .meta({ id: 'WorldUnknownEvidenceReferenceError', title: 'WorldUnknownEvidenceReferenceError' });

/** The typed world-experience error union. */
export const WorldExperienceErrorSchema = z
  .discriminatedUnion('code', [
    VersionUnsupportedErrorSchema,
    MalformedRecordErrorSchema,
    DigestMismatchErrorSchema,
    UnknownSceneReferenceErrorSchema,
    CrossTenantDeniedErrorSchema,
    InvalidIntentErrorSchema,
    UnknownOverlayReferenceErrorSchema,
    UnknownOntologyRecordErrorSchema,
    BudgetExceededErrorSchema,
    ExecutableUiRejectedErrorSchema,
    InvalidReplayPositionErrorSchema,
    UnknownEvidenceReferenceErrorSchema,
  ])
  .meta({
    id: 'WorldExperienceError',
    title: 'WorldExperienceError',
    description:
      'One typed world-experience error: a closed code taxonomy with precisely typed payloads (never a bare throw).',
  });

/** One typed world-experience error. */
export type WorldExperienceError = z.infer<typeof WorldExperienceErrorSchema>;

/** The total-result shape used by every world-experience entry point. */
export type WorldExperienceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: WorldExperienceError };

/** Serializable evidence payload an error may carry (open-world JSON). */
export type WorldErrorEvidence = JsonValue;