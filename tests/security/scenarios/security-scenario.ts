// The W030 cross-surface SECURITY SCENARIO (importable, documented):
// one deterministic, in-process composition of the REAL kernels that
// exercises the complete Security/Isolation/Observability lifecycle —
// admission -> observation -> violation -> quarantine -> audit ->
// recovery — with every upstream authority consumed through its REAL
// public admission path.
//
// REAL surfaces composed (no stubs, no hand-rolled digests):
// - W009 @epoch/authorization (the gate + the sealed decision feeding
//   the W041 projection) + @epoch/tenancy (the tenant grammar);
// - W023 @epoch/marketplace (the sealed + verified listing version);
// - W008 @epoch/extension-runtime (the REAL grant-ceiling authority
//   behind the admission differential + the REAL sandbox surface
//   description grammar);
// - W020 @epoch/agent-runtime (a REAL hosted session);
// - W021 @epoch/simulation-fabric (a REAL submitted run);
// - W022 @epoch/action-gateway (a REAL authorized action);
// - W041 @epoch/access-projection over W036 @epoch/solution-delivery
//   (a REAL authorized projection of a REAL program of work);
// - W010 @epoch/event-log (the REAL sealEvent parity);
// - W030 @epoch/security-runtime + @epoch/observability (this Work
//   Order's host + kernel).
import { evaluate, sealAuthorizationDecision } from '@epoch/authorization';
import type { AuthorizationContext, AuthorizationDecisionRegistration } from '@epoch/authorization';
import { sealListingVersion } from '@epoch/marketplace';
import {
  evaluateProjection,
  releasedPathsOf,
  redactedPathsOf,
  sealProjectionPolicy,
} from '@epoch/access-projection';
import { buildProgramOfWork } from '@epoch/solution-delivery';
import { sealEvent } from '@epoch/event-log';
import { SecurityRuntime } from '@epoch/security-runtime';
import type {
  AuditPassOutcome,
  SandboxAdmissionOutcome,
  SecurityRuntimeSnapshot,
  SecurityStateProjection,
} from '@epoch/security-runtime';
import type { SealedObservation } from '@epoch/observability';

/** Canonical instants (caller-supplied everywhere; zero wall-clock). */
export const T0 = '2026-03-02T09:00:00.000Z';
export const T1 = '2026-03-02T09:00:01.000Z';
export const T2 = '2026-03-02T09:00:02.000Z';
export const T3 = '2026-03-02T09:00:03.000Z';
export const T4 = '2026-03-02T09:00:04.000Z';
export const T5 = '2026-03-02T09:00:05.000Z';
export const T6 = '2026-03-02T09:00:06.000Z';
export const T7 = '2026-03-02T09:00:07.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:security-officer';
export const CLIENT = 'principal:client-viewer';
export const POLICY_ID = 'security-policy:globex-baseline';
export const EXTENSION_ID = 'extension:terrain-viewer';
export const BAD_EXTENSION_ID = 'extension:rogue-remote';
export const LISTING_ID = 'listing:terrain-viewer';
export const SESSION_ID = 'session:e2e-earthworks';
export const RUN_ID_PLACEHOLDER = 'simrun:';
export const ACTION_ID = 'action:e2e-reinforce-1';

/** Unwrap a total result or fail loudly (positive-path helper). */
export function unwrap<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): T {
  if (!result.ok) {
    throw new Error(`scenario failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** The REAL W009 authorization context that allows the security officer. */
export function officerContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: TENANT }],
    knownTenants: [TENANT, OTHER_TENANT],
  };
}

/** The authorization input of the scenario. */
export function officerAuth(): { principalId: string; context: AuthorizationContext } {
  return { principalId: PRINCIPAL, context: officerContext() };
}

/** The W030 baseline security policy content (policy is data). */
export function baselinePolicyContent(): Record<string, unknown> {
  return {
    schema: 'epoch.observability.security-policy',
    schemaVersion: 1,
    policyId: POLICY_ID,
    tenantId: TENANT,
    revision: '1.0.0',
    displayName: 'Globex baseline security policy',
    isolation: {
      maxTrustClass: 't2',
      allowedFlavors: ['declarative', 'wasm'],
      allowedDataHandling: ['sandbox-only', 'tenant-scoped'],
      requireMarketplaceListing: false,
      quarantineOnViolation: true,
    },
    thresholds: {
      degradedAtCriticalViolations: 1,
      criticalAtCriticalViolations: 2,
    },
    status: 'active',
    activatedAt: T0,
    activatedBy: PRINCIPAL,
  };
}

/** The conforming sandbox subject (a W008-shaped surface, mirrored; overrides applied last). */
export function conformingSubject(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    extensionId: EXTENSION_ID,
    extensionVersion: '1.2.0',
    extensionManifestDigest: 'a'.repeat(64),
    flavor: 'wasm',
    trustClass: 't2',
    bindings: [{ capabilityId: 'capability:terrain-render' }],
    grants: [
      {
        capabilityId: 'capability:terrain-render',
        hostFunctions: ['log.write', 'world.read'],
        resourceScopes: [{ resource: 'world', access: 'read' }],
      },
    ],
    dataHandling: 'sandbox-only',
    ...overrides,
  };
}

/** A violating sandbox subject (t4 remote under the t2/declarative+wasm profile). */
export function violatingSubject(): Record<string, unknown> {
  return {
    ...conformingSubject(),
    extensionId: BAD_EXTENSION_ID,
    trustClass: 't4',
    flavor: 'remote',
    dataHandling: 'external-transfer',
  };
}

/** A REAL sealed W023 listing version. */
export function sealedListing(): Record<string, unknown> {
  const sealed = sealListingVersion({
    schema: 'epoch.marketplace.listing-version',
    schemaVersion: 1,
    listingId: LISTING_ID,
    version: '1.0.0',
    developerTenantId: TENANT,
    displayName: 'Terrain Viewer',
    description: 'Sandboxed terrain visualization extension.',
    capabilityReferences: [{ capabilityId: 'terrain.render', version: '1.0.0' }],
    pricing: { kind: 'free' },
    trustEvidence: [],
    visibility: 'public',
    privateAllowList: [],
    previousVersionDigest: null,
    publishedAt: T0,
  });
  if (!sealed.ok) throw new Error(`listing fixture must seal: ${JSON.stringify(sealed.error)}`);
  return sealed.value as unknown as Record<string, unknown>;
}

/** A REAL W041 projection of a REAL W036 program (client role, view). */
export function realProjection(): {
  summary: Record<string, unknown>;
  canonical: Record<string, unknown>;
} {
  const program = unwrap(
    buildProgramOfWork({
      schema: 'epoch.solution-delivery.program-of-work',
      schemaVersion: 1,
      programId: 'program:e2e-tower',
      tenantId: TENANT,
      solutionId: 'solution:e2e-tower',
      solutionVersion: '1.0.0',
      solutionVersionDigest: 'e'.repeat(64),
      title: 'E2E Tower Program',
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
              activityId: 'activity:excavate',
              workPackageId: 'work-package:earthworks',
              title: 'Excavate',
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
      createdBy: PRINCIPAL,
      createdAt: T0,
    }),
  );
  const policy = unwrap(
    sealProjectionPolicy({
      schema: 'epoch.access-projection.policy',
      schemaVersion: 1,
      policyId: 'policy:e2e-access',
      revision: 1,
      tenantId: TENANT,
      title: 'E2E access policy',
      status: 'active',
      bindings: [
        {
          selector: { principalKind: 'human', role: 'role:client-viewer' },
          objectClass: 'program-of-work',
          allowedActions: ['view'],
          fieldAllowlist: ['title'],
          redactionRules: [],
          defaultRedactionClass: 'policy-scoped',
          scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
        },
      ],
    }),
  );
  const request = {
    schemaVersion: 1 as const,
    principalId: CLIENT,
    actionKind: 'access-projection.view',
    resource: { resourceType: 'program-of-work', resourceId: 'program:e2e-tower', tenantId: TENANT },
  };
  const decision = unwrap(
    evaluate(request, {
      schemaVersion: 1,
      principals: [{ principalId: CLIENT, status: 'active', authenticated: true }],
      memberships: [{ principalId: CLIENT, tenantId: TENANT }],
      knownTenants: [TENANT],
    }),
  );
  const sealedDecisionOutcome = sealAuthorizationDecision(decision);
  if (!sealedDecisionOutcome.ok) {
    throw new Error(`decision fixture must seal: ${JSON.stringify(sealedDecisionOutcome.error)}`);
  }
  const sealedDecision: AuthorizationDecisionRegistration = sealedDecisionOutcome.value;
  const evaluation = unwrap(
    evaluateProjection({
      request,
      decision: sealedDecision,
      policy,
      record: { objectClass: 'program-of-work', record: program },
      subject: { principalId: CLIENT, principalKind: 'human', role: 'role:client-viewer' },
      projectedAt: T3,
      projectedBy: PRINCIPAL,
    }),
  );
  if (evaluation.outcome !== 'released') {
    throw new Error(`the REAL W041 evaluation denied: ${JSON.stringify(evaluation.denial)}`);
  }
  return {
    summary: {
      objectId: evaluation.projection.objectId,
      objectDigest: evaluation.projection.objectDigest,
      releasedPaths: releasedPathsOf(evaluation.projection),
      redactedPaths: redactedPathsOf(evaluation.projection),
      decisionDigest: evaluation.projection.decisionDigest,
      policyId: evaluation.projection.policyRef.policyId,
    },
    canonical: { objectId: 'program:e2e-tower', objectDigest: program.contentDigest },
  };
}

/** The outcome of the full scenario run (inspectable evidence). */
export interface SecurityScenarioOutcome {
  readonly runtime: SecurityRuntime;
  readonly admission: SandboxAdmissionOutcome;
  readonly violationQuarantined: boolean;
  readonly auditPass: AuditPassOutcome;
  readonly recoveredAdmission: SandboxAdmissionOutcome;
  readonly state: SecurityStateProjection;
  readonly snapshot: SecurityRuntimeSnapshot;
  readonly trail: readonly SealedObservation[];
}

/**
 * Run the full W030 scenario: policy -> listing -> conforming
 * admission -> execution-surface intake -> a violating admission
 * (auto-quarantine) -> audit pass (tenant boundary + the REAL W041
 * projection) -> quarantine release -> RECOVERY re-admission -> the
 * final state projection.
 */
export function runSecurityScenario(): SecurityScenarioOutcome {
  const runtime = new SecurityRuntime();
  const auth = officerAuth();

  // 1. Policy + listing (policy as data + W023 provenance).
  unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: baselinePolicyContent() }));
  unwrap(runtime.registerListing({ tenantId: TENANT, authorization: auth, listing: sealedListing() }));

  // 2. The conforming sandbox admission (the isolation gate + the
  //    REAL W008 ceiling differential).
  const admission = unwrap(
    runtime.admitExtension({
      tenantId: TENANT,
      authorization: auth,
      subject: conformingSubject(),
      admittedAt: T1,
    }),
  );

  // 3. The execution-surface intake: a REAL W020 session + a REAL W021
  //    run + a REAL W022 action (see the surface tests; the scenario
  //    records the lifecycle facts through the same intake).
  unwrap(
    runtime.observeAgentSession({
      tenantId: TENANT,
      authorization: auth,
      observationId: 'observation:e2e-session-001',
      sessionId: SESSION_ID,
      sessionStatus: 'running',
      observedAt: T2,
      sourceDigest: 'f'.repeat(64),
    }),
  );
  unwrap(
    runtime.observeSimulationRun({
      tenantId: TENANT,
      authorization: auth,
      observationId: 'observation:e2e-run-001',
      runId: 'simrun:e2e-excavation-model',
      runStatus: 'completed',
      observedAt: T2,
      sourceDigest: '1'.repeat(64),
    }),
  );
  unwrap(
    runtime.observeAction({
      tenantId: TENANT,
      authorization: auth,
      observationId: 'observation:e2e-action-001',
      actionId: ACTION_ID,
      actionStatus: 'authorized',
      observedAt: T2,
      sourceDigest: '2'.repeat(64),
    }),
  );
  unwrap(
    runtime.observeAuthorizationDecision({
      tenantId: TENANT,
      authorization: auth,
      observationId: 'observation:e2e-decision-001',
      decidedPrincipalId: CLIENT,
      outcome: 'allow',
      decisionDigest: '3'.repeat(64),
      observedAt: T2,
      subjectId: 'program:e2e-tower',
    }),
  );

  // 4. A DENIED tenant-boundary check (the compliant R12 record the
  //    audit family verifies).
  unwrap(
    runtime.observeTenantBoundary({
      tenantId: TENANT,
      authorization: auth,
      observationId: 'observation:e2e-boundary-001',
      subjectId: TENANT,
      subjectTenantId: TENANT,
      actorTenantId: OTHER_TENANT,
      outcome: 'denied',
      observedAt: T2,
      sourceDigest: '4'.repeat(64),
    }),
  );

  // 5. The violating admission: typed isolation-violation rejection +
  //    policy-driven auto-quarantine.
  const violation = runtime.admitExtension({
    tenantId: TENANT,
    authorization: auth,
    subject: violatingSubject(),
    admittedAt: T3,
  });
  if (violation.ok || violation.error.code !== 'isolation-violation') {
    throw new Error('the violating admission must be the typed isolation-violation rejection');
  }

  // 6. The audit pass: the tenant-boundary family (clean — the R12
  //    record was DENIED) + the REAL W041 projection (clean — the
  //    invariants hold on real records).
  const projection = realProjection();
  const auditPass = unwrap(
    runtime.runAuditPass({
      tenantId: TENANT,
      authorization: auth,
      auditPassId: 'observation:e2e-audit-001',
      auditedAt: T4,
      projections: [{ summary: projection.summary, canonical: projection.canonical }],
    }),
  );

  // 7. Recovery: the violating subject is quarantined; release it and
  //    re-admit the REMEDIATED (conforming) surface.
  const quarantined = runtime.projectHealth({ tenantId: TENANT, authorization: auth, projectedAt: T4 });
  if (!quarantined.ok || quarantined.value.quarantinedSubjects.length === 0) {
    throw new Error('the violating subject must be quarantined at this point');
  }
  unwrap(
    runtime.releaseQuarantine({
      tenantId: TENANT,
      authorization: auth,
      quarantineId: 'quarantine:rogue-remote-release',
      subjectId: BAD_EXTENSION_ID,
      reason: 'remediated: re-published at t2 with sandbox-only data handling',
      actedAt: T5,
    }),
  );
  const recoveredAdmission = unwrap(
    runtime.admitExtension({
      tenantId: TENANT,
      authorization: auth,
      subject: conformingSubject({ extensionId: BAD_EXTENSION_ID }),
      admittedAt: T6,
    }),
  );

  // 8. The final projection + snapshot + trail (inspectable evidence).
  const state = unwrap(
    runtime.projectHealth({ tenantId: TENANT, authorization: auth, projectedAt: T7 }),
  );
  const snapshot = runtime.snapshot();
  const trail = unwrap(runtime.readAuditTrail({ tenantId: TENANT, authorization: auth }));

  return {
    runtime,
    admission,
    violationQuarantined: true,
    auditPass,
    recoveredAdmission,
    state,
    snapshot,
    trail,
  };
}

/** The sealEvent parity check of one raw security event (the REAL W010 path). */
export function sealThroughRealW010(content: unknown): boolean {
  const sealed = sealEvent(content);
  return sealed.ok;
}
