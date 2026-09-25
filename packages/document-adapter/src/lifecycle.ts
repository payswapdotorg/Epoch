/**
 * The provisional lifecycle state machine (terminal at Provisional) and
 * the trust-escalation floor.
 *
 * The pipeline is strictly linear —
 * `Uploaded -> Parsed -> CandidatesExtracted -> ReviewPending ->
 * Provisional` — with exactly one legal successor per stage and NO legal
 * successor at `provisional`. An illegal advance (skipping, regressing,
 * branching, or reviving) is a typed `policy-violation` of the pipeline
 * discipline. Escalation OUT of the provisional floor (certify, execute,
 * grant-capability) is not a lifecycle question at all: it is the typed
 * rejection `trust-escalation-denied`, implemented here as the floor,
 * never the gate (spec/extension-architecture.md, binding: "Document-
 * derived extensions begin provisional and cannot certify or execute").
 */
import { trustEscalationDenied } from './errors';
import {
  EXTRACTION_STAGE_KINDS,
  PROVISIONAL_LIFECYCLE_TRANSITIONS,
  TRUST_ESCALATION_OPS,
} from './version';
import type {
  DocumentAdapterError,
  DocumentAdapterResult,
  ExtractionStageKind,
  ProvisionalAdapterDefinition,
  TrustEscalationOp,
} from './types';

/** Input of {@link advanceExtractionStage}. */
export interface AdvanceStageInput {
  readonly current: ExtractionStageKind;
  readonly target: ExtractionStageKind;
}

/** The zero-based pipeline position of a stage. */
export function stageIndexOf(stage: ExtractionStageKind): number {
  const index = EXTRACTION_STAGE_KINDS.indexOf(stage);
  if (index === -1) {
    throw new Error(`unknown stage "${stage}" (closed vocabulary)`);
  }
  return index;
}

/** The legal successors of a stage (from the typed transition table). */
export function legalSuccessors(stage: ExtractionStageKind): readonly ExtractionStageKind[] {
  return PROVISIONAL_LIFECYCLE_TRANSITIONS[stage];
}

/**
 * Advance the derivation one stage. Total: returns the next stage, or a
 * typed `policy-violation` naming the illegal transition (skip, regress,
 * branch, or revive) and the legal successors.
 */
export function advanceExtractionStage(
  input: AdvanceStageInput,
): DocumentAdapterResult<ExtractionStageKind> {
  const successors = PROVISIONAL_LIFECYCLE_TRANSITIONS[input.current];
  if (!successors.includes(input.target)) {
    return {
      ok: false,
      error: {
        code: 'policy-violation',
        message:
          `illegal derivation transition "${input.current}" -> "${input.target}" ` +
          `(legal successors of "${input.current}": ${successors.length === 0 ? 'none — the provisional stage is terminal' : successors.map((s) => `"${s}"`).join(', ')})`,
        path: ['lifecycle'],
        rule: 'lifecycle-transition',
      },
    };
  }
  return { ok: true, value: input.target };
}

/** Input of {@link requestTrustEscalation}. */
export interface TrustEscalationRequest {
  readonly op: TrustEscalationOp;
  /** The definition the caller tries to escalate (for message context). */
  readonly definition?: Pick<ProvisionalAdapterDefinition, 'definitionId' | 'lifecycle'> | undefined;
}

/**
 * Request a trust escalation for a document-derived mapping. The answer
 * is ALWAYS the typed denial `trust-escalation-denied`: document-derived
 * mappings are provisional by construction; certifying, executing, and
 * host-capability grants are out of scope for the document adapter — this
 * implements the floor, not the gate (the escalation gate itself is a
 * separate governance surface).
 */
export function requestTrustEscalation(request: TrustEscalationRequest): DocumentAdapterError {
  if (!TRUST_ESCALATION_OPS.includes(request.op)) {
    throw new Error(`unknown trust-escalation op "${request.op}" (closed vocabulary)`);
  }
  const error = trustEscalationDenied({ op: request.op, path: ['lifecycle'] });
  const subject = request.definition === undefined ? '' : ` for definition ${request.definition.definitionId}`;
  return {
    ...error,
    message: `${error.message}${subject}`,
  };
}

/** Pipeline positions re-exported for drivers (typed data). */
export const PIPELINE_SEQUENCE = EXTRACTION_STAGE_KINDS;
export const PIPELINE_LENGTH = EXTRACTION_STAGE_KINDS.length;
