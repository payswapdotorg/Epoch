/**
 * Content addressing for the Wasm component layout: the descriptor's
 * canonical JSON is its deterministic serialization; the SHA-256 of
 * that form is its content address. Per-section content digests are
 * verified over the section BYTES (synthetic in tests — no actual Wasm
 * binaries ship with W008). Tampering anywhere is rejected with typed
 * `digest-mismatch` errors.
 */
import { canonicalJsonStringify, type JsonValue } from './canonical';
import { canonicalDigest, sha256BytesHex, sha256Hex, type Sha256Hex } from './digest';
import { digestMismatch, fail, ok, type WasmLayoutResult } from './errors';
import { validateComponentLayoutDescriptor } from './validate';
import type { ComponentLayoutDescriptor, SectionContentBundle, SealedLayoutDescriptor } from './types';

/**
 * Deterministic serialization of a validated layout descriptor: the
 * canonical JSON string. Key-order permutations of equivalent
 * descriptors serialize identically. Total: an invalid descriptor
 * yields a typed `validation` error.
 */
export function serializeLayoutDescriptor(
  input: unknown,
): WasmLayoutResult<string> {
  const validated = validateComponentLayoutDescriptor(input);
  if (!validated.ok) return validated;
  return ok(canonicalJsonStringify(validated.value as unknown as JsonValue));
}

/**
 * Content-addressed identity of a layout descriptor: the SHA-256 of its
 * canonical JSON serialization. Total.
 */
export function computeLayoutDigest(input: unknown): WasmLayoutResult<Sha256Hex> {
  const serialized = serializeLayoutDescriptor(input);
  if (!serialized.ok) return serialized;
  return ok(sha256Hex(serialized.value));
}

/**
 * Seal a valid descriptor into an envelope (descriptor + recomputed
 * digest). Total.
 */
export function sealLayoutDescriptor(input: unknown): WasmLayoutResult<SealedLayoutDescriptor> {
  const validated = validateComponentLayoutDescriptor(input);
  if (!validated.ok) return validated;
  const digest = canonicalDigest(validated.value as unknown as JsonValue);
  return ok({ descriptor: validated.value, digest });
}

/**
 * Verify a claimed digest against the recomputed content digest of the
 * descriptor (tamper detection). Total.
 */
export function verifyLayoutDescriptorDigest(
  envelope: { readonly descriptor: unknown; readonly digest: Sha256Hex },
): WasmLayoutResult<ComponentLayoutDescriptor> {
  const expected = computeLayoutDigest(envelope.descriptor);
  if (!expected.ok) return expected;
  if (expected.value !== envelope.digest) {
    return fail(
      digestMismatch({
        message:
          'Wasm component layout digest does not match its content (tampered or mismatched envelope) — the layout is rejected at the host boundary',
        path: ['digest'],
        expected: expected.value,
        encountered: envelope.digest,
      }),
    );
  }
  return ok(envelope.descriptor as ComponentLayoutDescriptor);
}

/**
 * Verify the per-section content digests of a descriptor against
 * provided section BYTES: exactly the declared sections must be present
 * (missing and unknown sections are typed errors), each section's byte
 * length must equal the declared byteSize, and the SHA-256 of the bytes
 * must equal the declared contentDigest. Total; never reads anything
 * outside the provided bundle (zero network, zero filesystem).
 */
export function verifySectionContent(
  input: unknown,
  contents: SectionContentBundle,
): WasmLayoutResult<ComponentLayoutDescriptor> {
  const validated = validateComponentLayoutDescriptor(input);
  if (!validated.ok) return validated;
  const descriptor = validated.value;
  const declared = new Map<string, { byteSize: number; contentDigest: string }>();
  for (const section of descriptor.sections) {
    declared.set(section.name, { byteSize: section.byteSize, contentDigest: section.contentDigest });
  }
  const issues: { path: string; message: string }[] = [];
  for (const name of Object.keys(contents).sort()) {
    if (!declared.has(name)) {
      issues.push({
        path: `sections.${name}`,
        message: `unknown section "${name}" — the content bundle must contain exactly the declared sections`,
      });
    }
  }
  for (const [name, section] of [...declared.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const bytes = contents[name];
    if (bytes === undefined) {
      issues.push({
        path: `sections.${name}`,
        message: `missing content for declared section "${name}"`,
      });
      continue;
    }
    if (bytes.length !== section.byteSize) {
      issues.push({
        path: `sections.${name}.byteSize`,
        message: `section "${name}" byte length ${bytes.length} does not equal the declared byteSize ${section.byteSize}`,
      });
      continue;
    }
    const digest = sha256BytesHex(bytes);
    if (digest !== section.contentDigest) {
      return fail(
        digestMismatch({
          message: `section "${name}" content digest does not match its bytes (tampered or mismatched section)`,
          path: ['sections', name, 'contentDigest'],
          expected: digest,
          encountered: section.contentDigest,
        }),
      );
    }
  }
  if (issues.length > 0) {
    return fail({ code: 'validation', message: `section content bundle failed validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`, issues });
  }
  return ok(descriptor);
}
