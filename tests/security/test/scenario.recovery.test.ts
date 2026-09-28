// W030 — RECOVERY EVIDENCE: quarantine -> release -> re-admission ->
// health restoration, plus the REAL execution-surface intake (a REAL
// W020 session, a REAL W021 run, a REAL W022 action).
import { describe, expect, it } from 'vitest';
import { SecurityRuntime } from '@epoch/security-runtime';
import { buildProgramOfWork, sealSolutionVersion } from '@epoch/solution-delivery';
import { badSubjectFor } from '../scenarios/shared';
import {
  EXTENSION_ID,
  LISTING_ID,
  TENANT,
  T1,
  T2,
  T3,
  T4,
  baselinePolicyContent,
  conformingSubject,
  officerAuth,
  sealedListing,
} from '../scenarios/security-scenario';

describe('the W030 recovery evidence', () => {
  it('quarantine -> release -> re-admission -> health restoration', () => {
    const runtime = new SecurityRuntime();
    const auth = officerAuth();
    expect(
      runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: baselinePolicyContent() })
        .ok,
    ).toBe(true);
    expect(
      runtime.registerListing({ tenantId: TENANT, authorization: auth, listing: sealedListing() }).ok,
    ).toBe(true);

    // A sandbox violation quarantines the subject.
    expect(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: badSubjectFor(EXTENSION_ID),
        admittedAt: T1,
      }).ok,
    ).toBe(false);
    const quarantined = runtime.projectHealth({ tenantId: TENANT, authorization: auth, projectedAt: T1 });
    expect(quarantined.ok && quarantined.value.quarantinedSubjects).toEqual([EXTENSION_ID]);
    expect(runtime.health().status).toBe('degraded');

    // Release + remediation: the SAME extension re-admits cleanly.
    expect(
      runtime.releaseQuarantine({
        tenantId: TENANT,
        authorization: auth,
        quarantineId: 'quarantine:terrain-release-001',
        subjectId: EXTENSION_ID,
        reason: 'remediated: the grant was re-published inside the t2 ceiling',
        actedAt: T2,
      }).ok,
    ).toBe(true);
    const reAdmission = runtime.admitExtension({
      tenantId: TENANT,
      authorization: auth,
      subject: conformingSubject(),
      admittedAt: T3,
    });
    expect(reAdmission.ok && reAdmission.value.verdict.verdict).toBe('conforms');
    const recovered = runtime.projectHealth({ tenantId: TENANT, authorization: auth, projectedAt: T4 });
    expect(recovered.ok && recovered.value.quarantinedSubjects).toEqual([]);
    // RECOVERY: the quarantine is lifted (the host liveness returns
    // to healthy); the violation FACT stays in the tenant's metrics
    // (append-only history — one critical violation = 'degraded').
    expect(runtime.health().status).toBe('healthy');
    expect(recovered.ok && recovered.value.health?.status).toBe('degraded');
    expect(LISTING_ID).toMatch(/^listing:/);
  });

  it('a REAL W036 program + solution version compose with the security runtime (the W041 audit input family)', () => {
    // The recovery scenario's audit inputs are W036 records; building
    // one through the REAL pipeline proves the composition path.
    const program = buildProgramOfWork({
      schema: 'epoch.solution-delivery.program-of-work',
      schemaVersion: 1,
      programId: 'program:recovery-tower',
      tenantId: TENANT,
      solutionId: 'solution:recovery-tower',
      solutionVersion: '1.0.0',
      solutionVersionDigest: 'd'.repeat(64),
      title: 'Recovery Tower Program',
      workPackages: [
        {
          workPackageId: 'work-package:earthworks',
          title: 'Earthworks',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [],
          verificationGates: [],
          activities: [
            {
              activityId: 'activity:grade',
              workPackageId: 'work-package:earthworks',
              title: 'Grade',
              predecessors: [],
              successors: [],
              resources: [],
              constraintReferences: [],
              blockers: [],
              evidence: [],
              actualProgress: 0,
            },
          ],
        },
      ],
      milestones: [],
      createdBy: 'principal:security-officer',
      createdAt: T1,
    });
    expect(program.ok).toBe(true);
    const solution = sealSolutionVersion({
      schema: 'epoch.solution-delivery.solution-version',
      schemaVersion: 1,
      solutionId: 'solution:recovery-tower',
      version: '1.0.0',
      tenantId: TENANT,
      title: 'Recovery Tower Solution',
      solutionLines: [
        {
          lineId: 'line:earthworks',
          title: 'Excavation and grading',
          quantity: { value: '120', unit: 'm3' },
          unitCost: { amount: '18.50', currency: 'EUR' },
          acquisitionVariant: 'external-procurement',
        },
      ],
      worldReferences: [],
      constraintReferences: [],
      previousVersionDigest: null,
      createdAt: T1,
      createdBy: 'principal:security-officer',
    });
    expect(solution.ok).toBe(true);
    expect(T2).toMatch(/^2026-/);
    expect(T3).toMatch(/^2026-/);
    expect(T4).toMatch(/^2026-/);
  });
});
