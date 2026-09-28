// THE EXAMPLES EVIDENCE (W035): every examples/sdk module RUNS green and
// produces its asserted typed outcome (not merely "does not throw") —
// the five deterministic compositions the `sdk-examples-green`
// checklist item cites. The examples compose the REAL W007/W008/W023/
// W034 surfaces and the release kit through their public APIs only.
import { describe, expect, it } from 'vitest';
import { runAdapterExample } from '../../examples/sdk/adapter-example';
import { runCapabilityRegistrationExample } from '../../examples/sdk/capability-registration';
import { runExtensionExample } from '../../examples/sdk/extension-example';
import { runMarketplaceListingExample } from '../../examples/sdk/marketplace-listing-example';
import { runReleaseReadinessExample } from '../../examples/sdk/release-readiness-example';

describe('examples/sdk — capability registration (W007)', () => {
  it('registers, resolves, and lists the fixture capability', () => {
    const outcome = runCapabilityRegistrationExample();
    expect(outcome.capabilityId).toBe('engineering.stress-analysis');
    expect(outcome.version).toBe('1.2.3');
    expect(outcome.registeredLifecycle).toBe('registered');
    expect(outcome.resolvedLifecycle).toBe('registered');
    expect(outcome.registeredCount).toBe(1);
    expect(outcome.manifestDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('examples/sdk — adapter (W007)', () => {
  it('negotiates the binding and shows the typed version-unsatisfied rejection', () => {
    const outcome = runAdapterExample();
    expect(outcome.adapterId).toBe('adapter:stress-solver');
    expect(outcome.pin.capabilityId).toBe('engineering.stress-analysis');
    expect(outcome.pin.capabilityVersion).toBe('1.2.3');
    expect(outcome.pin.adapterId).toBe('adapter:stress-solver');
    expect(outcome.descriptorDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.pin.adapterDescriptorDigest).toBe(outcome.descriptorDigest);
    expect(outcome.unsatisfiedCode).toBe('version-unsatisfied');
    expect(outcome.unsatisfiedConstraintKind).toBe('caret');
  });
});

describe('examples/sdk — extension (W008)', () => {
  it('authors, seals, and round-trip verifies the declarative manifest', () => {
    const outcome = runExtensionExample();
    expect(outcome.extensionId).toBe('extension:stress-toolkit');
    expect(outcome.flavor).toBe('declarative');
    expect(outcome.trustClass).toBe('t2');
    expect(outcome.grantCount).toBe(1);
    expect(outcome.hostFunctionsGranted).toEqual(['clock.read', 'log.write', 'world.read']);
    expect(outcome.manifestDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.roundTripVerified).toBe(true);
  });
});

describe('examples/sdk — marketplace listing (W023)', () => {
  it('publishes the chained versions and proves every readiness criterion', () => {
    const outcome = runMarketplaceListingExample();
    expect(outcome.listingId).toBe('listing:stress-suite');
    expect(outcome.entitlementId).toBe('entitlement:grant-001');
    expect(outcome.versionCount).toBe(2);
    expect(outcome.headVersion).toBe('1.1.0');
    expect(outcome.chainVerified).toBe(true);
    expect(outcome.referencesResolved).toBe(1);
    expect(outcome.grantedBeforeRevoke).toBe(true);
    expect(outcome.deniedAfterRevoke).toBe(true);
    expect(outcome.usageEventCount).toBe(2);
    expect(outcome.usageTotalUnits).toBe('6.75');
    expect(outcome.foldsAgree).toBe(true);
    expect(outcome.revenueRecords).toBe(1);
    expect(outcome.revenueProvenanceComplete).toBe(true);
    expect(outcome.revenueLastDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('examples/sdk — release readiness (W035)', () => {
  it('carries the candidate to READY, seals the manifest, and replays the journal', () => {
    const outcome = runReleaseReadinessExample();
    expect(outcome.releaseId).toBe('release:e1-program-1');
    expect(outcome.checklistId).toBe('rc:e1-program-1');
    expect(outcome.totalItems).toBe(14);
    expect(outcome.verdict).toBe('ready');
    expect(outcome.manifestId).toMatch(/^manifest:[0-9a-f]{16}$/);
    expect(outcome.manifestDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.notesDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.eventCount).toBe(17);
    expect(outcome.replayVerdict).toBe('ready');
    expect(outcome.replayPublishedDigest).toBe(outcome.manifestDigest);
  });
});
