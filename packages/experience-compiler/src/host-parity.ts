/**
 * COMPILE-TIME DOWNSTREAM/UPSTREAM PARITY (devDependencies only — the
 * W011 kernel-parity precedent applied to the W012 boundary packages).
 *
 * This file pins structural compatibility between the compiled plan and
 * its two pinned neighbors WITHOUT adding runtime dependencies:
 *
 * - `@epoch/world-model` (W002, upstream): the plan's projected world
 *   references carry the canonical world-model entity/event id types —
 *   if the world model's id grammars change, this file fails to compile
 *   and the runtime parity test (test/world-parity.test.ts) fails;
 * - `@epoch/renderer-runtime` (W013, downstream): the plan's usage
 *   accounting and digest chain are member-compatible with the renderer
 *   hosting surface's mount-graph declared usage and graph-digest
 *   fields, so the plans this compiler emits feed the renderer's
 *   binding/invocation surfaces with no translation layer.
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependencies into every downstream consumer's compile graph. It
 * is compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests (test/world-parity.test.ts,
 * test/renderer-parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type {
  ExperienceGraphKind,
  ProjectedWorldEntityRef,
  ProjectedWorldEventRef,
  RenderPlan,
  RenderPlanUsage,
} from './index';
import type { EntityId, EventId } from '@epoch/world-model';
import type {
  ExperienceGraphKind as RendererGraphKind,
  MountGraphEnvelope,
} from '@epoch/renderer-runtime';

// ---------------------------------------------------------------------------
// Upstream parity: @epoch/world-model (W002).
// ---------------------------------------------------------------------------

/** Plan world-entity references carry the world-model entity id type. */
export type PlanEntityIdParity = Expect<
  Equals<ProjectedWorldEntityRef['entityId'], EntityId>
>;

/** Plan world-event references carry the world-model event id type. */
export type PlanEventIdParity = Expect<Equals<ProjectedWorldEventRef['eventId'], EventId>>;

// ---------------------------------------------------------------------------
// Downstream parity: @epoch/renderer-runtime (W013).
// ---------------------------------------------------------------------------

/** The plan's triangle estimate is the mount envelope's declared-triangles type. */
export type PlanUsageTrianglesParity = Expect<
  Equals<RenderPlanUsage['estimatedTriangles'], NonNullable<MountGraphEnvelope['declaredTriangles']>>
>;

/** The plan's asset-byte accounting is the mount envelope's declared-texture-bytes type. */
export type PlanUsageBytesParity = Expect<
  Equals<RenderPlanUsage['assetBytes'], NonNullable<MountGraphEnvelope['declaredTextureBytes']>>
>;

/** The plan's source digest is the mount envelope's graph-digest type (chain feeds mount). */
export type PlanMountDigestParity = Expect<
  Equals<RenderPlan['sourceEnvelopeDigest'], MountGraphEnvelope['graphDigest']>
>;

/** The plan's graph-kind vocabulary is the renderer hosting vocabulary. */
export type PlanGraphKindParity = Expect<
  Equals<ExperienceGraphKind, RendererGraphKind>
>;
