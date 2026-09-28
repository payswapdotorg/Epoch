/**
 * W007 capability-registration derivation (the registration
 * conventions, without a registry runtime edge — the W029 precedent).
 *
 * The adapter DERIVES sealed capability-registration documents (the
 * W007 `CapabilityRegistration` shape: manifest + the digest claimed
 * for its canonical JSON, computed through the shared protocol
 * primitives). The REAL registry (@epoch/capability-registry, a
 * devDependency) admits them verbatim — pinned by the registration
 * parity tests: the derived digest equals the registry's own
 * `computeCapabilityManifestDigest`, `register` accepts the envelope,
 * and `negotiateBinding` binds the descriptor to the record.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  EXTERNAL_EXCHANGE_CAPABILITY_ID,
  EXTERNAL_EXCHANGE_CAPABILITY_VERSION,
  AURUM_CHAT_PROVIDER_CONTRACT_ID,
  AURUM_CHAT_ADAPTER_CATEGORIES,
} from './version';

/** The derived capability manifest (provider-neutral, content-addressed). */
export interface DerivedExchangeCapabilityManifest {
  readonly schemaVersion: 1;
  readonly capabilityId: string;
  readonly category: (typeof AURUM_CHAT_ADAPTER_CATEGORIES)[number];
  readonly version: string;
  readonly descriptor: {
    readonly displayName: string;
    readonly description: string;
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly assumptions: readonly string[];
  };
  readonly contracts: readonly {
    readonly contractId: string;
    readonly contractVersion: string;
  }[];
  readonly trust: { readonly origin: 'first-party' };
}

/** The derived capability registration (manifest + digest envelope). */
export interface DerivedExchangeCapabilityRegistration {
  readonly manifest: DerivedExchangeCapabilityManifest;
  readonly digest: string;
}

/** Derive the exchange capability registration this adapter binds. */
export function deriveCapabilityRegistrations(): readonly DerivedExchangeCapabilityRegistration[] {
  const manifest: DerivedExchangeCapabilityManifest = {
    schemaVersion: 1,
    capabilityId: EXTERNAL_EXCHANGE_CAPABILITY_ID,
    category: 'source',
    version: EXTERNAL_EXCHANGE_CAPABILITY_VERSION,
    descriptor: {
      displayName: 'External Event Exchange',
      description:
        'Provider-neutral external event intake and outbound request delivery (the bridge provider contract).',
      inputs: [],
      outputs: [],
      assumptions: ['providers are adapters behind the bridge contract'],
    },
    contracts: [
      {
        contractId: AURUM_CHAT_PROVIDER_CONTRACT_ID,
        contractVersion: EXTERNAL_EXCHANGE_CAPABILITY_VERSION,
      },
    ],
    trust: { origin: 'first-party' },
  };
  return [
    {
      manifest,
      digest: canonicalDigest(manifest as unknown as JsonValue),
    },
  ];
}
