/**
 * Deterministic run identity and idempotency keys (the W021
 * replay/idempotency pin).
 *
 * - A run's IDENTITY is content-addressed: the SHA-256 of the canonical
 *   JSON of a typed identity scope over the admitted invocation payload
 *   (request id + request digest — the W006-evidence exact-revision
 *   convention), the tenant scope, the exact simulator registration pin,
 *   and the canonically-ordered capability bindings. Identical semantic
 *   content (any binding authoring order) derives the SAME identity; any
 *   semantic difference derives a different one. The identity is stable
 *   for the run's lifetime — `runId` is its derived opaque form.
 * - Idempotency keys are pure derivations of the identity scope, never of
 *   wall-clock or arrival order. A replayed submission under a consumed
 *   key returns the SAME run identity (the typed `duplicate-run`
 *   admission); DIFFERENT content under the same key is the typed
 *   `idempotency-conflict` rejection.
 */
import { canonicalDigest } from '@epoch/agent-protocol';
import type { Sha256Hex } from '@epoch/agent-protocol';
import type { SimulatorReference, InvocationReference } from '@epoch/simulation-protocol';
import type { CapabilityBindingRef, FabricIdempotencyKey, FabricTenantId, SimulationRunId } from './types';

/** Canonical (sorted, duplicate-free) form of a capability binding list. */
export function canonicalCapabilityBindings(
  bindings: readonly CapabilityBindingRef[],
): CapabilityBindingRef[] {
  const seen = new Set<string>();
  const canonical: CapabilityBindingRef[] = [];
  for (const binding of [...bindings].sort((a, b) =>
    a.capabilityId === b.capabilityId
      ? a.version === b.version
        ? a.registrationDigest < b.registrationDigest
          ? -1
          : 1
        : a.version < b.version
          ? -1
          : 1
      : a.capabilityId < b.capabilityId
        ? -1
        : 1,
  )) {
    const key = `${binding.capabilityId}@${binding.version}#${binding.registrationDigest}`;
    if (seen.has(key)) continue;
    seen.add(key);
    canonical.push(binding);
  }
  return canonical;
}

/**
 * The typed identity scope of a simulation run: tenant, the exact-revision
 * invocation reference, the exact-revision simulator pin, and the
 * canonically-ordered capability bindings.
 */
export interface RunIdentityScope {
  readonly tenantId: FabricTenantId;
  readonly invocation: InvocationReference;
  readonly simulator: SimulatorReference;
  readonly capabilityBindings: readonly CapabilityBindingRef[];
}

/**
 * The content-addressed identity of a simulation run: the SHA-256 of the
 * canonical JSON of the identity scope (bindings canonically ordered, so
 * authoring order never leaks into the fold). Pure: identical semantic
 * content always produces the same digest.
 */
export function computeRunIdentityDigest(scope: RunIdentityScope): Sha256Hex {
  return canonicalDigest({
    scope: 'epoch.simulation-fabric.run',
    tenantId: scope.tenantId,
    invocation: {
      requestId: scope.invocation.requestId,
      requestDigest: scope.invocation.requestDigest,
    },
    simulator: {
      simulatorId: scope.simulator.simulatorId,
      registrationDigest: scope.simulator.registrationDigest,
    },
    capabilityBindings: canonicalCapabilityBindings(scope.capabilityBindings).map((binding) => ({
      capabilityId: binding.capabilityId,
      version: binding.version,
      registrationDigest: binding.registrationDigest,
    })),
  });
}

/**
 * Derive the opaque run id from the run identity digest
 * (`simrun:<first-16-hex>` — deterministic, grammar-conforming).
 */
export function runIdOf(runDigest: Sha256Hex): SimulationRunId {
  return `simrun:${runDigest.slice(0, 16)}`;
}

/**
 * The derived idempotency key of a run submission: the SHA-256 of the
 * canonical JSON of `{tenantId, runDigest}`. Submissions that omit a
 * caller-supplied key consume this derived one (same content -> same key
 * -> the same run identity on replay).
 */
export function deriveRunIdempotencyKey(input: {
  readonly tenantId: FabricTenantId;
  readonly runDigest: Sha256Hex;
}): FabricIdempotencyKey {
  return canonicalDigest({
    scope: 'epoch.simulation-fabric.run-submission',
    tenantId: input.tenantId,
    runDigest: input.runDigest,
  });
}

/**
 * The content address of one sealed run-state record: the SHA-256 of the
 * canonical JSON of the state content (everything except the digest
 * itself). Pure: identical state content always produces the same digest.
 */
export function computeRunStateDigest(
  state: Omit<import('./types').SimulationRunState, 'stateDigest'>,
): Sha256Hex {
  return canonicalDigest({
    schema: state.schema,
    schemaVersion: state.schemaVersion,
    runId: state.runId,
    runDigest: state.runDigest,
    status: state.status,
    transition: {
      from: state.transition.from,
      to: state.transition.to,
      cause: state.transition.cause,
      actor: state.transition.actor,
      at: state.transition.at,
    },
    previousRunDigest: state.previousRunDigest,
  });
}

/**
 * The content address of a run's CURRENT state: the digest of the latest
 * state record (equals `states[states.length - 1].stateDigest` on a
 * well-formed run).
 */
export function currentStateDigest(
  states: readonly import('./types').SimulationRunState[],
): Sha256Hex {
  const last = states[states.length - 1];
  if (last === undefined) {
    throw new Error('a simulation run must carry at least one sealed state record');
  }
  return last.stateDigest;
}
