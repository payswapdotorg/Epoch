// Shared fixtures for the simulation-runner service tests. Builders
// return loose JSON objects so negative tests can corrupt single fields
// precisely. ZERO clock reads. W005 documents, W007 registrations and
// bindings are built through the REAL upstream shapes — never hand-rolled
// digests (the W020 helpers pattern).
import {
  CapabilityRegistry,
  computeCapabilityManifestDigest,
} from '@epoch/capability-registry';
import type { CapabilityRegistration } from '@epoch/capability-registry';
import {
  REFERENCE_SIMULATOR_REGISTRATION,
  referenceRegistrationDigest,
} from '@epoch/simulation-protocol';
import type { PortExecution, AdmittedInvocation } from '@epoch/simulation-fabric';
import type { SimulationExecutionPort } from '@epoch/simulation-fabric';

export const T0 = '2026-03-01T09:00:00.000Z';
export const T1 = '2026-03-01T09:00:01.000Z';
export const T2 = '2026-03-01T09:00:02.000Z';
export const T3 = '2026-03-01T09:00:03.000Z';
export const T4 = '2026-03-01T09:00:04.000Z';
export const T5 = '2026-03-01T09:00:05.000Z';

export const TENANT = 'tenant:acme';
export const OTHER_TENANT = 'tenant:bridge';
export const ACTOR = 'principal:simulation-lead';

/** A provider-neutral W007 capability manifest as loose JSON. */
export function capabilityManifest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    capabilityId: 'engineering.stress-analysis',
    category: 'simulation',
    version: '1.2.3',
    descriptor: {
      displayName: 'Stress Analysis',
      description: 'Linear static stress analysis over the reconstructed model.',
      inputs: [
        {
          name: 'load-kn',
          kind: 'number',
          required: true,
          description: 'Rated load in kilonewtons.',
          unit: 'kN',
        },
      ],
      outputs: [
        {
          name: 'max-stress-mpa',
          kind: 'number',
          required: true,
          description: 'Peak von Mises stress.',
          unit: 'MPa',
        },
      ],
      assumptions: ['Linear-elastic material behavior within rated load.'],
    },
    contracts: [{ contractId: 'epoch.simulation-protocol', contractVersion: '1.0.0' }],
    trust: { origin: 'first-party', curator: 'actor:epoch-core' },
    ...overrides,
  };
}

/** Seal a manifest with its recomputed digest; throws on invalid fixtures. */
export function sealedCapability(
  manifestInput: Record<string, unknown>,
): CapabilityRegistration {
  return {
    manifest: manifestInput as unknown as CapabilityRegistration['manifest'],
    digest: computeCapabilityManifestDigest(
      manifestInput as unknown as CapabilityRegistration['manifest'],
    ),
  };
}

/** The fixture registry: stress-analysis (registered), legacy-solver (retired). */
export function fixtureRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  const registered = registry.register(
    sealedCapability(capabilityManifest({ capabilityId: 'engineering.stress-analysis' })),
  );
  if (!registered.ok) throw new Error('fixture capability must register');
  const legacy = registry.register(
    sealedCapability(
      capabilityManifest({
        capabilityId: 'engineering.legacy-solver',
        category: 'verification',
        version: '1.0.0',
      }),
    ),
  );
  if (!legacy.ok) throw new Error('fixture capability must register');
  const retired = registry.retire({ capabilityId: 'engineering.legacy-solver', version: '1.0.0' });
  if (!retired.ok) throw new Error('fixture capability must retire');
  return registry;
}

/** The W007-exact binding reference for the stress-analysis fixture. */
export function stressBinding(): Record<string, unknown> {
  const registry = fixtureRegistry();
  const record = registry.get({
    capabilityId: 'engineering.stress-analysis',
    version: '1.2.3',
  });
  if (!record.ok) throw new Error('fixture capability must resolve');
  return {
    capabilityId: 'engineering.stress-analysis',
    version: '1.2.3',
    registrationDigest: record.value.manifestDigest,
  };
}

/** The W007-exact binding reference for the retired legacy-solver fixture. */
export function retiredBinding(): Record<string, unknown> {
  const registry = fixtureRegistry();
  const record = registry.get({
    capabilityId: 'engineering.legacy-solver',
    version: '1.0.0',
  });
  if (!record.ok) throw new Error('fixture capability must resolve');
  return {
    capabilityId: 'engineering.legacy-solver',
    version: '1.0.0',
    registrationDigest: record.value.manifestDigest,
  };
}

/** The W005 reference simulator registration as a loose JSON object. */
export function referenceRegistrationFixture(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(REFERENCE_SIMULATOR_REGISTRATION)) as Record<string, unknown>;
}

/** An invocation request against the reference simulator, as loose JSON. */
export function referenceRequestFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'simulation.invocation-request',
    messageId: 'msg-reference-request-0001',
    createdAt: T1,
    requestId: 'simreq-reference-0001',
    simulator: {
      simulatorId: 'simulator:reference-affine-scalar',
      registrationDigest: referenceRegistrationDigest(),
    },
    inputs: { x: 2, slope: 3, intercept: 1 },
    ...overrides,
  };
}

/** The standard submission options against the reference simulator. */
export function referenceSubmission(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tenantId: TENANT,
    registration: referenceRegistrationFixture(),
    request: referenceRequestFixture(),
    capabilityBindings: [stressBinding()],
    actor: ACTOR,
    at: T1,
    ...overrides,
  };
}

/** A recording stub port (the adapter seam exercised by tests). */
export function stubPort(
  behavior: (invocation: AdmittedInvocation, call: number) => PortExecution,
): { port: SimulationExecutionPort; calls: AdmittedInvocation[] } {
  const calls: AdmittedInvocation[] = [];
  const port: SimulationExecutionPort = {
    execute(invocation: AdmittedInvocation): PortExecution {
      const call = calls.length + 1;
      calls.push(invocation);
      return behavior(invocation, call);
    },
  };
  return { port, calls };
}

/** Assert-helper: unwrap or fail loudly with the typed error. */
export function unwrap<T>(outcome: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!outcome.ok) {
    throw new Error(`fixture operation must succeed: ${JSON.stringify(outcome.error)}`);
  }
  return outcome.value;
}
