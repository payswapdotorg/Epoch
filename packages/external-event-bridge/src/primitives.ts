/**
 * The shared zod primitives of every bridge record (the W036 primitives
 * convention: pattern-pinned opaque ids, the tenancy tenant grammar,
 * the protocol timestamp/digest grammars, and the canonical JSON value
 * space — all imported from their owning packages, never re-declared).
 */
import { z } from 'zod';
import { JsonValueSchema, TimestampSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  BRIDGE_ACTOR_PATTERN,
  BRIDGE_EVENT_ID_PATTERN,
  BRIDGE_STREAM_ID_PATTERN,
  CAUSATION_ID_PATTERN,
  CORRELATION_ID_PATTERN,
  DELIVERY_RECEIPT_ID_PATTERN,
  FIELD_TEMPLATE_PATTERN,
  IDEMPOTENCY_KEY_PATTERN,
  INTAKE_PROPOSAL_ID_PATTERN,
  INTAKE_RECEIPT_ID_PATTERN,
  MANUAL_QUEUE_ID_PATTERN,
  OUTBOUND_REQUEST_ID_PATTERN,
  PROVIDER_REGISTRATION_ID_PATTERN,
  RECIPIENT_REF_PATTERN,
} from './version';

/** One canonical JSON value (the shared protocol grammar). */
export const CanonicalJsonSchema = JsonValueSchema;

/** One producer-supplied instant (never a clock read). */
export const BridgeTimestampSchema = TimestampSchema;

/** One tenant id (the W009 tenancy grammar). */
export const BridgeTenantIdSchema = TenantIdSchema;

/** One acting principal (the W009 identity grammar). */
export const BridgePrincipalIdSchema = z.string().regex(BRIDGE_ACTOR_PATTERN);

/** One SHA-256 content digest (64 lowercase hex). */
export const Sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/);

/** One normalized external-event id. */
export const ExternalEventIdSchema = z.string().regex(BRIDGE_EVENT_ID_PATTERN);

/** One observation intake-proposal id. */
export const IntakeProposalIdSchema = z.string().regex(INTAKE_PROPOSAL_ID_PATTERN);

/** One outbound request id. */
export const OutboundRequestIdSchema = z.string().regex(OUTBOUND_REQUEST_ID_PATTERN);

/** One provider-registration id. */
export const ProviderRegistrationIdSchema = z.string().regex(PROVIDER_REGISTRATION_ID_PATTERN);

/** One delivery-receipt id. */
export const DeliveryReceiptIdSchema = z.string().regex(DELIVERY_RECEIPT_ID_PATTERN);

/** One intake-receipt id. */
export const IntakeReceiptIdSchema = z.string().regex(INTAKE_RECEIPT_ID_PATTERN);

/** One manual-queue record id. */
export const ManualQueueIdSchema = z.string().regex(MANUAL_QUEUE_ID_PATTERN);

/** One correlation id (ties an outbound request to its inbound responses). */
export const CorrelationIdSchema = z.string().regex(CORRELATION_ID_PATTERN);

/** One causation id (the prior fact this record is caused by). */
export const CausationIdSchema = z.string().regex(CAUSATION_ID_PATTERN);

/** One idempotency key (the duplicate-delivery identity). */
export const IdempotencyKeySchema = z.string().regex(IDEMPOTENCY_KEY_PATTERN);

/** One opaque recipient reference (a channel, role or person selector). */
export const RecipientRefSchema = z.string().regex(RECIPIENT_REF_PATTERN);

/** One field-path allowlist template (the W041 grammar mirror). */
export const FieldTemplateSchema = z.string().regex(FIELD_TEMPLATE_PATTERN);

/** One bridge event stream id (the W010 grammar mirror). */
export const BridgeStreamIdSchema = z.string().regex(BRIDGE_STREAM_ID_PATTERN);

/** One opaque JSON object payload (bounded key set). */
export const OpaquePayloadSchema = z.record(z.string().min(1).max(256), JsonValueSchema).readonly();

/** One positive integer (attempt numbers, counts, revisions). */
export const PositiveIntegerSchema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);

/** Re-exported inference types (the shared primitive surface). */
export type Timestamp = z.infer<typeof BridgeTimestampSchema>;
export type TenantId = z.infer<typeof BridgeTenantIdSchema>;
export type PrincipalId = z.infer<typeof BridgePrincipalIdSchema>;
export type Sha256Hex = z.infer<typeof Sha256HexSchema>;
export type ExternalEventId = z.infer<typeof ExternalEventIdSchema>;
export type IntakeProposalId = z.infer<typeof IntakeProposalIdSchema>;
export type OutboundRequestId = z.infer<typeof OutboundRequestIdSchema>;
export type ProviderRegistrationId = z.infer<typeof ProviderRegistrationIdSchema>;
export type DeliveryReceiptId = z.infer<typeof DeliveryReceiptIdSchema>;
export type IntakeReceiptId = z.infer<typeof IntakeReceiptIdSchema>;
export type ManualQueueId = z.infer<typeof ManualQueueIdSchema>;
export type CorrelationId = z.infer<typeof CorrelationIdSchema>;
export type CausationId = z.infer<typeof CausationIdSchema>;
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;
export type RecipientRef = z.infer<typeof RecipientRefSchema>;
export type FieldTemplate = z.infer<typeof FieldTemplateSchema>;
export type BridgeStreamId = z.infer<typeof BridgeStreamIdSchema>;
