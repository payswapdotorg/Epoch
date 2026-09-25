// Tenant isolation (negative — R12): cross-tenant projection is denied
// with typed `cross-tenant-denied` errors everywhere a tenant boundary can
// be crossed: envelope scope vs. caller expectation, projected inputs,
// node references, and projection-request references.
import { describe, expect, it } from 'vitest';
import { parseExperienceGraph, parseProjectionRequest, sealExperienceGraph } from '../src/index';
import {
  TENANT_A,
  TENANT_B,
  expectFailure,
  graphContent,
  projectionRequest,
  sealedGraph,
} from './fixtures';
import type { ExperienceGraph, ProjectionRequest } from '../src/index';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('tenant gate (negative — cross-tenant projections are denied)', () => {
  it('rejects a graph from another tenant against the expected-tenant option', () => {
    const error = expectFailure(
      parseExperienceGraph(sealedGraph('2d'), { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    expect(error).toMatchObject({
      expectedTenantId: TENANT_B,
      encounteredTenantId: TENANT_A,
    });
    expect(error.path).toEqual(['tenantScope', 'tenantId']);
  });

  it('rejects a projected input that belongs to another tenant', () => {
    const content = graphContent('2d');
    (content.projectedFrom[1] as { tenantId: string }).tenantId = TENANT_B;
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const error = expectFailure(parseExperienceGraph(sealed.value), 'cross-tenant-denied');
    expect(error.path).toEqual(['projectedFrom', 1, 'tenantId']);
    expect(error.encounteredTenantId).toBe(TENANT_B);
  });

  it('rejects a node reference that belongs to another tenant', () => {
    const content = graphContent('2d');
    const shape = content.nodes[1];
    if (shape.kind !== 'shape-2d' || shape.ref === undefined) throw new Error('fixture');
    shape.ref.tenantId = TENANT_B;
    // The ref must still resolve against projectedFrom for the resolvability
    // gate, so the forged ref targets a same-identity object of tenant B.
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const error = expectFailure(parseExperienceGraph(sealed.value), 'cross-tenant-denied');
    expect(error.path).toEqual(['nodes', 1, 'ref', 'tenantId']);
  });

  it('rejects a whole envelope re-scoped to another tenant after sealing (digest + tenant gates)', () => {
    const graph = clone(sealedGraph('3d')) as ExperienceGraph;
    graph.tenantScope = { tenantId: TENANT_B };
    // The digest breaks first (fixed precedence), proving the envelope is
    // tamper-evident even before the tenant comparison runs.
    expectFailure(parseExperienceGraph(graph), 'digest-mismatch');
  });

  it('rejects a projection request whose references cross the tenant scope', () => {
    const request = clone(projectionRequest('2d')) as ProjectionRequest;
    (request.references[1] as { tenantId: string }).tenantId = TENANT_B;
    const error = expectFailure(parseProjectionRequest(request), 'cross-tenant-denied');
    expect(error.path).toEqual(['references', 1, 'tenantId']);
    expect(error).toMatchObject({
      expectedTenantId: TENANT_A,
      encounteredTenantId: TENANT_B,
    });
  });

  it('rejects a projection request from another tenant against the expected-tenant option', () => {
    const error = expectFailure(
      parseProjectionRequest(projectionRequest('2d'), { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    expect(error.path).toEqual(['tenantScope', 'tenantId']);
  });

  it('same-tenant admission still passes with the expected-tenant option set', () => {
    const graph = parseExperienceGraph(sealedGraph('presence'), {
      expectedTenantId: TENANT_A,
    });
    expect(graph.ok).toBe(true);
    const request = parseProjectionRequest(projectionRequest('presence'), {
      expectedTenantId: TENANT_A,
    });
    expect(request.ok).toBe(true);
  });
});
