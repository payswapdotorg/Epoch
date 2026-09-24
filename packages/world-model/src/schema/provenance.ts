import { z } from 'zod';
import { AssertionIdSchema } from './primitives';

/**
 * Runtime validators for provenance and evidence
 * (contracts/world/src/provenance.ts).
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics cannot enter kernel types through the
 * provenance door. Provider identifiers remain legal only as OPAQUE
 * strings inside documented fields (actor.id, method, recordedVia).
 */

export const ActorRefSchema = z
  .strictObject({
    id: z.string().min(1).max(256),
    role: z.enum(['human', 'agent', 'system', 'external-provider', 'sensor', 'importer']),
    displayName: z.string().max(256).optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:actor-ref',
    title: 'ActorRef',
    description: 'Opaque, provider-neutral actor reference.',
  });

export const EvidenceRefSchema = z
  .strictObject({
    id: z.string().min(1).max(512),
    kind: z.enum(['document', 'measurement', 'observation', 'computation', 'assertion', 'external', 'other']),
    digest: z.string().regex(/^[0-9a-f]{16,128}$/, 'evidence digests are lowercase hex').optional(),
    locator: z.string().max(2048).optional(),
    description: z.string().max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:evidence-ref',
    title: 'EvidenceRef',
    description: 'Addressable evidence reference (opaque id); evidence bytes are never embedded.',
  });

export const ProvenanceSchema = z
  .strictObject({
    actor: ActorRefSchema,
    method: z.string().min(1).max(256),
    evidence: z.array(EvidenceRefSchema).readonly(),
    derivedFrom: z.array(AssertionIdSchema).readonly().optional(),
    recordedVia: z.string().min(1).max(256).optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:provenance',
    title: 'Provenance',
  });
