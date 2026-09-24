/**
 * The reference in-memory Capability Registry (W007).
 *
 * Owns (and only owns): capability manifests, registration/deregistration,
 * category- and version-constrained lookup with deterministic ordering,
 * and the typed lifecycle `registered -> deprecated -> retired`.
 *
 * Explicitly NOT (later Work Orders / out of scope): persistence, an event
 * log, UI, a workflow engine, trust scoring, entitlements. The surface is
 * serialization-friendly for the future persistence Work Order: records
 * are plain JSON objects, iteration is sorted (no insertion-order leaks),
 * and every entry point is total (typed errors, never thrown).
 *
 * Lookup discipline:
 * - `get` retrieves a record at an exact (id, version) pin in ANY
 *   lifecycle state (inspection, not a new binding).
 * - `resolve` is for NEW bindings: retired records never resolve
 *   (lifecycle-conflict when retirement is the only obstacle),
 *   deprecation is advisory (deprecated records still resolve), and the
 *   best match is the HIGHEST satisfying version — deterministic, or a
 *   typed no-match error. Never a guess.
 */
import { CapabilityManifestSchema } from './schema';
import { verifyManifestDigest } from './digest';
import { validationError } from './issues';
import { compareSemver, satisfiesVersionConstraint, type VersionConstraint } from './semver';
import { CAPABILITY_LIFECYCLE_TRANSITIONS, type CapabilityLifecycleState } from './version';
import type {
  CapabilityCategory,
  CapabilityRecord,
  CapabilityRegistration,
  RegistryError,
  RegistryResult,
} from './types';

/** Input of `register`: the sealed registration envelope. */
export type RegisterCapabilityInput = CapabilityRegistration;

/** Exact (id, version) pin. */
export interface CapabilityLookup {
  readonly capabilityId: string;
  readonly version: string;
}

/** Version-constrained resolution input. */
export interface ResolveCapabilityInput {
  readonly capabilityId: string;
  readonly constraint: VersionConstraint;
}

/** Filter for deterministic listing. */
export interface ListCapabilitiesFilter {
  readonly category?: CapabilityCategory;
  readonly lifecycle?: CapabilityLifecycleState;
}

function ok<T>(value: T): RegistryResult<T> {
  return { ok: true, value };
}

function fail<T>(error: RegistryError): RegistryResult<T> {
  return { ok: false, error };
}

const unknownCapability = (lookup: {
  capabilityId: string;
  version?: string;
}): RegistryError => ({
  code: 'unknown-capability',
  message:
    lookup.version === undefined
      ? `no capability registered with id "${lookup.capabilityId}"`
      : `no capability registered with id "${lookup.capabilityId}" at version "${lookup.version}"`,
  path: ['capabilityId'],
});

function sortedVersionList(versions: Map<string, CapabilityRecord>): string[] {
  return [...versions.keys()].sort(compareSemver);
}

function describeTransitions(state: CapabilityLifecycleState): string {
  const next = CAPABILITY_LIFECYCLE_TRANSITIONS[state];
  return next.length === 0
    ? 'none (terminal state)'
    : next.map((s) => `${state} -> ${s}`).join(', ');
}

/**
 * The reference registry. Construct directly (`new CapabilityRegistry()`)
 * — no persistence, no events, no clocks: registration order never leaks
 * into iteration (all listing is sorted).
 */
export class CapabilityRegistry {
  /** capabilityId -> (version -> record). Maps iterate in insertion order;
   * every read path sorts before exposing anything. */
  private readonly store = new Map<string, Map<string, CapabilityRecord>>();

  /** Number of registered records (all lifecycle states). */
  get size(): number {
    let count = 0;
    for (const versions of this.store.values()) count += versions.size;
    return count;
  }

  /**
   * Register a sealed capability manifest. Admission pipeline (total,
   * never throws):
   *
   * 1. manifest schema validation — typed `validation` issues with
   *    precise dotted paths (strict objects: unknown/vendor fields are
   *    rejected);
   * 2. digest verification — the claimed digest must equal the
   *    recomputed canonical SHA-256 of the manifest content, else
   *    `digest-mismatch` (tamper detection);
   * 3. duplicate check — (capabilityId, version) must be free, else
   *    `duplicate-capability` (versioned capabilities: changed content
   *    ships as a NEW version; idempotent re-registration of identical
   *    content is a persistence-layer concern, not a registry one).
   *
   * Returns the stored record (lifecycle `registered`).
   */
  register(input: RegisterCapabilityInput): RegistryResult<CapabilityRecord> {
    const manifest = CapabilityManifestSchema.safeParse(input.manifest);
    if (!manifest.success) {
      return fail(validationError(manifest.error));
    }
    const verified = verifyManifestDigest({ manifest: manifest.data, digest: input.digest });
    if (!verified.ok) {
      return fail(verified.error);
    }
    const { capabilityId, version } = manifest.data;
    let versions = this.store.get(capabilityId);
    if (versions === undefined) {
      versions = new Map<string, CapabilityRecord>();
      this.store.set(capabilityId, versions);
    } else if (versions.has(version)) {
      return fail({
        code: 'duplicate-capability',
        message: `capability "${capabilityId}" is already registered at version "${version}" — versioned capabilities ship changed content as a new version`,
        path: ['manifest', 'version'],
      });
    }
    const record: CapabilityRecord = {
      schemaVersion: 1,
      manifest: manifest.data,
      lifecycle: 'registered',
      manifestDigest: input.digest,
    };
    versions.set(version, record);
    return ok(record);
  }

  /** Remove a record from the registry (any lifecycle state). Returns the removed record. */
  deregister(lookup: CapabilityLookup): RegistryResult<CapabilityRecord> {
    const versions = this.store.get(lookup.capabilityId);
    const record = versions?.get(lookup.version);
    if (record === undefined) {
      return fail(unknownCapability(lookup));
    }
    versions!.delete(lookup.version);
    if (versions!.size === 0) {
      this.store.delete(lookup.capabilityId);
    }
    return ok(record);
  }

  /** Retrieve the record at an exact (id, version) pin, in any lifecycle state. */
  get(lookup: CapabilityLookup): RegistryResult<CapabilityRecord> {
    const record = this.store.get(lookup.capabilityId)?.get(lookup.version);
    if (record === undefined) {
      return fail(unknownCapability(lookup));
    }
    return ok(record);
  }

  /**
   * Resolve the BEST match for a new binding (never a guess):
   *
   * - no records for the id — `unknown-capability`;
   * - records exist but none satisfies the constraint —
   *   `version-unsatisfied` (carrying the constraint and the available
   *   versions, ascending);
   * - satisfying records exist but every one is retired —
   *   `lifecycle-conflict` (retirement is the obstacle; deprecation is
   *   advisory and still resolves);
   * - otherwise the HIGHEST satisfying, non-retired version —
   *   deterministic across insertion orders.
   */
  resolve(input: ResolveCapabilityInput): RegistryResult<CapabilityRecord> {
    const versions = this.store.get(input.capabilityId);
    if (versions === undefined || versions.size === 0) {
      return fail(unknownCapability({ capabilityId: input.capabilityId }));
    }
    const satisfying = [...versions.values()]
      .filter((record) => satisfiesVersionConstraint(record.manifest.version, input.constraint))
      .sort((a, b) => compareSemver(a.manifest.version, b.manifest.version));
    if (satisfying.length === 0) {
      return fail({
        code: 'version-unsatisfied',
        message: `no version of capability "${input.capabilityId}" satisfies the constraint (available: ${sortedVersionList(versions)})`,
        path: ['constraint'],
        constraint: input.constraint,
        availableVersions: sortedVersionList(versions),
      });
    }
    const bindable = satisfying.filter((record) => record.lifecycle !== 'retired');
    if (bindable.length === 0) {
      return fail({
        code: 'lifecycle-conflict',
        message: `every version of capability "${input.capabilityId}" satisfying the constraint is retired — retired capabilities do not resolve for new bindings (available: ${sortedVersionList(versions)})`,
        path: ['constraint'],
        from: 'retired',
        to: 'registered',
      });
    }
    // Highest satisfying, non-retired version (sort is ascending).
    return ok(bindable[bindable.length - 1]!);
  }

  /**
   * Deterministically ordered records: by capabilityId ascending, then by
   * version ascending — independent of registration order. Optional
   * category/lifecycle filters.
   */
  list(filter: ListCapabilitiesFilter = {}): readonly CapabilityRecord[] {
    const records: CapabilityRecord[] = [];
    const ids = [...this.store.keys()].sort();
    for (const id of ids) {
      const versions = this.store.get(id)!;
      const ordered = [...versions.keys()].sort(compareSemver);
      for (const version of ordered) {
        const record = versions.get(version)!;
        if (
          (filter.category === undefined || record.manifest.category === filter.category) &&
          (filter.lifecycle === undefined || record.lifecycle === filter.lifecycle)
        ) {
          records.push(record);
        }
      }
    }
    return records;
  }

  /**
   * Deprecate a record (advisory withdrawal — it still resolves for new
   * bindings). Typed transition: only `registered -> deprecated` is legal.
   */
  deprecate(lookup: CapabilityLookup): RegistryResult<CapabilityRecord> {
    return this.transition(lookup, 'deprecated');
  }

  /**
   * Retire a record (terminal — it stops resolving for new bindings).
   * Typed transitions: `registered -> retired` and `deprecated ->
   * retired` are legal.
   */
  retire(lookup: CapabilityLookup): RegistryResult<CapabilityRecord> {
    return this.transition(lookup, 'retired');
  }

  private transition(
    lookup: CapabilityLookup,
    to: CapabilityLifecycleState,
  ): RegistryResult<CapabilityRecord> {
    const versions = this.store.get(lookup.capabilityId);
    const record = versions?.get(lookup.version);
    if (record === undefined) {
      return fail(unknownCapability(lookup));
    }
    if (!CAPABILITY_LIFECYCLE_TRANSITIONS[record.lifecycle].includes(to)) {
      return fail({
        code: 'lifecycle-conflict',
        message: `illegal lifecycle transition ${record.lifecycle} -> ${to} for capability "${lookup.capabilityId}" at version "${lookup.version}" (legal transitions: ${describeTransitions(record.lifecycle)})`,
        path: ['lifecycle'],
        from: record.lifecycle,
        to,
      });
    }
    const updated: CapabilityRecord = { ...record, lifecycle: to };
    versions!.set(lookup.version, updated);
    return ok(updated);
  }
}
