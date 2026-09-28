/**
 * Billing ACCOUNT records — the buyer-side billing identity one tenant's
 * invoices hang off (the W024 billing surface).
 *
 * - A billing account is an explicit, IMMUTABLE, content-addressed record
 *   scoped to one tenant with ONE settlement currency (every line of
 *   every invoice on the account must use it — `currency-mismatch` is a
 *   typed rejection elsewhere in the kernel).
 * - The account is a BILLING identity ONLY: it is not a payment
 *   instrument, carries no credentials, no provider references, and no
 *   balance. Settlement state lives behind the SettlementPort seam; the
 *   Epoch-owned invoice record is the billing authority.
 * - Deterministic: plain JSON, strict objects (vendor fields rejected),
 *   canonical SHA-256 content addressing (the W023/W036 sealed-envelope
 *   discipline).
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { CurrencyCodeSchema, PrincipalIdSchema, Sha256HexSchema } from './primitives';
import { BillingAccountIdSchema } from './primitives';
import { BILLING_ACCOUNT_SCHEMA_NAME, ENTITLEMENTS_RECORD_VERSION } from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { EntitlementsResult } from './errors';

const BillingAccountObjectSchema = z.strictObject({
  schema: z.literal(BILLING_ACCOUNT_SCHEMA_NAME),
  schemaVersion: z.literal(ENTITLEMENTS_RECORD_VERSION),
  accountId: BillingAccountIdSchema,
  tenantId: TenantIdSchema,
  currency: CurrencyCodeSchema,
  displayName: z.string().min(1).max(256),
  openedAt: TimestampSchema,
  openedBy: PrincipalIdSchema,
});

/** The immutable content of one billing account. */
export const BillingAccountContentSchema = BillingAccountObjectSchema.readonly().meta({
  id: 'BillingAccountContent',
  title: 'BillingAccountContent',
  description:
    'Immutable content of one billing account: the account id, tenant scope, the single settlement currency, display name, and the opening instant and actor.',
});

/** One billing-account content. */
export type BillingAccountContent = z.infer<typeof BillingAccountContentSchema>;

/** The SEALED billing account: content plus its SHA-256 content digest. */
export const SealedBillingAccountSchema = z
  .strictObject({ ...BillingAccountObjectSchema.shape, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedBillingAccount',
    title: 'SealedBillingAccount',
    description:
      'The sealed billing account: immutable tenant-scoped billing identity with one settlement currency, plus the SHA-256 content digest (the exact-revision content address).',
  });

/** One sealed billing account. */
export type SealedBillingAccount = z.infer<typeof SealedBillingAccountSchema>;

/** Compute the content digest of one billing account (canonical JSON). */
export function computeBillingAccountDigest(content: BillingAccountContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid billing-account content into its published record. Total. */
export function sealBillingAccount(content: unknown): EntitlementsResult<SealedBillingAccount> {
  const parsed = BillingAccountContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: canonicalDigest(parsed.data as unknown as JsonValue) },
  };
}

/** Verify a sealed billing account: schema + digest recomputation. Total. */
export function verifySealedBillingAccount(sealed: unknown): EntitlementsResult<SealedBillingAccount> {
  const parsed = SealedBillingAccountSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed billing account digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: parsed.data.accountId,
      },
    };
  }
  return sealBillingAccount(content);
}
