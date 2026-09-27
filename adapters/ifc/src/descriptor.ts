/**
 * @epoch/adapter-ifc — the W007 adapter descriptors (typed,
 * content-addressed, standard-neutral).
 *
 * Every descriptor is a plain `AdapterDescriptor` document (the SDK's
 * published contract): the adapter's identity, its category, and the
 * capability binding it serves. Descriptors are digested through the
 * REAL SDK discipline (`computeAdapterDescriptorDigest` — canonical
 * JSON, content-addressed), so every invocation is attributable to the
 * exact descriptor revision.
 */
import type { AdapterDescriptor } from '@epoch/adapter-sdk';
import { computeAdapterDescriptorDigest } from '@epoch/adapter-sdk';

/** The W007 capability ids this adapter's surfaces bind. */
export const SOURCE_CAPABILITY_ID = 'building.model-observation' as const;
export const SEMANTIC_CAPABILITY_ID = 'building.semantic-projection' as const;

/** The capability versions this reference set pins (exact). */
export const CAPABILITY_VERSION = '1.0.0' as const;

/** The source-category adapter descriptor (the building-model observation surface). */
export const SOURCE_ADAPTER_DESCRIPTOR: AdapterDescriptor = {
  schemaVersion: 1,
  adapterId: 'adapter:building-model-source',
  category: 'source',
  displayName: 'Building Model Source Adapter (reference)',
  description:
    'Reference source adapter: observes content-addressed building-model fixtures as exact-revision, provenance-carrying observation records. Standard-neutral seam; the exchange standard is adapted, never authoritative.',
  binding: {
    capabilityId: SOURCE_CAPABILITY_ID,
    versionRange: { kind: 'exact', version: CAPABILITY_VERSION },
  },
};

/** The semantic-category adapter descriptor (the building-model projection surface). */
export const SEMANTIC_ADAPTER_DESCRIPTOR: AdapterDescriptor = {
  schemaVersion: 1,
  adapterId: 'adapter:building-model-semantic',
  category: 'semantic',
  displayName: 'Building Model Semantic Adapter (reference)',
  description:
    'Reference semantic adapter: maps building-model fixtures INTO the W002 world-model graph as REAL assertion-input records (entities, properties, relationships). External-standard semantics are adapted, never authoritative.',
  binding: {
    capabilityId: SEMANTIC_CAPABILITY_ID,
    versionRange: { kind: 'exact', version: CAPABILITY_VERSION },
  },
};

/** The exact descriptor digests (content addresses; computed through the REAL SDK discipline). */
export const SOURCE_ADAPTER_DESCRIPTOR_DIGEST = computeAdapterDescriptorDigest(SOURCE_ADAPTER_DESCRIPTOR);
export const SEMANTIC_ADAPTER_DESCRIPTOR_DIGEST = computeAdapterDescriptorDigest(SEMANTIC_ADAPTER_DESCRIPTOR);

/** Both descriptors, deterministically ordered (source, then semantic). */
export const IFC_ADAPTER_DESCRIPTORS: readonly AdapterDescriptor[] = [
  SOURCE_ADAPTER_DESCRIPTOR,
  SEMANTIC_ADAPTER_DESCRIPTOR,
];
