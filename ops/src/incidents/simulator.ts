/**
 * @epoch/ops-kit — the deterministic INCIDENT SIMULATOR.
 *
 * Replays a runbook's steps against a fixture incident trace, PROVING each
 * runbook's steps reach recovery (`runbook-reaches-recovery`, one named
 * test per incident class).
 *
 * The proof model (documented in docs/operations/runbook-index.md): an
 * action, WHEN PRESENT AND APPLICABLE, deterministically performs its
 * neutral effect on the simulated environment; a recovery check is a typed
 * predicate over the post-mitigation state. A runbook therefore reaches
 * recovery iff its steps COVER the incident's needs (detection matched +
 * every recovery check passes). The negative evidence
 * (`runbook-missing-mitigation-yields-typed-non-recovery`) proves the
 * simulator is not vacuous: removing a needed step yields a TYPED
 * non-recovery proof — never a false green.
 *
 * Determinism: zero wall-clock, zero randomness; the final-state digest is
 * a canonical projection; two simulations of the same (runbook, trace,
 * topology) produce byte-identical proof digests.
 */
import { z } from 'zod';
import { canonicalDigest, canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  ComponentIdSchema,
  DeployProvenanceSchema,
  scanProviderVocabulary,
  verifyEnvironmentStateDigest,
  verifyTopologyDigest,
  type DeployProvenance,
  type TopologyRevision,
} from '@epoch/deploy-model';
import type { Revision } from '@epoch/deploy-model';
import { RunbookContentSchema, type RunbookContent, type RunbookRecord, type RunbookStep } from '../runbooks/schema';
import type { RecoveryCheck } from '../runbooks/schema';
import { IncidentTraceContentSchema, type IncidentTrace, type IncidentTraceContent } from './schema';
import { opsFail, type OpsResult } from '../errors';
import { OPS_RECORD_VERSION } from '../version';

// --------------------------------------------------------------------------------
// The recovery proof record (sealed).
// --------------------------------------------------------------------------------

const appliedStepShape = z
  .strictObject({
    stepId: z.string().min(1).max(128),
    action: z.string().min(1).max(64),
    componentId: ComponentIdSchema.nullable(),
    phase: z.enum(['containment', 'mitigation']),
  })
  .readonly();

const evaluatedCheckShape = z
  .strictObject({
    kind: z.string().min(1).max(64),
    componentId: ComponentIdSchema.nullable(),
    passed: z.boolean(),
  })
  .readonly();

const recoveryProofShape = z.strictObject({
  recordVersion: z.literal(OPS_RECORD_VERSION),
  runbookId: z.string().regex(/^rb:[a-z0-9][a-z0-9-]{0,62}$/),
  traceId: z.string().regex(/^trace:[a-z0-9][a-z0-9-]{0,62}$/),
  incidentClass: z.string().min(1).max(64),
  environmentId: z.string().regex(/^env:[a-z0-9][a-z0-9-]{0,62}$/),
  detectionMatched: z.boolean(),
  unmatchedSignals: z.array(z.string()).readonly(),
  stepsApplied: z.array(appliedStepShape).readonly(),
  checksEvaluated: z.array(evaluatedCheckShape).readonly(),
  recoveryReached: z.boolean(),
  initialStateDigest: z.string().regex(/^[0-9a-f]{64}$/),
  finalStateDigest: z.string().regex(/^[0-9a-f]{64}$/),
  provenance: DeployProvenanceSchema,
});

/** A recovery proof (content half). */
export const RecoveryProofContentSchema = recoveryProofShape.readonly();
export type RecoveryProofContent = z.infer<typeof RecoveryProofContentSchema>;

/** A sealed recovery proof (content-addressed). */
export const RecoveryProofSchema = recoveryProofShape
  .extend({ digest: z.string().regex(/^[0-9a-f]{64}$/) })
  .readonly();
export type RecoveryProof = z.infer<typeof RecoveryProofSchema>;

// --------------------------------------------------------------------------------
// Simulation state.
// --------------------------------------------------------------------------------

interface SimPlacement {
  revision: Revision;
  quarantined: boolean;
}

interface SimState {
  readonly placements: Map<string, SimPlacement>;
  readonly quarantined: Set<string>;
  readonly health: Map<string, 'healthy' | 'degraded' | 'failed'>;
  gatesGreen: boolean;
  readonly capacityObserved: Map<string, number>;
  readonly capacityDeclared: Map<string, number>;
  readonly integrityOk: Map<string, boolean>;
  readonly restored: Set<string>;
  readonly pinnedPrior: Map<string, Revision>;
  deployFrozen: boolean;
  stalled: boolean;
  resumed: boolean;
  operatorNotified: boolean;
}

/** Canonical final-state projection (deterministic digest input). */
function simStateProjection(state: SimState): JsonValue {
  const placementEntries = [...state.placements.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([componentId, placement]) => ({ componentId, revision: placement.revision, quarantined: placement.quarantined }));
  const flagEntries = (map: Map<string, unknown>): { key: string; value: unknown }[] =>
    [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, value]) => ({ key, value }));
  return {
    placements: placementEntries,
    deployFrozen: state.deployFrozen,
    gatesGreen: state.gatesGreen,
    stalled: state.stalled,
    resumed: state.resumed,
    operatorNotified: state.operatorNotified,
    health: flagEntries(state.health),
    capacityObserved: flagEntries(state.capacityObserved),
    integrityOk: flagEntries(state.integrityOk),
    restored: [...state.restored].sort(),
  } as unknown as JsonValue;
}

/** Build the initial simulation state from the trace + topology. */
function initialSimState(trace: IncidentTrace, topology: TopologyRevision): SimState {
  const capacityDeclared = new Map<string, number>(
    topology.components.map((component) => [component.componentId, component.capacity.replicas] as const),
  );
  const placements = new Map<string, SimPlacement>(
    trace.initialState.placements.map((placement) => [
      placement.componentId,
      { revision: placement.revision, quarantined: false },
    ] as const),
  );
  const health = new Map<string, 'healthy' | 'degraded' | 'failed'>();
  const capacityObserved = new Map<string, number>(capacityDeclared);
  const integrityOk = new Map<string, boolean>(topology.components.map((component) => [component.componentId, true] as const));
  let gatesGreen = true;
  let stalled = false;
  for (const event of trace.events) {
    if (event.kind === 'probe-observed') health.set(event.componentId, event.result);
    else if (event.kind === 'gate-outcome-observed') gatesGreen = event.green;
    else if (event.kind === 'capacity-observed') capacityObserved.set(event.componentId, event.observedReplicas);
    else if (event.kind === 'digest-observed') integrityOk.set(event.componentId, event.verified);
    else if (event.kind === 'step-stalled-observed') stalled = true;
  }
  return {
    placements,
    quarantined: new Set<string>(),
    health,
    gatesGreen,
    capacityObserved,
    capacityDeclared,
    integrityOk,
    restored: new Set<string>(),
    pinnedPrior: new Map<string, Revision>(),
    deployFrozen: false,
    stalled,
    resumed: false,
    operatorNotified: false,
  };
}

/** Apply one runbook step's deterministic effect. */
function applyStep(step: RunbookStep, phase: 'containment' | 'mitigation', state: SimState, trace: IncidentTrace): void {
  switch (step.action) {
    case 'quarantine-component': {
      const componentId = step.componentId!;
      state.quarantined.add(componentId);
      const placement = state.placements.get(componentId);
      if (placement !== undefined) state.placements.set(componentId, { ...placement, quarantined: true });
      break;
    }
    case 'freeze-deploys':
      state.deployFrozen = true;
      break;
    case 'notify-operator':
      state.operatorNotified = true;
      break;
    case 'pin-prior-revision': {
      const componentId = step.componentId!;
      const prior = trace.priorRevisions.find((entry) => entry.componentId === componentId);
      if (prior !== undefined) state.pinnedPrior.set(componentId, prior.revision);
      break;
    }
    case 'restore-placement-revision': {
      const componentId = step.componentId!;
      const pinned = state.pinnedPrior.get(componentId);
      if (pinned !== undefined) {
        state.placements.set(componentId, { revision: pinned, quarantined: state.quarantined.has(componentId) });
        state.restored.add(componentId);
      }
      break;
    }
    case 'un-place-component':
      state.placements.delete(step.componentId!);
      break;
    case 'verify-record-digests':
      state.integrityOk.set(step.componentId!, true);
      break;
    case 're-run-verification-battery':
      state.gatesGreen = true;
      break;
    case 'scale-out-component': {
      const componentId = step.componentId!;
      const declared = state.capacityDeclared.get(componentId);
      if (declared !== undefined) state.capacityObserved.set(componentId, declared);
      break;
    }
    case 're-run-health-probe': {
      const componentId = step.componentId!;
      const probe = trace.recoveryProbes.find((entry) => entry.componentId === componentId);
      if (probe !== undefined) state.health.set(componentId, probe.result);
      break;
    }
    case 'clear-quarantine': {
      const componentId = step.componentId!;
      state.quarantined.delete(componentId);
      const placement = state.placements.get(componentId);
      if (placement !== undefined) state.placements.set(componentId, { ...placement, quarantined: false });
      break;
    }
    case 'resume-deploy-steps':
      state.resumed = true;
      state.stalled = false;
      break;
    default: {
      const exhaustive: never = step.action;
      throw new Error(`ops-kit: unhandled runbook action ${(exhaustive as string)}`);
    }
  }
  void phase;
}

/** Evaluate one recovery check (typed predicate over the final state). */
function evaluateCheck(check: RecoveryCheck, state: SimState): boolean {
  const componentId = check.componentId;
  switch (check.kind) {
    case 'component-healthy':
      return componentId !== null && state.health.get(componentId) === 'healthy';
    case 'component-degraded-but-serving':
      return componentId !== null && state.health.get(componentId) === 'degraded' && !state.quarantined.has(componentId);
    case 'placement-revision-restored':
      return componentId !== null && state.restored.has(componentId);
    case 'all-gates-green':
      return state.gatesGreen;
    case 'capacity-within-envelope':
      return (
        componentId !== null &&
        (state.capacityObserved.get(componentId) ?? Number.MAX_SAFE_INTEGER) <= (state.capacityDeclared.get(componentId) ?? -1)
      );
    case 'record-digests-verified':
      return componentId !== null && state.integrityOk.get(componentId) === true;
    case 'deploy-steps-resumed':
      return state.resumed;
    case 'operator-notified':
      return state.operatorNotified;
    default: {
      const exhaustive: never = check.kind;
      throw new Error(`ops-kit: unhandled recovery check ${(exhaustive as string)}`);
    }
  }
}

// --------------------------------------------------------------------------------
// The simulator.
// --------------------------------------------------------------------------------

/** Verify a sealed runbook's digest. */
export function verifyRunbookDigest(runbook: RunbookRecord): OpsResult<RunbookRecord> {
  const content = runbookContent(runbook);
  const revalidated = RunbookContentSchema.safeParse(content);
  if (!revalidated.success) {
    return opsFail('validation', `runbook "${runbook.runbookId}" failed validation: ${revalidated.error.issues[0]?.message ?? 'unknown'}`);
  }
  const expected = canonicalDigest(content as unknown as JsonValue);
  return expected === runbook.digest
    ? { ok: true, value: runbook }
    : opsFail('digest-mismatch', `runbook "${runbook.runbookId}": digest does not match content (tampered runbook)`);
}

/** The content half of a sealed runbook (digest excluded). */
export function runbookContent(runbook: RunbookRecord): Omit<RunbookRecord, 'digest'> {
  const { digest: _digest, ...rest } = runbook;
  void _digest;
  return rest;
}

/** The content half of a sealed incident trace (digest excluded). */
export function incidentTraceContent(trace: IncidentTrace): Omit<IncidentTrace, 'digest'> {
  const { digest: _digest, ...rest } = trace;
  void _digest;
  return rest;
}

/** Verify a sealed incident trace's digest (including its embedded state). */
export function verifyIncidentTraceDigest(trace: IncidentTrace): OpsResult<IncidentTrace> {
  const stateVerified = verifyEnvironmentStateDigest(trace.initialState);
  if (!stateVerified.ok) return opsFail('digest-mismatch', stateVerified.error.message);
  const content = incidentTraceContent(trace);
  const revalidated = IncidentTraceContentSchema.safeParse(content);
  if (!revalidated.success) {
    return opsFail('validation', `trace "${trace.traceId}" failed validation: ${revalidated.error.issues[0]?.message ?? 'unknown'}`);
  }
  const expected = canonicalDigest(content as unknown as JsonValue);
  return expected === trace.digest
    ? { ok: true, value: trace }
    : opsFail('digest-mismatch', `trace "${trace.traceId}": digest does not match content (tampered trace)`);
}

/** Seal an incident trace content (validates + computes digest). */
export function sealIncidentTrace(content: IncidentTraceContent): OpsResult<IncidentTrace> {
  const parsed = IncidentTraceContentSchema.safeParse(content);
  if (!parsed.success) {
    return opsFail('validation', `incident trace failed validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  }
  const findings = scanProviderVocabulary(parsed.data);
  if (findings.length > 0) {
    return opsFail('provider-vocabulary-rejected', `incident trace: ${findings.map((finding) => finding.excerpt).join('; ')}`);
  }
  return { ok: true, value: { ...parsed.data, digest: canonicalDigest(parsed.data as unknown as JsonValue) } };
}

/** Seal a runbook content (validates + computes digest). */
export function sealRunbook(content: RunbookContent): OpsResult<RunbookRecord> {
  const parsed = RunbookContentSchema.safeParse(content);
  if (!parsed.success) {
    return opsFail('validation', `runbook failed validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  }
  const findings = scanProviderVocabulary(parsed.data);
  if (findings.length > 0) {
    return opsFail('provider-vocabulary-rejected', `runbook: ${findings.map((finding) => finding.excerpt).join('; ')}`);
  }
  return { ok: true, value: { ...parsed.data, digest: canonicalDigest(parsed.data as unknown as JsonValue) } };
}

/** Simulate a runbook against an incident trace (total, deterministic). */
export function simulateIncidentRunbook(input: {
  readonly runbook: RunbookRecord;
  readonly trace: IncidentTrace;
  readonly topology: TopologyRevision;
  readonly provenance: DeployProvenance;
}): OpsResult<RecoveryProof> {
  const runbook = verifyRunbookDigest(input.runbook);
  if (!runbook.ok) return runbook;
  const trace = verifyIncidentTraceDigest(input.trace);
  if (!trace.ok) return trace;
  const topology = verifyTopologyDigest(input.topology);
  if (!topology.ok) return opsFail('digest-mismatch', topology.error.message);

  if (input.runbook.incidentClass !== input.trace.incidentClass) {
    return opsFail(
      'validation',
      `runbook "${input.runbook.runbookId}" handles incident class "${input.runbook.incidentClass}" but the trace records "${input.trace.incidentClass}"`,
    );
  }
  if (input.trace.topologyDigest !== input.topology.digest || input.trace.initialState.derivedFromTopologyDigest !== input.topology.digest) {
    return opsFail('topology-skew', `trace "${input.trace.traceId}" derives from a different topology revision than the provided one`);
  }

  // Component references resolve within the topology.
  const known = new Set(input.topology.components.map((component) => component.componentId));
  const referenceCheck = (componentId: string | null, where: string): OpsResult<true> =>
    componentId !== null && !known.has(componentId)
      ? opsFail('unknown-component', `${where} references unknown component "${componentId}"`)
      : { ok: true, value: true };
  for (const signal of input.runbook.detection) {
    const checked = referenceCheck(signal.componentId, `runbook detection signal "${signal.kind}"`);
    if (!checked.ok) return checked;
  }
  for (const step of [...input.runbook.containment, ...input.runbook.mitigation]) {
    const checked = referenceCheck(step.componentId, `runbook step "${step.stepId}"`);
    if (!checked.ok) return checked;
  }
  for (const check of input.runbook.recoveryVerification) {
    const checked = referenceCheck(check.componentId, `runbook recovery check "${check.kind}"`);
    if (!checked.ok) return checked;
  }
  for (const signal of input.trace.signals) {
    const checked = referenceCheck(signal.componentId, `trace signal "${signal.kind}"`);
    if (!checked.ok) return checked;
  }

  // Detection matching: every runbook signal is observed by the trace.
  const unmatchedSignals: string[] = [];
  for (const signal of input.runbook.detection) {
    const matched = input.trace.signals.some(
      (observed) => observed.kind === signal.kind && observed.componentId === signal.componentId,
    );
    if (!matched) unmatchedSignals.push(signal.kind);
  }
  const detectionMatched = unmatchedSignals.length === 0;

  // Replay: containment, then mitigation (in runbook order).
  const state = initialSimState(input.trace, input.topology);
  const stepsApplied: {
    readonly stepId: string;
    readonly action: string;
    readonly componentId: string | null;
    readonly phase: 'containment' | 'mitigation';
  }[] = [];
  for (const [phase, steps] of [
    ['containment', input.runbook.containment],
    ['mitigation', input.runbook.mitigation],
  ] as const) {
    for (const step of steps) {
      applyStep(step, phase, state, input.trace);
      stepsApplied.push({ stepId: step.stepId, action: step.action, componentId: step.componentId, phase });
    }
  }

  // Recovery verification (typed predicates).
  const checksEvaluated: RecoveryProofContent['checksEvaluated'] = input.runbook.recoveryVerification.map((check) => ({
    kind: check.kind,
    componentId: check.componentId,
    passed: evaluateCheck(check, state),
  }));
  const recoveryReached = detectionMatched && checksEvaluated.every((check) => check.passed);

  const content: RecoveryProofContent = {
    recordVersion: 1,
    runbookId: input.runbook.runbookId,
    traceId: input.trace.traceId,
    incidentClass: input.runbook.incidentClass,
    environmentId: input.trace.environmentId,
    detectionMatched,
    unmatchedSignals,
    stepsApplied,
    checksEvaluated,
    recoveryReached,
    initialStateDigest: input.trace.initialState.digest,
    finalStateDigest: canonicalDigest(simStateProjection(state)),
    provenance: input.provenance,
  };
  return { ok: true, value: { ...content, digest: canonicalDigest(content as unknown as JsonValue) } };
}

/** Parse + verify a foreign recovery proof (total). */
export function admitRecoveryProof(value: unknown): OpsResult<RecoveryProof> {
  const parsed = RecoveryProofSchema.safeParse(value);
  if (!parsed.success) return opsFail('validation', `recovery proof failed validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  const { digest: _digest, ...content } = parsed.data;
  void _digest;
  const expected = canonicalDigest(content as unknown as JsonValue);
  return expected === parsed.data.digest
    ? { ok: true, value: parsed.data }
    : opsFail('digest-mismatch', 'recovery proof digest does not match content (tampered proof)');
}

/** Canonical JSON serialization helpers (byte-stable). */
export function serializeRecoveryProof(proof: RecoveryProof): string {
  return canonicalJsonStringify(proof as unknown as JsonValue);
}

export function serializeIncidentTrace(trace: IncidentTrace): string {
  return canonicalJsonStringify(trace as unknown as JsonValue);
}

export function deserializeIncidentTrace(text: string): OpsResult<IncidentTrace> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return opsFail('validation', `serialized incident trace is not valid JSON: ${(err as Error).message}`);
  }
  return verifyIncidentTraceDigest(parsed as IncidentTrace);
}

export function serializeRunbook(runbook: RunbookRecord): string {
  return canonicalJsonStringify(runbook as unknown as JsonValue);
}

export function deserializeRunbook(text: string): OpsResult<RunbookRecord> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return opsFail('validation', `serialized runbook is not valid JSON: ${(err as Error).message}`);
  }
  return verifyRunbookDigest(parsed as RunbookRecord);
}
