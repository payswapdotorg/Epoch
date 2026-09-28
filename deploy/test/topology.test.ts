/**
 * W033 evidence — TOPOLOGY: determinism, malformed rejection, tenant
 * isolation, tamper detection, round-trip.
 */
import { describe, expect, it } from 'vitest';
import {
  admitTopologyRevision,
  buildTopologyRevision,
  componentContent,
  deserializeTopologyRevision,
  sealComponent,
  sealEnvironment,
  sealPlacement,
  sealWiring,
  serializeTopologyRevision,
  verifyTopologyDigest,
  unwrapOrThrow,
} from '@epoch/deploy-model';
import type { ComponentRecord, EnvironmentRecord, PlacementRecord, WiringRecord } from '@epoch/deploy-model';
import {
  DEPLOYER,
  REFERENCE_COMPONENTS,
  REFERENCE_ENVIRONMENTS,
  REFERENCE_PLACEMENTS,
  REFERENCE_WIRING,
  RELEASE_MANAGER,
  REV_A,
  TENANT_FIELD,
  TENANT_LABS,
  T1,
  T2,
  provenanceOf,
  referenceTopology,
} from './helpers';

const sealedReference = () => ({
  components: REFERENCE_COMPONENTS.map((content) => unwrapOrThrow(sealComponent(content))),
  environments: REFERENCE_ENVIRONMENTS.map((content) => unwrapOrThrow(sealEnvironment(content))),
  placements: REFERENCE_PLACEMENTS.map((content) => unwrapOrThrow(sealPlacement(content))),
  wiring: REFERENCE_WIRING.map((content) => unwrapOrThrow(sealWiring(content))),
});

const buildWith = (overrides: {
  components?: readonly ComponentRecord[];
  environments?: readonly EnvironmentRecord[];
  placements?: readonly PlacementRecord[];
  wiring?: readonly WiringRecord[];
  sequence?: number;
}) => {
  const base = sealedReference();
  return buildTopologyRevision({
    topologyId: 'topo:epoch-reference',
    sequence: overrides.sequence ?? 1,
    components: overrides.components ?? base.components,
    environments: overrides.environments ?? base.environments,
    placements: overrides.placements ?? base.placements,
    wiring: overrides.wiring ?? base.wiring,
    provenance: provenanceOf(RELEASE_MANAGER, 'catalog-topology', T2),
  });
};

describe('topology determinism', () => {
  it('topology-digest-order-independent: identical records in ANY input order seal to the identical digest (byte-compare)', () => {
    const a = unwrapOrThrow(buildWith({}));
    const base = sealedReference();
    const b = unwrapOrThrow(
      buildTopologyRevision({
        topologyId: 'topo:epoch-reference',
        sequence: 1,
        components: [...base.components].reverse(),
        environments: [...base.environments].reverse(),
        placements: [...base.placements].reverse(),
        wiring: [...base.wiring].reverse(),
        provenance: provenanceOf(RELEASE_MANAGER, 'catalog-topology', T2),
      }),
    );
    expect(b.digest).toBe(a.digest);
    expect(serializeTopologyRevision(b)).toBe(serializeTopologyRevision(a));
  });

  it('topology-sequence-advances-digest: a new revision of the same topology name seals a different digest', () => {
    const one = unwrapOrThrow(buildWith({}));
    const two = unwrapOrThrow(buildWith({ sequence: 2 }));
    expect(two.digest).not.toBe(one.digest);
    expect(two.sequence).toBe(2);
  });

  it('topology-round-trip-digest-verified: serialize -> deserialize verifies digests and round-trips byte-identically', () => {
    const topology = referenceTopology();
    const text = serializeTopologyRevision(topology);
    const restored = unwrapOrThrow(deserializeTopologyRevision(text));
    expect(restored.digest).toBe(topology.digest);
    expect(serializeTopologyRevision(restored)).toBe(text);
    expect(unwrapOrThrow(verifyTopologyDigest(restored)).digest).toBe(topology.digest);
  });
});

describe('malformed topology rejected (typed)', () => {
  it('malformed-topology-rejected: unknown dependency target', () => {
    const base = sealedReference();
    const mutant = base.components.map((record) =>
      record.componentId === 'cmp:web-app'
        ? unwrapOrThrow(
            sealComponent({
              ...componentContent(record),
              dependsOn: ['cmp:nonexistent'],
              provenance: provenanceOf(DEPLOYER, 'tamper', T1),
            }),
          )
        : record,
    );
    const result = buildWith({ components: mutant });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknown-component');
  });

  it('malformed-topology-rejected: dependency cycle', () => {
    const base = sealedReference();
    const resealed = base.components.map((record) => {
      if (record.componentId === 'cmp:agent-protocol') {
        return unwrapOrThrow(
          sealComponent({
            ...componentContent(record),
            dependsOn: ['cmp:tenancy'], // agent-protocol <-> tenancy cycle
            provenance: provenanceOf(DEPLOYER, 'tamper', T1),
          }),
        );
      }
      return record;
    });
    const result = buildWith({ components: resealed });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('dependency-cycle');
  });

  it('malformed-topology-rejected: duplicate component id', () => {
    const base = sealedReference();
    const result = buildWith({ components: [...base.components, base.components[0]!] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('duplicate-record');
  });

  it('malformed-topology-rejected: placement in an unknown environment', () => {
    const base = sealedReference();
    const stray = unwrapOrThrow(
      sealPlacement({
        recordVersion: 1,
        environmentId: 'env:nonexistent',
        componentId: 'cmp:web-app',
        revision: REV_A,
        tenantId: TENANT_LABS,
        provenance: provenanceOf(DEPLOYER, 'tamper', T1),
      }),
    );
    const result = buildWith({ placements: [...base.placements, stray] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknown-environment');
  });

  it('malformed-topology-rejected: wiring endpoint not placed in the wiring environment', () => {
    const base = sealedReference();
    // env:staging carries only agent-protocol + tenancy; wire web-app there.
    const stray = unwrapOrThrow(
      sealWiring({
        recordVersion: 1,
        environmentId: 'env:staging',
        fromComponentId: 'cmp:web-app',
        toComponentId: 'cmp:tenancy',
        provenance: provenanceOf(DEPLOYER, 'tamper', T1),
      }),
    );
    const result = buildWith({ wiring: [...base.wiring, stray] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('wiring-environment-mismatch');
  });

  it('malformed-topology-rejected: unknown structural field (strict objects)', () => {
    const result = admitTopologyRevision({
      ...referenceTopology(),
      cloudRegion: 'not-a-field',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation');
  });
});

describe('tenant isolation on environment-scoped records (R12)', () => {
  it('cross-tenant-placement-rejected: a placement owned by a tenant outside the environment scope', () => {
    const base = sealedReference();
    // env:dev carries ONLY tenant:epoch-labs; place for the field tenant.
    const stray = unwrapOrThrow(
      sealPlacement({
        recordVersion: 1,
        environmentId: 'env:dev',
        componentId: 'cmp:web-app',
        revision: REV_A,
        tenantId: TENANT_FIELD,
        provenance: provenanceOf(DEPLOYER, 'tamper', T1),
      }),
    );
    const result = buildWith({ placements: [...base.placements, stray] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('cross-tenant-placement-rejected');
      expect(result.error.message).toContain(TENANT_FIELD);
    }
  });

  it('cross-tenant-wiring-rejected: a wiring edge across two tenants inside one environment', () => {
    const base = sealedReference();
    // In multi-tenant prod: pack-construction (field) -> web-app (labs).
    const stray = unwrapOrThrow(
      sealWiring({
        recordVersion: 1,
        environmentId: 'env:prod',
        fromComponentId: 'cmp:pack-construction',
        toComponentId: 'cmp:web-app',
        provenance: provenanceOf(DEPLOYER, 'tamper', T1),
      }),
    );
    const result = buildWith({ wiring: [...base.wiring, stray] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cross-tenant-wiring-rejected');
  });
});

describe('tamper detection', () => {
  it('tampered-child-digest-rejected: a mutated child record fails its digest check at build time', () => {
    const base = sealedReference();
    const tampered: ComponentRecord = {
      ...base.components[0]!,
      name: 'Agent Protocol (renamed after sealing)',
    };
    const result = buildWith({ components: [tampered, ...base.components.slice(1)] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('digest-mismatch');
  });

  it('tampered-topology-digest-rejected: a mutated revision fails admission with digest-mismatch', () => {
    const topology = referenceTopology();
    const tampered = { ...topology, sequence: 999 };
    const result = admitTopologyRevision(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('digest-mismatch');
  });
});
