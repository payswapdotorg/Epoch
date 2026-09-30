'use client';
/**
 * @epoch/web — the client gateway hook (W047).
 *
 * The single React seam every product surface uses to exercise Gateway
 * operations: builds typed envelopes (the derivation module supplies
 * payloads), calls the transport, and exposes busy/error/outcome state.
 * Session-expiry errors flip the session provider to the re-auth surface
 * (J11); transient errors can be enqueued to the offline queue by the
 * caller (J07).
 */
import { useCallback, useRef, useState } from 'react';
import type { GatewayOperationName, GatewayRequestEnvelope, JsonValue } from '@epoch/client-runtime';
import { callGateway } from './transport';
import { envelope } from './envelopes';
import { useSession } from './session';
import type { ProductConfiguration, UiGatewayCallResult } from '../product/types';

export interface GatewayCallState {
  readonly busy: boolean;
  readonly result: UiGatewayCallResult | null;
}

/** The gateway hook: bound to the active session + configuration. */
export function useGateway(): {
  readonly session: NonNullable<ReturnType<typeof useSession>['session']>;
  readonly configuration: ProductConfiguration;
  call(
    operation: GatewayOperationName,
    payload: JsonValue,
    options?: {
      readonly correlation?: string;
      readonly idempotencyKey?: string;
    },
  ): Promise<UiGatewayCallResult>;
} {
  const { session, configuration, revalidate } = useSession();
  if (session === null) throw new Error('useGateway requires an active session');
  if (configuration === null) throw new Error('useGateway requires loaded configuration');

  const call = useCallback(
    async (
      operation: GatewayOperationName,
      payload: JsonValue,
      options?: { readonly correlation?: string; readonly idempotencyKey?: string },
    ): Promise<UiGatewayCallResult> => {
      const request: GatewayRequestEnvelope = envelope(operation, session, payload, options);
      const result = await callGateway(request);
      if (!result.ok && result.error.class === 'auth-session-expired') {
        await revalidate();
      }
      return result;
    },
    [session, revalidate],
  );

  return { session, configuration, call };
}

/** One-shot call state manager for simple affordances. */
export function useGatewayCall(): GatewayCallState & {
  run(
    operation: GatewayOperationName,
    payload: JsonValue,
  ): Promise<UiGatewayCallResult | null>;
  reset(): void;
} {
  const [state, setState] = useState<GatewayCallState>({ busy: false, result: null });
  const gate = useRef<(() => void) | null>(null);
  const { session, configuration, call } = useGateway();
  void session;
  void configuration;

  const run = useCallback(
    async (operation: GatewayOperationName, payload: JsonValue): Promise<UiGatewayCallResult | null> => {
      if (gate.current !== null) return null;
      gate.current = () => undefined;
      setState({ busy: true, result: null });
      try {
        const result = await call(operation, payload);
        setState({ busy: false, result });
        return result;
      } finally {
        gate.current = null;
      }
    },
    [call],
  );

  const reset = useCallback(() => setState({ busy: false, result: null }), []);

  return { ...state, run, reset };
}
