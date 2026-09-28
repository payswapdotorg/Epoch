/**
 * examples/sdk — a capability adapter over the REAL @epoch/adapter-sdk
 * (W007) public API (W035).
 *
 * The example a developer follows to SERVE a registered capability:
 * build a typed adapter descriptor (identity, category, display name,
 * and the capability binding with a version range — never floating),
 * validate + content-address it, then NEGOTIATE the binding against the
 * REAL registered capability record at bind time (identity, category,
 * lifecycle and version all checked by the SDK) — and observe the typed
 * `version-unsatisfied` rejection when the range does not match. The
 * registry record flows in through the SDK's structural
 * `BindableCapability` view: real records are directly assignable.
 */
import {
  computeAdapterDescriptorDigest,
  negotiateBinding,
  parseAdapterDescriptor,
  type AdapterDescriptor,
  type BindingPin,
} from '@epoch/adapter-sdk';
import {
  CapabilityRegistry,
  computeCapabilityManifestDigest,
  type CapabilityRecord,
  type CapabilityRegistration,
} from '@epoch/capability-registry';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { CAPABILITY_ID } from './shared';
import { exampleCapabilityManifest } from './capability-registration';

/**
 * The adapter descriptor the example serves (loose JSON — the admission
 * path validates). A `caret 1.0.0` range accepts the registered 1.2.3.
 */
export function exampleAdapterDescriptor(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

/** A descriptor whose `caret 2.0.0` range the registered 1.2.3 does NOT satisfy. */
export function unsatisfiedAdapterDescriptor(): Record<string, unknown> {
  return exampleAdapterDescriptor({
    binding: { capabilityId: CAPABILITY_ID, versionRange: { kind: 'caret', version: '2.0.0' } },
  });
}

/** The registry holding the example capability (real W007 consumption). */
export function registryWithExampleCapability(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  const manifest = exampleCapabilityManifest();
  const registration: CapabilityRegistration = {
    manifest: manifest as unknown as CapabilityRegistration['manifest'],
    digest: computeCapabilityManifestDigest(manifest as unknown as CapabilityRegistration['manifest']),
  };
  const registered = registry.register(registration);
  if (!registered.ok) {
    throw new Error(`fixture registration failed: ${JSON.stringify(registered.error)}`);
  }
  return registry;
}

/** The typed outcome of the adapter example. */
export interface AdapterExample {
  readonly adapterId: string;
  readonly descriptorDigest: string;
  readonly pin: BindingPin;
  readonly unsatisfiedCode: string;
  readonly unsatisfiedConstraintKind: string;
}

/** Run the example (pure — same result every run). */
export function runAdapterExample(): AdapterExample {
  const registry = registryWithExampleCapability();
  const resolved = registry.get({ capabilityId: CAPABILITY_ID, version: '1.2.3' });
  if (!resolved.ok) {
    throw new Error(`resolution failed: ${JSON.stringify(resolved.error)}`);
  }
  const record: CapabilityRecord = resolved.value;

  const parsed = parseAdapterDescriptor(exampleAdapterDescriptor());
  if (!parsed.ok) {
    throw new Error(`descriptor failed validation: ${parsed.error.message}`);
  }
  const descriptor: AdapterDescriptor = parsed.value;
  const descriptorDigest = computeAdapterDescriptorDigest(descriptor);

  const negotiated = negotiateBinding(descriptor, record);
  if (!negotiated.ok) {
    throw new Error(`negotiation failed: ${negotiated.error.message}`);
  }

  const unsatisfiedParsed = parseAdapterDescriptor(unsatisfiedAdapterDescriptor());
  if (!unsatisfiedParsed.ok) {
    throw new Error(`unsatisfied descriptor failed validation: ${unsatisfiedParsed.error.message}`);
  }
  const unsatisfied = negotiateBinding(unsatisfiedParsed.value, record);
  if (unsatisfied.ok) {
    throw new Error('the caret-2.0.0 binding must NOT satisfy the registered 1.2.3');
  }

  return {
    adapterId: descriptor.adapterId,
    descriptorDigest,
    pin: negotiated.value,
    unsatisfiedCode: unsatisfied.error.code,
    unsatisfiedConstraintKind:
      (unsatisfied.error as { constraint?: { kind?: string } }).constraint?.kind ?? 'unknown',
  };
}

/** The canonical digest projection (the determinism gate). */
export function adapterDigestProjection(): string {
  const outcome = runAdapterExample();
  return canonicalDigest({
    adapterId: outcome.adapterId,
    descriptorDigest: outcome.descriptorDigest,
    pin: {
      capabilityId: outcome.pin.capabilityId,
      capabilityVersion: outcome.pin.capabilityVersion,
      manifestDigest: outcome.pin.manifestDigest,
      adapterId: outcome.pin.adapterId,
      adapterDescriptorDigest: outcome.pin.adapterDescriptorDigest,
    },
    unsatisfiedCode: outcome.unsatisfiedCode,
    unsatisfiedConstraintKind: outcome.unsatisfiedConstraintKind,
  } satisfies Record<string, JsonValue>);
}
