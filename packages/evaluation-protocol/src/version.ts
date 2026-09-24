/**
 * Evaluation Protocol version constants and message-kind vocabulary.
 *
 * Versioning policy (mirrors the agent, action, and simulation
 * protocols): a message is admitted only when its `protocolVersion`
 * equals {@link EVALUATION_PROTOCOL_VERSION} exactly, and version skew is
 * reported as a distinct `version-mismatch` admission error before any
 * schema validation.
 *
 * Evaluation is DISTINCT from simulation (architecture lock rule 6):
 * simulation predicts, evaluation judges. This protocol has no runtime
 * dependency on `@epoch/simulation-protocol` — subjects are referenced
 * neutrally by kind, id, and digest (see `subject.ts`). The
 * simulation-protocol package appears only as a devDependency used by
 * the end-to-end composition test.
 */
import { z } from 'zod';

/** Protocol version carried by every evaluation-protocol message. */
export const EVALUATION_PROTOCOL_VERSION = '1.0.0' as const;

/** The evaluation-protocol version literal type. */
export type EvaluationProtocolVersion = typeof EVALUATION_PROTOCOL_VERSION;

export const EvaluationProtocolVersionSchema = z
  .literal(EVALUATION_PROTOCOL_VERSION)
  .meta({
    id: 'EvaluationProtocolVersion',
    title: 'EvaluationProtocolVersion',
    description: 'Exact evaluation-protocol version admitted by this release ("1.0.0").',
  });

/** Message kind of the evaluator registration message. */
export const EVALUATION_MESSAGE_KIND_REGISTRATION = 'evaluation.registration' as const;

/** Message kind of the evaluation request message. */
export const EVALUATION_MESSAGE_KIND_REQUEST = 'evaluation.request' as const;

/** Message kind of the evaluation verdict message. */
export const EVALUATION_MESSAGE_KIND_VERDICT = 'evaluation.verdict' as const;

/** All message kinds defined by evaluation protocol v1. */
export const EVALUATION_PROTOCOL_MESSAGE_KINDS = [
  EVALUATION_MESSAGE_KIND_REGISTRATION,
  EVALUATION_MESSAGE_KIND_REQUEST,
  EVALUATION_MESSAGE_KIND_VERDICT,
] as const;

/** Message-kind value type of evaluation protocol v1. */
export type EvaluationMessageKind = (typeof EVALUATION_PROTOCOL_MESSAGE_KINDS)[number];

export const EvaluationMessageKindSchema = z
  .enum(EVALUATION_PROTOCOL_MESSAGE_KINDS)
  .meta({
    id: 'EvaluationMessageKind',
    title: 'EvaluationMessageKind',
    description: 'Discriminating message kind for evaluation-protocol messages.',
  });

/** Version of the published contract surface at packages/evaluation-protocol/contracts. */
export const EVALUATION_CONTRACT_VERSION = '1.0.0' as const;
