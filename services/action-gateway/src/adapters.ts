/**
 * The execution adapter seam (W022): the actual effect of an action lives
 * BEHIND {@link ActionExecutionPort}; the gateway records record-shaped
 * outcomes ONLY. This module ships the ONE in-memory/reference adapter the
 * Work Order pins — external systems (HTTP services, queues, tools) are
 * adapters over this seam in future Work Orders, never core types
 * (architecture lock rule 13: provider behavior is adapterized; the
 * reference adapter itself carries zero vendor vocabulary).
 */
import type { ActionProposal } from '@epoch/action-protocol';
import type {
  ActionExecutionRequest,
  ActionExecutionResult,
  ActionExecutionPort,
  ExecutionEffectResult,
} from './types';

/**
 * The in-memory reference execution port: deterministic, zero side
 * effects. Every supported action type "executes" successfully and yields
 * a synthetic evidence reference (`execution:<action-slug>` — the action's
 * own slug, an opaque token); a scripted failure mode exists for the
 * failure-path coverage (the port reports the failure, the GATEWAY records
 * it — the reference port never performs real effects).
 */
export class InMemoryExecutionPort implements ActionExecutionPort {
  private readonly supportedActionTypes: readonly string[] | undefined;
  private readonly scriptedFailure: { code: string; reason: string } | undefined;
  /** The dispatch requests seen so far (host-observable, for tests/audit). */
  private readonly dispatchLog: readonly ActionExecutionRequest[] = [];

  constructor(options?: {
    /** When given, ONLY these action-type ids execute; others are `execution-unsupported`. */
    readonly supportedActionTypes?: readonly string[];
    /** When given, every supported dispatch FAILS with this typed failure. */
    readonly failWith?: { code: string; reason: string };
  }) {
    this.supportedActionTypes =
      options?.supportedActionTypes === undefined
        ? undefined
        : [...options.supportedActionTypes];
    this.scriptedFailure =
      options?.failWith === undefined ? undefined : { ...options.failWith };
  }

  execute(request: ActionExecutionRequest): ActionExecutionResult {
    if (
      this.supportedActionTypes !== undefined &&
      !this.supportedActionTypes.includes(request.proposal.actionType.id)
    ) {
      return {
        ok: false,
        error: {
          code: 'execution-unsupported',
          message: `the execution adapter does not support action type "${request.proposal.actionType.id}"`,
          actionTypeId: request.proposal.actionType.id,
        },
      };
    }
    (this.dispatchLog as ActionExecutionRequest[]).push(request);
    const effect: ExecutionEffectResult =
      this.scriptedFailure === undefined
        ? {
            kind: 'succeeded',
            evidenceRefs: [`execution:${request.actionId.slice('action:'.length)}`],
          }
        : {
            kind: 'failed',
            failureCode: this.scriptedFailure.code,
            reason: this.scriptedFailure.reason,
            evidenceRefs: [`execution:${request.actionId.slice('action:'.length)}`],
          };
    return { ok: true, effect };
  }

  /** The dispatch requests seen so far (in dispatch order). */
  dispatched(): readonly ActionExecutionRequest[] {
    return [...this.dispatchLog];
  }
}

/** Type-only re-export: the admitted proposal shape the seam consumes. */
export type { ActionProposal };
