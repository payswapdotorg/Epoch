/**
 * The evaluation-protocol schema surface registry: every data type
 * published at the in-package `contracts/` boundary, paired with its
 * zod schema.
 *
 * Invariants enforced by tests (`test/contract-surface.test.ts` and
 * `test/contract-drift.test.ts`):
 * - every entry is exported from the package index;
 * - every entry has a declaration in `contracts/index.d.ts`;
 * - every entry has a compile-time parity assertion in
 *   `contracts/parity.ts`;
 * - every entry has an emitted JSON Schema file listed in
 *   `contracts/manifest.json` with a matching digest.
 */
import type { ZodType } from 'zod';
import {
  EvaluationMessageKindSchema,
  EvaluationProtocolVersionSchema,
} from './version';
import { EvaluationSubjectKindSchema, EvaluationSubjectSchema } from './subject';
import {
  EvaluatorIdSchema,
  EvaluatorRegistrationSchema,
  JudgmentBasisSchema,
  VerdictFormSchema,
} from './registration';
import { EvaluatorReferenceSchema, EvaluationRequestSchema } from './request';
import {
  EvaluationRequestReferenceSchema,
  EvaluationVerdictSchema,
  JustificationKindSchema,
  JustificationReferenceSchema,
  PassFailVerdictSchema,
  ScoredVerdictSchema,
  VerdictOutcomeSchema,
} from './verdict';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of evaluation protocol v1. */
export const EVALUATION_PROTOCOL_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'EvaluationMessageKind', schema: EvaluationMessageKindSchema },
  { type: 'EvaluationProtocolVersion', schema: EvaluationProtocolVersionSchema },
  { type: 'EvaluationRequest', schema: EvaluationRequestSchema },
  { type: 'EvaluationRequestReference', schema: EvaluationRequestReferenceSchema },
  { type: 'EvaluationSubject', schema: EvaluationSubjectSchema },
  { type: 'EvaluationSubjectKind', schema: EvaluationSubjectKindSchema },
  { type: 'EvaluationVerdict', schema: EvaluationVerdictSchema },
  { type: 'EvaluatorId', schema: EvaluatorIdSchema },
  { type: 'EvaluatorReference', schema: EvaluatorReferenceSchema },
  { type: 'EvaluatorRegistration', schema: EvaluatorRegistrationSchema },
  { type: 'JudgmentBasis', schema: JudgmentBasisSchema },
  { type: 'JustificationKind', schema: JustificationKindSchema },
  { type: 'JustificationReference', schema: JustificationReferenceSchema },
  { type: 'PassFailVerdict', schema: PassFailVerdictSchema },
  { type: 'ScoredVerdict', schema: ScoredVerdictSchema },
  { type: 'VerdictForm', schema: VerdictFormSchema },
  { type: 'VerdictOutcome', schema: VerdictOutcomeSchema },
];
