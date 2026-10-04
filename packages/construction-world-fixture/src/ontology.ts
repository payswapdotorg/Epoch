/**
 * @epoch/construction-world-fixture — the ontology (W071, ACR-012).
 *
 * The pack-contributed W016 WorldOntology records the fixture registers
 * (the W061 precedent): one `representation-3d` record per primitive
 * shape used by the construction entities. The records reuse the existing
 * `pack-construction` contributor (frozen pack — consume as-is). NO new
 * pack, NO new ontology authority, NO new record kinds.
 */
import {
  registerOntologyRecords,
  type WorldOntology,
  type WorldOntologyRecord,
} from '@epoch/world-experience';
import { TENANT } from './version';

// ---------------------------------------------------------------------------
// The ontology records (the W016 representation-3d vocabulary, the W061
// pattern — one record per primitive the construction entities use).
// ---------------------------------------------------------------------------

const ONTOLOGY_RECORDS: readonly WorldOntologyRecord[] = [
  {
    ontologyVersion: 1,
    recordId: 'ont-cs-rep-box',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: [
      'envelope:door',
      'envelope:roof',
      'envelope:wall',
      'envelope:window',
      'finishes:fixture',
      'finishes:paint',
      'foundation:base',
      'foundation:strip',
      'mep:duct',
      'mep:panel',
      'mep:unit',
      'site:access',
      'site:boundary',
      'site:excavation',
      'structure:beam',
      'structure:column',
      'structure:roof',
    ],
    primitive: 'box',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-cs-rep-cylinder',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: ['mep:conduit', 'mep:pipe', 'mep:riser'],
    primitive: 'cylinder',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-cs-rep-plane',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: ['finishes:ceiling', 'finishes:floor', 'foundation:slab', 'site:staging'],
    primitive: 'plane',
  },
];

/** The sealed ontology of the construction-solution fixture. */
export const ONTOLOGY: WorldOntology = (() => {
  const registered = registerOntologyRecords({ records: [] }, [...ONTOLOGY_RECORDS]);
  if (!registered.ok) {
    throw new Error(
      `construction-solution fixture ontology failed registration: ${registered.error.message}`,
    );
  }
  return registered.value;
})();

/** The ontology records (re-exported for host evidence). */
export const ONTOLOGY_RECORDS_FROZEN: readonly WorldOntologyRecord[] = ONTOLOGY_RECORDS;
