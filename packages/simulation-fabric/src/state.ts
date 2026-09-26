/**
 * The run state machine (the W021 lifecycle pin): sealed, append-only
 * state records with `previousRunDigest` chaining and content-addressed
 * states (the W023 version-chain convention). This module owns the PURE
 * record machinery — job admission, typed lifecycle transitions, chain
 * verification, result sealing; the long-running HOST MODEL (stores,
 * idempotency bookkeeping, event emission) is the fabric host's
 * responsibility (src/fabric.ts) and the service layer's (W021 service).
 *
 * Job admission consumes the REAL W005 pipelines verbatim: the
 * registration and invocation request are admitted through
 * `@epoch/simulation-protocol`'s parsers (version gate, kind gate, strict
 * schema, canonical digest), then bound by the W005 cross-document
 * conformance checks — this package never re-declares simulation
 * semantics.
 *
 * Determinism: ZERO wall-clock reads and ZERO randomness — every instant
 * is caller-supplied; identity folds are canonically ordered (binding
 * authoring order never leaks).
 */
import type { Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import {
  checkInvocationConformance,
  checkResultConformance,
  parseSimulationInvocationRequest,
  parseSimulationResult,
  parseSimulatorRegistration,
} from '@epoch/simulation-protocol';
import type {
  ConformanceViolation,
  ProtocolError,
  SimulationFailure,
  SimulationInvocationRequest,
  SimulationResult,
  SimulatorRegistration,
} from '@epoch/simulation-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  computeRunIdentityDigest,
  computeRunStateDigest,
  runIdOf,
} from './identity';
import {
  CapabilityBindingRefSchema,
  FabricPrincipalIdSchema,
} from './schema';
import { rePathError, vendorFieldsError } from './issues';
import type { FabricError, FabricResult } from './errors';
import type {
  CapabilityBindingRef,
  FabricPrincipalId,
  RunTransition,
  SealedSimulationResult,
  SimulationRun,
  SimulationRunState,
} from './types';
import {
  RUN_LIFECYCLE_TRANSITIONS,
  isTerminalRunStatus,
  type RunTransitionCause,
  type SimulationRunStatus,
} from './version';

/** What a successful job admission produces: the run plus its admitted W005 chain. */
export interface AdmittedSimulationJob {
  readonly run: SimulationRun;
  readonly request: SimulationInvocationRequest;
  readonly registration: SimulatorRegistration;
}

/** Options of {@link admitSimulationJob} (the pure submission core). */
export interface AdmitSimulationJobOptions {
  readonly tenantId: TenantId;
  /** The W005 simulator registration document (raw JSON; admitted through the REAL pipeline). */
  readonly registration: unknown;
  /** The W005 invocation request document (raw JSON; admitted through the REAL pipeline). */
  readonly request: unknown;
  /** Capability registrations to bind, by opaque typed reference. */
  readonly capabilityBindings: readonly CapabilityBindingRef[];
  /** The idempotency key the submission consumes (derived by the caller when omitted). */
  readonly idempotencyKey: string;
  readonly actor: FabricPrincipalId;
  readonly at: Timestamp;
}

/** Map a W005 admission failure into the fabric taxonomy. */
function mapProtocolError(error: ProtocolError, prefix: string): FabricError {
  if (error.kind === 'version-mismatch') {
    return {
      code: 'version-unsupported',
      message: `${prefix}: protocol version mismatch (expected ${error.expected}, encountered ${error.encountered})`,
      expected: error.expected,
      encountered: error.encountered,
    };
  }
  return rePathError(
    {
      code: 'validation',
      message: `${prefix}: ${error.message}`,
      issues:
        error.kind === 'schema-violation'
          ? error.issues.map((issue) => ({
              path: issue.path === '' ? prefix : `${prefix}.${issue.path}`,
              message: issue.message,
            }))
          : [{ path: prefix, message: error.message }],
    },
    '',
  );
}

/**
 * Admit one simulation job (the pure submission core). Total, never
 * throws; fixed precedence:
 *
 * 1. tenant gate — the tenant id must satisfy the W009 grammar
 *    (`validation`, path `tenantId`);
 * 2. actor gate — the acting principal must satisfy the W009/W010 actor
 *    grammar (`validation`, path `actor`);
 * 3. registration admission — the REAL W005 pipeline (version gate, kind
 *    gate, strict schema, canonical digest); failures are typed
 *    `version-unsupported` / `validation` at path `registration`;
 * 4. request admission — the REAL W005 pipeline; failures typed at path
 *    `request`;
 * 5. conformance gate — the W005 cross-document checks
 *    (`checkInvocationConformance`): the request must target the admitted
 *    registration at its EXACT revision, with conforming inputs and seed
 *    discipline; violations are the typed `nonconforming-invocation`;
 * 6. bindings gate — every capability binding must be a well-formed
 *    opaque typed reference (STRICT object: structural copies of registry
 *    records are `vendor-fields-rejected`);
 * 7. the run is sealed in its canonical form: bindings canonically
 *    ordered (sorted, duplicate-free), the identity digest derived over
 *    the canonical identity scope, the run id derived from it, and the
 *    genesis `submitted` state record content-addressed and chained
 *    (previousRunDigest: null).
 */
export function admitSimulationJob(
  options: AdmitSimulationJobOptions,
): FabricResult<AdmittedSimulationJob> {
  // Precedence 1: tenant grammar (W009).
  const tenant = TenantIdSchema.safeParse(options.tenantId);
  if (!tenant.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'the submission tenant id must satisfy the W009 tenant grammar',
        issues: [{ path: 'tenantId', message: 'must be a tenant id of the form "tenant:<slug>"' }],
      },
    };
  }

  // Precedence 2: actor grammar (W009/W010).
  const actor = FabricPrincipalIdSchema.safeParse(options.actor);
  if (!actor.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'the submission actor must satisfy the W009/W010 principal grammar',
        issues: [
          { path: 'actor', message: 'must be a principal id of the form "principal:<slug>"' },
        ],
      },
    };
  }

  // Precedence 3: registration admission (the REAL W005 pipeline).
  const parsedRegistration = parseSimulatorRegistration(options.registration);
  if (!parsedRegistration.ok) {
    return { ok: false, error: mapProtocolError(parsedRegistration.error, 'registration') };
  }
  const registration = parsedRegistration.value;

  // Precedence 4: request admission (the REAL W005 pipeline).
  const parsedRequest = parseSimulationInvocationRequest(options.request);
  if (!parsedRequest.ok) {
    return { ok: false, error: mapProtocolError(parsedRequest.error, 'request') };
  }
  const request = parsedRequest.value;

  // Precedence 5: cross-document conformance (the REAL W005 checks).
  const violations = checkInvocationConformance(registration, request);
  if (violations.length > 0) {
    return {
      ok: false,
      error: {
        code: 'nonconforming-invocation',
        message:
          'the invocation request does not conform to the registration it targets (W005 cross-document conformance)',
        violations,
      },
    };
  }

  // Precedence 6: capability binding references (strict: opaque ids only).
  const bindings: CapabilityBindingRef[] = [];
  for (const [index, binding] of options.capabilityBindings.entries()) {
    const parsed = CapabilityBindingRefSchema.safeParse(binding);
    if (!parsed.success) {
      if (parsed.error.issues.some((issue) => issue.code === 'unrecognized_keys')) {
        return {
          ok: false,
          error: rePathError(vendorFieldsError(parsed.error), `capabilityBindings[${index}]`),
        };
      }
      return {
        ok: false,
        error: rePathError(
          {
            code: 'validation',
            message: 'capability bindings must be opaque typed references to W007 registrations',
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.map(String).join('.'),
              message: issue.message,
            })),
          },
          `capabilityBindings[${index}]`,
        ),
      };
    }
    bindings.push(parsed.data);
  }

  // Precedence 7: seal the run in its canonical form.
  const invocation = {
    requestId: request.requestId,
    requestDigest: parsedRequest.digest,
  };
  const canonicalBindings = [...bindings]
    .sort((a, b) =>
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
    )
    .filter(
      (binding, index, list) =>
        list.findIndex(
          (other) =>
            other.capabilityId === binding.capabilityId &&
            other.version === binding.version &&
            other.registrationDigest === binding.registrationDigest,
        ) === index,
    );

  const runDigest = computeRunIdentityDigest({
    tenantId: options.tenantId,
    invocation,
    simulator: request.simulator,
    capabilityBindings: canonicalBindings,
  });
  const runId = runIdOf(runDigest);

  const genesisTransition: RunTransition = {
    from: null,
    to: 'submitted',
    cause: 'submission',
    actor: options.actor,
    at: options.at,
  };
  const genesisContent = {
    schema: 'epoch.simulation-fabric.run-state' as const,
    schemaVersion: 1 as const,
    runId,
    runDigest,
    status: 'submitted' as const,
    transition: genesisTransition,
    previousRunDigest: null,
  };
  const genesis: SimulationRunState = {
    ...genesisContent,
    stateDigest: computeRunStateDigest(genesisContent),
  };

  const run: SimulationRun = {
    schemaVersion: 1,
    runId,
    runDigest,
    tenantId: options.tenantId,
    status: 'submitted',
    invocation,
    simulator: request.simulator,
    capabilityBindings: canonicalBindings,
    idempotencyKey: options.idempotencyKey,
    states: [genesis],
    stateDigest: genesis.stateDigest,
    createdAt: options.at,
    updatedAt: options.at,
  };

  return { ok: true, value: { run, request, registration } };
}

/** Options of {@link transitionRunStatus}. */
export interface TransitionRunOptions {
  readonly to: SimulationRunStatus;
  readonly cause: RunTransitionCause;
  readonly actor: FabricPrincipalId;
  readonly at: Timestamp;
}

/**
 * Apply one run-status transition: appends a NEW sealed state record
 * (previousRunDigest chains to the current state's digest; the record is
 * content-addressed) and returns the next run document. Illegal
 * transitions (including any transition out of a terminal status) are the
 * typed `lifecycle-conflict`. Pure: the input run is never mutated.
 */
export function transitionRunStatus(
  run: SimulationRun,
  options: TransitionRunOptions,
): FabricResult<SimulationRun> {
  const from = run.status;
  if (!RUN_LIFECYCLE_TRANSITIONS[from].includes(options.to)) {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `illegal run lifecycle transition ${from} -> ${options.to} (legal transitions from "${from}": ${describeRunTransitions(from)})`,
        from,
        to: options.to,
      },
    };
  }
  const transition: RunTransition = {
    from,
    to: options.to,
    cause: options.cause,
    actor: options.actor,
    at: options.at,
  };
  const content = {
    schema: 'epoch.simulation-fabric.run-state' as const,
    schemaVersion: 1 as const,
    runId: run.runId,
    runDigest: run.runDigest,
    status: options.to,
    transition,
    previousRunDigest: run.stateDigest,
  };
  const state: SimulationRunState = { ...content, stateDigest: computeRunStateDigest(content) };
  return {
    ok: true,
    value: {
      ...run,
      status: options.to,
      states: [...run.states, state],
      stateDigest: state.stateDigest,
      updatedAt: options.at,
    },
  };
}

/**
 * Verify a run's sealed state chain end-to-end (tamper detection):
 *
 * 1. the chain is non-empty and starts at a genesis record
 *    (`previousRunDigest: null`, transition `null -> submitted`,
 *    `cause: submission`);
 * 2. every `previousRunDigest` links to the previous record's
 *    `stateDigest`, and every `stateDigest` equals the recomputed
 *    canonical SHA-256 of its content (a tampered digest or broken link
 *    is `digest-mismatch`);
 * 3. every transition is lifecycle-legal for the prior status and the
 *    record's status equals the transition's target;
 * 4. the run's `status`/`stateDigest` agree with the latest record, and
 *    the run id agrees with the derived identity.
 *
 * Total: a well-formed run returns unchanged; a corrupted one is a typed
 * rejection, never silent corruption.
 */
export function verifyRunStateChain(run: SimulationRun): FabricResult<SimulationRun> {
  if (run.states.length === 0) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `run "${run.runId}" carries no state records`,
        issues: [{ path: 'states', message: 'at least the genesis record is required' }],
      },
    };
  }

  let previous: SimulationRunState | undefined;
  for (const [index, state] of run.states.entries()) {
    const expectedPrevious = previous === undefined ? null : previous.stateDigest;
    if (state.previousRunDigest !== expectedPrevious) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `run "${run.runId}" state #${index + 1} chains to ${state.previousRunDigest ?? 'null'} but the previous state's digest is ${expectedPrevious ?? 'null'} (broken chain link)`,
          expected: expectedPrevious ?? 'null',
          encountered: state.previousRunDigest ?? 'null',
        },
      };
    }
    const content = {
      schema: state.schema,
      schemaVersion: state.schemaVersion,
      runId: state.runId,
      runDigest: state.runDigest,
      status: state.status,
      transition: state.transition,
      previousRunDigest: state.previousRunDigest,
    };
    const expectedDigest = computeRunStateDigest(content);
    if (expectedDigest !== state.stateDigest) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `run "${run.runId}" state #${index + 1} digest does not match its content (tampered record)`,
          expected: expectedDigest,
          encountered: state.stateDigest,
        },
      };
    }
    if (index === 0) {
      if (state.transition.from !== null || state.transition.cause !== 'submission') {
        return {
          ok: false,
          error: {
            code: 'validation',
            message: `run "${run.runId}" genesis state must be the submission record (from: null, cause: submission)`,
            issues: [
              { path: `states[0].transition`, message: 'expected the genesis submission record' },
            ],
          },
        };
      }
    } else {
      const prior = previous as SimulationRunState;
      if (state.transition.from !== prior.status) {
        return {
          ok: false,
          error: {
            code: 'validation',
            message: `run "${run.runId}" state #${index + 1} claims a transition from "${state.transition.from}" but the prior state is "${prior.status}"`,
            issues: [
              {
                path: `states[${index}].transition.from`,
                message: `expected "${prior.status}"`,
              },
            ],
          },
        };
      }
      if (!RUN_LIFECYCLE_TRANSITIONS[prior.status].includes(state.status)) {
        return {
          ok: false,
          error: {
            code: 'lifecycle-conflict',
            message: `run "${run.runId}" state #${index + 1} records an illegal transition ${prior.status} -> ${state.status}`,
            from: prior.status,
            to: state.status,
          },
        };
      }
    }
    if (state.transition.to !== state.status) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `run "${run.runId}" state #${index + 1} status "${state.status}" disagrees with its transition target "${state.transition.to}"`,
          issues: [
            { path: `states[${index}].status`, message: `expected "${state.transition.to}"` },
          ],
        },
      };
    }
    if (state.runId !== run.runId || state.runDigest !== run.runDigest) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `run "${run.runId}" state #${index + 1} carries a foreign run identity (${state.runId})`,
          issues: [
            { path: `states[${index}].runId`, message: `expected "${run.runId}"` },
          ],
        },
      };
    }
    previous = state;
  }

  const last = run.states[run.states.length - 1] as SimulationRunState;
  if (run.status !== last.status) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `run "${run.runId}" status "${run.status}" disagrees with its latest state record "${last.status}"`,
        issues: [{ path: 'status', message: `expected "${last.status}"` }],
      },
    };
  }
  if (run.stateDigest !== last.stateDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `run "${run.runId}" stateDigest does not match its latest state record`,
        expected: last.stateDigest,
        encountered: run.stateDigest,
      },
    };
  }
  if (runIdOf(run.runDigest) !== run.runId) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `run "${run.runId}" id does not agree with its derived identity digest`,
        expected: runIdOf(run.runDigest),
        encountered: run.runId,
      },
    };
  }
  return { ok: true, value: run };
}

/**
 * Seal a simulation result through the REAL W005 admission pipeline
 * (version gate, kind gate, strict schema, canonical digest): the sealed
 * result is the admitted document plus its canonical digest (the
 * exact-revision address of the prediction artifact).
 */
export function sealSimulationResult(input: unknown): FabricResult<SealedSimulationResult> {
  const parsed = parseSimulationResult(input);
  if (!parsed.ok) {
    return { ok: false, error: mapProtocolError(parsed.error, 'result') };
  }
  return { ok: true, value: { result: parsed.value, resultDigest: parsed.digest } };
}

/**
 * Check a sealed result against the run's admitted W005 chain (the REAL
 * W005 cross-document checks): the result must bind the run's request id
 * AND request digest, the run's simulator id AND registration digest,
 * mirror the registration's determinism claim, and (when completed)
 * carry only declared outputs with every required output present.
 */
export function checkResultAgainstRun(
  run: SimulationRun,
  request: SimulationInvocationRequest,
  registration: SimulatorRegistration,
  result: SimulationResult,
): readonly ConformanceViolation[] {
  const violations = checkResultConformance(registration, request, result);
  if (result.request.requestId !== run.invocation.requestId) {
    return [
      {
        path: 'request.requestId',
        message: `result claims request "${result.request.requestId}" but the run executes "${run.invocation.requestId}"`,
      },
      ...violations,
    ];
  }
  return violations;
}

/** The failure detail recorded on a run that settles `failed`. */
export function runFailureDetail(
  kind: 'execution-failed' | 'result-rejected',
  detail: string,
): SimulationFailure {
  return {
    code: 'internal-error',
    message: `the execution settled as failed (${kind}): ${detail}`,
  };
}

/** Legal-transition description for lifecycle-conflict messages. */
function describeRunTransitions(status: SimulationRunStatus): string {
  const next = RUN_LIFECYCLE_TRANSITIONS[status];
  return next.length === 0
    ? 'none (terminal status)'
    : next.map((s) => `${status} -> ${s}`).join(', ');
}

/** Re-exported convenience for host-side terminal checks. */
export { isTerminalRunStatus };
