// W030 — THE REAL EXECUTION-SURFACE INTAKE EVIDENCE: a REAL W020
// hosted session, a REAL W021 fabric run, and a REAL W022 gateway
// action feeding the security runtime's observation intake (the
// surfaces the W030 isolation/observability model observes).
import { describe, expect, it } from 'vitest';
import { AgentRuntime } from '@epoch/agent-runtime';
import { SimulationFabric } from '@epoch/simulation-fabric';
import { REFERENCE_SIMULATOR_REGISTRATION, referenceRegistrationDigest } from '@epoch/simulation-protocol';
import { ActionGateway } from '@epoch/action-gateway';
import { parseActionProposal } from '@epoch/action-protocol';
import { compileConstraint } from '@epoch/policy-contracts';
import { CapabilityRegistry, computeCapabilityManifestDigest } from '@epoch/capability-registry';
import { bindOrchestratedAgent } from '@epoch/agent-orchestration';
import { SecurityRuntime } from '@epoch/security-runtime';
import { TENANT, T0, T1, T2, officerAuth, unwrap } from '../scenarios/security-scenario';

const PRINCIPAL = 'principal:security-officer';

describe('the REAL execution-surface intake (W020/W021/W022)', () => {
  it('a REAL W020 hosted session feeds the agent-session intake', () => {
    // REAL capability registry + agent binding + plan compilation +
    // session creation through the REAL W020 host.
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
    expect(
      registry.register({
        manifest: manifest as never,
        digest: computeCapabilityManifestDigest(manifest as never),
      }).ok,
    ).toBe(true);
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
    const proposal = {
      protocolVersion: '1.0.0',
      messageKind: 'action.proposal',
      messageId: 'msg-e2e-proposal-001',
      createdAt: T0,
      proposalId: 'prop-e2e-survey-001',
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
    const admitted = parseActionProposal(proposal);
    expect(admitted.ok).toBe(true);
    const proposalDigest =
      admitted.ok && 'digest' in admitted ? String((admitted as { digest?: unknown }).digest) : 'msg-e2e-proposal-001';

    const agentRuntime = new AgentRuntime();
    expect(
      agentRuntime.bindAgent({ tenantId: TENANT, agent: binding.agent, registry }).ok,
    ).toBe(true);
    const compiled = agentRuntime.compilePlan({
      tenantId: TENANT,
      plan: {
        schemaVersion: 1,
        tenantId: TENANT,
        planId: 'plan:e2e-reinforcement',
        displayName: 'E2E reinforcement',
        createdBy: PRINCIPAL,
        steps: [
          {
            stepId: 'survey',
            agentId: 'agent:field-surveyor',
            proposal: { proposalId: 'prop-e2e-survey-001', canonicalDigest: proposalDigest },
            dependsOn: [],
          },
        ],
      },
      proposals: [proposal],
    });
    expect(compiled.ok).toBe(true);
    const session = agentRuntime.createSession({
      tenantId: TENANT,
      sessionId: 'session:e2e-intake-fixture',
      plan: compiled.ok ? compiled.value : null,
      createdAt: T1,
    });
    expect(session.ok).toBe(true);
    const started = agentRuntime.startSession({
      tenantId: TENANT,
      sessionId: 'session:e2e-intake-fixture',
      at: T2,
    });
    expect(started.ok).toBe(true);

    // The REAL session feeds the W030 observation intake.
    const securityRuntime = new SecurityRuntime();
    const observation = unwrap(
      securityRuntime.observeAgentSession({
        tenantId: TENANT,
        authorization: officerAuth(),
        observationId: 'observation:e2e-intake-session-001',
        sessionId: 'session:e2e-intake-fixture',
        sessionStatus: started.ok ? started.value.session.status : 'pending',
        observedAt: T2,
        sourceDigest: proposalDigest,
      }),
    );
    expect(observation.observationClass).toBe('agent-session');
    expect(observation.subjectId).toBe('session:e2e-intake-fixture');
  });

  it('a REAL W021 fabric run feeds the simulation-run intake', () => {
    const fabric = new SimulationFabric();
    const run = unwrap(
      fabric.submitJob({
        tenantId: TENANT,
        registration: REFERENCE_SIMULATOR_REGISTRATION,
        request: {
          protocolVersion: '1.0.0',
          messageKind: 'simulation.invocation-request',
          messageId: 'msg-e2e-request-0001',
          createdAt: T1,
          requestId: 'simreq-e2e-0001',
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

    const securityRuntime = new SecurityRuntime();
    const observation = unwrap(
      securityRuntime.observeSimulationRun({
        tenantId: TENANT,
        authorization: officerAuth(),
        observationId: 'observation:e2e-intake-run-001',
        runId: run.runId,
        runStatus: run.status,
        observedAt: T1,
        sourceDigest: run.runDigest,
      }),
    );
    expect(observation.observationClass).toBe('simulation-run');
    expect(observation.subjectId).toBe(run.runId);
  });

  it('a REAL W022 gateway action feeds the action-dispatch intake', () => {
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
    const intake = unwrap(
      gateway.submitAction({
        tenantId: TENANT,
        actionId: 'action:e2e-intake-001',
        proposal: {
          protocolVersion: '1.0.0',
          messageKind: 'action.proposal',
          messageId: 'msg-e2e-gateway-0001',
          createdAt: T1,
          proposalId: 'prop-e2e-gateway-001',
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
        resolveConstraint: ((binding: { constraintId: string }) => {
          void binding;
          return compiled;
        }) as never,
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

    const securityRuntime = new SecurityRuntime();
    const observation = unwrap(
      securityRuntime.observeAction({
        tenantId: TENANT,
        authorization: officerAuth(),
        observationId: 'observation:e2e-intake-action-001',
        actionId: intake.action.actionId,
        actionStatus: intake.action.status,
        observedAt: T2,
        sourceDigest: intake.action.decisionDigest,
      }),
    );
    expect(observation.observationClass).toBe('action-dispatch');
    expect(observation.subjectId).toBe('action:e2e-intake-001');
  });
});
