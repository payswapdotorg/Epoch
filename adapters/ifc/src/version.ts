/**
 * @epoch/adapter-ifc — contract versions and closed vocabularies.
 *
 * NEUTRAL SEAM (architecture lock rule 13: provider behavior is
 * adapterized): every vocabulary below names typed, provider-neutral
 * concepts of the building-model domain — models, elements, spatial
 * containment, semantic projections. The exchange standard's own
 * vocabulary (schema identifiers, entity names, relationship names)
 * lives ONLY in `src/provider/` and never crosses this seam; the
 * per-adapter neutrality blocklist test pins that boundary.
 */

/** Version of the published adapter contract surface (types + vocabularies). */
export const IFC_ADAPTER_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized adapter record. */
export const IFC_ADAPTER_RECORD_VERSION = 1 as const;

/**
 * The contract ids this package issues for W007 contract references
 * (capability manifests reference the contracts they honor).
 */
export const IFC_SOURCE_CONTRACT_ID = 'epoch.adapter.building-model-source' as const;
export const IFC_SEMANTIC_CONTRACT_ID = 'epoch.adapter.building-model-semantic' as const;

/** The W007 adapter categories this package implements (source + semantic). */
export const IFC_ADAPTER_CATEGORIES = ['source', 'semantic'] as const;

/**
 * The projected construction-domain namespace of the world-model type
 * keys (the projected target vocabulary; formal ownership belongs to the
 * construction domain pack — the adapter only MAPS standard entities
 * INTO it).
 */
export const CONSTRUCTION_DOMAIN_NAMESPACE = 'construction' as const;

/** The neutral projected entity type keys (the construction namespace). */
export const CONSTRUCTION_ENTITY_TYPES = [
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
] as const;

/** One projected entity type key. */
export type ConstructionEntityType = (typeof CONSTRUCTION_ENTITY_TYPES)[number];

/** The neutral projected relation type keys. */
export const CONSTRUCTION_RELATION_TYPES = [
  'construction:contained-in',
  'construction:aggregates',
] as const;

/** One projected relation type key. */
export type ConstructionRelationType = (typeof CONSTRUCTION_RELATION_TYPES)[number];

/** Dispositions of an ingestion (idempotent, content-addressed). */
export const INGESTION_DISPOSITIONS = ['ingested', 'duplicate'] as const;

/** One ingestion disposition. */
export type IngestionDisposition = (typeof INGESTION_DISPOSITIONS)[number];
