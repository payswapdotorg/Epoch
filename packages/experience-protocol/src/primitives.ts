/**
 * Provider-neutral zod primitives of the experience protocol. Every schema
 * here is a JSON-representable data shape; no field encodes a vendor,
 * engine, renderer, or framework (architecture lock rule 13).
 *
 * Digest machinery (SHA-256, canonical JSON) and the shared protocol
 * primitives (qualified names, semver cores, message ids, timestamps) are
 * REUSED from @epoch/agent-protocol — the pinned runtime dependency — never
 * re-implemented.
 */
import { z } from 'zod';
import { JsonValueSchema } from '@epoch/agent-protocol';

/** Lowercase hexadecimal SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** SHA-256 content digest as lowercase hex. */
export const Sha256HexSchema = z.string().regex(SHA256_HEX_PATTERN).meta({
  id: 'Sha256Hex',
  title: 'Sha256Hex',
  description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
});

/** SHA-256 digest string type. */
export type Sha256Hex = z.infer<typeof Sha256HexSchema>;

/**
 * Experience-node identifier: `xn-` + lowercase kebab slug. Experience-local
 * identity — never a kernel id (kernel objects are referenced opaquely via
 * projected references).
 */
export const EXPERIENCE_NODE_ID_PATTERN = /^xn-[a-z0-9][a-z0-9-]{0,62}$/;

export const ExperienceNodeIdSchema = z.string().regex(EXPERIENCE_NODE_ID_PATTERN).meta({
  id: 'ExperienceNodeId',
  title: 'ExperienceNodeId',
  description: 'Experience-local node identifier: "xn-" followed by a lowercase slug.',
});

/** One experience-node identifier. */
export type ExperienceNodeId = z.infer<typeof ExperienceNodeIdSchema>;

/**
 * Experience-graph identifier: `xg-` + lowercase kebab slug. Stable identity
 * of a graph across revisions; revisions are addressed by content digest.
 */
export const EXPERIENCE_GRAPH_ID_PATTERN = /^xg-[a-z0-9][a-z0-9-]{0,62}$/;

export const ExperienceGraphIdSchema = z.string().regex(EXPERIENCE_GRAPH_ID_PATTERN).meta({
  id: 'ExperienceGraphId',
  title: 'ExperienceGraphId',
  description: 'Experience-graph identifier: "xg-" followed by a lowercase slug.',
});

/** One experience-graph identifier. */
export type ExperienceGraphId = z.infer<typeof ExperienceGraphIdSchema>;

/**
 * Opaque scoping identifier (tenant, workspace, project, participant):
 * bounded, whitespace-free, provider-neutral. Tenancy semantics are owned
 * by W009; the experience protocol treats these as opaque strings and
 * enforces isolation by equality (R12).
 */
export const OPAQUE_SCOPE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const OpaqueScopeIdSchema = z.string().regex(OPAQUE_SCOPE_ID_PATTERN).meta({
  id: 'OpaqueScopeId',
  title: 'OpaqueScopeId',
  description: 'Opaque scoping identifier (tenant/workspace/project/participant); bounded, neutral charset.',
});

/** One opaque scoping identifier. */
export type OpaqueScopeId = z.infer<typeof OpaqueScopeIdSchema>;

/**
 * Tenant scoping of an experience document (R12): the tenant that owns the
 * projection, optionally narrowed to a workspace and project. Modeled on
 * the policy-contracts scope vocabulary (opaque exact-match strings).
 */
export const TenantScopeSchema = z
  .strictObject({
    tenantId: OpaqueScopeIdSchema,
    workspaceId: OpaqueScopeIdSchema.optional(),
    projectId: OpaqueScopeIdSchema.optional(),
  })
  .meta({
    id: 'TenantScope',
    title: 'TenantScope',
    description:
      'Tenant scoping of an experience document: owning tenant, optional workspace and project narrowing.',
  });

/** Tenant scoping of an experience document. */
export type TenantScope = z.infer<typeof TenantScopeSchema>;

/**
 * Canonical presentation color: `#RRGGBB` or `#RRGGBBAA` lowercase hex.
 * One canonical form keeps digests stable.
 */
export const COLOR_HEX_PATTERN = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;

export const ColorHexSchema = z.string().regex(COLOR_HEX_PATTERN).meta({
  id: 'ColorHex',
  title: 'ColorHex',
  description: 'Presentation color as lowercase hex: #RRGGBB or #RRGGBBAA.',
});

/** One presentation color. */
export type ColorHex = z.infer<typeof ColorHexSchema>;

/** Finite 3-component vector (neutral math; never an engine vector type). */
export const Vec3Schema = z
  .tuple([z.number().finite(), z.number().finite(), z.number().finite()])
  .meta({
    id: 'Vec3',
    title: 'Vec3',
    description: 'Finite 3-component numeric vector (x, y, z).',
  });

/** One 3-component vector. */
export type Vec3 = z.infer<typeof Vec3Schema>;

/** Finite unit-agnostic orientation quaternion (x, y, z, w). */
export const QuaternionSchema = z
  .tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
  ])
  .meta({
    id: 'Quaternion',
    title: 'Quaternion',
    description: 'Finite orientation quaternion (x, y, z, w); neutral math, renderer-normalized.',
  });

/** One orientation quaternion. */
export type Quaternion = z.infer<typeof QuaternionSchema>;

/**
 * Dotted property path of an animation target (e.g. `position.x`,
 * `style.fill.color`): kebab segments joined by single dots.
 */
export const PROPERTY_PATH_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

export const PropertyPathSchema = z.string().regex(PROPERTY_PATH_PATTERN).meta({
  id: 'PropertyPath',
  title: 'PropertyPath',
  description: 'Dotted path naming the animated property of a target node descriptor.',
});

/** One animation property path. */
export type PropertyPath = z.infer<typeof PropertyPathSchema>;

/** Maximum number of keys in a presentation-attribute record. */
export const MAX_ATTRIBUTE_KEYS = 32;

/**
 * Presentation-only attribute record attached to nodes and edges. Open-world
 * JSON data for renderer/presenter use. The admission pipeline REJECTS
 * kernel-reserved keys here with a typed `authority-violation` error (see
 * src/authority.ts): presentation attributes must never shadow or inline
 * kernel semantic vocabulary — kernel state is referenced opaquely.
 */
export const PresentationAttributesSchema = z
  .record(z.string().min(1).max(128), JsonValueSchema)
  .refine(
    (record) => Object.keys(record).length <= MAX_ATTRIBUTE_KEYS,
    `presentation attributes are limited to ${MAX_ATTRIBUTE_KEYS} keys`,
  )
  .meta({
    id: 'PresentationAttributes',
    title: 'PresentationAttributes',
    description:
      'Presentation-only open attribute record (never kernel semantics; reserved keys are rejected at admission).',
  });

/** One presentation-attribute record. */
export type PresentationAttributes = z.infer<typeof PresentationAttributesSchema>;
