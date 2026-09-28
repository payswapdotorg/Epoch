/**
 * @epoch/deploy-model — shared primitives: opaque ids, digests, typed
 * errors and the total-result shape.
 *
 * House pattern (W009/W029/W032): ids are opaque, kind-prefixed slugs; the
 * digest discipline is canonical-JSON SHA-256 over @epoch/agent-protocol
 * (identical content -> identical digest, in every runtime, forever); and
 * EVERY public function is TOTAL — failures are typed
 * {@link DeployError} values (`{ ok: false, error }`), never exceptions.
 */
import { z } from 'zod';
import type { ZodError } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { DEPLOY_MODEL_RECORD_VERSION } from './version';
import type { DeployErrorCode } from './version';

// --------------------------------------------------------------------------------
// Ids (opaque, kind-prefixed, provider-neutral).
// --------------------------------------------------------------------------------

/** Deployable component id: `cmp:` + lowercase slug. */
export const COMPONENT_ID_PATTERN = /^cmp:[a-z0-9][a-z0-9-]{0,62}$/;
export const ComponentIdSchema = z
  .string()
  .regex(COMPONENT_ID_PATTERN, 'component ids are "cmp:" + lowercase slug');
export type ComponentId = z.infer<typeof ComponentIdSchema>;

/** Environment id: `env:` + lowercase slug. */
export const ENVIRONMENT_ID_PATTERN = /^env:[a-z0-9][a-z0-9-]{0,62}$/;
export const EnvironmentIdSchema = z
  .string()
  .regex(ENVIRONMENT_ID_PATTERN, 'environment ids are "env:" + lowercase slug');
export type EnvironmentId = z.infer<typeof EnvironmentIdSchema>;

/** Topology id: `topo:` + lowercase slug (stable name across revisions). */
export const TOPOLOGY_ID_PATTERN = /^topo:[a-z0-9][a-z0-9-]{0,62}$/;
export const TopologyIdSchema = z
  .string()
  .regex(TOPOLOGY_ID_PATTERN, 'topology ids are "topo:" + lowercase slug');
export type TopologyId = z.infer<typeof TopologyIdSchema>;

/** Deploy plan id: `plan:` + 16 lowercase hex (content-derived, replay-stable). */
export const PLAN_ID_PATTERN = /^plan:[0-9a-f]{16}$/;
export const PlanIdSchema = z
  .string()
  .regex(PLAN_ID_PATTERN, 'plan ids are "plan:" + 16 lowercase hex (content-derived)');
export type PlanId = z.infer<typeof PlanIdSchema>;

/** Deploy run id: `run:` + 16 lowercase hex (content-derived). */
export const RUN_ID_PATTERN = /^run:[0-9a-f]{16}$/;
export const RunIdSchema = z
  .string()
  .regex(RUN_ID_PATTERN, 'run ids are "run:" + 16 lowercase hex (content-derived)');
export type RunId = z.infer<typeof RunIdSchema>;

/** Gate policy id: `gate:` + lowercase slug. */
export const GATE_ID_PATTERN = /^gate:[a-z0-9][a-z0-9-]{0,62}$/;
export const GateIdSchema = z
  .string()
  .regex(GATE_ID_PATTERN, 'gate ids are "gate:" + lowercase slug');
export type GateId = z.infer<typeof GateIdSchema>;

/**
 * Opaque deployment revision slug — what a placement records as deployed.
 * Provider-neutral: a revision names CONTENT (the topology revision digest
 * it derives from), never an image tag, build number or artifact registry
 * coordinate.
 */
export const REVISION_PATTERN = /^rev:[0-9a-f]{16}$/;
export const RevisionSchema = z
  .string()
  .regex(REVISION_PATTERN, 'revisions are "rev:" + 16 lowercase hex (content-derived)');
export type Revision = z.infer<typeof RevisionSchema>;

/** Human/agent operator actor id: `actor:` + lowercase slug. */
export const ACTOR_ID_PATTERN = /^actor:[a-z0-9][a-z0-9-]{0,62}$/;
export const ActorIdSchema = z
  .string()
  .regex(ACTOR_ID_PATTERN, 'actor ids are "actor:" + lowercase slug');
export type ActorId = z.infer<typeof ActorIdSchema>;

// --------------------------------------------------------------------------------
// Digests (content addressing + tamper detection).
// --------------------------------------------------------------------------------

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
export const Sha256DigestSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'lowercase hex SHA-256 (64 characters)');
export type Sha256Digest = z.infer<typeof Sha256DigestSchema>;

/** The version discriminator on every serialized deploy record. */
export const DeployRecordVersionSchema = z.literal(DEPLOY_MODEL_RECORD_VERSION);

/** Canonical SHA-256 over a JSON value (the house digest discipline). */
export function digestOf(value: JsonValue): Sha256Digest {
  return canonicalDigest(value);
}

/** First `n` hex characters of a digest (id derivation; n <= 64). */
export function digestPrefix(digest: Sha256Digest, n = 16): string {
  return digest.slice(0, n);
}

// --------------------------------------------------------------------------------
// Typed errors + the total-result shape.
// --------------------------------------------------------------------------------

/** One typed deploy-model issue (a value; issue lists are sorted for determinism). */
export interface DeployIssue {
  readonly code: DeployErrorCode;
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/** A typed deploy-model failure (codes: DEPLOY_ERROR_CODES). */
export interface DeployError {
  readonly code: DeployErrorCode;
  readonly message: string;
  readonly issues: readonly DeployIssue[];
}

/** The total result shape every public deploy-model function returns. */
export type DeployResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DeployError };

/** Build a single-issue failure value. */
export function fail(code: DeployErrorCode, message: string, path: readonly (string | number)[] = []): DeployError {
  return { code, message, issues: [{ code, path, message }] };
}

/** Build a multi-issue failure value (issues sorted deterministically). */
export function failIssues(code: DeployErrorCode, message: string, issues: readonly DeployIssue[]): DeployError {
  const sorted = [...issues].sort((a, b) => {
    const pa = JSON.stringify(a.path);
    const pb = JSON.stringify(b.path);
    if (pa !== pb) return pa < pb ? -1 : 1;
    return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
  });
  return { code, message, issues: sorted };
}

/** Type guard narrowing a result to its success leg. */
export function isOk<T>(result: DeployResult<T>): result is { ok: true; value: T } {
  return result.ok;
}

/** Unwrap or throw (test-helper convenience; production code checks `ok`). */
export function unwrapOrThrow<T>(result: DeployResult<T>): T {
  if (result.ok) return result.value;
  throw new Error(`deploy-model: ${result.error.code}: ${result.error.message}`);
}

/**
 * Normalize a zod failure into the typed `validation` error (the W009/W029
 * admission convention): all issues are preserved with precise paths, and
 * a dedicated provider-neutrality pass elsewhere upgrades provider
 * vocabulary to `provider-vocabulary-rejected`.
 */
export function validationError(scope: string, error: ZodError): DeployError {
  const issues: DeployIssue[] = error.issues.map((issue) => ({
    code: 'validation' as const,
    path: issue.path.map((segment) => String(segment)),
    message: `${scope}: ${issue.message}`,
  }));
  return failIssues(
    'validation',
    `${scope}: schema validation failed (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  );
}

/** Re-export the tenancy tenant id schema so consumers need one import. */
export { TenantIdSchema };
export type TenantId = string;
