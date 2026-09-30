/**
 * @epoch/web — the gateway transport (W047).
 *
 * The single client -> `/api/gateway` seam: POSTs a typed
 * `GatewayRequestEnvelope`, parses the typed outcome/error envelope, and
 * maps network failures to the client-runtime transient error taxonomy
 * with the retry-with-backoff recovery action (J11 connector-failure
 * semantics: the SAME correlation id is reused across retries — the
 * causation chain survives recovery).
 */
import { GatewayOutcomeSchema, clientRecoveryAction } from '@epoch/client-runtime';
import type { GatewayCallResult, GatewayRequestEnvelope, GatewayOutcome, GatewayError } from '@epoch/client-runtime';
import type { UiGatewayCallResult, UiGatewayError } from '../product/types';

const GATEWAY_ENDPOINT = '/api/gateway';
const NETWORK_RETRIES = 2;
const RETRY_DELAY_MS = 400;

/** The network-failure error (typed transient, retry-with-backoff). */
export function networkTransientError(operation: string, correlationId: string): UiGatewayError {
  const error: GatewayError = {
    schemaVersion: 1,
    class: 'transient',
    code: 'network-unavailable',
    message: 'the gateway could not be reached (network unavailable)',
    operation,
    correlationId,
    retryable: true,
  };
  return error as unknown as UiGatewayError;
}

function asUiError(error: GatewayError): UiGatewayError {
  return error as unknown as UiGatewayError;
}

/** One raw POST; returns the typed JSON result or throws on network failure. */
async function postOnce(request: GatewayRequestEnvelope): Promise<GatewayCallResult> {
  const response = await fetch(GATEWAY_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    cache: 'no-store',
  });
  const body = (await response.json()) as unknown;
  if (!response.ok && typeof body === 'object' && body !== null && 'error' in body) {
    // Endpoint-level rejections (malformed body / unknown tenant) are
    // already typed gateway errors.
    return { ok: false, error: (body as { error: GatewayError }).error };
  }
  return body as GatewayCallResult;
}

/**
 * The typed gateway call with bounded retry-with-backoff on NETWORK
 * failures only (the correlation id — and thus the causation chain — is
 * reused verbatim across retries). Typed authority errors are returned
 * as-is, never retried.
 */
export async function callGateway(
  request: GatewayRequestEnvelope,
  options?: { readonly retries?: number },
): Promise<UiGatewayCallResult> {
  const retries = options?.retries ?? NETWORK_RETRIES;
  let attempt = 0;
  for (;;) {
    try {
      const result = await postOnce(request);
      if (result.ok) {
        const parsed = GatewayOutcomeSchema.safeParse(result.value);
        if (!parsed.success) {
          return {
            ok: false,
            error: asUiError({
              schemaVersion: 1,
              class: 'unrecoverable',
              code: 'response-malformed',
              message: 'the gateway outcome failed schema validation',
              operation: request.operation,
              correlationId: request.correlation.correlationId,
              retryable: false,
            }),
          };
        }
        return { ok: true, value: parsed.data as GatewayOutcome };
      }
      return { ok: false, error: asUiError(result.error) };
    } catch {
      if (attempt >= retries) {
        return {
          ok: false,
          error: networkTransientError(
            request.operation,
            request.correlation.correlationId,
          ),
        };
      }
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
}

/** The recovery action of an error (the client taxonomy mapping). */
export function recoveryActionOf(error: UiGatewayError): string {
  return clientRecoveryAction(error as unknown as Parameters<typeof clientRecoveryAction>[0]);
}
