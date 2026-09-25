/**
 * The reference in-memory Identity Registry (W009).
 *
 * Owns (and only owns): principals (registration, typed lifecycle
 * active -> suspended -> deactivated) and authentication results
 * (verified/failed + typed reasons). ZERO concrete IdPs, ZERO network,
 * ZERO secrets storage — credential assertions are caller-minted neutral
 * descriptors and the registry stores only their typed outcomes.
 *
 * Explicitly NOT (other packages / later Work Orders): tenancy scopes
 * (@epoch/tenancy), membership facts and authorization decisions
 * (@epoch/authorization), policy semantics (@epoch/policy-contracts).
 * Identity != tenancy != authorization != policy (lock rule 12).
 *
 * Determinism: no clocks (timestamps are caller-supplied canonical UTC
 * instants), no randomness (ids are caller-minted), and iteration is
 * always sorted — principal listings by principalId, authentication
 * histories by (decidedAt, resultId). No insertion-order leaks.
 *
 * Admission pipeline (total, never throws): schema validation (strict
 * objects reject vendor AND secret fields), digest verification (typed
 * `digest-mismatch` on tamper), then semantic checks (`duplicate-principal`,
 * `unknown-principal`, `lifecycle-conflict`).
 */
import { PrincipalSchema } from './schema';
import { PRINCIPAL_LIFECYCLE_TRANSITIONS } from './version';
import {
  verifyAuthenticationResultDigest,
  verifyPrincipalDigest,
} from './digest';
import { validationError } from './issues';
import type {
  AuthenticationResultRecord,
  AuthenticationResultRegistration,
  IdentityError,
  IdentityResult,
  PrincipalKind,
  PrincipalLifecycleState,
  PrincipalRecord,
  PrincipalRegistration,
} from './types';

/** Filter for deterministic principal listing. */
export interface ListPrincipalsFilter {
  readonly kind?: PrincipalKind;
  readonly lifecycle?: PrincipalLifecycleState;
}

function ok<T>(value: T): IdentityResult<T> {
  return { ok: true, value };
}

function fail<T>(error: IdentityError): IdentityResult<T> {
  return { ok: false, error };
}

const unknownPrincipal = (principalId: string): IdentityError => ({
  code: 'unknown-principal',
  message: `no principal registered with id "${principalId}"`,
  principalId,
});

function describeTransitions(state: PrincipalLifecycleState): string {
  const next = PRINCIPAL_LIFECYCLE_TRANSITIONS[state];
  return next.length === 0
    ? 'none (terminal state)'
    : next.map((s) => `${state} -> ${s}`).join(', ');
}

/**
 * The reference identity registry. Construct directly
 * (`new IdentityRegistry()`) — no persistence, no events, no clocks.
 */
export class IdentityRegistry {
  /** principalId -> published principal record. Maps iterate in
   * insertion order; every read path sorts before exposing anything. */
  private readonly principals = new Map<string, PrincipalRecord>();

  /** principalId -> authentication-result records. */
  private readonly authentications = new Map<string, AuthenticationResultRecord[]>();

  /** Number of registered principals (all lifecycle states). */
  get size(): number {
    return this.principals.size;
  }

  /**
   * Register a sealed principal (see src/digest.ts for the sealing
   * helpers). Admission pipeline: schema validation, digest
   * verification, duplicate check. Returns the stored record (lifecycle
   * `active`).
   */
  registerPrincipal(input: PrincipalRegistration): IdentityResult<PrincipalRecord> {
    const parsed = PrincipalSchema.safeParse(input.principal);
    if (!parsed.success) {
      return fail(validationError(parsed.error));
    }
    const verified = verifyPrincipalDigest({ principal: parsed.data, digest: input.digest });
    if (!verified.ok) {
      return fail(verified.error);
    }
    const principal = parsed.data;
    if (this.principals.has(principal.principalId)) {
      return fail({
        code: 'duplicate-principal',
        message: `principal "${principal.principalId}" is already registered — principal ids are unique forever`,
        principalId: principal.principalId,
      });
    }
    const record: PrincipalRecord = {
      schemaVersion: 1,
      principal,
      lifecycle: 'active',
      principalDigest: input.digest,
    };
    this.principals.set(principal.principalId, record);
    this.authentications.set(principal.principalId, []);
    return ok(record);
  }

  /** Retrieve a principal record by opaque id (any lifecycle state — inspection). */
  getPrincipal(principalId: string): IdentityResult<PrincipalRecord> {
    const record = this.principals.get(principalId);
    if (record === undefined) {
      return fail(unknownPrincipal(principalId));
    }
    return ok(record);
  }

  /**
   * Suspend a principal (advisory hold — authentication attempts fail
   * with the typed `inactive-principal` reason while suspended). Typed
   * transition: only `active -> suspended` is legal.
   */
  suspend(principalId: string): IdentityResult<PrincipalRecord> {
    return this.transition(principalId, 'suspended');
  }

  /**
   * Deactivate a principal (terminal — the principal no longer exists
   * operationally; no revival). Typed transitions: `active ->
   * deactivated` and `suspended -> deactivated` are legal.
   */
  deactivate(principalId: string): IdentityResult<PrincipalRecord> {
    return this.transition(principalId, 'deactivated');
  }

  private transition(
    principalId: string,
    to: PrincipalLifecycleState,
  ): IdentityResult<PrincipalRecord> {
    const record = this.principals.get(principalId);
    if (record === undefined) {
      return fail(unknownPrincipal(principalId));
    }
    if (!PRINCIPAL_LIFECYCLE_TRANSITIONS[record.lifecycle].includes(to)) {
      return fail({
        code: 'lifecycle-conflict',
        message: `illegal lifecycle transition ${record.lifecycle} -> ${to} for principal "${principalId}" (legal transitions: ${describeTransitions(record.lifecycle)})`,
        principalId,
        from: record.lifecycle,
        to,
      });
    }
    const updated: PrincipalRecord = { ...record, lifecycle: to };
    this.principals.set(principalId, updated);
    return ok(updated);
  }

  /**
   * Record a sealed authentication result for a REGISTERED principal
   * (an authentication outcome for an unknown principal cannot attach —
   * typed `unknown-principal`). The registry records facts; it never
   * interprets them: a `verified` outcome for a suspended principal is
   * storable history — the authorization decision point consumes status
   * and authentication separately.
   */
  recordAuthentication(
    input: AuthenticationResultRegistration,
  ): IdentityResult<AuthenticationResultRecord> {
    const parsed = verifyAuthenticationResultDigest(input);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    const result = parsed.value;
    if (!this.principals.has(result.principalId)) {
      return fail(unknownPrincipal(result.principalId));
    }
    const record: AuthenticationResultRecord = {
      schemaVersion: 1,
      result,
      resultDigest: input.digest,
    };
    this.authentications.get(result.principalId)!.push(record);
    return ok(record);
  }

  /**
   * The authentication history of a principal, sorted by (decidedAt,
   * resultId) ascending — deterministic, independent of recording order.
   */
  authenticationHistory(principalId: string): IdentityResult<readonly AuthenticationResultRecord[]> {
    if (!this.principals.has(principalId)) {
      return fail(unknownPrincipal(principalId));
    }
    const records = [...this.authentications.get(principalId)!];
    records.sort((a, b) =>
      a.result.decidedAt === b.result.decidedAt
        ? a.result.resultId < b.result.resultId
          ? -1
          : 1
        : a.result.decidedAt < b.result.decidedAt
          ? -1
          : 1,
    );
    return ok(records);
  }

  /**
   * The latest authentication result of a principal (null when none was
   * recorded), by (decidedAt, resultId).
   */
  latestAuthentication(
    principalId: string,
  ): IdentityResult<AuthenticationResultRecord | null> {
    const history = this.authenticationHistory(principalId);
    if (!history.ok) return history;
    return ok(history.value.length === 0 ? null : history.value[history.value.length - 1]!);
  }

  /**
   * Deterministically ordered principal records: by principalId
   * ascending — independent of registration order. Optional
   * kind/lifecycle filters.
   */
  listPrincipals(filter: ListPrincipalsFilter = {}): readonly PrincipalRecord[] {
    const records: PrincipalRecord[] = [];
    for (const id of [...this.principals.keys()].sort()) {
      const record = this.principals.get(id)!;
      if (
        (filter.kind === undefined || record.principal.kind === filter.kind) &&
        (filter.lifecycle === undefined || record.lifecycle === filter.lifecycle)
      ) {
        records.push(record);
      }
    }
    return records;
  }
}
