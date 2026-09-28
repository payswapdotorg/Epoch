/**
 * The AUDIT FAMILIES (the W030 pin: "packages/tenancy/** (W009 tenant
 * isolation), packages/access-projection/** (W041: authorization +
 * redaction invariants your audits verify)").
 *
 * Family 1 — TENANT BOUNDARY (R12): re-examines admitted
 * tenant-boundary-check observations and flags every one whose
 * subject and actor tenants DISAGREE while the outcome is NOT
 * `denied`. The W009/W010 machinery claims cross-tenant access is
 * denied BY CONSTRUCTION; this audit is the independent check that
 * the OBSERVED record agrees (fail-closed: an unverifiable boundary
 * observation — missing tenant fields — is itself a finding).
 *
 * Family 2 — ACCESS PROJECTION (W041): verifies the published
 * invariants of an authorized projection SUMMARY mirrored from the
 * REAL W041 records (pinned by parity tests feeding genuine
 * `SealedAuthorizedProjection` values through this schema):
 * identity preservation (same record id + content digest as the
 * canonical record — projections never mint identities), redaction
 * completeness (no path both released AND redacted — every field is
 * exactly one of the two), decision linkage (a released projection
 * references the W009 decision digest it grounds), and policy
 * linkage (the projection references its policy revision).
 *
 * Findings are TYPED DATA (never thrown); the enforcement host
 * records them as `security-audit` observations with severity
 * `critical` (violated invariants are security-relevant breaches).
 */
import { z } from 'zod';
import { Sha256HexSchema } from './primitives';
import type { AuditFindingCode } from './version';
import type { SealedObservation } from './observation';

// --------------------------------------------------------------------------------
// The finding model.
// --------------------------------------------------------------------------------

/** One typed audit finding (values, never thrown). */
export interface AuditFinding {
  readonly code: AuditFindingCode;
  readonly message: string;
  /** The subject the finding concerns (observation id or projection record id). */
  readonly subject: string;
  /** The exact-revision digest of the examined record, when applicable. */
  readonly sourceDigest?: string | undefined;
}

// --------------------------------------------------------------------------------
// Family 1: the tenant-boundary audit.
// --------------------------------------------------------------------------------

/** The boundary detail keys the audit reads (bounded neutral strings in observation detail). */
const SUBJECT_TENANT_KEY = 'subjectTenantId';
const ACTOR_TENANT_KEY = 'actorTenantId';

/**
 * Audit one tenant-boundary-check observation. A boundary check
 * carries BOTH the subject's and the actor's tenant ids in its
 * detail; if they disagree and the outcome is not `denied`, the R12
 * invariant failed (`cross-tenant-breach`). Missing tenant detail on
 * a boundary observation is itself a `cross-tenant-breach` finding
 * (fail-closed: unverifiable is not compliant).
 */
export function auditTenantBoundaryObservation(observation: SealedObservation): AuditFinding | null {
  if (observation.observationClass !== 'tenant-boundary-check') return null;
  const subjectTenant = observation.detail?.[SUBJECT_TENANT_KEY];
  const actorTenant = observation.detail?.[ACTOR_TENANT_KEY];
  if (typeof subjectTenant !== 'string' || typeof actorTenant !== 'string') {
    return {
      code: 'cross-tenant-breach',
      message:
        'a tenant-boundary-check observation carries no subject/actor tenant detail — the boundary claim is unverifiable (fail-closed)',
      subject: observation.observationId,
      sourceDigest: observation.contentDigest,
    };
  }
  if (subjectTenant !== actorTenant && observation.outcome !== 'denied') {
    return {
      code: 'cross-tenant-breach',
      message: `a tenant-boundary check observed subject tenant "${subjectTenant}" and actor tenant "${actorTenant}" disagree with outcome "${observation.outcome}" — the R12 tenant isolation invariant failed`,
      subject: observation.observationId,
      sourceDigest: observation.contentDigest,
    };
  }
  return null;
}

/** Audit every admitted observation for tenant-boundary breaches (deterministic order). */
export function auditTenantBoundary(observations: readonly SealedObservation[]): readonly AuditFinding[] {
  const findings: AuditFinding[] = [];
  const sorted = [...observations].sort((a, b) =>
    a.observationId < b.observationId ? -1 : a.observationId > b.observationId ? 1 : 0,
  );
  for (const observation of sorted) {
    const finding = auditTenantBoundaryObservation(observation);
    if (finding !== null) findings.push(finding);
  }
  return findings;
}

// --------------------------------------------------------------------------------
// Family 2: the access-projection audit (W041 invariants).
// --------------------------------------------------------------------------------

/**
 * The projection summary — the MIRRORED W041 authorized projection
 * (a structural subset of the REAL `SealedAuthorizedProjection`
 * fields the audit reads, in W041's own vocabulary: objectId,
 * objectDigest, released/redacted paths, decision digest, policy id;
 * pinned by parity tests feeding genuine values).
 */
export const ProjectionSummarySchema = z
  .strictObject({
    objectId: z.string().min(3).max(256),
    objectDigest: Sha256HexSchema,
    releasedPaths: z.array(z.string().min(1).max(256)).max(1024).readonly(),
    redactedPaths: z.array(z.string().min(1).max(256)).max(1024).readonly(),
    decisionDigest: Sha256HexSchema.nullable(),
    policyId: z.string().min(3).max(128).nullable(),
  })
  .superRefine((value, ctx) => {
    const released = new Set(value.releasedPaths);
    if (released.size !== value.releasedPaths.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'releasedPaths carries a duplicate entry',
        path: ['releasedPaths'],
      });
    }
    const redacted = new Set(value.redactedPaths);
    if (redacted.size !== value.redactedPaths.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'redactedPaths carries a duplicate entry',
        path: ['redactedPaths'],
      });
    }
  })
  .readonly()
  .meta({
    id: 'ProjectionSummary',
    title: 'ProjectionSummary',
    description:
      'The mirrored W041 authorized-projection summary the audit family verifies: record identity + digest, released/redacted path sets, decision + policy linkage.',
  });

/** One projection summary. */
export type ProjectionSummary = z.infer<typeof ProjectionSummarySchema>;

/** The canonical-object reference the projection is audited against (the W036 record identity grammar). */
export const CanonicalObjectRefSchema = z
  .strictObject({
    objectId: z.string().min(3).max(256),
    objectDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'CanonicalObjectRef',
    title: 'CanonicalObjectRef',
    description: 'The canonical-record reference (object id + exact-revision digest) an authorized projection is audited against.',
  });

/** One canonical-object reference. */
export type CanonicalObjectRef = z.infer<typeof CanonicalObjectRefSchema>;

/**
 * Audit one projection summary against its canonical record
 * reference. Verifies the W041 published invariants:
 *
 * - `projection-identity-fork` — record id or content digest
 *   mismatch (projections carry the SAME identity as the canonical
 *   record; they never mint identities);
 * - `projection-path-overlap` — a path both released AND redacted
 *   (every field is exactly one of the two);
 * - `projection-decision-missing` — a released projection with no
 *   authorization-decision digest;
 * - `projection-policy-missing` — a projection with no policy
 *   revision reference.
 */
export function auditProjectionSummary(
  summary: ProjectionSummary,
  canonical: CanonicalObjectRef,
): readonly AuditFinding[] {
  const findings: AuditFinding[] = [];
  if (summary.objectId !== canonical.objectId || summary.objectDigest !== canonical.objectDigest) {
    findings.push({
      code: 'projection-identity-fork',
      message: `the projection carries identity (${summary.objectId} @ ${summary.objectDigest.slice(0, 12)}) that disagrees with the canonical record (${canonical.objectId} @ ${canonical.objectDigest.slice(0, 12)}) — projections never mint identities (the W041 invariant)`,
      subject: summary.objectId,
      sourceDigest: summary.objectDigest,
    });
  }
  const released = new Set(summary.releasedPaths);
  for (const path of summary.redactedPaths) {
    if (released.has(path)) {
      findings.push({
        code: 'projection-path-overlap',
        message: `the path "${path}" is BOTH released and redacted — every field is exactly one of the two (the W041 invariant)`,
        subject: summary.objectId,
        sourceDigest: summary.objectDigest,
      });
      break;
    }
  }
  if (summary.releasedPaths.length > 0 && summary.decisionDigest === null) {
    findings.push({
      code: 'projection-decision-missing',
      message: 'a released projection references no authorization-decision digest — the two-stage evaluation requires the sealed W009 decision (the W041 invariant)',
      subject: summary.objectId,
      sourceDigest: summary.objectDigest,
    });
  }
  if (summary.policyId === null) {
    findings.push({
      code: 'projection-policy-missing',
      message: 'the projection references no projection-policy revision — policy-as-data requires the policy linkage (the W041 invariant)',
      subject: summary.objectId,
      sourceDigest: summary.objectDigest,
    });
  }
  return findings;
}
