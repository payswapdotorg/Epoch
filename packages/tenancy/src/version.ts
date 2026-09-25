/**
 * Tenancy contract versions and the closed hierarchy vocabulary.
 *
 * The hierarchy is FROZEN by architecture.md ("Tenancy", binding):
 * `Platform -> Tenant -> Workspace -> Project -> World/Scenario/Evidence`.
 * The kind vocabulary below names those levels exactly; the legal parent
 * map and depth table encode the same hierarchy structurally. Identity,
 * authorization, and policy are SEPARATE domains (architecture lock rule
 * 12) — this package owns the containment hierarchy and nothing else.
 *
 * Versioning policy (v1, mirrors @epoch/capability-registry): a serialized
 * tenancy node (or snapshot) is admitted only when its `schemaVersion`
 * equals {@link TENANCY_RECORD_VERSION} exactly; skew surfaces as a typed
 * `validation` issue at path ["schemaVersion"] before any other schema
 * diagnostics. {@link TENANCY_CONTRACT_VERSION} versions the published
 * contract surface (`schemas/` + the typed index export).
 */

/** Version of the published tenancy contract surface (schemas/ + types). */
export const TENANCY_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized tenancy document. */
export const TENANCY_RECORD_VERSION = 1 as const;

/**
 * Tenancy node kinds — the levels of the frozen hierarchy, plus the three
 * project-scoped leaf kinds (World/Scenario/Evidence). A kind names a LEVEL
 * in the containment structure, never a vendor, product, or provider.
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
 * The legal parent-kind table (the frozen hierarchy, structural form).
 * `platform` has no parent (exactly one root per directory); `tenant`
 * parents to `platform`; `workspace` to `tenant`; `project` to
 * `workspace`; and the project-scoped leaves (`world`, `scenario`,
 * `evidence`) to `project`.
 */
export const TENANCY_PARENT_KINDS: Readonly<
  Record<TenancyNodeKind, readonly TenancyNodeKind[] | null>
> = {
  platform: null,
  tenant: ['platform'],
  workspace: ['tenant'],
  project: ['workspace'],
  world: ['project'],
  scenario: ['project'],
  evidence: ['project'],
};

/**
 * Depth of each kind in the hierarchy (platform = 0). Used only for error
 * messages and documentation; the parent-kind table is the authority.
 */
export const TENANCY_NODE_DEPTHS: Readonly<Record<TenancyNodeKind, number>> = {
  platform: 0,
  tenant: 1,
  workspace: 2,
  project: 3,
  world: 4,
  scenario: 4,
  evidence: 4,
};

/** The id prefix identifying each node kind (`tenant:` -> `tenant`). */
export const TENANCY_KIND_ID_PREFIXES: Readonly<Record<TenancyNodeKind, string>> = {
  platform: 'platform',
  tenant: 'tenant',
  workspace: 'workspace',
  project: 'project',
  world: 'world',
  scenario: 'scenario',
  evidence: 'evidence',
};

/**
 * Legal kinds for the parent of a node of the given kind (`null` = root
 * kind; must carry no parent). Total: unknown kinds yield `undefined`.
 */
export function legalParentKinds(
  kind: string,
): readonly TenancyNodeKind[] | null | undefined {
  return (TENANCY_PARENT_KINDS as Record<string, readonly TenancyNodeKind[] | null>)[
    kind
  ];
}
