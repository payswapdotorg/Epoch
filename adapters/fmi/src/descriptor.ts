/**
 * @epoch/adapter-fmi — the W007 adapter descriptor and the
 * capability-registration derivation (the registration conventions,
 * without a registry runtime edge).
 *
 * The adapter DERIVES a sealed capability-registration document (the W007
 * `CapabilityRegistration` shape: manifest + the digest claimed for its
 * canonical JSON). The REAL registry (@epoch/capability-registry, a
 * devDependency) admits it verbatim — pinned by the registration parity
 * tests: the derived digest equals the registry's own
 * `computeCapabilityManifestDigest`, `register` accepts the envelope,
 * and `negotiateBinding` binds the descriptor to the record.
 */
import type { AdapterDescriptor } from '@epoch/adapter-sdk';
import { computeAdapterDescriptorDigest } from '@epoch/adapter-sdk';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { FMI_ADAPTER_RECORD_VERSION, FMI_SIMULATION_CONTRACT_ID } from './version';

/** The W007 capability id this adapter's surface binds. */
export const SIMULATION_CAPABILITY_ID = 'participant.co-simulation-stepping' as const;

/** The capability version this reference set pins (exact). */
export const CAPABILITY_VERSION = '1.0.0' as const;

/** The simulation-category adapter descriptor (the participant stepping surface). */
export const SIMULATION_ADAPTER_DESCRIPTOR: AdapterDescriptor = {
  schemaVersion: 1,
  adapterId: 'adapter:participant-simulation',
  category: 'simulation',
  displayName: 'Co-Simulation Participant Adapter (reference)',
  description:
    'Reference simulation adapter: typed participants with declared ports execute deterministic, content-addressed step exchanges; participants derive REAL W005 simulator registrations and execute behind the simulation-fabric execution-port seam.',
  binding: {
    capabilityId: SIMULATION_CAPABILITY_ID,
    versionRange: { kind: 'exact', version: CAPABILITY_VERSION },
  },
};

/** The exact descriptor digest (content address; computed through the REAL SDK discipline). */
export const SIMULATION_ADAPTER_DESCRIPTOR_DIGEST = computeAdapterDescriptorDigest(SIMULATION_ADAPTER_DESCRIPTOR);

/** A derived manifest's content (the W007 `CapabilityManifest` shape, structural). */
export interface DerivedCapabilityManifest {
  readonly schemaVersion: typeof FMI_ADAPTER_RECORD_VERSION;
  readonly capabilityId: string;
  readonly category: 'simulation';
  readonly version: string;
  readonly descriptor: {
    readonly displayName: string;
    readonly description: string;
    readonly inputs: readonly {
      readonly name: string;
      readonly kind: 'string' | 'json';
      readonly required: boolean;
      readonly description: string;
    }[];
    readonly outputs: readonly {
      readonly name: string;
      readonly kind: 'string' | 'json';
      readonly required: boolean;
      readonly description: string;
    }[];
    readonly assumptions: readonly string[];
  };
  readonly contracts: readonly { readonly contractId: string; readonly contractVersion: string }[];
  readonly trust: {
    readonly origin: 'external-software';
    readonly curator: string;
  };
}

/** A sealed registration envelope: the manifest plus its claimed digest. */
export interface DerivedCapabilityRegistration {
  readonly manifest: DerivedCapabilityManifest;
  readonly digest: string;
}

const CURATOR = 'epoch:reference-adapter-set' as const;

const manifest: DerivedCapabilityManifest = {
  schemaVersion: FMI_ADAPTER_RECORD_VERSION,
  capabilityId: SIMULATION_CAPABILITY_ID,
  category: 'simulation',
  version: CAPABILITY_VERSION,
  descriptor: {
    displayName: 'Co-simulation participant stepping',
    description:
      'Steps typed co-simulation participants deterministically: declared ports, content-addressed step exchanges, identical inputs -> identical step digests. Participants also derive REAL W005 simulator registrations for the simulation-fabric seam.',
    inputs: [
      {
        name: 'tenant',
        kind: 'string',
        required: true,
        description: 'The tenant scope of the step request (the W009 tenant grammar).',
      },
      {
        name: 'participant',
        kind: 'string',
        required: true,
        description: 'The neutral participant identity being stepped (participant:<slug>).',
      },
      {
        name: 'values',
        kind: 'json',
        required: true,
        description: 'The input-port values for the step (port-conformance-checked).',
      },
    ],
    outputs: [
      {
        name: 'outputs',
        kind: 'json',
        required: true,
        description: 'The computed output-port values of the step (deterministic over the prior state).',
      },
      {
        name: 'step-digest',
        kind: 'string',
        required: true,
        description: 'The step exchange content digest (its exact-revision address).',
      },
    ],
    assumptions: [
      'Steps are deterministic: identical (participant, step number, inputs, prior state) produce identical digests.',
      'Step replay is idempotent: identical content under the same step key returns the sealed prior step.',
    ],
  },
  contracts: [{ contractId: FMI_SIMULATION_CONTRACT_ID, contractVersion: '1.0.0' }],
  trust: { origin: 'external-software', curator: CURATOR },
};

/** The derived registration envelope (deterministic). */
export function deriveCapabilityRegistrations(): readonly DerivedCapabilityRegistration[] {
  return [{ manifest, digest: canonicalDigest(manifest as unknown as JsonValue) }];
}
