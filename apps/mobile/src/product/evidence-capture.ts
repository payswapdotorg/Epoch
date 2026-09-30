/**
 * @epoch/mobile — the digest-addressed evidence capture pipeline (W049).
 *
 * W049 Tech Lead pin 4: "camera/evidence capture produces content-addressed
 * evidence records through the object-storage seam (digest computed before
 * upload; the record references the digest, not a local path)."
 *
 * THE INVARIANT (pinned by test/product/evidence-capture.test.ts):
 *
 *   1. the camera port returns raw bytes (never a file path, never a base64
 *      blob reference);
 *   2. the client computes the SHA-256 digest BEFORE any upload
 *      (`sha256Bytes` — the pure-TS FIPS 180-4 implementation);
 *   3. the upload goes through the gateway's `evidence.intake` with the
 *      bytes (the object-storage seam); the AUTHORITY recomputes the digest
 *      server-side and returns the stored `objectRef.digest`;
 *   4. the pipeline asserts client-digest === authority-digest (a mismatch
 *      is a typed `digest-mismatch` defect signal, surfaced to the journey
 *      record — never silently accepted);
 *   5. every record/link the field product keeps references the DIGEST —
 *      the bytes are dropped from memory, no local path exists anywhere.
 *
 * The evidence link shape produced here is exactly the W038
 * `FieldEvidenceLink` grammar the `delivery.observe` intake consumes
 * (digest + evidenceKind + capturedAt + capturedBy).
 */
import type { GatewayError } from '@epoch/client-runtime';
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import { sha256Hex } from './sha256';
import { GatewayClient } from './gateway-client';
import type { FieldCameraPort, FieldPhotoCapture } from './camera';
import type { FieldEvidenceRef } from '../evidence';

/** One captured evidence artifact: the digest-addressed record. */
export interface CapturedEvidence {
  /** The content digest (the address — computed BEFORE upload, verified against the authority's). */
  readonly digest: Sha256Hex;
  /** True when the authority's recomputed digest matched the client's pre-computation. */
  readonly digestVerified: boolean;
  /** The evidence-kind the W038 link grammar carries. */
  readonly evidenceKind: 'photo' | 'sensor-reading' | 'document';
  readonly capturedAt: string;
  readonly capturedBy: string;
  /** The W018 FieldEvidenceRef (digest-only — the capture-envelope grammar). */
  readonly ref: FieldEvidenceRef;
  /** The W038 FieldEvidenceLink (what delivery.observe consumes). */
  readonly link: {
    readonly digest: Sha256Hex;
    readonly evidenceKind: 'photo' | 'sensor-reading' | 'document';
    readonly capturedAt: string;
    readonly capturedBy: string;
    readonly note?: string | undefined;
  };
}

/** The typed outcome of one evidence capture. */
export type EvidenceCaptureResult =
  | { readonly ok: true; readonly evidence: CapturedEvidence }
  | { readonly ok: false; readonly error: GatewayError; readonly stage: 'capture' | 'upload' | 'digest-verification' };

/** The upload payload builder (gateway `evidence.intake`: bytesBase64 + metadata). */
function intakePayload(photo: FieldPhotoCapture, tenantId: string): JsonValue {
  return {
    bytesBase64: encodeBase64(photo.bytes),
    metadata: {
      kind: 'evidence-artifact',
      label: 'field-photo',
      ...(photo.note !== undefined ? { note: photo.note } : {}),
      tenantId,
    },
  } as unknown as JsonValue;
}

/** Encode bytes as base64 (standard alphabet, no padding-trimming). */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Capture + upload one evidence photo through the digest-addressed
 * pipeline. The bytes NEVER persist on the client: after the upload the
 * only client-side residue is the DIGEST (+ the capture provenance).
 */
export async function captureEvidence(
  camera: FieldCameraPort,
  client: GatewayClient,
  options: {
    readonly sessionId: string;
    readonly tenantId: string;
    readonly capturedAt: string;
    readonly capturedBy: string;
    readonly note?: string | undefined;
    readonly idempotencyKey?: string | undefined;
  },
): Promise<EvidenceCaptureResult> {
  // 1. The camera returns raw bytes (no paths).
  const photo = await camera.capturePhoto({
    capturedAt: options.capturedAt,
    capturedBy: options.capturedBy,
    ...(options.note !== undefined ? { note: options.note } : {}),
  });
  // 2. Digest BEFORE upload (the client-side pre-computation).
  const clientDigest = sha256Hex(photo.bytes);
  // 3. Upload through the gateway evidence.intake (the object-storage seam).
  const uploaded = await client.callForResult({
    operation: 'evidence.intake',
    sessionId: options.sessionId,
    payload: intakePayload(photo, options.tenantId),
    ...(options.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
  });
  if (!uploaded.ok) {
    return { ok: false, error: uploaded.error, stage: 'upload' };
  }
  // 4. The authority's recomputed digest — must match the client's.
  const objectRef = (uploaded.result as { objectRef?: { digest?: string } }).objectRef;
  const authorityDigest = objectRef?.digest;
  const digestVerified = authorityDigest === clientDigest;
  if (!digestVerified && authorityDigest !== undefined) {
    // A mismatch is a defect signal (never silently accepted): the evidence
    // is still digest-addressed by the AUTHORITY digest, and the journey
    // record surfaces the mismatch.
    return { ok: false, error: digestMismatchError(clientDigest, authorityDigest), stage: 'digest-verification' };
  }
  const digest = (authorityDigest ?? clientDigest) as Sha256Hex;
  // 5. The digest-addressed records (W018 ref + W038 link grammars).
  const evidence: CapturedEvidence = {
    digest,
    digestVerified: authorityDigest !== undefined,
    evidenceKind: 'photo',
    capturedAt: photo.capturedAt,
    capturedBy: photo.capturedBy,
    ref: {
      kind: 'photo',
      digest,
      capturedAt: photo.capturedAt,
    },
    link: {
      digest,
      evidenceKind: 'photo',
      capturedAt: photo.capturedAt,
      capturedBy: photo.capturedBy,
      ...(photo.note !== undefined ? { note: photo.note } : {}),
    },
  };
  return { ok: true, evidence };
}

/** The typed digest-mismatch error (the client/authority digest divergence). */
function digestMismatchError(clientDigest: string, authorityDigest: string): GatewayError {
  return {
    schemaVersion: 1,
    class: 'unrecoverable',
    code: 'response-malformed',
    message:
      `the object-storage authority recomputed digest "${authorityDigest}" does not match the ` +
      `client pre-computed digest "${clientDigest}" — the evidence bytes were altered in transit`,
    operation: 'evidence.intake',
    correlationId: 'corr:unattributed',
    retryable: false,
    details: { hint: 'evidence digest divergence between client and authority' },
  };
}
