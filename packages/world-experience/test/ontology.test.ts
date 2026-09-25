// Domain visual ontology: record validation per kind (positive), unknown
// discriminators and unresolvable ids (negative), and registry behavior.
import { describe, expect, it } from 'vitest';
import {
  admitOntologyRecord,
  computeOntologyUsage,
  emptyOntology,
  ontologyRecordsForEntityType,
  registerOntologyRecords,
  resolveOntologyRecord,
  resolveOntologyRecordOfKind,
} from '../src/ontology';
import { WORLD_ONTOLOGY_RECORD_KINDS } from '../src/version';
import {
  AFFORDANCE_WALL,
  MATERIAL_CONCRETE,
  REPRESENTATION_BOX,
  REPRESENTATION_SPHERE,
  STATE_OVERLAY_DAMAGED,
  SYMBOL_PLAN,
  TENANT_B,
  deepClone,
  expectFailure,
  referenceOntology,
} from './fixtures';

describe('ontology records (positive)', () => {
  it('the closed vocabulary is the six pinned kinds', () => {
    expect(WORLD_ONTOLOGY_RECORD_KINDS).toEqual([
      'affordance',
      'animation',
      'material',
      'representation-3d',
      'state-overlay',
      'symbol-2d',
    ]);
  });

  it.each(
    [
      ['representation-3d', REPRESENTATION_BOX],
      ['representation-3d (mesh)', REPRESENTATION_SPHERE],
      ['material', MATERIAL_CONCRETE],
      ['symbol-2d', SYMBOL_PLAN],
      ['state-overlay', STATE_OVERLAY_DAMAGED],
      ['affordance', AFFORDANCE_WALL],
    ] as const,
  )('admits a valid %s record', (_label, record) => {
    const admitted = admitOntologyRecord(deepClone(record));
    expect(admitted.ok, JSON.stringify(admitted)).toBe(true);
  });

  it('registers records in deterministic recordId order', () => {
    const ontology = referenceOntology();
    expect(ontology.records.map((r) => r.recordId)).toEqual([
      'ont-aff-wall',
      'ont-mat-concrete',
      'ont-rep-box',
      'ont-rep-sphere',
      'ont-state-damaged',
      'ont-sym-plan',
    ]);
  });

  it('resolves a record by id and by kind', () => {
    const ontology = referenceOntology();
    const resolved = resolveOntologyRecord(ontology, 'ont-rep-box');
    expect(resolved.ok).toBe(true);
    const byKind = resolveOntologyRecordOfKind(ontology, 'ont-rep-box', 'representation-3d');
    expect(byKind.ok).toBe(true);
  });

  it('kind-mismatched resolution is a typed rejection', () => {
    const ontology = referenceOntology();
    expectFailure(resolveOntologyRecordOfKind(ontology, 'ont-rep-box', 'material'), 'unknown-ontology-record');
  });

  it('lists the records applying to one entity type', () => {
    const ontology = referenceOntology();
    const forWall = ontologyRecordsForEntityType(ontology, 'arch:wall');
    expect(forWall.map((r) => r.recordId)).toEqual([
      'ont-aff-wall',
      'ont-rep-box',
      'ont-state-damaged',
      'ont-sym-plan',
    ]);
  });

  it('computes the ontology usage record', () => {
    const usage = computeOntologyUsage(referenceOntology());
    expect(usage).toEqual({
      recordCount: 6,
      symbolCount: 1,
      representationCount: 2,
      materialCount: 1,
      stateOverlayCount: 1,
      animationCount: 0,
      affordanceCount: 1,
    });
  });

  it('a mesh primitive without a mesh binding is malformed', () => {
    const broken = deepClone(REPRESENTATION_BOX);
    broken.primitive = 'mesh';
    expectFailure(admitOntologyRecord(broken), 'malformed-record');
  });

  it('a mesh binding on a non-mesh primitive is malformed', () => {
    const broken = deepClone(REPRESENTATION_BOX);
    broken.mesh = {
      assetDigest: 'b'.repeat(64),
      byteSize: 1024,
      mediaType: 'application/octet-stream',
    };
    expectFailure(admitOntologyRecord(broken), 'malformed-record');
  });

  it('unsorted affordance interactions are malformed (deterministic sets)', () => {
    const broken = deepClone(AFFORDANCE_WALL);
    broken.interactions = ['select', 'measure', 'inspect'];
    expectFailure(admitOntologyRecord(broken), 'malformed-record');
  });
});

describe('ontology records (negative)', () => {
  it('an unknown discriminator is rejected with unknown-ontology-record (distinguishable from malformed)', () => {
    const failure = expectFailure(
      admitOntologyRecord({
        ontologyVersion: 1,
        recordId: 'ont-unknown-kind',
        recordKind: 'hologram',
        tenantScope: { tenantId: 'tenant-alpha' },
        contributor: { packId: 'pack-x' },
        appliesTo: ['arch:wall'],
      }),
      'unknown-ontology-record',
    );
    expect(failure.discriminator).toBe('hologram');
  });

  it('an unresolvable record id is a typed unknown-ontology-record rejection', () => {
    const failure = expectFailure(
      resolveOntologyRecord(referenceOntology(), 'ont-missing-record'),
      'unknown-ontology-record',
    );
    expect(failure.recordId).toBe('ont-missing-record');
  });

  it('duplicate record ids are rejected at registration', () => {
    const registered = registerOntologyRecords(emptyOntology(), [REPRESENTATION_BOX]);
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    const duplicate = registerOntologyRecords(registered.value, [deepClone(REPRESENTATION_BOX)]);
    expectFailure(duplicate, 'malformed-record');
  });

  it('ontology version skew fails fast with version-unsupported', () => {
    const broken = deepClone(REPRESENTATION_BOX);
    (broken as { ontologyVersion: number }).ontologyVersion = 2;
    expectFailure(admitOntologyRecord(broken), 'version-unsupported');
  });

  it('strict objects reject unknown vendor fields on records', () => {
    const broken = deepClone(REPRESENTATION_BOX);
    (broken as Record<string, unknown>).vendorEngine = 'babylonjs';
    expectFailure(admitOntologyRecord(broken), 'malformed-record');
  });

  it('a cross-tenant record is admitted structurally but flagged by hosts via scope comparison', () => {
    // Ontology admission is structural (records are declarative data);
    // tenant isolation of SCENE access is the scene admission's duty
    // (R12) — the record carries its scope for the host to gate.
    const foreign = deepClone(REPRESENTATION_BOX);
    foreign.tenantScope = { tenantId: TENANT_B };
    const admitted = admitOntologyRecord(foreign);
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.tenantScope.tenantId).toBe(TENANT_B);
    }
  });
});
