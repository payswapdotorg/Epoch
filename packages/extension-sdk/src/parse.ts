/**
 * Total parse surface for serialized extension documents.
 *
 * `parseExtensionManifest`, `parseExtensionRegistration`, and
 * `parseWasmComponentDescriptor` never throw: schema violations surface
 * as typed `validation` issues with precise dotted paths (strict
 * objects reject unknown — vendor/provider — fields). A parsed
 * REGISTRATION additionally has its claimed digest verified against the
 * recomputed content digest, so a tampered envelope fails with
 * `digest-mismatch` instead of resolving.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  ExtensionManifestSchema,
  ExtensionRegistrationSchema,
  WasmComponentDescriptorSchema,
} from './schema';
import { validationError } from './issues';
import type {
  ExtensionManifest,
  ExtensionRegistration,
  ExtensionSdkResult,
  WasmComponentDescriptor,
} from './types';

/** Parse and validate a serialized extension manifest (total, never throws). */
export function parseExtensionManifest(input: unknown): ExtensionSdkResult<ExtensionManifest> {
  const parsed = ExtensionManifestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse and validate a serialized registration envelope (total, never
 * throws), verifying the claimed manifest digest (tamper detection).
 */
export function parseExtensionRegistration(
  input: unknown,
): ExtensionSdkResult<ExtensionRegistration> {
  const parsed = ExtensionRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const registration = parsed.data;
  const expected = canonicalDigest(registration.manifest as unknown as JsonValue);
  if (expected !== registration.digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'registration digest does not match the recomputed digest of its manifest content (tampered envelope)',
        path: ['digest'],
        expected,
        encountered: registration.digest,
      },
    };
  }
  return { ok: true, value: registration };
}

/** Parse and validate a serialized Wasm component descriptor (total, never throws). */
export function parseWasmComponentDescriptor(
  input: unknown,
): ExtensionSdkResult<WasmComponentDescriptor> {
  const parsed = WasmComponentDescriptorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}
