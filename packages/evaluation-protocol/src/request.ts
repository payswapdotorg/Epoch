/**
 * The evaluation request message (`messageKind: "evaluation.request"`).
 *
 * A request for one registered evaluator to judge one subject at exact
 * revisions: the {@link EvaluatorReference} binds the evaluator id to
 * the SHA-256 digest of the registration's canonical JSON, and the
 * subject is referenced neutrally by kind, id, and canonical digest.
 * Criteria are a named JSON record whose names and value kinds must
 * conform to the registration's declared criteria specs (checked by the
 * conformance helpers).
 */
import { z } from 'zod';
import {
  JsonValueSchema,
  MessageIdSchema,
  PARAMETER_NAME_PATTERN,
  TimestampSchema,
} from '@epoch/agent-protocol';
import { admitMessage, unwrapOrThrow, type ParseOutcome } from '@epoch/agent-protocol';
import { EvaluationSubjectSchema } from './subject';
import { EvaluatorIdSchema } from './registration';
import {
  EVALUATION_MESSAGE_KIND_REQUEST,
  EVALUATION_PROTOCOL_VERSION,
  EvaluationProtocolVersionSchema,
} from './version';

/**
 * Exact-revision reference to a registered evaluator: the evaluator id
 * plus the SHA-256 digest of the registration's canonical JSON.
 */
export const EvaluatorReferenceSchema = z
  .strictObject({
    evaluatorId: EvaluatorIdSchema,
    registrationDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .meta({
    id: 'EvaluatorReference',
    title: 'EvaluatorReference',
    description:
      'Exact-revision evaluator reference: id plus the SHA-256 digest of the registration canonical JSON.',
  });

export type EvaluatorReference = z.infer<typeof EvaluatorReferenceSchema>;

/** The evaluation request message. */
export const EvaluationRequestSchema = z
  .strictObject({
    protocolVersion: EvaluationProtocolVersionSchema,
    messageKind: z.literal(EVALUATION_MESSAGE_KIND_REQUEST),
    messageId: MessageIdSchema,
    createdAt: TimestampSchema,
    requestId: MessageIdSchema,
    evaluator: EvaluatorReferenceSchema,
    subject: EvaluationSubjectSchema,
    criteria: z.record(z.string().regex(PARAMETER_NAME_PATTERN), JsonValueSchema),
  })
  .refine(
    (request) => Object.keys(request.criteria).length >= 1,
    'an evaluation request must carry at least one named criterion',
  )
  .meta({
    id: 'EvaluationRequest',
    title: 'EvaluationRequest',
    description:
      'Request for a registered evaluator to judge one subject at exact revisions, with named evaluation criteria.',
  });

export type EvaluationRequest = z.infer<typeof EvaluationRequestSchema>;

/**
 * Admit an evaluation request through the shared pipeline.
 */
export function parseEvaluationRequest(input: unknown): ParseOutcome<EvaluationRequest> {
  return admitMessage({
    input,
    expectedVersion: EVALUATION_PROTOCOL_VERSION,
    expectedKind: EVALUATION_MESSAGE_KIND_REQUEST,
    schema: EvaluationRequestSchema,
  });
}

/** Throwing variant of {@link parseEvaluationRequest}. */
export function validateEvaluationRequest(input: unknown): EvaluationRequest {
  return unwrapOrThrow(parseEvaluationRequest(input));
}
