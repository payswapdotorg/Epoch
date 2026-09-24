/**
 * The evaluator registration message (`messageKind:
 * "evaluation.registration"`).
 *
 * One provider-neutral declaration of an evaluator's judgment contract:
 * which subject kinds it judges, the criteria inputs it understands, the
 * verdict forms it produces, its judgment basis (summary plus
 * assumptions — opaque judgment without declared assumptions is not
 * registrable), its determinism claim, and cost/latency. Evaluation
 * judges; it never predicts (architecture lock rule 6).
 */
import { z } from 'zod';
import {
  CostProfileSchema,
  LatencyProfileSchema,
  MessageIdSchema,
  ParameterSpecSchema,
  TimestampSchema,
} from '@epoch/agent-protocol';
import { admitMessage, unwrapOrThrow, type ParseOutcome } from '@epoch/agent-protocol';
import { EvaluationSubjectKindSchema } from './subject';
import {
  EVALUATION_MESSAGE_KIND_REGISTRATION,
  EVALUATION_PROTOCOL_VERSION,
  EvaluationProtocolVersionSchema,
} from './version';

/** Registered evaluator identifier: `evaluator:` + lowercase kebab slug. */
export const EVALUATOR_ID_PATTERN = /^evaluator:[a-z0-9][a-z0-9-]{0,62}$/;

export const EvaluatorIdSchema = z.string().regex(EVALUATOR_ID_PATTERN).meta({
  id: 'EvaluatorId',
  title: 'EvaluatorId',
  description: 'Registered evaluator identifier: "evaluator:" followed by a lowercase slug.',
});

export type EvaluatorId = z.infer<typeof EvaluatorIdSchema>;

/** Verdict forms an evaluator may produce. */
export const VERDICT_FORMS = ['pass-fail', 'scored'] as const;

export type VerdictForm = (typeof VERDICT_FORMS)[number];

export const VerdictFormSchema = z.enum(VERDICT_FORMS).meta({
  id: 'VerdictForm',
  title: 'VerdictForm',
  description: 'Verdict form an evaluator produces: pass-fail or scored.',
});

/**
 * Judgment basis: what the evaluator's judgment rests on. `summary`
 * states the basis; `assumptions` must be non-empty — an evaluator that
 * cannot state its assumptions is not registrable.
 */
export const JudgmentBasisSchema = z
  .strictObject({
    summary: z.string().min(1).max(2000),
    assumptions: z.array(z.string().min(1).max(2000)).min(1),
  })
  .meta({
    id: 'JudgmentBasis',
    title: 'JudgmentBasis',
    description: 'Declared judgment basis: summary plus at least one stated assumption.',
  });

export type JudgmentBasis = z.infer<typeof JudgmentBasisSchema>;

/**
 * The evaluator registration message. Runtime refinements: criteria
 * names, subject kinds, and verdict forms must each be duplicate-free.
 */
export const EvaluatorRegistrationSchema = z
  .strictObject({
    protocolVersion: EvaluationProtocolVersionSchema,
    messageKind: z.literal(EVALUATION_MESSAGE_KIND_REGISTRATION),
    messageId: MessageIdSchema,
    createdAt: TimestampSchema,
    evaluatorId: EvaluatorIdSchema,
    displayName: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    subjectKinds: z.array(EvaluationSubjectKindSchema).min(1),
    criteria: z.array(ParameterSpecSchema).min(1),
    verdictForms: z.array(VerdictFormSchema).min(1),
    judgmentBasis: JudgmentBasisSchema,
    deterministic: z.boolean(),
    costProfile: CostProfileSchema,
    latencyProfile: LatencyProfileSchema,
  })
  .refine(
    (registration) =>
      new Set(registration.criteria.map((spec) => spec.name)).size === registration.criteria.length,
    'criteria names must be unique within a registration',
  )
  .refine(
    (registration) => new Set(registration.subjectKinds).size === registration.subjectKinds.length,
    'subjectKinds must be unique within a registration',
  )
  .refine(
    (registration) =>
      new Set(registration.verdictForms).size === registration.verdictForms.length,
    'verdictForms must be unique within a registration',
  )
  .meta({
    id: 'EvaluatorRegistration',
    title: 'EvaluatorRegistration',
    description:
      'Evaluator registration message: subject kinds, criteria, verdict forms, judgment basis, determinism, cost and latency.',
  });

export type EvaluatorRegistration = z.infer<typeof EvaluatorRegistrationSchema>;

/**
 * Admit an evaluator registration through the shared pipeline (version
 * gate, kind gate, schema validation, canonical evidence form).
 */
export function parseEvaluatorRegistration(input: unknown): ParseOutcome<EvaluatorRegistration> {
  return admitMessage({
    input,
    expectedVersion: EVALUATION_PROTOCOL_VERSION,
    expectedKind: EVALUATION_MESSAGE_KIND_REGISTRATION,
    schema: EvaluatorRegistrationSchema,
  });
}

/** Throwing variant of {@link parseEvaluatorRegistration}. */
export function validateEvaluatorRegistration(input: unknown): EvaluatorRegistration {
  return unwrapOrThrow(parseEvaluatorRegistration(input));
}
