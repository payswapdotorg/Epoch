/**
 * @epoch/adapter-github — the W007 adapter descriptors (typed,
 * content-addressed, provider-neutral).
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
export const SOURCE_CAPABILITY_ID = 'software.snapshot-observation' as const;
export const ACTION_CAPABILITY_ID = 'software.change-routing' as const;

/** The capability versions this reference set pins (exact). */
export const CAPABILITY_VERSION = '1.0.0' as const;

/** The source-category adapter descriptor (the hosted-workspace observation surface). */
export const SOURCE_ADAPTER_DESCRIPTOR: AdapterDescriptor = {
  schemaVersion: 1,
  adapterId: 'adapter:software-workspace-source',
  category: 'source',
  displayName: 'Hosted Software-Workspace Source Adapter (reference)',
  description:
    'Reference source adapter: projects content-addressed hosted software-workspace snapshots into W002-convention observation records (statement, provenance, confidence, validity). Provider-neutral seam; provider payloads are adapted, never authoritative.',
  binding: {
    capabilityId: SOURCE_CAPABILITY_ID,
    versionRange: { kind: 'exact', version: CAPABILITY_VERSION },
  },
};

/** The action-category adapter descriptor (the change-routing surface). */
export const ACTION_ADAPTER_DESCRIPTOR: AdapterDescriptor = {
  schemaVersion: 1,
  adapterId: 'adapter:software-workspace-action',
  category: 'action',
  displayName: 'Hosted Software-Workspace Action Adapter (reference)',
  description:
    'Reference action adapter: builds deterministic W003 change proposals and routes them EXCLUSIVELY through the W022 action-authority seam (policy decision first, then typed outcome records; never a direct execution, never a bypass).',
  binding: {
    capabilityId: ACTION_CAPABILITY_ID,
    versionRange: { kind: 'exact', version: CAPABILITY_VERSION },
  },
};

/** The exact descriptor digests (content addresses; computed through the REAL SDK discipline). */
export const SOURCE_ADAPTER_DESCRIPTOR_DIGEST = computeAdapterDescriptorDigest(SOURCE_ADAPTER_DESCRIPTOR);
export const ACTION_ADAPTER_DESCRIPTOR_DIGEST = computeAdapterDescriptorDigest(ACTION_ADAPTER_DESCRIPTOR);

/** Both descriptors, deterministically ordered (source, then action). */
export const GITHUB_ADAPTER_DESCRIPTORS: readonly AdapterDescriptor[] = [
  SOURCE_ADAPTER_DESCRIPTOR,
  ACTION_ADAPTER_DESCRIPTOR,
];
