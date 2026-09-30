/**
 * @epoch/web — the client envelope builders (W047).
 *
 * Typed constructors for `GatewayRequestEnvelope`s over the frozen
 * @epoch/client-runtime vocabulary. Correlation ids, idempotency keys and
 * nonces are client-generated slugs (the id grammars are enforced by the
 * gateway); payloads are JSON values validated by the owning authorities.
 */
import { isMutatingOperation, type GatewayOperationName, type GatewayRequestEnvelope, type JsonValue } from '@epoch/client-runtime';
import type { ProductSession } from '../product/types';

/** A lowercase slug generator (correlation/idempotency/nonce grammars). */
export function slug(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.slice(0, 50);
}

let counter = 0;

/** A unique-enough suffix (no wall-clock dependence in the id itself). */
function unique(): string {
  counter = (counter + 1) % 1_000_000;
  return `${Date.now().toString(36)}${counter.toString(36)}`;
}

/** A fresh correlation id. */
export function correlationId(seed: string): string {
  return `corr:${slug(seed)}-${unique()}`;
}

/** A fresh idempotency key. */
export function idempotencyKey(seed: string): string {
  return `idem:${slug(seed)}-${unique()}`;
}

/** The base envelope builder shared by every UI affordance. */
export function envelope(
  operation: GatewayOperationName,
  session: Pick<ProductSession, 'sessionId' | 'tenantId'>,
  payload: JsonValue,
  options?: {
    readonly correlation?: string | undefined;
    readonly idempotencyKey?: string | undefined;
  },
): GatewayRequestEnvelope {
  return {
    schemaVersion: 1,
    contractVersion: '1.0.0',
    operation,
    session: { schemaVersion: 1, sessionId: session.sessionId },
    correlation: {
      schemaVersion: 1,
      correlationId: options?.correlation ?? correlationId(operation),
      causationId: options?.correlation ?? correlationId(operation),
      origin: 'web',
      issuedAt: new Date().toISOString(),
    },
    tenant: { tenantId: session.tenantId },
    ...(isMutatingOperation(operation)
      ? { idempotencyKey: options?.idempotencyKey ?? idempotencyKey(operation) }
      : {}),
    payload,
  };
}
