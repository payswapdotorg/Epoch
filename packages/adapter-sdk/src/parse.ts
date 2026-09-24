/**
 * Total parse surface for serialized adapter invocation envelopes.
 *
 * `parseAdapterRequest` / `parseAdapterResponse` never throw: the
 * category discriminator selects the per-category payload validator, and
 * violations surface as typed `validation` issues with precise dotted
 * paths. Strict objects reject unknown (vendor/provider) fields.
 */
import { AdapterRequestSchema, AdapterResponseSchema } from './schema';
import { validationError } from './issues';
import type { AdapterRequest, AdapterResponse, AdapterSdkResult } from './types';

/** Parse and validate a serialized adapter request envelope (total, never throws). */
export function parseAdapterRequest(input: unknown): AdapterSdkResult<AdapterRequest> {
  const parsed = AdapterRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Parse and validate a serialized adapter response envelope (total, never throws). */
export function parseAdapterResponse(input: unknown): AdapterSdkResult<AdapterResponse> {
  const parsed = AdapterResponseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}
