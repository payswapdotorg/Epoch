/**
 * Digest discipline — canonical SHA-256 content addressing and tamper
 * detection for the sealed device-capabilities records (machinery reused
 * from @epoch/agent-protocol, the W013 precedent).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import type { DeviceCapabilityAssessment, DeviceCapabilityAssessmentContent } from './assessment';
import type { PresentationFit } from './fit';
import { digestMismatchError } from './issues';
import { DeviceCapabilityAssessmentSchema } from './assessment';
import { PresentationFitSchema } from './fit';
import type { DeviceCapabilitiesResult } from './errors';

/** Extract the content of a sealed assessment (everything but the digest). */
export function assessmentContentOf(
  assessment: DeviceCapabilityAssessment,
): DeviceCapabilityAssessmentContent {
  const { digest: _sealed, ...content } = assessment;
  void _sealed;
  return content;
}

/** Compute the canonical content digest of an assessment's content. */
export function computeAssessmentDigest(
  content: DeviceCapabilityAssessmentContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/**
 * Verify a sealed assessment's claimed digest against its recomputed
 * content digest (tamper detection). Total: schema-invalid envelopes
 * yield typed `malformed-record` errors; digest skew yields
 * `digest-mismatch` with expected and encountered values.
 */
export function verifyAssessmentDigest(
  envelope: unknown,
): DeviceCapabilitiesResult<DeviceCapabilityAssessmentContent> {
  const parsed = DeviceCapabilityAssessmentSchema.safeParse(envelope);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the device capability assessment failed schema admission',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const content = assessmentContentOf(parsed.data);
  const expected = computeAssessmentDigest(content);
  if (expected !== parsed.data.digest) {
    return {
      ok: false,
      error: digestMismatchError(['digest'], expected, parsed.data.digest),
    };
  }
  return { ok: true, value: content };
}

/**
 * Verify a presentation-fit verdict's claimed digest against its
 * recomputed content digest (tamper detection). Total.
 */
export function verifyPresentationFitDigest(
  verdict: unknown,
): DeviceCapabilitiesResult<PresentationFit> {
  const parsed = PresentationFitSchema.safeParse(verdict);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the presentation-fit verdict failed schema admission',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const { digest: _sealed, ...content } = parsed.data;
  void _sealed;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== parsed.data.digest) {
    return {
      ok: false,
      error: digestMismatchError(['digest'], expected, parsed.data.digest),
    };
  }
  return { ok: true, value: parsed.data };
}
