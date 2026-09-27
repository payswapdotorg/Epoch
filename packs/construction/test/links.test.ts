// NAMED POSITIVE: the delivery-link index — BOQ <-> procurement <->
// execution as projections of the universal Plan/Acquire/Realize state,
// linked BY TYPED REFERENCE to the canonical ids.
import { describe, expect, it } from 'vitest';
import { foldDeliveryLinks } from '../src/index';
import { warehouseChain } from './fixtures';

describe('NAMED POSITIVE: the derived delivery-link index', () => {
  const chain = warehouseChain();
  const links = foldDeliveryLinks({
    solution: chain.solution,
    program: chain.program,
    acquisitions: chain.acquisitions,
    delivery: chain.delivery,
  });

  it('folds one row per linked plan line, sorted by solutionLineId', () => {
    expect(links.ok).toBe(true);
    if (!links.ok) return;
    expect(links.value.rows.map((row) => row.solutionLineId)).toEqual([
      'line:bulk-excavation',
      'line:concrete-foundations',
      'line:door-sets',
      'line:facade-walls',
      'line:floor-deck',
      'line:steel-frame',
    ]);
  });

  it('every referenced id is a CANONICAL id of the sealed inputs (identity, never minted)', () => {
    if (!links.ok) return;
    const activityIds = new Set(
      chain.program.workPackages.flatMap((workPackage) =>
        workPackage.activities.map((activity) => activity.activityId),
      ),
    );
    const workPackageIds = new Set(chain.program.workPackages.map((workPackage) => workPackage.workPackageId));
    const acquisitionIds = new Set(chain.acquisitions.map((request) => request.acquisitionId));
    const observationIds = new Set(chain.delivery.observations.map((record) => record.recordId));
    const actualIds = new Set(chain.delivery.actuals.map((record) => record.recordId));
    for (const row of links.value.rows) {
      for (const id of row.activityIds) expect(activityIds.has(id), id).toBe(true);
      for (const id of row.workPackageIds) expect(workPackageIds.has(id), id).toBe(true);
      for (const id of row.acquisitionRequestIds) expect(acquisitionIds.has(id), id).toBe(true);
      for (const id of row.observationIds) expect(observationIds.has(id), id).toBe(true);
      for (const id of row.actualIds) expect(actualIds.has(id), id).toBe(true);
    }
  });

  it('Plan -> Realize: the substructure package links its two activities to its plan line', () => {
    if (!links.ok) return;
    const row = links.value.rows.find((candidate) => candidate.solutionLineId === 'line:bulk-excavation')!;
    expect(row.workPackageIds).toEqual(['work-package:substructure']);
    expect(row.activityIds).toEqual(['activity:excavation-bulk', 'activity:foundation-concrete']);
  });

  it('Acquire: the concrete and steel requests link to their procured plan lines', () => {
    if (!links.ok) return;
    const concrete = links.value.rows.find(
      (candidate) => candidate.solutionLineId === 'line:concrete-foundations',
    )!;
    expect(concrete.acquisitionRequestIds).toEqual(['acquisition:concrete-supply']);
    expect(concrete.activityIds).toEqual([]);
    const steel = links.value.rows.find((candidate) => candidate.solutionLineId === 'line:steel-frame')!;
    expect(steel.acquisitionRequestIds).toEqual(['acquisition:steel-supply']);
    const deck = links.value.rows.find((candidate) => candidate.solutionLineId === 'line:floor-deck')!;
    expect(deck.acquisitionRequestIds).toEqual(['acquisition:steel-supply']);
  });

  it('internal-allocation acquisitions carry no plan-line links (variant has no lines)', () => {
    if (!links.ok) return;
    const flat = links.value.rows.flatMap((row) => row.acquisitionRequestIds);
    expect(flat).not.toContain('acquisition:site-plant');
  });

  it('Observe/Actualize: observations and actuals link by subject (line, work package, activity)', () => {
    if (!links.ok) return;
    const facade = links.value.rows.find((candidate) => candidate.solutionLineId === 'line:facade-walls')!;
    expect(facade.observationIds).toEqual(['observation:facade-measurement']);
    expect(facade.actualIds).toEqual(['actual:facade-quantity']);
    const steel = links.value.rows.find((candidate) => candidate.solutionLineId === 'line:steel-frame')!;
    expect(steel.observationIds).toEqual(['observation:steel-receipt']);
    expect(steel.actualIds).toEqual(['actual:steel-received']);
    const bulk = links.value.rows.find((candidate) => candidate.solutionLineId === 'line:bulk-excavation')!;
    expect(bulk.observationIds).toEqual(['observation:excavation-progress']);
    expect(bulk.actualIds).toEqual(['actual:excavation-quantity']);
  });

  it('milestone-subject observations do not resolve to plan lines (skipped, not a blocker)', () => {
    if (!links.ok) return;
    const flat = links.value.rows.flatMap((row) => row.observationIds);
    expect(flat).not.toContain('observation:milestone-check');
  });

  it('the index carries the tenant/solution of its inputs and round-trips through JSON', () => {
    if (!links.ok) return;
    expect(links.value.tenantId).toBe(chain.solution.tenantId);
    expect(links.value.solutionId).toBe(chain.solution.solutionId);
    expect(links.value.deliveryId).toBe(chain.delivery.deliveryId);
    expect(JSON.parse(JSON.stringify(links.value))).toEqual(links.value);
  });

  it('identical inputs yield the identical digest (replay)', () => {
    const second = foldDeliveryLinks({
      solution: chain.solution,
      program: chain.program,
      acquisitions: chain.acquisitions,
      delivery: chain.delivery,
    });
    if (links.ok && second.ok) {
      expect(second.value).toEqual(links.value);
    } else {
      expect(links.ok).toBe(true);
      expect(second.ok).toBe(true);
    }
  });

  it('the fold is invariant under input-order permutation (acquisitions reversed)', () => {
    const permuted = foldDeliveryLinks({
      solution: chain.solution,
      program: chain.program,
      acquisitions: [...chain.acquisitions].reverse(),
      delivery: chain.delivery,
    });
    if (links.ok && permuted.ok) {
      expect(permuted.value.contentDigest).toBe(links.value.contentDigest);
    } else {
      expect(links.ok).toBe(true);
      expect(permuted.ok).toBe(true);
    }
  });

  it('SN1.0: a solution alone folds an EMPTY index (no rows, never a blocker)', () => {
    const empty = foldDeliveryLinks({ solution: chain.solution });
    expect(empty.ok).toBe(true);
    if (empty.ok) {
      expect(empty.value.rows).toEqual([]);
      expect(empty.value.deliveryId).toBeUndefined();
      expect(empty.value.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
