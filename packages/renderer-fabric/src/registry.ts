/**
 * Capability-registry integration (W056) — how renderer adapters REGISTER
 * and how the fabric RESOLVES them.
 *
 * A renderer adapter is a CAPABILITY of the Epoch Capability Fabric
 * (spec/capability-foundation-policy.md): its registration is a sealed
 * `CapabilityManifest` in the `visualization` category honoring the
 * `epoch.renderers` contract at the frozen version, registered through
 * the REAL @epoch/capability-registry (digest-verified, lifecycle-
 * governed). The manifest is the durable, provider-neutral DECLARATION;
 * the adapter OBJECT (the seam implementation) is bound to the manifest's
 * capability id in the fabric's local table — the registry never holds
 * code, and the fabric never invents a second registry.
 *
 * Resolution honors the registry's lifecycle semantics exactly: retired
 * renderers never resolve for new sessions; deprecated ones resolve
 * (advisory); version constraints resolve the highest satisfying
 * version — never a guess.
 */
import {
  CapabilityRegistry,
  compareSemver,
  type CapabilityCategory,
  type CapabilityManifest,
  type CapabilityRecord,
  type RegistryError,
  type VersionConstraint,
} from '@epoch/capability-registry';
import type { RendererCapabilitySet, RendererDescriptor, RendererFailure } from '@epoch/renderer-runtime';
import {
  DEFAULT_RENDERER_CONSTRAINT,
  RENDERER_CAPABILITY_CATEGORY,
  RENDERER_CAPABILITY_CONTRACT_ID,
} from './version';
import type { RendererAdapter } from './adapter';

/** The registration input: the sealed manifest envelope plus the adapter object. */
export interface RegisterRendererInput {
  readonly manifest: CapabilityManifest;
  readonly digest: string;
  readonly adapter: RendererAdapter;
}

/** Wrap a typed registry error as a typed fabric failure (never a bare throw). */
export function registryFailure(error: RegistryError): RendererFailure {
  switch (error.code) {
    case 'unknown-capability':
      return {
        code: 'adapter-unavailable',
        message: error.message,
        rendererId: error.path.map(String).join('.') || 'unknown',
        reason: 'no renderer capability is registered with that identity',
      };
    case 'version-unsatisfied':
      return {
        code: 'adapter-unavailable',
        message: error.message,
        rendererId: 'unknown',
        reason: `no registered renderer version satisfies the constraint (available: ${error.availableVersions.join(', ')})`,
      };
    case 'lifecycle-conflict':
      return {
        code: 'adapter-unavailable',
        message: error.message,
        rendererId: 'unknown',
        reason: 'the renderer capability is retired — retired renderers never resolve for new sessions',
      };
    case 'duplicate-capability':
      return {
        code: 'adapter-unavailable',
        message: error.message,
        rendererId: 'unknown',
        reason: 'the renderer capability is already registered at that version — ship changed content as a new version',
      };
    case 'digest-mismatch':
      return {
        code: 'invalid-fabric-record',
        message: `renderer capability manifest digest mismatch: ${error.message}`,
        issues: [
          {
            path: 'digest',
            message: `expected ${error.expected}, encountered ${error.encountered}`,
          },
        ],
      };
    default:
      return {
        code: 'invalid-fabric-record',
        message: `renderer capability manifest failed validation: ${error.message}`,
        issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      };
  }
}

/** The manifest-category consistency failure for a non-visualization manifest. */
export function wrongCategoryFailure(category: CapabilityCategory): RendererFailure {
  return {
    code: 'invalid-fabric-record',
    message: `renderer adapters register under the "${RENDERER_CAPABILITY_CATEGORY}" capability category (encountered "${category}")`,
    issues: [
      { path: 'manifest.category', message: `expected "${RENDERER_CAPABILITY_CATEGORY}"` },
    ],
  };
}

/** The manifest-contract consistency failure for a manifest not honoring the frozen contract. */
export function wrongContractFailure(contracts: readonly { contractId: string; contractVersion: string }[]): RendererFailure {
  return {
    code: 'invalid-fabric-record',
    message: `renderer capability manifests must honor the "${RENDERER_CAPABILITY_CONTRACT_ID}" contract at the frozen version (declared: ${contracts.map((c) => `${c.contractId}@${c.contractVersion}`).join(', ') || 'none'})`,
    issues: [
      {
        path: 'manifest.contracts',
        message: `expected ${RENDERER_CAPABILITY_CONTRACT_ID} at the published contracts/renderers version`,
      },
    ],
  };
}

/** The identity-consistency failure when the adapter object disagrees with its manifest. */
export function identityMismatchFailure(expected: string, encountered: string): RendererFailure {
  return {
    code: 'invalid-fabric-record',
    message: `the adapter's capability identity ("${encountered}") must equal its manifest's capabilityId ("${expected}")`,
    issues: [{ path: 'adapter.identity.capabilityId', message: `expected "${expected}"` }],
  };
}

/**
 * The fabric's renderer registry adapter: one capability registry (the
 * REAL @epoch/capability-registry instance, injected or created fresh)
 * plus the local adapter-object table keyed by capability id, and a
 * rendererId -> capabilityId index for renderer-selector lookups.
 */
export class RendererAdapterRegistry {
  private readonly registry: CapabilityRegistry;
  private readonly adaptersByCapabilityId = new Map<string, RendererAdapter>();
  private readonly capabilityIdByRendererId = new Map<string, string>();

  constructor(registry: CapabilityRegistry = new CapabilityRegistry()) {
    this.registry = registry;
  }

  /** The underlying capability registry (lifecycle administration). */
  get capabilityRegistry(): CapabilityRegistry {
    return this.registry;
  }

  /**
   * Register one renderer adapter: a sealed visualization-category
   * manifest honoring the frozen renderer contract, plus the adapter
   * object. The manifest is digest-verified by the REAL registry;
   * category, contract, and identity consistency are enforced here.
   */
  register(input: RegisterRendererInput): { ok: true; value: CapabilityRecord } | { ok: false; error: RendererFailure } {
    if (input.manifest.category !== RENDERER_CAPABILITY_CATEGORY) {
      return { ok: false, error: wrongCategoryFailure(input.manifest.category) };
    }
    const honorsContract = input.manifest.contracts.some(
      (reference) => reference.contractId === RENDERER_CAPABILITY_CONTRACT_ID,
    );
    if (!honorsContract) {
      return { ok: false, error: wrongContractFailure(input.manifest.contracts) };
    }
    const identity = input.adapter.identity();
    if (identity.capabilityId !== input.manifest.capabilityId) {
      return {
        ok: false,
        error: identityMismatchFailure(input.manifest.capabilityId, identity.capabilityId),
      };
    }
    const descriptor = input.adapter.descriptor();
    if (descriptor.rendererId !== identity.rendererId) {
      return {
        ok: false,
        error: {
          code: 'invalid-fabric-record',
          message: `the adapter's descriptor identity ("${descriptor.rendererId}") must equal its identity's rendererId ("${identity.rendererId}")`,
          issues: [{ path: 'adapter.descriptor.rendererId', message: `expected "${identity.rendererId}"` }],
        },
      };
    }
    if (input.adapter.capabilities().rendererId !== identity.rendererId) {
      return {
        ok: false,
        error: {
          code: 'invalid-fabric-record',
          message: `the adapter's capability set must declare its identity's rendererId ("${identity.rendererId}")`,
          issues: [{ path: 'adapter.capabilities.rendererId', message: `expected "${identity.rendererId}"` }],
        },
      };
    }
    const registered = this.registry.register({
      manifest: input.manifest,
      digest: input.digest,
    });
    if (!registered.ok) {
      return { ok: false, error: registryFailure(registered.error) };
    }
    this.adaptersByCapabilityId.set(identity.capabilityId, input.adapter);
    this.capabilityIdByRendererId.set(identity.rendererId, identity.capabilityId);
    return registered;
  }

  /** Resolve the adapter by W013 renderer id (lifecycle-aware, version-constrained). */
  resolveByRendererId(
    rendererId: string,
    constraint: VersionConstraint = DEFAULT_RENDERER_CONSTRAINT,
  ): { ok: true; value: { record: CapabilityRecord; adapter: RendererAdapter } } | { ok: false; error: RendererFailure } {
    const capabilityId = this.capabilityIdByRendererId.get(rendererId);
    if (capabilityId === undefined) {
      return {
        ok: false,
        error: {
          code: 'adapter-unavailable',
          message: `no renderer adapter is registered for renderer id "${rendererId}"`,
          rendererId,
          reason: 'unknown renderer id',
        },
      };
    }
    return this.resolveByCapabilityId(capabilityId, constraint);
  }

  /** Resolve the adapter by capability id (lifecycle-aware, version-constrained). */
  resolveByCapabilityId(
    capabilityId: string,
    constraint: VersionConstraint = DEFAULT_RENDERER_CONSTRAINT,
  ): { ok: true; value: { record: CapabilityRecord; adapter: RendererAdapter } } | { ok: false; error: RendererFailure } {
    const resolved = this.registry.resolve({ capabilityId, constraint });
    if (!resolved.ok) {
      return { ok: false, error: registryFailure(resolved.error) };
    }
    const adapter = this.adaptersByCapabilityId.get(capabilityId);
    if (adapter === undefined) {
      return {
        ok: false,
        error: {
          code: 'adapter-unavailable',
          message: `renderer capability "${capabilityId}" is registered but no adapter object is bound to it`,
          rendererId: capabilityId,
          reason: 'manifest without adapter binding',
        },
      };
    }
    return { ok: true, value: { record: resolved.value, adapter } };
  }

  /** The highest registered version of one capability (for exact listing lookups). */
  private highestRegisteredVersionOf(capabilityId: string): string {
    const listed = this.registry.list({ category: RENDERER_CAPABILITY_CATEGORY });
    const versions = listed
      .filter((record) => record.manifest.capabilityId === capabilityId)
      .map((record) => record.manifest.version)
      .sort((a, b) => compareSemver(a, b));
    return versions[versions.length - 1] ?? '1.0.0';
  }

  /** The renderers available to the Epoch renderer selector (sorted by renderer id). */
  listRenderers(): readonly {
    readonly record: CapabilityRecord;
    readonly descriptor: RendererDescriptor;
    readonly capabilities: RendererCapabilitySet;
  }[] {
    const listed: {
      record: CapabilityRecord;
      descriptor: RendererDescriptor;
      capabilities: RendererCapabilitySet;
    }[] = [];
    for (const [capabilityId, adapter] of [...this.adaptersByCapabilityId.entries()].sort(([a], [b]) =>
      a < b ? -1 : 1,
    )) {
      // The selector lists the lifecycle-aware best version of every
      // bound renderer capability (retired ones stop resolving).
      const resolved = this.registry.resolve({
        capabilityId,
        constraint: { kind: 'exact', version: this.highestRegisteredVersionOf(capabilityId) },
      });
      if (resolved.ok) {
        listed.push({
          record: resolved.value,
          descriptor: adapter.descriptor(),
          capabilities: adapter.capabilities(),
        });
      }
    }
    return listed.sort((a, b) =>
      a.descriptor.rendererId < b.descriptor.rendererId ? -1 : 1,
    );
  }
}

/**
 * Build a renderer capability manifest from a descriptor + capability set
 * (the W058/W059 registration helper): a visualization-category manifest
 * honoring the frozen renderer contract, with neutral parameter specs.
 */
export function rendererCapabilityManifestOf(input: {
  readonly capabilityId: string;
  readonly version: string;
  readonly descriptor: RendererDescriptor;
  readonly capabilities: RendererCapabilitySet;
  readonly displayName: string;
  readonly description?: string;
  readonly trust?: { readonly origin: 'first-party' | 'community' | 'external-software' | 'provisional-document-derived'; readonly curator?: string; readonly attestationDigest?: string };
}): CapabilityManifest {
  return {
    schemaVersion: 1,
    capabilityId: input.capabilityId,
    category: RENDERER_CAPABILITY_CATEGORY,
    version: input.version,
    descriptor: {
      displayName: input.displayName,
      description: input.description ?? `Renderer adapter for the Epoch Renderer Fabric (${input.descriptor.rendererId}).`,
      inputs: [
        {
          name: 'world-scene-projection',
          kind: 'json',
          required: true,
          description: 'The canonical world-experience scene projection to present (typed W016 record).',
        },
        {
          name: 'device-session-snapshot',
          kind: 'json',
          required: true,
          description: 'The W013 device-session snapshot the renderer binds to (typed capabilities/limits).',
        },
        {
          name: 'renderer-input-envelope',
          kind: 'json',
          required: false,
          description: 'Raw renderer input envelopes to normalize into typed Epoch world-interaction intents.',
        },
      ],
      outputs: [
        {
          name: 'frame-reports',
          kind: 'json',
          required: true,
          description: 'Typed per-frame presentation reports (admitted frame envelopes, typed fidelity).',
        },
        {
          name: 'intent-receipts',
          kind: 'json',
          required: true,
          description: 'Content-addressed receipts of normalized inputs (hit-test results + typed intents).',
        },
        {
          name: 'session-snapshots',
          kind: 'json',
          required: false,
          description: 'Portable view-state snapshots for renderer switching (when snapshot capture is declared).',
        },
      ],
      assumptions: [
        'The renderer presents the canonical Epoch world projection; it never becomes semantic authority.',
        'Sessions are ephemeral and non-authoritative; provider-native state is disposable.',
        'Inputs normalize to the existing typed Epoch world-interaction intent vocabulary.',
      ],
    },
    contracts: [
      {
        contractId: RENDERER_CAPABILITY_CONTRACT_ID,
        contractVersion: '1.1.0',
      },
    ],
    trust: {
      origin: input.trust?.origin ?? 'first-party',
      curator: input.trust?.curator,
      attestationDigest: input.trust?.attestationDigest,
    },
  };
}
