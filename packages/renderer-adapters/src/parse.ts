/**
 * Total admission surface for serialized renderer-adapters documents.
 *
 * `parseRendererAdapterSelection` and `parseRendererMountPlan` never
 * throw: every failure is a typed {@link RendererAdaptersError}.
 *
 * Admission precedence (fixed, so consumers branch deterministically):
 *
 * 1. root shape — a non-object root is a `malformed-record`;
 * 2. version gate — a string `protocolVersion` that differs from
 *    `1.0.0` fails fast with `version-unsupported`;
 * 3. schema gate — full zod validation (strict objects reject unknown
 *    vendor fields; canonical-consistency refinements reject broken
 *    decision traces);
 * 4. digest gate — the claimed digest must match the recomputed
 *    canonical SHA-256 (`digest-mismatch`);
 * 5. tenant gate — the optional caller-supplied expected tenant must
 *    match the record's scope (`cross-tenant-denied`, R12).
 */
import { RENDERER_ADAPTERS_PROTOCOL_VERSION } from './version';
import { rootShapeError, versionUnsupportedError, crossTenantDeniedError } from './issues';
import type { RendererAdaptersError, RendererAdaptersResult } from './errors';
import type { RendererAdapterSelection } from './selection';
import type { RendererMountPlan } from './plan';
import { RendererAdapterSelectionSchema } from './selection';
import { RendererMountPlanSchema } from './plan';
import { verifySelectionDigest, verifyMountPlanDigest } from './serialize';

/** Options shared by the admission entry points. */
export interface AdmissionOptions {
  /**
   * The tenant the caller is admitting FOR. When provided, a record
   * scoped to a different tenant is rejected with `cross-tenant-denied`
   * (R12 — the adaptation boundary is the tenant).
   */
  readonly expectedTenantId?: string;
}

function versionGate(input: unknown): RendererAdaptersError | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return rootShapeError();
  }
  const encountered = (input as Record<string, unknown>).protocolVersion;
  if (typeof encountered === 'string' && encountered !== RENDERER_ADAPTERS_PROTOCOL_VERSION) {
    return versionUnsupportedError(RENDERER_ADAPTERS_PROTOCOL_VERSION, encountered);
  }
  return null;
}

/**
 * Parse, validate, and admit a serialized adapter selection. Total; see
 * the module docs for the fixed precedence of typed errors.
 */
export function parseRendererAdapterSelection(
  input: unknown,
  options?: AdmissionOptions,
): RendererAdaptersResult<RendererAdapterSelection> {
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }
  const schemaParsed = RendererAdapterSelectionSchema.safeParse(input);
  if (!schemaParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the renderer adapter selection failed schema admission',
        issues: schemaParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const digestVerified = verifySelectionDigest(schemaParsed.data);
  if (!digestVerified.ok) {
    return { ok: false, error: digestVerified.error };
  }
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== schemaParsed.data.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: crossTenantDeniedError(
        ['tenantScope', 'tenantId'],
        options.expectedTenantId,
        schemaParsed.data.tenantScope.tenantId,
      ),
    };
  }
  return { ok: true, value: schemaParsed.data };
}

/**
 * Parse, validate, and admit a serialized mount plan. Total; same fixed
 * precedence.
 */
export function parseRendererMountPlan(
  input: unknown,
  options?: AdmissionOptions,
): RendererAdaptersResult<RendererMountPlan> {
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }
  const schemaParsed = RendererMountPlanSchema.safeParse(input);
  if (!schemaParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the renderer mount plan failed schema admission',
        issues: schemaParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const digestVerified = verifyMountPlanDigest(schemaParsed.data);
  if (!digestVerified.ok) {
    return { ok: false, error: digestVerified.error };
  }
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== schemaParsed.data.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: crossTenantDeniedError(
        ['tenantScope', 'tenantId'],
        options.expectedTenantId,
        schemaParsed.data.tenantScope.tenantId,
      ),
    };
  }
  return { ok: true, value: schemaParsed.data };
}
