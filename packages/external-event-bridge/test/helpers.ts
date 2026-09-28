/**
 * Shared test helpers: the W009 gate-pair builder (digest-bound through
 * the REAL canonical-JSON discipline), the total unwrap, and the
 * outbound-request builder used across the battery.
 */
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  buildOutboundRequest,
  type BridgeResult,
  type LeastPrivilegeProjection,
  type OutboundRequestContent,
  type SealedOutboundRequest,
} from '../src/index';
import type { BridgeAuthorizationPair } from '../src/runtime';
import { POLICY_DIGEST_A, PRINCIPAL, RECIPIENT_A, TENANT_A } from './fixtures';

/** Unwrap a total result or throw (test-only convenience). */
export function unwrap<T>(result: BridgeResult<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** Build a W009-shaped gate pair covering one bridge operation. */
export function gatePair(input: {
  readonly principalId?: string;
  readonly actionKind: string;
  readonly tenantId?: string;
  readonly resourceId: string;
  readonly outcome?: 'allow' | 'deny' | 'not-applicable';
  readonly digestOverride?: string | undefined;
}): BridgeAuthorizationPair {
  const request = {
    schemaVersion: 1,
    principalId: input.principalId ?? PRINCIPAL,
    actionKind: input.actionKind,
    resource: {
      resourceType: 'external-event-bridge',
      resourceId: input.resourceId,
      tenantId: input.tenantId ?? TENANT_A,
    },
    justification: 'bridge test gate',
  };
  const requestDigest =
    input.digestOverride !== undefined ? input.digestOverride : canonicalDigest(request);
  return {
    request,
    decision: { requestDigest, outcome: input.outcome ?? 'allow' },
  };
}

/** Build a sealed outbound information request from a raw payload. */
export function informationRequest(input?: {
  readonly requestId?: string;
  readonly tenantId?: string;
  readonly recipientRef?: string;
  readonly idempotencyKey?: string;
  readonly correlationId?: string;
  readonly rawPayload?: Record<string, unknown>;
  readonly projection?: LeastPrivilegeProjection;
}): SealedOutboundRequest {
  const projection = input?.projection ?? {
    policyDigest: POLICY_DIGEST_A,
    recipientRef: input?.recipientRef ?? RECIPIENT_A,
    fieldAllowlist: ['activityTitle', 'questions[].channel', 'questions[].text', 'statusSummary', 'workPackageRef'],
  };
  const base: Omit<OutboundRequestContent, 'schema' | 'schemaVersion' | 'payload' | 'projectionDigest'> = {
    requestId: input?.requestId ?? 'outbound:info-1',
    tenantId: input?.tenantId ?? TENANT_A,
    requestClass: 'information',
    recipientRef: input?.recipientRef ?? RECIPIENT_A,
    correlationId: input?.correlationId ?? 'corr:exchange-1',
    causationId: null,
    createdAt: '2026-01-05T09:01:00.000Z',
    createdBy: PRINCIPAL,
    idempotencyKey: input?.idempotencyKey ?? 'idem:dispatch-1',
  };
  const built = buildOutboundRequest(
    { ...base, rawPayload: (input?.rawPayload ?? {
      activityTitle: 'Excavate grid B4 to foundation level',
      workPackageRef: 'work-package:earthworks',
      statusSummary: 'Awaiting confirmation of achieved depth',
      questions: [{ text: 'Confirm the measured depth at grid B4', channel: 'field-report' }],
      internalCommercialNote: 'contract penalty threshold is 14 days',
      supplierIdentity: 'supplier:acme-excavation',
    }) as Record<string, never> },
    projection,
  );
  return unwrap(built);
}
