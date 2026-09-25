/**
 * Animation instructions of the interactive world view — typed
 * presentation records that animate entity presentation properties over
 * strictly time-ordered keyframes (the W011 Keyframe vocabulary, reused).
 *
 * An animation instruction NEVER mutates world state: it names a target
 * scene entity and a dotted presentation property path, with keyframes
 * the compiled graph turns into animation-clip tracks. Admission
 * validates target resolvability (against the scene's entity set — a
 * dangling target is a typed `unknown-scene-reference` rejection) and
 * keyframe ordering/duration bounds.
 */
import { z } from 'zod';
import { EasingKindSchema, KeyframeSchema } from '@epoch/experience-protocol';
import { MAX_ANIMATION_INSTRUCTIONS, MAX_INSTRUCTION_KEYFRAMES } from './version';
import { WorldEntityIdSchema, WorldVirtualTimeMsSchema } from './primitives';
import {
  malformedRecord,
  malformedRecordError,
  unknownSceneReferenceError,
} from './issues';
import type { WorldExperienceResult } from './errors';

/** Bounded instruction-local identifier: lowercase kebab slug. */
const InstructionIdSchema = z
  .string()
  .regex(/^ani-[a-z0-9][a-z0-9-]{0,62}$/)
  .meta({
    id: 'AnimationInstructionId',
    title: 'AnimationInstructionId',
    description: 'Animation-instruction identifier: "ani-" followed by a lowercase slug.',
  });

/** One animation-instruction identifier. */
export type AnimationInstructionId = z.infer<typeof InstructionIdSchema>;

/** The typed descriptor of one animation instruction. */
export const AnimationInstructionSchema = z
  .strictObject({
    instructionId: InstructionIdSchema,
    targetEntityId: WorldEntityIdSchema,
    propertyPath: z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/),
    keyframes: z.array(KeyframeSchema).min(1).max(MAX_INSTRUCTION_KEYFRAMES),
    easing: EasingKindSchema,
    durationMs: z.number().int().positive(),
    loop: z.boolean(),
    startAtMs: WorldVirtualTimeMsSchema.optional(),
  })
  .superRefine((instruction, ctx) => {
    for (let i = 1; i < instruction.keyframes.length; i += 1) {
      if (instruction.keyframes[i].atMs <= instruction.keyframes[i - 1].atMs) {
        ctx.addIssue({
          code: 'custom',
          message: 'keyframes must be ordered by strictly increasing atMs (deterministic playback)',
          path: ['keyframes', i],
        });
        return;
      }
    }
    const last = instruction.keyframes[instruction.keyframes.length - 1];
    if (last.atMs > instruction.durationMs) {
      ctx.addIssue({
        code: 'custom',
        message: `keyframe at ${last.atMs}ms exceeds the instruction duration (${instruction.durationMs}ms)`,
        path: ['durationMs'],
      });
    }
  })
  .meta({
    id: 'AnimationInstruction',
    title: 'AnimationInstruction',
    description:
      'One animation instruction: target entity, presentation property path, strictly ordered keyframes, easing, duration, loop.',
  });

/** One animation instruction. */
export type AnimationInstruction = z.infer<typeof AnimationInstructionSchema>;

/**
 * Validate an animation-instruction list: bounded, sorted and
 * duplicate-free by instructionId, and every target entity resolves in the
 * given entity set (dangling targets are typed `unknown-scene-reference`
 * rejections — animation is presentation and can never animate content the
 * scene does not carry).
 */
export function validateAnimationInstructions(
  instructions: readonly AnimationInstruction[],
  entityIds: ReadonlySet<string>,
): WorldExperienceResult<void> {
  const list = z
    .array(AnimationInstructionSchema)
    .max(MAX_ANIMATION_INSTRUCTIONS)
    .safeParse(instructions);
  if (!list.success) {
    return { ok: false, error: malformedRecordError(list.error) };
  }
  for (let i = 1; i < list.data.length; i += 1) {
    if (list.data[i].instructionId <= list.data[i - 1].instructionId) {
      return {
        ok: false,
        error: malformedRecord([
          {
            path: 'animations',
            message:
              'animation instructions must be sorted by instructionId ascending and duplicate-free (deterministic serialization)',
          },
        ]),
      };
    }
  }
  for (const instruction of list.data) {
    if (!entityIds.has(instruction.targetEntityId)) {
      return {
        ok: false,
        error: unknownSceneReferenceError(
          ['animations', instruction.instructionId, 'targetEntityId'],
          instruction.targetEntityId,
        ),
      };
    }
  }
  return { ok: true, value: undefined };
}

/** Animation usage accounting (pure). */
export interface AnimationUsage {
  readonly instructionCount: number;
  readonly loopingCount: number;
  readonly totalKeyframes: number;
}

/** Compute the animation usage record of an instruction list. */
export function computeAnimationUsage(
  instructions: readonly AnimationInstruction[],
): AnimationUsage {
  let loopingCount = 0;
  let totalKeyframes = 0;
  for (const instruction of instructions) {
    if (instruction.loop) {
      loopingCount += 1;
    }
    totalKeyframes += instruction.keyframes.length;
  }
  return {
    instructionCount: instructions.length,
    loopingCount,
    totalKeyframes,
  };
}
