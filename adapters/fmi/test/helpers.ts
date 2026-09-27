// Shared fixtures: tenant scope, the canonical participant setup, and
// the REAL W007 registry helpers (devDependencies only).
import {
  CapabilityRegistry,
  sealCapabilityManifest,
  type CapabilityRecord,
} from '@epoch/capability-registry';
import { negotiateBinding, type BindingPin } from '@epoch/adapter-sdk';
import {
  FmiAdapterHost,
  FmiSimulationAdapter,
  deriveCapabilityRegistrations,
  referenceParticipant,
  type TypedParticipant,
} from '../src/index';

/** The W009 tenant grammars. */
export const TENANT_A = 'tenant:acme';
export const TENANT_B = 'tenant:globex';

/** The neutral participant identity of the reference fixture. */
export const REFERENCE_PARTICIPANT_ID = 'participant:linearplant';

/** The canonical input values of the reference participant. */
export const REFERENCE_INPUTS = { 'drive-input': 1.0 } as const;

/** The REAL W007 registry with the adapter's derived registration admitted. */
export function registryWithAdapter(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  for (const registration of deriveCapabilityRegistrations()) {
    const sealed = sealCapabilityManifest(registration.manifest);
    if (!sealed.ok) {
      throw new Error(`derived manifest failed W007 sealing: ${sealed.error.message}`);
    }
    if (sealed.value.digest !== registration.digest) {
      throw new Error('derived digest does not equal the registry-computed digest');
    }
    const admitted = registry.register(sealed.value);
    if (!admitted.ok) {
      throw new Error(`registration rejected: ${admitted.error.message}`);
    }
  }
  return registry;
}

/** The binding pin for the simulation surface, negotiated through the REAL SDK. */
export function pinFor(adapter: FmiSimulationAdapter, registry: CapabilityRegistry): BindingPin {
  const record = registry
    .list({ category: adapter.descriptor.category })
    .find((entry: CapabilityRecord) => entry.manifest.capabilityId === adapter.descriptor.binding.capabilityId);
  if (record === undefined) {
    throw new Error(`capability ${adapter.descriptor.binding.capabilityId} is not registered`);
  }
  const negotiated = negotiateBinding(adapter.descriptor, record);
  if (!negotiated.ok) {
    throw new Error(`binding negotiation failed: ${negotiated.error.message}`);
  }
  return negotiated.value;
}

/** The canonical host + adapter, with the reference participant admitted. */
export function adapterSetup(options?: { readonly tenantId?: string }) {
  const host = new FmiAdapterHost({ expectedTenantId: options?.tenantId ?? TENANT_A });
  const admitted = host.admitParticipant({ tenantId: TENANT_A, payload: referenceParticipant() });
  if (!admitted.ok) throw new Error(admitted.error.message);
  const adapter = new FmiSimulationAdapter({ host, expectedTenantId: TENANT_A });
  return { host, adapter, participant: admitted.value };
}

/** The reference participant projection (typed). */
export function referenceParticipantTyped(): TypedParticipant {
  const host = new FmiAdapterHost();
  const admitted = host.admitParticipant({ tenantId: TENANT_A, payload: referenceParticipant() });
  if (!admitted.ok) throw new Error(admitted.error.message);
  return admitted.value;
}
