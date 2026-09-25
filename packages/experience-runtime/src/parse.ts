/**
 * Total admission surface for serialized experience-runtime documents.
 *
 * `parseDeviceSessionRecord`, `parseRuntimeEventTrace`, and
 * `validateFrameSchedule` never throw: every failure is a typed
 * {@link ExperienceRuntimeError}.
 *
 * Admission precedence (fixed, so consumers branch deterministically):
 *
 * 1. root shape — a non-object root is a `malformed-record`;
 * 2. version gate — a string `protocolVersion` that differs from `1.0.0`
 *    fails fast with `version-unsupported` (version skew is always
 *    distinguishable from malformed payloads);
 * 3. schema gate — full zod validation; strict objects reject unknown
 *    (vendor/engine) fields; consistency refinements reject drifting
 *    derived indices and lifecycle-illegal traces; failures surface as
 *    `malformed-record` with precise dotted paths;
 * 4. digest gate — the claimed digest must match the recomputed canonical
 *    SHA-256 (`digest-mismatch`);
 * 5. tenant gate — the optional caller-supplied expected tenant must match
 *    the document scope (`cross-tenant-denied`, R12).
 */
import { DeviceSessionRecordSchema, type DeviceSessionRecord } from './session';
import { RuntimeEventTraceSchema, type RuntimeEventTrace } from './events';
import { FrameScheduleSchema, type FrameSchedule } from './schedule';
import { malformedRecordError } from './issues';
import {
  verifyDeviceSessionDigest,
  verifyRuntimeEventTraceDigest,
} from './serialize';
import { EXPERIENCE_RUNTIME_PROTOCOL_VERSION } from './version';
import type { ExperienceRuntimeError, ExperienceRuntimeResult } from './errors';

/** Options shared by the admission entry points. */
export interface AdmissionOptions {
  /**
   * The tenant the caller is admitting FOR. When provided, a document
   * scoped to a different tenant is rejected with `cross-tenant-denied`
   * (R12 — the hosting boundary is the tenant).
   */
  readonly expectedTenantId?: string;
}

function rootShapeError(): ExperienceRuntimeError {
  return {
    code: 'malformed-record',
    message: 'experience-runtime document root must be a JSON object',
    issues: [{ path: '$', message: 'expected a JSON object at the document root' }],
  };
}

function versionGate(input: unknown): ExperienceRuntimeError | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return rootShapeError();
  }
  const encountered = (input as Record<string, unknown>).protocolVersion;
  if (typeof encountered === 'string' && encountered !== EXPERIENCE_RUNTIME_PROTOCOL_VERSION) {
    return {
      code: 'version-unsupported',
      message: `protocol version mismatch: expected ${EXPERIENCE_RUNTIME_PROTOCOL_VERSION}, encountered ${encountered}`,
      expected: EXPERIENCE_RUNTIME_PROTOCOL_VERSION,
      encountered,
    };
  }
  return null;
}

function tenantDenial(
  path: readonly (string | number)[],
  expectedTenantId: string,
  encounteredTenantId: string,
): ExperienceRuntimeError {
  return {
    code: 'cross-tenant-denied',
    message: `cross-tenant document denied: expected tenant "${expectedTenantId}", encountered "${encounteredTenantId}"`,
    path: [...path],
    expectedTenantId,
    encounteredTenantId,
  };
}

/**
 * Parse, validate, and admit a serialized device-session record. Total;
 * see the module docs for the fixed precedence of typed errors.
 */
export function parseDeviceSessionRecord(
  input: unknown,
  options?: AdmissionOptions,
): ExperienceRuntimeResult<DeviceSessionRecord> {
  // Precedence 1-2: root shape + version gate.
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }

  // Precedence 3: schema gate (structure, strictness, consistency).
  const schemaParsed = DeviceSessionRecordSchema.safeParse(input);
  if (!schemaParsed.success) {
    return { ok: false, error: malformedRecordError(schemaParsed.error) };
  }
  const record = schemaParsed.data;

  // Precedence 4: digest gate (tamper detection).
  const digestVerified = verifyDeviceSessionDigest(record);
  if (!digestVerified.ok) {
    return { ok: false, error: digestVerified.error };
  }

  // Precedence 5: tenant gate.
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== record.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: tenantDenial(
        ['tenantScope', 'tenantId'],
        options.expectedTenantId,
        record.tenantScope.tenantId,
      ),
    };
  }

  return { ok: true, value: record };
}

/**
 * Parse, validate, and admit a serialized runtime event trace. Total; see
 * the module docs for the fixed precedence of typed errors.
 */
export function parseRuntimeEventTrace(
  input: unknown,
  options?: AdmissionOptions,
): ExperienceRuntimeResult<RuntimeEventTrace> {
  // Precedence 1-2: root shape + version gate.
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }

  // Precedence 3: schema gate (structure, strictness, lifecycle replay).
  const schemaParsed = RuntimeEventTraceSchema.safeParse(input);
  if (!schemaParsed.success) {
    return { ok: false, error: malformedRecordError(schemaParsed.error) };
  }
  const trace = schemaParsed.data;

  // Precedence 4: digest gate (tamper detection).
  const digestVerified = verifyRuntimeEventTraceDigest(trace);
  if (!digestVerified.ok) {
    return { ok: false, error: digestVerified.error };
  }

  // Precedence 5: tenant gate.
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== trace.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: tenantDenial(
        ['tenantScope', 'tenantId'],
        options.expectedTenantId,
        trace.tenantScope.tenantId,
      ),
    };
  }

  return { ok: true, value: trace };
}

/**
 * Validate a serialized frame schedule. Total: schema violations surface
 * as typed `malformed-record` issues with precise dotted paths.
 */
export function validateFrameSchedule(input: unknown): ExperienceRuntimeResult<FrameSchedule> {
  const parsed = FrameScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}
