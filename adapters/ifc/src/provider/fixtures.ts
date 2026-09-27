/**
 * @epoch/adapter-ifc — reference provider fixtures (the standard's
 * vocabulary allowed HERE only; the W020/W022 reference precedent: no
 * live parsers, fixtures stand in for provider payloads).
 *
 * Fixtures are DETERMINISTIC constructors: identical calls produce
 * byte-identical payloads, so ingestion digests and projections replay
 * identically (pinned by the determinism tests).
 */
import { PROVIDER_MODEL_VERSION, PROVIDER_STANDARD_NAME } from './payload';

/** A stable instant used by the reference fixtures (no wall-clock reads). */
export const FIXTURE_INSTANT = '2026-03-01T09:00:00.000Z' as const;

/** The canonical file name of the reference fixture. */
export const FIXTURE_MODEL_NAME = 'epoch-reference-building' as const;

/**
 * The canonical reference model: a site -> building -> storey spatial
 * aggregation, one storey containing a wall, a slab, a door and a
 * window, plus a space, with typed properties.
 */
export function referenceModel(): unknown {
  return {
    schemaVersion: PROVIDER_MODEL_VERSION,
    standard: PROVIDER_STANDARD_NAME,
    schemaIdentifier: 'IFC4',
    file: { name: FIXTURE_MODEL_NAME },
    elements: [
      {
        ref: '#1',
        entityClass: 'IfcSite',
        name: 'Reference Site',
        properties: { latitude: 52.5, longitude: 13.4 },
      },
      {
        ref: '#2',
        entityClass: 'IfcBuilding',
        name: 'Reference Building',
        properties: { floorsAboveGround: 1 },
      },
      { ref: '#3', entityClass: 'IfcBuildingStorey', name: 'Ground Floor', properties: { elevation: 0 } },
      { ref: '#10', entityClass: 'IfcWall', name: 'Exterior Wall North', properties: { thickness: 300 } },
      { ref: '#11', entityClass: 'IfcSlab', name: 'Ground Slab', properties: { depth: 250 } },
      { ref: '#12', entityClass: 'IfcDoor', name: 'Entrance Door', properties: { width: 1000 } },
      { ref: '#13', entityClass: 'IfcWindow', name: 'North Window', properties: { area: 1.5 } },
      { ref: '#20', entityClass: 'IfcSpace', name: 'Entrance Hall', properties: { area: 40 } },
    ],
    relations: [
      { relationClass: 'IfcRelAggregates', relating: '#1', related: ['#2'] },
      { relationClass: 'IfcRelAggregates', relating: '#2', related: ['#3'] },
      {
        relationClass: 'IfcRelContainedInSpatialStructure',
        relating: '#3',
        related: ['#10', '#11', '#12', '#13'],
      },
      { relationClass: 'IfcRelContainedInSpatialStructure', relating: '#3', related: ['#20'] },
    ],
  };
}

/**
 * A SECOND, distinct reference model (different elements) for
 * replay-conflict evidence: same model identity, different content.
 */
export function conflictingModel(): unknown {
  return {
    schemaVersion: PROVIDER_MODEL_VERSION,
    standard: PROVIDER_STANDARD_NAME,
    schemaIdentifier: 'IFC4',
    file: { name: FIXTURE_MODEL_NAME },
    elements: [
      { ref: '#1', entityClass: 'IfcSite', name: 'Divergent Site', properties: {} },
      { ref: '#2', entityClass: 'IfcBuilding', name: 'Divergent Building', properties: {} },
    ],
    relations: [{ relationClass: 'IfcRelAggregates', relating: '#1', related: ['#2'] }],
  };
}

/** A malformed provider payload (unknown envelope version). */
export function malformedModel(): unknown {
  return { schemaVersion: 99, standard: PROVIDER_STANDARD_NAME, file: {}, elements: [] };
}

/** A payload whose relation references an element that is absent (malformed). */
export function danglingRelationModel(): unknown {
  return {
    schemaVersion: PROVIDER_MODEL_VERSION,
    standard: PROVIDER_STANDARD_NAME,
    schemaIdentifier: 'IFC4',
    file: { name: FIXTURE_MODEL_NAME },
    elements: [{ ref: '#1', entityClass: 'IfcSite', name: 'Dangling Site', properties: {} }],
    relations: [{ relationClass: 'IfcRelAggregates', relating: '#1', related: ['#99'] }],
  };
}

/** A structurally valid model with NO spatial root (semantically incomplete). */
export function incompleteModel(): unknown {
  return {
    schemaVersion: PROVIDER_MODEL_VERSION,
    standard: PROVIDER_STANDARD_NAME,
    schemaIdentifier: 'IFC4',
    file: { name: 'epoch-rootless-model' },
    elements: [
      { ref: '#10', entityClass: 'IfcWall', name: 'Rootless Wall', properties: {} },
      { ref: '#11', entityClass: 'IfcSlab', name: 'Rootless Slab', properties: {} },
    ],
    relations: [],
  };
}
