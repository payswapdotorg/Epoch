/**
 * The OUTBOUND seam: the bridge's dispatch requests become scripted
 * fixture delivery outcomes (success / retryable / terminal) carrying
 * content-addressed provider delivery references. NO network, NO real
 * provider calls — the script is deterministic DATA supplied at
 * provider construction (the W029 fixture discipline).
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import type {
  DeliveryAttemptContext,
  ProviderDeliveryOutcome,
  ProviderDispatchRequest,
} from '@epoch/external-event-bridge';

/** One scripted delivery outcome step (deterministic DATA). */
export type ScriptedDeliveryStep =
  | { readonly outcome: 'success' }
  | { readonly outcome: 'retryable'; readonly detail: string }
  | { readonly outcome: 'terminal'; readonly detail: string };

/**
 * The content-addressed provider delivery reference for one attempt:
 * the canonical digest over (request id, attempt number) — every
 * provider receipt is attributable to the exact dispatch attempt it
 * acknowledges.
 */
export function providerDeliveryRefOf(
  request: ProviderDispatchRequest,
  attempt: DeliveryAttemptContext,
): string {
  const digest = canonicalDigest({
    requestId: request.requestId,
    attemptNo: attempt.attemptNo,
    scheduledAt: attempt.scheduledAt,
  } as unknown as JsonValue);
  return `delivery-${digest.slice(0, 24)}`;
}

/**
 * Resolve the scripted outcome of one delivery attempt: the step at
 * the attempt's 1-based index, or success once the script is
 * exhausted (a schedule that stops failing has delivered). Successful
 * attempts carry the content-addressed provider delivery reference.
 */
export function scriptedOutcomeOf(
  script: readonly ScriptedDeliveryStep[],
  request: ProviderDispatchRequest,
  attempt: DeliveryAttemptContext,
): ProviderDeliveryOutcome {
  const step = script[attempt.attemptNo - 1];
  if (step === undefined || step.outcome === 'success') {
    return { outcome: 'success', providerDeliveryRef: providerDeliveryRefOf(request, attempt) };
  }
  if (step.outcome === 'retryable') {
    return { outcome: 'retryable', detail: step.detail };
  }
  return { outcome: 'terminal', detail: step.detail };
}
