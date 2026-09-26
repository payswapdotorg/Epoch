// AUTHORIZATION + TENANCY coverage: the W009 authorization gate denies
// unauthorized intake BEFORE any kernel admission (fail-closed);
// cross-tenant access is tenant-isolation-rejected; the host may pin
// one tenant.
import { describe, expect, it } from 'vitest';
import { ProcurementRuntime } from '../src/index';
import {
  OBSERVATION_ID,
  OTHER_TENANT,
  PACKAGE_ID,
  PO_ID,
  PRINCIPAL,
  TENANT,
  T2,
  T3,
  WORK_PACKAGE_ID,
  acquisitionRequest,
  allowContext,
  foreignMembershipContext,
  inactivePrincipalContext,
  receiptObservation,
  seededAdapter,
  unknownPrincipalContext,
  unwrap,
} from './helpers';

function seededHost() {
  return new ProcurementRuntime({ supplierPort: seededAdapter() });
}

describe('the authorization gate (W009, fail-closed)', () => {
  it('an UNKNOWN principal is authorization-rejected (unknown-principal denial)', () => {
    const host = seededHost();
    const result = host.intakeRequirement({
      tenantId: TENANT,
      authorization: { principalId: PRINCIPAL, context: unknownPrincipalContext() },
      request: acquisitionRequest(),
      packageId: PACKAGE_ID,
      requirements: [WORK_PACKAGE_ID],
      requirementRef: { kind: 'work-package', id: WORK_PACKAGE_ID },
      assembledAt: T2,
      lineageId: 'lineage:earthworks-steel-a',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('authorization-rejected');
    if (result.error.code === 'authorization-rejected') {
      expect(result.error.denialCode).toBe('unknown-principal');
    }
    // Fail-closed: no state was created.
    expect(host.health().packageCount).toBe(0);
  });

  it('a foreign-tenant membership is authorization-rejected (cross-tenant-denied)', () => {
    const host = seededHost();
    const result = host.intakeRequirement({
      tenantId: TENANT,
      authorization: { principalId: PRINCIPAL, context: foreignMembershipContext() },
      request: acquisitionRequest(),
      packageId: PACKAGE_ID,
      requirements: [WORK_PACKAGE_ID],
      requirementRef: { kind: 'work-package', id: WORK_PACKAGE_ID },
      assembledAt: T2,
      lineageId: 'lineage:earthworks-steel-a',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('authorization-rejected');
    if (result.error.code === 'authorization-rejected') {
      expect(result.error.denialCode).toBe('cross-tenant-denied');
    }
  });

  it('an INACTIVE principal is authorization-rejected (inactive-principal)', () => {
    const host = seededHost();
    const result = host.intakeRequirement({
      tenantId: TENANT,
      authorization: { principalId: PRINCIPAL, context: inactivePrincipalContext() },
      request: acquisitionRequest(),
      packageId: PACKAGE_ID,
      requirements: [WORK_PACKAGE_ID],
      requirementRef: { kind: 'work-package', id: WORK_PACKAGE_ID },
      assembledAt: T2,
      lineageId: 'lineage:earthworks-steel-a',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('authorization-rejected');
    if (result.error.code === 'authorization-rejected') {
      expect(result.error.denialCode).toBe('inactive-principal');
    }
  });

  it('every operation passes the gate (quoting, selection, commitment, order, delivery, status)', () => {
    const host = seededHost();
    const deny = { principalId: PRINCIPAL, context: unknownPrincipalContext() };
    const allow = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(
      host.intakeRequirement({
        tenantId: TENANT,
        authorization: allow,
        request: acquisitionRequest(),
        packageId: PACKAGE_ID,
        requirements: [WORK_PACKAGE_ID],
        requirementRef: { kind: 'work-package', id: WORK_PACKAGE_ID },
        assembledAt: T2,
        lineageId: 'lineage:earthworks-steel-a',
      }),
    );
    for (const operation of [
      host.requestQuotes({ tenantId: TENANT, authorization: deny, packageId: PACKAGE_ID, requestedAt: T3 }),
      host.selectQuote({
        tenantId: TENANT,
        authorization: deny,
        packageId: PACKAGE_ID,
        selectionId: 'selection:x',
        selectedQuoteId: 'quote:steel-supplier-a',
        rationale: 'x',
        decidedAt: T3,
      }),
      host.linkCommitment({
        tenantId: TENANT,
        authorization: deny,
        packageId: PACKAGE_ID,
        commitmentRecordId: 'commitment:x',
        committedAt: T3,
      }),
      host.issuePurchaseOrder({ tenantId: TENANT, authorization: deny, packageId: PACKAGE_ID, poId: PO_ID, issuedAt: T3 }),
      host.recordDeliveryTransition({
        tenantId: TENANT,
        authorization: deny,
        poId: PO_ID,
        to: 'confirmed',
        occurredAt: T3,
        transitionId: 'po-transition:x',
      }),
      host.projectStatus({ tenantId: TENANT, authorization: deny, packageId: PACKAGE_ID, asOf: T3 }),
    ]) {
      expect(operation.ok).toBe(false);
      if (operation.ok) continue;
      expect(operation.error.code).toBe('authorization-rejected');
    }
  });
});

describe('tenant isolation (R12)', () => {
  it('a cross-tenant package read is tenant-isolation-rejected', () => {
    const host = seededHost();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(
      host.intakeRequirement({
        tenantId: TENANT,
        authorization: auth,
        request: acquisitionRequest(),
        packageId: PACKAGE_ID,
        requirements: [WORK_PACKAGE_ID],
        requirementRef: { kind: 'work-package', id: WORK_PACKAGE_ID },
        assembledAt: T2,
        lineageId: 'lineage:earthworks-steel-a',
      }),
    );
    const foreign = host.eventStream({ tenantId: OTHER_TENANT, packageId: PACKAGE_ID });
    expect(foreign.ok).toBe(false);
    if (foreign.ok) return;
    expect(foreign.error.code).toBe('tenant-isolation-rejected');
  });

  it('a request of ANOTHER tenant cannot be intake-ed (tenant-isolation-rejected)', () => {
    const host = seededHost();
    const result = host.intakeRequirement({
      tenantId: TENANT,
      authorization: { principalId: PRINCIPAL, context: allowContext() },
      request: acquisitionRequest({ tenantId: OTHER_TENANT, acquisitionId: 'acquisition:foreign' }),
      packageId: PACKAGE_ID,
      requirements: [WORK_PACKAGE_ID],
      requirementRef: { kind: 'work-package', id: WORK_PACKAGE_ID },
      assembledAt: T2,
      lineageId: 'lineage:foreign',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('tenant-isolation-rejected');
  });

  it('a host pinned to one tenant rejects foreign tenants (the single-tenant guard)', () => {
    const host = new ProcurementRuntime({ expectedTenantId: TENANT, supplierPort: seededAdapter() });
    const result = host.eventStream({ tenantId: OTHER_TENANT, packageId: PACKAGE_ID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('tenant-isolation-rejected');
    if (result.error.code === 'tenant-isolation-rejected') {
      expect(result.error.expectedTenantId).toBe(TENANT);
    }
    void receiptObservation;
    void OBSERVATION_ID;
  });
});
