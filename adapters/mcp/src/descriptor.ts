/**
 * @epoch/adapter-mcp — the W007 adapter descriptors (typed,
 * content-addressed, protocol-neutral).
 *
 * Every descriptor is a plain `AdapterDescriptor` document (the SDK's
 * published contract): the adapter's identity, its category, and the
 * capability binding it serves. Descriptors are digested through the
 * REAL SDK discipline (`computeAdapterDescriptorDigest` — canonical
 * JSON, content-addressed), so every invocation is attributable to the
 * exact descriptor revision.
 */
import type { AdapterDescriptor } from '@epoch/adapter-sdk';
import { computeAdapterDescriptorDigest } from '@epoch/adapter-sdk';

/** The W007 capability ids this adapter's surfaces bind. */
export const ACTION_CAPABILITY_ID = 'tool.invocation-routing' as const;
export const EVALUATOR_CAPABILITY_ID = 'tool.outcome-evaluation' as const;

/** The capability versions this reference set pins (exact). */
export const CAPABILITY_VERSION = '1.0.0' as const;

/** The action-category adapter descriptor (the tool-invocation routing surface). */
export const ACTION_ADAPTER_DESCRIPTOR: AdapterDescriptor = {
  schemaVersion: 1,
  adapterId: 'adapter:external-tool-action',
  category: 'action',
  displayName: 'External Tool Action Adapter (reference)',
  description:
    'Reference action adapter: builds deterministic W003 tool-invocation proposals and routes them EXCLUSIVELY through the W022 action-authority seam (policy decision first, then typed outcome records; no credentials, no direct execution, no bypass).',
  binding: {
    capabilityId: ACTION_CAPABILITY_ID,
    versionRange: { kind: 'exact', version: CAPABILITY_VERSION },
  },
};

/** The evaluator-category adapter descriptor (the invocation-outcome judgment surface). */
export const EVALUATOR_ADAPTER_DESCRIPTOR: AdapterDescriptor = {
  schemaVersion: 1,
  adapterId: 'adapter:external-tool-evaluator',
  category: 'evaluator',
  displayName: 'External Tool Evaluator Adapter (reference)',
  description:
    'Reference evaluator adapter: judges recorded tool-invocation outcomes against declared criteria with mandatory justification (evaluation is judgment, distinct from execution).',
  binding: {
    capabilityId: EVALUATOR_CAPABILITY_ID,
    versionRange: { kind: 'exact', version: CAPABILITY_VERSION },
  },
};

/** The exact descriptor digests (content addresses; computed through the REAL SDK discipline). */
export const ACTION_ADAPTER_DESCRIPTOR_DIGEST = computeAdapterDescriptorDigest(ACTION_ADAPTER_DESCRIPTOR);
export const EVALUATOR_ADAPTER_DESCRIPTOR_DIGEST = computeAdapterDescriptorDigest(EVALUATOR_ADAPTER_DESCRIPTOR);

/** Both descriptors, deterministically ordered (action, then evaluator). */
export const MCP_ADAPTER_DESCRIPTORS: readonly AdapterDescriptor[] = [
  ACTION_ADAPTER_DESCRIPTOR,
  EVALUATOR_ADAPTER_DESCRIPTOR,
];
