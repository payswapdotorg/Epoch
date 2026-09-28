/**
 * W033 deploy/ test suite — shared fixtures + helpers.
 *
 * The REFERENCE TOPOLOGY mirrors the REAL Epoch workspace (real package
 * ids, real workspace paths, real dependency edges) so the deployment
 * model's proof artifacts address the actual platform. Every instant is a
 * caller-supplied constant (the T-series); every id/digest is explicit or
 * content-derived. Zero wall-clock, zero randomness, zero network.
 */
import {
  buildTopologyRevision,
  environmentStateFromTopology,
  executeDeployPlan,
  greenGateReports,
  planDeployment,
  referenceVerificationGatePolicy,
  sealComponent,
  sealEnvironment,
  sealPlacement,
  sealWiring,
  sealEnvironmentState,
  unwrapOrThrow,
  type ComponentContent,
  type ComponentId,
  type DeployPlan,
  type DeployProvenance,
  type DeployResult,
  type DeployRun,
  type EnvironmentState,
  type GateReport,
  type GateCommand,
  type HealthProbeObservation,
  type PlacementContent,
  type TopologyRevision,
  type WiringContent,
} from '@epoch/deploy-model';
import type { DeployGatePolicy, EnvironmentContent } from '@epoch/deploy-model';

// --------------------------------------------------------------------------------
// The instant series (caller-supplied; zero wall-clock).
// --------------------------------------------------------------------------------

export const T0 = '2026-09-24T00:00:00.000Z';
export const T1 = '2026-09-24T01:00:00.000Z';
export const T2 = '2026-09-24T02:00:00.000Z';
export const T3 = '2026-09-24T03:00:00.000Z';
export const T4 = '2026-09-24T04:00:00.000Z';
export const T5 = '2026-09-24T05:00:00.000Z';
export const T6 = '2026-09-24T06:00:00.000Z';
export const T7 = '2026-09-24T07:00:00.000Z';
export const T8 = '2026-09-24T08:00:00.000Z';
export const T9 = '2026-09-24T09:00:00.000Z';

/** The fixed fixture revisions placed in the reference topology. */
export const REV_A = 'rev:00000000000000a1' as const;
export const REV_B = 'rev:00000000000000b2' as const;
export const REV_C = 'rev:00000000000000c3' as const;

/** Tenants of the reference topology. */
export const TENANT_LABS = 'tenant:epoch-labs';
export const TENANT_FIELD = 'tenant:epoch-field';
export const TENANT_FOREIGN = 'tenant:epoch-ops';

// --------------------------------------------------------------------------------
// Actors + provenance.
// --------------------------------------------------------------------------------

export const RELEASE_MANAGER = { actorId: 'actor:tech-lead', role: 'release-manager' } as const satisfies DeployProvenance['actor'];
export const DEPLOYER = { actorId: 'actor:deployer-one', role: 'deployer' } as const satisfies DeployProvenance['actor'];
export const PLANNER = { actorId: 'actor:plan-service', role: 'planner' } as const satisfies DeployProvenance['actor'];
export const EXECUTOR = { actorId: 'actor:execute-service', role: 'executor' } as const satisfies DeployProvenance['actor'];
export const ON_CALL = { actorId: 'actor:on-call', role: 'operator' } as const satisfies DeployProvenance['actor'];

export const provenanceOf = (
  actor: DeployProvenance['actor'],
  method: string,
  instant: string,
  derivedFrom: readonly string[] = [],
): DeployProvenance => ({ actor, method, instant, derivedFrom: [...derivedFrom] });

// --------------------------------------------------------------------------------
// The reference component catalog (the REAL workspace surface).
// --------------------------------------------------------------------------------

const component = (
  componentId: ComponentId,
  kind: ComponentContent['kind'],
  name: string,
  workspacePath: string,
  dependsOn: readonly ComponentId[],
  replicas: number,
): ComponentContent => ({
  recordVersion: 1,
  componentId,
  kind,
  name,
  workspacePath,
  dependsOn: [...dependsOn],
  health: { checkKind: 'readiness', timeoutMs: 5_000, intervalMs: 10_000 },
  capacity: { replicas },
  provenance: provenanceOf(RELEASE_MANAGER, 'catalog-component', T0),
});

export const REFERENCE_COMPONENTS: readonly ComponentContent[] = [
  component('cmp:agent-protocol', 'package', 'Agent Protocol', 'packages/agent-protocol', [], 2),
  component('cmp:tenancy', 'package', 'Tenancy', 'packages/tenancy', ['cmp:agent-protocol'], 2),
  component('cmp:event-log', 'package', 'Event Log', 'packages/event-log', ['cmp:agent-protocol', 'cmp:tenancy'], 3),
  component('cmp:action-protocol', 'package', 'Action Protocol', 'packages/action-protocol', ['cmp:agent-protocol'], 2),
  component('cmp:action-gateway', 'service', 'Action Gateway', 'services/action-gateway', ['cmp:action-protocol', 'cmp:tenancy'], 3),
  component('cmp:web-app', 'app', 'Web App', 'apps/web', ['cmp:action-gateway', 'cmp:event-log'], 4),
  component('cmp:adapter-github', 'adapter', 'Github Adapter', 'adapters/github', ['cmp:action-protocol'], 2),
  component('cmp:pack-construction', 'pack', 'Construction Pack', 'packs/construction', ['cmp:tenancy', 'cmp:event-log'], 2),
];

export const REFERENCE_ENVIRONMENTS: readonly EnvironmentContent[] = [
  {
    recordVersion: 1,
    environmentId: 'env:dev',
    tier: 'dev',
    displayName: 'Development',
    tenantIds: [TENANT_LABS],
    provisionedAt: T0,
    provenance: provenanceOf(RELEASE_MANAGER, 'catalog-environment', T0),
  },
  {
    recordVersion: 1,
    environmentId: 'env:staging',
    tier: 'staging',
    displayName: 'Staging',
    tenantIds: [TENANT_LABS],
    provisionedAt: T0,
    provenance: provenanceOf(RELEASE_MANAGER, 'catalog-environment', T0),
  },
  {
    recordVersion: 1,
    environmentId: 'env:prod',
    tier: 'prod',
    displayName: 'Production',
    tenantIds: [TENANT_LABS, TENANT_FIELD],
    provisionedAt: T0,
    provenance: provenanceOf(RELEASE_MANAGER, 'catalog-environment', T0),
  },
];

const placement = (
  environmentId: string,
  componentId: ComponentId,
  revision: string,
  tenantId: string,
): PlacementContent => ({
  recordVersion: 1,
  environmentId,
  componentId,
  revision,
  tenantId,
  provenance: provenanceOf(DEPLOYER, 'catalog-placement', T1),
});

const wiring = (environmentId: string, from: ComponentId, to: ComponentId): WiringContent => ({
  recordVersion: 1,
  environmentId,
  fromComponentId: from,
  toComponentId: to,
  provenance: provenanceOf(RELEASE_MANAGER, 'catalog-wiring', T1),
});

/** Currently-deployed placements of the reference topology. */
export const REFERENCE_PLACEMENTS: readonly PlacementContent[] = [
  // staging carries the kernel spine at REV_A.
  placement('env:staging', 'cmp:agent-protocol', REV_A, TENANT_LABS),
  placement('env:staging', 'cmp:tenancy', REV_A, TENANT_LABS),
  // prod carries the full lab spine: kernels REV_A, gateway REV_B, web REV_C.
  placement('env:prod', 'cmp:agent-protocol', REV_A, TENANT_LABS),
  placement('env:prod', 'cmp:tenancy', REV_A, TENANT_LABS),
  placement('env:prod', 'cmp:event-log', REV_A, TENANT_LABS),
  placement('env:prod', 'cmp:action-protocol', REV_A, TENANT_LABS),
  placement('env:prod', 'cmp:action-gateway', REV_B, TENANT_LABS),
  placement('env:prod', 'cmp:web-app', REV_C, TENANT_LABS),
  // the field tenant's pack placement (prod is deliberately multi-tenant).
  placement('env:prod', 'cmp:pack-construction', REV_A, TENANT_FIELD),
];

/** Wiring of the reference topology (within env:prod, same-tenant edges). */
export const REFERENCE_WIRING: readonly WiringContent[] = [
  wiring('env:prod', 'cmp:action-gateway', 'cmp:action-protocol'),
  wiring('env:prod', 'cmp:action-gateway', 'cmp:tenancy'),
  wiring('env:prod', 'cmp:web-app', 'cmp:action-gateway'),
  wiring('env:prod', 'cmp:web-app', 'cmp:event-log'),
  wiring('env:prod', 'cmp:event-log', 'cmp:agent-protocol'),
  wiring('env:prod', 'cmp:event-log', 'cmp:tenancy'),
];

/** The ordered battery of a policy (fixture-command accessor). */
export function batteryOf(policy: DeployGatePolicy): readonly GateCommand[] {
  return policy.battery;
}

/** Build the reference topology revision (sequence 1 or the given sequence). */
export function referenceTopology(sequence = 1): TopologyRevision {
  const components = REFERENCE_COMPONENTS.map((content) => unwrapOrThrow(sealComponent(content)));
  const environments = REFERENCE_ENVIRONMENTS.map((content) => unwrapOrThrow(sealEnvironment(content)));
  const placements = REFERENCE_PLACEMENTS.map((content) => unwrapOrThrow(sealPlacement(content)));
  const wiring = REFERENCE_WIRING.map((content) => unwrapOrThrow(sealWiring(content)));
  return unwrapOrThrow(
    buildTopologyRevision({
      topologyId: 'topo:epoch-reference',
      sequence,
      components,
      environments,
      placements,
      wiring,
      provenance: provenanceOf(RELEASE_MANAGER, 'catalog-topology', T2),
    }),
  );
}

/** The sealed reference battery gate policy. */
export function referenceGatePolicy() {
  return unwrapOrThrow(referenceVerificationGatePolicy(provenanceOf(RELEASE_MANAGER, 'catalog-gate', T2)));
}

/** Green battery reports (all exit 0) for a policy. */
export function greenBattery(policy: DeployGatePolicy, completedAt = T3): GateReport[] {
  return greenGateReports(policy, completedAt, (command) =>
    provenanceOf(EXECUTOR, `battery:${command}`, completedAt),
  );
}

/** A failed battery report (the turbo command exited 1). */
export function failingBattery(policy: DeployGatePolicy): GateReport[] {
  const reports = greenBattery(policy);
  return reports.map((report, index) =>
    index === reports.length - 1 ? { ...report, exitCode: 1 } : report,
  );
}

/** A battery missing its LAST command's report (a skipped gate). */
export function skippedBattery(policy: DeployGatePolicy): GateReport[] {
  return greenBattery(policy).slice(0, -1);
}

/** Healthy probes for every health-check step of a plan. */
export function healthyProbes(plan: DeployPlan, observedAt = T4): HealthProbeObservation[] {
  return plan.steps
    .filter((step) => step.kind === 'health-check')
    .map((step) => ({
      componentId: step.componentId,
      environmentId: step.environmentId,
      result: 'healthy' as const,
      observedAt,
    }));
}

/** Probes with ONE component failing (the rollback trigger). */
export function probesWithFailure(plan: DeployPlan, failing: ComponentId, detail: string, observedAt = T4): HealthProbeObservation[] {
  return healthyProbes(plan, observedAt).map((probe) =>
    probe.componentId === failing ? { ...probe, result: 'failed' as const, detail } : probe,
  );
}

/** Plan + execute against the reference prod environment. */
export function deployToProd(options: {
  readonly componentIds: readonly ComponentId[];
  readonly tenantId?: string;
  readonly gateReports?: readonly GateReport[];
  readonly healthProbes?: readonly HealthProbeObservation[];
  readonly topology?: TopologyRevision;
}): { readonly plan: DeployPlan; readonly run: DeployResult<DeployRun> } {
  const topology = options.topology ?? referenceTopology();
  const policy = referenceGatePolicy();
  const plan = unwrapOrThrow(
    planDeployment({
      topology,
      environmentId: 'env:prod',
      componentIds: [...options.componentIds],
      tenantId: options.tenantId ?? TENANT_LABS,
      gatePolicy: policy,
      instants: { plannedAt: T3 },
      provenance: provenanceOf(PLANNER, 'plan-deployment', T3),
    }),
  );
  const state = unwrapOrThrow(
    environmentStateFromTopology(topology, 'env:prod', options.tenantId ?? TENANT_LABS, { baselineAt: T2 }),
  );
  const run = executeDeployPlan({
    plan,
    gatePolicy: policy,
    gateReports: options.gateReports ?? greenBattery(policy),
    fixtureState: state,
    healthProbes: options.healthProbes ?? healthyProbes(plan),
    instants: { executedAt: T5 },
    provenance: provenanceOf(EXECUTOR, 'execute-deploy-plan', T5),
  });
  return { plan, run };
}

/** The tenant-scoped prod state of the reference topology. */
export function prodState(tenantId = TENANT_LABS): EnvironmentState {
  return unwrapOrThrow(environmentStateFromTopology(referenceTopology(), 'env:prod', tenantId, { baselineAt: T2 }));
}

/** A raw (unsealed) fixture environment state builder for negative tests. */
export function rawState(content: Omit<EnvironmentState, 'digest'>) {
  return unwrapOrThrow(sealEnvironmentState(content));
}
