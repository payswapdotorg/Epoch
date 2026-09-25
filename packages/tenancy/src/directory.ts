/**
 * The reference in-memory tenancy directory (W009).
 *
 * Owns (and only owns) the frozen containment hierarchy
 * `Platform -> Tenant -> Workspace -> Project -> World/Scenario/Evidence`
 * (architecture.md, "Tenancy", binding): typed node creation, resolution,
 * ancestry and membership, tenant-isolation checks, deterministic
 * ordering, and snapshot/restore round-trips.
 *
 * The hierarchy is opaque-id references (the W002/W003 house pattern): a
 * workspace references its tenant by typed id — NEVER by embedding tenant
 * objects. Cycle prevention and hierarchy-escape rejection are typed,
 * tested behaviors:
 *
 * - `createNode` can never produce a cycle (parents must already exist
 *   and are immutable), but bulk ingest can — `restore`/`restoreSealed`
 *   detect parent-chain loops and reject them with a typed `cycle` error.
 * - Attachments that violate the legal parent-kind table (or the
 *   single-platform-root rule) are rejected with `hierarchy-escape`.
 * - Traversal outside a claimed container (cross-workspace escape,
 *   hierarchy traversal without membership) is rejected with
 *   `hierarchy-escape`.
 * - References between nodes of different tenants are rejected with
 *   `cross-tenant-reference` (the tenant isolation boundary, R12).
 *
 * Explicitly NOT (later Work Orders / out of scope): persistence, events,
 * authorization decisions (W009 @epoch/authorization — host wiring only,
 * no runtime coupling), policy semantics (W004), principal modeling
 * (W009 @epoch/identity). The surface is serialization-friendly: records
 * are plain JSON objects and iteration is always sorted (no
 * insertion-order leaks). Every entry point is total (typed errors,
 * never thrown). No clocks, no randomness: identical operation sequences
 * produce byte-identical snapshots.
 */
import { SealedTenancyNodeSchema, TenancyNodeSchema, TenancyNodeIdSchema, TenancySnapshotSchema } from './schema';
import { verifyTenancyNodeDigest } from './digest';
import { validationError } from './issues';
import { TENANCY_KIND_ID_PREFIXES, TENANCY_PARENT_KINDS } from './version';
import type { TenancyNodeKind } from './version';
import type {
  SealedTenancyNode,
  TenancyError,
  TenancyMembership,
  TenancyNode,
  TenancyNodeId,
  TenancyResult,
  TenancySnapshot,
} from './types';

/** Input of `createPlatform`: the root node's identity. */
export interface CreatePlatformInput {
  /** Typed platform id (`platform:` + slug). */
  readonly id: string;
  readonly displayName?: string;
}

/** Input of `createNode`: identity + the parent it attaches under. */
export interface CreateNodeInput {
  /** Typed node id; the prefix determines (and must match) the kind. */
  readonly id: string;
  /** Parent id; must exist and be a legal parent kind for this node. */
  readonly parentId: string;
  readonly displayName?: string;
}

function ok<T>(value: T): TenancyResult<T> {
  return { ok: true, value };
}

function fail<T>(error: TenancyError): TenancyResult<T> {
  return { ok: false, error };
}

const unknownNode = (nodeId: TenancyNodeId): TenancyError => ({
  code: 'unknown-node',
  message: `no tenancy node with id "${nodeId}"`,
  path: ['id'],
  nodeId,
});

function hierarchyEscape(nodeId: TenancyNodeId, message: string): TenancyError {
  return {
    code: 'hierarchy-escape',
    message,
    path: ['parentId'],
    nodeId,
  };
}

const byId = (a: TenancyNode, b: TenancyNode): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Kind encoded by a typed node id's prefix (null when unknown). */
function kindOfId(nodeId: TenancyNodeId): TenancyNodeKind | null {
  const prefix = nodeId.split(':', 1)[0] ?? '';
  const entry = (
    Object.entries(TENANCY_KIND_ID_PREFIXES) as [TenancyNodeKind, string][]
  ).find(([, value]) => value === prefix);
  return entry ? (entry[0] as TenancyNodeKind) : null;
}

/**
 * The reference tenancy directory. Construct directly
 * (`new TenancyDirectory()`) or via {@link TenancyDirectory.restore} /
 * {@link TenancyDirectory.restoreSealed}. No persistence, no events, no
 * clocks: creation order never leaks into iteration (all listing is
 * sorted).
 */
export class TenancyDirectory {
  /** nodeId -> node. Maps iterate in insertion order; every read path
   * sorts before exposing anything. */
  private readonly store = new Map<TenancyNodeId, TenancyNode>();

  /** Number of nodes (all kinds). */
  get size(): number {
    return this.store.size;
  }

  /**
   * Create the platform root. Exactly one platform node may exist; a
   * second root attempt is rejected with `hierarchy-escape` (the
   * single-root rule is part of the frozen structure).
   */
  createPlatform(input: CreatePlatformInput): TenancyResult<TenancyNode> {
    if (this.store.size > 0) {
      return fail(
        hierarchyEscape(
          input.id,
          'exactly one platform root is allowed — the platform must be created first, before any other node',
        ),
      );
    }
    const candidate: unknown = {
      schemaVersion: 1,
      id: input.id,
      kind: 'platform',
      parentId: null,
      ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    };
    const parsed = TenancyNodeSchema.safeParse(candidate);
    if (!parsed.success) {
      return fail(validationError(parsed.error));
    }
    this.store.set(parsed.data.id, parsed.data);
    return ok(parsed.data);
  }

  /**
   * Create a non-root node under an existing parent. Admission pipeline
   * (total, never throws):
   *
   * 1. id validation — the typed node id must be well-formed (prefix +
   *    slug), else typed `validation` issues (malformed ids are
   *    rejected); a PLATFORM-prefixed id is a `hierarchy-escape` (the
   *    root has no parent — it is created via `createPlatform` only);
   * 2. document validation — the assembled node must satisfy the strict
   *    schema (malformed parent-id shape, oversized display fields,
   *    unknown — vendor/provider — fields);
   * 3. duplicate check — the id must be free, else `duplicate-node`;
   * 4. parent existence — the parent id must resolve, else
   *    `unknown-parent`;
   * 5. structural check — the parent's kind must be a legal parent kind
   *    for this node's kind, else `hierarchy-escape` (an attachment that
   *    would escape the frozen Platform -> Tenant -> Workspace -> Project
   *    -> World/Scenario/Evidence structure).
   */
  createNode(input: CreateNodeInput): TenancyResult<TenancyNode> {
    const id = TenancyNodeIdSchema.safeParse(input.id);
    if (!id.success) {
      return fail(validationError(id.error));
    }
    if (input.id.startsWith('platform:')) {
      return fail(
        hierarchyEscape(
          input.id,
          'platform nodes have no parent — create the root via createPlatform()',
        ),
      );
    }
    const kind = kindOfId(input.id);
    const candidate: unknown = {
      schemaVersion: 1,
      id: input.id,
      kind,
      parentId: input.parentId,
      ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    };
    const parsed = TenancyNodeSchema.safeParse(candidate);
    if (!parsed.success) {
      return fail(validationError(parsed.error));
    }
    if (this.store.has(parsed.data.id)) {
      return fail({
        code: 'duplicate-node',
        message: `tenancy node "${parsed.data.id}" already exists`,
        path: ['id'],
        nodeId: parsed.data.id,
      });
    }
    const parent = this.store.get(parsed.data.parentId as TenancyNodeId);
    if (parent === undefined) {
      return fail({
        code: 'unknown-parent',
        message: `parent "${parsed.data.parentId}" of node "${parsed.data.id}" does not exist`,
        path: ['parentId'],
        nodeId: parsed.data.id,
        parentId: parsed.data.parentId as TenancyNodeId,
      });
    }
    const legalParents = TENANCY_PARENT_KINDS[parsed.data.kind];
    if (!legalParents?.includes(parent.kind)) {
      return fail(
        hierarchyEscape(
          parsed.data.id,
          `a ${parsed.data.kind} node may only be attached under ${legalParents?.join(' | ') ?? 'nothing'} — attaching it under ${parent.kind} "${parent.id}" escapes the frozen tenancy hierarchy`,
        ),
      );
    }
    this.store.set(parsed.data.id, parsed.data);
    return ok(parsed.data);
  }

  /** Retrieve a node by id (any kind). */
  get(nodeId: string): TenancyResult<TenancyNode> {
    const node = this.store.get(nodeId);
    if (node === undefined) {
      return fail(unknownNode(nodeId));
    }
    return ok(node);
  }

  /**
   * The parent chain of a node, node-first and root-last:
   * `[node, parent, ..., platform]`. Defensive cycle guard: a corrupted
   * parent chain (only possible via bulk ingest of tampered state, since
   * creation cannot produce cycles) fails with a typed `cycle` error
   * naming the loop — never an infinite loop. A dangling parent
   * reference fails with `unknown-parent`.
   */
  ancestryOf(nodeId: string): TenancyResult<readonly TenancyNodeId[]> {
    const start = this.store.get(nodeId);
    if (start === undefined) {
      return fail(unknownNode(nodeId));
    }
    const chain: TenancyNodeId[] = [];
    const seen = new Set<TenancyNodeId>();
    let current: TenancyNode | undefined = start;
    while (current !== undefined && current.parentId !== null) {
      if (seen.has(current.id)) {
        return fail({
          code: 'cycle',
          message: `tenancy parent chain contains a cycle at "${current.id}"`,
          path: ['parentId'],
          cycle: [...chain.slice(chain.indexOf(current.id)), current.id],
        });
      }
      seen.add(current.id);
      chain.push(current.id);
      const parent = this.store.get(current.parentId);
      if (parent === undefined) {
        return fail({
          code: 'unknown-parent',
          message: `parent "${current.parentId}" of node "${current.id}" does not exist (corrupted directory state)`,
          path: ['parentId'],
          nodeId: current.id,
          parentId: current.parentId,
        });
      }
      current = parent;
    }
    if (current !== undefined) {
      chain.push(current.id);
    }
    return ok(chain);
  }

  /**
   * Resolved tenancy membership of a node: the platform/tenant/workspace/
   * project that contain it (levels below the node's own level are
   * absent — a tenant node carries `tenantId` = itself, but no
   * workspace/project; a world node carries all three). Failures surface
   * exactly as {@link ancestryOf}.
   */
  resolveMembership(nodeId: string): TenancyResult<TenancyMembership> {
    const chain = this.ancestryOf(nodeId);
    if (!chain.ok) {
      return fail(chain.error);
    }
    const start = this.store.get(nodeId)!;
    const membership: {
      nodeId: TenancyNodeId;
      kind: TenancyNodeKind;
      platformId: string;
      tenantId?: string;
      workspaceId?: string;
      projectId?: string;
    } = {
      nodeId,
      kind: start.kind,
      platformId: chain.value[chain.value.length - 1]!,
    };
    for (const id of chain.value) {
      const kind = kindOfId(id);
      if (kind === 'tenant') membership.tenantId = id;
      else if (kind === 'workspace') membership.workspaceId = id;
      else if (kind === 'project') membership.projectId = id;
    }
    return ok(membership);
  }

  /**
   * The tenant containing a node (itself for tenant nodes); `undefined`
   * for the platform root (not tenant-scoped). Total, never throws.
   */
  tenantOf(nodeId: string): TenancyNodeId | undefined {
    const node = this.store.get(nodeId);
    if (node === undefined || node.kind === 'platform') {
      return undefined;
    }
    // Walk up to the nearest tenant-level ancestor (or the node itself).
    let current: TenancyNode | undefined = node;
    while (current !== undefined && current.kind !== 'tenant') {
      current =
        current.parentId === null ? undefined : this.store.get(current.parentId);
    }
    return current?.id;
  }

  /**
   * Tenant isolation check (R12): verify that two nodes are contained by
   * the SAME tenant. Fails with `cross-tenant-reference` when the
   * resolved tenants differ — or when either node is not tenant-scoped
   * (the platform root cannot be validated as same-tenant: fail closed).
   * Both nodes must exist (`unknown-node` otherwise).
   */
  assertSameTenant(first: string, second: string): TenancyResult<{ tenantId: string }> {
    for (const nodeId of [first, second]) {
      if (!this.store.has(nodeId)) {
        return fail(unknownNode(nodeId));
      }
    }
    const firstTenant = this.tenantOf(first);
    const secondTenant = this.tenantOf(second);
    if (
      firstTenant === undefined ||
      secondTenant === undefined ||
      firstTenant !== secondTenant
    ) {
      return fail({
        code: 'cross-tenant-reference',
        message:
          `nodes "${first}" and "${second}" are not contained by the same tenant ` +
          `(${firstTenant ?? 'not tenant-scoped'} vs. ${secondTenant ?? 'not tenant-scoped'}) — cross-tenant references are rejected`,
        path: ['first'],
        first,
        second,
        firstTenant,
        secondTenant,
      });
    }
    return ok({ tenantId: firstTenant });
  }

  /**
   * Containment check (fail closed, total, never throws): is
   * `descendantId` within the subtree rooted at `ancestorId`? False for
   * unknown ids and false when the traversal escapes the claimed
   * container (cross-workspace escape). The typed (error-carrying) form
   * is {@link assertAncestorOf}.
   */
  contains(ancestorId: string, descendantId: string): boolean {
    const chain = this.ancestryOf(descendantId);
    if (!chain.ok) return false;
    return chain.value.includes(ancestorId as TenancyNodeId);
  }

  /**
   * Typed containment assertion: verify that `descendantId` is within the
   * subtree rooted at `ancestorId`, returning its resolved membership. A
   * traversal outside the claimed container — a cross-workspace escape,
   * or hierarchy traversal without membership — is rejected with
   * `hierarchy-escape` (the containment boundary is part of the frozen
   * structure).
   */
  assertAncestorOf(
    ancestorId: string,
    descendantId: string,
  ): TenancyResult<TenancyMembership> {
    if (!this.store.has(ancestorId)) {
      return fail(unknownNode(ancestorId));
    }
    const chain = this.ancestryOf(descendantId);
    if (!chain.ok) {
      return fail(chain.error);
    }
    if (!chain.value.includes(ancestorId as TenancyNodeId)) {
      return fail(
        hierarchyEscape(
          descendantId,
          `node "${descendantId}" is not within "${ancestorId}" — hierarchy traversal without membership is rejected`,
        ),
      );
    }
    return this.resolveMembership(descendantId);
  }

  /** Children of a node, sorted by id (deterministic). */
  childrenOf(nodeId: string): TenancyResult<readonly TenancyNode[]> {
    if (!this.store.has(nodeId)) {
      return fail(unknownNode(nodeId));
    }
    const children: TenancyNode[] = [];
    for (const node of this.store.values()) {
      if (node.parentId === nodeId) {
        children.push(node);
      }
    }
    children.sort(byId);
    return ok(children);
  }

  /**
   * All nodes sorted by id ascending — independent of creation order.
   * Optional kind filter.
   */
  list(filter: { kind?: TenancyNodeKind } = {}): readonly TenancyNode[] {
    const nodes = [...this.store.values()].filter(
      (node) => filter.kind === undefined || node.kind === filter.kind,
    );
    nodes.sort(byId);
    return nodes;
  }

  /**
   * Deterministic snapshot of the whole directory: nodes sorted by id.
   * Two directories built from the same node set (in any creation order)
   * produce byte-identical snapshots.
   */
  snapshot(): TenancySnapshot {
    return { schemaVersion: 1, nodes: this.list() };
  }

  /**
   * Restore a directory from a serialized snapshot. Runs the FULL
   * admission pipeline over every node (fixed deterministic order so
   * failures are reproducible):
   *
   * 1. per-node schema validation (`validation`);
   * 2. id uniqueness (`duplicate-node`);
   * 3. exactly one platform root, parentless (`hierarchy-escape`);
   * 4. every parent reference resolves (`unknown-parent`);
   * 5. every attachment honors the legal parent-kind table
   *    (`hierarchy-escape`);
   * 6. every parent chain is acyclic (`cycle`).
   *
   * All-or-nothing: a rejected snapshot leaves no partial state.
   */
  static restore(snapshot: unknown): TenancyResult<TenancyDirectory> {
    const parsed = TenancySnapshotSchema.safeParse(snapshot);
    if (!parsed.success) {
      return fail(validationError(parsed.error));
    }
    return TenancyDirectory.admitAll(parsed.data.nodes);
  }

  /**
   * Restore from sealed node records (node + claimed digest). Every
   * digest is verified FIRST — a tampered record fails with
   * `digest-mismatch` before any structural admission — then the full
   * {@link restore} pipeline runs. Entries must be `{ node, digest }`
   * records; anything else is a typed `validation` error.
   */
  static restoreSealed(sealed: readonly unknown[]): TenancyResult<TenancyDirectory> {
    const nodes: TenancyNode[] = [];
    for (const [index, entry] of sealed.entries()) {
      const shape = SealedTenancyNodeSchema.safeParse(entry);
      if (!shape.success) {
        return fail(validationError(shape.error));
      }
      const verified = verifyTenancyNodeDigest(shape.data as SealedTenancyNode);
      if (!verified.ok) {
        return fail(
          verified.error.code === 'validation'
            ? verified.error
            : { ...verified.error, path: [index, ...verified.error.path] },
        );
      }
      nodes.push(verified.value);
    }
    return TenancyDirectory.admitAll(nodes);
  }

  /**
   * Structural admission shared by restore/restoreSealed. Admission
   * order (fixed, deterministic, so failures are reproducible):
   *
   * 1. per-node schema validation (`validation`);
   * 2. id uniqueness (`duplicate-node`);
   * 3. exactly one platform root, parentless (`hierarchy-escape`);
   * 4. every parent reference resolves (`unknown-parent`);
   * 5. every parent chain is acyclic (`cycle`) — checked BEFORE the
   *    parent-kind table so a parent-chain loop is always reported as
   *    the cycle it is, never mislabeled as an escape;
   * 6. every attachment honors the legal parent-kind table
   *    (`hierarchy-escape`).
   *
   * Private static: injects directly into a fresh directory's store
   * after all invariants hold.
   */
  private static admitAll(nodes: readonly TenancyNode[]): TenancyResult<TenancyDirectory> {
    const store = new Map<TenancyNodeId, TenancyNode>();
    for (const node of nodes) {
      const parsed = TenancyNodeSchema.safeParse(node);
      if (!parsed.success) {
        return fail(validationError(parsed.error));
      }
      if (store.has(parsed.data.id)) {
        return fail({
          code: 'duplicate-node',
          message: `tenancy node "${parsed.data.id}" appears more than once`,
          path: ['nodes', 'id'],
          nodeId: parsed.data.id,
        });
      }
      store.set(parsed.data.id, parsed.data);
    }
    const roots = [...store.values()].filter((node) => node.parentId === null);
    if (roots.length !== 1 || roots[0]!.kind !== 'platform') {
      return fail(
        hierarchyEscape(
          roots[0]?.id ?? 'platform:?',
          `exactly one platform root (parentless node) is required — found ${roots.length}`,
        ),
      );
    }
    for (const node of store.values()) {
      if (node.kind === 'platform') {
        continue;
      }
      if (node.parentId === null || !store.has(node.parentId)) {
        return fail({
          code: 'unknown-parent',
          message: `parent "${String(node.parentId)}" of node "${node.id}" does not exist`,
          path: ['nodes', 'parentId'],
          nodeId: node.id,
          parentId: (node.parentId ?? '?') as TenancyNodeId,
        });
      }
    }
    // Acyclicity: every chain must terminate at the unique root. A loop
    // anywhere (all parents present, so the root check alone cannot catch
    // it) is caught by a visited-set walk over every node, in id order.
    for (const start of [...store.values()].sort(byId)) {
      const seen = new Set<TenancyNodeId>();
      const chain: TenancyNodeId[] = [];
      let current: TenancyNode | undefined = start;
      while (current !== undefined) {
        if (seen.has(current.id)) {
          return fail({
            code: 'cycle',
            message: `tenancy parent chain contains a cycle at "${current.id}"`,
            path: ['nodes', 'parentId'],
            cycle: [...chain.slice(chain.indexOf(current.id)), current.id],
          });
        }
        seen.add(current.id);
        chain.push(current.id);
        current = current.parentId === null ? undefined : store.get(current.parentId);
      }
    }
    for (const node of store.values()) {
      if (node.kind === 'platform') {
        continue;
      }
      const parent = node.parentId === null ? undefined : store.get(node.parentId);
      const legalParents = TENANCY_PARENT_KINDS[node.kind];
      if (parent === undefined || !legalParents?.includes(parent.kind)) {
        return fail(
          hierarchyEscape(
            node.id,
            `a ${node.kind} node may only be attached under ${legalParents?.join(' | ') ?? 'nothing'} — attaching it under ${parent?.kind ?? 'nothing'} "${String(node.parentId)}" escapes the frozen tenancy hierarchy`,
          ),
        );
      }
    }
    const directory = new TenancyDirectory();
    for (const node of store.values()) {
      directory.store.set(node.id, node);
    }
    return ok(directory);
  }
}
