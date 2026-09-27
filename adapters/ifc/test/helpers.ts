// Shared fixtures: tenant scope, instants, the REAL W007 registry setup,
// and the world-model vocabulary registration (devDependencies only).
import {
  CapabilityRegistry,
  sealCapabilityManifest,
  type CapabilityRecord,
} from '@epoch/capability-registry';
import { negotiateBinding, type BindingPin } from '@epoch/adapter-sdk';
import { WorldModel, type Assertion } from '@epoch/world-model';
import {
  IfcSemanticAdapter,
  IfcSourceAdapter,
  IfcAdapterHost,
  deriveCapabilityRegistrations,
  projectModel,
  referenceModel,
  parseProviderModel,
  type BuildingModelProjection,
} from '../src/index';

/** Canonical instants (caller-supplied everywhere; zero wall-clock in src). */
export const T0 = '2026-03-01T09:00:00.000Z';
export const T1 = '2026-03-01T10:00:00.000Z';

/** The W009 tenant grammars. */
export const TENANT_A = 'tenant:acme';
export const TENANT_B = 'tenant:globex';

/** The neutral building-model identity of the reference fixture. */
export const REFERENCE_MODEL_ID = 'bim:epoch-reference-building';

/** The REAL W007 registry with the adapter's derived registrations admitted. */
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

/** The binding pin for an adapter surface, negotiated through the REAL SDK. */
export function pinFor(
  adapter: IfcSourceAdapter | IfcSemanticAdapter,
  registry: CapabilityRegistry,
): BindingPin {
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

/** The canonical adapter host + both surfaces, wired for tests. */
export function adapterSetup(options?: { readonly tenantId?: string }) {
  const host = new IfcAdapterHost({ expectedTenantId: options?.tenantId ?? TENANT_A });
  const source = new IfcSourceAdapter({ host, expectedTenantId: TENANT_A });
  const semantic = new IfcSemanticAdapter({ host, expectedTenantId: TENANT_A });
  return { host, source, semantic };
}

/** The host with the reference model ingested. */
export function hostWithReferenceModel(): IfcAdapterHost {
  const host = new IfcAdapterHost({ expectedTenantId: TENANT_A });
  const ingested = host.ingestModel({ tenantId: TENANT_A, payload: referenceModel(), ingestedAt: T0 });
  if (!ingested.ok) throw new Error(ingested.error.message);
  return host;
}

/** The reference projection (parsed + projected deterministically). */
export function referenceProjection(): BuildingModelProjection {
  const parsed = parseProviderModel(referenceModel());
  if (!parsed.success) throw new Error('fixture parse failed');
  return projectModel({ tenantId: TENANT_A, model: parsed.data, observedAt: T0 });
}

/**
 * A world-model authority with the construction-domain vocabulary
 * registered (domain-pack territory — the host registers the target
 * vocabulary; the adapter maps INTO it).
 */
export function worldWithConstructionVocabulary(): WorldModel {
  const world = WorldModel.create();
  const entityTypes = [
    'construction:element',
    'construction:site',
    'construction:building',
    'construction:storey',
    'construction:space',
    'construction:wall',
    'construction:slab',
    'construction:column',
    'construction:beam',
    'construction:door',
    'construction:window',
  ];
  for (const key of entityTypes) {
    world.registerEntityType({ key, extends: 'core:entity', description: `Construction domain entity type ${key}.` });
  }
  world.registerRelationType({
    key: 'construction:contained-in',
    description: 'The source element is contained in the target spatial element.',
    sourceType: 'core:entity',
    targetType: 'core:entity',
  });
  world.registerRelationType({
    key: 'construction:aggregates',
    description: 'The target aggregates the source elements.',
    sourceType: 'core:entity',
    targetType: 'core:entity',
  });
  return world;
}

/** Apply a projection's assertion inputs to a world model (entities first). */
export function applyProjection(world: WorldModel, projection: BuildingModelProjection): Assertion[] {
  const applied: Assertion[] = [];
  for (const input of projection.assertionInputs) {
    applied.push(world.applyAssertion(input));
  }
  return applied;
}
