// Shared fixtures for the adapter-sdk tests. Builders return loose JSON
// objects so negative tests can corrupt single fields precisely.
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import type {
  AdapterDescriptor,
  BindableCapability,
  BindingPin,
  CapabilityAdapter,
  CapabilityCategory,
} from '../src/index';
import { computeAdapterDescriptorDigest } from '../src/index';

export const CAPABILITY_ID = 'engineering.stress-analysis';

export const MANIFEST_DIGEST = canonicalDigest({
  schemaVersion: 1,
  capabilityId: CAPABILITY_ID,
  category: 'simulation',
  version: '1.2.3',
  descriptor: { displayName: 'Stress Analysis', inputs: [], outputs: [], assumptions: [] },
  contracts: [],
  trust: { origin: 'first-party' },
} satisfies Record<string, JsonValue>);

/** A valid adapter descriptor as loose JSON (simulation category). */
export function descriptor(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    adapterId: 'adapter:stress-solver',
    category: 'simulation',
    displayName: 'Stress Solver Adapter',
    description: 'Runs the registered stress-analysis capability.',
    binding: { capabilityId: CAPABILITY_ID, versionRange: { kind: 'caret', version: '1.0.0' } },
    ...overrides,
  };
}

/** A typed descriptor fixture. */
export function typedDescriptor(): AdapterDescriptor {
  return descriptor() as unknown as AdapterDescriptor;
}

/** A minimal structural capability view (the registry record shape). */
export function capability(overrides: Record<string, unknown> = {}): BindableCapability {
  return {
    manifest: {
      capabilityId: CAPABILITY_ID,
      category: 'simulation',
      version: '1.2.3',
    },
    lifecycle: 'registered',
    manifestDigest: MANIFEST_DIGEST,
    ...overrides,
  } as BindableCapability;
}

/** The binding pin a successful negotiation produces for the fixtures. */
export function expectedPin(descriptorInput: AdapterDescriptor): BindingPin {
  return {
    capabilityId: CAPABILITY_ID,
    capabilityVersion: '1.2.3',
    manifestDigest: MANIFEST_DIGEST,
    adapterId: descriptorInput.adapterId,
    adapterDescriptorDigest: computeAdapterDescriptorDigest(descriptorInput),
  };
}

/**
 * A reference FAKE adapter (test-only — the SDK ships zero concrete
 * adapters): implements the simulation contract deterministically.
 */
export class ReferenceSimulationAdapter implements CapabilityAdapter<'simulation'> {
  readonly descriptor: AdapterDescriptor;

  constructor(descriptorInput: AdapterDescriptor) {
    this.descriptor = descriptorInput;
  }

  async invoke(
    request: import('../src/index').AdapterRequestEnvelope<'simulation'>,
  ): Promise<import('../src/index').AdapterResponseEnvelope<'simulation'>> {
    return {
      schemaVersion: 1,
      category: 'simulation',
      binding: request.binding,
      payload: {
        status: 'completed',
        outputs: { 'max-stress-mpa': 42.5 },
      },
    };
  }
}

/** Valid per-category request payloads (loose JSON). */
export const REQUEST_PAYLOADS: Record<CapabilityCategory, Record<string, unknown>> = {
  source: { inputs: { 'document-uri': 'opaque://fixture' } },
  semantic: { inputs: { 'entity-type': 'beam' } },
  reconstruction: { inputs: { 'model-ref': 'opaque://model' } },
  visualization: { inputs: { 'layer-count': 3 } },
  simulation: { inputs: { 'load-kn': 12.5 }, seed: 7 },
  evaluator: {
    subject: { kind: 'simulation-result', subjectId: 'result-fixture-1', subjectDigest: 'a'.repeat(64) },
    criteria: { 'max-deflection-mm': 5 },
  },
  action: { target: { kind: 'external-resource', ref: 'fixture://actuator-1' }, parameters: { 'torque-nm': 40 } },
  verification: {
    method: { methodId: 'method:deflection-check', claimId: 'claim:deflection-check', stage: 'verification' },
    inputs: { 'rated-load-kn': 12.5 },
  },
};

/** Valid per-category response payloads (loose JSON). */
export const RESPONSE_PAYLOADS: Record<CapabilityCategory, Record<string, unknown>> = {
  source: { outputs: { 'document-digest': 'b'.repeat(64) } },
  semantic: { outputs: { 'entity-count': 12 } },
  reconstruction: { outputs: { 'mesh-node-count': 8192 } },
  visualization: { outputs: { 'layer-count': 3 } },
  simulation: { status: 'completed', outputs: { 'max-stress-mpa': 42.5 } },
  evaluator: {
    verdict: { verdictForm: 'pass-fail', outcome: 'pass' },
    justification: [{ kind: 'criterion', reference: 'max-deflection-mm', statement: '4.2mm < 5mm limit.' }],
  },
  action: { status: 'executed' },
  verification: { runStatus: 'completed', producedEvidence: ['c'.repeat(64)] },
};
