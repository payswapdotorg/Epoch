/**
 * Total parse surface for serialized runtime documents: invocation
 * envelopes (the envelope schema + per-function request contract) and
 * sandbox surface descriptions. Total, never throws.
 */
import { HostInvocationEnvelopeSchema } from './schema';
import { validationError } from './issues';
import type {
  ExtensionRuntimeResult,
  HostInvocationEnvelope,
  SandboxSurfaceDescription,
} from './types';
import { SandboxSurfaceDescriptionSchema } from './schema';

/** Parse and validate a serialized invocation envelope (total). */
export function parseInvocationEnvelope(
  input: unknown,
): ExtensionRuntimeResult<HostInvocationEnvelope> {
  const parsed = HostInvocationEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Parse and validate a serialized sandbox surface description (total). */
export function parseSandboxSurfaceDescription(
  input: unknown,
): ExtensionRuntimeResult<SandboxSurfaceDescription> {
  const parsed = SandboxSurfaceDescriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}
