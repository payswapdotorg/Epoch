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
 * kind-prefixed; no field encodes a provider, deployment, or API surface.
 * Tenancy owns the CONTAINER HIERARCHY only — principal membership and
 * authorization decisions are the identity/authorization packages'
 * authority (lock rule 12: identity != tenancy != authorization != policy).
 */
import type { Sha256Hex } from '@epoch/agent-protocol';
import type { TENANCY_NODE_KINDS, TENANCY_RECORD_VERSION } from './version';

/** One tenancy node kind (see src/version.ts). */
export type TenancyNodeKind = (typeof TENANCY_NODE_KINDS)[number];

/**
 * Opaque, kind-prefixed tenancy node identity (`tenant:acme`). The id
 * references a node; it never embeds one. Its prefix must agree with the
 * record's `kind` (validated).
 */
export type TenancyNodeId = string;

/** Opaque tenant identity (`tenant:<slug>`). */
export type TenantId = string;

/** Opaque workspace identity (`workspace:<slug>`). */
export type WorkspaceId = string;

/** Opaque project identity (`project:<slug>`). */
export type ProjectId = string;

/**
 * A node of the containment hierarchy: the immutable, digested content of a
 * tenancy record. The parent reference is an opaque typed id — a workspace
 * references its tenant by id, NEVER by embedding the tenant object. Only
 * the platform node may carry `parentId: null` (single-rooted tree,
 * enforced with the typed `hierarchy-escape` error).
 */
export interface TenancyNode {
  readonly schemaVersion: typeof TENANCY_RECORD_VERSION;
  readonly nodeId: TenancyNodeId;
  readonly kind: TenancyNodeKind;
  readonly displayName: string;
  readonly description?: string | undefined;
  /** Opaque id of the parent node; null only for the platform root. */
  readonly parentId: TenancyNodeId | null;
}

/**
 * The published tenancy record: the immutable node content plus the SHA-256
 * digest of that content's canonical JSON (the exact-revision address of
 * the record). Serialization-friendly by construction: a plain JSON object.
 */
export interface TenancyNodeRecord {
  readonly schemaVersion: typeof TENANCY_RECORD_VERSION;
  readonly node: TenancyNode;
  /** SHA-256 of the node's canonical JSON — the record's content address. */
  readonly nodeDigest: Sha256Hex;
}

/**
 * A creation envelope: the node plus the digest CLAIMED for its content.
 * The hierarchy recomputes the digest and rejects a mismatch
 * (`digest-mismatch` — tamper detection): a node whose digest does not
 * match its content never enters the hierarchy.
 */
export interface TenancyNodeRegistration {
  readonly node: TenancyNode;
  readonly digest: Sha256Hex;
}

/**
 * A deterministic, serialization-friendly projection of a whole hierarchy:
 * records sorted by nodeId ascending. Two hierarchies containing the same
 * nodes always emit byte-identical snapshots, regardless of creation
 * order (no insertion-order leaks).
 */
export interface TenancySnapshot {
  readonly schemaVersion: typeof TENANCY_RECORD_VERSION;
  readonly records: readonly TenancyNodeRecord[];
}

/** Issue codes reported by the tenancy total entry points. */
export type TenancyIssue = {
  readonly path: string;
  readonly message: string;
};

/**
 * The typed tenancy error taxonomy (W009 Tech Lead pin). Every entry point
 * is total — errors are values, never exceptions:
 *
 * - `validation` — malformed records (strict objects reject unknown
 *   vendor/provider fields; malformed ids rejected);
 * - `unknown-node` / `unknown-parent` — dangling opaque-id references;
 * - `duplicate-node` — id collision (a tenancy id is unique forever);
 * - `illegal-parent-kind` — containment-table violation (a project cannot
 *   hang directly off a tenant);
 * - `cycle` — parent links that loop (reparenting a node under its own
 *   subtree, or a serialized record set whose links cycle);
 * - `hierarchy-escape` — a structure that is not a single-rooted platform
 *   tree (a parentless non-platform node, a parented platform node, a
 *   second platform root, or a chain that never reaches the platform);
 * - `cross-tenant-reference` — a reparenting that would move a node
 *   across the tenant isolation boundary (R12);
 * - `digest-mismatch` — a claimed content digest that does not match the
 *   recomputed one (tamper detection).
 */
export type TenancyErrorCode =
  | 'validation'
  | 'unknown-node'
  | 'unknown-parent'
  | 'duplicate-node'
  | 'illegal-parent-kind'
  | 'cycle'
  | 'hierarchy-escape'
  | 'cross-tenant-reference'
  | 'digest-mismatch';

/** The typed tenancy error taxonomy (values, never thrown). */
export type TenancyError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly TenancyIssue[];
    }
  | {
      readonly code: 'unknown-node';
      readonly message: string;
      readonly nodeId: TenancyNodeId;
    }
  | {
      readonly code: 'unknown-parent';
      readonly message: string;
      readonly parentId: TenancyNodeId;
    }
  | {
      readonly code: 'duplicate-node';
      readonly message: string;
      readonly nodeId: TenancyNodeId;
    }
  | {
      readonly code: 'illegal-parent-kind';
      readonly message: string;
      readonly nodeId: TenancyNodeId;
      readonly kind: TenancyNodeKind;
      readonly parentKind: TenancyNodeKind;
      readonly legalParentKinds: readonly TenancyNodeKind[];
    }
  | {
      readonly code: 'cycle';
      readonly message: string;
      /** The loop, starting at the offending node (e.g. a -> b -> a). */
      readonly cyclePath: readonly TenancyNodeId[];
    }
  | {
      readonly code: 'hierarchy-escape';
      readonly message: string;
      readonly nodeId: TenancyNodeId;
    }
  | {
      readonly code: 'cross-tenant-reference';
      readonly message: string;
      readonly nodeId: TenancyNodeId;
      readonly newParentId: TenancyNodeId;
      readonly tenantOfNode: TenantId | null;
      readonly tenantOfNewParent: TenantId | null;
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: Sha256Hex;
      readonly encountered: Sha256Hex;
    };

/** Result of a tenancy operation: a value or a typed error. */
export type TenancyResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: TenancyError };
