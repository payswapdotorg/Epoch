/**
 * The typed error taxonomy (values, never throws) — the W011/W013
 * errors-precedent applied to the device-capabilities kernel.
 */
import { z } from 'zod';
import { Sha256HexSchema } from './primitives';

/** One typed diagnostic issue: a dotted path plus a message. */
export const DeviceCapabilitiesIssueSchema = z
  .strictObject({
    path: z.string().min(1),
    message: z.string().min(1),
  })
  .meta({
    id: 'DeviceCapabilitiesIssue',
    title: 'DeviceCapabilitiesIssue',
    description: 'One typed diagnostic issue: dotted path plus message.',
  });

/** One typed issue. */
export type DeviceCapabilitiesIssue = z.infer<typeof DeviceCapabilitiesIssueSchema>;

/** The discriminated error union of the device-capabilities kernel. */
export const DeviceCapabilitiesErrorSchema = z.discriminatedUnion('code', [
  z
    .strictObject({
      code: z.literal('malformed-record'),
      message: z.string().min(1),
      issues: z.array(DeviceCapabilitiesIssueSchema).min(1),
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
      code: z.literal('unknown-device-class'),
      message: z.string().min(1),
      encountered: z.string().min(1),
    })
    .meta({ id: 'UnknownDeviceClassError', title: 'UnknownDeviceClassError' }),
]);

/** One typed device-capabilities error. */
export type DeviceCapabilitiesError = z.infer<typeof DeviceCapabilitiesErrorSchema>;

/** The total-result shape used by every kernel entry point. */
export type DeviceCapabilitiesResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DeviceCapabilitiesError };
