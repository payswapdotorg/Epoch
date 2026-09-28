// Positive coverage of seat accounting: sealing/verification, pure
// admission within capacity, release flips, and the deterministic fold.
import { describe, expect, it } from 'vitest';
import {
  admitSeatAssignment,
  admitSeatRelease,
  computeSeatAssignmentDigest,
  foldSeatAssignments,
  parseEntitlementGrantRecord,
  verifySealedSeatAssignment,
  verifySealedSeatRelease,
} from '../src/index';
import {
  ENTITLEMENT,
  PRINCIPAL_2,
  PRINCIPAL_3,
  TENANT,
  grant,
  hierarchy,
  revocation,
  sealedSeatAssignment,
  sealedSeatRelease,
  seatAssignmentContent,
  seatReleaseContent,
  unwrap,
} from './fixtures';

describe('seat assignments (positive)', () => {
  it('seals and verifies round-trip (content-addressed)', () => {
    const sealed = sealedSeatAssignment();
    const verified = unwrap(verifySealedSeatAssignment(sealed));
    expect(verified.contentDigest).toBe(sealed.contentDigest);
    expect(verified.seatAssignmentId).toBe('seat:globex-stress-1');
    const { contentDigest, ...content } = sealed;
    expect(computeSeatAssignmentDigest(content)).toBe(contentDigest);
  });

  it('admits an assignment within the grant seat capacity', () => {
    const admitted = unwrap(
      admitSeatAssignment({
        assignments: [],
        releases: [],
        grants: [grant()],
        revocations: [],
        candidate: seatAssignmentContent(),
      }),
    );
    expect(admitted.principalId).toBe(PRINCIPAL_2);
  });

  it('admits distinct principals up to the grant capacity (2 seats)', () => {
    const first = sealedSeatAssignment();
    unwrap(
      admitSeatAssignment({
        assignments: [first],
        releases: [],
        grants: [grant()],
        revocations: [],
        candidate: seatAssignmentContent({
          seatAssignmentId: 'seat:globex-stress-2',
          principalId: PRINCIPAL_3,
        }),
      }),
    );
  });

  it('the fold counts active and released assignments deterministically', () => {
    const first = sealedSeatAssignment();
    const second = sealedSeatAssignment({
      seatAssignmentId: 'seat:globex-stress-2',
      principalId: PRINCIPAL_3,
    });
    const release = sealedSeatRelease();
    const account = unwrap(foldSeatAssignments([second, first], [release], {
      entitlementId: ENTITLEMENT,
      tenantId: TENANT,
    }));
    expect(account.activeCount).toBe(1);
    expect(account.activePrincipalIds).toEqual([PRINCIPAL_3]);
    expect(account.releasedCount).toBe(1);
  });

  it('fold input order never leaks (assignments sort by seatAssignmentId)', () => {
    const first = sealedSeatAssignment();
    const second = sealedSeatAssignment({
      seatAssignmentId: 'seat:globex-stress-2',
      principalId: PRINCIPAL_3,
    });
    const a = unwrap(foldSeatAssignments([first, second], [], { entitlementId: ENTITLEMENT, tenantId: TENANT }));
    const b = unwrap(foldSeatAssignments([second, first], [], { entitlementId: ENTITLEMENT, tenantId: TENANT }));
    expect(a).toEqual(b);
  });

  it('a release flips exactly its assignment inactive', () => {
    const assignment = sealedSeatAssignment();
    const release = unwrap(
      admitSeatRelease({
        assignments: [assignment],
        releases: [],
        candidate: seatReleaseContent(),
      }),
    );
    const account = unwrap(foldSeatAssignments([assignment], [release], {
      entitlementId: ENTITLEMENT,
      tenantId: TENANT,
    }));
    expect(account.activeCount).toBe(0);
    expect(account.releasedCount).toBe(1);
  });

  it('a released seat frees capacity for a re-assignment', () => {
    const first = sealedSeatAssignment();
    const release = sealedSeatRelease();
    const reAssignment = seatAssignmentContent({
      seatAssignmentId: 'seat:globex-stress-2',
    });
    unwrap(
      admitSeatAssignment({
        assignments: [first],
        releases: [release],
        grants: [grant()],
        revocations: [],
        candidate: reAssignment,
      }),
    );
  });

  it('W023 grant records validate through the REAL upstream validator', () => {
    const parsed = unwrap(parseEntitlementGrantRecord(grant()));
    expect(parsed.seats).toBe(2);
  });

  it('verification tolerates hierarchy-shaped extra records of other entitlements in the fold', () => {
    const foreign = sealedSeatAssignment({
      seatAssignmentId: 'seat:other-entitlement-1',
      entitlementId: 'entitlement:other',
    });
    const account = unwrap(
      foldSeatAssignments([foreign, sealedSeatAssignment()], [], {
        entitlementId: ENTITLEMENT,
        tenantId: TENANT,
      }),
    );
    expect(account.activeCount).toBe(1);
  });
});

describe('seat releases (positive)', () => {
  it('seals and verifies round-trip', () => {
    const sealed = sealedSeatRelease();
    const verified = unwrap(verifySealedSeatRelease(sealed));
    expect(verified.contentDigest).toBe(sealed.contentDigest);
  });

  it('admission references the assignment with matching entitlement and tenant', () => {
    unwrap(
      admitSeatRelease({
        assignments: [sealedSeatAssignment()],
        releases: [],
        candidate: seatReleaseContent(),
      }),
    );
  });
});

describe('revocation semantics at admission (positive-path guard)', () => {
  it('an unrevoked grant admits (the guard stays green)', () => {
    unwrap(
      admitSeatAssignment({
        assignments: [],
        releases: [],
        grants: [grant()],
        revocations: [revocation({ entitlementId: 'entitlement:unrelated' })],
        candidate: seatAssignmentContent(),
      }),
    );
  });

  it('PRINCIPAL re-assignment after release is admitted (no duplicate)', () => {
    const assignment = sealedSeatAssignment();
    const release = sealedSeatRelease();
    const reAssignment = seatAssignmentContent({
      seatAssignmentId: 'seat:globex-stress-9',
    });
    unwrap(
      admitSeatAssignment({
        assignments: [assignment],
        releases: [release],
        grants: [grant()],
        revocations: [],
        candidate: reAssignment,
      }),
    );
  });

  it('the hierarchy fixture holds (W009 seams are live)', () => {
    const tenancy = hierarchy();
    expect(tenancy.size).toBe(7);
  });

  it('PRINCIPAL_3 can be assigned after PRINCIPAL_2 (capacity 2)', () => {
    const first = sealedSeatAssignment();
    unwrap(
      admitSeatAssignment({
        assignments: [first],
        releases: [],
        grants: [grant()],
        revocations: [],
        candidate: seatAssignmentContent({
          seatAssignmentId: 'seat:globex-stress-2',
          principalId: PRINCIPAL_3,
        }),
      }),
    );
  });
});
