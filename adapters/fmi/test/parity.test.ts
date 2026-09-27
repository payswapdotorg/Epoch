// W007 registration + binding + invocation evidence, and the W021
// simulation-fabric seam parity (the REAL fabric driving the adapter as
// its execution backend — devDependencies only).
import { describe, expect, it } from 'vitest';
import { computeCapabilityManifestDigest, sealCapabilityManifest } from '@epoch/capability-registry';
import { negotiateBinding } from '@epoch/adapter-sdk';
import {
  SimulationFabric,
  type AdmittedInvocation,
  type PortExecution,
  type SimulationExecutionPort,
} from '@epoch/simulation-fabric';
import {
  checkInvocationConformance,
  parseSimulationInvocationRequest,
  registrationDigest as w005RegistrationDigest,
  type SimulationInvocationRequest,
  type SimulatorRegistration,
} from '@epoch/simulation-protocol';
import {
  SIMULATION_ADAPTER_DESCRIPTOR,
  deriveCapabilityRegistrations,
  deriveParticipantRegistration,
  referenceParticipant,
  simulatorIdOf,
} from '../src/index';
import {
  REFERENCE_PARTICIPANT_ID,
  REFERENCE_INPUTS,
  TENANT_A,
  adapterSetup,
  pinFor,
  referenceParticipantTyped,
  registryWithAdapter,
} from './helpers';

describe('W007 registration (the REAL registry, devDependency parity)', () => {
  it('derives the simulation-category registration', () => {
    const registrations = deriveCapabilityRegistrations();
    expect(registrations.length).toBe(1);
    expect(registrations[0]!.manifest.category).toBe('simulation');
    expect(registrations[0]!.manifest.trust.origin).toBe('external-software');
  });

  it('the derived digest equals the REAL registry manifest digest', () => {
    for (const registration of deriveCapabilityRegistrations()) {
      expect(registration.digest).toBe(computeCapabilityManifestDigest(registration.manifest));
    }
  });

  it('the REAL registry admits the derived registration under the simulation category', () => {
    const registry = registryWithAdapter();
    const records = registry.list({ category: 'simulation' });
    expect(records.length).toBe(1);
    expect(records[0]!.lifecycle).toBe('registered');
  });

  it('the REAL SDK negotiates the binding for the adapter descriptor', () => {
    const registry = registryWithAdapter();
    const record = registry.list({ category: 'simulation' })[0]!;
    const negotiated = negotiateBinding(SIMULATION_ADAPTER_DESCRIPTOR, record);
    expect(negotiated.ok).toBe(true);
    if (negotiated.ok) {
      expect(negotiated.value.adapterId).toBe(SIMULATION_ADAPTER_DESCRIPTOR.adapterId);
      expect(negotiated.value.capabilityId).toBe(SIMULATION_ADAPTER_DESCRIPTOR.binding.capabilityId);
      expect(negotiated.value.manifestDigest).toBe(record.manifestDigest);
    }
  });

  it('retirement stops new bindings (the lifecycle convention holds through the real registry)', () => {
    const registry = registryWithAdapter();
    const record = registry.list({ category: 'simulation' })[0]!;
    registry.retire({ capabilityId: record.manifest.capabilityId, version: record.manifest.version });
    const retired = registry.get({
      capabilityId: record.manifest.capabilityId,
      version: record.manifest.version,
    });
    if (!retired.ok) throw new Error(retired.error.message);
    const negotiated = negotiateBinding(SIMULATION_ADAPTER_DESCRIPTOR, retired.value);
    expect(negotiated.ok).toBe(false);
    if (negotiated.ok) throw new Error('unreachable');
    expect(negotiated.error.code).toBe('lifecycle-conflict');
  });
});

describe('registered invocation (the W007 envelope end-to-end)', () => {
  it('a simulation invocation through a REAL negotiated pin completes with deterministic outputs', async () => {
    const { adapter } = adapterSetup();
    const registry = registryWithAdapter();
    const pin = pinFor(adapter, registry);
    const response = await adapter.invoke({
      schemaVersion: 1,
      category: 'simulation',
      binding: pin,
      payload: {
        inputs: {
          tenant: TENANT_A,
          participant: REFERENCE_PARTICIPANT_ID,
          values: { ...REFERENCE_INPUTS },
        },
      },
    });
    expect(response.category).toBe('simulation');
    expect(response.payload.status).toBe('completed');
    if (response.payload.status !== 'completed') throw new Error('unreachable');
    expect(response.payload.outputs['step-digest']).toMatch(/^[0-9a-f]{64}$/);
    const outputs = response.payload.outputs.outputs as Record<string, number>;
    expect(outputs.position).toBeCloseTo(1, 12);
  });
});

/**
 * The reference W021 wiring: this adapter behind the REAL simulation
 * fabric's `SimulationExecutionPort` seam. The port validates the W005
 * chain (registration pin + invocation conformance) and executes the
 * participant step; the fabric re-admits and seals the result.
 */
class ParticipantExecutionPort implements SimulationExecutionPort {
  private count = 0;

  constructor(
    private readonly registration: SimulatorRegistration,
    private readonly registrationDigest: string,
    private readonly stepValues: Record<string, number>,
  ) {}

  get executionCount(): number {
    return this.count;
  }

  execute(invocation: AdmittedInvocation): PortExecution {
    this.count += 1;
    if (invocation.request.simulator.simulatorId !== this.registration.simulatorId) {
      return {
        ok: false,
        failure: {
          code: 'input-out-of-domain',
          message: `this execution adapter serves "${this.registration.simulatorId}" only`,
        },
      };
    }
    if (invocation.request.simulator.registrationDigest !== this.registrationDigest) {
      return {
        ok: false,
        failure: {
          code: 'input-out-of-domain',
          message: 'the invocation pins a different registration revision than this adapter serves',
        },
      };
    }
    const violations = checkInvocationConformance(this.registration, invocation.request);
    if (violations.length > 0) {
      return {
        ok: false,
        failure: {
          code: 'input-out-of-domain',
          message: `the invocation does not conform to the registration (${violations[0]!.message})`,
        },
      };
    }
    const { adapter } = adapterSetup();
    const step = adapter.step({
      tenant: TENANT_A,
      participant: REFERENCE_PARTICIPANT_ID,
      values: this.stepValues,
    });
    if (!step.ok) {
      return {
        ok: false,
        failure: { code: 'internal-error', message: `the participant step failed: ${step.error.message}` },
      };
    }
    const result = {
      protocolVersion: '1.0.0',
      messageKind: 'simulation.result',
      resultId: `result-${step.value.stepDigest.slice(0, 16)}`,
      request: {
        requestId: invocation.request.requestId,
        requestDigest: parseDigestOf(invocation.request),
      },
      simulator: {
        simulatorId: this.registration.simulatorId,
        registrationDigest: this.registrationDigest,
      },
      outcome: {
        status: 'completed' as const,
        outputs: step.value.outputs as Record<string, number>,
      },
      deterministic: true,
    };
    return { ok: true, result };
  }
}

/** The W005 request digest (through the REAL admission pipeline). */
function parseDigestOf(request: SimulationInvocationRequest): string {
  const parsed = parseSimulationInvocationRequest(request);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.digest;
}

describe('W021 simulation-fabric seam parity (the REAL fabric drives the participant)', () => {
  it('the fabric submits, plans, executes, and seals a participant run end-to-end', () => {
    const participant = referenceParticipantTyped();
    const derived = deriveParticipantRegistration({ participant });
    // The registration digest computed the W005 way (the fabric's pin).
    const registrationDigest = w005RegistrationDigest(derived.registration);

    const fabric = new SimulationFabric({ expectedTenantId: TENANT_A });
    const run = fabric.submitJob({
      tenantId: TENANT_A,
      registration: derived.registration,
      request: {
        protocolVersion: '1.0.0',
        messageKind: 'simulation.invocation-request',
        messageId: 'msg-fabric-parity-run',
        createdAt: '2026-03-01T00:00:00.000Z',
        requestId: 'req-fabric-parity-run',
        simulator: {
          simulatorId: simulatorIdOf(participant),
          registrationDigest,
        },
        inputs: { ...REFERENCE_INPUTS },
      },
      capabilityBindings: [
        {
          capabilityId: 'participant.co-simulation-stepping',
          version: '1.0.0',
          registrationDigest: deriveCapabilityRegistrations()[0]!.digest,
        },
      ],
      actor: 'principal:fabric-parity',
      at: '2026-03-01T00:00:00.000Z',
    });
    expect(run.ok).toBe(true);
    if (!run.ok) throw new Error(run.error.message);
    expect(run.value.status).toBe('submitted');

    const planned = fabric.planExecution({
      tenantId: TENANT_A,
      runId: run.value.runId,
      actor: 'principal:fabric-parity',
      at: '2026-03-01T00:00:00.000Z',
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error(planned.error.message);
    expect(planned.value.status).toBe('scheduled');

    const port = new ParticipantExecutionPort(
      derived.registration,
      registrationDigest,
      { ...REFERENCE_INPUTS },
    );
    const executed = fabric.executeRun({
      tenantId: TENANT_A,
      runId: run.value.runId,
      port,
      actor: 'principal:fabric-parity',
      at: '2026-03-01T00:00:01.000Z',
    });
    expect(executed.ok).toBe(true);
    if (!executed.ok) throw new Error(executed.error.message);
    expect(executed.value.run.status).toBe('completed');
    expect(executed.value.result).toBeDefined();
    if (executed.value.result !== undefined) {
      const outputs = executed.value.result.result.outcome;
      if (outputs.status === 'completed') {
        expect(outputs.outputs.position).toBeCloseTo(1, 12);
      } else {
        throw new Error('the participant run should have completed');
      }
    }
    expect(port.executionCount).toBe(1);
  });

  it('a replayed submission under a consumed key is the typed duplicate-run admission (same run identity)', () => {
    const participant = referenceParticipantTyped();
    const derived = deriveParticipantRegistration({ participant });
    const registrationDigest = w005RegistrationDigest(derived.registration);
    const fabric = new SimulationFabric();
    const submission = {
      tenantId: TENANT_A,
      registration: derived.registration,
      request: {
        protocolVersion: '1.0.0',
        messageKind: 'simulation.invocation-request',
        messageId: 'msg-fabric-replay-run',
        createdAt: '2026-03-01T00:00:00.000Z',
        requestId: 'req-fabric-replay-run',
        simulator: { simulatorId: simulatorIdOf(participant), registrationDigest },
        inputs: { ...REFERENCE_INPUTS },
      },
      capabilityBindings: [],
      actor: 'principal:fabric-parity',
      at: '2026-03-01T00:00:00.000Z',
      idempotencyKey: 'replay-parity-key',
    };
    const first = fabric.submitJob(submission);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.error.message);
    // The typed duplicate-run admission: the existing run identity stands
    // (ok:false carrying the SAME run id + digest — never a silent dedup).
    const replay = fabric.submitJob(submission);
    expect(replay.ok).toBe(false);
    if (replay.ok || replay.error.code !== 'duplicate-run') throw new Error('unexpected outcome');
    expect(replay.error.runId).toBe(first.value.runId);
    expect(replay.error.runDigest).toBe(first.value.runDigest);
    void referenceParticipant;
    void sealCapabilityManifest;
  });
});
