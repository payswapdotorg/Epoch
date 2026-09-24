/**
 * Total parse surface for serialized registry documents.
 *
 * `parseCapabilityManifest` and `parseCapabilityRecord` never throw:
 * schema violations surface as typed `validation` issues with precise
 * dotted paths (strict objects reject unknown — vendor/provider —
 * fields), and a serialized RECORD additionally has its embedded
 * `manifestDigest` verified against the recomputed content digest, so a
 * tampered record fails with `digest-mismatch` instead of resolving.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { CapabilityManifestSchema, CapabilityRecordSchema } from './schema';
import { validationError } from './issues';
import type {
  CapabilityManifest,
  CapabilityRecord,
  RegistryResult,
} from './types';

/** Parse and validate a serialized capability manifest (total, never throws). */
export function parseCapabilityManifest(input: unknown): RegistryResult<CapabilityManifest> {
  const parsed = CapabilityManifestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse and validate a serialized capability record (total, never
 * throws), verifying the embedded manifest digest (tamper detection).
 */
export function parseCapabilityRecord(input: unknown): RegistryResult<CapabilityRecord> {
  const parsed = CapabilityRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const record = parsed.data;
  const expected = canonicalDigest(record.manifest as unknown as JsonValue);
  if (expected !== record.manifestDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'record manifestDigest does not match the recomputed digest of its manifest content (tampered record)',
        path: ['manifestDigest'],
        expected,
        encountered: record.manifestDigest,
      },
    };
  }
  return { ok: true, value: record };
}
