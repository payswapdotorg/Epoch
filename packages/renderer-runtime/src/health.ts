/**
 * Renderer HEALTH (W056) — the typed health projection of a renderer
 * adapter or session, as the Epoch renderer selector and fallback
 * messaging consume it (the UX invariant: Epoch owns the health state and
 * fallback messaging, never a vendor surface).
 *
 * Health is a PROJECTION (typed data at a virtual time), never a semantic
 * record: it carries the health state, the active degradation (if any),
 * the typed failure code that produced a non-healthy state (if any), and
 * a bounded neutral detail string. It is caller-time-stamped — zero
 * wall-clock reads (the determinism discipline).
 */
import { z } from 'zod';
import {
  MAX_FABRIC_DETAIL_LENGTH,
  RendererDegradationKindSchema,
  RendererFailureCodeSchema,
  RendererHealthStateSchema,
} from './version';
import { VirtualTimeMsSchema } from './primitives';

/**
 * The health projection of one renderer (adapter or session) at a virtual
 * time. Consistency rules (enforced at admission): only a `degraded`
 * health state may carry a non-`none` degradation; only `degraded` and
 * `failed` states may name the failure code that produced them.
 */
export const RendererHealthSchema = z
  .strictObject({
    state: RendererHealthStateSchema,
    /** The active presentation degradation (typed, never silent). */
    degradation: RendererDegradationKindSchema,
    /** The typed failure code that produced a non-healthy state (if any). */
    lastFailureCode: RendererFailureCodeSchema.optional(),
    /** Bounded neutral detail for the health/fallback messaging. */
    detail: z.string().max(MAX_FABRIC_DETAIL_LENGTH).optional(),
    /** Virtual time of this health projection (caller-supplied). */
    atMs: VirtualTimeMsSchema,
  })
  .superRefine((health, ctx) => {
    if (health.state !== 'degraded' && health.degradation !== 'none') {
      ctx.addIssue({
        code: 'custom',
        message: 'only a "degraded" health state may carry an active degradation',
        path: ['degradation'],
      });
    }
    if (health.state === 'healthy' && health.lastFailureCode !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a "healthy" health state cannot name a last failure code',
        path: ['lastFailureCode'],
      });
    }
    if (health.state === 'unavailable' && health.lastFailureCode === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'an "unavailable" health state must name the failure code that produced it',
        path: ['lastFailureCode'],
      });
    }
  })
  .meta({
    id: 'RendererHealth',
    title: 'RendererHealth',
    description:
      'The typed health projection of a renderer adapter or session: state, active degradation, producing failure code, detail, and virtual time.',
  });

/** One renderer health projection. */
export type RendererHealth = z.infer<typeof RendererHealthSchema>;

/** The healthy projection at a virtual time. */
export function healthyAt(atMs: number): RendererHealth {
  return { state: 'healthy', degradation: 'none', atMs };
}
