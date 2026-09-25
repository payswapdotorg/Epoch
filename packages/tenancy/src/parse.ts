/**
 * Total parse surface for serialized tenancy documents.
 *
 * `parseTenancyNode` and `parseTenancySnapshot` never throw: schema
 * violations surface as typed `validation` issues with precise dotted
 * paths (strict objects reject unknown — vendor/provider — fields). A
 * SEALED node additionally has its claimed digest verified against the
 * recomputed content digest, so a tampered record fails with
 * `digest-mismatch` instead of resolving.
 */
import { SealedTenancyNodeSchema, TenancyNodeSchema, TenancySnapshotSchema } from './schema';
import { verifyTenancyNodeDigest } from './digest';
import { validationError } from './issues';
import type {
  SealedTenancyNode,
  TenancyNode,
  TenancyResult,
  TenancySnapshot,
} from './types';

/** Parse and validate a serialized tenancy node (total, never throws). */
export function parseTenancyNode(input: unknown): TenancyResult<TenancyNode> {
  const parsed = TenancyNodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse and validate a sealed tenancy node (total, never throws),
 * verifying the claimed content digest (tamper detection).
 */
export function parseSealedTenancyNode(input: unknown): TenancyResult<SealedTenancyNode> {
  const sealed = SealedTenancyNodeSchema.safeParse(input);
  if (!sealed.success) {
    return { ok: false, error: validationError(sealed.error) };
  }
  const verified = verifyTenancyNodeDigest(sealed.data);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }
  return { ok: true, value: sealed.data };
}

/** Parse and validate a serialized tenancy snapshot (total, never throws). */
export function parseTenancySnapshot(input: unknown): TenancyResult<TenancySnapshot> {
  const parsed = TenancySnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}
