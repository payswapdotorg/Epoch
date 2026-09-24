/**
 * The sandboxed HOST: capability-scoped extension admission and hosting
 * (W008). The admission pipeline (total, never throws):
 *
 * 1. envelope shape — the claimed digest must be 64-hex (`validation`
 *    at ["digest"]);
 * 2. manifest validation — the runtime's FULL MIRROR of the SDK
 *    manifest schema (strict objects reject unknown/vendor fields;
 *    sorted-set semantics; grants ⊆ bindings; trust ceilings; flavor
 *    match) — typed `validation` issues with precise dotted paths
 *    (defense in depth: the host boundary never trusts author-side
 *    tooling);
 * 3. digest verification — the claimed digest must equal the
 *    recomputed canonical SHA-256 of the manifest content, else
 *    `digest-mismatch` (tamper detection);
 * 4. duplicate admission — (extensionId) may already be hosted once,
 *    else a typed `validation` error;
 * 5. capability binding resolution — every binding resolves against the
 *    injected @epoch/capability-registry (genuine runtime composition):
 *    unknown ids → `unknown-capability`; unsatisfiable constraints →
 *    `version-unsatisfied` (constraint + available versions);
 *    retired-only → `lifecycle-conflict`. Resolution picks the HIGHEST
 *    satisfying non-retired version deterministically.
 *
 * The host applies extension lifecycle transitions
 * (registered -> deprecated -> retired, the registry's table) with
 * typed `lifecycle-conflict` errors; retired sessions stop serving.
 * In-memory only: no persistence, no events, no UI. Iteration is
 * sorted (no insertion-order leaks).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  CapabilityRegistry,
  CAPABILITY_LIFECYCLE_TRANSITIONS,
  Sha256DigestSchema,
} from '@epoch/capability-registry';
import type { CapabilityLifecycleState } from '@epoch/capability-registry';
import { ExtensionManifestViewSchema } from './schema';
import { validationError } from './issues';
import {
  unavailableCapabilityInvoker,
  fixedClock,
  emptyWorldView,
  ExtensionStorageNamespace,
  InMemoryEvidenceBook,
  SessionLogRing,
} from './state';
import { ExtensionSession } from './session';
import type {
  AdmittedExtensionRecord,
  CapabilityInvoker,
  ExtensionManifestView,
  ExtensionRuntimeError,
  ExtensionRuntimeResult,
  HostClock,
  ResolvedCapabilityBinding,
  WorldViewProvider,
} from './types';

/** Admission input: the manifest document plus the digest claimed for its content. */
export interface ExtensionAdmissionInput {
  readonly manifest: unknown;
  readonly digest: Sha256Hex;
}

const AdmissionEnvelopeSchema = z
  .strictObject({
    manifest: z.unknown(),
    digest: Sha256DigestSchema,
  })
  .readonly();

/** Host construction options: the registry is REQUIRED (binding resolution is real). */
export interface ExtensionSandboxHostOptions {
  readonly registry: CapabilityRegistry;
  readonly clock?: HostClock;
  readonly worldView?: WorldViewProvider;
  readonly capabilityInvoker?: CapabilityInvoker;
}

function fail<T>(error: ExtensionRuntimeError): ExtensionRuntimeResult<T> {
  return { ok: false, error };
}

/** Map a registry resolution error into the runtime taxonomy (path-prefixed). */
function mapRegistryError(
  error: { code: string; message: string },
  bindingIndex: number,
  capabilityId: string,
): ExtensionRuntimeError {
  const base: readonly (string | number)[] = ['capabilityBindings', bindingIndex];
  switch (error.code) {
    case 'unknown-capability':
      return {
        code: 'unknown-capability',
        message: error.message,
        path: [...base, 'capabilityId'],
      };
    case 'version-unsatisfied': {
      const detail = error as unknown as {
        constraint: unknown;
        availableVersions: readonly string[];
      };
      return {
        code: 'version-unsatisfied',
        message: error.message,
        path: [...base, 'versionRange'],
        constraint: detail.constraint as never,
        availableVersions: detail.availableVersions,
      };
    }
    case 'lifecycle-conflict':
      return {
        code: 'lifecycle-conflict',
        message: error.message,
        path: [...base, 'versionRange'],
        from: 'retired',
        to: 'registered',
      };
    default:
      return {
        code: 'unknown-capability',
        message: `capability binding "${capabilityId}" could not be resolved: ${error.message}`,
        path: [...base, 'capabilityId'],
      };
  }
}

/**
 * The reference sandbox host. Construct with a live
 * @epoch/capability-registry; the clock, world view, and capability
 * invoker default to deterministic in-memory implementations.
 */
export class ExtensionSandboxHost {
  private readonly options: Required<ExtensionSandboxHostOptions>;
  private readonly sessions = new Map<string, ExtensionSession>();
  private readonly records = new Map<string, AdmittedExtensionRecord>();
  private readonly evidenceBook = new InMemoryEvidenceBook();

  constructor(options: ExtensionSandboxHostOptions) {
    this.options = {
      registry: options.registry,
      clock: options.clock ?? fixedClock(),
      worldView: options.worldView ?? emptyWorldView(),
      capabilityInvoker: options.capabilityInvoker ?? unavailableCapabilityInvoker(),
    };
  }

  /** Admit an extension (see the module docs for the pipeline). Total. */
  admitExtension(input: unknown): ExtensionRuntimeResult<ExtensionSession> {
    const envelope = AdmissionEnvelopeSchema.safeParse(input);
    if (!envelope.success) {
      return fail(validationError(envelope.error));
    }
    const manifestParse = ExtensionManifestViewSchema.safeParse(envelope.data.manifest);
    if (!manifestParse.success) {
      return fail(validationError(manifestParse.error));
    }
    const manifest: ExtensionManifestView = manifestParse.data;
    const expected = canonicalDigest(manifest as unknown as JsonValue);
    if (expected !== envelope.data.digest) {
      return fail({
        code: 'digest-mismatch',
        message:
          'extension manifest digest does not match its content (tampered or mismatched envelope) — the extension never crosses the sandbox boundary',
        path: ['digest'],
        expected,
        encountered: envelope.data.digest,
      });
    }
    if (this.sessions.has(manifest.extensionId)) {
      return fail({
        code: 'validation',
        message: `extension "${manifest.extensionId}" is already hosted by this host — one host, one live session per extension identity`,
        issues: [{ path: 'extensionId', message: 'duplicate live session for this extension identity' }],
      });
    }
    const bindings: ResolvedCapabilityBinding[] = [];
    for (const [index, binding] of manifest.capabilityBindings.entries()) {
      const resolved = this.options.registry.resolve({
        capabilityId: binding.capabilityId,
        constraint: binding.versionRange,
      });
      if (!resolved.ok) {
        return fail(mapRegistryError(resolved.error, index, binding.capabilityId));
      }
      bindings.push({
        capabilityId: binding.capabilityId,
        capabilityVersion: resolved.value.manifest.version,
        capabilityManifestDigest: resolved.value.manifestDigest,
        bindingConstraint: binding.versionRange,
      });
    }
    bindings.sort((a, b) => (a.capabilityId < b.capabilityId ? -1 : a.capabilityId > b.capabilityId ? 1 : 0));
    const record: AdmittedExtensionRecord = {
      schemaVersion: 1,
      manifest,
      lifecycle: 'registered',
      manifestDigest: envelope.data.digest,
      bindings,
    };
    const session = new ExtensionSession({
      record,
      clock: this.options.clock,
      worldView: this.options.worldView,
      capabilityInvoker: this.options.capabilityInvoker,
      storage: new ExtensionStorageNamespace(),
      logRing: new SessionLogRing(),
      evidenceBook: this.evidenceBook,
    });
    this.sessions.set(manifest.extensionId, session);
    this.records.set(manifest.extensionId, record);
    return { ok: true, value: session };
  }

  /** Retrieve the live session of an admitted extension. */
  getSession(extensionId: string): ExtensionSession | undefined {
    return this.sessions.get(extensionId);
  }

  /** Deterministically ordered live sessions (by extensionId ascending). */
  listSessions(): readonly ExtensionSession[] {
    return [...this.sessions.keys()].sort().map((id) => this.sessions.get(id)!);
  }

  /** The in-memory evidence book (session evidence statements, attributed). */
  evidenceSnapshot(): readonly {
    evidenceId: string;
    statement: string;
    subjectDigest?: string;
    attributedExtensionId: string;
  }[] {
    return this.evidenceBook.snapshot();
  }

  /** Apply an extension lifecycle transition (advisory deprecation). */
  deprecateExtension(extensionId: string): ExtensionRuntimeResult<AdmittedExtensionRecord> {
    return this.transition(extensionId, 'deprecated');
  }

  /** Apply an extension lifecycle transition (terminal retirement). */
  retireExtension(extensionId: string): ExtensionRuntimeResult<AdmittedExtensionRecord> {
    return this.transition(extensionId, 'retired');
  }

  private transition(
    extensionId: string,
    to: CapabilityLifecycleState,
  ): ExtensionRuntimeResult<AdmittedExtensionRecord> {
    const record = this.records.get(extensionId);
    if (record === undefined) {
      return fail({
        code: 'unknown-capability',
        message: `no extension "${extensionId}" is hosted by this host`,
        path: ['extensionId'],
      });
    }
    if (!CAPABILITY_LIFECYCLE_TRANSITIONS[record.lifecycle].includes(to)) {
      const next = CAPABILITY_LIFECYCLE_TRANSITIONS[record.lifecycle];
      return fail({
        code: 'lifecycle-conflict',
        message: `illegal extension lifecycle transition ${record.lifecycle} -> ${to} for "${extensionId}" (legal transitions: ${
          next.length === 0 ? 'none (terminal state)' : next.map((target) => `${record.lifecycle} -> ${target}`).join(', ')
        })`,
        path: ['lifecycle'],
        from: record.lifecycle,
        to,
      });
    }
    const updated: AdmittedExtensionRecord = { ...record, lifecycle: to };
    this.records.set(extensionId, updated);
    const session = this.sessions.get(extensionId);
    if (session !== undefined) {
      session.applyLifecycle(to);
    }
    return { ok: true, value: updated };
  }
}
