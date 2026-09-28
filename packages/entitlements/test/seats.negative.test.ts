// Negative coverage of seat accounting: capacity, duplicates, revocation,
// unknown entitlements/assignments, tenant isolation, tamper detection,
// and vendor-field rejection.
import { describe, expect, it } from 'vitest';
import {
  admitSeatAssignment,
  admitSeatRelease,
  foldSeatAssignments,
  sealSeatAssignment,
  verifySealedSeatAssignment,
} from '../src/index';
import {
  ENTITLEMENT,
  ENTITLEMENT_2,
  OTHER_TENANT,
  PRINCIPAL,
  PRINCIPAL_2,
  PRINCIPAL_3,
  TENANT,
  expectError,
  grant,
  revocation,
  sealedSeatAssignment,
  sealedSeatRelease,
  seatAssignmentContent,
  seatReleaseContent,
  workspaceGrant,
} from './fixtures';

describe('seat assignment admission (negative)', () => {
  it('an unknown entitlement is a typed rejection (no grant record)', () => {
    const error = expectError(
      admitSeatAssignment({
        assignments: [],
        releases: [],
        grants: [],
        revocations: [],
        candidate: seatAssignmentContent(),
      }),
    );
    expect(error.code).toBe('unknown-entitlement');
  });

  it('a revoked grant refuses seat assignment (immediate)', () => {
    const error = expectError(
      admitSeatAssignment({
        assignments: [],
        releases: [],
        grants: [grant()],
        revocations: [revocation()],
        candidate: seatAssignmentContent(),
      }),
    );
    expect(error.code).toBe('entitlement-revoked');
  });

  it('a grant without seat capacity is a typed rejection', () => {
    const error = expectError(
      admitSeatAssignment({
        assignments: [],
        releases: [],
        grants: [workspaceGrant()],
        revocations: [],
        candidate: seatAssignmentContent({ entitlementId: ENTITLEMENT_2 }),
      }),
    );
    expect(error.code).toBe('seat-capacity-undefined');
  });

  it('seat capacity is enforced (2 seats: the third is rejected)', () => {
    const first = sealedSeatAssignment();
    const second = sealedSeatAssignment({
      seatAssignmentId: 'seat:globex-stress-2',
      principalId: PRINCIPAL_3,
    });
    const error = expectError(
      admitSeatAssignment({
        assignments: [first, second],
        releases: [],
        grants: [grant()],
        revocations: [],
        candidate: seatAssignmentContent({ seatAssignmentId: 'seat:globex-stress-3', principalId: PRINCIPAL }),
      }),
    );
    expect(error.code).toBe('seat-limit-exceeded');
    expect((error as { seats?: number }).seats).toBe(2);
    expect((error as { activeCount?: number }).activeCount).toBe(2);
  });

  it('a duplicate active seat for the same principal is rejected', () => {
    const first = sealedSeatAssignment();
    const error = expectError(
      admitSeatAssignment({
        assignments: [first],
        releases: [],
        grants: [grant()],
        revocations: [],
        candidate: seatAssignmentContent({ seatAssignmentId: 'seat:globex-stress-2' }),
      }),
    );
    expect(error.code).toBe('duplicate-seat-assignment');
    expect((error as { principalId?: string }).principalId).toBe(PRINCIPAL_2);
  });

  it('a grant of ANOTHER tenant never satisfies the assignment scope (R12)', () => {
    const foreign = grant({ tenantId: OTHER_TENANT, entitlementId: 'entitlement:initech-stress' });
    const error = expectError(
      admitSeatAssignment({
        assignments: [],
        releases: [],
        grants: [foreign],
        revocations: [],
        candidate: seatAssignmentContent(),
      }),
    );
    expect(error.code).toBe('unknown-entitlement');
  });

  it('a malformed candidate is a typed validation rejection', () => {
    const error = expectError(
      admitSeatAssignment({
        assignments: [],
        releases: [],
        grants: [grant()],
        revocations: [],
        candidate: seatAssignmentContent({ seatAssignmentId: 'not-a-seat-id' }),
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('a candidate with vendor fields is the typed vendor-fields rejection', () => {
    const error = expectError(
      admitSeatAssignment({
        assignments: [],
        releases: [],
        grants: [grant()],
        revocations: [],
        candidate: seatAssignmentContent({ stripeCustomerId: 'cus_123' }),
      }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a schemaVersion skew is reported at the version path', () => {
    const error = expectError(
      admitSeatAssignment({
        assignments: [],
        releases: [],
        grants: [grant()],
        revocations: [],
        candidate: seatAssignmentContent({ schemaVersion: 999 }),
      }),
    );
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('schemaVersion');
  });
});

describe('seat release admission (negative)', () => {
  it('an unknown seat assignment is rejected', () => {
    const error = expectError(
      admitSeatRelease({
        assignments: [],
        releases: [],
        candidate: seatReleaseContent(),
      }),
    );
    expect(error.code).toBe('unknown-seat-assignment');
  });

  it('releasing an already-released assignment is a conflict', () => {
    const assignment = sealedSeatAssignment();
    const error = expectError(
      admitSeatRelease({
        assignments: [assignment],
        releases: [sealedSeatRelease()],
        candidate: seatReleaseContent({ releaseId: 'seat-release:globex-stress-2' }),
      }),
    );
    expect(error.code).toBe('seat-release-conflict');
  });

  it('a release naming a foreign entitlement/tenant does not resolve', () => {
    const error = expectError(
      admitSeatRelease({
        assignments: [sealedSeatAssignment()],
        releases: [],
        candidate: seatReleaseContent({ entitlementId: 'entitlement:other' }),
      }),
    );
    expect(error.code).toBe('unknown-seat-assignment');
  });
});

describe('seat folds (negative)', () => {
  it('a cross-tenant assignment is rejected by the fold (R12)', () => {
    const foreign = sealedSeatAssignment({ tenantId: OTHER_TENANT });
    const error = expectError(
      foldSeatAssignments([foreign], [], { entitlementId: ENTITLEMENT, tenantId: TENANT }),
    );
    expect(error.code).toBe('cross-tenant-denied');
  });

  it('a tampered assignment digest never folds', () => {
    const tampered = { ...sealedSeatAssignment(), contentDigest: 'f'.repeat(64) };
    const error = expectError(
      foldSeatAssignments([tampered], [], { entitlementId: ENTITLEMENT, tenantId: TENANT }),
    );
    expect(error.code).toBe('digest-mismatch');
  });

  it('a tampered sealed assignment fails verification directly', () => {
    const tampered = { ...sealedSeatAssignment(), principalId: PRINCIPAL_3 };
    const error = expectError(verifySealedSeatAssignment(tampered));
    expect(error.code).toBe('digest-mismatch');
  });
});

describe('seat sealing (negative)', () => {
  it('an unsealable candidate is a validation rejection (never an exception)', () => {
    const error = expectError(sealSeatAssignment(seatAssignmentContent({ assignedAt: 'yesterday' })));
    expect(error.code).toBe('validation');
  });
});
