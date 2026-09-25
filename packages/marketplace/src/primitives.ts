/**
 * Provider-neutral zod primitives of the marketplace kernel. Every schema
 * here is a JSON-representable data shape; no field encodes a payment brand,
 * gateway, wallet, or API surface (architecture lock rule 13).
 *
 * Composition policy (the W010 runtime-composition precedent): digest
 * machinery, timestamps, the JSON value space, and the money primitives
 * (ISO 4217 currency codes, non-negative decimal amounts) are REUSED from
 * @epoch/agent-protocol; tenant/workspace ids are REUSED from
 * @epoch/tenancy (genuine runtime composition — the W009 grammar, never a
 * mirror). The principal-id and usage-stream grammars are MIRRORED from
 * @epoch/identity and @epoch/event-log and pinned by runtime parity tests
 * (the kernel-to-kernel devDependency precedent).
 */
import { z } from 'zod';
import {
  ISO_CURRENCY_PATTERN,
  NON_NEGATIVE_DECIMAL_PATTERN,
  QUALIFIED_NAME_PATTERN,
  SEMVER_CORE_PATTERN,
  TimestampSchema,
} from '@epoch/agent-protocol';
import { TenantIdSchema, WorkspaceIdSchema } from '@epoch/tenancy';
import {
  ENTITLEMENT_ID_PATTERN,
  LISTING_ID_PATTERN,
  MARKETPLACE_PRINCIPAL_ID_PATTERN,
  PAYMENT_PORT_ID_PATTERN,
  REVOCATION_ID_PATTERN,
  REVENUE_ID_PATTERN,
} from './version';

/** Lowercase hexadecimal SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** SHA-256 content digest as lowercase hex (the exact-revision address form). */
export const Sha256HexSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'Sha256Hex',
    title: 'Sha256Hex',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** SHA-256 digest string type. */
export type Sha256Hex = z.infer<typeof Sha256HexSchema>;

/** Listing identity: `listing:<slug>`, stable across published versions. */
export const ListingIdSchema = z
  .string()
  .regex(LISTING_ID_PATTERN, 'must be a listing id of the form "listing:<slug>"')
  .meta({
    id: 'ListingId',
    title: 'ListingId',
    description: 'Opaque marketplace listing identity: "listing:" followed by a lowercase slug (stable across versions).',
  });

/** One listing id. */
export type ListingId = z.infer<typeof ListingIdSchema>;

/** Entitlement identity: `entitlement:<slug>`. */
export const EntitlementIdSchema = z
  .string()
  .regex(ENTITLEMENT_ID_PATTERN, 'must be an entitlement id of the form "entitlement:<slug>"')
  .meta({
    id: 'EntitlementId',
    title: 'EntitlementId',
    description: 'Opaque entitlement identity: "entitlement:" followed by a lowercase slug.',
  });

/** One entitlement id. */
export type EntitlementId = z.infer<typeof EntitlementIdSchema>;

/** Entitlement revocation identity: `revocation:<slug>`. */
export const RevocationIdSchema = z
  .string()
  .regex(REVOCATION_ID_PATTERN, 'must be a revocation id of the form "revocation:<slug>"')
  .meta({
    id: 'RevocationId',
    title: 'RevocationId',
    description: 'Opaque entitlement-revocation identity: "revocation:" followed by a lowercase slug.',
  });

/** One revocation id. */
export type RevocationId = z.infer<typeof RevocationIdSchema>;

/** Developer revenue record identity: `revenue:<slug>`. */
export const RevenueIdSchema = z
  .string()
  .regex(REVENUE_ID_PATTERN, 'must be a revenue id of the form "revenue:<slug>"')
  .meta({
    id: 'RevenueId',
    title: 'RevenueId',
    description: 'Opaque developer revenue record identity: "revenue:" followed by a lowercase slug.',
  });

/** One revenue record id. */
export type RevenueId = z.infer<typeof RevenueIdSchema>;

/** Payment port identity: `port:<slug>` (the adapter seam, never a brand). */
export const PaymentPortIdSchema = z
  .string()
  .regex(PAYMENT_PORT_ID_PATTERN, 'must be a payment port id of the form "port:<slug>"')
  .meta({
    id: 'PaymentPortId',
    title: 'PaymentPortId',
    description: 'Opaque payment-port identity: "port:" followed by a lowercase slug (provider-neutral adapter seam).',
  });

/** One payment port id. */
export type PaymentPortId = z.infer<typeof PaymentPortIdSchema>;

/**
 * Principal identity of the actor named on a marketplace record — MIRRORED
 * from @epoch/identity (W009 grammar; runtime parity test pins the pattern).
 */
export const PrincipalIdSchema = z
  .string()
  .regex(MARKETPLACE_PRINCIPAL_ID_PATTERN, 'must be a principal id of the form "principal:<slug>"')
  .meta({
    id: 'PrincipalId',
    title: 'PrincipalId',
    description: 'Opaque acting principal: "principal:" followed by a lowercase slug (W009 identity grammar).',
  });

/** One principal id. */
export type PrincipalId = z.infer<typeof PrincipalIdSchema>;

/** Semantic-version core string (the agent-protocol grammar, R18). */
export const SemverCoreSchema = z
  .string()
  .regex(SEMVER_CORE_PATTERN, 'must be a semantic version core of the form MAJOR.MINOR.PATCH')
  .meta({
    id: 'SemverCore',
    title: 'SemverCore',
    description: 'Semantic version core (no prerelease/build suffixes).',
  });

/** One semver core. */
export type SemverCore = z.infer<typeof SemverCoreSchema>;

/** ISO 4217 currency code (agent-protocol grammar). */
export const CurrencyCodeSchema = z
  .string()
  .regex(ISO_CURRENCY_PATTERN, 'must be an ISO 4217 currency code (three uppercase letters)')
  .meta({
    id: 'CurrencyCode',
    title: 'CurrencyCode',
    description: 'ISO 4217 currency code (three uppercase letters).',
  });

/** One currency code. */
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

/** Non-negative decimal amount as a canonical string (agent-protocol grammar). */
export const NonNegativeDecimalSchema = z
  .string()
  .regex(NON_NEGATIVE_DECIMAL_PATTERN, 'must be a non-negative decimal string (no exponent, no sign)')
  .meta({
    id: 'NonNegativeDecimal',
    title: 'NonNegativeDecimal',
    description: 'Non-negative decimal amount as a canonical string (digest-safe, no exponent form).',
  });

/** One non-negative decimal amount. */
export type NonNegativeDecimal = z.infer<typeof NonNegativeDecimalSchema>;

/** Positive integer (seat counts, sequence-like counters). */
export const PositiveIntegerSchema = z
  .number()
  .int('must be an integer')
  .min(1, 'must be at least 1')
  .max(Number.MAX_SAFE_INTEGER, 'must be a safe integer')
  .meta({
    id: 'PositiveInteger',
    title: 'PositiveInteger',
    description: 'Positive integer (1 to MAX_SAFE_INTEGER).',
  });

/** One positive integer. */
export type PositiveInteger = z.infer<typeof PositiveIntegerSchema>;

/** Opaque bounded reference string (e.g. a port-side record reference). */
export const OpaqueReferenceSchema = z
  .string()
  .min(1)
  .max(256)
  .meta({
    id: 'OpaqueReference',
    title: 'OpaqueReference',
    description: 'Opaque, bounded, provider-neutral reference string owned by its producing system.',
  });

/** One opaque reference. */
export type OpaqueReference = z.infer<typeof OpaqueReferenceSchema>;

/** Qualified type name (agent-protocol grammar — capability ids). */
export const QualifiedNameSchema = z
  .string()
  .regex(QUALIFIED_NAME_PATTERN, 'must be a dot-namespaced qualified name')
  .meta({
    id: 'QualifiedName',
    title: 'QualifiedName',
    description: 'Dot-namespaced qualified name (the agent-protocol capability-id grammar).',
  });

/** One qualified name. */
export type QualifiedName = z.infer<typeof QualifiedNameSchema>;

// Re-exported for the package surface: tenancy grammars composed at runtime.
export { TenantIdSchema, WorkspaceIdSchema };
export type { TenantId, WorkspaceId } from '@epoch/tenancy';
export { TimestampSchema };
export type { Timestamp } from '@epoch/agent-protocol';
