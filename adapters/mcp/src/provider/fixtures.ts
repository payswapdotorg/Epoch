/**
 * @epoch/adapter-mcp — reference provider fixtures (the tool protocol's
 * vocabulary allowed HERE only; the W020/W022 reference precedent: no
 * live network calls, fixtures stand in for provider payloads).
 *
 * Fixtures are DETERMINISTIC constructors: identical calls produce
 * byte-identical payloads, so discovery digests and invocation records
 * replay identically (pinned by the determinism tests).
 */
import { PROVIDER_CATALOG_VERSION, PROVIDER_PROTOCOL_NAME } from './payload';

/**
 * The canonical reference catalog: two tools — a deterministic terrain
 * elevation lookup and a unit conversion utility.
 */
export function referenceCatalog(): unknown {
  return {
    schemaVersion: PROVIDER_CATALOG_VERSION,
    protocol: PROVIDER_PROTOCOL_NAME,
    tools: [
      {
        name: 'terrain_elevation_lookup',
        description: 'Looks up the terrain elevation at a coordinate (deterministic reference tool).',
        inputArguments: [
          { name: 'latitude', valueKind: 'number', required: true, description: 'Latitude in degrees.' },
          { name: 'longitude', valueKind: 'number', required: true, description: 'Longitude in degrees.' },
        ],
        outputSummary: 'The terrain elevation in meters at the coordinate.',
      },
      {
        name: 'unit_convert',
        description: 'Converts a quantity between declared units (deterministic reference tool).',
        inputArguments: [
          { name: 'value', valueKind: 'number', required: true, description: 'The quantity to convert.' },
          { name: 'unit_from', valueKind: 'string', required: true, description: 'The source unit.' },
          { name: 'unit_to', valueKind: 'string', required: true, description: 'The target unit.' },
        ],
        outputSummary: 'The converted quantity in the target unit.',
      },
    ],
  };
}

/** A SECOND, distinct reference catalog (different tools) for replay-conflict evidence. */
export function conflictingCatalog(): unknown {
  return {
    schemaVersion: PROVIDER_CATALOG_VERSION,
    protocol: PROVIDER_PROTOCOL_NAME,
    tools: [
      {
        name: 'material_density_lookup',
        description: 'Looks up the bulk density of a named material (deterministic reference tool).',
        inputArguments: [
          { name: 'material', valueKind: 'string', required: true, description: 'The material name.' },
        ],
        outputSummary: 'The bulk density in kilograms per cubic meter.',
      },
    ],
  };
}

/** A malformed provider payload (unknown envelope version). */
export function malformedCatalog(): unknown {
  return { schemaVersion: 99, protocol: PROVIDER_PROTOCOL_NAME, tools: [] };
}
