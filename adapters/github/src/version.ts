/**
 * @epoch/adapter-github — contract versions and closed vocabularies.
 *
 * NEUTRAL SEAM (architecture lock rule 13: provider behavior is
 * adapterized): every vocabulary below names typed, provider-neutral
 * concepts of the hosted software-workspace domain — snapshots,
 * revisions, content trees, work items, change proposals. The concrete
 * provider's vocabulary (service names, shorthand, revision hash names)
 * lives ONLY in `src/provider/` and never crosses this seam; the
 * per-adapter neutrality blocklist test pins that boundary.
 *
 * Versioning policy (v1, mirrors @epoch/capability-registry): a
 * serialized adapter document (observation record, projection, change
 * proposal plan, authority dispatch record) is admitted only when its
 * `schemaVersion` equals {@link GITHUB_ADAPTER_RECORD_VERSION} exactly;
 * skew surfaces as a `validation` issue at path ["schemaVersion"] before
 * any other schema diagnostics. {@link GITHUB_ADAPTER_CONTRACT_VERSION}
 * versions the published contract surface (typed index export + record
 * vocabularies) as a whole.
 */

/** Version of the published adapter contract surface (types + vocabularies). */
export const GITHUB_ADAPTER_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized adapter record. */
export const GITHUB_ADAPTER_RECORD_VERSION = 1 as const;

/**
 * The contract ids this package issues for W007 contract references
 * (capability manifests reference the contracts they honor).
 */
export const GITHUB_SOURCE_CONTRACT_ID = 'epoch.adapter.software-workspace-source' as const;
export const GITHUB_ACTION_CONTRACT_ID = 'epoch.adapter.software-workspace-action' as const;

/** The W007 adapter categories this package implements (source + action). */
export const GITHUB_ADAPTER_CATEGORIES = ['source', 'action'] as const;

/** Neutral domain namespace of the projected world-model type keys. */
export const SOFTWARE_DOMAIN_NAMESPACE = 'software' as const;

/**
 * The projected type-key vocabulary (W002 world-model `TypeKey` grammar,
 * `software:` namespace — the projected target vocabulary of the software
 * domain; formal ownership belongs to the software domain pack, the
 * adapter only MAPS provider entities INTO it).
 */
export const SOFTWARE_ENTITY_TYPES = [
  'software:workspace',
  'software:revision',
  'software:work-item',
] as const;

/** One projected entity type key. */
export type SoftwareEntityType = (typeof SOFTWARE_ENTITY_TYPES)[number];

/** The projected relation type keys. */
export const SOFTWARE_RELATION_TYPES = [
  'software:contains-revision',
  'software:parent-revision',
  'software:references-revision',
] as const;

/** One projected relation type key. */
export type SoftwareRelationType = (typeof SOFTWARE_RELATION_TYPES)[number];

/**
 * The neutral action-type vocabulary (W003 `ActionTypeReference` ids):
 * proposing a single revision, or proposing an integration of revisions.
 */
export const SOFTWARE_ACTION_TYPE_IDS = [
  'software.change.propose',
  'software.integration.propose',
] as const;

/** One neutral action-type id. */
export type SoftwareActionTypeId = (typeof SOFTWARE_ACTION_TYPE_IDS)[number];

/** Version of the neutral action types this adapter proposes. */
export const SOFTWARE_ACTION_TYPE_VERSION = '1.0.0' as const;

/** The neutral change kinds a proposal can carry. */
export const CHANGE_KINDS = ['revision', 'integration'] as const;

/** One neutral change kind. */
export type ChangeKind = (typeof CHANGE_KINDS)[number];

/** The authority scopes a software-workspace change exercises. */
export const SOFTWARE_AUTHORITY_SCOPES = ['external:software-workspace:write'] as const;

/** The neutral acting-agent grammar for adapter-built proposals. */
export const PROPOSING_AGENT_ID = 'agent:software-workspace-adapter' as const;

/**
 * Dispositions of a routed change (the authority-side outcome mapping —
 * the adapter records what the AUTHORITY decided, never its own verdict).
 */
export const CHANGE_DISPATCH_DISPOSITIONS = [
  'executed',
  'authority-denied',
  'authority-pending-approval',
  'execution-failed',
] as const;

/** One disposition of a routed change. */
export type ChangeDispatchDisposition = (typeof CHANGE_DISPATCH_DISPOSITIONS)[number];
