// ROUND-TRIP SERIALIZATION + DIGEST VERIFICATION for every public
// sealed type: seal -> JSON -> parse -> verify; tampered digests and
// broken chains rejected.
import { describe, expect, it } from 'vitest';
import {
  sealProcurementEvent,
  sealRequirementLineage,
  sealSubstitutionRequest,
  sealSupplierDeliveryTransition,
  verifySealedAcquisitionPackage,
  verifySealedProcurementEvent,
  verifySealedPurchaseOrder,
  verifySealedQuote,
  verifySealedQuoteSelection,
  verifySealedRequirementLineage,
  verifySealedSubstitutionRequest,
  verifySealedSupplierDeliveryTransition,
} from '../src/index';
import {
  OBSERVATION_ID,
  PO_ID,
  WORK_PACKAGE_ID,
  orderChain,
  sealedPackage,
  sealedQuote,
  unwrap,
} from './fixtures';

const chain = orderChain();

function roundTrip(record: unknown): unknown {
  return JSON.parse(JSON.stringify(record)) as unknown;
}

describe('round-trip serialization + digest verification (every public sealed type)', () => {
  it('requirement lineage: seal -> JSON -> verify; tampering is digest-mismatch', () => {
    const sealed = unwrap(
      sealRequirementLineage({
        schema: 'epoch.procurement.requirement-lineage',
        schemaVersion: 1,
        lineageId: 'lineage:round-trip',
        tenantId: chain.packages.packages[0]!.tenantId,
        solutionId: chain.packages.packages[0]!.solutionId,
        requirementRef: { kind: 'work-package', workPackageId: WORK_PACKAGE_ID },
        packageId: chain.packages.packages[0]!.packageId,
        recordedAt: '2026-04-01T09:00:02.000Z',
        recordedBy: 'principal:procurement-lead',
      }),
    );
    expect(verifySealedRequirementLineage(roundTrip(sealed)).ok).toBe(true);
    const tampered = { ...sealed, note: 'tampered' };
    const verified = verifySealedRequirementLineage(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });

  it('acquisition package: seal -> JSON -> verify; tampered digest rejected', () => {
    const sealed = sealedPackage();
    expect(verifySealedAcquisitionPackage(roundTrip(sealed)).ok).toBe(true);
    const tampered = { ...sealed, contentDigest: 'f'.repeat(64) };
    const verified = verifySealedAcquisitionPackage(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });

  it('quote + selection: seal -> JSON -> verify; tampering is digest-mismatch', () => {
    const quote = sealedQuote();
    expect(verifySealedQuote(roundTrip(quote)).ok).toBe(true);

    const selection = chain.selections.selections[0]!;
    expect(verifySealedQuoteSelection(roundTrip(selection)).ok).toBe(true);
    const tamperedSelection = { ...selection, rationale: 'tampered' };
    const verifiedSelection = verifySealedQuoteSelection(tamperedSelection);
    expect(verifiedSelection.ok).toBe(false);
    if (verifiedSelection.ok) return;
    expect(verifiedSelection.error.code).toBe('digest-mismatch');
  });

  it('purchase order: seal -> JSON -> verify; tampering is digest-mismatch', () => {
    const po = chain.orders.orders[0]!;
    expect(verifySealedPurchaseOrder(roundTrip(po)).ok).toBe(true);
    const tampered = { ...po, totalCost: { amount: '1', currency: 'EUR' } };
    const verified = verifySealedPurchaseOrder(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });

  it('supplier-delivery transition + substitution request: seal -> JSON -> verify', () => {
    const transition = unwrap(
      sealSupplierDeliveryTransition({
        schema: 'epoch.procurement.supplier-delivery-transition',
        schemaVersion: 1,
        transitionId: 'po-transition:round-trip',
        tenantId: chain.orders.orders[0]!.tenantId,
        poId: PO_ID,
        poVersionDigest: chain.orders.orders[0]!.contentDigest,
        from: 'ordered',
        to: 'confirmed',
        occurredAt: '2026-04-01T09:00:06.000Z',
        recordedBy: 'principal:site-buyer',
      }),
    );
    expect(verifySealedSupplierDeliveryTransition(roundTrip(transition)).ok).toBe(true);
    const tamperedTransition = { ...transition, from: 'shipped' as const };
    const verifiedTransition = verifySealedSupplierDeliveryTransition(tamperedTransition);
    expect(verifiedTransition.ok).toBe(false);
    if (verifiedTransition.ok) return;
    expect(verifiedTransition.error.code).toBe('digest-mismatch');

    const substitution = unwrap(
      sealSubstitutionRequest({
        schema: 'epoch.procurement.substitution-request',
        schemaVersion: 1,
        substitutionId: 'substitution:round-trip',
        tenantId: chain.orders.orders[0]!.tenantId,
        poId: PO_ID,
        poVersionDigest: chain.orders.orders[0]!.contentDigest,
        originalLines: [{ description: 'Anchor bolts M24', quantity: '80', unit: 'piece' }],
        substituteLines: [{ description: 'Anchor bolts M27', quantity: '80', unit: 'piece' }],
        requestedAt: '2026-04-01T09:00:07.000Z',
        requestedBy: 'principal:procurement-lead',
      }),
    );
    expect(verifySealedSubstitutionRequest(roundTrip(substitution)).ok).toBe(true);
  });

  it('procurement event: seal -> JSON -> verify; tampered digest rejected', () => {
    const sealed = unwrap(
      sealProcurementEvent({
        schemaVersion: 1,
        streamId: 'stream:procurement-round-trip',
        sequence: 1,
        tenantId: chain.packages.packages[0]!.tenantId,
        actor: 'principal:procurement-lead',
        causalParent: null,
        payload: {
          discriminator: 'procurement:package-assembled',
          data: {
            packageId: chain.packages.packages[0]!.packageId,
            acquisitionId: chain.packages.packages[0]!.acquisitionId,
            variant: 'external-procurement',
            assembledAt: '2026-04-01T09:00:02.000Z',
          },
        },
        occurredAt: '2026-04-01T09:00:02.000Z',
      }),
    );
    expect(verifySealedProcurementEvent(roundTrip(sealed)).ok).toBe(true);
    const tampered = { ...sealed, contentDigest: 'f'.repeat(64) };
    const verified = verifySealedProcurementEvent(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
    void OBSERVATION_ID;
  });
});
