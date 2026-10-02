/**
 * SEMANTIC LAYERS of the interactive world (W057): the layer model the
 * workspace's layer panel exposes. Layers are DERIVED, never stored: the
 * canonical scene's entity types (`namespace:name`, the world model's
 * opaque vocabulary) partition the presented entities into semantic
 * layers identified by the `lyr-` grammar of contracts/renderers v1.1.0.
 *
 * Layer operations are EXISTING typed intents (hide/show/filter) applied
 * through the W016 reducer — the layer model itself is a pure projection
 * with no second semantic store (lock rules 8/16).
 */
import type { WorldScene } from '@epoch/world-experience';

/** One semantic layer of the workspace (derived, presentation-only). */
export interface SemanticLayer {
  /** The layer id ("lyr-" + the entity-type namespace, sorted). */
  readonly layerId: string;
  /** The entity-type namespace the layer groups. */
  readonly namespace: string;
  /** Display label. */
  readonly label: string;
  /** The canonical entity ids of the layer (sorted). */
  readonly entityIds: readonly string[];
  /** Whether every layer entity is currently visible in the scene. */
  readonly visible: boolean;
  /** Whether some (not all / not none) layer entities are visible. */
  readonly mixed: boolean;
}

/** The namespace of one entity type key (`namespace:name`). */
export function namespaceOfEntityType(entityType: string): string {
  const separator = entityType.indexOf(':');
  if (separator <= 0) {
    throw new Error(`entity type keys are 'namespace:name' (encountered "${entityType}")`);
  }
  return entityType.slice(0, separator);
}

/** The layer id of one entity type key (deterministic). */
export function layerIdOfEntityType(entityType: string): string {
  return `lyr-${namespaceOfEntityType(entityType)}`;
}

/**
 * Derive the semantic layers of one canonical scene (pure): entities
 * grouped by entity-type namespace, sorted by layer id, with visibility
 * computed from the CURRENT scene revision (never cached).
 */
export function deriveLayers(scene: WorldScene): readonly SemanticLayer[] {
  const byLayer = new Map<string, { namespace: string; entityIds: string[]; visibleCount: number }>();
  for (const entity of scene.entities) {
    const namespace = namespaceOfEntityType(entity.entityType);
    const layerId = `lyr-${namespace}`;
    let entry = byLayer.get(layerId);
    if (entry === undefined) {
      entry = { namespace, entityIds: [], visibleCount: 0 };
      byLayer.set(layerId, entry);
    }
    entry.entityIds.push(entity.entityId);
    if (entity.visible) {
      entry.visibleCount += 1;
    }
  }
  return [...byLayer.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([layerId, entry]) => ({
      layerId,
      namespace: entry.namespace,
      label: entry.namespace.charAt(0).toUpperCase() + entry.namespace.slice(1),
      entityIds: entry.entityIds.sort(),
      visible: entry.visibleCount === entry.entityIds.length,
      mixed: entry.visibleCount > 0 && entry.visibleCount < entry.entityIds.length,
    }));
}

/** The portable layer-visibility entries of one canonical scene (the contract record). */
export function layerVisibilityOf(
  scene: WorldScene,
): readonly { readonly layerId: string; readonly visible: boolean }[] {
  return deriveLayers(scene).map((layer) => ({ layerId: layer.layerId, visible: layer.visible }));
}
