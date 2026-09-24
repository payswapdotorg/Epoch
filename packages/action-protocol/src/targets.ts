/**
 * Action targets and effect vocabulary.
 *
 * Actions are typed interventions: target, parameters, preconditions,
 * predicted effects, side effects, reversibility, and authority
 * requirements (architecture.md, "Actions"). This module carries the
 * target and effect classification; safety-relevant metadata is REQUIRED
 * on every action proposal — the fields are not optional.
 *
 * World references are minimal and additive: `ref` is opaque because the
 * canonical reference format is owned by the World Model contract (W002,
 * in flight at W003 dispatch time — reconciliation recorded as an
 * architecture question in the W003 PR). External references are opaque
 * adapter-owned identifiers (lock rule 13: provider behavior is
 * adapterized).
 */
import { z } from 'zod';

/** Target kinds: what a proposed intervention acts upon. */
export const ACTION_TARGET_KINDS = [
  'world-entity',
  'world-relation',
  'world-assertion',
  'external-resource',
] as const;

export type ActionTargetKind = (typeof ACTION_TARGET_KINDS)[number];

export const ActionTargetKindSchema = z.enum(ACTION_TARGET_KINDS).meta({
  id: 'ActionTargetKind',
  title: 'ActionTargetKind',
  description: 'What a proposed intervention acts upon (world model objects or external resources).',
});

export const ActionTargetSchema = z
  .strictObject({
    kind: ActionTargetKindSchema,
    /** Opaque target reference; format owned by the World Model (W002) or the adapter. */
    ref: z.string().min(1).max(256),
  })
  .meta({
    id: 'ActionTarget',
    title: 'ActionTarget',
    description:
      'What a proposed intervention acts upon: a world entity/relation/assertion or an external resource.',
  });

export type ActionTarget = z.infer<typeof ActionTargetSchema>;

/**
 * A precondition that must hold before an action may execute. `constraintRef`
 * is an opaque reference into the constraint registry — the constraint
 * language and compiled enforcement are owned by W004 (architecture
 * question: reconciliation of the reference format).
 */
export const PreconditionSchema = z
  .strictObject({
    description: z.string().min(1).max(2000),
    constraintRef: z.string().min(1).max(256).optional(),
    targetRef: ActionTargetSchema.optional(),
  })
  .meta({
    id: 'Precondition',
    title: 'Precondition',
    description:
      'A condition that must hold before execution; optionally bound to a compiled constraint (W004) or a world target.',
  });

export type Precondition = z.infer<typeof PreconditionSchema>;

/**
 * Confidence in a predicted effect. Discriminated and exhaustive: a
 * deterministic prediction, a quantified probability in [0, 1], or a
 * qualitative level.
 */
export const EffectConfidenceSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('deterministic') }),
    z.strictObject({
      kind: z.literal('quantified'),
      value: z.number().min(0).max(1),
    }),
    z.strictObject({
      kind: z.literal('qualitative'),
      level: z.enum(['high', 'medium', 'low']),
    }),
  ])
  .meta({
    id: 'EffectConfidence',
    title: 'EffectConfidence',
    description: 'Deterministic, quantified [0,1], or qualitative confidence in a predicted effect.',
  });

export type EffectConfidence = z.infer<typeof EffectConfidenceSchema>;

/** A predicted primary effect of an action (every proposal declares >= 1). */
export const PredictedEffectSchema = z
  .strictObject({
    description: z.string().min(1).max(2000),
    targetRef: ActionTargetSchema.optional(),
    confidence: EffectConfidenceSchema,
  })
  .meta({
    id: 'PredictedEffect',
    title: 'PredictedEffect',
    description: 'A predicted primary effect with an exhaustive confidence classification.',
  });

export type PredictedEffect = z.infer<typeof PredictedEffectSchema>;

/** A secondary effect outside the action's primary intent. */
export const SideEffectSchema = z
  .strictObject({
    description: z.string().min(1).max(2000),
    targetRef: ActionTargetSchema.optional(),
    reversible: z.boolean(),
  })
  .meta({
    id: 'SideEffect',
    title: 'SideEffect',
    description: 'A secondary effect outside the primary intent, with per-effect reversibility.',
  });

export type SideEffect = z.infer<typeof SideEffectSchema>;

/**
 * Reversibility classification — exhaustive and narrow (a Tech Lead design
 * pin). `partially-reversible` requires notes stating the irreversible
 * residue (runtime refinement).
 */
export const ReversibilityClassificationSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('reversible'),
      via: z.enum(['automatic', 'manual', 'compensating-action']),
      notes: z.string().max(2000).optional(),
    }),
    z.strictObject({
      kind: z.literal('partially-reversible'),
      notes: z.string().min(1).max(2000),
    }),
    z.strictObject({
      kind: z.literal('irreversible'),
      notes: z.string().max(2000).optional(),
    }),
  ])
  .meta({
    id: 'ReversibilityClassification',
    title: 'ReversibilityClassification',
    description:
      'Exhaustive reversibility classification: reversible (via automatic/manual/compensating action), partially reversible, or irreversible.',
  });

export type ReversibilityClassification = z.infer<typeof ReversibilityClassificationSchema>;
