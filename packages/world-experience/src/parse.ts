/**
 * The total admission surface of the world experience layer — the one-stop
 * entry points for serialized world documents. Every entry point never
 * throws: failures are typed {@link WorldExperienceError} records.
 *
 * Admission precedence for scenes (fixed, so consumers branch
 * deterministically — the W011/W013 discipline):
 *
 * 1. root shape — a non-object root is a `malformed-record`;
 * 2. version gate — a string `protocolVersion` that differs from
 *    `1.0.0` fails fast with `version-unsupported`;
 * 3. schema gate — full zod validation (strict objects reject
 *    unknown/vendor fields; canonical-ordering refinements reject
 *    non-deterministic collection orders) — `malformed-record`;
 * 4. tenant gate — the optional expected tenant must match the scene
 *    scope, and every projected agent/evidence reference must belong to
 *    the scene's tenant (`cross-tenant-denied`, R12);
 * 5. resolvability gates — focus targets, overlay targets, animation
 *    targets, applied overlays, and the followed agent must resolve
 *    within the scene (`unknown-scene-reference` /
 *    `unknown-overlay-reference`); narrative evidence citations must
 *    resolve (`unknown-evidence-reference`);
 * 6. replay gate — the timeline position must be within the timeline
 *    bounds (`invalid-replay-position`).
 *
 * Intent admission (Dynamic UI law) and ontology admission live with
 * their vocabularies (src/intent.ts, src/ontology.ts) and are re-exported
 * here for the one-stop surface.
 */
import {
  admitWorldSceneContent,
  WorldSceneSchema,
  type SceneStoreOptions,
  type WorldScene,
  type WorldSceneContent,
} from './scene';
import { verifyWorldSceneDigest } from './serialize';
import { malformedRecordError } from './issues';
import type { WorldExperienceResult } from './errors';

/** Options shared by the admission entry points (the tenant gate). */
export type WorldAdmissionOptions = SceneStoreOptions;

/**
 * Admit one serialized world scene (the total form). Precedence per the
 * module docs; the result is the VALIDATED scene content.
 */
export function admitWorldScene(
  input: unknown,
  options?: WorldAdmissionOptions,
): WorldExperienceResult<WorldSceneContent> {
  return admitWorldSceneContent(input, options);
}

/**
 * Admit one SEALED world scene envelope: full admission plus digest
 * verification (tamper detection). The result is the verified scene
 * envelope.
 */
export function admitSealedWorldScene(
  input: unknown,
  options?: WorldAdmissionOptions,
): WorldExperienceResult<WorldScene> {
  const parsed = WorldSceneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  const verified = verifyWorldSceneDigest(parsed.data);
  if (!verified.ok) {
    return verified;
  }
  if (options?.expectedTenantId !== undefined && parsed.data.tenantScope.tenantId !== options.expectedTenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: `cross-tenant scene admission denied: expected tenant "${options.expectedTenantId}", encountered "${parsed.data.tenantScope.tenantId}"`,
        path: ['tenantScope', 'tenantId'],
        expectedTenantId: options.expectedTenantId,
        encounteredTenantId: parsed.data.tenantScope.tenantId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// One-stop re-exports of the sibling admission surfaces.
export { admitWorldIntent } from './intent';
export type { WorldInteractionIntent } from './intent';
export { admitOntologyRecord } from './ontology';
export type { WorldOntologyRecord } from './ontology';
