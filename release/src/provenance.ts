/**
 * @epoch/release-kit — provenance on every record (Work Order W035).
 *
 * Every release record carries WHO produced it (a typed actor: opaque id
 * + closed role vocabulary), by WHICH deterministic method, at WHICH
 * caller-supplied instant (zero wall-clock), and the DIGESTS of the
 * exact upstream records it derives from (exact-revision addressing).
 * The shape MIRRORS the W033 deploy-model provenance record member-for-
 * member; the parity test pins them (the roles vocabulary and the actor
 * grammar are identical, and a W033-shaped fixture parses through this
 * schema and vice versa) — the release tree consumes the W033 grammar,
 * it never redefines it.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { ReleaseActorSchema } from './primitives';

/** A 64-hex SHA-256 content digest. */
export const Sha256DigestSchema = z.string().regex(/^[0-9a-f]{64}$/, 'must be a 64-hex sha-256 digest');

/**
 * Operator roles recognized by the release model — MIRRORED from the W033
 * deploy-model PROVENANCE_ROLES vocabulary (the runtime parity test pins
 * the lists equal).
 */
export const RELEASE_PROVENANCE_ROLES = [
  'release-manager',
  'deployer',
  'planner',
  'executor',
  'operator',
  'auditor',
] as const;
export type ReleaseProvenanceRole = (typeof RELEASE_PROVENANCE_ROLES)[number];

/** Typed actor reference (human or system operator; opaque id + role). */
export const ReleaseActorRefSchema = z
  .strictObject({
    actorId: ReleaseActorSchema,
    role: z.enum(RELEASE_PROVENANCE_ROLES),
  })
  .readonly();
export type ReleaseActorRef = z.infer<typeof ReleaseActorRefSchema>;

/**
 * The provenance record carried by every release record — the W033
 * deploy-model `DeployProvenance` shape, mirrored member-for-member
 * (parity-pinned by `test/parity.test.ts`).
 */
export const ReleaseProvenanceSchema = z
  .strictObject({
    actor: ReleaseActorRefSchema,
    /** The deterministic method that produced the record (e.g. 'derive-release-checklist'). */
    method: z.string().min(1).max(128),
    /** Caller-supplied instant (zero wall-clock). */
    instant: TimestampSchema,
    /** Digests of the exact upstream records this record derives from. */
    derivedFrom: z.array(Sha256DigestSchema).readonly(),
  })
  .readonly();
export type ReleaseProvenance = z.infer<typeof ReleaseProvenanceSchema>;

/** Convenience: a provenance record with no upstream derivations. */
export function rootProvenance(
  actorId: string,
  role: ReleaseProvenanceRole,
  method: string,
  instant: string,
): ReleaseProvenance {
  return { actor: { actorId, role }, method, instant, derivedFrom: [] };
}
