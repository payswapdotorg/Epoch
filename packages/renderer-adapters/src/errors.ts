/**
 * The typed error taxonomy (values, never throws) — the W011/W013
 * errors-precedent applied to the renderer-adapters kernel.
 */
import { z } from 'zod';
import { Sha256HexSchema } from './primitives';

/** One typed diagnostic issue: a dotted path plus a message. */
export const RendererAdaptersIssueSchema = z
  .strictObject({
    path: z.string().min(1),
    message: z.string().min(1),
  })
  .meta({
    id: 'RendererAdaptersIssue',
    title: 'RendererAdaptersIssue',
    description: 'One typed diagnostic issue: dotted path plus message.',
  });

/** One typed issue. */
export type RendererAdaptersIssue = z.infer<typeof RendererAdaptersIssueSchema>;

/** The discriminated error union of the renderer-adapters kernel. */
export const RendererAdaptersErrorSchema = z.discriminatedUnion('code', [
  z
    .strictObject({
      code: z.literal('malformed-record'),
      message: z.string().min(1),
      issues: z.array(RendererAdaptersIssueSchema).min(1),
    })
    .meta({ id: 'MalformedRecordError', title: 'MalformedRecordError' }),
  z
    .strictObject({
      code: z.literal('version-unsupported'),
      message: z.string().min(1),
      expected: z.string().min(1),
      encountered: z.string().min(1),
    })
    .meta({ id: 'VersionUnsupportedError', title: 'VersionUnsupportedError' }),
  z
    .strictObject({
      code: z.literal('digest-mismatch'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])).readonly(),
      expected: Sha256HexSchema,
      encountered: Sha256HexSchema,
    })
    .meta({ id: 'DigestMismatchError', title: 'DigestMismatchError' }),
  z
    .strictObject({
      code: z.literal('cross-tenant-denied'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])).readonly(),
      expectedTenantId: z.string().min(1),
      encounteredTenantId: z.string().min(1),
    })
    .meta({ id: 'CrossTenantDeniedError', title: 'CrossTenantDeniedError' }),
  z
    .strictObject({
      code: z.literal('assessment-device-mismatch'),
      message: z.string().min(1),
    })
    .meta({ id: 'AssessmentDeviceMismatchError', title: 'AssessmentDeviceMismatchError' }),
  z
    .strictObject({
      code: z.literal('no-eligible-technique'),
      message: z.string().min(1),
      /** The effective graph kinds no technique hosts. */
      effectiveGraphKinds: z.array(z.string()).readonly(),
    })
    .meta({ id: 'NoEligibleTechniqueError', title: 'NoEligibleTechniqueError' }),
]);

/** One typed renderer-adapters error. */
export type RendererAdaptersError = z.infer<typeof RendererAdaptersErrorSchema>;

/** The total-result shape used by every kernel entry point. */
export type RendererAdaptersResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RendererAdaptersError };
