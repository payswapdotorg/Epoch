/**
 * Neutral primitives — progressive-scene-owned id grammar plus the reused
 * shared vocabularies (canonical homes: @epoch/agent-protocol,
 * @epoch/experience-protocol, @epoch/renderer-runtime).
 */
import { z } from 'zod';
import {
  ExperienceGraphIdSchema,
  Sha256HexSchema,
  TenantScopeSchema,
} from '@epoch/experience-protocol';
import { EffectiveLimitsSchema } from '@epoch/renderer-runtime';

/** Ladder id grammar (`psl-<slug>`). */
export const LADDER_ID_PATTERN = /^psl-[a-z0-9][a-z0-9-]{0,62}$/;

export const LadderIdSchema = z.string().regex(LADDER_ID_PATTERN).meta({
  id: 'LadderId',
  title: 'LadderId',
  description: 'Opaque progressive-scene ladder id (psl-<slug>).',
});

/** One ladder id. */
export type LadderId = z.infer<typeof LadderIdSchema>;

/** Rung index (0 = the source graph at full fidelity). */
export const RungIndexSchema = z
  .number()
  .int()
  .min(0)
  .meta({
    id: 'RungIndex',
    title: 'RungIndex',
    description: 'One progressive-scene ladder rung index (0 = the source graph).',
  });

/** One rung index. */
export type RungIndex = z.infer<typeof RungIndexSchema>;

// Reused shared primitives (canonical homes noted; re-exported so
// consumers need one import site).
export { ExperienceGraphIdSchema, Sha256HexSchema, TenantScopeSchema, EffectiveLimitsSchema };
export type { Sha256Hex, ExperienceGraphId, TenantScope } from '@epoch/experience-protocol';
export type { EffectiveLimits } from '@epoch/renderer-runtime';
