// NAMED POSITIVE: the BOQ projection — the synthetic building fixture
// projects a COMPLETE BOQ (sections / line items / units / quantities /
// rates / amounts / totals / delivery links) with plan-line identity
// mapping, determinism, idempotency, and SN1.0 partial-data behavior.
import { describe, expect, it } from 'vitest';
import { projectBoq, verifyBoqView } from '../src/index';
import { warehouseChain } from './fixtures';

describe('NAMED POSITIVE: the building fixture projects a complete BOQ', () => {
  const chain = warehouseChain();
  const boq = projectBoq({
    solution: chain.solution,
    program: chain.program,
    acquisitions: chain.acquisitions,
    delivery: chain.delivery,
    worldEntities: chain.worldEntities,
  });

  it('projects seven line items (one per plan line — the BOQ mirrors the plan)', () => {
    expect(boq.ok).toBe(true);
    if (!boq.ok) return;
    expect(boq.value.lineItems).toHaveLength(7);
    expect(boq.value.title).toBe('Bill of quantities (BOQ)');
    expect(boq.value.programId).toBe('program:warehouse-extension-v1');
  });

  it('plan-line identity mapping: line ids are the SOLUTION line ids — never minted', () => {
    if (!boq.ok) return;
    const solutionLineIds = chain.solution.solutionLines.map((line) => line.lineId);
    const boqLineIds = boq.value.lineItems.map((item) => item.lineId);
    expect(boqLineIds).toEqual(solutionLineIds);
    for (const item of boq.value.lineItems) {
      const line = chain.solution.solutionLines.find(
        (candidate) => candidate.lineId === item.lineId,
      )!;
      expect(item.title).toBe(line.title);
      expect(item.unit).toBe(line.quantity.unit);
    }
  });

  it('sections group the lines by world-entity binding; unbound lines fall to preliminaries', () => {
    if (!boq.ok) return;
    expect(boq.value.sections.map((section) => section.sectionCode)).toEqual([
      'sec-element-foundations',
      'sec-element-frame',
      'sec-preliminaries',
      'sec-system-facade',
      'sec-zone-entrance',
    ]);
    const byCode = new Map(boq.value.sections.map((section) => [section.sectionCode, section]));
    expect(byCode.get('sec-element-foundations')?.concept).toBe('element');
    expect(byCode.get('sec-element-foundations')?.title).toBe('Building elements: element-foundations');
    expect(byCode.get('sec-system-facade')?.concept).toBe('system');
    expect(byCode.get('sec-zone-entrance')?.concept).toBe('zone');
    expect(byCode.get('sec-preliminaries')?.lineIds).toEqual(['line:preliminaries']);
    expect(byCode.get('sec-element-foundations')?.lineIds).toEqual([
      'line:bulk-excavation',
      'line:concrete-foundations',
    ]);
    // Every line item's section resolves; every section's lines exist.
    for (const item of boq.value.lineItems) {
      expect(byCode.get(item.sectionCode)?.lineIds).toContain(item.lineId);
    }
  });

  it('quantities derive through the measurement methods (net/gross/unmatched)', () => {
    if (!boq.ok) return;
    const byId = new Map(boq.value.lineItems.map((item) => [item.lineId, item]));
    expect(byId.get('line:bulk-excavation')?.quantity).toEqual({
      net: '120',
      gross: '124.8',
      measurementMethodId: 'construction.measure.volume',
      basis: 'gross',
    });
    expect(byId.get('line:facade-walls')?.quantity).toEqual({
      net: '240',
      gross: '264',
      measurementMethodId: 'construction.measure.area',
      basis: 'gross',
    });
    expect(byId.get('line:steel-frame')?.quantity.gross).toBe('4.12');
    expect(byId.get('line:door-sets')?.quantity.basis).toBe('net');
    expect(byId.get('line:door-sets')?.quantity.gross).toBeUndefined();
    expect(byId.get('line:preliminaries')?.quantity.basis).toBe('unmatched');
  });

  it('rates come from the plan unit costs and amounts are net × rate (exact decimals)', () => {
    if (!boq.ok) return;
    const byId = new Map(boq.value.lineItems.map((item) => [item.lineId, item]));
    expect(byId.get('line:bulk-excavation')?.rate).toEqual({ amount: '18.50', currency: 'EUR' });
    expect(byId.get('line:bulk-excavation')?.amount).toEqual({ amount: '2220', currency: 'EUR' });
    expect(byId.get('line:preliminaries')?.amount).toEqual({ amount: '12500', currency: 'EUR' });
    expect(boq.value.totals).toEqual([{ currency: 'EUR', totalAmount: '96370' }]);
    expect(boq.value.measurementMethodIds).toEqual([
      'construction.measure.area',
      'construction.measure.count',
      'construction.measure.mass',
      'construction.measure.volume',
    ]);
  });

  it('line items embed the derived delivery links (BOQ <-> procurement <-> execution)', () => {
    if (!boq.ok) return;
    const byId = new Map(boq.value.lineItems.map((item) => [item.lineId, item]));
    // Plan -> Realize: substructure work package realizes line:bulk-excavation.
    expect(byId.get('line:bulk-excavation')?.links.workPackageIds).toEqual([
      'work-package:substructure',
    ]);
    expect(byId.get('line:bulk-excavation')?.links.activityIds).toEqual([
      'activity:excavation-bulk',
      'activity:foundation-concrete',
    ]);
    // Acquire: the concrete supply request procures line:concrete-foundations.
    expect(byId.get('line:concrete-foundations')?.links.acquisitionRequestIds).toEqual([
      'acquisition:concrete-supply',
    ]);
    // Observe/Actualize: the facade measurement observation + actual anchor
    // the facade line (solution-line subject).
    expect(byId.get('line:facade-walls')?.links.observationIds).toEqual([
      'observation:facade-measurement',
    ]);
    expect(byId.get('line:facade-walls')?.links.actualIds).toEqual(['actual:facade-quantity']);
    // Work-package subjects resolve through the program index.
    expect(byId.get('line:steel-frame')?.links.observationIds).toEqual(['observation:steel-receipt']);
    expect(byId.get('line:steel-frame')?.links.actualIds).toEqual(['actual:steel-received']);
    // The decking acquisition line links without a realizing activity (partial links).
    expect(byId.get('line:floor-deck')?.links.acquisitionRequestIds).toEqual([
      'acquisition:steel-supply',
    ]);
    expect(byId.get('line:floor-deck')?.links.activityIds).toEqual([]);
    // The preliminaries line carries no links at all (empty, never a blocker).
    expect(byId.get('line:preliminaries')?.links).toEqual({
      workPackageIds: [],
      activityIds: [],
      acquisitionRequestIds: [],
      observationIds: [],
      actualIds: [],
    });
  });

  it('the view carries the tenant id of its inputs (tenant isolation on every record)', () => {
    if (!boq.ok) return;
    expect(boq.value.tenantId).toBe(chain.solution.tenantId);
    expect(boq.value.solutionId).toBe(chain.solution.solutionId);
    expect(boq.value.solutionVersion).toBe(chain.solution.version);
    expect(boq.value.solutionVersionDigest).toBe(chain.solution.contentDigest);
  });

  it('the BOQ view envelope verifies and round-trips through JSON', () => {
    if (!boq.ok) return;
    const verified = verifyBoqView(JSON.parse(JSON.stringify(boq.value)));
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(boq.value);
    }
  });
});

describe('NAMED POSITIVE: BOQ determinism + idempotency (recomputed on every call)', () => {
  const chain = warehouseChain();
  const inputs = {
    solution: chain.solution,
    program: chain.program,
    acquisitions: chain.acquisitions,
    delivery: chain.delivery,
    worldEntities: chain.worldEntities,
  };

  it('identical inputs yield the identical digest (replay)', () => {
    const first = projectBoq(inputs);
    const second = projectBoq(inputs);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value).toEqual(first.value);
      expect(second.value.contentDigest).toBe(first.value.contentDigest);
    }
  });

  it('the fold is invariant under acquisition-order permutation', () => {
    const forward = projectBoq(inputs);
    const permuted = projectBoq({
      ...inputs,
      acquisitions: [...inputs.acquisitions].reverse(),
    });
    if (forward.ok && permuted.ok) {
      expect(permuted.value.contentDigest).toBe(forward.value.contentDigest);
    } else {
      expect(forward.ok).toBe(true);
      expect(permuted.ok).toBe(true);
    }
  });

  it('mutating a returned view NEVER affects the next projection (no stored state)', () => {
    const first = projectBoq(inputs);
    if (!first.ok) return;
    const mutated = first.value as unknown as Record<string, unknown>;
    mutated.lineItems = [];
    const second = projectBoq(inputs);
    if (second.ok) {
      expect(second.value.lineItems).toHaveLength(7);
      expect(second.value.contentDigest).toBe(first.value.contentDigest);
    }
  });
});

describe('NAMED POSITIVE: SN1.0 partial-data behavior (missing inputs are never blockers)', () => {
  const chain = warehouseChain();

  it('a solution alone projects a complete BOQ with empty links and no programId', () => {
    const boq = projectBoq({ solution: chain.solution });
    expect(boq.ok).toBe(true);
    if (boq.ok) {
      expect(boq.value.lineItems).toHaveLength(7);
      expect(boq.value.programId).toBeUndefined();
      expect(boq.value.totals).toEqual([{ currency: 'EUR', totalAmount: '96370' }]);
      for (const item of boq.value.lineItems) {
        expect(item.links.activityIds).toEqual([]);
        expect(item.links.acquisitionRequestIds).toEqual([]);
      }
    }
  });

  it('missing world entities still section the lines (concept-less works sections)', () => {
    const boq = projectBoq({ solution: chain.solution });
    if (boq.ok) {
      const facade = boq.value.sections.find((section) => section.sectionCode === 'sec-system-facade');
      expect(facade?.title).toBe('Works: system-facade');
      expect(facade?.concept).toBeUndefined();
    }
  });

  it('a program without acquisitions/delivery links only the realizing activities', () => {
    const boq = projectBoq({ solution: chain.solution, program: chain.program });
    if (boq.ok) {
      const byId = new Map(boq.value.lineItems.map((item) => [item.lineId, item]));
      expect(byId.get('line:bulk-excavation')?.links.activityIds).toHaveLength(2);
      expect(byId.get('line:concrete-foundations')?.links.acquisitionRequestIds).toEqual([]);
      expect(boq.value.programId).toBe('program:warehouse-extension-v1');
    }
  });
});
