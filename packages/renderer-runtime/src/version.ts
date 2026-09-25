/**
 * @epoch/renderer-runtime — contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors the agent-protocol / experience-protocol
 * discipline): a serialized renderer document (invocation envelope or
 * receipt) is admitted only when its `protocolVersion` equals
 * {@link RENDERER_PROTOCOL_VERSION} exactly; skew surfaces as a typed
 * `version-unsupported` error (checked before any schema validation).
 * {@link RENDERER_CONTRACT_VERSION} versions the published shared
 * contract surface at `contracts/renderers` (the W002-W004 convention).
 *
 * Provider neutrality (architecture lock rule 13): every vocabulary below
 * names a ROLE, SURFACE, or BOUNDARY — never a vendor, engine, renderer,
 * framework, or API. The renderer hosting surface is abstract typed data
 * (kind + capabilities + budgets); concrete engines (any graphics stack)
 * are FUTURE ADAPTERS behind the descriptor contract — zero engine
 * imports, zero GPU code, zero UI-framework dependencies ship here.
 */
import { z } from 'zod';

/** Version of the published renderer contract surface (contracts/renderers). */
export const RENDERER_CONTRACT_VERSION = '1.0.0' as const;

/** Protocol version carried by every serialized renderer document. */
export const RENDERER_PROTOCOL_VERSION = '1.0.0' as const;

/** The protocol version literal type. */
export type RendererProtocolVersion = typeof RENDERER_PROTOCOL_VERSION;

export const RendererProtocolVersionSchema = z
  .literal(RENDERER_PROTOCOL_VERSION)
  .meta({
    id: 'RendererProtocolVersion',
    title: 'RendererProtocolVersion',
    description: 'Exact renderer-runtime protocol version admitted by this release ("1.0.0").',
  });

/** Schema-name discriminator carried by every renderer binding record. */
export const RENDERER_BINDING_SCHEMA_NAME = 'epoch.renderer-binding' as const;

/** Schema-name discriminator carried by every invocation envelope. */
export const RENDERER_INVOCATION_SCHEMA_NAME = 'epoch.renderer-invocation' as const;

/** Schema-name discriminator carried by every renderer receipt. */
export const RENDERER_RECEIPT_SCHEMA_NAME = 'epoch.renderer-receipt' as const;

/**
 * The document kinds of renderer-runtime v1 (manifest inventory; each kind
 * is a distinct serialized document with its own schema discriminator).
 */
export const RENDERER_DOCUMENT_KINDS = [
  'renderer.binding',
  'renderer.descriptor',
  'renderer.invocation',
  'renderer.receipt',
] as const;

/** One renderer document kind. */
export type RendererDocumentKind = (typeof RENDERER_DOCUMENT_KINDS)[number];

/** Version discriminator of the abstract renderer descriptor. */
export const RENDERER_DESCRIPTOR_VERSION = 1 as const;

/**
 * The lifecycle states of a renderer session binding: `open` admits
 * invocations; `closed` is terminal.
 */
export const RENDERER_BINDING_STATES = ['closed', 'open'] as const;

/** One renderer-binding state. */
export type RendererBindingState = (typeof RENDERER_BINDING_STATES)[number];

export const RendererBindingStateSchema = z.enum(RENDERER_BINDING_STATES).meta({
  id: 'RendererBindingState',
  title: 'RendererBindingState',
  description: 'Lifecycle state of a renderer session binding: open (admits invocations) or closed (terminal).',
});

/**
 * The typed invocation kinds the hosting surface executes (the renderer
 * runtime EXECUTES plans, it never authors them):
 * - `mount-graph` — install/replace the render-ready state (a sealed W011
 *   Experience Graph, referenced by content digest);
 * - `advance-frame` — execute one frame against the mounted state at a
 *   virtual time;
 * - `submit-intent` — admit one typed control intent (R30) from a
 *   declared interaction modality.
 */
export const RENDERER_INVOCATION_KINDS = ['advance-frame', 'mount-graph', 'submit-intent'] as const;

/** One invocation kind. */
export type RendererInvocationKind = (typeof RENDERER_INVOCATION_KINDS)[number];

export const RendererInvocationKindSchema = z.enum(RENDERER_INVOCATION_KINDS).meta({
  id: 'RendererInvocationKind',
  title: 'RendererInvocationKind',
  description: 'Typed invocation kind executed by the renderer hosting surface.',
});

/**
 * The typed receipt kinds — one per invocation kind: the content-addressed
 * execution evidence of the hosting surface (R26 visible/replayable
 * activity).
 */
export const RENDERER_RECEIPT_KINDS = ['frame-receipt', 'intent-receipt', 'mount-receipt'] as const;

/** One receipt kind. */
export type RendererReceiptKind = (typeof RENDERER_RECEIPT_KINDS)[number];

export const RendererReceiptKindSchema = z.enum(RENDERER_RECEIPT_KINDS).meta({
  id: 'RendererReceiptKind',
  title: 'RendererReceiptKind',
  description: 'Typed receipt kind: the execution evidence of one admitted invocation.',
});

/**
 * The typed renderer-error taxonomy. Every admission or enforcement
 * failure is one of these codes (never a bare throw):
 * - `budget-exceeded` — a graph or declared usage beyond the effective
 *   limits of the binding (nodes, edges, triangles, texture bytes);
 * - `capability-denied` — use of a capability the binding does not
 *   declare (graph kind, interaction modality) — the W008 permission
 *   pattern applied to renderers: anything not declared is denied;
 * - `cross-tenant-denied` — a binding, graph, or operation outside the
 *   owning tenant (R12);
 * - `digest-mismatch` — a sealed record whose claimed digest does not
 *   match its content, or a mount envelope whose claimed graph digest does
 *   not match the supplied graph document (tamper detection);
 * - `invalid-invocation` — a semantic contract violation (non-monotonic
 *   frame index, missing declared usage against a bounded resource);
 * - `malformed-invocation` — invocation-envelope schema violations
 *   (strict objects reject unknown/vendor fields here), including wrapped
 *   W011 graph-admission failures carried as a typed `cause`;
 * - `malformed-record` — descriptor/binding/receipt schema violations;
 * - `session-closed` — an invocation (or close) on a closed binding;
 * - `unknown-session` — an envelope targeting a different renderer
 *   session than the binding's;
 * - `version-unsupported` — protocolVersion skew, checked first.
 */
export const RENDERER_ERROR_CODES = [
  'budget-exceeded',
  'capability-denied',
  'cross-tenant-denied',
  'digest-mismatch',
  'invalid-invocation',
  'malformed-invocation',
  'malformed-record',
  'session-closed',
  'unknown-session',
  'version-unsupported',
] as const;

/** One typed renderer-error code. */
export type RendererErrorCode = (typeof RENDERER_ERROR_CODES)[number];

export const RendererErrorCodeSchema = z.enum(RENDERER_ERROR_CODES).meta({
  id: 'RendererErrorCode',
  title: 'RendererErrorCode',
  description: 'Typed renderer-error code of the renderer hosting surface.',
});

// ---------------------------------------------------------------------------
// Determinism bounds (DoS discipline; all limits are integers).
// ---------------------------------------------------------------------------

/** Ceiling on a renderer's declared per-graph node budget. */
export const MAX_RENDERER_GRAPH_NODES = 65_536;

/** Ceiling on a renderer's declared per-graph edge budget. */
export const MAX_RENDERER_GRAPH_EDGES = 131_072;

/** Ceiling on a renderer's declared per-frame triangle budget. */
export const MAX_RENDERER_TRIANGLES = 100_000_000;

/** Ceiling on a renderer's declared texture-memory budget (1 TiB). */
export const MAX_RENDERER_TEXTURE_BYTES = 1_099_511_627_776;

/** Ceiling on a renderer's declared output pixel budget. */
export const MAX_RENDERER_OUTPUT_PIXELS = 268_435_456;

/** Ceiling on a renderer's declared refresh rate (Hz). */
export const MAX_RENDERER_REFRESH_HZ = 1_000;

/** Ceiling on a renderer's declared color depth (bits per channel). */
export const MAX_RENDERER_COLOR_DEPTH_BITS = 64;
