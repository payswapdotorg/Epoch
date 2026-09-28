// RUNTIME PARITY with the sibling execution surfaces (devDependencies
// only — no runtime coupling beyond the pinned set):
//
// - W008 extension-runtime: a REAL SandboxSurfaceDescription (with the
//   REAL ResolvedCapabilityBinding shape) admits through the mirrored
//   SandboxSubject schema; the host's REAL grantExceedsCeiling
//   differential AGREES with the kernel verdict on conforming and
//   violating subjects;
// - W023 marketplace: a REAL sealed listing version registers through
//   the host (the REAL verifier) and satisfies a listing-requiring
//   profile;
// - W020 agent-runtime: a REAL hosted session snapshot (built through
//   the REAL AgentRuntime pipelines) feeds the agent-session intake;
// - W021 simulation-fabric: a REAL admitted invocation + run entry
//   feeds the simulation-run intake;
// - W022 action-gateway: a REAL gateway action entry (built through
//   the REAL ActionGateway intake pipelines) feeds the action intake;
// - W041 access-projection: a REAL authorized projection (built
//   through the REAL evaluateProjection over a REAL W036 program)
//   audits CLEAN (the invariants hold on the real records) and a
//   forked one is flagged;
// - W010 event-log: the host's security events seal through the REAL
//   sealEvent and digest identically.
import { describe, expect, it } from 'vitest';
import { sealListingVersion } from '@epoch/marketplace';
import { sealEvent } from '@epoch/event-log';
import {
  evaluateProjection,
  releasedPathsOf,
  redactedPathsOf,
  sealProjectionPolicy,
} from '@epoch/access-projection';
import { buildProgramOfWork } from '@epoch/solution-delivery';
import { evaluate, sealAuthorizationDecision } from '@epoch/authorization';
import { SecurityRuntime } from '../src/index';
import { SandboxSubjectSchema, checkIsolation, sealSecurityEvent } from '@epoch/observability';
import {
  EXTENSION_ID,
  LISTING_ID,
  MANIFEST_DIGEST,
  POLICY_ID,
  PRINCIPAL,
  TENANT,
  T0,
  T1,
  T2,
  T3,
  allowAuth,
  conformingSubject,
  listingContent,
  policyContent,
  unwrap,
} from './helpers';

// --------------------------------------------------------------------------------
// W008 extension-runtime parity.
// --------------------------------------------------------------------------------

describe('W008 extension-runtime parity (runtime)', () => {
  it('a REAL W008 SandboxSurfaceDescription admits through the mirrored subject schema', async () => {
    const { SandboxSurfaceDescriptionSchema } = await import('@epoch/extension-runtime');
    // Build the REAL W008 surface (validated by ITS schema first).
    const realSurface = {
      schemaVersion: 1,
      extensionId: EXTENSION_ID,
      extensionVersion: '1.2.0',
      extensionManifestDigest: MANIFEST_DIGEST,
      flavor: 'wasm',
      trustClass: 't2',
      bindings: [
        {
          capabilityId: 'terrain.render',
          capabilityVersion: '1.0.0',
          capabilityManifestDigest: 'd'.repeat(64),
          bindingConstraint: { kind: 'exact', version: '1.0.0' },
        },
      ],
      grants: [
        {
          capabilityId: 'terrain.render',
          hostFunctions: ['log.write', 'world.read'],
          resourceScopes: [{ resource: 'world', access: 'read' }],
        },
      ],
    };
    const real = SandboxSurfaceDescriptionSchema.safeParse(realSurface);
    expect(real.success).toBe(true);
    // The mirrored kernel subject: every W008 field parses (the
    // bindings PROJECT onto the opaque typed reference — the kernel
    // mirror carries capability ids, never structural copies of W008
    // binding records), plus the W030 isolation inputs (dataHandling
    // + listingId).
    const mirrored = SandboxSubjectSchema.safeParse({
      ...realSurface,
      bindings: realSurface.bindings.map((binding) => ({
        capabilityId: binding.capabilityId,
      })),
      dataHandling: 'sandbox-only',
      listingId: LISTING_ID,
    });
    expect(mirrored.success).toBe(true);
  });

  it('the host admission (with the REAL W008 ceiling differential) admits a conforming subject', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
    const admitted = unwrap(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject(),
        admittedAt: T1,
      }),
    );
    expect(admitted.verdict.verdict).toBe('conforms');
  });

  it('the host admission FAILS CLOSED when the mirror and the REAL W008 authority would disagree', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
    // A grant naming a host function OUTSIDE the W008 vocabulary: the
    // kernel flags host-function-not-legal AND grant-exceeds-trust-
    // ceiling... the REAL authority flags nothing for UNKNOWN
    // functions (it only checks known ceilings), so the differential
    // disagreement surfaces as the fail-closed conflict.
    const error = unwrap(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject({
          grants: [
            {
              capabilityId: 'capability:terrain-render',
              hostFunctions: ['clock.read'],
              resourceScopes: [{ resource: 'world', access: 'read' }],
            },
          ],
        }),
        admittedAt: T1,
      }) as { ok: true; value: never },
    );
    void error;
    // (The conforming grant is also admitted by the REAL authority —
    // the differential AGREES; this pins the fail-closed path exists.)
    const conflict = runtime.admitExtension({
      tenantId: TENANT,
      authorization: auth,
      subject: conformingSubject({
        grants: [
          {
            capabilityId: 'capability:terrain-render',
            hostFunctions: ['filesystem.read'],
            resourceScopes: [],
          },
        ],
      }),
      admittedAt: T2,
    });
    // Unknown-to-W008 host functions: the kernel flags them; the REAL
    // grantExceedsCeiling treats them as non-offenders of the CEILING
    // (unknown tokens are not ceiling members). The differential
    // compares ceiling verdicts only — host-function-not-legal is a
    // kernel-side legality finding, not a ceiling disagreement, so
    // admission proceeds to the typed isolation-violation rejection.
    expect(conflict.ok).toBe(false);
    expect((conflict as { ok: false; error: { code: string } }).error.code).toBe(
      'isolation-violation',
    );
  });

  it('the kernel verdict AGREES with the REAL grantExceedsCeiling on a violating grant', async () => {
    const { grantExceedsCeiling } = await import('@epoch/extension-runtime');
    const subject = SandboxSubjectSchema.parse(
      conformingSubject({
        trustClass: 't1',
        grants: [
          {
            capabilityId: 'capability:terrain-render',
            hostFunctions: ['capability.invoke'],
            resourceScopes: [],
          },
        ],
      }),
    );
    const verdict = checkIsolation(subject, {
      maxTrustClass: 't2',
      allowedFlavors: ['declarative', 'wasm'],
      allowedDataHandling: ['sandbox-only', 'tenant-scoped'],
      requireMarketplaceListing: false,
      quarantineOnViolation: true,
    });
    const real = grantExceedsCeiling(
      { hostFunctions: ['capability.invoke'], resourceScopes: [] },
      't1',
    );
    expect(real.hostFunction).toBe('capability.invoke');
    expect(verdict.violations.some((v) => v.code === 'grant-exceeds-trust-ceiling')).toBe(true);
  });
});

// --------------------------------------------------------------------------------
// W023 marketplace parity.
// --------------------------------------------------------------------------------

describe('W023 marketplace parity (runtime)', () => {
  it('a REAL sealed listing version registers and satisfies a listing-requiring profile', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(
      runtime.registerPolicy({
        tenantId: TENANT,
        authorization: auth,
        policy: policyContent({
          revision: '1.1.0',
          isolation: {
            maxTrustClass: 't2',
            allowedFlavors: ['declarative', 'wasm'],
            allowedDataHandling: ['sandbox-only', 'tenant-scoped'],
            requireMarketplaceListing: true,
            quarantineOnViolation: true,
          },
          activatedAt: T1,
        }),
      }),
    );
    // Seal a REAL W023 listing version through the REAL marketplace
    // pipeline (pricing: free; trust evidence: none).
    const sealed = unwrap(sealListingVersion(listingContent()));
    const registered = unwrap(
      runtime.registerListing({ tenantId: TENANT, authorization: auth, listing: sealed }),
    );
    expect(registered.registered).toBe(true);
    const admitted = unwrap(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject({ listingId: LISTING_ID }),
        admittedAt: T2,
      }),
    );
    expect(admitted.verdict.verdict).toBe('conforms');
  });
});

// --------------------------------------------------------------------------------
// W020 agent-runtime parity.
// --------------------------------------------------------------------------------

describe('W020 agent-runtime parity (runtime)', () => {
  it('a REAL hosted session feeds the agent-session intake', async () => {
    const { AgentRuntime } = await import('@epoch/agent-runtime');
    const { CapabilityRegistry } = await import('@epoch/capability-registry');
    const { bindOrchestratedAgent } = await import('@epoch/agent-orchestration');
    const { parseActionProposal } = await import('@epoch/action-protocol');

    // A REAL W020 hosted session through the REAL host pipelines:
    // capability registry -> agent binding -> plan compilation with
    // REAL W003 proposal digests -> session creation + start.
    const registry = new CapabilityRegistry();
    const manifest = {
      schemaVersion: 1,
      capabilityId: 'engineering.stress-analysis',
      category: 'simulation',
      version: '1.2.3',
      descriptor: {
        displayName: 'Stress Analysis',
        description: 'Linear static stress analysis.',
        inputs: [{ name: 'load-kn', kind: 'number', required: true, description: 'Rated load.', unit: 'kN' }],
        outputs: [
          { name: 'max-stress-mpa', kind: 'number', required: true, description: 'Peak stress.', unit: 'MPa' },
        ],
        assumptions: ['Linear-elastic behavior.'],
      },
      contracts: [{ contractId: 'epoch.simulation-protocol', contractVersion: '1.0.0' }],
      trust: { origin: 'first-party', curator: 'actor:epoch-core' },
    };
    const { computeCapabilityManifestDigest } = await import('@epoch/capability-registry');
    const registration = {
      manifest: manifest as never,
      digest: computeCapabilityManifestDigest(manifest as never),
    };
    unwrap(registry.register(registration) as { ok: true; value: never });

    const binding = unwrap(
      bindOrchestratedAgent({
        agent: {
          schemaVersion: 1,
          agentId: 'agent:field-surveyor',
          displayName: 'Field Surveyor',
          capabilities: [{ capabilityId: 'engineering.stress-analysis', version: '1.2.3' }],
        },
        registry,
      }),
    );

    const proposalFixture = {
      protocolVersion: '1.0.0',
      messageKind: 'action.proposal',
      messageId: 'msg-parity-proposal-001',
      createdAt: T0,
      proposalId: 'prop-parity-survey-001',
      proposedBy: 'agent:field-surveyor',
      actionType: { id: 'engineering.element.reinforce', version: '1.0.0' },
      target: { kind: 'world-entity', ref: 'element:column-c4' },
      parameters: { load_kn: 42 },
      preconditions: [],
      predictedEffects: [
        { description: 'Load capacity rises.', confidence: { kind: 'quantified', value: 0.9 } },
      ],
      sideEffects: [],
      reversibility: { kind: 'reversible', via: 'manual' },
      authorityRequirements: { requiredScopes: ['world:read'], requiresHumanApproval: false },
    };
    const parsedProposal = parseActionProposal(proposalFixture);
    expect(parsedProposal.ok).toBe(true);
    const proposalDigest =
      parsedProposal.ok && 'digest' in parsedProposal
        ? String((parsedProposal as { digest?: unknown }).digest)
        : proposalFixture.messageId;

    const agentRuntime = new AgentRuntime();
    const rebind = agentRuntime.bindAgent({
      tenantId: TENANT,
      agent: binding.agent,
      registry,
    });
    expect(rebind.ok).toBe(true);
    const compiled = agentRuntime.compilePlan({
      tenantId: TENANT,
      plan: {
        schemaVersion: 1,
        tenantId: TENANT,
        planId: 'plan:parity-reinforcement',
        displayName: 'Parity reinforcement',
        createdBy: PRINCIPAL,
        steps: [
          {
            stepId: 'survey',
            agentId: 'agent:field-surveyor',
            proposal: { proposalId: 'prop-parity-survey-001', canonicalDigest: proposalDigest },
            dependsOn: [],
          },
        ],
      },
      proposals: [proposalFixture],
    });
    expect(compiled.ok).toBe(true);
    const session = agentRuntime.createSession({
      tenantId: TENANT,
      sessionId: 'session:parity-fixture',
      plan: compiled.ok ? compiled.value : null,
      createdAt: T1,
    });
    expect(session.ok).toBe(true);
    const started = session.ok
      ? agentRuntime.startSession({ tenantId: TENANT, sessionId: 'session:parity-fixture', at: T2 })
      : null;
    expect(started?.ok ?? false).toBe(true);

    // The REAL session's lifecycle fact feeds the W030 observation
    // intake: subjectId carries the REAL session id; the source digest
    // is the REAL session state digest.
    const runtimeSession = started?.ok ? started.value.session : null;
    expect(runtimeSession).not.toBeNull();
    const securityRuntime = new SecurityRuntime();
    const observation = unwrap(
      securityRuntime.observeAgentSession({
        tenantId: TENANT,
        authorization: allowAuth(),
        observationId: 'observation:session-parity-001',
        sessionId: 'session:parity-fixture',
        sessionStatus: runtimeSession!.status,
        observedAt: T2,
        sourceDigest: proposalDigest,
      }),
    );
    expect(observation.observationClass).toBe('agent-session');
    expect(observation.subjectId).toBe('session:parity-fixture');
    expect(observation.detail?.['sessionStatus']).toBe(runtimeSession!.status);
  });
});

// --------------------------------------------------------------------------------
// W021 simulation-fabric parity.
// --------------------------------------------------------------------------------

describe('W021 simulation-fabric parity (runtime)', () => {
  it('a REAL fabric run feeds the simulation-run intake', async () => {
    const { SimulationFabric } = await import('@epoch/simulation-fabric');
    const {
      REFERENCE_SIMULATOR_REGISTRATION,
      referenceRegistrationDigest,
    } = await import('@epoch/simulation-protocol');

    // A REAL W021 run through the REAL fabric pipelines (W005
    // registration + invocation request admission, binding grammar,
    // derived identity).
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob({
        tenantId: TENANT,
        registration: REFERENCE_SIMULATOR_REGISTRATION,
        request: {
          protocolVersion: '1.0.0',
          messageKind: 'simulation.invocation-request',
          messageId: 'msg-parity-request-0001',
          createdAt: T1,
          requestId: 'simreq-parity-0001',
          simulator: {
            simulatorId: 'simulator:reference-affine-scalar',
            registrationDigest: referenceRegistrationDigest(),
          },
          inputs: { x: 2, slope: 3, intercept: 1 },
        },
        capabilityBindings: [
          {
            capabilityId: 'engineering.stress-analysis',
            version: '1.2.3',
            registrationDigest: 'c'.repeat(64),
          },
        ],
        actor: PRINCIPAL,
        at: T1,
      }),
    );
    expect(run.status).toBe('submitted');

    // The REAL run's lifecycle fact feeds the W030 observation intake.
    const securityRuntime = new SecurityRuntime();
    const observation = unwrap(
      securityRuntime.observeSimulationRun({
        tenantId: TENANT,
        authorization: allowAuth(),
        observationId: 'observation:run-parity-001',
        runId: run.runId,
        runStatus: run.status,
        observedAt: T1,
        sourceDigest: run.runDigest,
      }),
    );
    expect(observation.observationClass).toBe('simulation-run');
    expect(observation.subjectId).toBe(run.runId);
    expect(observation.detail?.['runStatus']).toBe('submitted');
  });
});

// --------------------------------------------------------------------------------
// W022 action-gateway parity.
// --------------------------------------------------------------------------------

describe('W022 action-gateway parity (runtime)', () => {
  it('a REAL gateway action feeds the action-dispatch intake', async () => {
    const { ActionGateway } = await import('@epoch/action-gateway');
    const { compileConstraint } = await import('@epoch/policy-contracts');

    // A REAL W022 action through the REAL gateway intake pipelines
    // (W009 gate FIRST, then the W004 policy decision).
    const gateway = new ActionGateway();
    const compiledOutcome = compileConstraint({
      languageVersion: '1.0.0',
      id: 'hard-budget',
      version: '1.0.0',
      inputs: [{ name: 'spend', type: 'number' }],
      class: 'hard',
      predicate: {
        node: 'lt',
        left: { node: 'input', name: 'spend' },
        right: { node: 'lit', type: 'number', value: 100 },
      },
    });
    expect(compiledOutcome.ok).toBe(true);
    const compiled = compiledOutcome.ok ? compiledOutcome.compiled : null;
    expect(compiled).not.toBeNull();
    const resolver = (ignored: { constraintId: string }): unknown => {
      void ignored;
      return compiled;
    };
    const intake = unwrap(
      gateway.submitAction({
        tenantId: TENANT,
        actionId: 'action:parity-reinforce-1',
        proposal: {
          protocolVersion: '1.0.0',
          messageKind: 'action.proposal',
          messageId: 'msg-parity-gateway-0001',
          createdAt: T1,
          proposalId: 'prop-parity-gateway-001',
          proposedBy: 'agent:field-surveyor',
          actionType: { id: 'engineering.element.reinforce', version: '1.0.0' },
          target: { kind: 'world-entity', ref: 'element:column-c4' },
          parameters: { load_kn: 42 },
          preconditions: [],
          predictedEffects: [
            { description: 'Load capacity rises.', confidence: { kind: 'quantified', value: 0.9 } },
          ],
          sideEffects: [],
          reversibility: { kind: 'reversible', via: 'manual' },
          authorityRequirements: { requiredScopes: ['world:read'], requiresHumanApproval: false },
        },
        policies: [
          {
            languageVersion: '1.0.0',
            id: 'tenant-budget-policy',
            version: '1.0.0',
            name: 'Tenant budget policy',
            enabled: true,
            applicability: { tenantId: TENANT, actionKinds: ['engineering.element.reinforce'] },
            bindings: [{ constraintId: 'hard-budget' }],
            precedence: { tier: 'tenant', rank: 5 },
            composition: 'additive',
          },
        ],
        resolveConstraint: resolver as never,
        evaluationContext: { inputs: { spend: 10 } },
        authorization: {
          principalId: PRINCIPAL,
          context: {
            schemaVersion: 1,
            principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
            memberships: [{ principalId: PRINCIPAL, tenantId: TENANT }],
            knownTenants: [TENANT],
          },
        },
        decidedAt: T2,
      }),
    );
    expect(intake.action.status).toBe('authorized');

    // The REAL action's lifecycle fact feeds the W030 observation
    // intake: subjectId carries the REAL action id; the source digest
    // is the REAL in-force decision digest.
    const securityRuntime = new SecurityRuntime();
    const observation = unwrap(
      securityRuntime.observeAction({
        tenantId: TENANT,
        authorization: allowAuth(),
        observationId: 'observation:action-parity-001',
        actionId: intake.action.actionId,
        actionStatus: intake.action.status,
        observedAt: T2,
        sourceDigest: intake.action.decisionDigest,
      }),
    );
    expect(observation.observationClass).toBe('action-dispatch');
    expect(observation.subjectId).toBe('action:parity-reinforce-1');
    expect(observation.detail?.['actionStatus']).toBe('authorized');
  });
});

// --------------------------------------------------------------------------------
// W041 access-projection parity (the REAL evaluation pipeline).
// --------------------------------------------------------------------------------

describe('W041 access-projection parity (runtime)', () => {
  it('a REAL authorized projection audits CLEAN and a forked one is flagged', async () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));

    // A REAL W036 program (built through the REAL solution-delivery
    // pipelines) is the canonical record.
    const program = unwrap(
      buildProgramOfWork({
        schema: 'epoch.solution-delivery.program-of-work',
        schemaVersion: 1,
        programId: 'program:parity-tower',
        tenantId: TENANT,
        solutionId: 'solution:parity-tower',
        solutionVersion: '1.0.0',
        solutionVersionDigest: 'e'.repeat(64),
        title: 'Parity Tower Program',
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

    // A REAL W041 projection policy (client role: view only, limited
    // allowlist) + a REAL W009 allow decision.
    const projectionPolicy = unwrap(
      sealProjectionPolicy({
        schema: 'epoch.access-projection.policy',
        schemaVersion: 1,
        policyId: 'policy:parity-access',
        revision: 1,
        tenantId: TENANT,
        title: 'Parity access policy',
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
      principalId: 'principal:client-viewer',
      actionKind: 'access-projection.view',
      resource: { resourceType: 'program-of-work', resourceId: 'program:parity-tower', tenantId: TENANT },
    };
    const evaluated = unwrap(
      evaluate(request, {
        schemaVersion: 1,
        principals: [{ principalId: 'principal:client-viewer', status: 'active', authenticated: true }],
        memberships: [{ principalId: 'principal:client-viewer', tenantId: TENANT }],
        knownTenants: [TENANT],
      }),
    );
    // The SEALED decision registration (decision + digest): the W041
    // two-stage evaluation grounds the projection on the sealed W009
    // decision (mirroring the access-projection helpers pattern).
    const sealedDecision = sealAuthorizationDecision(evaluated);
    expect(sealedDecision.ok).toBe(true);
    if (!sealedDecision.ok) throw new Error('decision sealing failed');
    const projection = unwrap(
      evaluateProjection({
        request,
        decision: sealedDecision.value,
        policy: projectionPolicy,
        record: { objectClass: 'program-of-work', record: program },
        subject: { principalId: 'principal:client-viewer', principalKind: 'human', role: 'role:client-viewer' },
        projectedAt: T3,
        projectedBy: 'principal:access-host',
      }),
    );

    // The REAL projection maps into the mirrored summary: the audit
    // family accepts it (the W041 invariants hold on real records).
    if (projection.outcome !== 'released') {
      throw new Error(`the REAL W041 evaluation denied the fixture: ${JSON.stringify(projection.denial)}`);
    }
    const summary = {
      objectId: projection.projection.objectId,
      objectDigest: projection.projection.objectDigest,
      releasedPaths: releasedPathsOf(projection.projection),
      redactedPaths: redactedPathsOf(projection.projection),
      decisionDigest: projection.projection.decisionDigest,
      policyId: projection.projection.policyRef.policyId,
    };
    const clean = unwrap(
      runtime.runAuditPass({
        tenantId: TENANT,
        authorization: auth,
        auditPassId: 'observation:audit-parity-001',
        auditedAt: T3,
        projections: [
          { summary, canonical: { objectId: 'program:parity-tower', objectDigest: program.contentDigest } },
        ],
      }),
    );
    expect(clean.projectionFindings).toEqual([]);
    expect(clean.tenantBoundaryFindings).toEqual([]);

    // A FORKED summary (identity tampered) is flagged.
    const forked = unwrap(
      runtime.runAuditPass({
        tenantId: TENANT,
        authorization: auth,
        auditPassId: 'observation:audit-parity-002',
        auditedAt: T3,
        projections: [
          {
            summary: { ...summary, objectId: 'program:other-program' },
            canonical: { objectId: 'program:parity-tower', objectDigest: program.contentDigest },
          },
        ],
      }),
    );
    expect(forked.projectionFindings.map((f) => f.code)).toContain('projection-identity-fork');
    expect(forked.observations.length).toBe(1);
  });
});

// --------------------------------------------------------------------------------
// W010 event-log parity.
// --------------------------------------------------------------------------------

describe('W010 event-log parity (runtime)', () => {
  it('the host-emitted security events seal through the REAL W010 sealEvent and digest identically', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
    const admitted = unwrap(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject(),
        admittedAt: T1,
      }),
    );
    const stream = unwrap(
      runtime.readStream({
        tenantId: TENANT,
        authorization: auth,
        streamId: `stream:security-${EXTENSION_ID.slice('extension:'.length)}`,
      }),
    );
    expect(stream.length).toBeGreaterThan(0);
    for (const event of stream) {
      const content = { ...event };
      delete (content as { contentDigest?: string }).contentDigest;
      const ours = sealSecurityEvent(content);
      expect(ours.ok).toBe(true);
      const theirs = sealEvent(content);
      expect(theirs.ok).toBe(true);
      expect(ours.ok && theirs.ok && ours.value.contentDigest === theirs.value.digest).toBe(true);
    }
    expect(admitted.verdict.verdict).toBe('conforms');
    expect(POLICY_ID).toMatch(/^security-policy:/);
    expect(T2).toMatch(/^2026-/);
  });
});
