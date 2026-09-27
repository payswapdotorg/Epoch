/**
 * The TWO-STAGE evaluation pipeline (the W041 dispatch pin), strictly
 * ordered:
 *
 * STAGE 1 — the authorization decision point (W009) answers allow/deny.
 *   The kernel CONSUMES a prior decision record; it NEVER re-implements
 *   authorization (`authorization-bypass-rejected`: the kernel refuses
 *   to evaluate a projection without a prior decision record that
 *   verifiably covers the exact request — sealed digest, request digest
 *   binding, subject, resource and action kind all checked).
 *
 * STAGE 2 — the projection stage computes the visible subset:
 *   policy binding selection (data), action-grant check (the
 *   export/share ruling), task narrowing, then the zod-schema-driven
 *   field walk with minimum-necessary allowlist, evidence/commercial/
 *   supplier scope filters applied AFTER the walk, and the task object
 *   scope. Every walked leaf becomes a released field (BY REFERENCE) or
 *   a typed RedactionMarker — nothing is dropped.
 *
 * Every completed stage-2 decision — released OR denied — emits a sealed,
 * content-addressed ProjectionAuditRecord (identical inputs -> identical
 * digests; the evaluation key makes re-evaluation idempotent).
 *
 * Pure, total, deterministic: zero wall-clock reads (instants are
 * caller-supplied inputs), zero randomness, zero I/O.
 */
import {
  parseAuthorizationRequest,
  parseSealedAuthorizationDecision,
  computeAuthorizationRequestDigest,
  type AuthorizationDecisionRegistration,
  type AuthorizationRequest,
} from '@epoch/authorization';
import type { PrincipalId, Timestamp } from '@epoch/solution-delivery';
import { OBJECT_CLASS_SECTIONS } from './sections';
import {
  canonicalObjectIdentity,
  canonicalRecordSchemaOf,
  canonicalTenantId,
  verifyCanonicalRecord,
  type CanonicalRecord,
} from './records';
import {
  redactionClassOf,
  selectRoleBinding,
  selectTaskBinding,
  verifySealedProjectionPolicy,
  type PolicyBinding,
  type ProjectionSubject,
  type SealedProjectionPolicy,
} from './policy';
import { taskEscalationError, type TaskProjectionContext } from './task';
import {
  ancestorPrefixes,
  compileElementMatchers,
  compileTemplates,
  matchesAnyTemplate,
  walkSchemaLeaves,
  type LeafEntry,
} from './walk';
import {
  auditRecordIdOf,
  deriveEvaluationKey,
  kernelAuditProvenance,
  sealProjectionAudit,
  type SealedProjectionAudit,
} from './audit';
import {
  sealAuthorizedProjection,
  type ProjectionEntry,
  type SealedAuthorizedProjection,
} from './projection';
import {
  TASK_REDACTION_CLASS,
  actionOfActionKind,
  type ObjectClass,
  type ProjectionAction,
  type RedactionClass,
} from './version';
import type {
  AccessProjectionError,
  AccessProjectionResult,
  ProjectionDenial,
} from './errors';

/** The input of one projection evaluation (everything caller-supplied). */
export interface ProjectionEvaluationInput {
  /** The exact W009 request the decision answers (action kind `access-projection.<action>`). */
  readonly request: AuthorizationRequest;
  /** The SEALED prior W009 decision (decision + digest). */
  readonly decision: AuthorizationDecisionRegistration;
  /** The sealed projection policy revision to evaluate under. */
  readonly policy: SealedProjectionPolicy;
  /** The canonical sealed W036 record to project. */
  readonly record: CanonicalRecord;
  /** The subject the projection is computed for. */
  readonly subject: ProjectionSubject;
  /** The agent task context (narrows the projection; agents only). */
  readonly taskContext?: TaskProjectionContext | undefined;
  /** Caller-supplied instant of the projection (never a clock read). */
  readonly projectedAt: Timestamp;
  /** Caller-supplied principal performing the projection operation. */
  readonly projectedBy: PrincipalId;
}

/** One completed projection evaluation (released or denied — both audited). */
export type ProjectionEvaluation =
  | {
      readonly outcome: 'released';
      readonly projection: SealedAuthorizedProjection;
      readonly audit: SealedProjectionAudit;
    }
  | {
      readonly outcome: 'denied';
      readonly denial: ProjectionDenial;
      readonly audit: SealedProjectionAudit;
    };

/** The selected path set of one binding over one record (the selection core). */
export interface PathSelection {
  readonly released: readonly string[];
  readonly redacted: readonly { readonly path: string; readonly redactionClass: RedactionClass }[];
}

/** The fail-closed scope summary (nothing visible). */
function closedScopes(): {
  evidenceMode: 'all' | 'listed' | 'none';
  allowedEvidenceCount: number;
  commercial: 'visible' | 'hidden';
  supplier: 'visible' | 'hidden';
} {
  return {
    evidenceMode: 'none',
    allowedEvidenceCount: 0,
    commercial: 'hidden',
    supplier: 'hidden',
  };
}

/** The binding's scope summary (what the evaluation applied). */
function bindingScopes(binding: PolicyBinding): {
  evidenceMode: 'all' | 'listed' | 'none';
  allowedEvidenceCount: number;
  commercial: 'visible' | 'hidden';
  supplier: 'visible' | 'hidden';
} {
  return {
    evidenceMode: binding.scopeFilters.evidence.mode,
    allowedEvidenceCount:
      binding.scopeFilters.evidence.mode === 'listed'
        ? binding.scopeFilters.evidence.allowedDigests.length
        : 0,
    commercial: binding.scopeFilters.commercial,
    supplier: binding.scopeFilters.supplier,
  };
}

/**
 * The SELECTION CORE (pure, shared by the evaluator and the
 * admission-time leak check): walk the canonical record per its W036
 * zod schema, apply the minimum-necessary allowlist, then the
 * evidence/commercial/supplier scope filters (AFTER the walk), then the
 * task object scope. Returns the sorted released path set plus the
 * redaction class of every struck path.
 */
export function selectVisiblePaths(
  binding: PolicyBinding,
  record: CanonicalRecord,
  taskContext: TaskProjectionContext | undefined,
): PathSelection {
  const identity = canonicalObjectIdentity(record);
  const leaves = walkSchemaLeaves(
    canonicalRecordSchemaOf(identity.objectClass),
    record.record,
  );
  const byPath = new Map<string, LeafEntry>(leaves.map((leaf) => [leaf.path, leaf]));

  const allowlist = compileTemplates(binding.fieldAllowlist);
  const sections = OBJECT_CLASS_SECTIONS[identity.objectClass];
  const commercialMatchers = compileTemplates(sections.commercial);
  const supplierMatchers = compileTemplates(sections.supplier);
  const evidenceMatchers = compileElementMatchers(sections.evidence);

  const released: string[] = [];
  const redacted: { path: string; redactionClass: RedactionClass }[] = [];

  // The evidence allowlist (mode `listed`): the minimum-necessary W006 digests.
  const allowedEvidence =
    binding.scopeFilters.evidence.mode === 'listed'
      ? new Set(binding.scopeFilters.evidence.allowedDigests)
      : null;

  // The task object scope (which work packages/activities the task references).
  const scopedWorkPackages =
    taskContext !== undefined && taskContext.workPackageIds.length > 0
      ? new Set(taskContext.workPackageIds)
      : null;
  const scopedActivities =
    taskContext !== undefined && taskContext.activityIds.length > 0
      ? new Set(taskContext.activityIds)
      : null;

  for (const leaf of leaves) {
    // (1) Minimum-necessary allowlist (the field walk).
    if (!matchesAnyTemplate(leaf.path, allowlist)) {
      redacted.push({ path: leaf.path, redactionClass: redactionClassOf(binding, leaf.path) });
      continue;
    }
    // (2) Scope filters, applied AFTER the field walk.
    const evidenceElement = ancestorPrefixes(leaf.path).find((ancestor) =>
      matchesAnyTemplate(ancestor, evidenceMatchers),
    );
    if (evidenceElement !== undefined) {
      if (binding.scopeFilters.evidence.mode === 'none') {
        redacted.push({ path: leaf.path, redactionClass: 'evidence-scoped' });
        continue;
      }
      if (allowedEvidence !== null) {
        const digestLeaf = byPath.get(`${evidenceElement}.digest`);
        const digest = digestLeaf !== undefined ? String(digestLeaf.value) : null;
        if (digest === null || !allowedEvidence.has(digest)) {
          redacted.push({ path: leaf.path, redactionClass: 'evidence-scoped' });
          continue;
        }
      }
    }
    if (
      binding.scopeFilters.commercial === 'hidden' &&
      matchesAnyTemplate(leaf.path, commercialMatchers)
    ) {
      redacted.push({ path: leaf.path, redactionClass: 'commercial-sensitive' });
      continue;
    }
    if (
      binding.scopeFilters.supplier === 'hidden' &&
      matchesAnyTemplate(leaf.path, supplierMatchers)
    ) {
      redacted.push({ path: leaf.path, redactionClass: 'supplier-sensitive' });
      continue;
    }
    // (3) The task object scope (agent task projections are narrower).
    if (scopedWorkPackages !== null) {
      const workPackageAncestor = ancestorPrefixes(leaf.path).find((ancestor) =>
        /^workPackages\[\d+\]$/.test(ancestor),
      );
      if (workPackageAncestor !== undefined) {
        const idLeaf = byPath.get(`${workPackageAncestor}.workPackageId`);
        const workPackageId = idLeaf !== undefined ? String(idLeaf.value) : null;
        if (workPackageId === null || !scopedWorkPackages.has(workPackageId)) {
          redacted.push({ path: leaf.path, redactionClass: TASK_REDACTION_CLASS });
          continue;
        }
      }
    }
    if (scopedActivities !== null) {
      const activityAncestor = ancestorPrefixes(leaf.path).find((ancestor) =>
        /^workPackages\[\d+\]\.activities\[\d+\]$/.test(ancestor),
      );
      if (activityAncestor !== undefined) {
        const idLeaf = byPath.get(`${activityAncestor}.activityId`);
        const activityId = idLeaf !== undefined ? String(idLeaf.value) : null;
        if (activityId === null || !scopedActivities.has(activityId)) {
          redacted.push({ path: leaf.path, redactionClass: TASK_REDACTION_CLASS });
          continue;
        }
      }
    }
    released.push(leaf.path);
  }

  return {
    released: released.sort(),
    redacted: redacted.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  };
}

/** Map one @epoch/authorization error onto this kernel's taxonomy. */
function mapAuthorizationError(error: {
  code: string;
  message: string;
}): AccessProjectionError {
  return {
    code: 'validation',
    message: `the W009 request failed validation: ${error.message}`,
    issues: [{ path: 'request', message: error.message }],
  };
}

/** Build the audited DENIAL outcome (stage-2 decisions are always audited). */
function deniedEvaluation(
  input: ProjectionEvaluationInput,
  identity: { objectClass: ObjectClass; objectId: string; objectDigest: string },
  action: ProjectionAction,
  denial: ProjectionDenial,
  scopes: ReturnType<typeof bindingScopes>,
): AccessProjectionResult<ProjectionEvaluation> {
  const taskClass =
    input.taskContext !== undefined ? input.taskContext.taskClass : input.subject.agentTaskClass;
  const evaluationKey = deriveEvaluationKey({
    tenantId: canonicalTenantId(input.record),
    principalId: input.request.principalId,
    action,
    policyDigest: input.policy.contentDigest,
    objectClass: identity.objectClass,
    objectId: identity.objectId,
    objectDigest: identity.objectDigest,
    decisionDigest: input.decision.digest,
    ...(taskClass !== undefined ? { taskClass } : {}),
    projectedAt: input.projectedAt,
  });
  const audit = sealProjectionAudit({
    schema: 'epoch.access-projection.audit',
    schemaVersion: 1,
    auditId: auditRecordIdOf(evaluationKey),
    tenantId: canonicalTenantId(input.record),
    principalId: input.request.principalId,
    subject: input.subject,
    policyRef: {
      policyId: input.policy.policyId,
      revision: input.policy.revision,
      policyDigest: input.policy.contentDigest,
    },
    objectClass: identity.objectClass,
    objectId: identity.objectId,
    objectDigest: identity.objectDigest,
    decisionDigest: input.decision.digest,
    action,
    outcome: 'denied',
    denialCode: denial.code,
    fieldsReleased: [],
    fieldsRedacted: [],
    appliedScopes: scopes,
    evaluationKey,
    provenance: kernelAuditProvenance(input.projectedBy),
    projectedAt: input.projectedAt,
  });
  if (!audit.ok) return { ok: false, error: audit.error };
  return { ok: true, value: { outcome: 'denied', denial, audit: audit.value } };
}

/**
 * The two-stage projection evaluation (pure, total, deterministic).
 * Stage 1 consumes the W009 decision; stage 2 computes the visible
 * subset. Released and denied outcomes both carry the sealed audit
 * record; malformed inputs are typed errors.
 */
export function evaluateProjection(
  input: ProjectionEvaluationInput,
): AccessProjectionResult<ProjectionEvaluation> {
  // ---- Record + policy verification (W036/W041 seals, never re-implemented).
  const policyVerification = verifySealedProjectionPolicy(input.policy);
  if (!policyVerification.ok) return { ok: false, error: policyVerification.error };
  const recordVerification = verifyCanonicalRecord(input.record);
  if (!recordVerification.ok) return { ok: false, error: recordVerification.error };

  const identity = canonicalObjectIdentity(input.record);
  const tenantId = canonicalTenantId(input.record);

  // ---- STAGE 1: the W009 decision point (consumed, never re-implemented).
  if (
    typeof input.decision !== 'object' ||
    input.decision === null ||
    typeof (input.decision as { decision?: unknown }).decision !== 'object' ||
    (input.decision as { decision?: unknown }).decision === null
  ) {
    return {
      ok: false,
      error: {
        code: 'authorization-bypass-rejected',
        message:
          'the kernel refuses to evaluate a projection without a prior W009 decision record — ' +
          'stage 1 (the authorization decision point) always precedes the projection stage',
        reason: 'decision-missing',
      },
    };
  }
  const sealedDecision = parseSealedAuthorizationDecision(input.decision);
  if (!sealedDecision.ok) {
    return {
      ok: false,
      error: {
        code: 'authorization-bypass-rejected',
        message:
          `the kernel refuses to evaluate a projection without a verifiable prior W009 decision record ` +
          `(${sealedDecision.error.code}): ${sealedDecision.error.message}`,
        reason: 'decision-unverifiable',
      },
    };
  }
  const decision = sealedDecision.value.decision;

  const parsedRequest = parseAuthorizationRequest(input.request);
  if (!parsedRequest.ok) return { ok: false, error: mapAuthorizationError(parsedRequest.error) };
  const request = parsedRequest.value;

  const requestDigest = computeAuthorizationRequestDigest(request);
  if (requestDigest !== decision.requestDigest) {
    return {
      ok: false,
      error: {
        code: 'authorization-bypass-rejected',
        message:
          'the prior W009 decision does not cover this exact request (requestDigest mismatch) — ' +
          'the projection stage never runs on a decision minted for another request',
        reason: 'request-digest-mismatch',
      },
    };
  }
  if (request.principalId !== input.subject.principalId) {
    return {
      ok: false,
      error: {
        code: 'authorization-bypass-rejected',
        message:
          `the prior W009 decision answers principal "${request.principalId}" but the projection subject is ` +
          `"${input.subject.principalId}" — a decision never covers another subject`,
        reason: 'principal-mismatch',
      },
    };
  }
  if (decision.outcome === 'deny') {
    return {
      ok: false,
      error: {
        code: 'authorization-denied',
        message: `the W009 decision point denied this request (${decision.denial.code}): ${decision.denial.message}`,
        outcome: 'deny',
        denialCode: decision.denial.code,
      },
    };
  }
  if (decision.outcome === 'not-applicable') {
    return {
      ok: false,
      error: {
        code: 'authorization-denied',
        message:
          `the W009 decision point is not applicable to this request (${decision.reason}) — ` +
          'access-projection resources are tenant-scoped, so this is a fail-closed rejection',
        outcome: 'not-applicable',
        denialCode: decision.reason,
      },
    };
  }
  if (request.resource.tenantId !== tenantId || input.policy.tenantId !== tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message:
          `cross-tenant projection rejected (R12): the record is scoped to "${tenantId}", the request names ` +
          `"${request.resource.tenantId ?? '<absent>'}" and the policy is scoped to "${input.policy.tenantId}"`,
        expectedTenantId: tenantId,
        encounteredTenantId: request.resource.tenantId ?? input.policy.tenantId,
        subject: identity.objectId,
      },
    };
  }
  if (request.resource.resourceType !== identity.objectClass || request.resource.resourceId !== identity.objectId) {
    return {
      ok: false,
      error: {
        code: 'authorization-bypass-rejected',
        message:
          `the prior W009 decision covers resource ("${request.resource.resourceType}", "${request.resource.resourceId}") ` +
          `but the projection target is ("${identity.objectClass}", "${identity.objectId}") — a decision never covers another object`,
        reason: 'resource-mismatch',
      },
    };
  }
  const action = actionOfActionKind(request.actionKind);
  if (action === null) {
    return {
      ok: false,
      error: {
        code: 'authorization-bypass-rejected',
        message:
          `the request action kind "${request.actionKind}" is not an access-projection action ` +
          '(expected access-projection.view | access-projection.export | access-projection.share)',
        reason: 'action-kind-unknown',
      },
    };
  }

  // ---- STAGE 2: the projection stage (policy data drives everything).
  // Retired policy revisions never project again (append-only lifecycle).
  if (input.policy.status === 'retired') {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message:
          `projection policy "${input.policy.policyId}" revision ${input.policy.revision} is RETIRED — ` +
          'a retired policy revision never projects again',
        subject: input.policy.policyId,
      },
    };
  }

  if (input.taskContext !== undefined) {
    if (input.subject.principalKind !== 'agent') {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'a TaskProjectionContext narrows an AGENT projection (humans and services have roles, not tasks)',
          issues: [{ path: 'taskContext', message: 'task contexts require an agent subject' }],
        },
      };
    }
    if (input.subject.agentTaskClass !== input.taskContext.taskClass) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message:
            `the task context names class "${input.taskContext.taskClass}" but the subject declares ` +
            `"${input.subject.agentTaskClass ?? '<none>'}"`,
          issues: [{ path: 'taskContext.taskClass', message: 'task class must match the subject' }],
        },
      };
    }
  }

  const taskBinding =
    input.taskContext !== undefined
      ? selectTaskBinding(input.policy, input.taskContext.taskClass, identity.objectClass)
      : null;
  const roleBinding = selectRoleBinding(input.policy, input.subject, identity.objectClass);
  const binding = taskBinding ?? roleBinding;

  if (binding === null) {
    return deniedEvaluation(
      input,
      identity,
      action,
      {
        code: 'policy-binding-missing',
        message:
          `no policy row binds (${input.subject.principalKind}, ` +
          `${input.taskContext !== undefined ? input.taskContext.taskClass : input.subject.role ?? '<no role>'}) ` +
          `to object class "${identity.objectClass}" in policy "${input.policy.policyId}" revision ${input.policy.revision} — fail-closed`,
      },
      closedScopes(),
    );
  }

  if (taskBinding !== null && roleBinding !== null) {
    const escalation = taskEscalationError(
      roleBinding,
      taskBinding,
      input.taskContext!.taskClass,
      input.subject.role,
    );
    if (escalation !== null) {
      const denial: ProjectionDenial = {
        code: 'task-escalation-rejected',
        message: escalation.message,
      };
      return deniedEvaluation(input, identity, action, denial, bindingScopes(taskBinding));
    }
  }

  if (!binding.allowedActions.includes(action)) {
    const code =
      action === 'export'
        ? 'export-without-grant-rejected'
        : action === 'share'
          ? 'share-without-grant-rejected'
          : 'view-without-grant-rejected';
    return deniedEvaluation(
      input,
      identity,
      action,
      {
        code,
        message:
          `the selected policy row ("${input.policy.policyId}" revision ${input.policy.revision}) grants ` +
          `[${binding.allowedActions.join(', ')}] — the "${action}" action is not granted for this object`,
      },
      bindingScopes(binding),
    );
  }

  // ---- The selection core: walk + allowlist + scopes + task narrowing.
  const selection = selectVisiblePaths(binding, input.record, input.taskContext);
  const byPath = new Map(
    walkSchemaLeaves(
      canonicalRecordSchemaOf(identity.objectClass),
      input.record.record,
    ).map((leaf) => [leaf.path, leaf]),
  );
  const entries: ProjectionEntry[] = [];
  for (const path of selection.released) {
    entries.push({ kind: 'released', path, value: byPath.get(path)?.value ?? null });
  }
  for (const struck of selection.redacted) {
    entries.push({
      kind: 'redacted',
      path: struck.path,
      clause: {
        policyId: input.policy.policyId,
        revision: input.policy.revision,
        bindingIndex: input.policy.bindings.indexOf(binding) + 1,
      },
      redactionClass: struck.redactionClass,
    });
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const taskClass =
    input.taskContext !== undefined ? input.taskContext.taskClass : input.subject.agentTaskClass;
  const evaluationKey = deriveEvaluationKey({
    tenantId,
    principalId: request.principalId,
    action,
    policyDigest: input.policy.contentDigest,
    objectClass: identity.objectClass,
    objectId: identity.objectId,
    objectDigest: identity.objectDigest,
    decisionDigest: input.decision.digest,
    ...(taskClass !== undefined ? { taskClass } : {}),
    projectedAt: input.projectedAt,
  });

  const projection = sealAuthorizedProjection({
    schema: 'epoch.access-projection.projection',
    schemaVersion: 1,
    tenantId,
    objectClass: identity.objectClass,
    objectId: identity.objectId,
    objectDigest: identity.objectDigest,
    policyRef: {
      policyId: input.policy.policyId,
      revision: input.policy.revision,
      policyDigest: input.policy.contentDigest,
    },
    decisionDigest: input.decision.digest,
    subject: input.subject,
    action,
    ...(input.taskContext !== undefined ? { taskContext: input.taskContext } : {}),
    entries,
    projectedAt: input.projectedAt,
    projectedBy: input.projectedBy,
  });
  if (!projection.ok) return { ok: false, error: projection.error };

  const audit = sealProjectionAudit({
    schema: 'epoch.access-projection.audit',
    schemaVersion: 1,
    auditId: auditRecordIdOf(evaluationKey),
    tenantId,
    principalId: request.principalId,
    subject: input.subject,
    policyRef: {
      policyId: input.policy.policyId,
      revision: input.policy.revision,
      policyDigest: input.policy.contentDigest,
    },
    objectClass: identity.objectClass,
    objectId: identity.objectId,
    objectDigest: identity.objectDigest,
    decisionDigest: input.decision.digest,
    action,
    outcome: 'released',
    fieldsReleased: selection.released,
    fieldsRedacted: selection.redacted.map((entry) => entry.path),
    appliedScopes: bindingScopes(binding),
    evaluationKey,
    provenance: kernelAuditProvenance(input.projectedBy),
    projectedAt: input.projectedAt,
  });
  if (!audit.ok) return { ok: false, error: audit.error };

  return {
    ok: true,
    value: { outcome: 'released', projection: projection.value, audit: audit.value },
  };
}
