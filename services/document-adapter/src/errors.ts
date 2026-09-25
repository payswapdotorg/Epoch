/**
 * The typed host error taxonomy. The kernel taxonomy passes through
 * unchanged (the host never rewrites a kernel rejection); the three
 * service-specific failures are constructed here with precise fields.
 * Every entry point is total — errors are values, never thrown.
 */
import { z } from 'zod';
import { isDocumentAdapterError } from '@epoch/document-adapter';
import { HOST_ERROR_CODES, type HostErrorCode } from './version';
import type {
  DocumentAdapterHostError,
  IdempotencyKey,
  SessionId,
} from './types';
import type { Sha256Hex } from '@epoch/agent-protocol';

/** Runtime check for a serialized host error value. */
export function isHostError(value: unknown): value is DocumentAdapterHostError {
  if (isDocumentAdapterError(value)) return true;
  return HostSpecificErrorSchema.safeParse(value).success;
}

/** The three service-specific error variants (discriminated on `code`). */
export const HostSpecificErrorSchema = z
  .discriminatedUnion('code', [
    z
      .strictObject({
        code: z.literal('unknown-session'),
        message: z.string().min(1),
        sessionId: z.string().regex(/^sess:[0-9a-f]{64}$/),
      })
      .readonly(),
    z
      .strictObject({
        code: z.literal('idempotency-conflict'),
        message: z.string().min(1),
        idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
        expectedDocumentDigest: z.string().regex(/^[0-9a-f]{64}$/),
        encounteredDocumentDigest: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .readonly(),
    z
      .strictObject({
        code: z.literal('registration-conflict'),
        message: z.string().min(1),
        capabilityId: z.string().min(1),
        version: z.string().regex(/^\d+\.\d+\.\d+$/),
      })
      .readonly(),
  ])
  .meta({
    id: 'urn:epoch:document-adapter-host:host-specific-error',
    title: 'HostSpecificError',
    description: 'The service-specific error variants of the document-adapter host.',
  });

/** The service-specific error-code vocabulary. */
export const HOST_ERROR_CODES_EXPORTED = HOST_ERROR_CODES;
export type HostErrorCodeExported = HostErrorCode;

/** Constructor: `unknown-session`. */
export function unknownSession(sessionId: SessionId): DocumentAdapterHostError {
  return {
    code: 'unknown-session',
    message: `no ingestion session exists with id "${sessionId}"`,
    sessionId,
  };
}

/** Constructor: `idempotency-conflict` (duplicate suppression). */
export function idempotencyConflict(
  idempotencyKey: IdempotencyKey,
  expectedDocumentDigest: Sha256Hex,
  encounteredDocumentDigest: Sha256Hex,
): DocumentAdapterHostError {
  return {
    code: 'idempotency-conflict',
    message:
      `idempotency key "${idempotencyKey}" is already bound to document digest ` +
      `${expectedDocumentDigest}; the new ingestion carries digest ${encounteredDocumentDigest} ` +
      '— one key names one document (duplicate suppression)',
    idempotencyKey,
    expectedDocumentDigest,
    encounteredDocumentDigest,
  };
}

/** Constructor: `registration-conflict`. */
export function registrationConflict(
  capabilityId: string,
  version: string,
  message: string,
): DocumentAdapterHostError {
  return {
    code: 'registration-conflict',
    message,
    capabilityId,
    version,
  };
}
