/**
 * The reference in-memory tenancy hierarchy (W009).
 *
 * Owns (and only owns): the Platform -> Tenant -> Workspace -> Project ->
 * World/Scenario/Evidence containment tree as typed opaque-id references —
 * creation and reparenting with cycle prevention, hierarchy-escape
 * rejection, and cross-tenant-reference rejection; path/tenant/membership
 * resolution; and deterministic, serialization-friendly snapshots.
 *
 * Explicitly NOT (later Work Orders / out of scope): persistence, an event
 * log, UI, principal membership (identity/authorization packages), and
 * authorization decisions. Identity != tenancy != authorization != policy
 * (architecture lock rule 12); this package never interprets principals.
 *
 * Admission discipline (total, never throws):
 * 1. schema validation — strict objects reject unknown (vendor) fields;
 *    malformed ids (kind-prefix mismatch) are rejected;
 * 2. digest verification — the claimed digest must equal the recomputed
 *    canonical SHA-256 of the node content, else `digest-mismatch`;
 * 3. single-rootedness — exactly one platform node; any other parentless
 *    node or a parented platform is a `hierarchy-escape`;
 * 4. parent resolution — a dangling parent id is `unknown-parent`;
 * 5. containment table — an illegal parent KIND for the child kind is
 *    `illegal-parent-kind` (levels can never be skipped);
 * 6. reparenting additionally rejects `cycle` (a node under its own
 *    subtree) and `cross-tenant-reference` (the tenant isolation
 *    boundary, R12).
 *
 * Determinism: maps iterate in insertion order, but every read path sorts
 * before exposing anything — snapshots and listings are independent of
 * creation order (no insertion-order leaks).
 */
import { TENANCY_PARENT_KINDS } from './version';
import { TenancyNodeSchema } from './schema';
import { computeTenancyNodeDigest, verifyTenancyNodeDigest } from './digest';
import { parseTenancySnapshot } from './parse';
import { validationError } from './issues';
import type {
  TenancyError,
  TenancyNode,
  TenancyNodeKind,
  TenancyNodeRecord,
  TenancyNodeRegistration,
  TenancyNodeId,
  TenancyResult,
  TenancySnapshot,
  TenantId,
} from './types';

/** Input of `moveNode`: reparent a node within the containment table. */
export interface MoveNodeInput {
  readonly nodeId: TenancyNodeId;
  readonly newParentId: TenancyNodeId;
}

/** Filter for deterministic listing. */
export interface ListNodesFilter {
  readonly kind?: TenancyNodeKind;
}

function ok<T>(value: T): TenancyResult<T> {
  return { ok: true, value };
}

function fail<T>(error: TenancyError): TenancyResult<T> {
  return { ok: false, error };
}

/**
 * The reference tenancy hierarchy. Construct directly
 * (`new TenancyHierarchy()`) and admit the platform root first — no
 * persistence, no events, no clocks: creation order never leaks into
 * iteration (all listing is sorted).
 */
export class TenancyHierarchy {
  /** nodeId -> record. Maps iterate in insertion order; every read path
   * sorts before exposing anything. */
  private readonly store = new Map<TenancyNodeId, TenancyNodeRecord>();

  /** Number of admitted nodes. */
  get size(): number {
    return this.store.size;
  }

  /** The platform root node (every hierarchy admits exactly one). */
  get platform(): TenancyNodeRecord {
    for (const record of this.store.values()) {
      if (record.node.kind === 'platform') return record;
    }
    throw new Error('tenancy hierarchy has no platform root (create one first)');
  }

  /**
   * Admit a sealed tenancy node (see src/digest.ts for the sealing
   * helpers). The admission pipeline is documented on the class. Returns
   * the stored record.
   */
  createNode(input: TenancyNodeRegistration): TenancyResult<TenancyNodeRecord> {
    const parsed = TenancyNodeSchema.safeParse(input.node);
    if (!parsed.success) {
      return fail(validationError(parsed.error));
    }
    const node = parsed.data;
    const verified = verifyTenancyNodeDigest({ node, digest: input.digest });
    if (!verified.ok) {
      return fail(verified.error);
    }
    if (this.store.has(node.nodeId)) {
      return fail({
        code: 'duplicate-node',
        message: `tenancy node "${node.nodeId}" already exists — node ids are unique forever`,
        nodeId: node.nodeId,
      });
    }
    if (node.kind === 'platform') {
      if (node.parentId !== null) {
        return fail({
          code: 'hierarchy-escape',
          message: 'the platform node is the root of the hierarchy and cannot have a parent',
          nodeId: node.nodeId,
        });
      }
      for (const existing of this.store.values()) {
        if (existing.node.kind === 'platform') {
          return fail({
            code: 'hierarchy-escape',
            message: `the hierarchy already has a platform root ("${existing.node.nodeId}") — a tenancy tree is single-rooted`,
            nodeId: node.nodeId,
          });
        }
      }
    } else {
      if (node.parentId === null) {
        return fail({
          code: 'hierarchy-escape',
          message: `node "${node.nodeId}" of kind "${node.kind}" cannot be parentless — only the platform node may be the root`,
          nodeId: node.nodeId,
        });
      }
      const parent = this.store.get(node.parentId);
      if (parent === undefined) {
        return fail({
          code: 'unknown-parent',
          message: `parent node "${node.parentId}" does not exist`,
          parentId: node.parentId,
        });
      }
      const legal = TENANCY_PARENT_KINDS[node.kind];
      if (!legal.includes(parent.node.kind)) {
        return fail({
          code: 'illegal-parent-kind',
          message: `node of kind "${node.kind}" cannot be contained by a "${parent.node.kind}" node (legal parent kinds: ${legal.join(', ') || 'none'})`,
          nodeId: node.nodeId,
          kind: node.kind,
          parentKind: parent.node.kind,
          legalParentKinds: legal,
        });
      }
    }
    const record: TenancyNodeRecord = {
      schemaVersion: 1,
      node,
      nodeDigest: input.digest,
    };
    this.store.set(node.nodeId, record);
    return ok(record);
  }

  /** Retrieve a node record by opaque id (any state — inspection). */
  getNode(nodeId: TenancyNodeId): TenancyResult<TenancyNodeRecord> {
    const record = this.store.get(nodeId);
    if (record === undefined) {
      return fail({
        code: 'unknown-node',
        message: `no tenancy node with id "${nodeId}"`,
        nodeId,
      });
    }
    return ok(record);
  }

  /**
   * The owning tenant of a node: the nearest `tenant` ancestor (a tenant
   * node owns itself). The platform root is above all tenants and yields
   * `null` (platform scope, not tenant scope).
   */
  tenantOf(nodeId: TenancyNodeId): TenancyResult<TenantId | null> {
    const chain = this.pathToRoot(nodeId);
    if (!chain.ok) return chain;
    for (const record of chain.value) {
      if (record.node.kind === 'tenant') return ok(record.node.nodeId);
    }
    return ok(null);
  }

  /**
   * The containment chain from the platform root down to the node
   * (root-first, inclusive). Membership resolution building block.
   */
  pathToRoot(nodeId: TenancyNodeId): TenancyResult<readonly TenancyNodeRecord[]> {
    const record = this.store.get(nodeId);
    if (record === undefined) {
      return fail({
        code: 'unknown-node',
        message: `no tenancy node with id "${nodeId}"`,
        nodeId,
      });
    }
    const chain: TenancyNodeRecord[] = [];
    let current: TenancyNodeRecord | undefined = record;
    while (current !== undefined) {
      chain.push(current);
      current =
        current.node.parentId === null ? undefined : this.store.get(current.node.parentId);
    }
    chain.reverse();
    return ok(chain);
  }

  /**
   * Membership resolution: is `nodeId` contained within `scopeId` (equal,
   * or a descendant of it)? Pure tree walk over opaque ids — the caller
   * (authorization) turns this into decisions; tenancy itself never
   * decides.
   */
  isWithin(nodeId: TenancyNodeId, scopeId: TenancyNodeId): TenancyResult<boolean> {
    const chain = this.pathToRoot(nodeId);
    if (!chain.ok) return chain;
    return ok(chain.value.some((record) => record.node.nodeId === scopeId));
  }

  /** Direct children of a node, sorted by node id ascending. */
  childrenOf(parentId: TenancyNodeId): TenancyResult<readonly TenancyNodeRecord[]> {
    if (!this.store.has(parentId)) {
      return fail({
        code: 'unknown-node',
        message: `no tenancy node with id "${parentId}"`,
        nodeId: parentId,
      });
    }
    const children: TenancyNodeRecord[] = [];
    for (const record of this.store.values()) {
      if (record.node.parentId === parentId) children.push(record);
    }
    children.sort((a, b) => (a.node.nodeId < b.node.nodeId ? -1 : 1));
    return ok(children);
  }

  /**
   * Deterministically ordered records: by node id ascending — independent
   * of creation order. Optional kind filter.
   */
  listNodes(filter: ListNodesFilter = {}): readonly TenancyNodeRecord[] {
    const records: TenancyNodeRecord[] = [];
    const ids = [...this.store.keys()].sort();
    for (const id of ids) {
      const record = this.store.get(id)!;
      if (filter.kind === undefined || record.node.kind === filter.kind) {
        records.push(record);
      }
    }
    return records;
  }

  /**
   * Reparent a node within the containment table. Rejection classes (all
   * typed): `unknown-node`, `unknown-parent`, `cycle` (the new parent is
   * the node itself or one of its descendants — the chain would loop),
   * `illegal-parent-kind` (level change), and `cross-tenant-reference`
   * (the tenant isolation boundary, R12: a node can never move across
   * tenants). The stored record is re-sealed with the digest of its new
   * content (records are current-state, content-addressed per revision).
   */
  moveNode(input: MoveNodeInput): TenancyResult<TenancyNodeRecord> {
    const record = this.store.get(input.nodeId);
    if (record === undefined) {
      return fail({
        code: 'unknown-node',
        message: `no tenancy node with id "${input.nodeId}"`,
        nodeId: input.nodeId,
      });
    }
    const newParent = this.store.get(input.newParentId);
    if (newParent === undefined) {
      return fail({
        code: 'unknown-parent',
        message: `new parent node "${input.newParentId}" does not exist`,
        parentId: input.newParentId,
      });
    }
    if (record.node.kind === 'platform') {
      return fail({
        code: 'illegal-parent-kind',
        message: 'the platform node is the root of the hierarchy and cannot be reparented',
        nodeId: record.node.nodeId,
        kind: record.node.kind,
        parentKind: newParent.node.kind,
        legalParentKinds: TENANCY_PARENT_KINDS[record.node.kind],
      });
    }
    if (input.newParentId === input.nodeId) {
      return fail({
        code: 'cycle',
        message: `node "${input.nodeId}" cannot become its own parent`,
        cyclePath: [input.nodeId, input.nodeId],
      });
    }
    const subtree = this.descendantIdsOf(input.nodeId);
    if (subtree.has(input.newParentId)) {
      const chain = this.pathToRoot(input.newParentId);
      const pathIds = chain.ok
        ? chain.value.map((entry) => entry.node.nodeId).reverse()
        : [input.newParentId];
      return fail({
        code: 'cycle',
        message: `node "${input.nodeId}" cannot be reparented under its own descendant "${input.newParentId}" — the parent chain would loop`,
        cyclePath: [...pathIds, input.nodeId],
      });
    }
    const legal = TENANCY_PARENT_KINDS[record.node.kind];
    if (!legal.includes(newParent.node.kind)) {
      return fail({
        code: 'illegal-parent-kind',
        message: `node of kind "${record.node.kind}" cannot be contained by a "${newParent.node.kind}" node (legal parent kinds: ${legal.join(', ')})`,
        nodeId: record.node.nodeId,
        kind: record.node.kind,
        parentKind: newParent.node.kind,
        legalParentKinds: legal,
      });
    }
    const tenantOfNode = this.unwrapTenantOf(record.node.nodeId);
    const tenantOfNewParent = this.unwrapTenantOf(input.newParentId);
    if (
      tenantOfNode !== null &&
      tenantOfNewParent !== null &&
      tenantOfNode !== tenantOfNewParent
    ) {
      return fail({
        code: 'cross-tenant-reference',
        message: `node "${input.nodeId}" belongs to tenant "${tenantOfNode}" and cannot be reparented under "${input.newParentId}" of tenant "${tenantOfNewParent}" — the tenant boundary is an isolation boundary`,
        nodeId: input.nodeId,
        newParentId: input.newParentId,
        tenantOfNode,
        tenantOfNewParent,
      });
    }
    const moved: TenancyNode = { ...record.node, parentId: input.newParentId };
    const updated = this.reseal(moved);
    this.store.set(moved.nodeId, updated);
    return ok(updated);
  }

  /**
   * Deterministic snapshot: records sorted by node id ascending. Two
   * hierarchies with the same nodes emit byte-identical snapshots,
   * regardless of creation order.
   */
  snapshot(): TenancySnapshot {
    return {
      schemaVersion: 1,
      records: this.listNodes(),
    };
  }

  /**
   * Adopt a serialized snapshot: structural validation (strict schemas,
   * per-record digest verification) plus the full semantic pipeline —
   * duplicate ids, single-rooted platform tree (`hierarchy-escape`),
   * dangling parents (`unknown-parent`), containment-table violations
   * (`illegal-parent-kind`), and parent-link loops (`cycle`). Adoption is
   * atomic: a rejected snapshot admits nothing.
   */
  static fromSnapshot(input: unknown): TenancyResult<TenancyHierarchy> {
    const parsed = parseTenancySnapshot(input);
    if (!parsed.ok) return parsed;
    const records = parsed.value.records;
    const byId = new Map<TenancyNodeId, TenancyNodeRecord>();
    for (const record of records) {
      if (byId.has(record.node.nodeId)) {
        return fail({
          code: 'duplicate-node',
          message: `tenancy node "${record.node.nodeId}" appears twice in the snapshot — node ids are unique forever`,
          nodeId: record.node.nodeId,
        });
      }
      byId.set(record.node.nodeId, record);
    }
    // Single-rooted platform tree.
    const platforms = records.filter((record) => record.node.kind === 'platform');
    if (platforms.length === 0) {
      return fail({
        code: 'hierarchy-escape',
        message: 'the snapshot has no platform root — a tenancy tree is single-rooted at the platform',
        nodeId: '',
      });
    }
    if (platforms.length > 1) {
      return fail({
        code: 'hierarchy-escape',
        message: `the snapshot has ${platforms.length} platform roots — a tenancy tree is single-rooted at the platform`,
        nodeId: platforms[1]!.node.nodeId,
      });
    }
    for (const platform of platforms) {
      if (platform.node.parentId !== null) {
        return fail({
          code: 'hierarchy-escape',
          message: `the platform node "${platform.node.nodeId}" carries a parent — the platform is the root`,
          nodeId: platform.node.nodeId,
        });
      }
    }
    for (const record of records) {
      const node = record.node;
      if (node.kind !== 'platform' && node.parentId === null) {
        return fail({
          code: 'hierarchy-escape',
          message: `node "${node.nodeId}" of kind "${node.kind}" is parentless — only the platform node may be the root`,
          nodeId: node.nodeId,
        });
      }
      if (node.parentId === null) continue;
      if (!byId.has(node.parentId)) {
        return fail({
          code: 'unknown-parent',
          message: `parent node "${node.parentId}" referenced by "${node.nodeId}" is not in the snapshot`,
          parentId: node.parentId,
        });
      }
    }
    // Parent-link cycle detection (structural integrity BEFORE containment
    // semantics — a loop is the primary defect, more precise than the kind
    // violation it implies): every chain must terminate at the platform
    // root without revisiting a node.
    const visited = new Set<TenancyNodeId>();
    for (const record of records) {
      if (visited.has(record.node.nodeId)) continue;
      const chain: TenancyNodeId[] = [];
      const onChain = new Set<TenancyNodeId>();
      let cursor: TenancyNodeId | null = record.node.nodeId;
      while (cursor !== null) {
        if (onChain.has(cursor)) {
          const start = chain.indexOf(cursor);
          return fail({
            code: 'cycle',
            message: `the parent chain of "${record.node.nodeId}" loops (${chain.slice(start).concat(cursor).join(' -> ')})`,
            cyclePath: chain.slice(start).concat(cursor),
          });
        }
        onChain.add(cursor);
        chain.push(cursor);
        const entry: TenancyNodeRecord = byId.get(cursor)!;
        cursor = entry.node.parentId;
      }
      for (const id of chain) visited.add(id);
    }
    for (const record of records) {
      const node = record.node;
      if (node.parentId === null) continue;
      const parent = byId.get(node.parentId)!;
      const legal = TENANCY_PARENT_KINDS[node.kind];
      if (!legal.includes(parent.node.kind)) {
        return fail({
          code: 'illegal-parent-kind',
          message: `node of kind "${node.kind}" cannot be contained by a "${parent.node.kind}" node (legal parent kinds: ${legal.join(', ') || 'none'})`,
          nodeId: node.nodeId,
          kind: node.kind,
          parentKind: parent.node.kind,
          legalParentKinds: legal,
        });
      }
    }
    const hierarchy = new TenancyHierarchy();
    for (const id of [...byId.keys()].sort()) {
      hierarchy.store.set(id, byId.get(id)!);
    }
    return ok(hierarchy);
  }

  /** All descendant ids of a node (excluding itself). */
  private descendantIdsOf(nodeId: TenancyNodeId): Set<TenancyNodeId> {
    const descendants = new Set<TenancyNodeId>();
    const frontier: TenancyNodeId[] = [nodeId];
    while (frontier.length > 0) {
      const current = frontier.pop()!;
      for (const record of this.store.values()) {
        if (record.node.parentId === current && !descendants.has(record.node.nodeId)) {
          descendants.add(record.node.nodeId);
          frontier.push(record.node.nodeId);
        }
      }
    }
    return descendants;
  }

  /** tenantOf that never fails (the node is known to exist). */
  private unwrapTenantOf(nodeId: TenancyNodeId): TenantId | null {
    const result = this.tenantOf(nodeId);
    return result.ok ? result.value : null;
  }

  /** Re-seal moved content with its recomputed digest. */
  private reseal(node: TenancyNode): TenancyNodeRecord {
    return {
      schemaVersion: 1,
      node,
      nodeDigest: computeTenancyNodeDigest(node),
    };
  }
}
