/**
 * Evaluation subjects: what an evaluator judges.
 *
 * An evaluator consumes simulation results OR world outcomes plus
 * evaluation criteria, and produces structured verdicts. The subject is
 * referenced NEUTRALLY — kind, opaque id, and the SHA-256 digest of the
 * subject document's canonical JSON — so judgment stays structurally
 * separate from prediction (architecture lock rule 6): this protocol
 * does not import or parse simulation-protocol types, and the exact
 * world-outcome reference format is owned by the World Model (W002).
 */
import { z } from 'zod';
import { MessageIdSchema } from '@epoch/agent-protocol';

/** Canonical digest shape: lowercase hex SHA-256 (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/**
 * The judged-document kinds. `simulation-result` addresses a
 * `simulation.result` message (owned by `@epoch/simulation-protocol`);
 * `world-outcome` addresses an observed world outcome (owned by the
 * canonical World Model, W002). Both are neutral domain references, not
 * provider vocabulary.
 */
export const EVALUATION_SUBJECT_KINDS = ['simulation-result', 'world-outcome'] as const;

export type EvaluationSubjectKind = (typeof EVALUATION_SUBJECT_KINDS)[number];

export const EvaluationSubjectKindSchema = z.enum(EVALUATION_SUBJECT_KINDS).meta({
  id: 'EvaluationSubjectKind',
  title: 'EvaluationSubjectKind',
  description: 'What an evaluator judges: a simulation result or a world outcome.',
});

/**
 * Exact-revision reference to the judged document: kind, opaque subject
 * id, and the SHA-256 digest of the subject document's canonical JSON.
 */
export const EvaluationSubjectSchema = z
  .strictObject({
    kind: EvaluationSubjectKindSchema,
    subjectId: MessageIdSchema,
    subjectDigest: z.string().regex(SHA256_HEX_PATTERN),
  })
  .meta({
    id: 'EvaluationSubject',
    title: 'EvaluationSubject',
    description:
      'Exact-revision reference to the judged document: kind, subject id, and canonical digest.',
  });

export type EvaluationSubject = z.infer<typeof EvaluationSubjectSchema>;
