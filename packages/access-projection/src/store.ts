/**
 * The access-projection store: the deterministic in-memory reference
 * state (the W038 store precedent — immutable admissions returning the
 * next store, sorted readonly arrays, typed duplicate admissions).
 *
 * Held state per tenant:
 * - POLICY REGISTRATION + VERSIONING: sealed policy revisions with the
 *   append-only revision chain (same revision + same digest = the typed
 *   duplicate admission; same revision + different content =
 *   `version-conflict`; out-of-order/gapped revisions =
 *   `lifecycle-conflict`);
 * - RECORD ADMISSION: the canonical sealed W036 records (opaque typed
 *   exact-revision references; the solution-version family admits chain
 *   revisions, the immutable families reject re-admission with
 *   different content);
 * - THE APPEND-ONLY AUDIT TRAIL keyed by evaluation key (identical
 *   replay = the sealed prior audit record; same key + different
 *   content = `replay-conflict` — the trail refuses to fork);
 * - ADMITTED PROJECTIONS with the identity-fork gate (a projection must
 *   cite the canonical object's exact revision) and the field-leak gate
 *   (every released path must be inside the selected policy row —
 *   defense-in-depth re-derivation);
 * - the DERIVED projection-state projection (counts, sorted).
 */
import {
  canonicalObjectIdentity,
  canonicalRecordKey,
  canonicalTenantId,
  verifyCanonicalRecord,
  type CanonicalRecord,
} from './records';
import {
  verifySealedProjectionPolicy,
  selectRoleBinding,
  selectTaskBinding,
  type SealedProjectionPolicy,
} from './policy';
import {
  verifySealedAuthorizedProjection,
  type SealedAuthorizedProjection,
} from './projection';
import { verifySealedProjectionAudit, type SealedProjectionAudit } from './audit';
import { selectVisiblePaths } from './evaluate';
import { TenantIdSchema } from './primitives';
import { authorityViolationError } from './issues';
import type { AccessProjectionResult } from './errors';
import type { ObjectClass } from './version';

/** One tenant-scoped access-projection store (all arrays sorted/append-only). */
export interface AccessProjectionStore {
  readonly tenantId: string;
  /** Every admitted policy revision, sorted by (policyId, revision). */
  readonly policies: readonly SealedProjectionPolicy[];
  /** Every admitted canonical record, sorted by canonical record key. */
  readonly records: readonly CanonicalRecord[];
  /** Every admitted projection, sorted by content digest. */
  readonly projections: readonly SealedAuthorizedProjection[];
  /** The append-only audit trail, in append order. */
  readonly audits: readonly SealedProjectionAudit[];
  /** The audit-key index (evaluationKey -> sealed digest), sorted by key. */
  readonly auditKeys: readonly AuditKeyBinding[];
}

/** One audit-key binding (the replay index of the audit trail). */
export interface AuditKeyBinding {
  readonly evaluationKey: string;
  readonly auditDigest: string;
}

/** One policy admission outcome (duplicates are typed facts, never errors). */
export type PolicyAdmission =
  | { readonly kind: 'policy-admitted'; readonly policy: SealedProjectionPolicy }
  | {
      readonly kind: 'duplicate-policy-returned';
      readonly policy: SealedProjectionPolicy;
    };

/** One canonical-record admission outcome. */
export type RecordAdmission =
  | {
      readonly kind: 'record-admitted';
      readonly record: CanonicalRecord;
    }
  | {
      readonly kind: 'duplicate-record-returned';
      readonly record: CanonicalRecord;
    };

/** One audit append outcome (the replay discipline). */
export type AuditAdmission =
  | { readonly kind: 'audit-appended'; readonly audit: SealedProjectionAudit }
  | { readonly kind: 'duplicate-audit-returned'; readonly audit: SealedProjectionAudit };

/** One projection admission outcome. */
export type ProjectionAdmission =
  | {
      readonly kind: 'projection-admitted';
      readonly projection: SealedAuthorizedProjection;
    }
  | {
      readonly kind: 'duplicate-projection-returned';
      readonly projection: SealedAuthorizedProjection;
    };

/** The derived projection-state projection (deterministic counts). */
export interface AccessStateProjection {
  readonly tenantId: string;
  readonly policyCount: number;
  readonly policyRevisionCount: number;
  readonly activePolicyRevisionCount: number;
  readonly retiredPolicyRevisionCount: number;
  readonly recordCount: number;
  readonly recordsByClass: readonly { readonly objectClass: ObjectClass; readonly count: number }[];
  readonly projectionCount: number;
  readonly auditCount: number;
  readonly releasedAuditCount: number;
  readonly deniedAuditCount: number;
  readonly denialCounts: readonly { readonly code: string; readonly count: number }[];
}

/** Open an empty access-projection store for one tenant. */
export function openAccessProjectionStore(input: {
  readonly tenantId: string;
}): AccessProjectionResult<AccessProjectionStore> {
  const tenant = TenantIdSchema.safeParse(input.tenantId);
  if (!tenant.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'the access-projection store tenant id failed the tenancy grammar',
        issues: [
          { path: 'tenantId', message: tenant.error.issues[0]?.message ?? 'invalid tenant id' },
        ],
      },
    };
  }
  return {
    ok: true,
    value: {
      tenantId: tenant.data,
      policies: [],
      records: [],
      projections: [],
      audits: [],
      auditKeys: [],
    },
  };
}

// --------------------------------------------------------------------------------
// Policy registration + versioning.
// --------------------------------------------------------------------------------

/**
 * Admit one sealed projection policy revision (the append-only revision
 * chain: same revision + same digest = the typed duplicate; same
 * revision + different content = `version-conflict`; out-of-order or
 * gapped revisions = `lifecycle-conflict`).
 */
export function admitProjectionPolicy(
  store: AccessProjectionStore,
  policy: unknown,
): AccessProjectionResult<{ readonly store: AccessProjectionStore; readonly outcome: PolicyAdmission }> {
  const authority = authorityViolationError(policy);
  if (authority !== null) return { ok: false, error: authority };
  const verified = verifySealedProjectionPolicy(policy);
  if (!verified.ok) return { ok: false, error: verified.error };
  const sealed = verified.value;

  if (sealed.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message:
          `projection policy "${sealed.policyId}" belongs to tenant "${sealed.tenantId}" but the store is scoped to "${store.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: sealed.tenantId,
        subject: sealed.policyId,
      },
    };
  }

  const revisions = store.policies.filter((candidate) => candidate.policyId === sealed.policyId);
  const sameRevision = revisions.find((candidate) => candidate.revision === sealed.revision);
  if (sameRevision !== undefined) {
    if (sameRevision.contentDigest === sealed.contentDigest) {
      return {
        ok: true,
        value: {
          store,
          outcome: { kind: 'duplicate-policy-returned', policy: sameRevision },
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message:
          `policy "${sealed.policyId}" revision ${sealed.revision} is already registered with different content — ` +
          'a published revision is immutable (retire and register the next revision instead)',
        subject: sealed.policyId,
        expectedDigest: sameRevision.contentDigest,
        encounteredDigest: sealed.contentDigest,
      },
    };
  }
  const latest = revisions.reduce<number>(
    (max, candidate) => Math.max(max, candidate.revision),
    0,
  );
  const expectedRevision = latest + 1;
  if (sealed.revision !== expectedRevision) {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message:
          `policy "${sealed.policyId}" revision ${sealed.revision} cannot follow latest revision ${latest} — ` +
          'the revision chain is append-only and gap-free (register exactly the next revision)',
        subject: sealed.policyId,
      },
    };
  }

  return {
    ok: true,
    value: {
      store: {
        ...store,
        policies: [...store.policies, sealed].sort(
          (a, b) =>
            a.policyId < b.policyId
              ? -1
              : a.policyId > b.policyId
                ? 1
                : a.revision - b.revision,
        ),
      },
      outcome: { kind: 'policy-admitted', policy: sealed },
    },
  };
}

/** Find one admitted policy revision (exact). */
export function findPolicyRevision(
  store: AccessProjectionStore,
  policyId: string,
  revision: number,
): SealedProjectionPolicy | null {
  const found = store.policies.find(
    (candidate) => candidate.policyId === policyId && candidate.revision === revision,
  );
  return found ?? null;
}

// --------------------------------------------------------------------------------
// Canonical record admission.
// --------------------------------------------------------------------------------

/**
 * Admit one canonical sealed W036 record (opaque exact-revision
 * reference). The solution-version family admits chain revisions; the
 * immutable families reject a second content under the same record id
 * (`version-conflict`).
 */
export function admitCanonicalRecord(
  store: AccessProjectionStore,
  canonical: unknown,
): AccessProjectionResult<{ readonly store: AccessProjectionStore; readonly outcome: RecordAdmission }> {
  const parsed = canonical as CanonicalRecord | undefined;
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { objectClass?: unknown }).objectClass !== 'string'
  ) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'a canonical record admission requires an objectClass-tagged sealed W036 record',
        issues: [{ path: 'objectClass', message: 'missing object class tag' }],
      },
    };
  }
  const verified = verifyCanonicalRecord(parsed);
  if (!verified.ok) return { ok: false, error: verified.error };
  const record = verified.value;
  const identity = canonicalObjectIdentity(record);

  if (canonicalTenantId(record) !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message:
          `canonical record "${identity.objectId}" belongs to tenant "${canonicalTenantId(record)}" but the store is scoped to "${store.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: canonicalTenantId(record),
        subject: identity.objectId,
      },
    };
  }

  const sameObject = store.records.filter(
    (candidate) =>
      canonicalObjectIdentity(candidate).objectClass === identity.objectClass &&
      canonicalObjectIdentity(candidate).objectId === identity.objectId,
  );
  const sameRevision = sameObject.find(
    (candidate) => canonicalObjectIdentity(candidate).objectDigest === identity.objectDigest,
  );
  if (sameRevision !== undefined) {
    return {
      ok: true,
      value: {
        store,
        outcome: { kind: 'duplicate-record-returned', record: sameRevision },
      },
    };
  }
  if (sameObject.length > 0) {
    // The solution-version family is the hash-chained multi-revision
    // family: a new digest under the same solution id is a NEW chain
    // revision when the version differs, and a broken chain when it
    // does not (W036's own version-conflict).
    if (record.objectClass === 'solution-version') {
      const sameVersion = sameObject.find(
        (candidate) =>
          candidate.objectClass === 'solution-version' &&
          candidate.record.version === record.record.version,
      );
      if (sameVersion === undefined) {
        return appendRecord(store, record);
      }
      const priorDigest =
        sameVersion.objectClass === 'solution-version'
          ? sameVersion.record.contentDigest
          : canonicalObjectIdentity(sameVersion).objectDigest;
      return {
        ok: false,
        error: {
          code: 'version-conflict',
          message:
            `solution "${identity.objectId}" version ${record.record.version} is already admitted with different content — ` +
            'a published version revision is immutable (publish the next version instead)',
          subject: identity.objectId,
          expectedDigest: priorDigest,
          encounteredDigest: identity.objectDigest,
        },
      };
    }
    const prior = sameObject[0]!;
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message:
          `record "${identity.objectId}" (${identity.objectClass}) is already admitted with different content — ` +
          'an immutable canonical record never admits a second content under the same id',
        subject: identity.objectId,
        expectedDigest: canonicalObjectIdentity(prior).objectDigest,
        encounteredDigest: identity.objectDigest,
      },
    };
  }
  return appendRecord(store, record);
}

function appendRecord(
  store: AccessProjectionStore,
  record: CanonicalRecord,
): AccessProjectionResult<{ readonly store: AccessProjectionStore; readonly outcome: RecordAdmission }> {
  return {
    ok: true,
    value: {
      store: {
        ...store,
        records: [...store.records, record].sort((a, b) =>
          canonicalRecordKey(canonicalObjectIdentity(a)) < canonicalRecordKey(canonicalObjectIdentity(b))
            ? -1
            : 1,
        ),
      },
      outcome: { kind: 'record-admitted', record },
    },
  };
}

/** Find one admitted canonical record (exact revision). */
export function findCanonicalRecord(
  store: AccessProjectionStore,
  objectClass: ObjectClass,
  objectId: string,
  objectDigest: string,
): CanonicalRecord | null {
  const found = store.records.find((candidate) => {
    const identity = canonicalObjectIdentity(candidate);
    return (
      identity.objectClass === objectClass &&
      identity.objectId === objectId &&
      identity.objectDigest === objectDigest
    );
  });
  return found ?? null;
}

// --------------------------------------------------------------------------------
// The append-only audit trail (replay discipline).
// --------------------------------------------------------------------------------

/**
 * Append one sealed audit record (the replay discipline: the same
 * evaluation key with identical content returns the SEALED PRIOR record
 * — a duplicate evaluation is idempotent; the same key with DIFFERENT
 * content is the typed `replay-conflict`).
 */
export function appendAuditRecord(
  store: AccessProjectionStore,
  audit: unknown,
): AccessProjectionResult<{ readonly store: AccessProjectionStore; readonly outcome: AuditAdmission }> {
  const verified = verifySealedProjectionAudit(audit);
  if (!verified.ok) return { ok: false, error: verified.error };
  const sealed = verified.value;

  if (sealed.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message:
          `audit record "${sealed.auditId}" belongs to tenant "${sealed.tenantId}" but the store is scoped to "${store.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: sealed.tenantId,
        subject: sealed.auditId,
      },
    };
  }

  const priorBinding = store.auditKeys.find(
    (binding) => binding.evaluationKey === sealed.evaluationKey,
  );
  if (priorBinding !== undefined) {
    const prior = store.audits.find(
      (candidate) => candidate.contentDigest === priorBinding.auditDigest,
    );
    if (prior !== undefined) {
      if (prior.contentDigest === sealed.contentDigest) {
        return {
          ok: true,
          value: {
            store,
            outcome: { kind: 'duplicate-audit-returned', audit: prior },
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'replay-conflict',
          message:
            `evaluation key ${sealed.evaluationKey.slice(0, 16)}… is already sealed with different audit content — ` +
            'the audit trail is replay-safe: identical inputs produce identical digests, and the trail never forks',
          evaluationKey: sealed.evaluationKey,
          sealedDigest: prior.contentDigest,
          encounteredDigest: sealed.contentDigest,
        },
      };
    }
  }

  return {
    ok: true,
    value: {
      store: {
        ...store,
        audits: [...store.audits, sealed],
        auditKeys: [
          ...store.auditKeys,
          { evaluationKey: sealed.evaluationKey, auditDigest: sealed.contentDigest },
        ].sort((a, b) => (a.evaluationKey < b.evaluationKey ? -1 : 1)),
      },
      outcome: { kind: 'audit-appended', audit: sealed },
    },
  };
}

// --------------------------------------------------------------------------------
// Projection admission (identity-fork gate + field-leak gate).
// --------------------------------------------------------------------------------

/**
 * Admit one sealed authorized projection. Three defense-in-depth gates
 * beyond seal verification:
 *
 * 1. IDENTITY: the projection must cite the canonical record's exact
 *    revision — an object id with a non-canonical digest is the typed
 *    `identity-fork-rejected` (projections never mint identities);
 * 2. POLICY: the cited policy revision must be admitted with the same
 *    digest, and a binding must exist for the projection's subject;
 * 3. FIELD-LEAK: every released path must be inside the policy row's
 *    minimum-necessary selection (re-derived deterministically from the
 *    admitted record) — a path outside policy is the typed
 *    `field-leak-rejected`.
 */
export function admitProjection(
  store: AccessProjectionStore,
  projection: unknown,
): AccessProjectionResult<{ readonly store: AccessProjectionStore; readonly outcome: ProjectionAdmission }> {
  const verified = verifySealedAuthorizedProjection(projection);
  if (!verified.ok) return { ok: false, error: verified.error };
  const sealed = verified.value;

  if (sealed.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message:
          `projection of "${sealed.objectId}" belongs to tenant "${sealed.tenantId}" but the store is scoped to "${store.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: sealed.tenantId,
        subject: sealed.objectId,
      },
    };
  }

  const duplicate = store.projections.find(
    (candidate) => candidate.contentDigest === sealed.contentDigest,
  );
  if (duplicate !== undefined) {
    return {
      ok: true,
      value: {
        store,
        outcome: { kind: 'duplicate-projection-returned', projection: duplicate },
      },
    };
  }

  // Gate 1: identity (the canonical exact revision must be admitted).
  const sameObject = store.records.filter((candidate) => {
    const identity = canonicalObjectIdentity(candidate);
    return identity.objectClass === sealed.objectClass && identity.objectId === sealed.objectId;
  });
  if (sameObject.length === 0) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message:
          `the projection cites canonical object ("${sealed.objectClass}", "${sealed.objectId}") but no such record is admitted`,
        referenceKind: 'canonical-record',
        referenceId: sealed.objectId,
      },
    };
  }
  const canonicalRevision = sameObject.find(
    (candidate) => canonicalObjectIdentity(candidate).objectDigest === sealed.objectDigest,
  );
  if (canonicalRevision === undefined) {
    return {
      ok: false,
      error: {
        code: 'identity-fork-rejected',
        message:
          `the projection cites object "${sealed.objectId}" at digest ${sealed.objectDigest.slice(0, 16)}… but the ` +
          `canonical record exists only at digest ${canonicalObjectIdentity(sameObject[0]!).objectDigest.slice(0, 16)}… — ` +
          'projections carry the canonical identity, they never mint one',
        objectClass: sealed.objectClass,
        objectId: sealed.objectId,
        expectedObjectDigest: canonicalObjectIdentity(sameObject[0]!).objectDigest,
        encounteredObjectDigest: sealed.objectDigest,
      },
    };
  }

  // Gate 2: policy (the cited revision must be admitted, same digest).
  const policy = findPolicyRevision(store, sealed.policyRef.policyId, sealed.policyRef.revision);
  if (policy === null) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message:
          `the projection cites policy "${sealed.policyRef.policyId}" revision ${sealed.policyRef.revision} but no such revision is admitted`,
        referenceKind: 'policy-revision',
        referenceId: `${sealed.policyRef.policyId}#${sealed.policyRef.revision}`,
      },
    };
  }
  if (policy.contentDigest !== sealed.policyRef.policyDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          `the projection cites policy "${sealed.policyRef.policyId}" revision ${sealed.policyRef.revision} at digest ` +
          `${sealed.policyRef.policyDigest.slice(0, 16)}… but the admitted revision digests to ${policy.contentDigest.slice(0, 16)}…`,
        expected: policy.contentDigest,
        encountered: sealed.policyRef.policyDigest,
      },
    };
  }

  // Gate 3: field leaks (re-derive the minimum-necessary selection).
  const binding =
    sealed.taskContext !== undefined
      ? selectTaskBinding(policy, sealed.taskContext.taskClass, sealed.objectClass)
      : selectRoleBinding(policy, sealed.subject, sealed.objectClass);
  if (binding === null) {
    return {
      ok: false,
      error: {
        code: 'policy-binding-missing',
        message:
          `the projection's subject (${sealed.subject.principalKind}, ${
            sealed.taskContext !== undefined
              ? sealed.taskContext.taskClass
              : sealed.subject.role ?? '<no role>'
          }) has no policy row for object class "${sealed.objectClass}" in policy "${policy.policyId}"`,
        principalKind: sealed.subject.principalKind,
        ...(sealed.subject.role !== undefined ? { role: sealed.subject.role } : {}),
        ...(sealed.subject.agentTaskClass !== undefined
          ? { agentTaskClass: sealed.subject.agentTaskClass }
          : {}),
        objectClass: sealed.objectClass,
      },
    };
  }
  const selection = selectVisiblePaths(binding, canonicalRevision, sealed.taskContext);
  const allowed = new Set(selection.released);
  const leaked = sealed.entries
    .filter((entry) => entry.kind === 'released')
    .filter((entry) => !allowed.has(entry.path))
    .map((entry) => entry.path);
  if (leaked.length > 0) {
    return {
      ok: false,
      error: {
        code: 'field-leak-rejected',
        message:
          `the projection releases ${leaked.length} path(s) outside the policy row's minimum-necessary selection ` +
          `("${policy.policyId}" revision ${policy.revision}) — a policy-denied field NEVER appears in a projection`,
        leakedPaths: leaked.sort(),
        policyId: policy.policyId,
        revision: policy.revision,
      },
    };
  }

  return {
    ok: true,
    value: {
      store: {
        ...store,
        projections: [...store.projections, sealed].sort((a, b) =>
          a.contentDigest < b.contentDigest ? -1 : 1,
        ),
      },
      outcome: { kind: 'projection-admitted', projection: sealed },
    },
  };
}

// --------------------------------------------------------------------------------
// The derived projection-state projection.
// --------------------------------------------------------------------------------

/** Project the derived access-projection state (deterministic counts). */
export function projectAccessState(store: AccessProjectionStore): AccessStateProjection {
  const policyIds = new Set(store.policies.map((policy) => policy.policyId));
  const activeRevisions = store.policies.filter((policy) => policy.status === 'active');
  const retiredRevisions = store.policies.filter((policy) => policy.status === 'retired');

  const classCounts = new Map<ObjectClass, number>();
  for (const record of store.records) {
    const identity = canonicalObjectIdentity(record);
    classCounts.set(identity.objectClass, (classCounts.get(identity.objectClass) ?? 0) + 1);
  }

  const denialCounts = new Map<string, number>();
  let released = 0;
  let denied = 0;
  for (const audit of store.audits) {
    if (audit.outcome === 'released') {
      released += 1;
    } else {
      denied += 1;
      const code = audit.denialCode ?? 'unknown';
      denialCounts.set(code, (denialCounts.get(code) ?? 0) + 1);
    }
  }

  return {
    tenantId: store.tenantId,
    policyCount: policyIds.size,
    policyRevisionCount: store.policies.length,
    activePolicyRevisionCount: activeRevisions.length,
    retiredPolicyRevisionCount: retiredRevisions.length,
    recordCount: store.records.length,
    recordsByClass: [...classCounts.entries()]
      .map(([objectClass, count]) => ({ objectClass, count }))
      .sort((a, b) => (a.objectClass < b.objectClass ? -1 : 1)),
    projectionCount: store.projections.length,
    auditCount: store.audits.length,
    releasedAuditCount: released,
    deniedAuditCount: denied,
    denialCounts: [...denialCounts.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => (a.code < b.code ? -1 : 1)),
  };
}
