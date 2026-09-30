/**
 * @epoch/client-runtime — request correlation.
 *
 * Every gateway call carries a typed correlation record; the gateway
 * records it in the correlation ledger alongside the authority delegation
 * and echoes it in the response envelope, so a client can trace one user
 * action through gateway -> kernel calls (W046 pin: "correlation ids
 * propagated through gateway -> kernel calls").
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import {
  CAUSATION_ID_PATTERN,
  CORRELATION_ID_PATTERN,
  GATEWAY_ORIGINS,
  CLIENT_RUNTIME_RECORD_VERSION,
} from './version';

export const CorrelationIdSchema = z
  .string()
  .regex(CORRELATION_ID_PATTERN, 'must be a correlation id of the form "corr:<slug>"')
  .meta({ id: 'CorrelationId', title: 'CorrelationId' });

export const CausationIdSchema = z
  .string()
  .regex(CAUSATION_ID_PATTERN, 'must be a causation id of the form "corr:<slug>"')
  .meta({ id: 'CausationId', title: 'CausationId' });

export const GatewayOriginSchema = z
  .enum(GATEWAY_ORIGINS)
  .meta({ id: 'GatewayOrigin', title: 'GatewayOrigin' });

/**
 * One request correlation: the trace identity of a single gateway call.
 * `causationId` names the originating correlation when this call was
 * caused by an earlier one (e.g. an offline queue drain causing a replay).
 */
export interface RequestCorrelation {
  readonly schemaVersion: typeof CLIENT_RUNTIME_RECORD_VERSION;
  readonly correlationId: string;
  readonly causationId?: string | undefined;
  readonly origin: 'web' | 'desktop' | 'mobile' | 'server';
  readonly issuedAt: string;
}

export const RequestCorrelationSchema = z
  .strictObject({
    schemaVersion: z.literal(CLIENT_RUNTIME_RECORD_VERSION),
    correlationId: CorrelationIdSchema,
    causationId: CausationIdSchema.optional(),
    origin: GatewayOriginSchema,
    issuedAt: TimestampSchema,
  })
  .readonly()
  .meta({ id: 'RequestCorrelation', title: 'RequestCorrelation' });

/** Total parse of a correlation record. */
export function parseRequestCorrelation(payload: unknown):
  | { ok: true; value: RequestCorrelation }
  | { ok: false; issues: readonly { path: string; message: string }[] } {
  const parsed = RequestCorrelationSchema.safeParse(payload);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.') || '/',
      message: issue.message,
    })),
  };
}
