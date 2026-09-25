/**
 * @epoch/world-experience — contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors the experience-protocol /
 * experience-compiler / renderer-runtime discipline): a serialized world
 * document (scene, intent, ontology record, or fidelity projection) is
 * admitted only when its `protocolVersion` equals
 * {@link WORLD_EXPERIENCE_PROTOCOL_VERSION} exactly; skew surfaces as a
 * typed `version-unsupported` error (checked before any schema validation,
 * so version skew is always distinguishable from malformed payloads).
 * {@link WORLD_EXPERIENCE_CONTRACT_VERSION} versions the published
 * contract surface at `packages/world-experience/schemas` (the W007/W009
 * in-package convention).
 *
 * Provider neutrality (architecture lock rule 13): every vocabulary below
 * names a ROLE, STATE, or BOUNDARY — never a vendor, engine, renderer,
 * framework, or API. The world experience layer is a typed projection of
 * the same world used by humans and agents (spec/experience-architecture
 * "Experience Goal" — binding); it never embeds a concrete engine and
 * never becomes a second world state (lock rule 8).
 */
import { z } from 'zod';

/** Version of the published world-experience contract surface (schemas/ + types). */
export const WORLD_EXPERIENCE_CONTRACT_VERSION = '1.0.0' as const;

/** Protocol version carried by every serialized world document. */
export const WORLD_EXPERIENCE_PROTOCOL_VERSION = '1.0.0' as const;

/** The protocol version literal type. */
export type WorldExperienceProtocolVersion = typeof WORLD_EXPERIENCE_PROTOCOL_VERSION;

export const WorldExperienceProtocolVersionSchema = z
  .literal(WORLD_EXPERIENCE_PROTOCOL_VERSION)
  .meta({
    id: 'WorldExperienceProtocolVersion',
    title: 'WorldExperienceProtocolVersion',
    description: 'Exact world-experience protocol version admitted by this release ("1.0.0").',
  });

/** Schema-name discriminator carried by every world scene document. */
export const WORLD_SCENE_SCHEMA_NAME = 'epoch.world-scene' as const;

/** Schema-name discriminator carried by every interaction-intent document. */
export const WORLD_INTENT_SCHEMA_NAME = 'epoch.world-intent' as const;

/** Schema-name discriminator carried by every ontology record. */
export const WORLD_ONTOLOGY_SCHEMA_NAME = 'epoch.world-ontology-record' as const;

/** Schema-name discriminator carried by every fidelity projection. */
export const WORLD_FIDELITY_SCHEMA_NAME = 'epoch.world-fidelity-projection' as const;

/**
 * The document kinds of world-experience v1 (manifest inventory; each kind
 * is a distinct serialized document with its own schema discriminator).
 */
export const WORLD_EXPERIENCE_DOCUMENT_KINDS = [
  'world.fidelity-projection',
  'world.intent',
  'world.ontology-record',
  'world.scene',
] as const;

/** One world-experience document kind. */
export type WorldExperienceDocumentKind = (typeof WORLD_EXPERIENCE_DOCUMENT_KINDS)[number];

export const WorldExperienceDocumentKindSchema = z
  .enum(WORLD_EXPERIENCE_DOCUMENT_KINDS)
  .meta({
    id: 'WorldExperienceDocumentKind',
    title: 'WorldExperienceDocumentKind',
    description: 'The document kinds the world experience layer publishes.',
  });

/** Version discriminator of the world-subset interaction-intent vocabulary. */
export const WORLD_INTENT_VERSION = 1 as const;

/**
 * The typed world-experience error taxonomy. Every admission, lifecycle,
 * projection, or compilation failure is one of these codes (never a bare
 * throw):
 * - `version-unsupported` — protocolVersion/intentVersion/ontologyVersion
 *   skew, checked first;
 * - `malformed-record` — schema/structure violations with precise dotted
 *   paths (strict objects also reject unknown/vendor fields here);
 * - `digest-mismatch` — a sealed scene whose claimed SHA-256 digest does
 *   not match its content (tamper detection);
 * - `unknown-scene-reference` — a scene-internal reference (focus target,
 *   entity, agent, overlay binding) that does not resolve;
 * - `cross-tenant-denied` — a scene, reference, or operation outside the
 *   owning tenant (R12);
 * - `invalid-intent` — a malformed or unknown interaction intent (unknown
 *   kind, invalid parameters);
 * - `unknown-overlay-reference` — an applied overlay that is not declared
 *   in the scene's overlay library;
 * - `unknown-ontology-record` — an ontology record reference that does not
 *   resolve, or a record whose discriminator is not in the closed
 *   vocabulary;
 * - `budget-exceeded` — scene usage beyond the W013 renderer descriptor
 *   budgets (typed rejection, never silent degradation);
 * - `executable-ui-rejected` — an intent that smuggles executable UI
 *   content (script/code/bytecode keys) — the Dynamic UI law: agents emit
 *   typed intents, never arbitrary executable UI code;
 * - `invalid-replay-position` — a timeline/replay position outside the
 *   scene's timeline bounds, or a non-monotonic replay window;
 * - `unknown-evidence-reference` — an evidence digest referenced by
 *   narrative/overlay content that is not in the scene's declared evidence
 *   set.
 */
export const WORLD_EXPERIENCE_ERROR_CODES = [
  'budget-exceeded',
  'cross-tenant-denied',
  'digest-mismatch',
  'executable-ui-rejected',
  'invalid-intent',
  'invalid-replay-position',
  'malformed-record',
  'unknown-evidence-reference',
  'unknown-ontology-record',
  'unknown-overlay-reference',
  'unknown-scene-reference',
  'version-unsupported',
] as const;

/** One typed world-experience error code. */
export type WorldExperienceErrorCode = (typeof WORLD_EXPERIENCE_ERROR_CODES)[number];

export const WorldExperienceErrorCodeSchema = z
  .enum(WORLD_EXPERIENCE_ERROR_CODES)
  .meta({
    id: 'WorldExperienceErrorCode',
    title: 'WorldExperienceErrorCode',
    description: 'Typed error code of the world experience layer.',
  });

/**
 * The world-subset interaction-intent vocabulary — the universal
 * interactions (spec/experience-architecture, binding) whose home is the
 * interactive world view. The action/collaboration interactions (approve,
 * reject, execute, take-control, release-control) belong to the action and
 * collaboration surfaces, NOT to the world subset, and are therefore
 * absent here by design.
 */
export const WORLD_INTERACTION_KINDS = [
  'annotate',
  'branch',
  'change',
  'compare',
  'connect',
  'disconnect',
  'filter',
  'follow-agent',
  'hide',
  'inspect',
  'isolate',
  'measure',
  'move',
  'pause',
  'query',
  'replay',
  'resume',
  'rotate',
  'select',
  'show',
  'simulate',
  'zoom',
] as const;

/** One world interaction kind. */
export type WorldInteractionKind = (typeof WORLD_INTERACTION_KINDS)[number];

export const WorldInteractionKindSchema = z.enum(WORLD_INTERACTION_KINDS).meta({
  id: 'WorldInteractionKind',
  title: 'WorldInteractionKind',
  description:
    'One world-subset universal interaction (select, inspect, measure, move, rotate, zoom, isolate, hide, show, compare, annotate, simulate, change, connect, disconnect, filter, query, branch, replay, pause, resume, follow-agent).',
});

/**
 * The qualified-id namespace of the typed ControlIntent each world
 * interaction maps to when compiled into a W013 submit-intent envelope
 * (R30 — shape-identical bridging, so the world control path needs no
 * translation layer).
 */
export const WORLD_INTENT_TYPE_NAMESPACE = 'epoch.world.interaction' as const;

/** Semver-core version of the world interaction ControlIntent bridge. */
export const WORLD_INTENT_TYPE_VERSION = '1.0.0' as const;

/**
 * The domain visual ontology record kinds (spec/experience-architecture
 * "Domain visual ontology" — binding): pack-contributable semantic
 * visualizations. Each kind carries its own strict descriptor record
 * (src/ontology.ts); every field is presentation-oriented,
 * provider-neutral data with a version discriminator.
 */
export const WORLD_ONTOLOGY_RECORD_KINDS = [
  'affordance',
  'animation',
  'material',
  'representation-3d',
  'state-overlay',
  'symbol-2d',
] as const;

/** One ontology record kind. */
export type WorldOntologyRecordKind = (typeof WORLD_ONTOLOGY_RECORD_KINDS)[number];

export const WorldOntologyRecordKindSchema = z.enum(WORLD_ONTOLOGY_RECORD_KINDS).meta({
  id: 'WorldOntologyRecordKind',
  title: 'WorldOntologyRecordKind',
  description:
    'One domain visual ontology record kind: 2D symbols, 3D representations, materials/textures, state overlays, animations, interaction affordances.',
});

/** Version discriminator of every ontology record. */
export const WORLD_ONTOLOGY_VERSION = 1 as const;

/**
 * The typed fidelity levels for device adaptation
 * (spec/experience-architecture "Device adaptation" — binding): same
 * semantics, different fidelity. `desktop` = full; `web` = normal;
 * `mobile` = field; `low` = 2D/reduced; `remote` = optional remote
 * rendering. Fidelity is a typed projection concern, never a semantic
 * one.
 */
export const WORLD_FIDELITY_LEVELS = ['desktop', 'low', 'mobile', 'remote', 'web'] as const;

/** One fidelity level. */
export type WorldFidelityLevel = (typeof WORLD_FIDELITY_LEVELS)[number];

export const WorldFidelityLevelSchema = z.enum(WORLD_FIDELITY_LEVELS).meta({
  id: 'WorldFidelityLevel',
  title: 'WorldFidelityLevel',
  description:
    'Typed device-adaptation fidelity level: desktop (full), web (normal), mobile (field), low (2D/reduced), remote (optional).',
});

/** The camera modes of a world scene (typed data, never an engine camera). */
export const WORLD_CAMERA_MODES = ['follow-agent', 'free', 'orbit'] as const;

/** One camera mode. */
export type WorldCameraMode = (typeof WORLD_CAMERA_MODES)[number];

export const WorldCameraModeSchema = z.enum(WORLD_CAMERA_MODES).meta({
  id: 'WorldCameraMode',
  title: 'WorldCameraMode',
  description: 'Camera mode of a world scene: orbit, free, or follow-agent.',
});

/**
 * The camera transition kinds — how one camera state moves to the next
 * (explicit transitions as typed data; a cut is instantaneous, a smooth
 * transition interpolates over its duration).
 */
export const WORLD_CAMERA_TRANSITION_KINDS = ['cut', 'smooth'] as const;

/** One camera transition kind. */
export type WorldCameraTransitionKind = (typeof WORLD_CAMERA_TRANSITION_KINDS)[number];

export const WorldCameraTransitionKindSchema = z.enum(WORLD_CAMERA_TRANSITION_KINDS).meta({
  id: 'WorldCameraTransitionKind',
  title: 'WorldCameraTransitionKind',
  description: 'Kind of an explicit camera transition: cut (instant) or smooth (interpolated).',
});

/** The visual overlay kinds a scene's overlay library can declare. */
export const WORLD_OVERLAY_KINDS = ['annotation', 'highlight', 'measurement', 'state'] as const;

/** One overlay kind. */
export type WorldOverlayKind = (typeof WORLD_OVERLAY_KINDS)[number];

export const WorldOverlayKindSchema = z.enum(WORLD_OVERLAY_KINDS).meta({
  id: 'WorldOverlayKind',
  title: 'WorldOverlayKind',
  description:
    'Visual overlay kind of a world scene: highlight, annotation, measurement, or state overlay.',
});

// ---------------------------------------------------------------------------
// Determinism bounds (DoS discipline; all limits are integers).
// ---------------------------------------------------------------------------

/** Upper bound on entities per scene (mirrors the W011 graph-node bound). */
export const MAX_SCENE_ENTITIES = 4096;

/** Upper bound on overlays in a scene's overlay library. */
export const MAX_SCENE_OVERLAYS = 256;

/** Upper bound on simultaneously applied overlays. */
export const MAX_APPLIED_OVERLAYS = 64;

/** Upper bound on animation instructions per scene. */
export const MAX_ANIMATION_INSTRUCTIONS = 128;

/** Upper bound on keyframes per animation instruction (W011 bound). */
export const MAX_INSTRUCTION_KEYFRAMES = 256;

/** Upper bound on narrative/status blocks per scene. */
export const MAX_NARRATIVE_BLOCKS = 256;

/** Upper bound on timeline markers per scene. */
export const MAX_TIMELINE_MARKERS = 512;

/** Upper bound on candidate/action controls per scene. */
export const MAX_SCENE_CONTROLS = 256;

/** Upper bound on presence participants per scene. */
export const MAX_SCENE_PARTICIPANTS = 128;

/** Upper bound on followable agent references per scene. */
export const MAX_SCENE_AGENTS = 64;

/** Upper bound on declared evidence references per scene. */
export const MAX_EVIDENCE_REFERENCES = 256;

/** Upper bound on focused entities per scene. */
export const MAX_FOCUSED_ENTITIES = 64;

/** Upper bound on tracks per ontology animation record (W011 bound). */
export const MAX_ONTOLOGY_ANIMATION_TRACKS = 128;

/** Upper bound on interactions declared by one affordance record. */
export const MAX_AFFORDANCE_INTERACTIONS = 22;

/** Upper bound on ontology records carried by one in-memory ontology. */
export const MAX_ONTOLOGY_RECORDS = 4096;

/** Upper bound on entity ids carried by one filter intent. */
export const MAX_FILTER_ENTITY_IDS = 512;
