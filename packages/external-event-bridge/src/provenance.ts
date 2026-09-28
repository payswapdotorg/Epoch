/**
 * The W006-shaped provenance of every bridge record (the W029 adapter
 * attribution discipline): who adapted the external fact into the bridge
 * (the adapter identity + the EXACT descriptor revision — every record
 * is attributable to the precise adapter contract revision it ran
 * against), the provider's own opaque event reference, and the digest of
 * the raw provider payload the adapter normalized from (the source
 * digest — tamper-detectable, replay-comparable).
 *
 * The provenance KIND follows the shared W006 grammar the W036
 * provenance state also uses (`observed | reported | derived |
 * imported`): an external event is `reported` by its source — an adapter
 * never observes on the world's behalf; a receipt is `derived` from a
 * delivery attempt; a provider registration is `imported` capability
 * metadata.
 */
import { z } from 'zod';
import { BRIDGE_PROVENANCE_KINDS, type BridgeProvenanceKind } from './version';
import { BridgePrincipalIdSchema, Sha256HexSchema } from './primitives';

/** Id grammar of registered adapters (the W007 `adapter:<slug>` grammar). */
export const ADAPTER_ID_PATTERN = /^adapter:[a-z0-9][a-z0-9-]{0,80}$/;

/** One registered adapter id (the W007 grammar, opaque here). */
export const AdapterIdSchema = z.string().regex(ADAPTER_ID_PATTERN);

/** One registered adapter id. */
export type AdapterId = z.infer<typeof AdapterIdSchema>;

/**
 * The typed provenance of one bridge record: the adapter identity, the
 * EXACT adapter descriptor digest (the W007 binding-pin attribution),
 * the provider's own opaque event reference, the digest of the raw
 * provider payload, and the provenance kind.
 */
export const BridgeProvenanceSchema = z
  .strictObject({
    kind: z.enum(BRIDGE_PROVENANCE_KINDS),
    adapterId: AdapterIdSchema,
    adapterDescriptorDigest: Sha256HexSchema,
    providerEventRef: z.string().min(1).max(256),
    providerPayloadDigest: Sha256HexSchema,
    recordedBy: BridgePrincipalIdSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'BridgeProvenance',
    title: 'BridgeProvenance',
    description:
      'The W006-shaped provenance of one bridge record: adapter identity, exact adapter-descriptor digest, provider event reference, raw provider-payload digest, and the provenance kind (reported/derived/imported).',
  });

/** One bridge provenance record. */
export type BridgeProvenance = z.infer<typeof BridgeProvenanceSchema>;

/** The kind of an externally reported fact. */
export function reportedProvenanceKind(): BridgeProvenanceKind {
  return 'reported';
}

/** The kind of a delivery-derived receipt. */
export function derivedProvenanceKind(): BridgeProvenanceKind {
  return 'derived';
}

/** The kind of imported capability metadata. */
export function importedProvenanceKind(): BridgeProvenanceKind {
  return 'imported';
}
