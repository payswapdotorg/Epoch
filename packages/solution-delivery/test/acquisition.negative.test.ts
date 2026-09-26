// NAMED NEGATIVES (acquisition): dangling request references;
// cross-tenant fulfillment; double fulfillment; vendor fields; malformed
// variant details.
import { describe, expect, it } from 'vitest';
import { admitAcquisitionFulfillment, admitAcquisitionRequest } from '../src/index';
import { PRINCIPAL, T1, T3, TENANT, OTHER_TENANT } from './fixtures';

function procurementRequest(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'epoch.solution-delivery.acquisition-request',
    schemaVersion: 1,
    acquisitionId: 'acquisition:steel-supply',
    tenantId: TENANT,
    solutionId: 'solution:tower-retrofit',
    detail: {
      variant: 'external-procurement',
      lines: [
        { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' },
      ],
    },
    requestedAt: T1,
    requestedBy: PRINCIPAL,
    ...overrides,
  };
}

function fulfillment(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'epoch.solution-delivery.acquisition-fulfillment',
    schemaVersion: 1,
    fulfillmentId: 'fulfillment:steel-1',
    tenantId: TENANT,
    acquisitionId: 'acquisition:steel-supply',
    fulfilledAt: T3,
    fulfilledBy: PRINCIPAL,
    ...overrides,
  };
}

describe('NAMED NEGATIVE: dangling request (dangling-reference-rejected)', () => {
  it('fulfilling an unknown request is rejected', () => {
    const result = admitAcquisitionFulfillment([], [], fulfillment());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('dangling-reference-rejected');
      if (result.error.code === 'dangling-reference-rejected') {
        expect(result.error.referenceKind).toBe('acquisition-request');
      }
    }
  });
});

describe('NAMED NEGATIVE: cross-tenant fulfillment (cross-tenant-denied)', () => {
  it('a fulfillment from another tenant is rejected', () => {
    const request = admitAcquisitionRequest(procurementRequest());
    expect(request.ok).toBe(true);
    if (!request.ok) return;
    const result = admitAcquisitionFulfillment([request.value], [], fulfillment({ tenantId: OTHER_TENANT }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('cross-tenant-denied');
    }
  });
});

describe('NAMED NEGATIVE: double fulfillment (version-conflict)', () => {
  it('a request fulfills exactly once', () => {
    const request = admitAcquisitionRequest(procurementRequest());
    if (!request.ok) return;
    const first = admitAcquisitionFulfillment([request.value], [], fulfillment());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = admitAcquisitionFulfillment(
      [request.value],
      first.value,
      fulfillment({ fulfillmentId: 'fulfillment:steel-2' }),
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe('version-conflict');
    }
  });
});

describe('NAMED NEGATIVE: vendor fields and malformed details', () => {
  it('vendor fields on an acquisition request are rejected', () => {
    const result = admitAcquisitionRequest(
      procurementRequest({ sapPurchaseOrder: 'PO-123' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('vendor-fields-rejected');
    }
  });

  it('an external-procurement line carrying a vendor brand field is rejected', () => {
    const result = admitAcquisitionRequest(
      procurementRequest({
        detail: {
          variant: 'external-procurement',
          lines: [
            { description: 'Steel', quantity: '4', unit: 'tonne', supplierPortal: 'Ariba' },
          ],
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('vendor-fields-rejected');
    }
  });

  it('a fulfillment preceding its request is rejected', () => {
    const request = admitAcquisitionRequest(procurementRequest());
    if (!request.ok) return;
    const early = admitAcquisitionFulfillment(
      [request.value],
      [],
      fulfillment({ fulfilledAt: '2026-01-01T00:00:00.000Z' }),
    );
    expect(early.ok).toBe(false);
    if (!early.ok) {
      expect(early.error.code).toBe('validation');
    }
  });
});
