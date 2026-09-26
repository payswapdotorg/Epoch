// Negative submission coverage: malformed W005 documents, nonconforming
// invocations, tenant-isolation gates, duplicate-run admission,
// idempotency conflicts, foreign-record structural copies, key grammar.
import { describe, expect, it } from 'vitest';
import { SimulationFabric } from '../src/index';
import {
  ACTOR,
  OTHER_TENANT,
  TENANT,
  T1,
  T2,
  admittedCapabilities,
  bindingFixture,
  secondBindingFixture as secondBinding,
  referenceRequestFixture,
  referenceSubmission,
  thermalRegistrationFixture,
  thermalRequestFixture,
  unwrap,
} from './fixtures';

describe('submitJob (negative: admission gates)', () => {
  it('rejects a malformed registration (validation, path registration)', () => {
    const fabric = new SimulationFabric();
    const submitted = fabric.submitJob(
      referenceSubmission({
        registration: thermalRegistrationFixture({ displayName: '' }),
      }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('validation');
      expect(submitted.error.message).toContain('registration');
    }
  });

  it('rejects a version-skewed registration (version-unsupported)', () => {
    const fabric = new SimulationFabric();
    const submitted = fabric.submitJob(
      referenceSubmission({
        registration: thermalRegistrationFixture({ protocolVersion: '2.0.0' }),
      }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('version-unsupported');
    }
  });

  it('rejects a malformed invocation request (validation, path request)', () => {
    const fabric = new SimulationFabric();
    const submitted = fabric.submitJob(
      referenceSubmission({
        request: referenceRequestFixture({ inputs: {} }),
      }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('validation');
      expect(submitted.error.message).toContain('request');
    }
  });

  it('rejects a nonconforming invocation (wrong registration digest)', () => {
    const fabric = new SimulationFabric();
    const submitted = fabric.submitJob(
      referenceSubmission({
        request: referenceRequestFixture({
          simulator: {
            simulatorId: 'simulator:reference-affine-scalar',
            registrationDigest: 'f'.repeat(64),
          },
        }),
      }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('nonconforming-invocation');
      if (submitted.error.code === 'nonconforming-invocation') {
        expect(submitted.error.violations.length).toBeGreaterThan(0);
        expect(submitted.error.violations[0]!.path).toBe('simulator.registrationDigest');
      }
    }
  });

  it('rejects a nonconforming invocation (undeclared input)', () => {
    const fabric = new SimulationFabric();
    const submitted = fabric.submitJob(
      referenceSubmission({
        request: referenceRequestFixture({
          inputs: { x: 2, slope: 3, intercept: 1, bogus: 9 },
        }),
      }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('nonconforming-invocation');
      if (submitted.error.code === 'nonconforming-invocation') {
        expect(
          submitted.error.violations.some((v) => v.path === 'inputs.bogus'),
        ).toBe(true);
      }
    }
  });

  it('rejects a malformed tenant id (validation, path tenantId)', () => {
    const fabric = new SimulationFabric();
    const submitted = fabric.submitJob(
      referenceSubmission({ tenantId: 'tenant:ACME' }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('validation');
      if (submitted.error.code === 'validation') {
        expect(submitted.error.issues[0]!.path).toBe('tenantId');
      }
    }
  });

  it('rejects a malformed actor principal (validation, path actor)', () => {
    const fabric = new SimulationFabric();
    const submitted = fabric.submitJob(
      referenceSubmission({ actor: 'agent:not-a-principal' }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('validation');
      if (submitted.error.code === 'validation') {
        expect(submitted.error.issues[0]!.path).toBe('actor');
      }
    }
  });

  it('rejects a caller-supplied idempotency key outside the grammar', () => {
    const fabric = new SimulationFabric();
    const submitted = fabric.submitJob(
      referenceSubmission({ idempotencyKey: 'not a valid key!' }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('validation');
      if (submitted.error.code === 'validation') {
        expect(submitted.error.issues[0]!.path).toBe('idempotencyKey');
      }
    }
  });
});

describe('submitJob (negative: foreign-record structural copy)', () => {
  it('rejects a capability binding that structurally copies registry fields (vendor-fields-rejected)', () => {
    const fabric = new SimulationFabric();
    const submitted = fabric.submitJob(
      referenceSubmission({
        capabilityBindings: [
          bindingFixture({
            descriptor: {
              displayName: 'Stress Analysis',
              inputs: [],
              outputs: [],
              assumptions: [],
            },
          }),
        ],
      }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('vendor-fields-rejected');
      expect(submitted.error.message).toContain('capabilityBindings[0]');
    }
  });

  it('rejects a capability binding with a malformed registration digest', () => {
    const fabric = new SimulationFabric();
    const submitted = fabric.submitJob(
      referenceSubmission({
        capabilityBindings: [bindingFixture({ registrationDigest: 'not-a-digest' })],
      }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('validation');
    }
  });
});

describe('submitJob (negative: tenant isolation)', () => {
  it('a tenant-pinned fabric rejects foreign-tenant submissions (tenant-isolation-rejected)', () => {
    const fabric = new SimulationFabric({ expectedTenantId: TENANT });
    const submitted = fabric.submitJob(
      referenceSubmission({ tenantId: OTHER_TENANT }) as never,
    );
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('tenant-isolation-rejected');
      if (submitted.error.code === 'tenant-isolation-rejected') {
        expect(submitted.error.expectedTenantId).toBe(TENANT);
        expect(submitted.error.encounteredTenantId).toBe(OTHER_TENANT);
      }
    }
  });
});

describe('submitJob (negative: idempotency)', () => {
  it('a replayed submission under a consumed key returns the SAME run identity (duplicate-run)', () => {
    const fabric = new SimulationFabric();
    const first = unwrap(fabric.submitJob(referenceSubmission() as never));
    const replay = fabric.submitJob(referenceSubmission() as never);
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error.code).toBe('duplicate-run');
      if (replay.error.code === 'duplicate-run') {
        expect(replay.error.runId).toBe(first.runId);
        expect(replay.error.runDigest).toBe(first.runDigest);
        expect(replay.error.idempotencyKey).toBe(first.idempotencyKey);
      }
    }
    // State unchanged: still exactly one hosted run, one event.
    expect(fabric.runCount).toBe(1);
    expect(unwrap(fabric.runEvents({ tenantId: TENANT, runId: first.runId }))).toHaveLength(1);
  });

  it('different content under a consumed key is the typed idempotency-conflict', () => {
    const fabric = new SimulationFabric();
    const first = unwrap(
      fabric.submitJob(referenceSubmission({ idempotencyKey: 'key-alpha' }) as never),
    );
    const conflict = fabric.submitJob(
      referenceSubmission({
        idempotencyKey: 'key-alpha',
        request: referenceRequestFixture({ requestId: 'simreq-different-0001' }),
      }) as never,
    );
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.error.code).toBe('idempotency-conflict');
      if (conflict.error.code === 'idempotency-conflict') {
        expect(conflict.error.idempotencyKey).toBe('key-alpha');
        expect(conflict.error.existingRunId).toBe(first.runId);
        expect(conflict.error.existingRunDigest).toBe(first.runDigest);
        expect(conflict.error.encounteredRunDigest).not.toBe(first.runDigest);
      }
    }
    expect(fabric.runCount).toBe(1);
  });

  it('identical content under a different key aliases the same run (duplicate-run, key bound)', () => {
    const fabric = new SimulationFabric();
    const first = unwrap(fabric.submitJob(referenceSubmission() as never));
    const alias = fabric.submitJob(
      referenceSubmission({ idempotencyKey: 'key-beta' }) as never,
    );
    expect(alias.ok).toBe(false);
    if (!alias.ok) {
      expect(alias.error.code).toBe('duplicate-run');
      if (alias.error.code === 'duplicate-run') {
        expect(alias.error.runId).toBe(first.runId);
        expect(alias.error.idempotencyKey).toBe('key-beta');
      }
    }
    expect(fabric.runCount).toBe(1);
    expect(fabric.idempotencyKeyCount).toBe(2);
  });

  it('idempotency keys are tenant-scoped (the same key in another tenant admits)', () => {
    const fabric = new SimulationFabric();
    unwrap(fabric.submitJob(referenceSubmission({ idempotencyKey: 'shared-key' }) as never));
    const other = fabric.submitJob(
      referenceSubmission({
        tenantId: OTHER_TENANT,
        idempotencyKey: 'shared-key',
      }) as never,
    );
    expect(other.ok).toBe(true);
    expect(fabric.runCount).toBe(2);
  });
});

describe('planExecution (negative)', () => {
  it('rejects an unresolvable capability binding (unknown-capability-binding)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob(
        referenceSubmission({
          capabilityBindings: [bindingFixture(), secondBinding()],
        }) as never,
      ),
    );
    const planned = fabric.planExecution({
      tenantId: TENANT,
      runId: run.runId,
      admittedCapabilities: [bindingFixture()] as never,
      actor: ACTOR,
      at: T2,
    });
    expect(planned.ok).toBe(false);
    if (!planned.ok) {
      expect(planned.error.code).toBe('unknown-capability-binding');
      if (planned.error.code === 'unknown-capability-binding') {
        expect(planned.error.capabilityId).toBe('engineering.meshing');
        expect(planned.error.version).toBe('2.0.0');
      }
    }
  });

  it('rejects planning a run that is not submitted (lifecycle-conflict)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(
      fabric.planExecution({
        tenantId: TENANT,
        runId: run.runId,
        actor: ACTOR,
        at: T2,
      }),
    );
    const replanned = fabric.planExecution({
      tenantId: TENANT,
      runId: run.runId,
      actor: ACTOR,
      at: T2,
    });
    expect(replanned.ok).toBe(false);
    if (!replanned.ok) {
      expect(replanned.error.code).toBe('lifecycle-conflict');
      if (replanned.error.code === 'lifecycle-conflict') {
        expect(replanned.error.from).toBe('scheduled');
        expect(replanned.error.to).toBe('scheduled');
      }
    }
  });

  it('rejects planning an unknown run (unknown-run)', () => {
    const fabric = new SimulationFabric();
    const planned = fabric.planExecution({
      tenantId: TENANT,
      runId: 'simrun:doesnotexist',
      actor: ACTOR,
      at: T2,
    });
    expect(planned.ok).toBe(false);
    if (!planned.ok) {
      expect(planned.error.code).toBe('unknown-run');
    }
  });

  it('rejects planning across the tenant boundary (tenant-isolation-rejected)', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const planned = fabric.planExecution({
      tenantId: OTHER_TENANT,
      runId: run.runId,
      actor: ACTOR,
      at: T2,
    });
    expect(planned.ok).toBe(false);
    if (!planned.ok) {
      expect(planned.error.code).toBe('tenant-isolation-rejected');
      if (planned.error.code === 'tenant-isolation-rejected') {
        expect(planned.error.expectedTenantId).toBe(OTHER_TENANT);
        expect(planned.error.encounteredTenantId).toBe(TENANT);
      }
    }
  });

  it('the admitted capability set accepts the thermal registration chain too', () => {
    // Positive guard: the reference-only admitted set admits runs whose
    // bindings all resolve; the thermal fixture carries none.
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob(
        referenceSubmission({
          registration: thermalRegistrationFixture(),
          request: thermalRequestFixture(),
          capabilityBindings: [],
        }) as never,
      ),
    );
    const planned = fabric.planExecution({
      tenantId: TENANT,
      runId: run.runId,
      admittedCapabilities: admittedCapabilities() as never,
      actor: ACTOR,
      at: T1,
    });
    expect(planned.ok).toBe(true);
  });
});
