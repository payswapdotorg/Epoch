// Published-surface integrity: the exported vocabularies, the id
// patterns, the lifecycle transition table, and the event vocabulary are
// exactly the architecture-pinned sets; every schema-surface type is
// exported from the package index and round-trips through its validator.
import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_BINDING_ID_PATTERN,
  RUN_LIFECYCLE_TRANSITIONS,
  RUN_TRANSITION_CAUSES,
  SEMVER_CORE_PATTERN,
  SIMULATION_EVENT_DISCRIMINATORS,
  SIMULATION_EVENT_RECORD_VERSION,
  SIMULATION_FABRIC_CONTRACT_VERSION,
  SIMULATION_FABRIC_RECORD_VERSION,
  SIMULATION_FABRIC_SCHEMA_SURFACE,
  SIMULATION_IDEMPOTENCY_KEY_PATTERN,
  SIMULATION_JOB_ID_PATTERN,
  SIMULATION_PRINCIPAL_ID_PATTERN,
  SIMULATION_RUN_ID_PATTERN,
  SIMULATION_RUN_STATUSES,
  SIMULATION_STREAM_ID_PATTERN,
  isTerminalRunStatus,
  kindPrefixOf,
  simulationStreamIdOf,
  CapabilityBindingRefSchema,
  RunTransitionSchema,
  SealedSimulationResultSchema,
  SimulationEventContentSchema,
  SimulationRunSchema,
  SimulationRunStateSchema,
  SimulationFabric,
  deriveRunIdempotencyKey,
  runIdOf,
} from '../src/index';
import {
  ACTOR,
  TENANT,
  T1,
  bindingFixture,
  eventContentOf,
  referenceRequestFixture,
  referenceSubmission,
  unwrap,
} from './fixtures';

describe('simulation-fabric published surface', () => {
  it('version constants are pinned', () => {
    expect(SIMULATION_FABRIC_CONTRACT_VERSION).toBe('1.0.0');
    expect(SIMULATION_FABRIC_RECORD_VERSION).toBe(1);
    expect(SIMULATION_EVENT_RECORD_VERSION).toBe(1);
  });

  it('run and job ids are kind-prefixed (no embedded objects)', () => {
    expect('simrun:abcdef0123456789').toMatch(SIMULATION_RUN_ID_PATTERN);
    expect('simjob:batch-0001').toMatch(SIMULATION_JOB_ID_PATTERN);
    expect(SIMULATION_RUN_ID_PATTERN.test('simrun:')).toBe(false);
    expect(SIMULATION_RUN_ID_PATTERN.test('run:abc')).toBe(false);
    expect(SIMULATION_JOB_ID_PATTERN.test('SIMJOB:upper')).toBe(false);
    expect(kindPrefixOf('simrun:abc')).toBe('simrun');
  });

  it('principal, stream and idempotency-key grammars mirror the W009/W010/W020 conventions', () => {
    expect('principal:simulation-lead').toMatch(SIMULATION_PRINCIPAL_ID_PATTERN);
    expect('stream:simulation-abcdef0123456789').toMatch(SIMULATION_STREAM_ID_PATTERN);
    expect(deriveRunIdempotencyKey({ tenantId: TENANT, runDigest: 'a'.repeat(64) })).toMatch(
      SIMULATION_IDEMPOTENCY_KEY_PATTERN,
    );
    expect(SIMULATION_PRINCIPAL_ID_PATTERN.test('agent:field-surveyor')).toBe(false);
    expect(SIMULATION_STREAM_ID_PATTERN.test('simulation:abc')).toBe(false);
    expect(SIMULATION_IDEMPOTENCY_KEY_PATTERN.test('bad key!')).toBe(false);
  });

  it('capability binding references carry the W007 vocabularies', () => {
    expect('engineering.stress-analysis').toMatch(CAPABILITY_BINDING_ID_PATTERN);
    expect('1.2.3').toMatch(SEMVER_CORE_PATTERN);
    expect(SEMVER_CORE_PATTERN.test('1.2')).toBe(false);
    const admitted = CapabilityBindingRefSchema.safeParse(bindingFixture());
    expect(admitted.success, JSON.stringify(admitted.error?.issues)).toBe(true);
  });

  it('the run lifecycle vocabulary and transition table are closed', () => {
    expect([...SIMULATION_RUN_STATUSES]).toEqual([
      'submitted',
      'scheduled',
      'running',
      'completed',
      'failed',
      'cancelled',
    ]);
    expect(RUN_LIFECYCLE_TRANSITIONS.submitted).toEqual(['scheduled', 'cancelled']);
    expect(RUN_LIFECYCLE_TRANSITIONS.scheduled).toEqual(['running', 'cancelled']);
    expect(RUN_LIFECYCLE_TRANSITIONS.running).toEqual(['completed', 'failed', 'cancelled']);
    expect(RUN_LIFECYCLE_TRANSITIONS.completed).toEqual([]);
    expect(RUN_LIFECYCLE_TRANSITIONS.failed).toEqual([]);
    expect(RUN_LIFECYCLE_TRANSITIONS.cancelled).toEqual([]);
    for (const status of ['completed', 'failed', 'cancelled'] as const) {
      expect(isTerminalRunStatus(status)).toBe(true);
    }
    for (const status of ['submitted', 'scheduled', 'running'] as const) {
      expect(isTerminalRunStatus(status)).toBe(false);
    }
  });

  it('the transition-cause and event vocabularies are closed', () => {
    expect([...RUN_TRANSITION_CAUSES]).toEqual([
      'submission',
      'planning',
      'dispatch',
      'result-ingested',
      'execution-failed',
      'result-rejected',
      'cancellation',
    ]);
    expect([...SIMULATION_EVENT_DISCRIMINATORS]).toEqual([
      'simulation:run-submitted',
      'simulation:run-scheduled',
      'simulation:run-started',
      'simulation:run-completed',
      'simulation:run-failed',
      'simulation:run-cancelled',
      'simulation:result-published',
    ]);
  });

  it('one run = one stream, derived deterministically', () => {
    expect(simulationStreamIdOf('simrun:abcdef0123456789')).toBe(
      'stream:simulation-abcdef0123456789',
    );
  });

  it('the run id is derived from the identity digest (content-addressed)', () => {
    const digest = 'a'.repeat(64);
    expect(runIdOf(digest)).toBe(`simrun:${digest.slice(0, 16)}`);
  });

  it('every schema-surface type is exported and round-trips through its validator', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob(referenceSubmission() as never),
    );
    const runAgain = SimulationRunSchema.safeParse(JSON.parse(JSON.stringify(run)));
    expect(runAgain.success, JSON.stringify(runAgain.error?.issues)).toBe(true);
    const state = SimulationRunStateSchema.safeParse(JSON.parse(JSON.stringify(run.states[0])));
    expect(state.success).toBe(true);
    const transition = RunTransitionSchema.safeParse(JSON.parse(JSON.stringify(run.states[0]!.transition)));
    expect(transition.success).toBe(true);
    const [sealedEvent] = unwrap(fabric.runEvents({ tenantId: TENANT, runId: run.runId }));
    const event = SimulationEventContentSchema.safeParse(
      eventContentOf(JSON.parse(JSON.stringify(sealedEvent))),
    );
    expect(event.success).toBe(true);
    const sealedResult = SealedSimulationResultSchema.safeParse({
      result: {
        protocolVersion: '1.0.0',
        messageKind: 'simulation.result',
        resultId: 'simresult-x',
        request: run.invocation,
        simulator: run.simulator,
        outcome: { status: 'completed', outputs: { y: 7 } },
        deterministic: true,
      },
      resultDigest: 'e'.repeat(64),
    });
    expect(sealedResult.success).toBe(true);
  });

  it('the schema surface lists every published type exactly once', () => {
    const types = SIMULATION_FABRIC_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    for (const expected of [
      'CapabilityBindingRef',
      'FabricRunEntry',
      'SealedSimulationEvent',
      'SealedSimulationResult',
      'SimulationEventContent',
      'SimulationRun',
      'SimulationRunState',
      'SimulationFabricSnapshot',
    ]) {
      expect(types).toContain(expected);
    }
  });

  it('a malformed run is rejected by the validator (strict objects)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const corrupted = {
      ...JSON.parse(JSON.stringify(run)),
      vendorGridEndpoint: 'https://grid.example.internal',
    };
    expect(SimulationRunSchema.safeParse(corrupted).success).toBe(false);
  });

  it('reference fixtures stay consistent with the W005 protocol', () => {
    const request = referenceRequestFixture();
    expect(request.simulator).toEqual({
      simulatorId: 'simulator:reference-affine-scalar',
      registrationDigest: expect.any(String),
    });
    expect(ACTOR).toMatch(SIMULATION_PRINCIPAL_ID_PATTERN);
    expect(T1).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
