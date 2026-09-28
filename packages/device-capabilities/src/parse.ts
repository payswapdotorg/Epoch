/**
 * Total admission surface for serialized device-capabilities documents.
 *
 * `parseDeviceCapabilityAssessment` and `parsePresentationFit` never
 * throw: every failure is a typed {@link DeviceCapabilitiesError}.
 *
 * Admission precedence (fixed, so consumers branch deterministically):
 *
 * 1. root shape — a non-object root is a `malformed-record`;
 * 2. version gate — a string `protocolVersion` that differs from
 *    `1.0.0` fails fast with `version-unsupported`;
 * 3. schema gate — full zod validation (strict objects reject unknown
 *    vendor fields with precise dotted paths; canonical-consistency
 *    refinements reject hand-edited verdicts);
 * 4. digest gate — the claimed digest must match the recomputed
 *    canonical SHA-256 (`digest-mismatch`).
 */
import { DEVICE_CAPABILITIES_PROTOCOL_VERSION } from './version';
import { rootShapeError, versionUnsupportedError } from './issues';
import type { DeviceCapabilitiesError, DeviceCapabilitiesResult } from './errors';
import type { DeviceCapabilityAssessment } from './assessment';
import type { PresentationFit } from './fit';
import { DeviceCapabilityAssessmentSchema } from './assessment';
import { PresentationFitSchema } from './fit';
import { verifyAssessmentDigest, verifyPresentationFitDigest } from './serialize';

function versionGate(input: unknown): DeviceCapabilitiesError | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return rootShapeError();
  }
  const encountered = (input as Record<string, unknown>).protocolVersion;
  if (
    typeof encountered === 'string' &&
    encountered !== DEVICE_CAPABILITIES_PROTOCOL_VERSION
  ) {
    return versionUnsupportedError(DEVICE_CAPABILITIES_PROTOCOL_VERSION, encountered);
  }
  return null;
}

/**
 * Parse, validate, and admit a serialized device capability assessment.
 * Total; see the module docs for the fixed precedence of typed errors.
 */
export function parseDeviceCapabilityAssessment(
  input: unknown,
): DeviceCapabilitiesResult<DeviceCapabilityAssessment> {
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }
  const schemaParsed = DeviceCapabilityAssessmentSchema.safeParse(input);
  if (!schemaParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the device capability assessment failed schema admission',
        issues: schemaParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const digestVerified = verifyAssessmentDigest(schemaParsed.data);
  if (!digestVerified.ok) {
    return { ok: false, error: digestVerified.error };
  }
  return { ok: true, value: schemaParsed.data };
}

/**
 * Parse, validate, and admit a serialized presentation-fit verdict.
 * Total; same fixed precedence.
 */
export function parsePresentationFit(input: unknown): DeviceCapabilitiesResult<PresentationFit> {
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }
  const schemaParsed = PresentationFitSchema.safeParse(input);
  if (!schemaParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the presentation-fit verdict failed schema admission',
        issues: schemaParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const digestVerified = verifyPresentationFitDigest(schemaParsed.data);
  if (!digestVerified.ok) {
    return { ok: false, error: digestVerified.error };
  }
  return { ok: true, value: schemaParsed.data };
}
