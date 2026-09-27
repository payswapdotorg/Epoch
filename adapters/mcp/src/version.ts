/**
 * @epoch/adapter-mcp — contract versions and closed vocabularies.
 *
 * NEUTRAL SEAM (architecture lock rule 13: provider behavior is
 * adapterized): every vocabulary below names typed, provider-neutral
 * concepts of the external-tool domain — tool invocation surfaces,
 * invocation records, outcome evaluation. The tool protocol's own
 * vocabulary (protocol names, discovery shapes, tool-descriptor field
 * names) lives ONLY in `src/provider/` and never crosses this seam;
 * the per-adapter neutrality blocklist test pins that boundary.
 */

/** Version of the published adapter contract surface (types + vocabularies). */
export const MCP_ADAPTER_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized adapter record. */
export const MCP_ADAPTER_RECORD_VERSION = 1 as const;

/**
 * The contract ids this package issues for W007 contract references
 * (capability manifests reference the contracts they honor).
 */
export const MCP_ACTION_CONTRACT_ID = 'epoch.adapter.external-tool-action' as const;
export const MCP_EVALUATOR_CONTRACT_ID = 'epoch.adapter.external-tool-evaluation' as const;

/** The W007 adapter categories this package implements (action + evaluator). */
export const MCP_ADAPTER_CATEGORIES = ['action', 'evaluator'] as const;

/** The neutral action-type vocabulary (W003 ActionTypeReference ids). */
export const TOOL_ACTION_TYPE_IDS = ['tool.invoke'] as const;

/** One neutral action-type id. */
export type ToolActionTypeId = (typeof TOOL_ACTION_TYPE_IDS)[number];

/** Version of the neutral action types this adapter proposes. */
export const TOOL_ACTION_TYPE_VERSION = '1.0.0' as const;

/** The authority scopes an external-tool invocation exercises. */
export const TOOL_AUTHORITY_SCOPES = ['external:tool:invoke'] as const;

/** The neutral acting-agent grammar for adapter-built proposals. */
export const PROPOSING_AGENT_ID = 'agent:external-tool-adapter' as const;

/**
 * Dispositions of a routed tool invocation (the authority-side outcome
 * mapping — the adapter records what the AUTHORITY decided, never its
 * own verdict).
 */
export const INVOCATION_DISPOSITIONS = [
  'executed',
  'authority-denied',
  'authority-pending-approval',
  'execution-failed',
] as const;

/** One disposition of a routed invocation. */
export type InvocationDisposition = (typeof INVOCATION_DISPOSITIONS)[number];

/**
 * Credential-shaped parameter keys the adapter REJECTS (the adapter
 * holds no credentials; tool credentials belong to the authority-side
 * execution port, never to the invocation parameters).
 */
export const CREDENTIAL_PARAMETER_KEYS = [
  'token',
  'secret',
  'password',
  'passphrase',
  'api-key',
  'apikey',
  'credential',
  'credentials',
  'authorization',
  'session-key',
] as const;
