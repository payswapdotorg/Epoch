/**
 * Bind-time version negotiation (W007).
 *
 * An adapter DECLARES a capability binding (capability id + version
 * range) in its descriptor; the host presents capability records (the
 * minimal structural {@link BindableCapability} view — real
 * `@epoch/capability-registry` records are assignable to it, pinned by
 * the registry parity test, with NO runtime dependency); the SDK checks
 * the binding and produces a {@link BindingPin} — the exact,
 * content-addressed revision the invocation runs against.
 *
 * Checks (in order, each a typed error, never a guess):
 * 1. descriptor validity — `validation` with precise paths;
 * 2. identity — the capability id and category must match the binding
 *    (`binding-conflict`);
 * 3. lifecycle — retired capabilities never bind (`lifecycle-conflict`);
 *    deprecation is advisory and still binds;
 * 4. version — the capability version must satisfy the declared range
 *    (`version-unsatisfied`, carrying the constraint and the available
 *    versions).
 *
 * `negotiateBestBinding` picks the HIGHEST satisfying, non-retired
 * version deterministically (version descending, manifest digest
 * ascending as the total tie-break — no insertion-order leaks).
 */
import { compareSemver, satisfiesVersionConstraint } from './semver';
import { AdapterDescriptorSchema } from './schema';
import { computeAdapterDescriptorDigest } from './descriptor';
import { validationError } from './issues';
import type {
  AdapterDescriptor,
  AdapterSdkError,
  AdapterSdkResult,
  BindableCapability,
  BindingPin,
} from './types';

function fail<T>(error: AdapterSdkError): AdapterSdkResult<T> {
  return { ok: false, error };
}

/** Validate the descriptor (defensive — descriptors may come from untrusted origins). */
function validDescriptor(descriptor: AdapterDescriptor): AdapterSdkResult<AdapterDescriptor> {
  const parsed = AdapterDescriptorSchema.safeParse(descriptor);
  if (!parsed.success) {
    return fail(validationError(parsed.error));
  }
  return { ok: true, value: parsed.data };
}

/**
 * Negotiate a binding between one adapter descriptor and one capability
 * record view. Total, deterministic, never throws.
 */
export function negotiateBinding(
  descriptor: AdapterDescriptor,
  capability: BindableCapability,
): AdapterSdkResult<BindingPin> {
  const valid = validDescriptor(descriptor);
  if (!valid.ok) return valid;
  const desc = valid.value;

  if (desc.binding.capabilityId !== capability.manifest.capabilityId) {
    return fail({
      code: 'binding-conflict',
      message: `adapter "${desc.adapterId}" serves capability "${desc.binding.capabilityId}", not "${capability.manifest.capabilityId}" — the binding ids must match`,
      path: ['binding', 'capabilityId'],
      expected: desc.binding.capabilityId,
      encountered: capability.manifest.capabilityId,
    });
  }
  if (desc.category !== capability.manifest.category) {
    return fail({
      code: 'binding-conflict',
      message: `adapter "${desc.adapterId}" implements the ${desc.category} contract, but capability "${capability.manifest.capabilityId}" is registered in the ${capability.manifest.category} category`,
      path: ['category'],
      expected: desc.category,
      encountered: capability.manifest.category,
    });
  }
  if (capability.lifecycle === 'retired') {
    return fail({
      code: 'lifecycle-conflict',
      message: `capability "${capability.manifest.capabilityId}" at version "${capability.manifest.version}" is retired — retired capabilities do not accept new bindings`,
      path: ['lifecycle'],
      from: 'retired',
      to: 'registered',
    });
  }
  if (!satisfiesVersionConstraint(capability.manifest.version, desc.binding.versionRange)) {
    return fail({
      code: 'version-unsatisfied',
      message: `capability "${capability.manifest.capabilityId}" version "${capability.manifest.version}" does not satisfy the range declared by adapter "${desc.adapterId}"`,
      path: ['binding', 'versionRange'],
      constraint: desc.binding.versionRange,
      availableVersions: [capability.manifest.version],
    });
  }
  return {
    ok: true,
    value: {
      capabilityId: capability.manifest.capabilityId,
      capabilityVersion: capability.manifest.version,
      manifestDigest: capability.manifestDigest,
      adapterId: desc.adapterId,
      adapterDescriptorDigest: computeAdapterDescriptorDigest(desc),
    },
  };
}

/**
 * Negotiate the BEST binding between one adapter descriptor and a set of
 * capability record views (e.g. all registered versions of the served
 * capability). Deterministic: the highest satisfying, non-retired
 * version wins; equal versions tie-break on manifest digest ascending.
 * Total, never throws.
 */
export function negotiateBestBinding(
  descriptor: AdapterDescriptor,
  capabilities: readonly BindableCapability[],
): AdapterSdkResult<BindingPin> {
  const valid = validDescriptor(descriptor);
  if (!valid.ok) return valid;
  const desc = valid.value;

  const idMatching = capabilities.filter(
    (capability) => capability.manifest.capabilityId === desc.binding.capabilityId,
  );
  if (idMatching.length === 0) {
    return fail({
      code: 'unknown-capability',
      message: `no capability with id "${desc.binding.capabilityId}" was provided for binding (adapter "${desc.adapterId}" serves that id)`,
      path: ['binding', 'capabilityId'],
    });
  }
  const categoryMatching = idMatching.filter(
    (capability) => capability.manifest.category === desc.category,
  );
  if (categoryMatching.length === 0) {
    return fail({
      code: 'binding-conflict',
      message: `adapter "${desc.adapterId}" implements the ${desc.category} contract, but no provided record of capability "${desc.binding.capabilityId}" is registered in that category`,
      path: ['category'],
      expected: desc.category,
      encountered: idMatching[0]!.manifest.category,
    });
  }
  const availableVersions = [...categoryMatching]
    .map((capability) => capability.manifest.version)
    .sort(compareSemver);
  const bindable = categoryMatching.filter(
    (capability) => capability.lifecycle !== 'retired',
  );
  if (bindable.length === 0) {
    return fail({
      code: 'lifecycle-conflict',
      message: `every provided record of capability "${desc.binding.capabilityId}" in the ${desc.category} category is retired — retired capabilities do not accept new bindings`,
      path: ['lifecycle'],
      from: 'retired',
      to: 'registered',
    });
  }
  const satisfying = bindable.filter((capability) =>
    satisfiesVersionConstraint(capability.manifest.version, desc.binding.versionRange),
  );
  if (satisfying.length === 0) {
    return fail({
      code: 'version-unsatisfied',
      message: `no provided record of capability "${desc.binding.capabilityId}" satisfies the range declared by adapter "${desc.adapterId}" (available: ${availableVersions.join(', ')})`,
      path: ['binding', 'versionRange'],
      constraint: desc.binding.versionRange,
      availableVersions,
    });
  }
  // Deterministic best match: version descending, digest ascending.
  const best = [...satisfying].sort((a, b) => {
    const byVersion = compareSemver(b.manifest.version, a.manifest.version);
    if (byVersion !== 0) return byVersion;
    return a.manifestDigest < b.manifestDigest ? -1 : a.manifestDigest > b.manifestDigest ? 1 : 0;
  })[0]!;
  return {
    ok: true,
    value: {
      capabilityId: best.manifest.capabilityId,
      capabilityVersion: best.manifest.version,
      manifestDigest: best.manifestDigest,
      adapterId: desc.adapterId,
      adapterDescriptorDigest: computeAdapterDescriptorDigest(desc),
    },
  };
}
