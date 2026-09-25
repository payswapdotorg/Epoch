/**
 * Projected references: how an experience document addresses kernel state.
 *
 * The Experience Graph is a READ PROJECTION of kernel state (architecture
 * lock rule 8): it never embeds kernel objects, it references them opaquely
 * and binds the exact revision via the SHA-256 digest of the referenced
 * object's canonical JSON. Every reference is tenant-scoped (R12).
 *
 * Genuine runtime consumption of the referenced grammars:
 * - `world-entity` and `world-event` id schemas are imported from
 *   `@epoch/world-model` (the canonical World Model, W002) — if the world
 *   model's id grammar changes, this package fails to compile and its
 *   parity tests fail;
 * - `agent` ids are imported from `@epoch/agent-protocol` (W003);
 * - `world-relation` mirrors the world-model relation id grammar
 *   (`rel-<sha256>`) — the grammar is not exported as a standalone schema
 *   by W002, so it is mirrored here and pinned by the runtime parity test
 *   that materializes real relations through the WorldModel API;
 * - `evidence-record` and `capability` shapes are structurally compatible
 *   with `@epoch/evidence` (W006) and `@epoch/capability-registry` (W007);
 *   those packages are devDependencies pinned by compile-time and runtime
 *   parity tests (the kernel-to-kernel devDep precedent), never runtime
 *   dependencies.
 */
import { z } from 'zod';
import { AgentIdSchema, QUALIFIED_NAME_PATTERN, SEMVER_CORE_PATTERN } from '@epoch/agent-protocol';
import { EntityIdSchema, EventIdSchema } from '@epoch/world-model';
import { OpaqueScopeIdSchema, Sha256HexSchema } from './primitives';

/**
 * World-model relation id grammar, mirrored from
 * `@epoch/world-model`'s RelationSchema (`rel-<sha256-of-key>`). Pinned by
 * the runtime parity test (test/world-parity.test.ts) which materializes
 * real relations through the WorldModel API and asserts acceptance.
 */
export const WORLD_RELATION_ID_PATTERN = /^rel-[0-9a-f]{64}$/;

const WorldRelationIdSchema = z
  .string()
  .regex(WORLD_RELATION_ID_PATTERN)
  .meta({
    id: 'WorldRelationId',
    title: 'WorldRelationId',
    description: 'World-model relation identity: rel-<sha256-of-key> (owned by @epoch/world-model).',
  });

/** Reference to a materialized world-model entity at an exact revision. */
export const ProjectedWorldEntityRefSchema = z
  .strictObject({
    kind: z.literal('world-entity'),
    tenantId: OpaqueScopeIdSchema,
    entityId: EntityIdSchema,
    contentDigest: Sha256HexSchema,
  })
  .meta({
    id: 'ProjectedWorldEntityRef',
    title: 'ProjectedWorldEntityRef',
    description:
      'Exact-revision reference to a materialized world-model entity (W002 grammar; digest of its canonical JSON).',
  });

/** One projected world-entity reference. */
export type ProjectedWorldEntityRef = z.infer<typeof ProjectedWorldEntityRefSchema>;

/** Reference to a materialized world-model relation at an exact revision. */
export const ProjectedWorldRelationRefSchema = z
  .strictObject({
    kind: z.literal('world-relation'),
    tenantId: OpaqueScopeIdSchema,
    relationId: WorldRelationIdSchema,
    contentDigest: Sha256HexSchema,
  })
  .meta({
    id: 'ProjectedWorldRelationRef',
    title: 'ProjectedWorldRelationRef',
    description:
      'Exact-revision reference to a materialized world-model relation (W002 grammar; digest of its canonical JSON).',
  });

/** One projected world-relation reference. */
export type ProjectedWorldRelationRef = z.infer<typeof ProjectedWorldRelationRefSchema>;

/** Reference to a world-model event at an exact revision. */
export const ProjectedWorldEventRefSchema = z
  .strictObject({
    kind: z.literal('world-event'),
    tenantId: OpaqueScopeIdSchema,
    eventId: EventIdSchema,
    contentDigest: Sha256HexSchema,
  })
  .meta({
    id: 'ProjectedWorldEventRef',
    title: 'ProjectedWorldEventRef',
    description:
      'Exact-revision reference to a world-model event (W002 grammar; digest of its canonical JSON).',
  });

/** One projected world-event reference. */
export type ProjectedWorldEventRef = z.infer<typeof ProjectedWorldEventRefSchema>;

/**
 * Reference to a registered agent at an exact registration revision. Agent
 * semantics stay with the agent protocol (lock rule 2); presence and
 * activity presentations reference agents opaquely.
 */
export const ProjectedAgentRefSchema = z
  .strictObject({
    kind: z.literal('agent'),
    tenantId: OpaqueScopeIdSchema,
    agentId: AgentIdSchema,
    contentDigest: Sha256HexSchema,
  })
  .meta({
    id: 'ProjectedAgentRef',
    title: 'ProjectedAgentRef',
    description:
      'Exact-revision reference to a registered agent (W003 grammar; digest of its registration canonical JSON).',
  });

/** One projected agent reference. */
export type ProjectedAgentRef = z.infer<typeof ProjectedAgentRefSchema>;

/**
 * Reference to an evidence record. Evidence records are content-addressed
 * (their SHA-256 digest IS their identity — W006), so the reference carries
 * the digest directly.
 */
export const ProjectedEvidenceRefSchema = z
  .strictObject({
    kind: z.literal('evidence-record'),
    tenantId: OpaqueScopeIdSchema,
    recordDigest: Sha256HexSchema,
  })
  .meta({
    id: 'ProjectedEvidenceRef',
    title: 'ProjectedEvidenceRef',
    description:
      'Reference to an evidence record by its content-addressed identity (W006: the SHA-256 digest is the id).',
  });

/** One projected evidence-record reference. */
export type ProjectedEvidenceRef = z.infer<typeof ProjectedEvidenceRefSchema>;

/**
 * Reference to a registered capability at an exact manifest revision
 * (W007): opaque qualified-name identity plus semver core version plus the
 * digest of the manifest's canonical JSON.
 */
export const ProjectedCapabilityRefSchema = z
  .strictObject({
    kind: z.literal('capability'),
    tenantId: OpaqueScopeIdSchema,
    capabilityId: z.string().regex(QUALIFIED_NAME_PATTERN),
    capabilityVersion: z.string().regex(SEMVER_CORE_PATTERN),
    contentDigest: Sha256HexSchema,
  })
  .meta({
    id: 'ProjectedCapabilityRef',
    title: 'ProjectedCapabilityRef',
    description:
      'Exact-revision reference to a registered capability manifest (W007 grammar; digest of its canonical JSON).',
  });

/** One projected capability reference. */
export type ProjectedCapabilityRef = z.infer<typeof ProjectedCapabilityRefSchema>;

/** A projected reference to kernel state (discriminated on `kind`). */
export const ProjectedReferenceSchema = z
  .discriminatedUnion('kind', [
    ProjectedWorldEntityRefSchema,
    ProjectedWorldRelationRefSchema,
    ProjectedWorldEventRefSchema,
    ProjectedAgentRefSchema,
    ProjectedEvidenceRefSchema,
    ProjectedCapabilityRefSchema,
  ])
  .meta({
    id: 'ProjectedReference',
    title: 'ProjectedReference',
    description:
      'Opaque, tenant-scoped, exact-revision reference to projected kernel state; never an embedded kernel object.',
  });

/** One projected reference. */
export type ProjectedReference = z.infer<typeof ProjectedReferenceSchema>;

/**
 * Canonical sort/uniqueness key of a projected reference:
 * `<kind>:<identity>` where identity is the per-kind target id (for
 * capability references, `capabilityId@capabilityVersion`). Deterministic
 * ordering of reference arrays is enforced against this key.
 */
export function projectedReferenceKey(ref: ProjectedReference): string {
  switch (ref.kind) {
    case 'world-entity':
      return `world-entity:${ref.entityId}`;
    case 'world-relation':
      return `world-relation:${ref.relationId}`;
    case 'world-event':
      return `world-event:${ref.eventId}`;
    case 'agent':
      return `agent:${ref.agentId}`;
    case 'evidence-record':
      return `evidence-record:${ref.recordDigest}`;
    case 'capability':
      return `capability:${ref.capabilityId}@${ref.capabilityVersion}`;
  }
}

/** Structural identity used by the resolvability check (kind + target id). */
export function sameReferenceTarget(
  a: ProjectedReference,
  b: ProjectedReference,
): boolean {
  return projectedReferenceKey(a) === projectedReferenceKey(b);
}
