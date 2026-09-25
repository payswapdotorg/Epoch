/**
 * COMPILE-TIME DOWNSTREAM/UPSTREAM PARITY (devDependencies only — the
 * W011 kernel-parity / W012 host-parity precedent applied to the W016
 * boundary packages).
 *
 * This file pins structural compatibility between the world experience
 * layer's records and its three pinned neighbors WITHOUT adding runtime
 * dependencies:
 *
 * - `@epoch/renderer-runtime` (W013, downstream): the emitted invocation
 *   envelopes are member-compatible with the renderer hosting surface's
 *   mount-graph/advance-frame/submit-intent envelopes, and the enforced
 *   budgets are member-compatible with the renderer budgets — if the W013
 *   shapes change, this file fails to compile and the runtime parity test
 *   (test/renderer-parity.test.ts) fails;
 * - `@epoch/world-model` (W002, upstream): scene entities carry the
 *   canonical world-model entity id grammar — if the grammar changes,
 *   this file fails to compile and test/world-parity.test.ts fails;
 * - `@epoch/experience-compiler` (W012, sibling): the compiled graphs'
 *   resource usage is member-compatible with the W012 plan usage fields
 *   (the same declared-usage vocabulary feeds both compilers' outputs).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would
 * drag the devDependencies into every downstream consumer's compile
 * graph. It is compiled by this package's own `tsc --noEmit`
 * (tsconfig.json includes src/**) and mirrored by runtime parity tests.
 */
import type { Equals, Expect } from './type-utils';
import type {
  WorldAdvanceFrameEnvelope,
  WorldMountGraphEnvelope,
  WorldSubmitIntentEnvelope,
} from './compile';
import type { SceneRenderUsage, WorldRenderBudgets } from './budget';
import type { SceneCompilation } from './compile';
import type { WorldScene } from './scene';
import type { InteractionModality } from '@epoch/experience-protocol';
import type { EntityId } from '@epoch/world-model';
import type {
  AdvanceFrameEnvelope,
  InteractionModality as RendererModality,
  MountGraphEnvelope,
  RendererBudgets,
  SubmitIntentEnvelope,
} from '@epoch/renderer-runtime';
import type { RenderPlanUsage } from '@epoch/experience-compiler';

// ---------------------------------------------------------------------------
// Downstream parity: @epoch/renderer-runtime (W013).
// ---------------------------------------------------------------------------

/** The emitted mount envelope IS the W013 mount envelope shape. */
export type MountEnvelopeParity = Expect<
  Equals<WorldMountGraphEnvelope, MountGraphEnvelope>
>;

/** The emitted advance envelope IS the W013 advance envelope shape. */
export type AdvanceEnvelopeParity = Expect<
  Equals<WorldAdvanceFrameEnvelope, AdvanceFrameEnvelope>
>;

/** The emitted submit-intent envelope IS the W013 submit-intent envelope shape. */
export type SubmitIntentEnvelopeParity = Expect<
  Equals<WorldSubmitIntentEnvelope, SubmitIntentEnvelope>
>;

/** The enforced budgets ARE the W013 renderer budgets. */
export type RenderBudgetsParity = Expect<Equals<WorldRenderBudgets, RendererBudgets>>;

/** The modality vocabulary agrees with the W013/W011 interaction vocabulary. */
export type ModalityVocabularyParity = Expect<Equals<InteractionModality, RendererModality>>;

// ---------------------------------------------------------------------------
// Upstream parity: @epoch/world-model (W002).
// ---------------------------------------------------------------------------

/** Scene entities carry the canonical world-model entity id type. */
export type SceneEntityIdParity = Expect<
  Equals<WorldScene['entities'][number]['entityId'], EntityId>
>;

// ---------------------------------------------------------------------------
// Sibling parity: @epoch/experience-compiler (W012).
// ---------------------------------------------------------------------------

/** The scene usage triangles field IS the W012 plan usage triangles field. */
export type UsageTrianglesParity = Expect<
  Equals<SceneRenderUsage['estimatedTriangles'], RenderPlanUsage['estimatedTriangles']>
>;

/** The scene usage bytes field IS the W012 plan usage bytes field. */
export type UsageBytesParity = Expect<
  Equals<SceneRenderUsage['assetBytes'], RenderPlanUsage['assetBytes']>
>;

/** The compiled graphs ARE sealed W011 envelopes (the W012 compile input). */
export type CompiledGraphParity = Expect<
  Equals<SceneCompilation['graphs'][number], import('@epoch/experience-protocol').ExperienceGraph>
>;
