/**
 * @epoch/tenancy — runtime zod validators for the published contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics cannot enter kernel types through the tenancy
 * door (same policy as the W002-W008 validators). Ids are typed by prefix
 * (`tenant:acme`), mirroring the agent-protocol `agent:` id house pattern.
 */
import { z } from 'zod';
import {
  TENANCY_KIND_ID_PREFIXES,
  TENANCY_NODE_KINDS,
  TENANCY_RECORD_VERSION,
} from './version';

/** The id slug shared by every kind: lowercase kebab, 1..63 chars. */
export const TENANCY_ID_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Typed platform id: `platform:` + slug (the single hierarchy root). */
export const PLATFORM_ID_PATTERN = /^platform:[a-z0-9][a-z0-9-]{0,62}$/;
/** Typed tenant id: `tenant:` + slug. */
export const TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;
/** Typed workspace id: `workspace:` + slug. */
export const WORKSPACE_ID_PATTERN = /^workspace:[a-z0-9][a-z0-9-]{0,62}$/;
/** Typed project id: `project:` + slug. */
export const PROJECT_ID_PATTERN = /^project:[a-z0-9][a-z0-9-]{0,62}$/;
/** Typed world id: `world:` + slug. */
export const WORLD_ID_PATTERN = /^world:[a-z0-9][a-z0-9-]{0,62}$/;
/** Typed scenario id: `scenario:` + slug. */
export const SCENARIO_ID_PATTERN = /^scenario:[a-z0-9][a-z0-9-]{0,62}$/;
/** Typed evidence id: `evidence:` + slug. */
export const EVIDENCE_ID_PATTERN = /^evidence:[a-z0-9][a-z0-9-]{0,62}$/;

/** Any typed tenancy-node id: a known kind prefix + slug. */
export const TENANCY_NODE_ID_PATTERN =
  /^(platform|tenant|workspace|project|world|scenario|evidence):[a-z0-9][a-z0-9-]{0,62}$/;

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** SHA-256 digest as lowercase hex. */
export const Sha256DigestSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'Sha256Digest',
    title: 'Sha256Digest',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** Version discriminator on serialized tenancy documents (v1). */
export const TenancyRecordVersionSchema = z
  .literal(TENANCY_RECORD_VERSION)
  .meta({
    id: 'TenancyRecordVersion',
    title: 'TenancyRecordVersion',
    description: 'Version discriminator carried by every serialized tenancy document (currently 1).',
  });

/** Opaque platform identity (the single hierarchy root). */
export const PlatformIdSchema = z
  .string()
  .regex(PLATFORM_ID_PATTERN, 'must be a platform id: "platform:" + lowercase slug')
  .meta({
    id: 'PlatformId',
    title: 'PlatformId',
    description: 'Opaque platform identity: "platform:" followed by a lowercase slug (the single root).',
  });

/** Opaque tenant identity. */
export const TenantIdSchema = z
  .string()
  .regex(TENANT_ID_PATTERN, 'must be a tenant id: "tenant:" + lowercase slug')
  .meta({
    id: 'TenantId',
    title: 'TenantId',
    description: 'Opaque tenant identity: "tenant:" followed by a lowercase slug.',
  });

/** Opaque workspace identity. */
export const WorkspaceIdSchema = z
  .string()
  .regex(WORKSPACE_ID_PATTERN, 'must be a workspace id: "workspace:" + lowercase slug')
  .meta({
    id: 'WorkspaceId',
    title: 'WorkspaceId',
    description: 'Opaque workspace identity: "workspace:" followed by a lowercase slug.',
  });

/** Opaque project identity. */
export const ProjectIdSchema = z
  .string()
  .regex(PROJECT_ID_PATTERN, 'must be a project id: "project:" + lowercase slug')
  .meta({
    id: 'ProjectId',
    title: 'ProjectId',
    description: 'Opaque project identity: "project:" followed by a lowercase slug.',
  });

/** Opaque world identity. */
export const WorldIdSchema = z
  .string()
  .regex(WORLD_ID_PATTERN, 'must be a world id: "world:" + lowercase slug')
  .meta({
    id: 'WorldId',
    title: 'WorldId',
    description: 'Opaque world identity: "world:" followed by a lowercase slug.',
  });

/** Opaque scenario identity. */
export const ScenarioIdSchema = z
  .string()
  .regex(SCENARIO_ID_PATTERN, 'must be a scenario id: "scenario:" + lowercase slug')
  .meta({
    id: 'ScenarioId',
    title: 'ScenarioId',
    description: 'Opaque scenario identity: "scenario:" followed by a lowercase slug.',
  });

/** Opaque evidence identity. */
export const EvidenceIdSchema = z
  .string()
  .regex(EVIDENCE_ID_PATTERN, 'must be an evidence id: "evidence:" + lowercase slug')
  .meta({
    id: 'EvidenceId',
    title: 'EvidenceId',
    description: 'Opaque evidence identity: "evidence:" followed by a lowercase slug.',
  });

/** Any typed tenancy-node id (kind prefix + slug). */
export const TenancyNodeIdSchema = z
  .string()
  .regex(
    TENANCY_NODE_ID_PATTERN,
    'must be a tenancy node id: "platform:"|"tenant:"|"workspace:"|"project:"|"world:"|"scenario:"|"evidence:" + lowercase slug',
  )
  .meta({
    id: 'TenancyNodeId',
    title: 'TenancyNodeId',
    description:
      'Typed tenancy-node identity: a known kind prefix ("tenant:", "workspace:", ...) followed by a lowercase slug; the prefix encodes the node kind.',
  });

/** Tenancy node kinds — the levels of the frozen hierarchy. */
export const TenancyNodeKindSchema = z.enum(TENANCY_NODE_KINDS).meta({
  id: 'TenancyNodeKind',
  title: 'TenancyNodeKind',
  description:
    'Tenancy hierarchy level: platform, tenant, workspace, project, or the project-scoped leaves world/scenario/evidence.',
});

/**
 * A tenancy node. Runtime refinements (not representable in the structural
 * JSON Schema projection): the id prefix must match the declared kind, and
 * `parentId` must be `null` if and only if the kind is `platform`.
 */
export const TenancyNodeSchema = z
  .strictObject({
    schemaVersion: TenancyRecordVersionSchema,
    id: TenancyNodeIdSchema,
    kind: TenancyNodeKindSchema,
    parentId: z.union([TenancyNodeIdSchema, z.null()]),
    displayName: z.string().min(1).max(256).optional(),
  })
  .readonly()
  .refine(
    (node) => node.id.startsWith(`${TENANCY_KIND_ID_PREFIXES[node.kind]}:`),
    { error: 'id prefix must match the declared kind', path: ['id'] },
  )
  .refine(
    (node) => (node.kind === 'platform') === (node.parentId === null),
    {
      error: 'parentId must be null if and only if kind is "platform" (the single root)',
      path: ['parentId'],
    },
  )
  .meta({
    id: 'TenancyNode',
    title: 'TenancyNode',
    description:
      'A tenancy hierarchy node: typed id (prefix = kind), kind, an opaque parent-id reference (null only for the platform root), and an optional display name.',
  });

/** A sealed node record: the node plus its claimed content digest. */
export const SealedTenancyNodeSchema = z
  .strictObject({
    node: TenancyNodeSchema,
    digest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'SealedTenancyNode',
    title: 'SealedTenancyNode',
    description:
      'A tenancy node plus the SHA-256 digest claimed for its canonical JSON content; admission recomputes and rejects mismatches (tamper detection).',
  });

/** A deterministic whole-directory snapshot (nodes sorted by id). */
export const TenancySnapshotSchema = z
  .strictObject({
    schemaVersion: TenancyRecordVersionSchema,
    nodes: z.array(TenancyNodeSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'TenancySnapshot',
    title: 'TenancySnapshot',
    description:
      'Deterministic serialization of a whole tenancy directory: all nodes, sorted by id (insertion order never leaks).',
  });
