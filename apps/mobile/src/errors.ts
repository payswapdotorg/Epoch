/**
 * @epoch/mobile — the typed error taxonomy (values, never thrown).
 *
 * The W036 DeliveryResult discipline applied to the field shell: every
 * admission seam returns a {@link MobileFieldResult}; typed error values
 * carry precise paths and, where relevant, expected/encountered pairs
 * (tenant ids, digests). No runtime exception ever escapes this package.
 */
import { z } from 'zod';
import type { ZodError } from 'zod';
import { MobileFieldErrorCode, MOBILE_FIELD_ERROR_CODES } from './version';
import { TenantIdSchema } from '@epoch/tenancy';
import { Sha256HexSchema } from './primitives';

/** One typed, human-readable issue (path + message). */
export interface MobileFieldIssue {
  readonly path: string;
  readonly message: string;
}

/** The typed error value: a code, a message, and optional issue list + facts. */
export interface MobileFieldError {
  readonly code: MobileFieldErrorCode;
  readonly message: string;
  readonly issues?: readonly MobileFieldIssue[];
  readonly expectedTenantId?: string;
  readonly encounteredTenantId?: string;
  readonly expectedDigest?: string;
  readonly encounteredDigest?: string;
  readonly priorDigest?: string;
  readonly recordId?: string;
}

/** Result of a mobile field-client operation: a value or a typed error. */
export type MobileFieldResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MobileFieldError };

/** The zod validator mirror of the error taxonomy (round-trip evidence). */
export const MobileFieldIssueSchema = z
  .strictObject({
    path: z.string(),
    message: z.string().min(1),
  })
  .readonly()
  .meta({
    id: 'MobileFieldIssue',
    title: 'MobileFieldIssue',
    description: 'One typed issue: path plus human-readable message.',
  });

export const MobileFieldErrorSchema = z
  .strictObject({
    code: z.enum(MOBILE_FIELD_ERROR_CODES),
    message: z.string().min(1),
    issues: z.array(MobileFieldIssueSchema).optional(),
    expectedTenantId: TenantIdSchema.optional(),
    encounteredTenantId: TenantIdSchema.optional(),
    expectedDigest: Sha256HexSchema.optional(),
    encounteredDigest: Sha256HexSchema.optional(),
    priorDigest: Sha256HexSchema.optional(),
    recordId: z.string().min(1).optional(),
  })
  .readonly()
  .meta({
    id: 'MobileFieldError',
    title: 'MobileFieldError',
    description: 'The typed mobile field-client error value (never thrown).',
  });

/** Build an ok result. */
export function fieldOk<T>(value: T): MobileFieldResult<T> {
  return { ok: true, value };
}

/** Build a typed error result. */
export function fieldError(error: MobileFieldError): MobileFieldResult<never> {
  return { ok: false, error };
}

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): MobileFieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the typed `validation` error for a zod failure. */
export function fieldValidationError(error: ZodError): MobileFieldError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `mobile field record failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/**
 * Whether a zod failure includes a strict-object `unrecognized_keys`
 * rejection — the structural signal that unknown (vendor/provider) fields
 * attempted to enter a mobile field record.
 */
export function hasUnrecognizedKeys(error: ZodError): boolean {
  return error.issues.some((issue) => issue.code === 'unrecognized_keys');
}

/** Build the typed `vendor-fields-rejected` error for a zod failure. */
export function vendorFieldsError(error: ZodError): MobileFieldError {
  const issues = flattenZodIssues(error);
  return {
    code: 'vendor-fields-rejected',
    message:
      'mobile field record carries unrecognized fields — strict objects reject unknown (vendor) fields (lock rule 13)',
    issues,
  };
}

/** A version-skew rejection (serialized record versions are exact pins). */
export function versionMismatchError(expected: number, encountered: unknown): MobileFieldError {
  return {
    code: 'version-mismatch',
    message: `mobile field record schemaVersion must equal ${expected} exactly`,
    issues: [{ path: 'schemaVersion', message: `encountered ${String(encountered)}` }],
  };
}

/** The R12 tenant-isolation rejection. */
export function crossTenantDeniedError(expectedTenantId: string, encounteredTenantId: string): MobileFieldError {
  return {
    code: 'cross-tenant-denied',
    message: `field record belongs to tenant "${encounteredTenantId}" but this surface is scoped to "${expectedTenantId}" (R12 multi-tenant isolation)`,
    expectedTenantId,
    encounteredTenantId,
  };
}

/** Tamper detection. */
export function digestMismatchError(expectedDigest: string, encounteredDigest: string): MobileFieldError {
  return {
    code: 'digest-mismatch',
    message:
      'sealed field record digest does not match its content (tampered or mismatched envelope)',
    expectedDigest,
    encounteredDigest,
  };
}

/** Back-compat alias (the W036 helper name). */
export const zodIssuesToFieldIssues = flattenZodIssues;
