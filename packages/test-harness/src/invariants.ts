/**
 * The invariant library: typed, reusable checks over (scenario, trace,
 * step reports) — the W031 cross-cutting assertions, generalized so every
 * scenario composes them:
 *
 *   - TENANT ISOLATION at every boundary crossing (R12: the typed
 *     cross-tenant denial shape, with both tenants, on every attempt);
 *   - PROVENANCE CHAIN verification (claimed digests recompute; parent
 *     links chain to earlier records or start at a root);
 *   - AUTHORITY ROUTING (direct-write attempts are rejected with a typed
 *     authority code AND produce no state delta; public-path calls carry
 *     typed errors when they fail);
 *   - IDENTITY PRESERVATION across projections (a canonical id appears on
 *     every declared surface; projection surfaces identity-map the
 *     canonical surface's id set);
 *   - TRACE INTEGRITY (digest shapes, step coverage, sealed trace);
 *   - EXPECTATION CONFORMANCE (each call step's declared expectation
 *     matched its observed outcome);
 *   - SCENARIO ROUND-TRIP (serialize + digest-verify, run-level);
 *   - REPLAY DETERMINISM (re-run produces a byte-identical trace,
 *     run-level — evaluated by the runner's double-run).
 *
 * Every check is PURE over its inputs: no kernel imports, no clock, no
 * randomness. Findings are values ({invariant, satisfied, detail}).
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import type { StepReport } from './driver';
import type { ExecutionTrace } from './trace';
import {
  parseScenario,
  scenarioDigest,
  serializeScenario,
  type ScenarioDefinition,
} from './scenario';
import { isDigest } from './values';

/** The closed invariant vocabulary of the library. */
export const INVARIANT_IDS = [
  'tenant-isolation',
  'provenance-chain',
  'authority-routing',
  'identity-preservation',
  'trace-integrity',
  'expectation-conformance',
  'scenario-round-trip',
  'replay-determinism',
] as const;
export type InvariantId = (typeof INVARIANT_IDS)[number];

/** One invariant finding (a value, never an exception). */
export interface InvariantFinding {
  readonly invariant: string;
  readonly satisfied: boolean;
  readonly detail: string;
}

/** The evidence a check evaluates. */
export interface InvariantContext {
  readonly scenario: ScenarioDefinition;
  /** The reports of every executed step, in order (up to the eval point). */
  readonly reports: readonly StepReport[];
  /** The trace (up to the eval point). */
  readonly trace: ExecutionTrace;
}

/** A per-point check: evaluable over any execution prefix. */
export type InvariantCheck = (context: InvariantContext, argument: JsonValue | undefined) => InvariantFinding[];

/** Invariants that only the RUNNER can evaluate (over the whole run). */
export const RUN_LEVEL_INVARIANTS: readonly InvariantId[] = [
  'scenario-round-trip',
  'replay-determinism',
];

/** Whether an invariant id is evaluated by the runner (not per-point). */
export function isRunLevelInvariant(invariant: string): boolean {
  return (RUN_LEVEL_INVARIANTS as readonly string[]).includes(invariant);
}

const ok = (invariant: string, detail: string): InvariantFinding => ({ invariant, satisfied: true, detail });
const bad = (invariant: string, detail: string): InvariantFinding => ({ invariant, satisfied: false, detail });

// --------------------------------------------------------------------------------
// Tenant isolation (R12).
// --------------------------------------------------------------------------------

/** The typed denial codes Epoch kernels surface at tenant boundaries. */
export const TENANT_DENIAL_CODES: readonly string[] = ['cross-tenant-denied', 'tenant-isolation-rejected'];

function checkTenantIsolation(context: InvariantContext): InvariantFinding[] {
  const findings: InvariantFinding[] = [];
  const declaredTenants = new Set(context.scenario.actors.map((actor) => actor.tenantId));
  const home = context.scenario.tenantId;
  const attempts = context.scenario.steps.filter(
    (step) => step.kind === 'call' && step.route === 'cross-tenant-attempt',
  );
  if (attempts.length === 0) {
    findings.push(ok('tenant-isolation', 'no cross-tenant attempts declared (nothing to check)'));
    return findings;
  }
  for (const step of attempts) {
    if (step.kind !== 'call') continue;
    const report = context.reports.find((candidate) => candidate.stepId === step.stepId);
    if (report === undefined) {
      findings.push(bad('tenant-isolation', `step "${step.stepId}": no report (not yet executed)`));
      continue;
    }
    if (report.ok) {
      findings.push(bad('tenant-isolation', `step "${step.stepId}": a cross-tenant attempt SUCCEEDED (boundary open)`));
      continue;
    }
    if (report.denial === null) {
      findings.push(
        bad('tenant-isolation', `step "${step.stepId}": failed without the typed denial record (code: ${report.errorCode ?? 'none'})`),
      );
      continue;
    }
    if (!TENANT_DENIAL_CODES.includes(report.denial.code)) {
      findings.push(
        bad('tenant-isolation', `step "${step.stepId}": denial code "${report.denial.code}" is not one of [${TENANT_DENIAL_CODES.join(', ')}]`),
      );
    }
    if (report.denial.expectedTenantId !== home) {
      findings.push(
        bad('tenant-isolation', `step "${step.stepId}": denial expectedTenantId "${report.denial.expectedTenantId}" is not the home tenant "${home}"`),
      );
    }
    if (report.denial.encounteredTenantId === home) {
      findings.push(
        bad('tenant-isolation', `step "${step.stepId}": denial encounteredTenantId equals the home tenant (not a cross-tenant denial)`),
      );
    }
    if (!declaredTenants.has(report.denial.encounteredTenantId)) {
      findings.push(
        bad('tenant-isolation', `step "${step.stepId}": denial encounteredTenantId "${report.denial.encounteredTenantId}" belongs to no declared actor`),
      );
    }
  }
  if (findings.every((finding) => finding.satisfied)) {
    findings.push(
      ok('tenant-isolation', `${attempts.length} cross-tenant attempt(s) all denied with the typed shape at the home boundary`),
    );
  }
  return findings;
}

// --------------------------------------------------------------------------------
// Provenance chains (W006 discipline: recompute + compare + link).
// --------------------------------------------------------------------------------

function checkProvenanceChain(context: InvariantContext): InvariantFinding[] {
  const findings: InvariantFinding[] = [];
  const seenDigests = new Set<string>();
  let chainRoots = 0;
  let chained = 0;
  let verified = 0;
  for (const report of context.reports) {
    for (const record of report.provenance) {
      if (!isDigest(record.claimedDigest)) {
        findings.push(
          bad('provenance-chain', `step "${report.stepId}": claimed digest "${record.claimedDigest}" is not 64-hex`),
        );
        continue;
      }
      const recomputed = canonicalDigest(record.content);
      if (recomputed !== record.claimedDigest) {
        findings.push(
          bad('provenance-chain', `step "${report.stepId}": claimed digest ${record.claimedDigest.slice(0, 12)}… recomputes to ${recomputed.slice(0, 12)}…`),
        );
        continue;
      }
      verified += 1;
      if (record.parentDigest === null) {
        chainRoots += 1;
      } else if (seenDigests.has(record.parentDigest) || record.parentDigest === record.claimedDigest) {
        chained += 1;
      } else {
        findings.push(
          bad('provenance-chain', `step "${report.stepId}": parent digest ${record.parentDigest.slice(0, 12)}… references no earlier record in the trace`),
        );
      }
      seenDigests.add(record.claimedDigest);
    }
  }
  if (findings.length === 0) {
    findings.push(
      ok('provenance-chain', `${verified} digest-bearing record(s) verify (${chainRoots} root(s), ${chained} chained)`),
    );
  }
  return findings;
}

// --------------------------------------------------------------------------------
// Authority routing (no direct kernel-state writes).
// --------------------------------------------------------------------------------

function checkAuthorityRouting(context: InvariantContext): InvariantFinding[] {
  const findings: InvariantFinding[] = [];
  const attempts = context.scenario.steps.filter(
    (step) => step.kind === 'call' && step.route === 'direct-write-attempt',
  );
  for (const step of attempts) {
    if (step.kind !== 'call') continue;
    const report = context.reports.find((candidate) => candidate.stepId === step.stepId);
    const entry = context.trace.steps.find((candidate) => candidate.stepId === step.stepId);
    if (report === undefined || entry === undefined) {
      findings.push(bad('authority-routing', `step "${step.stepId}": no report (not yet executed)`));
      continue;
    }
    if (report.ok) {
      findings.push(
        bad('authority-routing', `step "${step.stepId}": a direct-write attempt SUCCEEDED (authority bypassed)`),
      );
      continue;
    }
    if (report.authorityRejection === null) {
      findings.push(
        bad('authority-routing', `step "${step.stepId}": rejected without the typed authority-rejection record (code: ${report.errorCode ?? 'none'})`),
      );
    }
    if (entry.stateDelta) {
      findings.push(
        bad('authority-routing', `step "${step.stepId}": a rejected direct-write attempt changed the state digest (side effect through a denied path)`),
      );
    }
  }
  // Public-path failures must carry typed error codes (errors are values).
  for (const step of context.scenario.steps) {
    if (step.kind !== 'call' || step.route !== 'public-api') continue;
    const report = context.reports.find((candidate) => candidate.stepId === step.stepId);
    if (report !== undefined && !report.ok && report.errorCode === null) {
      findings.push(
        bad('authority-routing', `step "${step.stepId}": public-path failure carries no typed error code`),
      );
    }
  }
  if (findings.length === 0) {
    findings.push(
      ok(
        'authority-routing',
        attempts.length === 0
          ? 'no direct-write attempts declared; public-path failures all typed'
          : `${attempts.length} direct-write attempt(s) all rejected with the typed authority code and no state delta`,
      ),
    );
  }
  return findings;
}

// --------------------------------------------------------------------------------
// Identity preservation across projections (the W031 identity spine).
// --------------------------------------------------------------------------------

export interface IdentityByIdArgument {
  readonly canonicalId: string;
  readonly surfaces: readonly string[];
}
export interface IdentityBySurfaceArgument {
  readonly canonicalSurface: string;
  readonly projectionSurfaces: readonly string[];
}

function observedIds(context: InvariantContext, surface: string): Set<string> {
  const ids = new Set<string>();
  for (const report of context.reports) {
    for (const observation of report.identities) {
      if (observation.surface === surface) {
        for (const id of observation.ids) ids.add(id);
      }
    }
  }
  return ids;
}

function checkIdentityPreservation(
  context: InvariantContext,
  argument: JsonValue | undefined,
): InvariantFinding[] {
  const findings: InvariantFinding[] = [];
  const bindings = context.scenario.identityMap;
  const bySurface: IdentityBySurfaceArgument[] = [];
  const bySurfaceArgument = asBySurfaceArgument(argument);
  if (bySurfaceArgument !== null) {
    bySurface.push(bySurfaceArgument);
  }
  // byId form: declared bindings + (optionally) the assert argument.
  for (const binding of bindings) {
    for (const surface of binding.surfaces) {
      if (!observedIds(context, surface).has(binding.canonicalId)) {
        findings.push(
          bad('identity-preservation', `canonical id "${binding.canonicalId}" was never observed on surface "${surface}"`),
        );
      }
    }
  }
  const byId = asByIdArgument(argument);
  if (byId !== null) {
    for (const surface of byId.surfaces) {
      if (!observedIds(context, surface).has(byId.canonicalId)) {
        findings.push(
          bad('identity-preservation', `canonical id "${byId.canonicalId}" was never observed on surface "${surface}"`),
        );
      }
    }
  }
  // bySurface form: the strict identity-map (projection ids ≡ canonical ids).
  for (const spec of bySurface) {
    const canonical = observedIds(context, spec.canonicalSurface);
    if (canonical.size === 0) {
      findings.push(
        bad('identity-preservation', `canonical surface "${spec.canonicalSurface}" reported no ids`),
      );
      continue;
    }
    for (const surface of spec.projectionSurfaces) {
      const projected = observedIds(context, surface);
      const missing = [...canonical].filter((id) => !projected.has(id));
      const extra = [...projected].filter((id) => !canonical.has(id));
      if (missing.length > 0) {
        findings.push(
          bad('identity-preservation', `surface "${surface}" is missing canonical ids: ${missing.sort().join(', ')}`),
        );
      }
      if (extra.length > 0) {
        findings.push(
          bad('identity-preservation', `surface "${surface}" reports non-canonical ids: ${extra.sort().join(', ')}`),
        );
      }
    }
  }
  if (findings.length === 0) {
    const described = bindings.length + bySurface.length + (byId !== null ? 1 : 0);
    findings.push(
      ok('identity-preservation', `${described} binding(s) preserved across every declared surface`),
    );
  }
  return findings;
}

/** Parse the byId argument form ({canonicalId, surfaces}); null when absent/malformed. */
function asByIdArgument(argument: JsonValue | undefined): IdentityByIdArgument | null {
  if (argument === undefined || typeof argument !== 'object' || argument === null || Array.isArray(argument)) {
    return null;
  }
  const record = argument as Record<string, unknown>;
  if (
    typeof record.canonicalId === 'string' &&
    Array.isArray(record.surfaces) &&
    record.surfaces.every((entry) => typeof entry === 'string')
  ) {
    return { canonicalId: record.canonicalId, surfaces: record.surfaces as string[] };
  }
  return null;
}

/** Parse the bySurface argument form ({canonicalSurface, projectionSurfaces}); null when absent/malformed. */
function asBySurfaceArgument(argument: JsonValue | undefined): IdentityBySurfaceArgument | null {
  if (argument === undefined || typeof argument !== 'object' || argument === null || Array.isArray(argument)) {
    return null;
  }
  const record = argument as Record<string, unknown>;
  if (
    typeof record.canonicalSurface === 'string' &&
    Array.isArray(record.projectionSurfaces) &&
    record.projectionSurfaces.every((entry) => typeof entry === 'string')
  ) {
    return { canonicalSurface: record.canonicalSurface, projectionSurfaces: record.projectionSurfaces as string[] };
  }
  return null;
}

// --------------------------------------------------------------------------------
// Trace integrity.
// --------------------------------------------------------------------------------

function checkTraceIntegrity(context: InvariantContext): InvariantFinding[] {
  const findings: InvariantFinding[] = [];
  const trace = context.trace;
  if (trace.scenarioId !== context.scenario.scenarioId) {
    findings.push(bad('trace-integrity', `trace scenarioId "${trace.scenarioId}" does not match the scenario`));
  }
  if (trace.scenarioDigest !== scenarioDigest(context.scenario)) {
    findings.push(bad('trace-integrity', 'trace scenarioDigest does not match the scenario digest'));
  }
  const callEntries = trace.steps.filter((entry) => entry.kind === 'call');
  if (callEntries.length !== context.reports.length) {
    findings.push(
      bad('trace-integrity', `trace covers ${callEntries.length} call step(s) but ${context.reports.length} report(s) exist`),
    );
  }
  const executedStepIds = context.scenario.steps.map((step) => step.stepId);
  for (const [index, entry] of trace.steps.entries()) {
    if (entry.stepId !== executedStepIds[index]) {
      findings.push(
        bad('trace-integrity', `trace step ${index} is "${entry.stepId}" but the scenario declares "${executedStepIds[index]}"`),
      );
    }
    if (!isDigest(entry.stepDigest) || !isDigest(entry.stateDigestBefore) || !isDigest(entry.stateDigestAfter)) {
      findings.push(bad('trace-integrity', `trace step "${entry.stepId}": a record digest is not 64-hex`));
    }
    if (entry.stateDelta !== (entry.stateDigestBefore !== entry.stateDigestAfter)) {
      findings.push(bad('trace-integrity', `trace step "${entry.stepId}": stateDelta flag disagrees with the digests`));
    }
  }
  if (trace.steps.length > 0) {
    const last = trace.steps[trace.steps.length - 1]!;
    if (trace.finalStateDigest !== last.stateDigestAfter) {
      findings.push(bad('trace-integrity', 'finalStateDigest does not equal the last step\'s stateDigestAfter'));
    }
  }
  const recomputed = canonicalDigest({
    schemaVersion: trace.schemaVersion,
    traceId: trace.traceId,
    scenarioId: trace.scenarioId,
    scenarioDigest: trace.scenarioDigest,
    driverName: trace.driverName,
    steps: trace.steps,
    finalStateDigest: trace.finalStateDigest,
  } as unknown as JsonValue);
  if (recomputed !== trace.traceDigest) {
    findings.push(bad('trace-integrity', 'the trace digest does not verify against its content'));
  }
  if (findings.length === 0) {
    findings.push(ok('trace-integrity', `${trace.steps.length} step(s) sealed, ordered, digest-verified`));
  }
  return findings;
}

// --------------------------------------------------------------------------------
// Expectation conformance (per call step).
// --------------------------------------------------------------------------------

function checkExpectationConformance(context: InvariantContext): InvariantFinding[] {
  const findings: InvariantFinding[] = [];
  for (const step of context.scenario.steps) {
    if (step.kind !== 'call') continue;
    const entry = context.trace.steps.find((candidate) => candidate.stepId === step.stepId);
    if (entry === undefined) {
      findings.push(bad('expectation-conformance', `step "${step.stepId}": not executed`));
      continue;
    }
    if (entry.outcome !== step.expect) {
      findings.push(
        bad('expectation-conformance', `step "${step.stepId}": expected "${step.expect}" but observed "${entry.outcome}"`),
      );
    }
    if (step.expectedErrorCode !== undefined && entry.errorCode !== step.expectedErrorCode) {
      findings.push(
        bad('expectation-conformance', `step "${step.stepId}": expected error code "${step.expectedErrorCode}" but observed "${entry.errorCode ?? 'none'}"`),
      );
    }
  }
  if (findings.length === 0) {
    findings.push(ok('expectation-conformance', 'every call step matched its declared expectation'));
  }
  return findings;
}

// --------------------------------------------------------------------------------
// The registry.
// --------------------------------------------------------------------------------

/** Every per-point check, keyed by invariant id. */
export const INVARIANT_CHECKS: Readonly<Record<InvariantId, InvariantCheck>> = {
  'tenant-isolation': checkTenantIsolation,
  'provenance-chain': checkProvenanceChain,
  'authority-routing': checkAuthorityRouting,
  'identity-preservation': checkIdentityPreservation,
  'trace-integrity': checkTraceIntegrity,
  'expectation-conformance': checkExpectationConformance,
  // Run-level invariants are evaluated by the runner over the whole run;
  // per-point evaluation degrades to a typed note (never silently passing).
  'scenario-round-trip': () => [
    bad('scenario-round-trip', 'scenario-round-trip is a run-level invariant (evaluated by the runner, not per-point)'),
  ],
  'replay-determinism': () => [
    bad('replay-determinism', 'replay-determinism is a run-level invariant (evaluated by the runner, not per-point)'),
  ],
};

/** Evaluate one per-point invariant (typed: unknown ids are a finding). */
export function evaluateInvariant(
  invariant: string,
  context: InvariantContext,
  argument: JsonValue | undefined,
): InvariantFinding[] {
  if (!(INVARIANT_IDS as readonly string[]).includes(invariant)) {
    return [bad(invariant, `unknown invariant "${invariant}" (not in the library vocabulary)`)];
  }
  const check = INVARIANT_CHECKS[invariant as InvariantId];
  return check(context, argument);
}

// --------------------------------------------------------------------------------
// Run-level checks (invoked by the runner with whole-run evidence).
// --------------------------------------------------------------------------------

export interface RunLevelEvidence {
  readonly scenario: ScenarioDefinition;
  readonly trace: ExecutionTrace;
  /** The second (replay) run's trace digest, when the runner double-ran. */
  readonly secondTraceDigest: string | null;
}

/** Scenario round-trip: serialize + reparse + digest-verify. */
export function checkScenarioRoundTrip(scenario: ScenarioDefinition): InvariantFinding[] {
  const text = serializeScenario(scenario);
  const claimed = scenarioDigest(scenario);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return [bad('scenario-round-trip', `serialized scenario does not re-parse: ${(err as Error).message}`)];
  }
  const reparsed = parseScenario(parsed);
  if (!reparsed.ok) {
    return [bad('scenario-round-trip', `reparsed scenario fails the DSL: ${reparsed.error.message}`)];
  }
  if (scenarioDigest(reparsed.value) !== claimed) {
    return [bad('scenario-round-trip', 'the round-tripped scenario digest differs from the claimed digest')];
  }
  return [ok('scenario-round-trip', `serializes (${text.length} chars) and digest-verifies (${claimed.slice(0, 12)}…)`)];
}

/** Replay determinism: the double-run's trace digest equals the first run's. */
export function checkReplayDeterminism(evidence: RunLevelEvidence): InvariantFinding[] {
  if (evidence.secondTraceDigest === null) {
    return [bad('replay-determinism', 'the runner did not double-run the scenario (replayCheck disabled)')];
  }
  if (evidence.secondTraceDigest === evidence.trace.traceDigest) {
    return [
      ok('replay-determinism', `two runs produce the byte-identical trace digest ${evidence.trace.traceDigest.slice(0, 12)}…`),
    ];
  }
  return [
    bad(
      'replay-determinism',
      `trace digests diverge across runs: ${evidence.trace.traceDigest.slice(0, 12)}… vs ${evidence.secondTraceDigest.slice(0, 12)}…`,
    ),
  ];
}
