// Cross-package composition parity (runtime): fabric events flow into the
// REAL W010 EventLog end-to-end through the runner; the REAL W007
// registry lifecycle drives intake decisions; the REAL @epoch/authorization
// kernel denies cross-tenant run access with the same isolation
// vocabulary. devDependencies only where not runtime deps — no forked
// authorities (the W020 agent-runtime parity pattern).
import { describe, expect, it } from 'vitest';
import { EventLog } from '@epoch/event-log';
import type { EventContent } from '@epoch/event-log';
import { evaluate } from '@epoch/authorization';
import type { AuthorizationContext } from '@epoch/authorization';
import { ReferenceSimulationExecutionPort, simulationStreamIdOf } from '@epoch/simulation-fabric';
import { SimulationRunner, admittedCapabilitiesFromRegistry } from '../src/index';
import {
  ACTOR,
  OTHER_TENANT,
  TENANT,
  T2,
  T3,
  capabilityManifest,
  fixtureRegistry,
  referenceSubmission,
  sealedCapability,
  stressBinding,
  unwrap,
} from './helpers';

describe('W010 event-log parity (runtime composition)', () => {
  it('the runner\'s full event stream appends into a REAL EventLog end-to-end', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    unwrap(runner.planRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    unwrap(
      runner.executeRun({
        tenantId: TENANT,
        runId: run.runId,
        port: new ReferenceSimulationExecutionPort(),
        actor: ACTOR,
        at: T3,
      }),
    );
    const events = unwrap(runner.runEvents({ tenantId: TENANT, runId: run.runId }));
    expect(events).toHaveLength(5);

    const log = new EventLog({ expectedTenantId: TENANT });
    for (const sealed of events) {
      const { contentDigest, ...content } = sealed;
      const appended = log.appendEvent({
        event: content as unknown as EventContent,
        digest: contentDigest,
      });
      if (!appended.ok) {
        throw new Error(`runner event must append into the real log: ${appended.error.message}`);
      }
    }
    const readBack = log.readStream(simulationStreamIdOf(run.runId));
    expect(readBack.ok).toBe(true);
    if (!readBack.ok) return;
    expect(readBack.value.map((record) => record.contentDigest)).toEqual(
      events.map((event) => event.contentDigest),
    );
  });
});

describe('W007 capability-registry parity (runtime composition)', () => {
  it('the adapter seam derives the admitted set from the REAL registry lifecycle', () => {
    const registry = fixtureRegistry();
    const admitted = admittedCapabilitiesFromRegistry(registry);
    // The retired legacy-solver is excluded; stress-analysis is admitted.
    expect(admitted.map((entry) => entry.capabilityId)).toEqual(['engineering.stress-analysis']);
    expect(admitted[0]).toEqual(stressBinding());

    // A freshly registered capability joins the admitted set; retiring it
    // removes it again (W007 lifecycle semantics at the seam).
    const fresh = registry.register(
      sealedCapability(capabilityManifest({ capabilityId: 'engineering.fresh', version: '1.0.0' })),
    );
    expect(fresh.ok).toBe(true);
    expect(
      admittedCapabilitiesFromRegistry(registry).map((entry) => entry.capabilityId),
    ).toContain('engineering.fresh');
    const retired = registry.retire({ capabilityId: 'engineering.fresh', version: '1.0.0' });
    expect(retired.ok).toBe(true);
    expect(
      admittedCapabilitiesFromRegistry(registry).map((entry) => entry.capabilityId),
    ).not.toContain('engineering.fresh');
  });

  it('the runner resolves a binding to a deprecated capability (deprecation is advisory)', () => {
    const registry = fixtureRegistry();
    const deprecated = registry.deprecate({
      capabilityId: 'engineering.stress-analysis',
      version: '1.2.3',
    });
    expect(deprecated.ok).toBe(true);
    const runner = new SimulationRunner({ registry });
    const submitted = runner.submitJob(referenceSubmission() as never);
    expect(submitted.ok).toBe(true);
  });
});

describe('authorization parity (runtime composition)', () => {
  it('the runner and @epoch/authorization deny cross-tenant run access with the same vocabulary', () => {
    const runner = new SimulationRunner({ registry: fixtureRegistry() });
    const run = unwrap(runner.submitJob(referenceSubmission() as never));
    const denied = runner.getRun({ tenantId: OTHER_TENANT, runId: run.runId });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe('tenant-isolation-rejected');
    }
    // The same access pattern, decided by the REAL authorization kernel.
    const context: AuthorizationContext = {
      schemaVersion: 1,
      principals: [{ principalId: ACTOR, status: 'active', authenticated: true }],
      memberships: [{ principalId: ACTOR, tenantId: OTHER_TENANT }],
      knownTenants: [TENANT, OTHER_TENANT],
    };
    const decision = evaluate(
      {
        schemaVersion: 1,
        principalId: ACTOR,
        actionKind: 'epoch.simulation.run.read',
        resource: {
          resourceType: 'simulation-run',
          resourceId: run.runId,
          tenantId: TENANT,
        },
      },
      context,
    );
    if (!decision.ok) throw new Error(decision.error.message);
    expect(decision.value.outcome).toBe('deny');
    if (decision.value.outcome === 'deny') {
      expect(decision.value.denial.code).toBe('cross-tenant-denied');
    }
  });
});
