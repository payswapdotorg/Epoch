/**
 * @epoch/construction-world-fixture — the six construction layers
 * (W071, ACR-012 §3 — site, foundation, structure, envelope, mep,
 * finishes).
 *
 * The layer-navigator data. These are NOT a new contract surface — the
 * W016 scene derives semantic layers from the canonical entity-type
 * namespaces; the fixture's ConstructionLayer record is fixture-local
 * composition data consumed by the host layer navigator (W072/W073).
 */
import type { ConstructionLayer } from './types';
import { CONSTRUCTION_LAYER_IDS } from './version';
import { ENTITY_GEOMETRY } from './entities';

/** The six canonical construction layers (ACR-012 §3). */
export const LAYERS: readonly ConstructionLayer[] = (() => {
  const labels: Record<(typeof CONSTRUCTION_LAYER_IDS)[number], string> = {
    'lyr-site': 'Site',
    'lyr-foundation': 'Foundation',
    'lyr-structure': 'Structure',
    'lyr-envelope': 'Envelope',
    'lyr-mep': 'MEP',
    'lyr-finishes': 'Finishes',
  };
  const descriptions: Record<(typeof CONSTRUCTION_LAYER_IDS)[number], string> = {
    'lyr-site': 'Boundary, access, staging and excavation.',
    'lyr-foundation': 'Strip foundation, pad bases and ground slab.',
    'lyr-structure': 'Columns, beams and the roof structure frame.',
    'lyr-envelope': 'Walls, doors, windows and the roof cladding.',
    'lyr-mep': 'Electrical, lighting, plumbing, HVAC and drainage.',
    'lyr-finishes': 'Ceiling, floor, paint and fixtures.',
  };
  return CONSTRUCTION_LAYER_IDS.map((layerId) => {
    const entityIds = ENTITY_GEOMETRY.filter((e) => e.layer === layerId)
      .map((e) => e.entityId)
      .sort();
    return {
      layerId,
      label: labels[layerId],
      description: descriptions[layerId],
      entityIds,
    };
  });
})();

/** The layer IDs in canonical order (re-exported for host evidence). */
export const LAYER_IDS = CONSTRUCTION_LAYER_IDS;
