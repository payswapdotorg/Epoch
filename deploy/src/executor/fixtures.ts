/**
 * @epoch/deploy-model — the FIXTURE ENVIRONMENT MODEL (executor inputs).
 *
 * The reference executor never touches real infrastructure: it executes a
 * plan against a typed, in-memory ENVIRONMENT STATE — a tenant-scoped
 * snapshot of what is currently placed in one environment (derived from a
 * topology revision, or caller-supplied fixture). State snapshots are
 * content-addressed (byte-comparable across runs), immutable (every
 * transition returns a NEW sealed state), and carry the tenant that owns
 * the run (R12: a run's state contains ONLY that tenant's placements).
 *
 * Health probes are typed FIXTURE observations consumed by health-check
 * steps — declarations of what a probe observed, never probe invocations.
 */
import { z } from 'zod';
import { canonicalJsonStringify, TimestampSchema, type JsonValue, type Timestamp } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { ComponentIdSchema, DeployRecordVersionSchema, EnvironmentIdSchema, RevisionSchema, Sha256DigestSchema } from '../primitives';
import { digestOf, fail, validationError, type DeployResult } from '../primitives';
import { environmentById, placementsInEnvironment } from '../topology/topology';
import type { TopologyRevision } from '../topology/schema';
import type { ComponentId, EnvironmentId, Revision, Sha256Digest, TenantId } from '../primitives';
import { HEALTH_PROBE_RESULTS } from '../version';

// --------------------------------------------------------------------------------
// Environment state.
// --------------------------------------------------------------------------------

/** One placed component in the runtime state (a projection, not a record). */
export const PlacementStateSchema = z
  .strictObject({
    componentId: ComponentIdSchema,
    environmentId: EnvironmentIdSchema,
    revision: RevisionSchema,
    tenantId: TenantIdSchema,
    placedAt: TimestampSchema,
  })
  .readonly();
export type PlacementState = z.infer<typeof PlacementStateSchema>;

const environmentStateShape = z.strictObject({
  recordVersion: DeployRecordVersionSchema,
  environmentId: EnvironmentIdSchema,
  /** Owning tenant of the run (R12: state is tenant-scoped). */
  tenantId: TenantIdSchema,
  /** The topology revision this state derives from (skew detection). */
  derivedFromTopologyDigest: Sha256DigestSchema,
  /** Placements sorted by componentId (canonical form). */
  placements: z.array(PlacementStateSchema).readonly(),
});

/** An environment state (content half). */
export const EnvironmentStateContentSchema = environmentStateShape.readonly();
export type EnvironmentStateContent = z.infer<typeof EnvironmentStateContentSchema>;

/** A sealed environment state snapshot. */
export const EnvironmentStateSchema = environmentStateShape
  .extend({ digest: Sha256DigestSchema })
  .readonly();
export type EnvironmentState = z.infer<typeof EnvironmentStateSchema>;

/** Canonical digest of a state's content. */
export function environmentStateContent(state: EnvironmentState): Omit<EnvironmentState, 'digest'> {
  const { digest: _digest, ...rest } = state;
  void _digest;
  return rest;
}

/** Compute (or recompute) a state's content digest. */
export function environmentStateDigest(content: Omit<EnvironmentState, 'digest'>): Sha256Digest {
  return digestOf(sortStateContent(content) as unknown as JsonValue);
}

function sortStateContent(content: Omit<EnvironmentState, 'digest'>): Omit<EnvironmentState, 'digest'> {
  return {
    ...content,
    placements: [...content.placements].sort((a, b) =>
      a.componentId < b.componentId ? -1 : a.componentId > b.componentId ? 1 : 0,
    ),
  };
}

/** Seal an environment state content (sorts placements canonically). */
export function sealEnvironmentState(content: EnvironmentStateContent): DeployResult<EnvironmentState> {
  const parsed = EnvironmentStateContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: validationError('environment state', parsed.error) };
  const canonical = sortStateContent(parsed.data);
  return { ok: true, value: { ...canonical, digest: digestOf(canonical as unknown as JsonValue) } };
}

/** Verify a sealed state's digest (typed `digest-mismatch`). */
export function verifyEnvironmentStateDigest(state: EnvironmentState): DeployResult<EnvironmentState> {
  const expected = environmentStateDigest(environmentStateContent(state));
  return expected === state.digest
    ? { ok: true, value: state }
    : { ok: false, error: fail('digest-mismatch', `environment state of "${state.environmentId}" (tenant ${state.tenantId}): digest does not match content (tampered state)`, ['digest']) };
}

/**
 * Derive the tenant-scoped runtime state of one environment from a topology
 * revision: the environment's placements owned by `tenantId`, with their
 * revisions, in canonical order. Refuses unknown environments and tenants
 * outside the environment's scope.
 */
export function environmentStateFromTopology(
  topology: TopologyRevision,
  environmentId: EnvironmentId,
  tenantId: TenantId,
  instants: { readonly baselineAt: Timestamp },
): DeployResult<EnvironmentState> {
  const environment = environmentById(topology, environmentId);
  if (environment === null) {
    return { ok: false, error: fail('unknown-environment', `unknown environment "${environmentId}"`) };
  }
  if (!environment.tenantIds.includes(tenantId)) {
    return {
      ok: false,
      error: fail(
        'cross-tenant-plan-rejected',
        `tenant "${tenantId}" is outside the tenant scope of environment "${environmentId}" [${environment.tenantIds.join(', ')}]`,
        ['tenantId'],
      ),
    };
  }
  const placements = placementsInEnvironment(topology, environmentId)
    .filter((placement) => placement.tenantId === tenantId)
    .map((placement) => ({
      componentId: placement.componentId,
      environmentId: placement.environmentId,
      revision: placement.revision,
      tenantId: placement.tenantId,
      placedAt: instants.baselineAt,
    }));
  return sealEnvironmentState({
    recordVersion: 1,
    environmentId,
    tenantId,
    derivedFromTopologyDigest: topology.digest,
    placements,
  });
}

/** Immutable transition: set one component's placement (add or replace). */
export function withPlacement(
  state: EnvironmentState,
  componentId: ComponentId,
  revision: Revision,
  placedAt: Timestamp,
): DeployResult<EnvironmentState> {
  const rest = state.placements.filter((placement) => placement.componentId !== componentId);
  return sealEnvironmentState({
    ...environmentStateContent(state),
    placements: [
      ...rest,
      { componentId, environmentId: state.environmentId, revision, tenantId: state.tenantId, placedAt },
    ],
  });
}

/** Immutable transition: remove one component's placement (un-place). */
export function withoutPlacement(state: EnvironmentState, componentId: ComponentId): DeployResult<EnvironmentState> {
  return sealEnvironmentState({
    ...environmentStateContent(state),
    placements: state.placements.filter((placement) => placement.componentId !== componentId),
  });
}

/** Canonical JSON serialization of a state snapshot. */
export function serializeEnvironmentState(state: EnvironmentState): string {
  return canonicalJsonStringify(state as unknown as JsonValue);
}

/** Parse + digest-verify a serialized state (total). */
export function deserializeEnvironmentState(text: string): DeployResult<EnvironmentState> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: fail('validation', `serialized environment state is not valid JSON: ${(err as Error).message}`) };
  }
  const typed = EnvironmentStateSchema.safeParse(parsed);
  if (!typed.success) return { ok: false, error: validationError('environment state', typed.error) };
  return verifyEnvironmentStateDigest(typed.data);
}

// --------------------------------------------------------------------------------
// Fixture health probes.
// --------------------------------------------------------------------------------

/** One fixture probe observation (what a probe OBSERVED, not a call). */
export const HealthProbeObservationSchema = z
  .strictObject({
    componentId: ComponentIdSchema,
    environmentId: EnvironmentIdSchema,
    result: z.enum(HEALTH_PROBE_RESULTS),
    detail: z.string().max(512).optional(),
    observedAt: TimestampSchema,
  })
  .readonly();
export type HealthProbeObservation = z.infer<typeof HealthProbeObservationSchema>;

/** Parse fixture probe observations (total). */
export function parseHealthProbes(value: unknown): DeployResult<readonly HealthProbeObservation[]> {
  const parsed = z.array(HealthProbeObservationSchema).safeParse(value);
  if (!parsed.success) return { ok: false, error: validationError('health probes', parsed.error) };
  return { ok: true, value: parsed.data };
}
