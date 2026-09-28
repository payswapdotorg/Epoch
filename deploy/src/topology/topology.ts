/**
 * @epoch/deploy-model — topology admission, sealing, ordering and
 * serialization.
 *
 * Determinism contract (pinned by deploy/test/topology.test.ts): the seal
 * sorts every child collection canonically (components by id; environments
 * by id; placements by environment+component; wiring by environment+from+to),
 * so TWO REVISIONS BUILT FROM THE SAME RECORDS IN DIFFERENT INPUT ORDERS
 * carry IDENTICAL digests — topology is order-independent data.
 *
 * Admission is TOTAL and runs, in fixed order: child digest verification
 * (tamper -> `digest-mismatch`), duplicate detection, reference integrity,
 * dependency-cycle detection, tenant isolation on environment-scoped
 * records (placement tenant within environment scope; wiring endpoints
 * same-tenant), and the provider-vocabulary scan. Every failure is a typed
 * {@link DeployError} value.
 */
import { z, type ZodError } from 'zod';
import { canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  ComponentContentSchema,
  EnvironmentContentSchema,
  PlacementContentSchema,
  WiringContentSchema,
  TopologyRevisionSchema,
  type ComponentContent,
  type ComponentRecord,
  type EnvironmentContent,
  type EnvironmentRecord,
  type PlacementContent,
  type PlacementRecord,
  type TopologyContent,
  type TopologyRevision,
  type WiringContent,
  type WiringRecord,
} from './schema';
import type { ComponentId, EnvironmentId } from '../primitives';
import {
  digestOf,
  digestPrefix,
  fail,
  validationError,
  type DeployError,
  type DeployResult,
  type Revision,
  type Sha256Digest,
} from '../primitives';
import { renderNeutralityFindings, scanProviderVocabulary, type NeutralityFinding } from '../neutrality';
import type { DeployProvenance } from '../provenance';

/** The content half of a sealed child record (digest excluded). */
function omitDigest<T extends { digest: Sha256Digest }>(record: T): Omit<T, 'digest'> {
  const { digest: _digest, ...rest } = record;
  void _digest;
  return rest as Omit<T, 'digest'>;
}
// --------------------------------------------------------------------------------
// Child-record sealing + digest verification.
// --------------------------------------------------------------------------------

/** The content half of a sealed record (digest excluded). */
export function componentContent(record: ComponentRecord): Omit<ComponentRecord, 'digest'> {
  return omitDigest(record);
}
export function environmentContent(record: EnvironmentRecord): Omit<EnvironmentRecord, 'digest'> {
  return omitDigest(record);
}
export function placementContent(record: PlacementRecord): Omit<PlacementRecord, 'digest'> {
  return omitDigest(record);
}
export function wiringContent(record: WiringRecord): Omit<WiringRecord, 'digest'> {
  return omitDigest(record);
}

/** Neutrality + validation + digest computation for one child content. */
function sealChild<TContent, TRecord extends { digest: Sha256Digest }>(
  scope: string,
  contentSchema: z.ZodType<TContent>,
  content: TContent,
): DeployResult<TRecord> {
  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: validationError(scope, parsed.error as ZodError) };
  const findings = scanProviderVocabulary(parsed.data);
  if (findings.length > 0) {
    return {
      ok: false,
      error: fail(
        'provider-vocabulary-rejected',
        `${scope}: ${renderNeutralityFindings(findings)}`,
        findings[0]!.path.split('.').slice(1).map((segment) => segment),
      ),
    };
  }
  const digest = digestOf(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, digest } as unknown as TRecord };
}

/** Seal a component content (validates, neutrality-scans, computes digest). */
export function sealComponent(content: ComponentContent): DeployResult<ComponentRecord> {
  return sealChild('component', ComponentContentSchema, content);
}

/** Seal an environment content. */
export function sealEnvironment(content: EnvironmentContent): DeployResult<EnvironmentRecord> {
  return sealChild('environment', EnvironmentContentSchema, content);
}

/** Seal a placement content. */
export function sealPlacement(content: PlacementContent): DeployResult<PlacementRecord> {
  return sealChild('placement', PlacementContentSchema, content);
}

/** Seal a wiring content. */
export function sealWiring(content: WiringContent): DeployResult<WiringRecord> {
  return sealChild('wiring', WiringContentSchema, content);
}

/** Verify one sealed child record's digest (typed `digest-mismatch`). */
export function verifyComponentDigest(record: ComponentRecord): DeployResult<ComponentRecord> {
  const expected = digestOf(componentContent(record) as unknown as JsonValue);
  return expected === record.digest
    ? { ok: true, value: record }
    : { ok: false, error: fail('digest-mismatch', `component "${record.componentId}": digest does not match content (tampered record)`, ['digest']) };
}

export function verifyEnvironmentDigest(record: EnvironmentRecord): DeployResult<EnvironmentRecord> {
  const expected = digestOf(environmentContent(record) as unknown as JsonValue);
  return expected === record.digest
    ? { ok: true, value: record }
    : { ok: false, error: fail('digest-mismatch', `environment "${record.environmentId}": digest does not match content (tampered record)`, ['digest']) };
}

export function verifyPlacementDigest(record: PlacementRecord): DeployResult<PlacementRecord> {
  const expected = digestOf(placementContent(record) as unknown as JsonValue);
  return expected === record.digest
    ? { ok: true, value: record }
    : { ok: false, error: fail('digest-mismatch', `placement of "${record.componentId}" in "${record.environmentId}": digest does not match content (tampered record)`, ['digest']) };
}

export function verifyWiringDigest(record: WiringRecord): DeployResult<WiringRecord> {
  const expected = digestOf(wiringContent(record) as unknown as JsonValue);
  return expected === record.digest
    ? { ok: true, value: record }
    : { ok: false, error: fail('digest-mismatch', `wiring "${record.fromComponentId}" -> "${record.toComponentId}" in "${record.environmentId}": digest does not match content (tampered record)`, ['digest']) };
}

// --------------------------------------------------------------------------------
// Topology revision building + admission.
// --------------------------------------------------------------------------------

/** Input of {@link buildTopologyRevision} (child records arrive SEALED). */
export interface BuildTopologyInput {
  readonly topologyId: string;
  readonly sequence: number;
  readonly components: readonly ComponentRecord[];
  readonly environments: readonly EnvironmentRecord[];
  readonly placements: readonly PlacementRecord[];
  readonly wiring: readonly WiringRecord[];
  readonly provenance: DeployProvenance;
}

/** Canonical child sort keys (the determinism contract of the seal). */
function sortComponents(components: readonly ComponentRecord[]): ComponentRecord[] {
  return [...components].sort((a, b) => (a.componentId < b.componentId ? -1 : a.componentId > b.componentId ? 1 : 0));
}
function sortEnvironments(environments: readonly EnvironmentRecord[]): EnvironmentRecord[] {
  return [...environments].sort((a, b) => (a.environmentId < b.environmentId ? -1 : a.environmentId > b.environmentId ? 1 : 0));
}
function sortPlacements(placements: readonly PlacementRecord[]): PlacementRecord[] {
  return [...placements].sort((a, b) => {
    const ka = `${a.environmentId}\u0000${a.componentId}`;
    const kb = `${b.environmentId}\u0000${b.componentId}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}
function sortWiring(wiring: readonly WiringRecord[]): WiringRecord[] {
  return [...wiring].sort((a, b) => {
    const ka = `${a.environmentId}\u0000${a.fromComponentId}\u0000${a.toComponentId}`;
    const kb = `${b.environmentId}\u0000${b.fromComponentId}\u0000${b.toComponentId}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/**
 * Build + admit a topology revision from SEALED child records: verifies
 * every child digest, validates semantics, sorts canonically and seals the
 * revision digest. Deterministic: identical child records in any input
 * order produce an identical revision digest.
 */
export function buildTopologyRevision(input: BuildTopologyInput): DeployResult<TopologyRevision> {
  // Child digest verification (tamper detection at the door).
  for (const record of input.components) {
    const verified = verifyComponentDigest(record);
    if (!verified.ok) return verified;
  }
  for (const record of input.environments) {
    const verified = verifyEnvironmentDigest(record);
    if (!verified.ok) return verified;
  }
  for (const record of input.placements) {
    const verified = verifyPlacementDigest(record);
    if (!verified.ok) return verified;
  }
  for (const record of input.wiring) {
    const verified = verifyWiringDigest(record);
    if (!verified.ok) return verified;
  }

  const components = sortComponents(input.components);
  const environments = sortEnvironments(input.environments);
  const placements = sortPlacements(input.placements);
  const wiring = sortWiring(input.wiring);

  const semantic = validateTopologySemantics({ components, environments, placements, wiring });
  if (semantic !== null) return { ok: false, error: semantic };

  const content: TopologyContent = {
    recordVersion: 1,
    topologyId: input.topologyId,
    sequence: input.sequence,
    components,
    environments,
    placements,
    wiring,
    provenance: input.provenance,
  };
  const findings = scanProviderVocabulary(content);
  if (findings.length > 0) {
    return { ok: false, error: neutralityError('topology revision', findings) };
  }
  const digest = digestOf(content as unknown as JsonValue);
  return { ok: true, value: { ...content, digest } };
}

/** Upgrade neutrality findings to the typed error. */
function neutralityError(scope: string, findings: readonly NeutralityFinding[]): DeployError {
  return fail(
    'provider-vocabulary-rejected',
    `${scope}: ${renderNeutralityFindings(findings)}`,
    findings[0]!.path.split('.').slice(1),
  );
}

/**
 * Full semantic validation over the (already digest-verified) child sets.
 * Checks run in a FIXED order; the first failure wins, so identical inputs
 * always produce identical errors.
 */
export function validateTopologySemantics(records: {
  components: readonly ComponentRecord[];
  environments: readonly EnvironmentRecord[];
  placements: readonly PlacementRecord[];
  wiring: readonly WiringRecord[];
}): DeployError | null {
  // 1. Duplicates.
  const seenComponents = new Set<string>();
  for (const component of records.components) {
    if (seenComponents.has(component.componentId)) {
      return fail('duplicate-record', `duplicate component id "${component.componentId}"`, ['components']);
    }
    seenComponents.add(component.componentId);
  }
  const seenEnvironments = new Set<string>();
  for (const environment of records.environments) {
    if (seenEnvironments.has(environment.environmentId)) {
      return fail('duplicate-record', `duplicate environment id "${environment.environmentId}"`, ['environments']);
    }
    seenEnvironments.add(environment.environmentId);
  }
  const seenPlacements = new Set<string>();
  for (const placement of records.placements) {
    const key = `${placement.environmentId}\u0000${placement.componentId}`;
    if (seenPlacements.has(key)) {
      return fail(
        'duplicate-record',
        `duplicate placement of "${placement.componentId}" in "${placement.environmentId}"`,
        ['placements'],
      );
    }
    seenPlacements.add(key);
  }
  const seenWiring = new Set<string>();
  for (const edge of records.wiring) {
    const key = `${edge.environmentId}\u0000${edge.fromComponentId}\u0000${edge.toComponentId}`;
    if (seenWiring.has(key)) {
      return fail(
        'duplicate-record',
        `duplicate wiring "${edge.fromComponentId}" -> "${edge.toComponentId}" in "${edge.environmentId}"`,
        ['wiring'],
      );
    }
    seenWiring.add(key);
  }

  // 2. Component reference integrity.
  for (const component of records.components) {
    for (const dependency of component.dependsOn) {
      if (!seenComponents.has(dependency)) {
        return fail(
          'unknown-component',
          `component "${component.componentId}" depends on unknown component "${dependency}"`,
          ['components'],
        );
      }
    }
  }

  // 3. Dependency cycles (deterministic DFS over id-sorted components).
  const cycle = findDependencyCycle(records.components);
  if (cycle !== null) {
    return fail('dependency-cycle', `component dependency cycle: ${cycle.join(' -> ')}`, ['components']);
  }

  // 4. Placement semantics (references + tenant isolation).
  const environmentTenants = new Map<string, ReadonlySet<string>>(
    records.environments.map((environment) => [environment.environmentId, new Set(environment.tenantIds)]),
  );
  for (const placement of records.placements) {
    if (!seenEnvironments.has(placement.environmentId)) {
      return fail(
        'unknown-environment',
        `placement references unknown environment "${placement.environmentId}"`,
        ['placements'],
      );
    }
    if (!seenComponents.has(placement.componentId)) {
      return fail(
        'unknown-component',
        `placement in "${placement.environmentId}" references unknown component "${placement.componentId}"`,
        ['placements'],
      );
    }
    const tenants = environmentTenants.get(placement.environmentId)!;
    if (!tenants.has(placement.tenantId)) {
      return fail(
        'cross-tenant-placement-rejected',
        `placement of "${placement.componentId}" in "${placement.environmentId}" is owned by tenant "${placement.tenantId}" which is outside the environment's tenant scope`,
        ['placements'],
      );
    }
  }

  // 5. Wiring semantics (same-environment endpoints + same-tenant endpoints).
  const placementByKey = new Map(
    records.placements.map((placement) => [`${placement.environmentId}\u0000${placement.componentId}`, placement]),
  );
  for (const edge of records.wiring) {
    if (!seenEnvironments.has(edge.environmentId)) {
      return fail('unknown-environment', `wiring references unknown environment "${edge.environmentId}"`, ['wiring']);
    }
    const from = placementByKey.get(`${edge.environmentId}\u0000${edge.fromComponentId}`);
    const to = placementByKey.get(`${edge.environmentId}\u0000${edge.toComponentId}`);
    if (from === undefined || to === undefined) {
      const missing = from === undefined ? edge.fromComponentId : edge.toComponentId;
      return fail(
        'wiring-environment-mismatch',
        `wiring in "${edge.environmentId}" references "${missing}" which is not placed in that environment`,
        ['wiring'],
      );
    }
    if (from.tenantId !== to.tenantId) {
      return fail(
        'cross-tenant-wiring-rejected',
        `wiring "${edge.fromComponentId}" (tenant ${from.tenantId}) -> "${edge.toComponentId}" (tenant ${to.tenantId}) crosses tenants within "${edge.environmentId}"`,
        ['wiring'],
      );
    }
  }

  return null;
}

/** Deterministic cycle detection: DFS in id order; reports the cycle path. */
function findDependencyCycle(components: readonly ComponentRecord[]): string[] | null {
  const byId = new Map(components.map((component) => [component.componentId, component]));
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    const current = state.get(id);
    if (current === 'visiting') {
      const start = stack.indexOf(id);
      return [...stack.slice(start === -1 ? 0 : start), id];
    }
    if (current === 'done') return null;
    state.set(id, 'visiting');
    stack.push(id);
    const component = byId.get(id)!;
    for (const dependency of component.dependsOn) {
      const cycle = visit(dependency);
      if (cycle !== null) return cycle;
    }
    stack.pop();
    state.set(id, 'done');
    return null;
  };
  for (const component of [...components].sort((a, b) => (a.componentId < b.componentId ? -1 : 1))) {
    const cycle = visit(component.componentId);
    if (cycle !== null) return cycle;
  }
  return null;
}

/**
 * Admit a serialized/foreign topology revision: structural parse, child
 * digest verification, semantic validation and revision digest
 * verification. The tampered-digest negative path surfaces here as
 * `digest-mismatch`.
 */
export function admitTopologyRevision(value: unknown): DeployResult<TopologyRevision> {
  const parsed = TopologyRevisionSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: validationError('topology revision', parsed.error) };
  const revision = parsed.data;
  const semantic = validateTopologySemantics(revision);
  if (semantic !== null) return { ok: false, error: semantic };
  const findings = scanProviderVocabulary(revision);
  if (findings.length > 0) {
    return { ok: false, error: neutralityError('topology revision', findings) };
  }
  const expected = digestOf(topologyContentOf(revision) as unknown as JsonValue);
  if (expected !== revision.digest) {
    return {
      ok: false,
      error: fail('digest-mismatch', 'topology revision digest does not match its content (tampered revision)', ['digest']),
    };
  }
  return { ok: true, value: revision };
}

/** The content half of a sealed topology revision. */
export function topologyContentOf(revision: TopologyRevision): Omit<TopologyRevision, 'digest'> {
  const { digest: _digest, ...rest } = revision;
  void _digest;
  return rest;
}

/** Recompute and compare a revision's digest (total). */
export function verifyTopologyDigest(revision: TopologyRevision): DeployResult<TopologyRevision> {
  const expected = digestOf(topologyContentOf(revision) as unknown as JsonValue);
  return expected === revision.digest
    ? { ok: true, value: revision }
    : { ok: false, error: fail('digest-mismatch', `topology "${revision.topologyId}"#${revision.sequence}: digest does not match content (tampered revision)`, ['digest']) };
}

// --------------------------------------------------------------------------------
// Deterministic serialization (round-trip + digest verification).
// --------------------------------------------------------------------------------

/** Canonical JSON serialization (byte-stable across processes). */
export function serializeTopologyRevision(revision: TopologyRevision): string {
  return canonicalJsonStringify(revision as unknown as JsonValue);
}

/** Parse + admit a serialized topology revision (total). */
export function deserializeTopologyRevision(text: string): DeployResult<TopologyRevision> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: fail('validation', `serialized topology is not valid JSON: ${(err as Error).message}`) };
  }
  return admitTopologyRevision(parsed);
}

// --------------------------------------------------------------------------------
// Dependency helpers (shared by the planner + runbooks).
// --------------------------------------------------------------------------------

/**
 * The dependency closure of a requested component set, in DETERMINISTIC
 * topological order (dependencies first; lexicographic tiebreak). Every
 * transitive dependency joins the closure — a component cannot deploy
 * without its dependencies.
 */
export function componentDependencyClosure(
  components: readonly ComponentRecord[],
  requested: readonly ComponentId[],
): DeployResult<ComponentId[]> {
  const byId = new Map(components.map((component) => [component.componentId, component]));
  const closure = new Set<string>();
  const queue = [...requested];
  for (const id of queue) {
    if (!byId.has(id)) {
      return { ok: false, error: fail('unknown-component', `unknown component "${id}" in deploy request`, ['componentIds']) };
    }
    if (closure.has(id)) continue;
    closure.add(id);
    const component = byId.get(id)!;
    for (const dependency of component.dependsOn) {
      if (!closure.has(dependency)) queue.push(dependency);
    }
  }
  // Kahn's algorithm with lexicographic selection (deterministic order).
  const remaining = new Map<string, ReadonlySet<string>>();
  for (const id of closure) {
    const deps = byId.get(id)!.dependsOn.filter((dependency) => closure.has(dependency));
    remaining.set(id, new Set(deps));
  }
  const order: ComponentId[] = [];
  const emitted = new Set<string>();
  while (remaining.size > 0) {
    let next: string | null = null;
    for (const id of [...remaining.keys()].sort()) {
      const deps = remaining.get(id)!;
      if ([...deps].every((dependency) => emitted.has(dependency))) {
        next = id;
        break;
      }
    }
    if (next === null) {
      return {
        ok: false,
        error: fail('dependency-cycle', `component dependency cycle among: ${[...remaining.keys()].sort().join(', ')}`, ['componentIds']),
      };
    }
    remaining.delete(next);
    emitted.add(next);
    order.push(next as ComponentId);
  }
  return { ok: true, value: order };
}

/**
 * The deployment revision a topology revision induces (content-derived:
 * `rev:` + first 16 hex of the revision digest). One topology revision = one
 * deployment unit: every component in a plan promotes to THIS revision.
 */
export function deploymentRevisionOf(revision: TopologyRevision): Revision {
  return `rev:${digestPrefix(revision.digest, 16)}` as Revision;
}

/** The placements of one environment, canonically sorted. */
export function placementsInEnvironment(
  revision: TopologyRevision,
  environmentId: EnvironmentId,
): readonly PlacementRecord[] {
  return sortPlacements(revision.placements.filter((placement) => placement.environmentId === environmentId));
}

/** Look up one component record by id (null when absent). */
export function componentById(revision: TopologyRevision, componentId: ComponentId): ComponentRecord | null {
  return revision.components.find((component) => component.componentId === componentId) ?? null;
}

/** Look up one environment record by id (null when absent). */
export function environmentById(revision: TopologyRevision, environmentId: EnvironmentId): EnvironmentRecord | null {
  return revision.environments.find((environment) => environment.environmentId === environmentId) ?? null;
}

// Re-export the child validators for consumers of the public API.
export {
  ComponentContentSchema,
  ComponentRecordSchema,
  EnvironmentContentSchema,
  EnvironmentRecordSchema,
  PlacementContentSchema,
  PlacementRecordSchema,
  WiringContentSchema,
  WiringRecordSchema,
  TopologyRevisionSchema,
} from './schema';
