/**
 * @epoch/tenancy — runtime zod validators for the published contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics cannot enter kernel types through the
 * tenancy door (same policy as the W002-W008 validators). Every exported
 * schema is part of the published surface emitted under `schemas/`.
 */
import { z } from 'zod';
import { TENANCY_NODE_KINDS, TENANCY_RECORD_VERSION } from './version';
import {
  PROJECT_ID_PATTERN,
  TENANCY_NODE_ID_PATTERN,
  TENANT_ID_PATTERN,
  WORKSPACE_ID_PATTERN,
  kindPrefixOf,
} from './version';

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Version discriminator on serialized tenancy records (v1). */
export const TenancyRecordVersionSchema = z.literal(TENANCY_RECORD_VERSION).meta({
  id: 'TenancyRecordVersion',
  title: 'TenancyRecordVersion',
  description: 'Version discriminator carried by every serialized tenancy node, record, and snapshot (currently 1).',
});

/** The seven tenancy node kinds (architecture.md, "Tenancy"). */
export const TenancyNodeKindSchema = z.enum(TENANCY_NODE_KINDS).meta({
  id: 'TenancyNodeKind',
  title: 'TenancyNodeKind',
  description:
    'Tenancy node kind: platform, tenant, workspace, project (organizational scopes) or world, scenario, evidence (project-local content).',
});

/** Opaque, kind-prefixed tenancy node identity. */
export const TenancyNodeIdSchema = z
  .string()
  .regex(
    TENANCY_NODE_ID_PATTERN,
    'must be a kind-prefixed tenancy id (e.g. "tenant:acme", "workspace:acme-eng")',
  )
  .meta({
    id: 'TenancyNodeId',
    title: 'TenancyNodeId',
    description:
      'Opaque, kind-prefixed tenancy node identity: one of the seven kind prefixes plus a lowercase slug.',
  });

/** Opaque tenant identity (`tenant:<slug>`). */
export const TenantIdSchema = z
  .string()
  .regex(TENANT_ID_PATTERN, 'must be a tenant id of the form "tenant:<slug>"')
  .meta({
    id: 'TenantId',
    title: 'TenantId',
    description: 'Opaque tenant identity: "tenant:" followed by a lowercase slug.',
  });

/** Opaque workspace identity (`workspace:<slug>`). */
export const WorkspaceIdSchema = z
  .string()
  .regex(WORKSPACE_ID_PATTERN, 'must be a workspace id of the form "workspace:<slug>"')
  .meta({
    id: 'WorkspaceId',
    title: 'WorkspaceId',
    description: 'Opaque workspace identity: "workspace:" followed by a lowercase slug.',
  });

/** Opaque project identity (`project:<slug>`). */
export const ProjectIdSchema = z
  .string()
  .regex(PROJECT_ID_PATTERN, 'must be a project id of the form "project:<slug>"')
  .meta({
    id: 'ProjectId',
    title: 'ProjectId',
    description: 'Opaque project identity: "project:" followed by a lowercase slug.',
  });

/** SHA-256 digest as lowercase hex. */
export const Sha256DigestSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'Sha256Digest',
    title: 'Sha256Digest',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/**
 * A tenancy node. Runtime refinement (not representable in the structural
 * JSON Schema projection): the id's kind prefix must agree with the
 * record's `kind` — a malformed id (e.g. `tenant:x` on a workspace record)
 * is rejected before any semantic check.
 */
export const TenancyNodeSchema = z
  .strictObject({
    schemaVersion: TenancyRecordVersionSchema,
    nodeId: TenancyNodeIdSchema,
    kind: TenancyNodeKindSchema,
    displayName: z.string().min(1).max(200),
    description: z.string().min(1).max(4000).optional(),
    parentId: TenancyNodeIdSchema.nullable(),
  })
  .readonly()
  .refine(
    (node) => kindPrefixOf(node.nodeId) === node.kind,
    'nodeId kind prefix must match the record kind',
  )
  .meta({
    id: 'TenancyNode',
    title: 'TenancyNode',
    description:
      'Immutable, content-addressed tenancy node: kind-prefixed opaque id, kind, display name, and the opaque id of the parent node (null only for the platform root).',
  });

/** The published tenancy record: node content plus its content address. */
export const TenancyNodeRecordSchema = z
  .strictObject({
    schemaVersion: TenancyRecordVersionSchema,
    node: TenancyNodeSchema,
    nodeDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'TenancyNodeRecord',
    title: 'TenancyNodeRecord',
    description:
      'Published tenancy record: the immutable node content plus the SHA-256 digest of that content (the exact-revision address).',
  });

/**
 * A deterministic hierarchy snapshot. Runtime refinement: node ids are
 * duplicate-free (duplicates additionally surface as the typed
 * `duplicate-node` error in the semantic admission pipeline).
 */
export const TenancySnapshotSchema = z
  .strictObject({
    schemaVersion: TenancyRecordVersionSchema,
    records: z.array(TenancyNodeRecordSchema).readonly(),
  })
  .readonly()
  .refine(
    (snapshot) =>
      new Set(snapshot.records.map((record) => record.node.nodeId)).size ===
      snapshot.records.length,
    'node ids must be unique within a snapshot',
  )
  .meta({
    id: 'TenancySnapshot',
    title: 'TenancySnapshot',
    description:
      'Deterministic, serialization-friendly hierarchy projection: tenancy records sorted by node id ascending.',
  });
