/**
 * @epoch/tenancy — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators.
 *
 * Neutrality (architecture lock rule 13): every identifier is opaque and
 * provider-neutral — typed ids are `kind:slug` strings; no field encodes a
 * vendor, product, or API surface. The hierarchy is opaque-id REFERENCES
 * (the W002/W003 house pattern): a workspace references its tenant by
 * typed id — tenant objects are NEVER embedded.
 */
import type { Sha256Hex } from '@epoch/agent-protocol';
import type { TENANCY_RECORD_VERSION, TenancyNodeKind } from './version';

/** Opaque platform identity: `platform:` + lowercase slug (the single root). */
export type PlatformId = string;

/** Opaque tenant identity: `tenant:` + lowercase slug. */
export type TenantId = string;

/** Opaque workspace identity: `workspace:` + lowercase slug. */
export type WorkspaceId = string;

/** Opaque project identity: `project:` + lowercase slug. */
export type ProjectId = string;

/** Opaque world identity: `world:` + lowercase slug. */
export type WorldId = string;

/** Opaque scenario identity: `scenario:` + lowercase slug. */
export type ScenarioId = string;

/** Opaque evidence identity: `evidence:` + lowercase slug. */
export type EvidenceId = string;

/**
 * Any typed tenancy-node identity: `platform:`, `tenant:`, `workspace:`,
 * `project:`, `world:`, `scenario:`, or `evidence:` + lowercase slug. The
 * prefix encodes the kind — the id is the single source of node identity.
 */
export type TenancyNodeId = string;

/**
 * A node of the tenancy hierarchy. Identity is the typed id (prefix =
 * kind); containment is a single opaque parent-id reference — children
 * NEVER embed parent objects, and the parent chain is the only structure
 * (architecture.md, "Tenancy", binding). Nodes are plain, serialization-
 * friendly JSON; no clock fields (determinism — the future persistence
 * Work Order owns timestamps if it needs them).
 */
export interface TenancyNode {
  readonly schemaVersion: typeof TENANCY_RECORD_VERSION;
  /** Typed node id; the prefix must match {@link TenancyNodeKind}. */
  readonly id: TenancyNodeId;
  /** The kind (level) of this node in the frozen hierarchy. */
  readonly kind: TenancyNodeKind;
  /**
   * Parent node id. `null` if and only if `kind === "platform"` (exactly
   * one root per directory).
   */
  readonly parentId: TenancyNodeId | null;
  /** Optional human-readable label (never identity, never authority). */
  readonly displayName?: string | undefined;
}

/**
 * A sealed node record: the node plus the digest CLAIMED for its content.
 * The directory recomputes the digest and rejects a mismatch
 * (`digest-mismatch` — tamper detection): a node whose claimed digest does
 * not match its content never enters the directory.
 */
export interface SealedTenancyNode {
  readonly node: TenancyNode;
  readonly digest: Sha256Hex;
}

/**
 * A deterministic serialization of a whole directory state: the nodes
 * sorted by id (insertion order never leaks). Restore validates the full
 * structure (parents, kinds, single root, acyclicity).
 */
export interface TenancySnapshot {
  readonly schemaVersion: typeof TENANCY_RECORD_VERSION;
  readonly nodes: readonly TenancyNode[];
}

/**
 * Resolved tenancy membership of a node: which platform, tenant, workspace,
 * and project contain it. Fields below the node's own level are absent
 * (a tenant node carries `tenantId` = itself, but no workspace/project; a
 * world node carries all three). This is the shape hosts use to scope
 * authorization requests (W009 `@epoch/authorization` — via host wiring,
 * never a runtime dependency).
 */
export interface TenancyMembership {
  readonly nodeId: TenancyNodeId;
  readonly kind: TenancyNodeKind;
  readonly platformId: PlatformId;
  /** Present for tenant-level nodes and everything below them. */
  readonly tenantId?: TenantId;
  /** Present for workspace-level nodes and everything below them. */
  readonly workspaceId?: WorkspaceId;
  /** Present for project-level nodes and everything below them. */
  readonly projectId?: ProjectId;
}

/** Issue codes reported by the tenancy package's total entry points. */
export type TenancyErrorCode =
  | 'validation'
  | 'unknown-node'
  | 'unknown-parent'
  | 'duplicate-node'
  | 'hierarchy-escape'
  | 'cycle'
  | 'cross-tenant-reference'
  | 'digest-mismatch';

/** One flattened validation issue (dotted path + message). */
export interface TenancyIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * The typed tenancy error taxonomy (W009 Tech Lead pin; the W006/W007
 * issue-code style). Every entry point is total — errors are values, not
 * exceptions:
 *
 * - `unknown-node` — lookup/resolution of an absent node id.
 * - `unknown-parent` — creating/ingesting a node whose parent id is absent.
 * - `duplicate-node` — creating/ingesting a node id that already exists.
 * - `hierarchy-escape` — an attachment or traversal that violates the
 *   frozen parent-kind structure or the single-root rule, or a traversal
 *   outside a claimed container (cross-workspace escape, hierarchy
 *   traversal without membership).
 * - `cycle` — a parent chain that loops (only possible through bulk
 *   ingest of corrupted state; creation can never produce one).
 * - `cross-tenant-reference` — a reference between nodes resolved to
 *   different tenants (the tenant isolation boundary).
 * - `digest-mismatch` — a sealed record whose claimed digest does not
 *   match its content (tamper detection).
 */
export type TenancyError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly TenancyIssue[];
    }
  | {
      readonly code: 'unknown-node';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly nodeId: TenancyNodeId;
    }
  | {
      readonly code: 'unknown-parent';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly nodeId: TenancyNodeId;
      readonly parentId: TenancyNodeId;
    }
  | {
      readonly code: 'duplicate-node';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly nodeId: TenancyNodeId;
    }
  | {
      readonly code: 'hierarchy-escape';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly nodeId: TenancyNodeId;
    }
  | {
      readonly code: 'cycle';
      readonly message: string;
      readonly path: readonly (string | number)[];
      /** The offending loop, node-first (e.g. [a, b, a]). */
      readonly cycle: readonly TenancyNodeId[];
    }
  | {
      readonly code: 'cross-tenant-reference';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly first: TenancyNodeId;
      readonly second: TenancyNodeId;
      readonly firstTenant: TenantId | undefined;
      readonly secondTenant: TenantId | undefined;
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly expected: Sha256Hex;
      readonly encountered: Sha256Hex;
    };

/** Result of a tenancy operation: a value or a typed error. */
export type TenancyResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: TenancyError };
