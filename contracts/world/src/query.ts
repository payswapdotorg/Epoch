import type { Assertion } from './assertion';
import type { Entity } from './entity';
import type { EntityId, Instant } from './primitives';
import type { Relation } from './relation';

/**
 * Task-sufficient reconstruction and epistemic queries.
 *
 * The world model supports reconstructing only what can materially affect
 * feasible solutions, predicted effects, or verification (requirement R1),
 * and supports identifying when missing information or uncertainty could
 * change a decision (requirement R6). It MODELS the epistemic state — it
 * never acquires information itself; acquisition is an action owned by
 * agents through the action protocol.
 */

/** Parameters of a task-sufficient reconstruction query. */
export interface DecisionScopeSpec {
  /** Seed entities the decision depends on. */
  readonly entities: readonly EntityId[];
  /** Relation traversal depth from the seeds (default 0: seeds only). */
  readonly relationDepth?: number | undefined;
  /**
   * Confidence floor for materiality (default 0.5). Assertions whose
   * best-case confidence stays below this floor raise information gaps.
   */
  readonly requiredConfidence?: number | undefined;
}

/** The kind of an identified information gap. */
export type InformationGapKind =
  | 'absent-entity'
  | 'low-confidence'
  | 'missing-property'
  | 'unsupported-claim';

/**
 * An identified way in which missing information or uncertainty could
 * change a decision. Gaps are descriptive outputs of the model's epistemic
 * state — hooks for information acquisition, not acquisition itself.
 */
export interface InformationGap {
  readonly kind: InformationGapKind;
  /** Opaque subject descriptor (reconciliation key, entity id, ...). */
  readonly subject: string;
  readonly detail: string;
  readonly observedConfidence?: number | undefined;
  readonly requiredConfidence?: number | undefined;
  /** By construction, a reported gap is one that could change a decision. */
  readonly couldChangeDecision: true;
}

/** A reconciliation-key resolution feeding a read view. */
export interface ResolvedAssertion {
  readonly key: string;
  readonly assertion: Assertion;
}

/**
 * The reconstructed, task-sufficient sub-world for a decision scope: the
 * materialized entities and relations in scope, every live assertion that
 * feeds them, and the information gaps that could change a decision made
 * on this scope.
 */
export interface TaskSufficientWorld {
  readonly at: Instant;
  readonly entities: readonly Entity[];
  readonly relations: readonly Relation[];
  readonly resolutions: readonly ResolvedAssertion[];
  readonly gaps: readonly InformationGap[];
}
