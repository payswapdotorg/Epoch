/**
 * @epoch/adapter-ifc — W007 capability-registration derivation (the
 * registration conventions, without a registry runtime edge).
 *
 * The adapter DERIVES sealed capability-registration documents (the W007
 * `CapabilityRegistration` shape: manifest + the digest claimed for its
 * canonical JSON). The REAL registry (@epoch/capability-registry, a
 * devDependency) admits them verbatim — pinned by the registration
 * parity tests: the derived digest equals the registry's own
 * `computeCapabilityManifestDigest`, `register` accepts the envelope,
 * and `negotiateBinding` binds the descriptor to the record.
 *
 * Trust surface: origin `external-software` (architecture.md, Capability
 * Fabric: external software sources), curator pinned to the reference
 * set. Standard-neutral by construction: no field names a vendor or a
 * standard.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { CAPABILITY_VERSION, SEMANTIC_CAPABILITY_ID, SOURCE_CAPABILITY_ID } from './descriptor';
import { IFC_ADAPTER_RECORD_VERSION, IFC_SOURCE_CONTRACT_ID, IFC_SEMANTIC_CONTRACT_ID } from './version';

/** A derived manifest's content (the W007 `CapabilityManifest` shape, structural). */
export interface DerivedCapabilityManifest {
  readonly schemaVersion: typeof IFC_ADAPTER_RECORD_VERSION;
  readonly capabilityId: string;
  readonly category: 'source' | 'semantic';
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

const CONTRACT_VERSION = '1.0.0' as const;
const CURATOR = 'epoch:reference-adapter-set' as const;

const sourceManifest: DerivedCapabilityManifest = {
  schemaVersion: IFC_ADAPTER_RECORD_VERSION,
  capabilityId: SOURCE_CAPABILITY_ID,
  category: 'source',
  version: CAPABILITY_VERSION,
  descriptor: {
    displayName: 'Building model observation',
    description:
      'Observes content-addressed building-model fixtures as exact-revision observation records with provenance and confidence (the W006 conventions).',
    inputs: [
      {
        name: 'tenant',
        kind: 'string',
        required: true,
        description: 'The tenant scope of the observation request (the W009 tenant grammar).',
      },
      {
        name: 'model',
        kind: 'string',
        required: true,
        description: 'The neutral building-model identity whose sealed fixture is observed (bim:<slug>).',
      },
    ],
    outputs: [
      {
        name: 'observation',
        kind: 'json',
        required: true,
        description: 'The model observation record: exact-revision source reference, counts, provenance, confidence, content digest.',
      },
      {
        name: 'observation-digest',
        kind: 'string',
        required: true,
        description: 'The observation record content digest (its exact-revision address).',
      },
    ],
    assumptions: [
      'The building-model fixture was ingested through the adapter provider seam (content-addressed, tamper-checked, semantically admitted).',
      'Observations are imported facts of the exact fixture revision; they are never semantic authority.',
    ],
  },
  contracts: [{ contractId: IFC_SOURCE_CONTRACT_ID, contractVersion: CONTRACT_VERSION }],
  trust: { origin: 'external-software', curator: CURATOR },
};

const semanticManifest: DerivedCapabilityManifest = {
  schemaVersion: IFC_ADAPTER_RECORD_VERSION,
  capabilityId: SEMANTIC_CAPABILITY_ID,
  category: 'semantic',
  version: CAPABILITY_VERSION,
  descriptor: {
    displayName: 'Building model semantic projection',
    description:
      'Maps building-model fixtures INTO the W002 world-model graph as REAL assertion-input records (entities, properties, relationships). External-standard semantics are adapted, never authoritative.',
    inputs: [
      {
        name: 'tenant',
        kind: 'string',
        required: true,
        description: 'The tenant scope of the projection request (the W009 tenant grammar).',
      },
      {
        name: 'model',
        kind: 'string',
        required: true,
        description: 'The neutral building-model identity whose sealed fixture is projected (bim:<slug>).',
      },
    ],
    outputs: [
      {
        name: 'projection',
        kind: 'json',
        required: true,
        description: 'The semantic projection: REAL W002 assertion inputs (sorted, deterministic) plus the projection digest.',
      },
      {
        name: 'projection-digest',
        kind: 'string',
        required: true,
        description: 'The projection content digest (its exact-revision address).',
      },
    ],
    assumptions: [
      'The projection produces world-model INPUT records; the world-model authority admits them (external-semantics-not-authority is a typed rejection).',
      'Projection is deterministic: identical (tenant, model, instant) project identical digests.',
    ],
  },
  contracts: [{ contractId: IFC_SEMANTIC_CONTRACT_ID, contractVersion: CONTRACT_VERSION }],
  trust: { origin: 'external-software', curator: CURATOR },
};

/** Both derived registration envelopes, deterministically ordered (source, then semantic). */
export function deriveCapabilityRegistrations(): readonly DerivedCapabilityRegistration[] {
  return [sourceManifest, semanticManifest].map((manifest) => ({
    manifest,
    digest: canonicalDigest(manifest as unknown as JsonValue),
  }));
}
