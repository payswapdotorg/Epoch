/**
 * The reference in-memory principal directory (W009).
 *
 * Owns (and only owns): principal registration, principal lifecycle
 * governance (`active <-> suspended <-> disabled`), deterministic
 * listing, and authentication-result handling
 * (`verifyAuthentication`).
 *
 * Explicitly NOT (adapters / later Work Orders / out of scope): identity
 * PROVIDERS (zero concrete IdPs, OAuth vendors, OIDC clients — lock rule
 * 13: those are future adapters), networks (zero requests), credential
 * material (ZERO secrets/tokens — the directory stores typed assertion
 * descriptors and results, never the credentials themselves), tenancy
 * membership (identity != tenancy, lock rule 12), sessions/tokens
 * issuance, authorization decisions (@epoch/authorization).
 *
 * Security boundary (typed, tested): a principal that is not `active`
 * NEVER authenticates — `verifyAuthentication` rejects suspended and
 * disabled principals with `principal-inactive` even when the
 * authentication result is `verified`. The record's own lifecycle is
 * enforced with a typed transition table (self-transitions and unknown
 * states are impossible; illegal transitions are `lifecycle-conflict`).
 *
 * Every entry point is total (typed errors, never thrown). No clocks, no
 * randomness: identical operation sequences produce identical states.
 * Iteration is always sorted (no insertion-order leaks).
 */
import { PrincipalSchema } from './schema';
import { AuthenticationResultSchema } from './schema';
import { validationError } from './issues';
import { PRINCIPAL_LIFECYCLE_TRANSITIONS } from './version';
import type { PrincipalLifecycleState, PrincipalKind } from './version';
import type {
  AuthenticationReason,
  IdentityError,
  IdentityResult,
  Principal,
  PrincipalId,
  VerifiedPrincipal,
} from './types';

/** Input of `register`: the principal's identity and class. */
export interface RegisterPrincipalInput {
  /** Typed principal id (`principal:` + slug). */
  readonly principalId: string;
  readonly kind: PrincipalKind;
  readonly displayName: string;
  readonly description?: string;
}

function ok<T>(value: T): IdentityResult<T> {
  return { ok: true, value };
}

function fail<T>(error: IdentityError): IdentityResult<T> {
  return { ok: false, error };
}

const unknownPrincipal = (principalId: PrincipalId): IdentityError => ({
  code: 'unknown-principal',
  message: `no principal registered with id "${principalId}"`,
  path: ['principalId'],
  principalId,
});

const byId = (a: Principal, b: Principal): number =>
  a.principalId < b.principalId ? -1 : a.principalId > b.principalId ? 1 : 0;

function describeTransitions(state: PrincipalLifecycleState): string {
  const next = PRINCIPAL_LIFECYCLE_TRANSITIONS[state];
  return next.length === 0
    ? 'none (terminal state)'
    : next.map((s) => `${state} -> ${s}`).join(', ');
}

/**
 * The reference principal directory. Construct directly
 * (`new PrincipalDirectory()`).
 */
export class PrincipalDirectory {
  /** principalId -> principal. Maps iterate in insertion order; every
   * read path sorts before exposing anything. */
  private readonly store = new Map<PrincipalId, Principal>();

  /** Number of registered principals (all lifecycle states). */
  get size(): number {
    return this.store.size;
  }

  /**
   * Register a new principal (admitted in the `active` state).
   * Admission pipeline (total, never throws):
   *
   * 1. schema validation — the typed id pattern, the closed kind
   *    vocabulary, bounded display fields (strict objects reject unknown
   *    — vendor/provider — fields);
   * 2. duplicate check — the principal id must be free, else
   *    `duplicate-principal` (a returning principal re-activates through
   *    lifecycle transitions, never re-registration).
   */
  register(input: RegisterPrincipalInput): IdentityResult<Principal> {
    const candidate: unknown = {
      schemaVersion: 1,
      principalId: input.principalId,
      kind: input.kind,
      status: 'active',
      displayName: input.displayName,
      ...(input.description === undefined ? {} : { description: input.description }),
    };
    const parsed = PrincipalSchema.safeParse(candidate);
    if (!parsed.success) {
      return fail(validationError(parsed.error));
    }
    if (this.store.has(parsed.data.principalId)) {
      return fail({
        code: 'duplicate-principal',
        message: `principal "${parsed.data.principalId}" is already registered — lifecycle transitions never re-register`,
        path: ['principalId'],
        principalId: parsed.data.principalId,
      });
    }
    this.store.set(parsed.data.principalId, parsed.data);
    return ok(parsed.data);
  }

  /** Retrieve a principal by id (any lifecycle state). */
  get(principalId: string): IdentityResult<Principal> {
    const principal = this.store.get(principalId);
    if (principal === undefined) {
      return fail(unknownPrincipal(principalId));
    }
    return ok(principal);
  }

  /**
   * All principals sorted by principalId ascending — independent of
   * registration order. Optional kind/lifecycle filters.
   */
  list(
    filter: { kind?: PrincipalKind; status?: PrincipalLifecycleState } = {},
  ): readonly Principal[] {
    const principals = [...this.store.values()].filter(
      (principal) =>
        (filter.kind === undefined || principal.kind === filter.kind) &&
        (filter.status === undefined || principal.status === filter.status),
    );
    principals.sort(byId);
    return principals;
  }

  /** Suspend a principal (reversible bar — still registered, never authenticates). */
  suspend(principalId: string): IdentityResult<Principal> {
    return this.transition(principalId, 'suspended');
  }

  /** Disable a principal (barred; the record is retained for audit). */
  disable(principalId: string): IdentityResult<Principal> {
    return this.transition(principalId, 'disabled');
  }

  /** (Re-)activate a principal (explicit transition, auditable). */
  activate(principalId: string): IdentityResult<Principal> {
    return this.transition(principalId, 'active');
  }

  private transition(
    principalId: string,
    to: PrincipalLifecycleState,
  ): IdentityResult<Principal> {
    const principal = this.store.get(principalId);
    if (principal === undefined) {
      return fail(unknownPrincipal(principalId));
    }
    if (!PRINCIPAL_LIFECYCLE_TRANSITIONS[principal.status].includes(to)) {
      return fail({
        code: 'lifecycle-conflict',
        message: `illegal lifecycle transition ${principal.status} -> ${to} for principal "${principalId}" (legal transitions: ${describeTransitions(principal.status)})`,
        path: ['status'],
        from: principal.status,
        to,
      });
    }
    const updated: Principal = { ...principal, status: to };
    this.store.set(principalId, updated);
    return ok(updated);
  }

  /**
   * Handle an authentication result for a principal (typed, total).
   * Fail-closed pipeline:
   *
   * 1. the RESULT document is schema-validated (typed `validation`
   *    issues; a `failed` outcome must carry reasons);
   * 2. the result must be for a REGISTERED principal
   *    (`unknown-principal`);
   * 3. the result's principal must MATCH the directory's principal —
   *    lookups key on the result's own `principalId`, so a mismatch is
   *    impossible here by construction (no cross-principal injection);
   * 4. a `failed` outcome is surfaced as typed `authentication-failed`
   *    with the record's reasons;
   * 5. the principal must be `active` — suspended and disabled
   *    principals NEVER authenticate (`principal-inactive`, the
   *    security boundary), even on a `verified` result;
   * 6. a `verified` result for an active principal yields the
   *    {@link VerifiedPrincipal} record (the exact assertion/result ids
   *    for downstream evidence wiring).
   */
  verifyAuthentication(result: unknown): IdentityResult<VerifiedPrincipal> {
    const parsed = AuthenticationResultSchema.safeParse(result);
    if (!parsed.success) {
      return fail(validationError(parsed.error));
    }
    const record = parsed.data;
    const principal = this.store.get(record.principalId);
    if (principal === undefined) {
      return fail(unknownPrincipal(record.principalId));
    }
    if (record.outcome === 'failed') {
      return fail({
        code: 'authentication-failed',
        message: `authentication failed for principal "${record.principalId}" (assertion "${record.assertionId}")`,
        path: ['outcome'],
        principalId: record.principalId,
        reasons: record.reasons as readonly AuthenticationReason[],
      });
    }
    if (principal.status !== 'active') {
      return fail({
        code: 'principal-inactive',
        message: `principal "${record.principalId}" is ${principal.status} — ${principal.status} principals never authenticate`,
        path: ['status'],
        principalId: record.principalId,
        status: principal.status,
      });
    }
    return ok({
      principalId: principal.principalId,
      principal,
      assertionId: record.assertionId,
      resultId: record.resultId,
      verifiedAt: record.verifiedAt,
      reasons: record.reasons as readonly AuthenticationReason[],
    });
  }
}
