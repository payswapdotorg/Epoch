/**
 * @epoch/adapter-github — W007 capability-registration derivation (the
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
 * set. Provider-neutral by construction: no field names a vendor.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  ACTION_CAPABILITY_ID,
  CAPABILITY_VERSION,
  SOURCE_CAPABILITY_ID,
} from './descriptor';
import {
  GITHUB_ADAPTER_RECORD_VERSION,
  GITHUB_SOURCE_CONTRACT_ID,
  GITHUB_ACTION_CONTRACT_ID,
} from './version';

/** A derived manifest's content (the W007 `CapabilityManifest` shape, structural). */
export interface DerivedCapabilityManifest {
  readonly schemaVersion: typeof GITHUB_ADAPTER_RECORD_VERSION;
  readonly capabilityId: string;
  readonly category: 'source' | 'action';
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
  schemaVersion: GITHUB_ADAPTER_RECORD_VERSION,
  capabilityId: SOURCE_CAPABILITY_ID,
  category: 'source',
  version: CAPABILITY_VERSION,
  descriptor: {
    displayName: 'Hosted software-workspace snapshot observation',
    description:
      'Observes content-addressed hosted software-workspace snapshots and projects them into W002-convention observation records (statement, provenance, confidence, validity).',
    inputs: [
      {
        name: 'tenant',
        kind: 'string',
        required: true,
        description: 'The tenant scope of the observation request (the W009 tenant grammar).',
      },
      {
        name: 'workspace',
        kind: 'string',
        required: true,
        description: 'The neutral workspace identity whose sealed snapshot is projected (sw:<slug>).',
      },
    ],
    outputs: [
      {
        name: 'projection',
        kind: 'json',
        required: true,
        description: 'The full workspace projection: source reference, sorted observation records, projection digest.',
      },
      {
        name: 'projection-digest',
        kind: 'string',
        required: true,
        description: 'The projection content digest (its exact-revision address).',
      },
    ],
    assumptions: [
      'The provider snapshot was ingested through the adapter provider seam (content-addressed, tamper-checked).',
      'Observations are imported facts of the exact snapshot revision; they are never semantic authority.',
    ],
  },
  contracts: [{ contractId: GITHUB_SOURCE_CONTRACT_ID, contractVersion: CONTRACT_VERSION }],
  trust: { origin: 'external-software', curator: CURATOR },
};

const actionManifest: DerivedCapabilityManifest = {
  schemaVersion: GITHUB_ADAPTER_RECORD_VERSION,
  capabilityId: ACTION_CAPABILITY_ID,
  category: 'action',
  version: CAPABILITY_VERSION,
  descriptor: {
    displayName: 'Hosted software-workspace change routing',
    description:
      'Builds deterministic W003 change proposals and routes them through the W022 action-authority seam: policy decision first (allow / deny / requires-approval), then the authority typed outcome records.',
    inputs: [
      {
        name: 'tenant',
        kind: 'string',
        required: true,
        description: 'The tenant scope of the change request (the W009 tenant grammar).',
      },
      {
        name: 'workspace',
        kind: 'string',
        required: true,
        description: 'The neutral workspace identity the change targets (sw:<slug>).',
      },
      {
        name: 'change-kind',
        kind: 'string',
        required: true,
        description: 'The neutral change kind: a single revision or an integration of revisions.',
      },
      {
        name: 'summary',
        kind: 'string',
        required: true,
        description: 'The human-readable summary of the proposed change.',
      },
    ],
    outputs: [
      {
        name: 'decision',
        kind: 'json',
        required: true,
        description: "The authority's typed decision record (allow / deny / requires-approval, sealed by the authority).",
      },
      {
        name: 'disposition',
        kind: 'string',
        required: true,
        description: 'The neutral dispatch disposition (executed, authority-denied, authority-pending-approval, execution-failed).',
      },
    ],
    assumptions: [
      'The adapter never executes and never bypasses the authority seam (gateway-bypass-rejected).',
      'Human approval is required for every hosted software-workspace write (the reference pin).',
    ],
  },
  contracts: [{ contractId: GITHUB_ACTION_CONTRACT_ID, contractVersion: CONTRACT_VERSION }],
  trust: { origin: 'external-software', curator: CURATOR },
};

/** Both derived registration envelopes, deterministically ordered (source, then action). */
export function deriveCapabilityRegistrations(): readonly DerivedCapabilityRegistration[] {
  return [sourceManifest, actionManifest].map((manifest) => ({
    manifest,
    digest: canonicalDigest(manifest as unknown as JsonValue),
  }));
}
