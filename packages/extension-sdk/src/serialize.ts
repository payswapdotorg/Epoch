/**
 * Digest discipline for extension documents: a manifest's (or Wasm
 * component descriptor's) identity is the SHA-256 of its canonical JSON
 * serialization (content addressing over the runtime-neutral canonical
 * machinery from @epoch/agent-protocol — reused, not mirrored). The host
 * REJECTS a registration whose claimed digest does not match the
 * recomputed one (tamper detection) — see `verifyExtensionManifestDigest`
 * and the runtime admission pipeline in @epoch/extension-runtime.
 *
 * Determinism: canonical JSON sorts object keys, so equivalent manifests
 * (any key order) produce the same digest; the schema's sorted-set
 * refinements make semantically-equal manifests byte-identical too.
 */
import {
  canonicalDigest,
  canonicalJsonStringify,
  sha256Hex,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import { ExtensionManifestSchema, WasmComponentDescriptorSchema } from './schema';
import { flattenZodIssues, validationError } from './issues';
import type {
  ExtensionManifest,
  ExtensionRegistration,
  ExtensionSdkResult,
  WasmComponentDescriptor,
} from './types';

function firstIssueMessage(error: Parameters<typeof flattenZodIssues>[0]): string {
  const first = flattenZodIssues(error)[0];
  return first ? `${first.path}: ${first.message}` : 'invalid';
}

/**
 * Deterministic serialization of an extension manifest: the canonical
 * JSON string (equivalent manifests with different key orders serialize
 * identically). Throws on an invalid manifest — producers validate
 * first ({@link parseExtensionManifest} in src/parse.ts is the total
 * form).
 */
export function serializeExtensionManifest(manifest: ExtensionManifest): string {
  const parsed = ExtensionManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    throw new Error(`cannot serialize an invalid extension manifest (${firstIssueMessage(parsed.error)})`);
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

/**
 * Content-addressed identity of an extension manifest: the SHA-256 of
 * its canonical JSON serialization (the digest of the serialized bytes,
 * NOT a re-canonicalization of them). Throws on an invalid manifest.
 */
export function computeExtensionManifestDigest(manifest: ExtensionManifest): Sha256Hex {
  return sha256Hex(serializeExtensionManifest(manifest));
}

/**
 * Seal a valid manifest into a registration envelope (manifest + its
 * recomputed digest). Total: an invalid manifest yields a typed
 * `validation` error with flattened issue paths.
 */
export function sealExtensionManifest(manifest: unknown): ExtensionSdkResult<ExtensionRegistration> {
  const parsed = ExtensionManifestSchema.safeParse(manifest);
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
export function verifyExtensionManifestDigest(
  registration: ExtensionRegistration,
): ExtensionSdkResult<ExtensionManifest> {
  const parsed = ExtensionManifestSchema.safeParse(registration.manifest);
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
          'extension manifest digest does not match its content (tampered or mismatched envelope) — the registration is rejected at the sandbox boundary',
        path: ['digest'],
        expected,
        encountered: registration.digest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// ---------------------------------------------------------------------------
// Wasm component descriptors.
// ---------------------------------------------------------------------------

/**
 * Deterministic serialization of a Wasm component descriptor (canonical
 * JSON). Throws on an invalid descriptor.
 */
export function serializeWasmComponentDescriptor(descriptor: WasmComponentDescriptor): string {
  const parsed = WasmComponentDescriptorSchema.safeParse(descriptor);
  if (!parsed.success) {
    throw new Error(
      `cannot serialize an invalid Wasm component descriptor (${firstIssueMessage(parsed.error)})`,
    );
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

/**
 * Content-addressed identity of a Wasm component descriptor: the
 * SHA-256 of its canonical JSON serialization. Throws on an invalid
 * descriptor. (Host-side digest machinery in runtimes/wasm re-derives
 * digests independently — the boundary never trusts author-side tools.)
 */
export function computeWasmComponentDescriptorDigest(descriptor: WasmComponentDescriptor): Sha256Hex {
  const parsed = WasmComponentDescriptorSchema.safeParse(descriptor);
  if (!parsed.success) {
    throw new Error(
      `cannot digest an invalid Wasm component descriptor (${firstIssueMessage(parsed.error)})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/** Verify a claimed digest against a descriptor's recomputed digest. Total. */
export function verifyWasmComponentDescriptorDigest(
  envelope: { readonly descriptor: WasmComponentDescriptor; readonly digest: Sha256Hex },
): ExtensionSdkResult<WasmComponentDescriptor> {
  const parsed = WasmComponentDescriptorSchema.safeParse(envelope.descriptor);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const expected = canonicalDigest(parsed.data as unknown as JsonValue);
  if (expected !== envelope.digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'Wasm component descriptor digest does not match its content (tampered or mismatched envelope)',
        path: ['digest'],
        expected,
        encountered: envelope.digest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
