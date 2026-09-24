/**
 * Digest discipline for capability manifests: a registration's identity is
 * the SHA-256 of its canonical JSON serialization (content addressing
 * over the runtime-neutral canonical machinery from
 * @epoch/agent-protocol). The registry REJECTS a registration whose
 * claimed digest does not match the recomputed one (tamper detection) —
 * see `register` in src/registry.ts and `parseCapabilityRecord` in
 * src/parse.ts.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { CapabilityManifestSchema } from './schema';
import { flattenZodIssues, validationError } from './issues';
import type { CapabilityManifest, CapabilityRegistration, RegistryResult } from './types';

/**
 * Content-addressed identity of a capability manifest: the SHA-256 of its
 * canonical JSON serialization. Equivalent manifests (any key order)
 * always produce the same digest. Throws on an invalid manifest —
 * producers validate first (use {@link sealCapabilityManifest} for the
 * total form).
 */
export function computeCapabilityManifestDigest(manifest: CapabilityManifest): Sha256Hex {
  const parsed = CapabilityManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    const first = flattenZodIssues(parsed.error)[0];
    throw new Error(
      `cannot digest an invalid capability manifest (${first?.path ?? '?'}: ${first?.message ?? 'invalid'})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Seal a valid manifest into a registration envelope (manifest + its
 * recomputed digest). Total: an invalid manifest yields a typed
 * `validation` error with flattened issue paths.
 */
export function sealCapabilityManifest(
  manifest: unknown,
): RegistryResult<CapabilityRegistration> {
  const parsed = CapabilityManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      manifest: parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/**
 * Verify a claimed digest against the recomputed content digest of a
 * manifest (tamper detection). Total.
 */
export function verifyManifestDigest(
  registration: CapabilityRegistration,
): RegistryResult<CapabilityManifest> {
  const parsed = CapabilityManifestSchema.safeParse(registration.manifest);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const expected = canonicalDigest(parsed.data as unknown as JsonValue);
  if (expected !== registration.digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'capability manifest digest does not match its content (tampered or mismatched envelope) — the registration is rejected',
        path: ['digest'],
        expected,
        encountered: registration.digest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
