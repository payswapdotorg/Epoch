/**
 * @epoch/web — the product contract types (W047).
 *
 * Structural mirrors of the W046 fixture bundle + gateway outcomes the
 * product renders. NO kernel imports: the web client consumes the frozen
 * @epoch/client-runtime vocabulary and structural record types only
 * (W016 feature-module convention); every mutation flows through Gateway
 * envelopes.
 */
import type { JsonValue } from '@epoch/client-runtime';

/** One product domain served by the deployment. */
export type ProductDomain = 'construction' | 'software';

/** One sign-in principal of a domain. */
export interface ProductPrincipal {
  readonly principalId: string;
  readonly displayName: string;
  readonly kind: string;
}

/** The verified authentication result returned by the sign-in boundary. */
export interface AuthenticationResultRef {
  readonly resultId: string;
  readonly resultDigest: string;
  readonly principalId: string;
  readonly outcome: 'verified' | 'failed';
}

/** The client session state (a REFERENCE, never authority). */
export interface ProductSession {
  readonly sessionId: string;
  readonly principalId: string;
  readonly tenantId: string;
  readonly domain: ProductDomain;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

/** A typed gateway error as the UI renders it. */
export interface UiGatewayError {
  readonly schemaVersion: number;
  readonly class: string;
  readonly code: string;
  readonly message: string;
  readonly operation: string;
  readonly correlationId: string;
  readonly retryable?: boolean | undefined;
  readonly details?: unknown;
}

/** A typed gateway outcome as the UI renders it. */
export interface UiGatewayOutcome {
  readonly schemaVersion: number;
  readonly correlationId: string;
  readonly outcomeDigest: string;
  readonly result: JsonValue;
  readonly replayed: boolean;
}

/** A gateway call result (typed error, never thrown). */
export type UiGatewayCallResult =
  | { readonly ok: true; readonly value: UiGatewayOutcome }
  | { readonly ok: false; readonly error: UiGatewayError };

/** The bootstrap configuration of one domain (deployment configuration). */
export interface ProductConfiguration {
  readonly domain: ProductDomain;
  readonly fixtureId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly displayName: string;
  readonly solutionTitle: string;
  readonly principals: readonly ProductPrincipal[];
  readonly committedAuthentication: AuthenticationResultRef;
  readonly records: {
    readonly solution: JsonValue;
    readonly program: JsonValue;
    readonly delivery: JsonValue;
    readonly evidence: JsonValue;
    readonly scenarioJ07: JsonValue;
    readonly scenarioJ08: JsonValue;
    readonly scenarioJ11: JsonValue;
  };
  readonly anchors: { readonly worldDigest: string };
  readonly templates: {
    readonly constraint: {
      readonly compiledConstraint: JsonValue;
      readonly inputName: string;
      readonly limit: number;
      readonly unit: string;
    };
    readonly discovery: {
      readonly input: JsonValue;
      readonly candidates: JsonValue;
    };
    readonly action: {
      readonly proposal: JsonValue;
      readonly approvalRole: string;
      readonly approverPrincipal: string;
      readonly policySet: JsonValue;
    };
    readonly procurement: JsonValue;
    readonly outcomeRecord: JsonValue;
    readonly escalationPolicy: JsonValue;
    readonly entitlementLedger: JsonValue;
    readonly supervisionThresholds: JsonValue;
  };
}

/** One queued offline intent as persisted in localStorage. */
export interface PersistedIntent {
  readonly queueId: string;
  readonly sessionId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly operation: string;
  readonly payload: JsonValue;
  readonly enqueuedAt: string;
  readonly state: 'pending' | 'draining' | 'drained' | 'rejected';
  readonly attempts: number;
  readonly lastErrorCode?: string | undefined;
}
