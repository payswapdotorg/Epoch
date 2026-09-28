/**
 * @epoch/progressive-scene — contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors the experience-protocol discipline): a
 * serialized progressive-scene document is admitted only when its
 * `protocolVersion` equals {@link PROGRESSIVE_SCENE_PROTOCOL_VERSION}
 * exactly; skew surfaces as a typed `version-unsupported` admission error
 * (checked before any schema validation).
 * {@link PROGRESSIVE_SCENE_CONTRACT_VERSION} versions the published
 * contract surface at `packages/progressive-scene/schemas` (the
 * W007/W009/W015/W016 in-package convention).
 *
 * Provider neutrality (architecture lock rule 13): every vocabulary below
 * names a STAGE, REDUCTION, or BOUNDARY — never a vendor, engine,
 * renderer, framework, or API.
 */
import { z } from 'zod';

/** Version of the published progressive-scene contract surface (schemas/ + types). */
export const PROGRESSIVE_SCENE_CONTRACT_VERSION = '1.0.0' as const;

/** Protocol version carried by every serialized progressive-scene document. */
export const PROGRESSIVE_SCENE_PROTOCOL_VERSION = '1.0.0' as const;

/** The protocol version literal type. */
export type ProgressiveSceneProtocolVersion = typeof PROGRESSIVE_SCENE_PROTOCOL_VERSION;

export const ProgressiveSceneProtocolVersionSchema = z
  .literal(PROGRESSIVE_SCENE_PROTOCOL_VERSION)
  .meta({
    id: 'ProgressiveSceneProtocolVersion',
    title: 'ProgressiveSceneProtocolVersion',
    description: 'Exact progressive-scene protocol version admitted by this release ("1.0.0").',
  });

/** Schema-name discriminator of the sealed progressive-scene ladder record. */
export const PROGRESSIVE_SCENE_LADDER_SCHEMA_NAME = 'epoch.progressive-scene-ladder' as const;

/** Schema-name discriminator of a scene-fit verdict. */
export const SCENE_FIT_SCHEMA_NAME = 'epoch.progressive-scene-fit' as const;

/**
 * The document kinds of progressive-scene v1 (manifest inventory; each
 * kind is a distinct serialized document with its own discriminator).
 */
export const PROGRESSIVE_SCENE_DOCUMENT_KINDS = [
  'progressive-scene.fit',
  'progressive-scene.ladder',
] as const;

/** One progressive-scene document kind. */
export type ProgressiveSceneDocumentKind = (typeof PROGRESSIVE_SCENE_DOCUMENT_KINDS)[number];

/**
 * The canonical reduction-stage kinds, in canonical order (the ladder
 * derivation applies them in this exact sequence; a stage that would
 * change nothing is skipped — never an empty rung):
 *
 * 1. `drop-animation-clips` — animation is the most expendable
 *    presentation aspect (the W016 mobile/low fidelity discipline);
 * 2. `substitute-mesh-proxies` — opaque content-addressed mesh assets
 *    become neutral box proxies (drops the mesh bindings: texture relief);
 * 3. `downgrade-expensive-primitives` — high-estimate primitives
 *    (spheres) become box proxies (the classic geometry LOD step);
 * 4-7. `prune-presence-cursors` / `prune-presence-seats` /
 *    `prune-timeline-markers` / `prune-timeline-tracks` — supplementary
 *    presentation aspects, most peripheral first;
 * 8. `prune-spatial-nodes` — the 3D→2D fallback (the frozen "low
 *    capability = 2D/reduced" row);
 * 9. `prune-shape-nodes` — 2D geometry itself;
 * 10. `prune-control-nodes` — interaction affordances;
 * 11. `prune-to-minimal-core` — nodes (canonical ascending id) until
 *     exactly one remains (labels/narrative beats survive longest by
 *     stage order).
 */
export const REDUCTION_STAGE_KINDS = [
  'downgrade-expensive-primitives',
  'drop-animation-clips',
  'prune-control-nodes',
  'prune-presence-cursors',
  'prune-presence-seats',
  'prune-shape-nodes',
  'prune-spatial-nodes',
  'prune-timeline-markers',
  'prune-timeline-tracks',
  'prune-to-minimal-core',
  'substitute-mesh-proxies',
] as const;

/** One reduction-stage kind. */
export type ReductionStageKind = (typeof REDUCTION_STAGE_KINDS)[number];

export const ReductionStageKindSchema = z.enum(REDUCTION_STAGE_KINDS).meta({
  id: 'ReductionStageKind',
  title: 'ReductionStageKind',
  description:
    'Typed reduction stage of the progressive-scene ladder (canonical order: animation first, geometry proxies next, supplementary nodes, then the 2D fallback, then the minimal core).',
});

/** The canonical stage order (the derivation sequence). */
export const CANONICAL_STAGE_ORDER: readonly ReductionStageKind[] = [
  'drop-animation-clips',
  'substitute-mesh-proxies',
  'downgrade-expensive-primitives',
  'prune-presence-cursors',
  'prune-presence-seats',
  'prune-timeline-markers',
  'prune-timeline-tracks',
  'prune-spatial-nodes',
  'prune-shape-nodes',
  'prune-control-nodes',
  'prune-to-minimal-core',
];

/**
 * The typed admission-error taxonomy of the progressive-scene kernel:
 * - `version-unsupported` — protocolVersion skew, checked first;
 * - `malformed-record` — schema violations with precise dotted paths;
 * - `digest-mismatch` — a sealed ladder/fit whose claimed digest does
 *   not match its content (tamper detection);
 * - `cross-tenant-denied` — a graph or ladder scoped to another tenant
 *   (R12 — the projection boundary is the tenant);
 * - `unfittable-scene` — even the minimal-core rung exceeds the target
 *   budgets (the typed honest answer, never a silent clamp);
 * - `invalid-rung-index` — a rung index outside the derived ladder.
 */
export const PROGRESSIVE_SCENE_ERROR_CODES = [
  'cross-tenant-denied',
  'digest-mismatch',
  'invalid-rung-index',
  'malformed-record',
  'unfittable-scene',
  'version-unsupported',
] as const;

/** One typed admission-error code. */
export type ProgressiveSceneErrorCode = (typeof PROGRESSIVE_SCENE_ERROR_CODES)[number];

export const ProgressiveSceneErrorCodeSchema = z
  .enum(PROGRESSIVE_SCENE_ERROR_CODES)
  .meta({
    id: 'ProgressiveSceneErrorCode',
    title: 'ProgressiveSceneErrorCode',
    description: 'Typed admission-error code of the progressive-scene kernel.',
  });

/**
 * The cheapest neutral primitive (the proxy target of geometry
 * substitution stages). 12 triangles — the floor of the mirrored W012
 * estimate table.
 */
export const PROXY_PRIMITIVE = 'box' as const;

/** Maximum rungs per ladder (the canonical stage count + rung 0; DoS discipline). */
export const MAX_LADDER_RUNGS = CANONICAL_STAGE_ORDER.length + 1;
