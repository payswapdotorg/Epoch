/**
 * Adapter descriptor discipline: deterministic serialization and
 * content addressing. A descriptor's canonical JSON (stable key order, no
 * insignificant whitespace — the agent-protocol canonical machinery) is
 * THE deterministic serialization; the SHA-256 of that form is the
 * descriptor's content address, carried inside every negotiated binding
 * pin so invocations are attributable to the exact descriptor revision.
 */
import {
  canonicalJsonStringify,
  sha256Hex,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import { AdapterDescriptorSchema } from './schema';
import { flattenZodIssues, validationError } from './issues';
import type { AdapterDescriptor, AdapterSdkResult } from './types';

/**
 * Deterministic serialization of an adapter descriptor: the canonical
 * JSON string (equivalent descriptors with different key orders
 * serialize identically). Throws on an invalid descriptor — producers
 * validate first ({@link parseAdapterDescriptor} is the total form).
 */
export function serializeAdapterDescriptor(descriptor: AdapterDescriptor): string {
  const parsed = AdapterDescriptorSchema.safeParse(descriptor);
  if (!parsed.success) {
    const first = flattenZodIssues(parsed.error)[0];
    throw new Error(
      `cannot serialize an invalid adapter descriptor (${first?.path ?? '?'}: ${first?.message ?? 'invalid'})`,
    );
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

/**
 * Content-addressed identity of an adapter descriptor: the SHA-256 of its
 * canonical JSON serialization. Throws on an invalid descriptor.
 */
export function computeAdapterDescriptorDigest(descriptor: AdapterDescriptor): Sha256Hex {
  return sha256Hex(serializeAdapterDescriptor(descriptor));
}

/**
 * Parse (and fully validate) a serialized adapter descriptor. Total,
 * never throws: typed `validation` issues with precise dotted paths;
 * strict objects reject unknown (vendor/provider) fields.
 */
export function parseAdapterDescriptor(input: unknown): AdapterSdkResult<AdapterDescriptor> {
  const parsed = AdapterDescriptorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Throwing variant of {@link parseAdapterDescriptor}. */
export function validateAdapterDescriptor(input: unknown): AdapterDescriptor {
  const parsed = parseAdapterDescriptor(input);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return parsed.value;
}
