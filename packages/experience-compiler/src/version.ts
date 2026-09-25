/**
 * @epoch/experience-compiler — contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors the agent-protocol / experience-protocol
 * discipline): a serialized Render Plan is admitted only when its
 * `protocolVersion` equals {@link RENDER_PLAN_PROTOCOL_VERSION} exactly;
 * skew surfaces as a typed `version-unsupported` compiler error (checked
 * before any schema validation, so version skew is always distinguishable
 * from malformed payloads). {@link EXPERIENCE_COMPILER_CONTRACT_VERSION}
 * versions the published contract surface at `contracts/experience-compiler`
 * (the W002-W004 shared-contract convention).
 *
 * Provider neutrality (architecture lock rule 13): every vocabulary below
 * names a ROLE, STAGE, or BOUNDARY — never a vendor, engine, renderer,
 * framework, or API. The compiler emits typed plan data only; concrete
 * engines stay behind the W013/W019 adapter boundary.
 */
import { z } from 'zod';
import type { ExperienceGraphKind, SpatialPrimitive } from '@epoch/experience-protocol';

/** Version of the published compiler contract surface (contracts/experience-compiler). */
export const EXPERIENCE_COMPILER_CONTRACT_VERSION = '1.0.0' as const;

/** Protocol version carried by every serialized Render Plan document. */
export const RENDER_PLAN_PROTOCOL_VERSION = '1.0.0' as const;

/** The protocol version literal type. */
export type RenderPlanProtocolVersion = typeof RENDER_PLAN_PROTOCOL_VERSION;

export const RenderPlanProtocolVersionSchema = z
  .literal(RENDER_PLAN_PROTOCOL_VERSION)
  .meta({
    id: 'RenderPlanProtocolVersion',
    title: 'RenderPlanProtocolVersion',
    description: 'Exact render-plan protocol version admitted by this release ("1.0.0").',
  });

/** Schema-name discriminator carried by every Render Plan. */
export const RENDER_PLAN_SCHEMA_NAME = 'epoch.render-plan' as const;

/**
 * The document kinds of the experience compiler v1 (manifest inventory).
 * The compiler consumes W011 `experience.graph` envelopes and emits
 * `experience.render-plan` documents.
 */
export const EXPERIENCE_COMPILER_DOCUMENT_KINDS = ['experience.render-plan'] as const;

/** One experience-compiler document kind. */
export type ExperienceCompilerDocumentKind = (typeof EXPERIENCE_COMPILER_DOCUMENT_KINDS)[number];

export const ExperienceCompilerDocumentKindSchema = z
  .literal(EXPERIENCE_COMPILER_DOCUMENT_KINDS[0])
  .meta({
    id: 'ExperienceCompilerDocumentKind',
    title: 'ExperienceCompilerDocumentKind',
    description: 'The document kind the experience compiler emits: the Render Plan.',
  });

/**
 * The typed compiler-error taxonomy. Every compile or plan-admission failure
 * is one of these codes (never a bare throw):
 * - `version-unsupported` — envelope or device-descriptor version skew,
 *   checked before schema validation;
 * - `malformed-descriptor` — schema/structure violations with precise
 *   dotted paths (strict objects also reject unknown/vendor fields here);
 * - `digest-mismatch` — a sealed envelope or plan whose claimed SHA-256
 *   digest does not match its content (tamper detection; inherited from the
 *   reused W011 admission discipline);
 * - `cross-tenant-denied` — a compile or admission request outside the
 *   tenant that owns the projection (R12);
 * - `unknown-reference` — a reference to kernel state or plan content that
 *   does not resolve;
 * - `authority-violation` — kernel semantic vocabulary or vendor/engine
 *   field smuggled where it does not belong (lock rules 8/13);
 * - `device-budget-exceeded` — device-shaped plan constraints exceeded by
 *   the compiled content (typed rejection, never silent degradation).
 */
export const EXPERIENCE_COMPILER_ERROR_CODES = [
  'version-unsupported',
  'malformed-descriptor',
  'digest-mismatch',
  'cross-tenant-denied',
  'unknown-reference',
  'authority-violation',
  'device-budget-exceeded',
] as const;

/** One typed compiler-error code. */
export type ExperienceCompilerErrorCode = (typeof EXPERIENCE_COMPILER_ERROR_CODES)[number];

export const ExperienceCompilerErrorCodeSchema = z
  .enum(EXPERIENCE_COMPILER_ERROR_CODES)
  .meta({
    id: 'ExperienceCompilerErrorCode',
    title: 'ExperienceCompilerErrorCode',
    description: 'Typed compile/admission-error code of the experience compiler.',
  });

/**
 * The plan stage kinds — the deterministic compilation pipeline stages a
 * Render Plan carries (in this fixed canonical order). A plan contains
 * exactly the stages its graph kind's table permits and only the stages
 * that have content.
 */
export const PLAN_STAGE_KINDS = [
  'relate',
  'draw-2d',
  'place-3d',
  'animate',
  'narrate',
  'timeline',
  'presence',
  'controls',
] as const;

/** One plan stage kind. */
export type PlanStageKind = (typeof PLAN_STAGE_KINDS)[number];

export const PlanStageKindSchema = z.enum(PLAN_STAGE_KINDS).meta({
  id: 'PlanStageKind',
  title: 'PlanStageKind',
  description: 'One deterministic compilation stage of a Render Plan.',
});

/**
 * Which stage kinds are legal within each source graph kind (the compile
 * table — mirrors the W011 GRAPH_KIND_NODE_KINDS discipline so a plan for a
 * graph kind cannot silently grow foreign stages).
 */
export const PLAN_KIND_STAGE_KINDS: Readonly<
  Record<ExperienceGraphKind, readonly PlanStageKind[]>
> = {
  '2d': ['relate', 'draw-2d'],
  '3d': ['relate', 'place-3d'],
  animation: ['relate', 'draw-2d', 'place-3d', 'animate'],
  narrative: ['relate', 'narrate'],
  'timeline-replay': ['relate', 'timeline'],
  presence: ['relate', 'presence'],
  controls: ['relate', 'controls'],
};

/**
 * Deterministic per-primitive triangle estimates used ONLY for device
 * triangle-budget enforcement and downstream declared usage. These are
 * conservative budget estimates over the neutral mathematical primitives —
 * NOT render truth (a real adapter tessellates differently); `mesh` assets
 * are opaque and contribute zero to the primitive estimate (their bytes are
 * accounted in `assetBytes` instead).
 */
export const PRIMITIVE_TRIANGLE_ESTIMATES: Readonly<Record<SpatialPrimitive, number>> = {
  box: 12,
  cone: 2,
  cylinder: 4,
  mesh: 0,
  plane: 2,
  sphere: 1280,
};

// ---------------------------------------------------------------------------
// Determinism bounds (DoS discipline; all limits are integers).
// ---------------------------------------------------------------------------

/** Ceiling on stages per plan (the fixed pipeline length). */
export const MAX_PLAN_STAGES = PLAN_STAGE_KINDS.length;

/** Ceiling on ops per non-relate stage (mirrors MAX_GRAPH_NODES). */
export const MAX_PLAN_STAGE_OPS = 4096;

/** Ceiling on relations in the relate stage (mirrors MAX_GRAPH_EDGES). */
export const MAX_PLAN_RELATIONS = 8192;

/** Ceiling on flattened animation bindings per plan. */
export const MAX_PLAN_ANIMATION_BINDINGS = 131_072;

/** Ceiling on projected source references carried by a plan (W011 bound). */
export const MAX_PLAN_SOURCE_REFS = 512;

/** Ceiling on anchor targets per label op. */
export const MAX_PLAN_ANCHORS_PER_OP = 16;
