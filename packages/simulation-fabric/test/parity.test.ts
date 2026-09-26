// Cross-package composition parity (runtime): the REAL W007 registry
// records become fabric capability binding references; the REAL W006
// evidence/verification digest grammars admit fabric digests; the REAL
// @epoch/authorization kernel denies cross-tenant run access with the
// same isolation vocabulary. devDependencies only — no forked authorities
// (the W020 agent-runtime parity pattern).
import { describe, expect, it } from 'vitest';
import {
  CapabilityRegistry,
  computeCapabilityManifestDigest,
} from '@epoch/capability-registry';
import { ExactRevisionRefSchema } from '@epoch/evidence';
import { RunSchema } from '@epoch/verification';
import { evaluate } from '@epoch/authorization';
import type { AuthorizationContext } from '@epoch/authorization';
import {
  CapabilityBindingRefSchema,
  ReferenceSimulationExecutionPort,
  SimulationFabric,
} from '../src/index';
import {
  ACTOR,
  OTHER_TENANT,
  TENANT,
  T2,
  T3,
  referenceSubmission,
  unwrap,
} from './fixtures';

/** A provider-neutral W007 capability manifest as loose JSON (the W020 helper shape). */
function capabilityManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    capabilityId: 'engineering.stress-analysis',
    category: 'simulation',
    version: '1.2.3',
    descriptor: {
      displayName: 'Stress Analysis',
      description: 'Linear static stress analysis over the reconstructed model.',
      inputs: [
        { name: 'load-kn', kind: 'number', required: true, description: 'Rated load in kN.' },
      ],
      outputs: [
        { name: 'max-stress-mpa', kind: 'number', required: true, description: 'Peak stress.' },
      ],
      assumptions: ['Linear-elastic material behavior within rated load.'],
    },
    contracts: [{ contractId: 'epoch.simulation-protocol', contractVersion: '1.0.0' }],
    trust: { origin: 'first-party', curator: 'actor:epoch-core' },
    ...overrides,
  };
}

describe('W007 capability-registry parity (runtime composition)', () => {
  it('a REAL registry record becomes a fabric capability binding reference (opaque)', () => {
    const registry = new CapabilityRegistry();
    const manifest = capabilityManifest();
    const registered = registry.register({
      manifest: manifest as never,
      digest: computeCapabilityManifestDigest(manifest as never),
    });
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    const reference = {
      capabilityId: registered.value.manifest.capabilityId,
      version: registered.value.manifest.version,
      registrationDigest: registered.value.manifestDigest,
    };
    const admitted = CapabilityBindingRefSchema.safeParse(reference);
    expect(admitted.success, JSON.stringify(admitted.error?.issues)).toBe(true);
    // The reference resolves against the admitted set derived from the
    // registry (the seam the service layer adapts).
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob(
        referenceSubmission({ capabilityBindings: [reference] }) as never,
      ),
    );
    const planned = fabric.planExecution({
      tenantId: TENANT,
      runId: run.runId,
      admittedCapabilities: [reference],
      actor: ACTOR,
      at: T2,
    });
    expect(planned.ok).toBe(true);
  });

  it('a binding whose digest does not match the registry record does not resolve', () => {
    const registry = new CapabilityRegistry();
    const manifest = capabilityManifest();
    const registered = registry.register({
      manifest: manifest as never,
      digest: computeCapabilityManifestDigest(manifest as never),
    });
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    const stale = {
      capabilityId: registered.value.manifest.capabilityId,
      version: registered.value.manifest.version,
      registrationDigest: 'e'.repeat(64),
    };
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob(referenceSubmission({ capabilityBindings: [stale] }) as never),
    );
    const planned = fabric.planExecution({
      tenantId: TENANT,
      runId: run.runId,
      admittedCapabilities: [
        {
          capabilityId: registered.value.manifest.capabilityId,
          version: registered.value.manifest.version,
          registrationDigest: registered.value.manifestDigest,
        },
      ],
      actor: ACTOR,
      at: T2,
    });
    expect(planned.ok).toBe(false);
    if (!planned.ok) {
      expect(planned.error.code).toBe('unknown-capability-binding');
    }
  });

  it('retired registry records are excluded by the adapter seam (W007 lifecycle semantics)', () => {
    const registry = new CapabilityRegistry();
    const manifest = capabilityManifest({ capabilityId: 'engineering.legacy-solver' });
    const digest = computeCapabilityManifestDigest(manifest as never);
    const registered = registry.register({ manifest: manifest as never, digest });
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    const retired = registry.retire({
      capabilityId: 'engineering.legacy-solver',
      version: '1.2.3',
    });
    expect(retired.ok).toBe(true);
    // The service-layer adapter lists non-retired records only; a binding
    // to the retired record therefore does not resolve.
    const binding = {
      capabilityId: 'engineering.legacy-solver',
      version: '1.2.3',
      registrationDigest: digest,
    };
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob(referenceSubmission({ capabilityBindings: [binding] }) as never),
    );
    const planned = fabric.planExecution({
      tenantId: TENANT,
      runId: run.runId,
      admittedCapabilities: [], // the adapter excluded the retired record
      actor: ACTOR,
      at: T2,
    });
    expect(planned.ok).toBe(false);
    if (!planned.ok) {
      expect(planned.error.code).toBe('unknown-capability-binding');
    }
  });
});

describe('W006 evidence/verification digest parity (runtime)', () => {
  it('fabric run/state/result digests are admitted by the W006 exact-revision grammar', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    unwrap(
      fabric.executeRun({
        tenantId: TENANT,
        runId: run.runId,
        port: new ReferenceSimulationExecutionPort(),
        actor: ACTOR,
        at: T3,
      }),
    );
    const completed = unwrap(fabric.getRun({ tenantId: TENANT, runId: run.runId }));
    for (const [artifactId, revision, digest] of [
      ['simrun', run.runId, run.runDigest],
      ['simstate', run.runId, run.stateDigest],
      ['simresult', completed.result!.result.resultId, completed.result!.resultDigest],
    ] as const) {
      expect(ExactRevisionRefSchema.safeParse({ artifactId, revision, digest }).success).toBe(
        true,
      );
    }
  });

  it('a fabric result digest satisfies the W006 verification produced-evidence element grammar', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    unwrap(fabric.planExecution({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
    const executed = unwrap(
      fabric.executeRun({
        tenantId: TENANT,
        runId: run.runId,
        port: new ReferenceSimulationExecutionPort(),
        actor: ACTOR,
        at: T3,
      }),
    );
    // The W006 verification Run's producedEvidence elements are plain
    // SHA-256 hex digests — the same grammar as fabric result digests.
    const runLike = {
      schemaVersion: 1,
      runId: 'run:verification-0001',
      methodId: 'method:0001',
      stage: 'verification',
      executedBy: ACTOR,
      executedByKind: 'software',
      startedAt: T2,
      endedAt: T3,
      status: 'completed',
      producedEvidence: [executed.result!.resultDigest],
    };
    expect(RunSchema.safeParse(runLike).success, JSON.stringify(RunSchema.safeParse(runLike).error?.issues)).toBe(true);
  });
});

describe('authorization parity (runtime composition)', () => {
  it('the fabric and @epoch/authorization deny cross-tenant run access with the same vocabulary', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(fabric.submitJob(referenceSubmission() as never));
    const denied = fabric.getRun({ tenantId: OTHER_TENANT, runId: run.runId });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe('tenant-isolation-rejected');
      if (denied.error.code === 'tenant-isolation-rejected') {
        expect(denied.error.expectedTenantId).toBe(OTHER_TENANT);
        expect(denied.error.encounteredTenantId).toBe(TENANT);
      }
    }
    // The same access pattern, decided by the REAL authorization kernel.
    const context: AuthorizationContext = {
      schemaVersion: 1,
      principals: [
        { principalId: ACTOR, status: 'active', authenticated: true },
      ],
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
