/**
 * The W009 authorization gate the bridge runtime consumes BEFORE any
 * kernel admission (the W042 dispatch pin: "W009 authorization gate
 * before kernel admission; tenant-isolation-rejected").
 *
 * The bridge CONSUMES the authorization decision point; it never
 * re-implements authorization (lock rule 12: identity != tenancy !=
 * authorization != policy). Because the frozen runtime dependency
 * policy of this kernel admits only @epoch/adapter-sdk,
 * @epoch/agent-protocol, @epoch/tenancy and zod, the W009 request/
 * decision shapes arrive as a STRUCTURAL MIRROR:
 *
 * - `BridgeAuthorizationRequest` mirrors @epoch/authorization's
 *   `AuthorizationRequest` member-for-member (compile-time `Equals` pin
 *   in src/parity.ts; runtime digest pin in test/parity.test.ts — the
 *   bridge's request digest equals the REAL
 *   `computeAuthorizationRequestDigest` over the same request);
 * - `BridgeAuthorizationDecision` is the minimal structural subset every
 *   real W009 decision satisfies (requestDigest + outcome), so a real
 *   `AllowDecision` / `DenyDecision` / `NotApplicableDecision` is
 *   assignable to it directly.
 *
 * The gate is strictly ordered and total: a missing or unverifiable
 * decision is `authorization-bypass-rejected` (the decision point
 * ALWAYS precedes the bridge stage); a digest mismatch is
 * `authorization-bypass-rejected` (a decision never covers another
 * request); a non-allow outcome is `authorization-bypass-rejected`;
 * an untenanted resource is `authorization-bypass-rejected`; a tenant
 * mismatch between the decision's resource scope and the record under
 * admission is `tenant-isolation-rejected` (R12).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { ProjectIdSchema, TenantIdSchema, WorkspaceIdSchema } from '@epoch/tenancy';
import { BridgePrincipalIdSchema, Sha256HexSchema } from './primitives';
import { classifiedParseError } from './issues';
import type { BridgeResult } from './errors';

/**
 * The typed bridge action kinds the W009 decision must cover (opaque to
 * the authorization kernel — W003/W009 never interprets them).
 */
export const BRIDGE_ACTION_KINDS = [
  'bridge.provider-registration',
  'bridge.event-intake',
  'bridge.request-dispatch',
] as const;

/** One bridge action kind. */
export type BridgeActionKind = (typeof BRIDGE_ACTION_KINDS)[number];

/** Opaque scope strings, bounded like the W004 policy-target strings. */
const ScopeStringSchema = z.string().min(1).max(256);

/**
 * The tenancy-scoped resource a bridge operation acts on — the W009
 * `ResourceReference` STRUCTURAL MIRROR (scope chain complete: a
 * workspace requires a tenant; a project requires a workspace).
 */
export const BridgeResourceReferenceSchema = z
  .strictObject({
    resourceType: ScopeStringSchema,
    resourceId: ScopeStringSchema,
    tenantId: TenantIdSchema.optional(),
    workspaceId: WorkspaceIdSchema.optional(),
    projectId: ProjectIdSchema.optional(),
  })
  .readonly()
  .superRefine((resource, ctx) => {
    if (resource.workspaceId !== undefined && resource.tenantId === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'the scope chain must be complete: a workspace requires a tenant',
        path: ['workspaceId'],
      });
    }
    if (resource.projectId !== undefined && resource.workspaceId === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'the scope chain must be complete: a project requires a workspace',
        path: ['projectId'],
      });
    }
  })
  .meta({
    id: 'BridgeResourceReference',
    title: 'BridgeResourceReference',
    description:
      'The tenancy-scoped resource a bridge operation acts on (the W009 ResourceReference structural mirror): opaque type and id plus the optional tenant/workspace/project scope.',
  });

/** One bridge resource reference. */
export type BridgeResourceReference = z.infer<typeof BridgeResourceReferenceSchema>;

/**
 * The authorization request the gate consumes — the W009
 * `AuthorizationRequest` STRUCTURAL MIRROR (Equals-pinned in
 * src/parity.ts against @epoch/authorization, a devDependency).
 */
export const BridgeAuthorizationRequestSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    principalId: BridgePrincipalIdSchema,
    actionKind: ScopeStringSchema,
    resource: BridgeResourceReferenceSchema,
    justification: z.string().min(1).max(10000).optional(),
  })
  .readonly()
  .meta({
    id: 'BridgeAuthorizationRequest',
    title: 'BridgeAuthorizationRequest',
    description:
      'The authorization request the bridge gate consumes (the W009 AuthorizationRequest structural mirror): principal id, opaque action kind, tenancy-scoped resource, optional justification.',
  });

/** One bridge authorization request. */
export type BridgeAuthorizationRequest = z.infer<typeof BridgeAuthorizationRequestSchema>;

/**
 * The minimal structural decision subset the gate consumes: the digest
 * of the exact request revision this decision answers plus its outcome.
 * Every REAL W009 decision (allow/deny/not-applicable) is assignable to
 * this shape — the bridge never re-validates the decision's own
 * reasons/evidence (that is the decision point's authority).
 */
export const BridgeAuthorizationDecisionSchema = z
  .strictObject({
    requestDigest: Sha256HexSchema,
    outcome: z.enum(['allow', 'deny', 'not-applicable']),
  })
  .readonly()
  .meta({
    id: 'BridgeAuthorizationDecision',
    title: 'BridgeAuthorizationDecision',
    description:
      'The structural authorization-decision subset the bridge gate consumes: the covered request digest plus the outcome (every real W009 decision is assignable to this shape).',
  });

/** One bridge authorization decision (the structural subset). */
export type BridgeAuthorizationDecision = z.infer<typeof BridgeAuthorizationDecisionSchema>;

/**
 * Compute the request digest the gate compares against (the W009
 * `computeAuthorizationRequestDigest` discipline: canonical SHA-256 over
 * the validated request — runtime-parity-pinned against the REAL
 * function in test/parity.test.ts).
 */
export function computeBridgeAuthorizationRequestDigest(
  request: BridgeAuthorizationRequest,
): string {
  return canonicalDigest(request as unknown as JsonValue);
}

/** The verified admission pair the gate returns on success. */
export interface BridgeAuthorizationAdmission {
  readonly request: BridgeAuthorizationRequest;
  readonly decision: BridgeAuthorizationDecision;
}

/** The input of {@link admitBridgeOperation}. */
export interface BridgeAuthorizationGateInput {
  /** The W009-shaped request the decision answers. */
  readonly request: unknown;
  /** The sealed prior W009 decision subset (requestDigest + outcome). */
  readonly decision: unknown;
  /** The tenant of the record under admission (the R12 pin). */
  readonly expectedTenantId: string;
}

/**
 * The W009 gate: verify a prior decision covers the EXACT request, the
 * outcome is `allow`, and the decision's resource scope is the record's
 * tenant. Total, deterministic, zero I/O.
 *
 * The decision is consumed STRUCTURALLY: the bridge reads the subset
 * it owns (requestDigest + outcome) from the incoming object — every
 * REAL W009 decision (allow/deny/not-applicable) satisfies this shape
 * while carrying the decision point's own fields (reasons, evidence,
 * schema version), which are NOT re-validated here (that is the
 * decision point's authority, never the bridge's).
 */
export function admitBridgeOperation(
  input: BridgeAuthorizationGateInput,
): BridgeResult<BridgeAuthorizationAdmission> {
  if (typeof input.decision !== 'object' || input.decision === null) {
    return {
      ok: false,
      error: {
        code: 'authorization-bypass-rejected',
        message:
          'the bridge refuses an operation without a prior W009 decision record — the decision point always precedes the bridge stage',
        reason: 'decision-missing',
      },
    };
  }
  // Structural subset extraction (the fields this gate owns):
  const incoming = input.decision as { requestDigest?: unknown; outcome?: unknown };
  const decisionParsed = BridgeAuthorizationDecisionSchema.safeParse({
    requestDigest: incoming.requestDigest,
    outcome: incoming.outcome,
  });
  if (!decisionParsed.success) {
    return {
      ok: false,
      error: {
        code: 'authorization-bypass-rejected',
        message: `the prior W009 decision is not verifiable (${decisionParsed.error.issues.length} issue(s)) — the bridge never guesses a decision`,
        reason: 'decision-unverifiable',
      },
    };
  }
  const decision = decisionParsed.data;

  const requestParsed = BridgeAuthorizationRequestSchema.safeParse(input.request);
  if (!requestParsed.success) {
    return { ok: false, error: classifiedParseError(requestParsed.error) };
  }
  const request = requestParsed.data;

  const requestDigest = computeBridgeAuthorizationRequestDigest(request);
  if (requestDigest !== decision.requestDigest) {
    return {
      ok: false,
      error: {
        code: 'authorization-bypass-rejected',
        message:
          'the prior W009 decision does not cover this exact request (requestDigest mismatch) — the bridge stage never runs on a decision minted for another request',
        reason: 'request-digest-mismatch',
      },
    };
  }
  if (decision.outcome !== 'allow') {
    return {
      ok: false,
      error: {
        code: 'authorization-bypass-rejected',
        message: `the prior W009 decision outcome is "${decision.outcome}" — only an allow decision admits a bridge operation`,
        reason: 'decision-not-allow',
      },
    };
  }
  if (request.resource.tenantId === undefined) {
    return {
      ok: false,
      error: {
        code: 'authorization-bypass-rejected',
        message:
          'the prior W009 decision answers a platform-scoped resource — bridge operations are always tenant-scoped (R12)',
        reason: 'resource-untenanted',
      },
    };
  }
  if (request.resource.tenantId !== input.expectedTenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `the prior W009 decision covers tenant "${request.resource.tenantId}" but the record under admission belongs to tenant "${input.expectedTenantId}" (R12)`,
        expectedTenantId: input.expectedTenantId,
        encounteredTenantId: request.resource.tenantId,
      },
    };
  }
  return { ok: true, value: { request, decision } };
}
