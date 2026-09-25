/**
 * The authorization decision point (W009).
 *
 * Authorization is a DECISION POINT, not a policy engine (architecture
 * direction, binding): the typed fail-closed pipeline over opaque
 * principal/tenant/resource ids, with all external knowledge supplied
 * by the host-wired {@link AuthorizationFacts} interface (the W022
 * Action Gateway / W014 app shell wire @epoch/identity,
 * @epoch/tenancy, and @epoch/policy-contracts behind it — zero runtime
 * coupling; the devDependency parity tests prove the kernel shapes
 * compose).
 *
 * Decision pipeline (fixed order, deterministic, total — never throws):
 *
 * 1. schema validation — the request must be a well-formed
 *    AuthorizationRequest (typed `validation` issues; strict objects
 *    reject unknown — vendor/provider — fields);
 * 2. principal resolution — the facts must know the principal, else
 *    typed `unknown-principal` (an identity problem, never a policy
 *    deny);
 * 3. tenant resolution — the facts must know the tenant scope, else
 *    typed `unknown-tenant`;
 * 4. TENANT ISOLATION (R12 security boundary) — the principal must be a
 *    member of the request's tenant scope, else typed
 *    `cross-tenant-denied`: cross-tenant authorization is DENIED with a
 *    typed error BY CONSTRUCTION — there is no code path that turns a
 *    cross-tenant request into an allow;
 * 5. policy evaluation — deferred to the host-wired facts over the
 *    W004-compatible target projection:
 *    - `allow`   -> allow decision  (principal-verified, tenant-verified,
 *                   policy-allows + policy reason details, evidence paths);
 *    - `deny`    -> deny decision   (policy-denies + details, evidence);
 *    - `not-applicable` -> not-applicable decision (no-applicable-policy);
 *    - `failed`  -> typed `evaluation-failed` error — fail closed,
 *      distinguishable from a policy deny (an infrastructure failure is
 *      not a decision; the consumer may retry, never proceed);
 *    - NO policy source wired at all -> typed `not-applicable` error
 *      (nothing applies; no authorization is granted).
 *
 * Determinism: no clocks, no randomness — deciding the same request
 * twice against the same facts yields byte-identical records (the
 * optional `decidedAt` is caller-supplied). Every issued decision is
 * content-addressed: the record's `decisionDigest` is the SHA-256 of
 * the decision's canonical JSON.
 */
import { TimestampSchema, canonicalDigest } from '@epoch/agent-protocol';
import type { JsonValue, Timestamp } from '@epoch/agent-protocol';
import { AuthorizationRequestSchema, EvidencePathSchema } from './schema';
import { validationError } from './issues';
import type {
  AuthorizationDecision,
  AuthorizationError,
  AuthorizationFacts,
  AuthorizationRecord,
  AuthorizationRequest,
  AuthorizationResult,
  DecisionReason,
  EvidencePath,
  PolicyTargetProjection,
} from './types';

/** Options for `decide` (caller-supplied only; no clocks inside). */
export interface DecideOptions {
  /** Optional canonical UTC instant stamped on the decision (audit). */
  readonly decidedAt?: Timestamp;
}

function ok(value: AuthorizationRecord): AuthorizationResult<AuthorizationRecord> {
  return { ok: true, value };
}

function fail(error: AuthorizationError): AuthorizationResult<AuthorizationRecord> {
  return { ok: false, error };
}

/** Validate an optional caller-supplied decision timestamp (typed, total). */
function validateDecidedAt(
  decidedAt: Timestamp | undefined,
): { ok: true; value: Timestamp | undefined } | { ok: false; error: AuthorizationError } {
  if (decidedAt === undefined) {
    return { ok: true, value: undefined };
  }
  const parsed = TimestampSchema.safeParse(decidedAt);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Validate evidence-path records from the facts (typed, total). */
function validateEvidencePaths(
  evidencePaths: readonly EvidencePath[] | undefined,
):
  | { ok: true; value: readonly EvidencePath[] }
  | { ok: false; error: AuthorizationError } {
  if (evidencePaths === undefined) {
    return { ok: true, value: [] };
  }
  const valid: EvidencePath[] = [];
  for (const path of evidencePaths) {
    const parsed = EvidencePathSchema.safeParse(path);
    if (!parsed.success) {
      return { ok: false, error: validationError(parsed.error) };
    }
    valid.push(parsed.data);
  }
  return { ok: true, value: valid };
}

/**
 * Project a validated request onto the W004-compatible policy-target
 * shape ({@link PolicyTargetProjection}): exactly what
 * `@epoch/policy-contracts` policy targets admit (pinned by the
 * devDependency parity tests). The host wires this projection into the
 * facts' policy evaluation.
 */
export function projectPolicyTarget(
  request: AuthorizationRequest,
): PolicyTargetProjection {
  const target: {
    tenantId: string;
    workspaceId?: string;
    projectId?: string;
    actionKind: string;
    resourceType: string;
    tags?: readonly string[];
  } = {
    tenantId: request.tenantId,
    actionKind: request.actionKind,
    resourceType: request.resource.resourceType,
  };
  if (request.context?.workspaceId !== undefined) {
    target.workspaceId = request.context.workspaceId;
  }
  if (request.context?.projectId !== undefined) {
    target.projectId = request.context.projectId;
  }
  if (request.context?.tags !== undefined) {
    target.tags = request.context.tags;
  }
  return target;
}

/** Typed policy-side reason texts -> typed decision reasons with a code. */
function policyReasons(
  code: 'policy-allows' | 'policy-denies' | 'no-applicable-policy',
  details: readonly string[],
): DecisionReason[] {
  return details.map((detail): DecisionReason => ({ code, detail }));
}

/**
 * The authorization decision point. Construct with host-wired
 * {@link AuthorizationFacts}; `decide` runs the fail-closed pipeline and
 * returns either a content-addressed decision record or a typed error.
 */
export class AuthorizationDecisionPoint {
  constructor(private readonly facts: AuthorizationFacts) {}

  /**
   * Decide one authorization request (total, never throws). The request
   * may be a parsed {@link AuthorizationRequest} or a serialized
   * document (validated first — typed `validation` issues on failure).
   */
  decide(
    request: unknown,
    options: DecideOptions = {},
  ): AuthorizationResult<AuthorizationRecord> {
    const parsed = AuthorizationRequestSchema.safeParse(request);
    if (!parsed.success) {
      return fail(validationError(parsed.error));
    }
    const validated = parsed.data;
    const decidedAt = validateDecidedAt(options.decidedAt);
    if (!decidedAt.ok) {
      return fail(decidedAt.error);
    }

    // 1. Principal resolution (identity is host-wired; unknown is an
    //    identity problem, never a policy deny).
    const principal = this.facts.resolvePrincipal(validated.principalId);
    if (!principal.known) {
      return fail({
        code: 'unknown-principal',
        message: `principal "${validated.principalId}" is not known to the authorization facts`,
        path: ['principalId'],
        principalId: validated.principalId,
      });
    }

    // 2. Tenant resolution (the tenancy hierarchy is host-wired).
    const tenant = this.facts.resolveTenant(validated.tenantId);
    if (!tenant.known) {
      return fail({
        code: 'unknown-tenant',
        message: `tenant "${validated.tenantId}" is not known to the authorization facts`,
        path: ['tenantId'],
        tenantId: validated.tenantId,
      });
    }

    // 3. Tenant isolation — cross-tenant authorization is DENIED with a
    //    typed error by construction (R12): no path from here to an
    //    allow exists for a non-member principal.
    if (!principal.memberTenants.includes(validated.tenantId)) {
      return fail({
        code: 'cross-tenant-denied',
        message:
          `principal "${validated.principalId}" is not a member of tenant "${validated.tenantId}" ` +
          '(member of: ' +
          (principal.memberTenants.length === 0
            ? 'no tenants'
            : [...principal.memberTenants].sort().join(', ')) +
          ') — cross-tenant authorization is denied',
        path: ['tenantId'],
        principalId: validated.principalId,
        tenantId: validated.tenantId,
        memberTenants: principal.memberTenants,
      });
    }

    // Principal-verification evidence (host-wired authentication
    // results, validated through the strict evidence-path schema).
    const principalEvidence = validateEvidencePaths(principal.evidencePaths);
    if (!principalEvidence.ok) {
      return fail(principalEvidence.error);
    }

    // 4. Policy evaluation — deferred to the host-wired facts over the
    //    W004-compatible projection. No source wired: fail closed with
    //    a typed not-applicable error (nothing applies; no
    //    authorization is granted).
    const evaluatePolicy = this.facts.evaluatePolicy;
    if (evaluatePolicy === undefined) {
      return fail({
        code: 'not-applicable',
        message:
          'no policy source is wired to this decision point — nothing applies and no authorization is granted (fail closed)',
        path: ['actionKind'],
        principalId: validated.principalId,
        tenantId: validated.tenantId,
      });
    }
    const target = projectPolicyTarget(validated);
    const evaluation = evaluatePolicy(validated, target);

    const engineSteps: DecisionReason[] = [
      { code: 'principal-verified' },
      { code: 'tenant-verified' },
    ];
    const base = {
      schemaVersion: 1 as const,
      requestId: validated.requestId,
      principalId: validated.principalId,
      tenantId: validated.tenantId,
      resource: validated.resource,
      actionKind: validated.actionKind,
      ...(decidedAt.value === undefined ? {} : { decidedAt: decidedAt.value }),
    };

    switch (evaluation.outcome) {
      case 'allow': {
        const policyEvidence = validateEvidencePaths(evaluation.evidencePaths);
        if (!policyEvidence.ok) {
          return fail(policyEvidence.error);
        }
        const decision: AuthorizationDecision = {
          ...base,
          outcome: 'allow',
          reasons: [
            ...engineSteps,
            ...policyReasons('policy-allows', evaluation.reasons),
          ],
          evidencePaths: [...principalEvidence.value, ...policyEvidence.value],
        };
        return ok(seal(decision));
      }
      case 'deny': {
        const policyEvidence = validateEvidencePaths(evaluation.evidencePaths);
        if (!policyEvidence.ok) {
          return fail(policyEvidence.error);
        }
        const decision: AuthorizationDecision = {
          ...base,
          outcome: 'deny',
          reasons: [...engineSteps, ...policyReasons('policy-denies', evaluation.reasons)],
          evidencePaths: [...principalEvidence.value, ...policyEvidence.value],
        };
        return ok(seal(decision));
      }
      case 'not-applicable': {
        const decision: AuthorizationDecision = {
          ...base,
          outcome: 'not-applicable',
          reasons: [
            ...engineSteps,
            ...policyReasons('no-applicable-policy', evaluation.reasons),
          ],
          evidencePaths: [...principalEvidence.value],
        };
        return ok(seal(decision));
      }
      case 'failed': {
        return fail({
          code: 'evaluation-failed',
          message:
            'policy evaluation failed for the request (fail closed — an evaluation failure is not an authorization)',
          path: ['actionKind'],
          reasons: evaluation.reasons,
        });
      }
    }
  }
}

/** Content-address a decision into its published record (digest inside). */
function seal(decision: AuthorizationDecision): AuthorizationRecord {
  return {
    schemaVersion: 1,
    decision,
    decisionDigest: canonicalDigest(decision as unknown as JsonValue),
  };
}
