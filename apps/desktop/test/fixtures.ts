/**
 * W017 test fixtures: deterministic builders for the tenancy hierarchy,
 * sealed W011 Experience Graphs, REAL W012-compiled plan documents (the
 * devDependency parity anchor), and the golden-path shell/host scenario.
 */
import {
  sealExperienceGraph,
  type DeviceDescriptor,
  type ExperienceGraph,
  type ExperienceGraphKind,
  type TenantScope,
} from '@epoch/experience-protocol';
import { compileExperienceGraph } from '@epoch/experience-compiler';
import type { RenderPlan } from '@epoch/experience-compiler';
import { TenancyHierarchy } from '@epoch/tenancy';
import { tenancyNodeRecordFor } from '@epoch/tenancy';
import {
  DESKTOP_DEVICE,
  KIND_COMPLETE_RENDERER,
  createDesktopShell,
  createReferenceHost,
  type DesktopResult,
  type DesktopShell,
  type HostShellEnvelope,
  type ReferenceHost,
} from '../src/index';

/** The typed shape of one desktop-shell failure. */
export type TypedError<C extends string> = { readonly code: C };

/** Assert a typed failure of exactly `code` (readable test failures). */
export function expectFailure<C extends string>(
  result: { readonly ok: false; readonly error: { code: string; message: string } } | { readonly ok: true },
  code: C,
): { readonly code: C; readonly message: string } {
  if (result.ok) {
    throw new Error(`expected a typed "${code}" failure, got a success`);
  }
  if (result.error.code !== code) {
    throw new Error(
      `expected a typed "${code}" failure, got "${result.error.code}": ${result.error.message}`,
    );
  }
  return result.error as { readonly code: C; readonly message: string };
}

export const TENANT_A = 'tenant:alpha';
export const TENANT_B = 'tenant:beta';
export const WORKSPACE_A = 'workspace:main';
export const WORKSPACE_B = 'workspace:other';
export const PROJECT_A = 'project:demo';
export const PRINCIPAL = 'principal:operator-1';

export const SCOPE_A: TenantScope = { tenantId: TENANT_A };
export const SCOPE_B: TenantScope = { tenantId: TENANT_B };

/** Build the reference tenancy hierarchy (two tenants, one project under A). */
export function buildHierarchy(): TenancyHierarchy {
  const hierarchy = new TenancyHierarchy();
  const admitted = [
    { schemaVersion: 1, nodeId: 'platform:root', kind: 'platform', displayName: 'Platform', description: 'Reference platform root', parentId: null },
    { schemaVersion: 1, nodeId: TENANT_A, kind: 'tenant', displayName: 'Alpha', description: 'Tenant A', parentId: 'platform:root' },
    { schemaVersion: 1, nodeId: TENANT_B, kind: 'tenant', displayName: 'Beta', description: 'Tenant B', parentId: 'platform:root' },
    { schemaVersion: 1, nodeId: WORKSPACE_A, kind: 'workspace', displayName: 'Main', description: 'Workspace A-main', parentId: TENANT_A },
    { schemaVersion: 1, nodeId: WORKSPACE_B, kind: 'workspace', displayName: 'Other', description: 'Workspace B-other', parentId: TENANT_B },
    { schemaVersion: 1, nodeId: PROJECT_A, kind: 'project', displayName: 'Demo', description: 'Project A-demo', parentId: WORKSPACE_A },
  ];
  for (const node of admitted) {
    const record = tenancyNodeRecordFor(node as never);
    const created = hierarchy.createNode({ node: record.node, digest: record.nodeDigest });
    if (!created.ok) {
      throw new Error(`fixture hierarchy node failed: ${created.error.message}`);
    }
  }
  return hierarchy;
}

/** Deterministically build a valid sealed W011 graph of the given kind. */
export function sealedGraph(
  kind: ExperienceGraphKind,
  options: {
    tenantScope?: TenantScope;
    device?: DeviceDescriptor;
    nodeCount?: number;
    /** Graph-id variant (produces distinct digests for distinct graphs). */
    variant?: number;
  } = {},
): ExperienceGraph {
  const tenantScope = options.tenantScope ?? SCOPE_A;
  const device = options.device ?? DESKTOP_DEVICE;
  const nodeCount = options.nodeCount ?? 1;
  const graphId = `xg-fixture-${options.variant ?? 1}`;
  const nodes = [];
  for (let i = 0; i < nodeCount; i += 1) {
    const id = `xn-fixture-${`${i}`.padStart(3, '0')}`;
    if (kind === '2d' || kind === 'animation') {
      nodes.push({
        id,
        kind: 'shape-2d',
        descriptor: { geometry: { form: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { color: '#ff0000' } },
      });
    } else if (kind === '3d') {
      nodes.push({ id, kind: 'spatial-3d', descriptor: { primitive: 'box', position: [0, 0, 0] } });
    } else if (kind === 'narrative') {
      nodes.push({ id, kind: 'narrative-beat', descriptor: { title: 'Beat' } });
    } else if (kind === 'timeline-replay') {
      nodes.push({ id, kind: 'timeline-marker', descriptor: { atMs: 0, markerKind: 'event' } });
    } else if (kind === 'presence') {
      nodes.push({ id, kind: 'presence-seat', descriptor: { participant: { participantId: 'p-1', participantKind: 'human' } } });
    } else {
      nodes.push({ id, kind: 'control', descriptor: { controlKind: 'button', intent: { id: 'world.view.refresh', version: '1.0.0' } } });
    }
  }
  nodes.sort((a, b) => (a.id < b.id ? -1 : 1));
  const sealed = sealExperienceGraph({
    schema: 'epoch.experience-graph',
    protocolVersion: '1.0.0',
    graphId,
    graphKind: kind,
    tenantScope,
    projectedFrom: [],
    nodes,
    edges: [],
    device,
  });
  if (!sealed.ok) {
    throw new Error(`fixture graph failed to seal: ${sealed.error.message}`);
  }
  return sealed.value;
}

/** Compile one sealed graph with the REAL W012 compiler (devDependency parity anchor). */
export function compiledPlan(
  graph: ExperienceGraph,
  options: { device?: DeviceDescriptor } = {},
): ReturnType<typeof compileExperienceGraph> {
  return compileExperienceGraph({
    envelope: graph,
    device: options.device ?? DESKTOP_DEVICE,
    expectedTenantId: graph.tenantScope.tenantId,
  });
}

/** One compiled experience (sealed graph + the REAL compiled plan document). */
export interface CompiledFixture {
  readonly graph: ExperienceGraph;
  readonly plan: RenderPlan;
}

/** Build a compiled 2d experience for tenant A (the golden fixture). */
export function compiledExperience(
  kind: ExperienceGraphKind = '2d',
  options: { tenantScope?: TenantScope; variant?: number } = {},
): CompiledFixture {
  const graph = sealedGraph(kind, {
    tenantScope: options.tenantScope ?? SCOPE_A,
    variant: options.variant,
  });
  const compiled = compiledPlan(graph);
  if (!compiled.ok) {
    throw new Error(`fixture plan failed to compile: ${compiled.error.message}`);
  }
  return { graph, plan: compiled.value };
}

/** The golden-path scenario: a session with one window and one offered experience. */
export interface GoldenScenario {
  readonly shell: DesktopShell;
  readonly host: ReferenceHost;
  readonly hostEnvelopes: HostShellEnvelope[];
  readonly shellEnvelopes: HostShellEnvelope[];
  readonly experience: CompiledFixture;
}

/**
 * Drive the golden path: session open -> window open -> experience offer
 * -> mount -> frame -> intent -> authoring -> snapshot. Returns the fully
 * driven pair plus both envelope chains (for replay evidence).
 */
export function goldenScenario(options: { tenantScope?: TenantScope; withMount?: boolean } = {}): GoldenScenario {
  const tenantScope = options.tenantScope ?? SCOPE_A;
  const withMount = options.withMount ?? true;
  const tenancy = buildHierarchy();
  const shell = createDesktopShell({ tenancy });
  const host = createReferenceHost({
    sessionId: 'dss-alpha-1',
    scope: { tenantId: tenantScope.tenantId, workspaceId: tenantScope.workspaceId, projectId: tenantScope.projectId },
    principal: PRINCIPAL,
    renderer: KIND_COMPLETE_RENDERER,
  });
  const hostEnvelopes: HostShellEnvelope[] = [];
  const shellEnvelopes: HostShellEnvelope[] = [];

  function deliver(result: DesktopResult<{ envelope: HostShellEnvelope; host: ReferenceHost }>): void {
    if (!result.ok) {
      throw new Error(`golden-path host step failed: ${result.error.message}`);
    }
    const envelope = result.value.envelope;
    hostEnvelopes.push(envelope);
    const outcome = shell.applyHostEnvelope(envelope);
    if (!outcome.ok) {
      throw new Error(`golden-path shell step failed: ${outcome.error.message}`);
    }
    for (const emitted of outcome.value.emitted) {
      shellEnvelopes.push(emitted);
      const received = host.receive(emitted);
      if (!received.ok) {
        throw new Error(`golden-path host receive failed: ${received.error.message}`);
      }
    }
  }

  deliver(
    host.send(
      { kind: 'session-open', payload: { scope: { tenantId: tenantScope.tenantId, workspaceId: tenantScope.workspaceId, projectId: tenantScope.projectId }, principal: PRINCIPAL } },
      0,
      'env-host-session-open',
    ),
  );
  deliver(host.send({ kind: 'window-open', payload: { windowId: 'win-alpha', title: 'Reference window', renderer: KIND_COMPLETE_RENDERER } }, 10));
  const experience = compiledExperience('2d', { tenantScope });
  deliver(
    host.send({ kind: 'experience-offer', payload: { graph: experience.graph, plan: experience.plan } }, 20),
  );
  if (withMount) {
    deliver(
      host.send(
        { kind: 'mount-request', payload: { windowId: 'win-alpha', graphDigest: experience.graph.digest, planDigest: experience.plan.digest } },
        30,
      ),
    );
    deliver(host.send({ kind: 'frame-request', payload: { windowId: 'win-alpha', frameIndex: 1 } }, 40));
    deliver(
      host.send(
        { kind: 'intent-request', payload: { windowId: 'win-alpha', modality: 'pointer', intent: { id: 'world.view.refresh', version: '1.0.0' } } },
        50,
      ),
    );
  }
  deliver(
    host.send(
      {
        kind: 'authoring-request',
        payload: {
          windowId: 'win-alpha',
          actionType: { id: 'world.view.annotate', version: '1.0.0' },
          parameters: { note: 'reference annotation' },
          rationale: 'golden-path authoring intent',
        },
      },
      60,
    ),
  );
  deliver(host.send({ kind: 'snapshot-request', payload: {} }, 70));
  return { shell, host, hostEnvelopes, shellEnvelopes, experience };
}
