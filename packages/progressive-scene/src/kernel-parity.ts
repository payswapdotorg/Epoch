/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-parity
 * precedent of W013/W015/W016/W036).
 *
 * This file pins structural compatibility between the progressive-scene
 * shapes and the sibling vocabularies WITHOUT adding runtime dependencies
 * beyond the declared runtime set (@epoch/agent-protocol,
 * @epoch/experience-protocol, @epoch/renderer-runtime, zod):
 *
 * - the fit target is TYPE-EQUAL to the W013 `EffectiveLimits` (budget
 *   envelopes are the renderer hosting boundary's authority — never
 *   redefined here);
 * - the W012 experience-compiler's usage discipline is mirrored
 *   structurally: the mirrored `SceneUsage` field set is type-compatible
 *   with the compiler's `RenderPlanUsage` (compile-time half; the
 *   estimate table itself is runtime parity-pinned by
 *   test/compiler-parity.test.ts against the REAL W012 constant).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would
 * drag the devDependencies into every downstream consumer's compile
 * graph. It is compiled by this package's own `tsc --noEmit`
 * (tsconfig.json includes src/**) and mirrored by runtime parity tests.
 */
import type { Equals, Expect } from './type-utils';
import type { SceneUsage } from './estimates';
import type { EffectiveLimits } from '@epoch/renderer-runtime';
import type { RenderPlanUsage } from '@epoch/experience-compiler';

/** The mirrored usage record is field-compatible with the W012 usage record. */
export type UsageFieldParity = Expect<
  Equals<keyof SceneUsage, keyof RenderPlanUsage>
>;

/** Usage field types match the W012 usage field types. */
export type UsageNodeParity = Expect<Equals<SceneUsage['nodes'], RenderPlanUsage['nodes']>>;
export type UsageEdgeParity = Expect<Equals<SceneUsage['edges'], RenderPlanUsage['edges']>>;
export type UsageTriangleParity = Expect<
  Equals<SceneUsage['estimatedTriangles'], RenderPlanUsage['estimatedTriangles']>
>;
export type UsageAssetParity = Expect<Equals<SceneUsage['assetBytes'], RenderPlanUsage['assetBytes']>>;

/** The fit target is the W013 effective-limits type (never redefined). */
export type FitTargetParity = Expect<
  Equals<
    {
      maxGraphNodes: number;
      maxGraphEdges: number;
      maxTriangles?: number | undefined;
      maxTextureBytes?: number | undefined;
    },
    Pick<EffectiveLimits, 'maxGraphNodes' | 'maxGraphEdges' | 'maxTriangles' | 'maxTextureBytes'>
  >
>;
