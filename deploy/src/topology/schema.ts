/**
 * @epoch/deploy-model — TOPOLOGY validators (the typed platform model).
 *
 * The topology is DATA: components (which workspace packages/services/apps/
 * adapters/packs are deployable), environments (dev/staging/prod as typed
 * records with caller-supplied instants and tenant scope), placement
 * (component -> environment at a revision, owned by a tenant) and wiring
 * (dependency edges between placed components). Swapping environments
 * changes NOTHING in code — the planner and executor are pure functions
 * over these records.
 *
 * Strict objects throughout: unknown fields are rejected, so provider
 * semantics cannot enter through any door; the active provider-vocabulary
 * scan (src/neutrality.ts) runs at every admission.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { DeployRecordVersionSchema } from '../primitives';
import { ComponentIdSchema, EnvironmentIdSchema, RevisionSchema, Sha256DigestSchema } from '../primitives';
import { DeployProvenanceSchema } from '../provenance';
import { COMPONENT_KINDS, ENVIRONMENT_TIERS, HEALTH_CHECK_KINDS } from '../version';

// --------------------------------------------------------------------------------
// Health + capacity declarations.
// --------------------------------------------------------------------------------

/** Neutral health-check declaration (no probe is ever invoked in-model). */
export const HealthDeclarationSchema = z
  .strictObject({
    checkKind: z.enum(HEALTH_CHECK_KINDS),
    /** Budget for one probe attempt, in milliseconds (declaration, not call). */
    timeoutMs: z.number().int().min(1).max(600_000),
    /** Interval between checks, in milliseconds (declaration, not call). */
    intervalMs: z.number().int().min(1_000).max(600_000),
  })
  .readonly();
export type HealthDeclaration = z.infer<typeof HealthDeclarationSchema>;

/** Neutral capacity declaration (abstract replica units; no vendor shapes). */
export const CapacityDeclarationSchema = z
  .strictObject({
    replicas: z.number().int().min(1).max(64),
  })
  .readonly();
export type CapacityDeclaration = z.infer<typeof CapacityDeclarationSchema>;

// --------------------------------------------------------------------------------
// Component records.
// --------------------------------------------------------------------------------

/** Repository-relative workspace path (e.g. `packages/tenancy`, `apps/web`). */
export const WORKSPACE_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*){0,7}$/;
export const WorkspacePathSchema = z
  .string()
  .max(256)
  .regex(WORKSPACE_PATH_PATTERN, 'workspace paths are repository-relative POSIX paths');

const componentShape = z.strictObject({
  recordVersion: DeployRecordVersionSchema,
  componentId: ComponentIdSchema,
  kind: z.enum(COMPONENT_KINDS),
  name: z.string().min(1).max(128),
  workspacePath: WorkspacePathSchema,
  /** Compile/dependency edges to OTHER components (by id, never by path). */
  dependsOn: z.array(ComponentIdSchema).readonly(),
  health: HealthDeclarationSchema,
  capacity: CapacityDeclarationSchema,
  provenance: DeployProvenanceSchema,
});

/** One deployable component (content half). */
export const ComponentContentSchema = componentShape.readonly();
export type ComponentContent = z.infer<typeof ComponentContentSchema>;

/** One deployable component (sealed: content-addressed by `digest`). */
export const ComponentRecordSchema = componentShape
  .extend({ digest: Sha256DigestSchema })
  .readonly();
export type ComponentRecord = z.infer<typeof ComponentRecordSchema>;

// --------------------------------------------------------------------------------
// Environment records.
// --------------------------------------------------------------------------------

const environmentShape = z.strictObject({
  recordVersion: DeployRecordVersionSchema,
  environmentId: EnvironmentIdSchema,
  tier: z.enum(ENVIRONMENT_TIERS),
  displayName: z.string().min(1).max(128),
  /** Tenant scope of the environment (R12: isolation is at this boundary). */
  tenantIds: z.array(TenantIdSchema).min(1).readonly(),
  /** Caller-supplied provisioning instant (zero wall-clock). */
  provisionedAt: TimestampSchema,
  provenance: DeployProvenanceSchema,
});

/** One deployment environment (content half). */
export const EnvironmentContentSchema = environmentShape.readonly();
export type EnvironmentContent = z.infer<typeof EnvironmentContentSchema>;

/** One deployment environment (sealed; tenants + caller-supplied instant). */
export const EnvironmentRecordSchema = environmentShape
  .extend({ digest: Sha256DigestSchema })
  .readonly();
export type EnvironmentRecord = z.infer<typeof EnvironmentRecordSchema>;

// --------------------------------------------------------------------------------
// Placement records.
// --------------------------------------------------------------------------------

const placementShape = z.strictObject({
  recordVersion: DeployRecordVersionSchema,
  environmentId: EnvironmentIdSchema,
  componentId: ComponentIdSchema,
  /** The currently-deployed revision of the component in this environment. */
  revision: RevisionSchema,
  /** Owning tenant (MUST be within the environment's tenant scope). */
  tenantId: TenantIdSchema,
  provenance: DeployProvenanceSchema,
});

/** One placed component revision in an environment (content half). */
export const PlacementContentSchema = placementShape.readonly();
export type PlacementContent = z.infer<typeof PlacementContentSchema>;

/** One placed component revision in an environment, owned by a tenant. */
export const PlacementRecordSchema = placementShape
  .extend({ digest: Sha256DigestSchema })
  .readonly();
export type PlacementRecord = z.infer<typeof PlacementRecordSchema>;

// --------------------------------------------------------------------------------
// Wiring records.
// --------------------------------------------------------------------------------

const wiringShape = z.strictObject({
  recordVersion: DeployRecordVersionSchema,
  environmentId: EnvironmentIdSchema,
  fromComponentId: ComponentIdSchema,
  toComponentId: ComponentIdSchema,
  provenance: DeployProvenanceSchema,
});

/** One dependency edge between placed components (content half). */
export const WiringContentSchema = wiringShape.readonly();
export type WiringContent = z.infer<typeof WiringContentSchema>;

/**
 * One dependency edge between two PLACED components of one environment:
 * `fromComponentId` consumes `toComponentId` at runtime. Endpoints must be
 * placed in the wiring's environment and owned by the SAME tenant
 * (R12 isolation at the wiring boundary).
 */
export const WiringRecordSchema = wiringShape
  .extend({ digest: Sha256DigestSchema })
  .readonly();
export type WiringRecord = z.infer<typeof WiringRecordSchema>;

// --------------------------------------------------------------------------------
// The sealed topology revision.
// --------------------------------------------------------------------------------

const topologyIdField = z
  .string()
  .regex(/^topo:[a-z0-9][a-z0-9-]{0,62}$/, 'topology ids are "topo:" + lowercase slug');

const topologyShape = z.strictObject({
  recordVersion: DeployRecordVersionSchema,
  topologyId: topologyIdField,
  /** Monotonic revision sequence of this topology name. */
  sequence: z.number().int().min(1),
  components: z.array(ComponentRecordSchema).readonly(),
  environments: z.array(EnvironmentRecordSchema).readonly(),
  placements: z.array(PlacementRecordSchema).readonly(),
  wiring: z.array(WiringRecordSchema).readonly(),
  provenance: DeployProvenanceSchema,
});

/** The whole platform as one revision (content half). */
export const TopologyContentSchema = topologyShape.readonly();
export type TopologyContent = z.infer<typeof TopologyContentSchema>;

/** The whole platform as one content-addressed revision. */
export const TopologyRevisionSchema = topologyShape
  .extend({ digest: Sha256DigestSchema })
  .readonly();
export type TopologyRevision = z.infer<typeof TopologyRevisionSchema>;
