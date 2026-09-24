/**
 * The evaluation verdict message (`messageKind: "evaluation.verdict"`).
 *
 * The judgment artifact one evaluator produces for one admitted
 * evaluation request. Verdicts are structured and REFERENCED: every
 * verdict carries at least one {@link JustificationReference} that names
 * the criterion, subject output, subject failure, assumption, or method
 * it rests on — judgment without a machine-referenceable justification
 * is inexpressible.
 *
 * Like simulation results, verdicts carry NO wall-clock or measurement
 * fields: a deterministic evaluator's verdict digest must be a pure
 * function of the request digest (the subject is bound inside the
 * request), so anything time-varying is structurally inexpressible.
 */
import { z } from 'zod';
import { MessageIdSchema } from '@epoch/agent-protocol';
import { admitMessage, unwrapOrThrow, type ParseOutcome } from '@epoch/agent-protocol';
import { EvaluationSubjectSchema } from './subject';
import { EvaluatorReferenceSchema } from './request';
import {
  EVALUATION_MESSAGE_KIND_VERDICT,
  EVALUATION_PROTOCOL_VERSION,
  EvaluationProtocolVersionSchema,
} from './version';

/**
 * Exact-revision reference to an evaluation request: the request id plus
 * the SHA-256 digest of the request's canonical JSON.
 */
export const EvaluationRequestReferenceSchema = z
  .strictObject({
    requestId: MessageIdSchema,
    requestDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .meta({
    id: 'EvaluationRequestReference',
    title: 'EvaluationRequestReference',
    description:
      'Exact-revision evaluation request reference: request id plus the SHA-256 digest of the request canonical JSON.',
  });

export type EvaluationRequestReference = z.infer<typeof EvaluationRequestReferenceSchema>;

/** A binary verdict. */
export const PassFailVerdictSchema = z
  .strictObject({
    verdictForm: z.literal('pass-fail'),
    outcome: z.enum(['pass', 'fail']),
  })
  .meta({
    id: 'PassFailVerdict',
    title: 'PassFailVerdict',
    description: 'Binary verdict: pass or fail.',
  });

export type PassFailVerdict = z.infer<typeof PassFailVerdictSchema>;

/**
 * A scored verdict on a declared scale. Runtime refinement: the scale is
 * non-degenerate (minimum < maximum) and the score lies within it.
 */
export const ScoredVerdictSchema = z
  .strictObject({
    verdictForm: z.literal('scored'),
    score: z.number(),
    scale: z
      .strictObject({
        minimum: z.number(),
        maximum: z.number(),
      })
      .refine((scale) => scale.minimum < scale.maximum, 'scale minimum must be below maximum')
      .refine(
        (scale) => Number.isFinite(scale.minimum) && Number.isFinite(scale.maximum),
        'scale bounds must be finite',
      ),
  })
  .refine(
    (verdict) =>
      verdict.scale.minimum <= verdict.score && verdict.score <= verdict.scale.maximum,
    'score must lie within the declared scale',
  )
  .meta({
    id: 'ScoredVerdict',
    title: 'ScoredVerdict',
    description: 'Scored verdict on a declared finite scale (minimum < maximum; score within).',
  });

export type ScoredVerdict = z.infer<typeof ScoredVerdictSchema>;

/** The exhaustive verdict-form union. */
export const VerdictOutcomeSchema = z
  .discriminatedUnion('verdictForm', [PassFailVerdictSchema, ScoredVerdictSchema])
  .meta({
    id: 'VerdictOutcome',
    title: 'VerdictOutcome',
    description: 'Exhaustive verdict union: pass-fail or scored on a declared scale.',
  });

export type VerdictOutcome = z.infer<typeof VerdictOutcomeSchema>;

/** What a justification reference may point at. */
export const JUSTIFICATION_KINDS = [
  'criterion',
  'subject-output',
  'subject-failure',
  'assumption',
  'method',
] as const;

export type JustificationKind = (typeof JUSTIFICATION_KINDS)[number];

export const JustificationKindSchema = z.enum(JUSTIFICATION_KINDS).meta({
  id: 'JustificationKind',
  title: 'JustificationKind',
  description:
    'What a verdict justification references: criterion, subject output, subject failure, assumption, or method.',
});

/**
 * One machine-referenceable justification entry: what it points at
 * (criterion name, subject output name, ...) and the human-auditable
 * statement. For kind `criterion`, `reference` must name a criterion key
 * of the request (conformance-checked).
 */
export const JustificationReferenceSchema = z
  .strictObject({
    kind: JustificationKindSchema,
    reference: z.string().min(1).max(256),
    statement: z.string().min(1).max(4000),
  })
  .meta({
    id: 'JustificationReference',
    title: 'JustificationReference',
    description:
      'A machine-referenceable verdict justification: kind, target reference, and an auditable statement.',
  });

export type JustificationReference = z.infer<typeof JustificationReferenceSchema>;

/**
 * The evaluation verdict message. `verdictId` is opaque (deterministic
 * evaluators derive it from the request digest); the subject is echoed
 * so the verdict is self-contained evidence; `deterministic` mirrors the
 * registration and is conformance-checked.
 */
export const EvaluationVerdictSchema = z
  .strictObject({
    protocolVersion: EvaluationProtocolVersionSchema,
    messageKind: z.literal(EVALUATION_MESSAGE_KIND_VERDICT),
    verdictId: MessageIdSchema,
    request: EvaluationRequestReferenceSchema,
    evaluator: EvaluatorReferenceSchema,
    subject: EvaluationSubjectSchema,
    outcome: VerdictOutcomeSchema,
    justification: z.array(JustificationReferenceSchema).min(1),
    deterministic: z.boolean(),
  })
  .meta({
    id: 'EvaluationVerdict',
    title: 'EvaluationVerdict',
    description:
      'Evaluation verdict message: exact-revision request/evaluator bindings, subject echo, structured outcome, and referenced justifications.',
  });

export type EvaluationVerdict = z.infer<typeof EvaluationVerdictSchema>;

/**
 * Admit an evaluation verdict through the shared pipeline.
 */
export function parseEvaluationVerdict(input: unknown): ParseOutcome<EvaluationVerdict> {
  return admitMessage({
    input,
    expectedVersion: EVALUATION_PROTOCOL_VERSION,
    expectedKind: EVALUATION_MESSAGE_KIND_VERDICT,
    schema: EvaluationVerdictSchema,
  });
}

/** Throwing variant of {@link parseEvaluationVerdict}. */
export function validateEvaluationVerdict(input: unknown): EvaluationVerdict {
  return unwrapOrThrow(parseEvaluationVerdict(input));
}
