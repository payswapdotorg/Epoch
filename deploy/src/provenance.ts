/**
 * @epoch/deploy-model — provenance on every record (W006 discipline,
 * applied to deployment).
 *
 * Every plan, step, outcome, receipt, runbook and checklist carries a
 * sealed {@link DeployProvenance}: WHO produced it (typed actor), HOW (the
 * method string), WHEN (caller-supplied instant — never wall-clock), and
 * WHAT it derives from (digests of the exact upstream records). Provenance
 * is part of the digested content: a record is not admit-able without it.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { ActorIdSchema, Sha256DigestSchema } from './primitives';

/** Operator roles recognized by the deploy model (closed vocabulary). */
export const PROVENANCE_ROLES = [
  'release-manager',
  'deployer',
  'planner',
  'executor',
  'operator',
  'auditor',
] as const;
export type ProvenanceRole = (typeof PROVENANCE_ROLES)[number];

/** Typed actor reference (human or system operator; opaque id). */
export const DeployActorSchema = z
  .strictObject({
    actorId: ActorIdSchema,
    role: z.enum(PROVENANCE_ROLES),
  })
  .readonly();
export type DeployActor = z.infer<typeof DeployActorSchema>;

/** Provenance record carried by every deploy-model record. */
export const DeployProvenanceSchema = z
  .strictObject({
    actor: DeployActorSchema,
    /** The deterministic method that produced the record (e.g. 'plan-deployment'). */
    method: z.string().min(1).max(128),
    /** Caller-supplied instant (zero wall-clock). */
    instant: TimestampSchema,
    /** Digests of the exact upstream records this record derives from. */
    derivedFrom: z.array(Sha256DigestSchema).readonly(),
  })
  .readonly();
export type DeployProvenance = z.infer<typeof DeployProvenanceSchema>;
