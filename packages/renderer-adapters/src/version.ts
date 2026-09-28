/**
 * @epoch/renderer-adapters — contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors the experience-protocol discipline): a
 * serialized renderer-adapters document is admitted only when its
 * `protocolVersion` equals {@link RENDERER_ADAPTERS_PROTOCOL_VERSION}
 * exactly; skew surfaces as a typed `version-unsupported` admission error
 * (checked before any schema validation).
 * {@link RENDERER_ADAPTERS_CONTRACT_VERSION} versions the published
 * contract surface at `packages/renderer-adapters/schemas` (the
 * W007/W009/W015/W016 in-package convention).
 *
 * Provider neutrality (architecture lock rule 13): the technique
 * vocabulary names RENDERING TECHNIQUES — immediate vs retained
 * presentation, local vs remote execution, mono vs stereoscopic output —
 * never a vendor, engine, API, or framework. Concrete engines (any
 * graphics stack) remain future concrete adapters BEHIND this seam
 * (spec/experience-architecture.md "Rendering": "Renderer abstraction
 * permits other local/remote renderers").
 */
import { z } from 'zod';

/** Version of the published renderer-adapters contract surface (schemas/ + types). */
export const RENDERER_ADAPTERS_CONTRACT_VERSION = '1.0.0' as const;

/** Protocol version carried by every serialized renderer-adapters document. */
export const RENDERER_ADAPTERS_PROTOCOL_VERSION = '1.0.0' as const;

/** The protocol version literal type. */
export type RendererAdaptersProtocolVersion = typeof RENDERER_ADAPTERS_PROTOCOL_VERSION;

export const RendererAdaptersProtocolVersionSchema = z
  .literal(RENDERER_ADAPTERS_PROTOCOL_VERSION)
  .meta({
    id: 'RendererAdaptersProtocolVersion',
    title: 'RendererAdaptersProtocolVersion',
    description: 'Exact renderer-adapters protocol version admitted by this release ("1.0.0").',
  });

/** Schema-name discriminator of the sealed adapter-selection record. */
export const RENDERER_ADAPTER_SELECTION_SCHEMA_NAME = 'epoch.renderer-adapter-selection' as const;

/** Schema-name discriminator of the sealed mount-plan record. */
export const RENDERER_MOUNT_PLAN_SCHEMA_NAME = 'epoch.renderer-mount-plan' as const;

/**
 * The document kinds of renderer-adapters v1 (manifest inventory; each
 * kind is a distinct serialized document with its own discriminator).
 */
export const RENDERER_ADAPTERS_DOCUMENT_KINDS = [
  'renderer-adapters.adapter-descriptor',
  'renderer-adapters.mount-plan',
  'renderer-adapters.selection',
] as const;

/** One renderer-adapters document kind. */
export type RendererAdaptersDocumentKind = (typeof RENDERER_ADAPTERS_DOCUMENT_KINDS)[number];

/**
 * The neutral renderer TECHNIQUE vocabulary — the provider-neutral seam
 * the W013 renderer-runtime pin reserved for this Work Order ("concrete
 * engines are future adapters behind the descriptor contract"):
 *
 * - `immediate-2d` — flat presentation in immediate mode (2D, controls,
 *   narrative, timeline/replay graphs);
 * - `retained-scene-3d` — retained scene graph hosting every graph kind,
 *   mono output (the reduced-3D path pairs with progressive-scene
 *   degradation);
 * - `stereoscopic-compositor` — stereoscopic spatial hosting (headsets,
 *   stereo walls);
 * - `remote-stream` — remote rendering with streamed results (the frozen
 *   "remote rendering = optional" row of the device-adaptation table).
 */
export const RENDERER_TECHNIQUES = [
  'immediate-2d',
  'remote-stream',
  'retained-scene-3d',
  'stereoscopic-compositor',
] as const;

/** One renderer technique. */
export type RendererTechnique = (typeof RENDERER_TECHNIQUES)[number];

export const RendererTechniqueSchema = z.enum(RENDERER_TECHNIQUES).meta({
  id: 'RendererTechnique',
  title: 'RendererTechnique',
  description:
    'Neutral renderer technique: immediate-2d, remote-stream, retained-scene-3d, or stereoscopic-compositor (a technique, never a vendor/engine).',
});

/** Where a technique executes. */
export const TECHNIQUE_EXECUTION_CLASSES = ['local', 'remote'] as const;

/** One technique execution class. */
export type TechniqueExecutionClass = (typeof TECHNIQUE_EXECUTION_CLASSES)[number];

export const TechniqueExecutionClassSchema = z.enum(TECHNIQUE_EXECUTION_CLASSES).meta({
  id: 'TechniqueExecutionClass',
  title: 'TechniqueExecutionClass',
  description: 'Where a renderer technique executes: locally on the device, or remotely with streamed results.',
});

/**
 * The typed selection-reason vocabulary — why the deterministic selection
 * chose a technique (the decision trace is data, never prose):
 * - `remote-assist-recommended` — the device assessment recommends the
 *   optional remote path (declared budgets below the reduced floors);
 * - `stereoscopic-negotiated` — the binding negotiated stereoscopic
 *   output, and the compositor hosts the effective kinds;
 * - `spatial-kinds-local` — spatial graph kinds are hosted locally;
 * - `spatial-kinds-local-degraded` — spatial kinds on a reduced-tier
 *   device: local retained hosting paired with progressive-scene
 *   degradation (the frozen "low capability = 2D/reduced 3D" row);
 * - `flat-kinds` — only flat graph kinds are hosted;
 * - `local-technique-unavailable` — no local technique hosts the
 *   effective kinds; the optional remote path is the fallback.
 */
export const SELECTION_REASONS = [
  'flat-kinds',
  'local-technique-unavailable',
  'remote-assist-recommended',
  'spatial-kinds-local',
  'spatial-kinds-local-degraded',
  'stereoscopic-negotiated',
] as const;

/** One selection reason. */
export type SelectionReason = (typeof SELECTION_REASONS)[number];

export const SelectionReasonSchema = z.enum(SELECTION_REASONS).meta({
  id: 'SelectionReason',
  title: 'SelectionReason',
  description: 'Typed reason the deterministic adapter selection chose a technique.',
});

/**
 * The typed eligibility-rejection vocabulary — why one candidate
 * technique was rejected in the decision trace:
 * - `kind-not-hosted` — the technique does not host every effective
 *   graph kind;
 * - `stereoscopic-unsupported` — the binding negotiated stereoscopic
 *   output and the technique is mono;
 * - `stereoscopic-unmatched` — the technique is stereoscopic but the
 *   binding did not negotiate stereo output (never a silent upgrade);
 * - `not-preferred` — eligible, but a more preferred technique won.
 */
export const ELIGIBILITY_REASONS = [
  'kind-not-hosted',
  'not-preferred',
  'stereoscopic-unmatched',
  'stereoscopic-unsupported',
] as const;

/** One eligibility reason. */
export type EligibilityReason = (typeof ELIGIBILITY_REASONS)[number];

export const EligibilityReasonSchema = z.enum(ELIGIBILITY_REASONS).meta({
  id: 'EligibilityReason',
  title: 'EligibilityReason',
  description: 'Typed eligibility verdict of one candidate technique in the selection decision trace.',
});

/**
 * The typed admission-error taxonomy of the renderer-adapters kernel:
 * - `version-unsupported` — protocolVersion skew, checked first;
 * - `malformed-record` — schema violations with precise dotted paths;
 * - `digest-mismatch` — a sealed record whose claimed digest does not
 *   match its content (tamper detection);
 * - `cross-tenant-denied` — a binding/selection scoped to another
 *   tenant (R12);
 * - `assessment-device-mismatch` — the supplied assessment does not
 *   assess the binding's device descriptor (the decision inputs must be
 *   about the same device);
 * - `no-eligible-technique` — no technique hosts the binding's effective
 *   graph kinds (not even the remote path).
 */
export const RENDERER_ADAPTERS_ERROR_CODES = [
  'assessment-device-mismatch',
  'cross-tenant-denied',
  'digest-mismatch',
  'malformed-record',
  'no-eligible-technique',
  'version-unsupported',
] as const;

/** One typed admission-error code. */
export type RendererAdaptersErrorCode = (typeof RENDERER_ADAPTERS_ERROR_CODES)[number];

export const RendererAdaptersErrorCodeSchema = z
  .enum(RENDERER_ADAPTERS_ERROR_CODES)
  .meta({
    id: 'RendererAdaptersErrorCode',
    title: 'RendererAdaptersErrorCode',
    description: 'Typed admission-error code of the renderer-adapters kernel.',
  });

// ---------------------------------------------------------------------------
// The adaptation-event vocabulary over the W010 shapes (devDep parity).
// ---------------------------------------------------------------------------

/** The event namespace of the adaptation-event family (open namespace). */
export const ADAPTER_EVENT_NAMESPACE = 'renderer-adapter' as const;

/** The record version of the mirrored W010 event shapes. */
export const ADAPTER_EVENT_RECORD_VERSION = 1 as const;

/**
 * The adaptation-event discriminators (the `renderer-adapter:*` open
 * namespace over the W010 event shapes):
 * - `renderer-adapter:technique-selected` — one adapter selection became
 *   a fact (who chose what technique for which session, on which exact
 *   binding/assessment revisions);
 * - `renderer-adapter:mount-planned` — one mount plan became a fact
 *   (which technique will mount which content revision with which
 *   declared usage).
 */
export const ADAPTER_EVENT_DISCRIMINATORS = [
  'renderer-adapter:mount-planned',
  'renderer-adapter:technique-selected',
] as const;

/** One adaptation-event discriminator. */
export type AdapterEventDiscriminator = (typeof ADAPTER_EVENT_DISCRIMINATORS)[number];

export const AdapterEventDiscriminatorSchema = z.enum(ADAPTER_EVENT_DISCRIMINATORS).meta({
  id: 'AdapterEventDiscriminator',
  title: 'AdapterEventDiscriminator',
  description: 'Typed discriminator of one renderer-adapter adaptation event (the W010 open namespace).',
});

/** Mirrored W010 stream-id grammar (`stream:<slug>`). */
export const ADAPTER_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/** Mirrored W010 actor grammar (`principal:<slug>` — the W009 grammar). */
export const ADAPTER_ACTOR_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** Mirrored W010 tenant grammar (`tenant:<slug>` — the W009 grammar). */
export const ADAPTER_TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;

/** Mirrored W010 timestamp grammar ( millisecond-precision UTC ISO). */
export const ADAPTER_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Upper bound on trace entries per selection (DoS discipline). */
export const MAX_SELECTION_TRACE_ENTRIES = RENDERER_TECHNIQUES.length;
