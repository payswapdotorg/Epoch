/**
 * Tenancy contract versions and the closed hierarchy vocabulary.
 *
 * architecture.md (binding): "Platform -> Tenant -> Workspace -> Project ->
 * World/Scenario/Evidence." The hierarchy is EXACTLY this: seven node kinds
 * with a typed containment table. A workspace references its tenant by
 * opaque typed id — NEVER by embedding tenant objects (the W002/W003
 * opaque-reference house pattern).
 *
 * Versioning policy (v1, mirrors @epoch/capability-registry): a serialized
 * tenancy node (or snapshot) is admitted only when its `schemaVersion`
 * equals {@link TENANCY_RECORD_VERSION} exactly; skew surfaces as a
 * `validation` issue at path ["schemaVersion"] before any other schema
 * diagnostics. {@link TENANCY_CONTRACT_VERSION} versions the published
 * contract surface (`schemas/` + the typed index export).
 */

/** Version of the published tenancy contract surface (schemas/ + types). */
export const TENANCY_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized tenancy record. */
export const TENANCY_RECORD_VERSION = 1 as const;

/**
 * The tenancy node kinds (architecture.md, "Tenancy"): the seven levels of
 * the containment hierarchy. The first four (platform, tenant, workspace,
 * project) are the organizational scope levels; the last three (world,
 * scenario, evidence) are the project-local content levels named by the
 * same architecture line ("Project -> World/Scenario/Evidence" — three
 * sibling content kinds under a project).
 */
export const TENANCY_NODE_KINDS = [
  'platform',
  'tenant',
  'workspace',
  'project',
  'world',
  'scenario',
  'evidence',
] as const;

/** One tenancy node kind. */
export type TenancyNodeKind = (typeof TENANCY_NODE_KINDS)[number];

/**
 * The typed containment table: the legal parent kinds per node kind.
 * `platform` is the unique root (no parent); every other kind has exactly
 * one legal parent kind, so containment can never skip a level (a project
 * can never hang directly off a tenant) and can never climb sideways.
 */
export const TENANCY_PARENT_KINDS: Readonly<Record<TenancyNodeKind, readonly TenancyNodeKind[]>> = {
  platform: [],
  tenant: ['platform'],
  workspace: ['tenant'],
  project: ['workspace'],
  world: ['project'],
  scenario: ['project'],
  evidence: ['project'],
};

/**
 * Tenancy node ids are kind-prefixed opaque slugs (`tenant:acme`,
 * `workspace:acme-eng`), mirroring the agent-protocol `agent:<slug>`
 * discipline: the id names the node without embedding any object, and the
 * prefix makes kind/id mismatches structurally detectable (a record whose
 * id prefix does not match its `kind` is rejected at validation).
 */
export const TENANCY_NODE_ID_PATTERN =
  /^(platform|tenant|workspace|project|world|scenario|evidence):[a-z0-9][a-z0-9-]{0,62}$/;

/** Opaque tenant identity: `tenant:<slug>`. */
export const TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;

/** Opaque workspace identity: `workspace:<slug>`. */
export const WORKSPACE_ID_PATTERN = /^workspace:[a-z0-9][a-z0-9-]{0,62}$/;

/** Opaque project identity: `project:<slug>`. */
export const PROJECT_ID_PATTERN = /^project:[a-z0-9][a-z0-9-]{0,62}$/;

/** The kind prefix of a tenancy node id (the segment before `:`). */
export function kindPrefixOf(nodeId: string): string {
  const separator = nodeId.indexOf(':');
  return separator === -1 ? '' : nodeId.slice(0, separator);
}
