/**
 * @epoch/mobile — field evidence references (the W006 convention).
 *
 * A field device captures photos, sensor readings and notes. The mobile
 * client NEVER carries those payloads: every capture is referenced BY
 * DIGEST (the W006 exact-revision content-addressing convention — the same
 * `EvidenceReference { digest }` grammar the W036 Observation payload
 * consumes). The bytes live behind the evidence domain (W006/W038 seams);
 * this module types the FIELD-side reference: which neutral capture kind
 * produced the evidence, when it was captured, and its canonical digest.
 *
 * Envelopes that attempt to embed payload material are rejected with the
 * typed `evidence-payload-rejected` error (a named negative test).
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { Sha256HexSchema } from '@epoch/solution-delivery';
import { fieldError, fieldOk, flattenZodIssues, type MobileFieldResult } from './errors';
import { FieldEvidenceKindSchema, FIELD_EVIDENCE_KINDS, MOBILE_FIELD_RECORD_VERSION } from './version';

/** Upper bound on evidence references per capture (DoS discipline). */
export const MAX_FIELD_EVIDENCE_REFS = 16;

/**
 * One field evidence reference: a neutral capture kind plus the canonical
 * content digest of the captured artifact — never the artifact itself.
 */
export const FieldEvidenceRefSchema = z
  .strictObject({
    kind: FieldEvidenceKindSchema,
    digest: Sha256HexSchema,
    capturedAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'FieldEvidenceRef',
    title: 'FieldEvidenceRef',
    description:
      'One field evidence reference: neutral capture kind (photo/sensor-reading/note) plus the W006-convention content digest — payloads are never embedded.',
  });

/** One field evidence reference. */
export type FieldEvidenceRef = z.infer<typeof FieldEvidenceRefSchema>;

/** Sorted/duplicate-free refinement shared by digest-keyed arrays. */
function refineSortedEvidence(
  refs: readonly FieldEvidenceRef[],
  ctx: z.RefinementCtx,
): void {
  for (let i = 1; i < refs.length; i += 1) {
    if (refs[i]!.digest < refs[i - 1]!.digest) {
      ctx.addIssue({
        code: 'custom',
        message: 'evidence references must be sorted by digest ascending (deterministic serialization)',
        path: ['evidence'],
      });
      break;
    }
    if (refs[i]!.digest === refs[i - 1]!.digest) {
      ctx.addIssue({
        code: 'custom',
        message: 'evidence references must be duplicate-free by digest',
        path: ['evidence'],
      });
      break;
    }
  }
}

/** The evidence reference array (sorted, duplicate-free, bounded). */
export const FieldEvidenceRefArraySchema = z
  .array(FieldEvidenceRefSchema)
  .max(MAX_FIELD_EVIDENCE_REFS)
  .superRefine(refineSortedEvidence);

/** The payload-material sentinel keys rejected on evidence references. */
const PAYLOAD_KEYS = ['data', 'bytes', 'base64', 'content', 'payload', 'locator', 'url', 'uri'];

/**
 * Admit a field evidence reference (total, typed). Payload material — any
 * attempt to embed the captured bytes — is a typed
 * `evidence-payload-rejected` rejection: evidence travels by digest only.
 */
export function admitFieldEvidenceRef(input: unknown): MobileFieldResult<FieldEvidenceRef> {
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    const keys = Object.keys(input as Record<string, unknown>);
    const smuggled = keys.find((key) => PAYLOAD_KEYS.includes(key));
    if (smuggled !== undefined) {
      return fieldError({
        code: 'evidence-payload-rejected',
        message:
          `field evidence reference carries payload material ("${smuggled}") — evidence is referenced by digest only, never embedded (the W006 convention)`,
      });
    }
  }
  const parsed = FieldEvidenceRefSchema.safeParse(input);
  if (!parsed.success) {
    return fieldError({
      code: 'validation',
      message: 'not a valid field evidence reference',
      issues: flattenZodIssues(parsed.error),
    });
  }
  return fieldOk(parsed.data);
}

/**
 * Compute the canonical digest of an evidence payload value: the SHA-256 of
 * the canonical JSON of the payload. Field callers digest their captured
 * material BEFORE referencing it (photos/sensors/notes produce arbitrary
 * bytes; the canonical JSON form covers structured note payloads, and
 * binary digests come from the capture host's hashing seam — the DIGEST is
 * the contract, the hashing of native bytes is the host's).
 */
export function computeFieldEvidenceDigest(payload: JsonValue): Sha256Hex {
  return canonicalDigest(payload);
}

/** The neutral capture kinds, re-exported for one-stop imports. */
export { FIELD_EVIDENCE_KINDS };
export type { FieldEvidenceKind } from './version';

/** The record-version discriminator mirrored onto the evidence surface. */
export const FIELD_EVIDENCE_RECORD_VERSION = MOBILE_FIELD_RECORD_VERSION;
