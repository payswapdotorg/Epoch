/**
 * The capability-gap lifecycle (ARCD1.0, acceptance 5).
 *
 * A missing capability becomes an EXPLICIT {@link CapabilityGap} record
 * with the state machine `UNSATISFIED -> CANDIDATE_FOUND -> EVALUATED ->
 * VERIFIED / DEGRADED / REQUIRES_HUMAN` (plus the documented re-open
 * paths). Transitions are append-only and hash-linked: each transition's
 * digest chains to the previous one, and `verifyGapChain` re-derives the
 * chain — a tampered gap is detectable, never silently accepted.
 *
 * Gaps feed ecosystem discovery (stream B): an UNSATISFIED gap is the
 * input to a source-adapter scan; a scan that finds candidates appends
 * the `CANDIDATE_FOUND` transition.
 */
import type {
  CapabilityGap,
  CapabilityGapState,
  DiscoveryRunId,
  DiscoveryResult,
  DiscoveryTenantId,
  GapTransition,
  OperationRef,
  Timestamp,
  UniversalLifecycleStage,
} from './types';
import { CapabilityGapSchema } from './schema';
import { contentDigest, digestSuffix16 } from './canonical';
import { CAPABILITY_DISCOVERY_RECORD_VERSION, CAPABILITY_GAP_TRANSITIONS } from './version';
import { typedError } from './errors';

/** Create a gap (genesis record, state UNSATISFIED, one genesis transition). */
export function createCapabilityGap(input: {
  readonly tenantId: DiscoveryTenantId;
  readonly operation: OperationRef;
  readonly demandSummary: string;
  readonly lifecycleStage: UniversalLifecycleStage;
  readonly originatingRunId?: DiscoveryRunId | undefined;
  readonly triggeringSignalIds: readonly string[];
  readonly at: Timestamp;
  readonly notes?: readonly string[] | undefined;
}): CapabilityGap {
  const body = {
    schemaVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    gapId: 'gap:0000000000000000',
    tenantId: input.tenantId,
    operation: input.operation,
    demandSummary: input.demandSummary,
    lifecycleStage: input.lifecycleStage,
    state: 'UNSATISFIED' as CapabilityGapState,
    originatingRunId: input.originatingRunId,
    triggeringSignalIds: [...input.triggeringSignalIds].sort(),
    firstObservedAt: input.at,
    notes: [...(input.notes ?? [])].sort(),
    transitions: [],
  };
  const genesis = sealTransition({
    toState: 'UNSATISFIED',
    at: input.at,
    cause: 'gap-opened',
    previousTransitionDigest: null,
  });
  const withTransition = { ...body, transitions: [genesis] };
  const digest = contentDigest({ ...withTransition, gapId: undefined });
  const gap = { ...withTransition, gapId: `gap:${digestSuffix16(digest)}` };
  const parsed = CapabilityGapSchema.safeParse(gap);
  if (!parsed.success) {
    throw new Error(`gap creation produced an invalid record: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Inputs for one gap-state transition. */
export interface GapTransitionInput {
  readonly toState: CapabilityGapState;
  readonly at: Timestamp;
  readonly cause: string;
  readonly evidenceDigest?: string | undefined;
  readonly actorRef?: string | undefined;
}

/** Append one transition to a gap (append-only; typed conflicts). */
export function transitionCapabilityGap(
  gap: CapabilityGap,
  transition: GapTransitionInput,
): DiscoveryResult<CapabilityGap> {
  const allowed = CAPABILITY_GAP_TRANSITIONS[gap.state] ?? [];
  if (!allowed.includes(transition.toState)) {
    return {
      ok: false,
      error: typedError(
        'gap-transition-conflict',
        `gap ${gap.gapId} cannot transition ${gap.state} -> ${transition.toState} (allowed: ${allowed.join(', ') || 'none'})`,
      ),
    };
  }
  const previous =
    gap.transitions.length > 0 ? gap.transitions[gap.transitions.length - 1]!.transitionDigest : null;
  const sealed = sealTransition({
    toState: transition.toState,
    at: transition.at,
    cause: transition.cause,
    evidenceDigest: transition.evidenceDigest,
    actorRef: transition.actorRef,
    previousTransitionDigest: previous,
  });
  const updated: CapabilityGap = {
    ...gap,
    state: transition.toState,
    transitions: [...gap.transitions, sealed],
  };
  const parsed = CapabilityGapSchema.safeParse(updated);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `gap transition produced an invalid record: ${parsed.error.message}`,
        issues: [],
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** Seal one transition record (digest over content + chain link). */
function sealTransition(input: {
  readonly toState: CapabilityGapState;
  readonly at: Timestamp;
  readonly cause: string;
  readonly evidenceDigest?: string | undefined;
  readonly actorRef?: string | undefined;
  readonly previousTransitionDigest: string | null;
}): GapTransition {
  const body = {
    toState: input.toState,
    at: input.at,
    cause: input.cause,
    evidenceDigest: input.evidenceDigest,
    actorRef: input.actorRef,
    previousTransitionDigest: input.previousTransitionDigest,
  };
  const transitionDigest = contentDigest(body);
  return { ...body, transitionDigest };
}

/** The digest of one transition as recomputed from its content. */
export function gapTransitionDigestOf(transition: GapTransition): string {
  return contentDigest({
    toState: transition.toState,
    at: transition.at,
    cause: transition.cause,
    evidenceDigest: transition.evidenceDigest,
    actorRef: transition.actorRef,
    previousTransitionDigest: transition.previousTransitionDigest,
  });
}

/** Verify a gap's transition chain (tamper detection). */
export function verifyGapChain(gap: CapabilityGap): DiscoveryResult<CapabilityGap> {
  let previous: string | null = null;
  for (const transition of gap.transitions) {
    if (transition.previousTransitionDigest !== previous) {
      return {
        ok: false,
        error: typedError(
          'gap-transition-conflict',
          `gap ${gap.gapId} transition chain broken at ${transition.toState}`,
        ),
      };
    }
    if (gapTransitionDigestOf(transition) !== transition.transitionDigest) {
      return {
        ok: false,
        error: typedError(
          'gap-transition-conflict',
          `gap ${gap.gapId} has a tampered transition digest (${transition.transitionDigest})`,
        ),
      };
    }
    previous = transition.transitionDigest;
  }
  const last = gap.transitions[gap.transitions.length - 1];
  if (last !== undefined && last.toState !== gap.state) {
    return {
      ok: false,
      error: typedError(
        'gap-transition-conflict',
        `gap ${gap.gapId} state ${gap.state} disagrees with the last transition ${last.toState}`,
      ),
    };
  }
  return { ok: true, value: gap };
}

/** The body digest of a gap record (excludes the derived gapId). */
export function gapDigestOf(gap: CapabilityGap): string {
  return contentDigest({ ...gap, gapId: undefined });
}
