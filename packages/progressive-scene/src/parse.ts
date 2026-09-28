/**
 * Total admission surface for serialized progressive-scene documents.
 *
 * `parseProgressiveSceneLadder` never throws: every failure is a typed
 * {@link ProgressiveSceneError}.
 *
 * Admission precedence (fixed, so consumers branch deterministically):
 *
 * 1. root shape — a non-object root is a `malformed-record`;
 * 2. version gate — a string `protocolVersion` that differs from
 *    `1.0.0` fails fast with `version-unsupported`;
 * 3. schema gate — full zod validation (strict objects reject unknown
 *    vendor fields; canonical-consistency refinements reject broken
 *    digest chains);
 * 4. digest gate — the claimed digest must match the recomputed
 *    canonical SHA-256 (`digest-mismatch`);
 * 5. tenant gate — the optional caller-supplied expected tenant must
 *    match the ladder's scope (`cross-tenant-denied`, R12).
 */
import { PROGRESSIVE_SCENE_PROTOCOL_VERSION } from './version';
import { rootShapeError, versionUnsupportedError, crossTenantDeniedError } from './issues';
import type { ProgressiveSceneError, ProgressiveSceneResult } from './errors';
import type { ProgressiveSceneLadder } from './ladder';
import { ProgressiveSceneLadderSchema } from './ladder';
import { verifyLadderDigest } from './serialize';

/** Options shared by the admission entry points. */
export interface AdmissionOptions {
  /**
   * The tenant the caller is admitting FOR. When provided, a ladder
   * scoped to a different tenant is rejected with `cross-tenant-denied`
   * (R12 — the projection boundary is the tenant).
   */
  readonly expectedTenantId?: string;
}

function versionGate(input: unknown): ProgressiveSceneError | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return rootShapeError();
  }
  const encountered = (input as Record<string, unknown>).protocolVersion;
  if (typeof encountered === 'string' && encountered !== PROGRESSIVE_SCENE_PROTOCOL_VERSION) {
    return versionUnsupportedError(PROGRESSIVE_SCENE_PROTOCOL_VERSION, encountered);
  }
  return null;
}

/**
 * Parse, validate, and admit a serialized progressive-scene ladder.
 * Total; see the module docs for the fixed precedence of typed errors.
 */
export function parseProgressiveSceneLadder(
  input: unknown,
  options?: AdmissionOptions,
): ProgressiveSceneResult<ProgressiveSceneLadder> {
  // Precedence 1-2: root shape + version gate.
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }

  // Precedence 3: schema gate.
  const schemaParsed = ProgressiveSceneLadderSchema.safeParse(input);
  if (!schemaParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the progressive-scene ladder failed schema admission',
        issues: schemaParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }

  // Precedence 4: digest gate.
  const digestVerified = verifyLadderDigest(schemaParsed.data);
  if (!digestVerified.ok) {
    return { ok: false, error: digestVerified.error };
  }

  // Precedence 5: tenant gate.
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
