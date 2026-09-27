/**
 * @epoch/mobile — provider-neutral zod primitives of the field shell.
 *
 * Composition policy (the W003/W036/W036 runtime-composition precedent):
 * the canonical digest machinery, timestamps, the JSON value space and
 * principal/solution/delivery/observation id grammars are REUSED from the
 * runtime dependencies (@epoch/agent-protocol, @epoch/solution-delivery,
 * @epoch/tenancy) — genuine runtime composition, never mirrors. Only the
 * mobile-owned field-shell id grammars (field-session, field-capture,
 * field-approval, field-queue, field-decision) are declared here.
 *
 * Neutrality (lock rule 13): no field here encodes a vendor, device product,
 * mobile OS, or toolchain. The neutral device vocabulary consumed by the
 * descriptor seam is owned by @epoch/experience-protocol (W011).
 */
import { z } from 'zod';
import { Sha256HexSchema, type Sha256Hex } from '@epoch/solution-delivery';
import { TimestampSchema, type Timestamp } from '@epoch/agent-protocol';
import {
  FIELD_APPROVAL_ID_PATTERN,
  FIELD_CAPTURE_ID_PATTERN,
  FIELD_DECISION_ID_PATTERN,
  FIELD_QUEUE_ID_PATTERN,
  FIELD_SESSION_ID_PATTERN,
} from './version';

/** Field capture-session identity: `field-session:<slug>`. */
export const FieldSessionIdSchema = z
  .string()
  .regex(FIELD_SESSION_ID_PATTERN, 'must be a field session id of the form "field-session:<slug>"')
  .meta({
    id: 'FieldSessionId',
    title: 'FieldSessionId',
    description: 'Opaque field capture-session identity: "field-session:" followed by a lowercase slug.',
  });

/** One field session id. */
export type FieldSessionId = z.infer<typeof FieldSessionIdSchema>;

/** Field capture identity: `field-capture:<slug>`. */
export const FieldCaptureIdSchema = z
  .string()
  .regex(FIELD_CAPTURE_ID_PATTERN, 'must be a field capture id of the form "field-capture:<slug>"')
  .meta({
    id: 'FieldCaptureId',
    title: 'FieldCaptureId',
    description: 'Opaque field capture identity: "field-capture:" followed by a lowercase slug.',
  });

/** One field capture id. */
export type FieldCaptureId = z.infer<typeof FieldCaptureIdSchema>;

/** Field approval-proposal identity: `field-approval:<slug>`. */
export const FieldApprovalIdSchema = z
  .string()
  .regex(FIELD_APPROVAL_ID_PATTERN, 'must be a field approval id of the form "field-approval:<slug>"')
  .meta({
    id: 'FieldApprovalId',
    title: 'FieldApprovalId',
    description: 'Opaque field approval-proposal identity: "field-approval:" followed by a lowercase slug.',
  });

/** One field approval id. */
export type FieldApprovalId = z.infer<typeof FieldApprovalIdSchema>;

/** Offline queue record identity: `field-queue:<slug>`. */
export const FieldQueueIdSchema = z
  .string()
  .regex(FIELD_QUEUE_ID_PATTERN, 'must be a queue record id of the form "field-queue:<slug>"')
  .meta({
    id: 'FieldQueueId',
    title: 'FieldQueueId',
    description: 'Opaque offline-queue record identity: "field-queue:" followed by a lowercase slug.',
  });

/** One queue record id. */
export type FieldQueueId = z.infer<typeof FieldQueueIdSchema>;

/** Gateway decision record identity: `field-decision:<slug>`. */
export const FieldDecisionIdSchema = z
  .string()
  .regex(FIELD_DECISION_ID_PATTERN, 'must be a decision record id of the form "field-decision:<slug>"')
  .meta({
    id: 'FieldDecisionId',
    title: 'FieldDecisionId',
    description: 'Opaque gateway decision-record identity: "field-decision:" followed by a lowercase slug.',
  });

/** One decision record id. */
export type FieldDecisionId = z.infer<typeof FieldDecisionIdSchema>;

// Re-exported one-stop primitives reused from the canonical packages.
export { TimestampSchema, Sha256HexSchema };
export type { Timestamp, Sha256Hex };
