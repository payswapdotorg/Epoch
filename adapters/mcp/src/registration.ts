/**
 * @epoch/adapter-mcp — W007 capability-registration derivation for the
 * adapter's own two surfaces (action + evaluator categories).
 *
 * The adapter DERIVES sealed capability-registration documents (the W007
 * `CapabilityRegistration` shape: manifest + the digest claimed for its
 * canonical JSON). The REAL registry (@epoch/capability-registry, a
 * devDependency) admits them verbatim — pinned by the registration
 * parity tests. (Per-TOOL registrations are derived separately by
 * `deriveToolRegistration` in src/discovery.ts — tool discovery feeds
 * the registry; the adapter's own surfaces register under their own
 * categories.)
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { ACTION_CAPABILITY_ID, CAPABILITY_VERSION, EVALUATOR_CAPABILITY_ID } from './descriptor';
import { MCP_ADAPTER_RECORD_VERSION, MCP_ACTION_CONTRACT_ID, MCP_EVALUATOR_CONTRACT_ID } from './version';

/** A derived manifest's content (the W007 `CapabilityManifest` shape, structural). */
export interface DerivedCapabilityManifest {
  readonly schemaVersion: typeof MCP_ADAPTER_RECORD_VERSION;
  readonly capabilityId: string;
  readonly category: 'action' | 'evaluator';
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

const actionManifest: DerivedCapabilityManifest = {
  schemaVersion: MCP_ADAPTER_RECORD_VERSION,
  capabilityId: ACTION_CAPABILITY_ID,
  category: 'action',
  version: CAPABILITY_VERSION,
  descriptor: {
    displayName: 'External tool invocation routing',
    description:
      'Builds deterministic W003 tool-invocation proposals and routes them through the W022 action-authority seam: policy decision first (allow / deny / requires-approval), then the authority typed outcome records.',
    inputs: [
      {
        name: 'tenant',
        kind: 'string',
        required: true,
        description: 'The tenant scope of the invocation request (the W009 tenant grammar).',
      },
      {
        name: 'tool',
        kind: 'string',
        required: true,
        description: 'The neutral tool reference being invoked (tool:<slug>).',
      },
      {
        name: 'arguments',
        kind: 'json',
        required: true,
        description: 'The neutral tool arguments record (credential-shaped keys are rejected).',
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
        description: 'The neutral invocation disposition (executed, authority-denied, authority-pending-approval, execution-failed).',
      },
    ],
    assumptions: [
      'The adapter holds no credentials (credential-rejected) and never bypasses the authority seam (gateway-bypass-rejected).',
      'Human approval is required for every external-tool invocation (the reference pin).',
    ],
  },
  contracts: [{ contractId: MCP_ACTION_CONTRACT_ID, contractVersion: CONTRACT_VERSION }],
  trust: { origin: 'external-software', curator: CURATOR },
};

const evaluatorManifest: DerivedCapabilityManifest = {
  schemaVersion: MCP_ADAPTER_RECORD_VERSION,
  capabilityId: EVALUATOR_CAPABILITY_ID,
  category: 'evaluator',
  version: CAPABILITY_VERSION,
  descriptor: {
    displayName: 'External tool outcome evaluation',
    description:
      'Judges recorded tool-invocation outcomes against declared criteria with mandatory justification (evaluation is judgment, distinct from execution).',
    inputs: [
      {
        name: 'subject',
        kind: 'json',
        required: true,
        description: 'The judged subject: the recorded invocation (kind, subject id, exact-revision digest).',
      },
      {
        name: 'criteria',
        kind: 'json',
        required: true,
        description: 'The declared judgment criteria (expected disposition, evidence requirements).',
      },
    ],
    outputs: [
      {
        name: 'verdict',
        kind: 'json',
        required: true,
        description: 'The structured verdict (pass-fail or scored) with its mandatory justification references.',
      },
    ],
    assumptions: [
      'The subject must be an exact-revision recorded invocation (digest-verified before judgment).',
      'The evaluator never routes, executes, or forms authority — judgment only.',
    ],
  },
  contracts: [{ contractId: MCP_EVALUATOR_CONTRACT_ID, contractVersion: CONTRACT_VERSION }],
  trust: { origin: 'external-software', curator: CURATOR },
};

/** Both derived registration envelopes, deterministically ordered (action, then evaluator). */
export function deriveCapabilityRegistrations(): readonly DerivedCapabilityRegistration[] {
  return [actionManifest, evaluatorManifest].map((manifest) => ({
    manifest,
    digest: canonicalDigest(manifest as unknown as JsonValue),
  }));
}
