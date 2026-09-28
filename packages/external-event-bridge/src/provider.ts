/**
 * The provider contract + capability discovery (the W042 dispatch pin):
 * provider registrations are TYPED RECORDS (adapter identity, supported
 * event/request classes, capability reference into the W007 registry)
 * and the bridge resolves a request to a provider BY CLASS, never by
 * name — the acceptance: a mocked reference provider AND a second
 * generic provider both satisfy the SAME contract.
 *
 * - `ExternalEventProvider` is the PORT a concrete adapter implements
 *   (the W007 adapter-sdk `AdapterDescriptor` is the REAL type — the
 *   SDK is a frozen runtime dependency; `deliver` is the only behavior
 *   the bridge needs: one typed outcome per delivery attempt);
 * - `SealedProviderRegistration` is the ADMITTED data record: content-
 *   addressed, tenant-scoped, carrying the exact descriptor digest
 *   (every dispatch is attributable to the precise adapter contract
 *   revision it ran against — the W007 binding-pin discipline);
 * - `resolveProvidersByClass` is the deterministic class resolution:
 *   canonicalized (sorted by adapter id, order-independent), with an
 *   optional preferred provider and exclusion set (the
 *   alternative-provider fallback input).
 *
 * OPTIONAL-PROVIDER SEMANTICS: the registry may be empty — every bridge
 * operation degrades to typed outcome records (provider-unavailable,
 * manual queue); nothing here requires any concrete provider to exist,
 * and nothing auto-registers at import (the no-bridge guarantee).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  computeAdapterDescriptorDigest,
  AdapterDescriptorSchema,
  CapabilityBindingSchema,
  type AdapterDescriptor,
  type CapabilityBinding,
} from '@epoch/adapter-sdk';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  BridgePrincipalIdSchema,
  BridgeTimestampSchema,
  ProviderRegistrationIdSchema,
  Sha256HexSchema,
} from './primitives';
import type { AdapterId } from './provenance';
import type { FilteredOutboundPayload } from './outbound';
import {
  EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
  INBOUND_EVENT_CLASSES,
  OUTBOUND_REQUEST_CLASSES,
  PROVIDER_REGISTRATION_SCHEMA_NAME,
} from './version';
import { classifiedParseError } from './issues';
import type { BridgeResult } from './errors';
import type { InboundEventClass, OutboundRequestClass } from './version';

// --------------------------------------------------------------------------------
// The provider port (the contract a concrete adapter implements).
// --------------------------------------------------------------------------------

/** The context of one delivery attempt handed to the provider port. */
export interface DeliveryAttemptContext {
  readonly attemptNo: number;
  readonly scheduledAt: string;
}

/**
 * The typed outcome of one delivery attempt reported by a provider
 * port: delivered successfully (carrying the provider's opaque delivery
 * reference), failed but retryable (the retry schedule continues), or
 * failed terminally (the fallback policy applies).
 */
export type ProviderDeliveryOutcome =
  | { readonly outcome: 'success'; readonly providerDeliveryRef: string }
  | { readonly outcome: 'retryable'; readonly detail: string }
  | { readonly outcome: 'terminal'; readonly detail: string };

/**
 * The dispatch view a provider port receives: everything the provider
 * needs to deliver — NEVER the projection allowlist (only the already
 * filtered payload plus the policy digest it was filtered under).
 */
export interface ProviderDispatchRequest {
  readonly requestId: string;
  readonly tenantId: string;
  readonly requestClass: OutboundRequestClass;
  readonly recipientRef: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly payload: FilteredOutboundPayload;
  readonly projectionDigest: Sha256Hex;
}

/**
 * THE provider contract (the W042 port): the adapter identity
 * (a REAL W007 AdapterDescriptor), the W007 capability binding it
 * serves, the inbound/outbound class support declarations, and the
 * single delivery behavior. A mocked reference provider and a second
 * generic provider satisfy this SAME contract interchangeably.
 */
export interface ExternalEventProvider {
  readonly descriptor: AdapterDescriptor;
  readonly capabilityBinding: CapabilityBinding;
  readonly supportedInboundClasses: readonly InboundEventClass[];
  readonly supportedOutboundClasses: readonly OutboundRequestClass[];
  deliver(request: ProviderDispatchRequest, attempt: DeliveryAttemptContext): ProviderDeliveryOutcome;
}

// --------------------------------------------------------------------------------
// The provider registration record.
// --------------------------------------------------------------------------------

/** The zod field map of the provider-registration content (shared with the sealed record). */
const PROVIDER_REGISTRATION_FIELDS = {
  schema: z.literal(PROVIDER_REGISTRATION_SCHEMA_NAME),
  schemaVersion: z.literal(EXTERNAL_EVENT_BRIDGE_RECORD_VERSION),
  registrationId: ProviderRegistrationIdSchema,
  tenantId: TenantIdSchema,
  adapterDescriptor: AdapterDescriptorSchema,
  adapterDescriptorDigest: Sha256HexSchema,
  capabilityBinding: CapabilityBindingSchema,
  supportedInboundClasses: z.array(z.enum(INBOUND_EVENT_CLASSES)).max(16).readonly(),
  supportedOutboundClasses: z.array(z.enum(OUTBOUND_REQUEST_CLASSES)).max(8).readonly(),
  registeredAt: BridgeTimestampSchema,
  registeredBy: BridgePrincipalIdSchema,
} as const;

/** The immutable content of one provider registration. */
export const ProviderRegistrationContentSchema = z
  .strictObject({ ...PROVIDER_REGISTRATION_FIELDS })
  .superRefine((registration, ctx) => {
    if (
      registration.supportedInboundClasses.length === 0 &&
      registration.supportedOutboundClasses.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'a provider registration declares at least one supported class (inbound or outbound)',
        path: ['supportedInboundClasses'],
      });
    }
    for (const field of ['supportedInboundClasses', 'supportedOutboundClasses'] as const) {
      const classes = registration[field];
      for (let i = 1; i < classes.length; i += 1) {
        if (classes[i]! <= classes[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be sorted ascending and duplicate-free (deterministic serialization)`,
            path: [field],
          });
          break;
        }
      }
    }
    if (
      computeAdapterDescriptorDigest(registration.adapterDescriptor) !==
      registration.adapterDescriptorDigest
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'adapterDescriptorDigest must equal the REAL SDK descriptor digest (content addressing)',
        path: ['adapterDescriptorDigest'],
      });
    }
  })
  .readonly()
  .meta({
    id: 'ProviderRegistrationContent',
    title: 'ProviderRegistrationContent',
    description:
      'The immutable content of one provider registration: registration id, tenant scope, the W007 adapter descriptor plus its exact digest, the W007 capability binding, the sorted supported inbound/outbound class declarations, and the caller-supplied registration provenance.',
  });

/** One provider-registration content. */
export type ProviderRegistrationContent = z.infer<typeof ProviderRegistrationContentSchema>;

/** The SEALED provider registration: content plus its canonical digest. */
export const SealedProviderRegistrationSchema = z
  .strictObject({ ...PROVIDER_REGISTRATION_FIELDS, contentDigest: Sha256HexSchema })
  .superRefine((registration, ctx) => {
    for (const field of ['supportedInboundClasses', 'supportedOutboundClasses'] as const) {
      const classes = registration[field];
      for (let i = 1; i < classes.length; i += 1) {
        if (classes[i]! <= classes[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be sorted ascending and duplicate-free (deterministic serialization)`,
            path: [field],
          });
          break;
        }
      }
    }
    if (
      computeAdapterDescriptorDigest(registration.adapterDescriptor) !==
      registration.adapterDescriptorDigest
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'adapterDescriptorDigest must equal the REAL SDK descriptor digest (content addressing)',
        path: ['adapterDescriptorDigest'],
      });
    }
  })
  .readonly()
  .meta({
    id: 'SealedProviderRegistration',
    title: 'SealedProviderRegistration',
    description:
      'Published provider registration: immutable content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed provider registration. */
export type SealedProviderRegistration = z.infer<typeof SealedProviderRegistrationSchema>;

/** Compute the content digest of a provider registration. */
export function computeProviderRegistrationDigest(content: ProviderRegistrationContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** The registration's replay identity (everything EXCEPT ids/provenance). */
function providerRegistrationKeyOf(
  registration: SealedProviderRegistration,
): Sha256Hex {
  return canonicalDigest({
    adapterId: registration.adapterDescriptor.adapterId,
    adapterDescriptorDigest: registration.adapterDescriptorDigest,
    capabilityBinding: registration.capabilityBinding,
    supportedInboundClasses: registration.supportedInboundClasses,
    supportedOutboundClasses: registration.supportedOutboundClasses,
  } as unknown as JsonValue);
}

/** One provider-registration admission outcome (duplicates are typed facts). */
export type ProviderRegistrationAdmission =
  | { readonly kind: 'registration-admitted'; readonly registration: SealedProviderRegistration }
  | {
      readonly kind: 'duplicate-registration-returned';
      readonly registration: SealedProviderRegistration;
    };

/**
 * Derive the registration content from a provider port (the identity,
 * capability binding and class support come from the port; ids and
 * provenance are caller-supplied).
 */
export function deriveProviderRegistrationContent(
  provider: ExternalEventProvider,
  input: {
    readonly registrationId: string;
    readonly tenantId: string;
    readonly registeredAt: string;
    readonly registeredBy: string;
  },
): ProviderRegistrationContent {
  return {
    schema: PROVIDER_REGISTRATION_SCHEMA_NAME,
    schemaVersion: EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
    registrationId: input.registrationId,
    tenantId: input.tenantId,
    adapterDescriptor: provider.descriptor,
    adapterDescriptorDigest: computeAdapterDescriptorDigest(provider.descriptor),
    capabilityBinding: provider.capabilityBinding,
    supportedInboundClasses: [...provider.supportedInboundClasses].sort(),
    supportedOutboundClasses: [...provider.supportedOutboundClasses].sort(),
    registeredAt: input.registeredAt,
    registeredBy: input.registeredBy,
  };
}

/** Seal valid provider-registration content into its published record. */
export function sealProviderRegistration(content: unknown): BridgeResult<SealedProviderRegistration> {
  const parsed = ProviderRegistrationContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeProviderRegistrationDigest(parsed.data) },
  };
}

/** Verify a sealed provider registration: schema + recomputed digest. */
export function verifySealedProviderRegistration(
  sealed: unknown,
): BridgeResult<SealedProviderRegistration> {
  const parsed = SealedProviderRegistrationSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const recomputed = computeProviderRegistrationDigest(content);
  if (recomputed !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `provider registration "${parsed.data.registrationId}" failed digest verification`,
        expected: recomputed,
        encountered: parsed.data.contentDigest,
        subject: parsed.data.registrationId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** Whether two sealed registrations carry the same replay identity. */
export function sameProviderRegistration(
  a: SealedProviderRegistration,
  b: SealedProviderRegistration,
): boolean {
  return providerRegistrationKeyOf(a) === providerRegistrationKeyOf(b);
}

// --------------------------------------------------------------------------------
// The class resolution (deterministic, canonicalized, order-independent).
// --------------------------------------------------------------------------------

/** The input of {@link resolveProvidersByClass}. */
export interface ProviderResolutionInput {
  readonly registrations: readonly SealedProviderRegistration[];
  readonly requestClass: OutboundRequestClass;
  /** A preferred provider (deterministically first when it qualifies). */
  readonly preferredAdapterId?: AdapterId | undefined;
  /** Providers excluded from resolution (the alternative-provider fallback). */
  readonly excludeAdapterIds?: readonly AdapterId[] | undefined;
}

/**
 * Resolve providers BY CLASS: the providers whose declared outbound
 * class support includes the request class, CANONICALIZED (sorted by
 * adapter id — registration order never leaks), with an optional
 * preferred provider first and an exclusion set applied. The same set
 * of registrations resolves identically regardless of registration
 * order (order-independent by construction).
 */
export function resolveProvidersByClass(
  input: ProviderResolutionInput,
): readonly SealedProviderRegistration[] {
  const excluded = new Set(input.excludeAdapterIds ?? []);
  const candidates = input.registrations
    .filter((registration) => !excluded.has(registration.adapterDescriptor.adapterId))
    .filter((registration) => registration.supportedOutboundClasses.includes(input.requestClass))
    .sort((a, b) => {
      const aId = a.adapterDescriptor.adapterId;
      const bId = b.adapterDescriptor.adapterId;
      return aId < bId ? -1 : aId > bId ? 1 : 0;
    });
  if (input.preferredAdapterId === undefined) return candidates;
  const preferred = candidates.find(
    (registration) => registration.adapterDescriptor.adapterId === input.preferredAdapterId,
  );
  if (preferred === undefined) return candidates;
  return [preferred, ...candidates.filter((registration) => registration !== preferred)];
}

/**
 * Classify WHY a class resolution produced no candidates (the typed
 * reason carried by the provider-unavailability record).
 */
export function classifyUnavailability(
  registrations: readonly SealedProviderRegistration[],
  requestClass: OutboundRequestClass,
  preferredAdapterId: AdapterId | undefined,
): 'no-provider-registered' | 'provider-lacks-class' | 'preferred-provider-unregistered' {
  if (registrations.length === 0) return 'no-provider-registered';
  if (
    preferredAdapterId !== undefined &&
    !registrations.some((registration) => registration.adapterDescriptor.adapterId === preferredAdapterId)
  ) {
    return 'preferred-provider-unregistered';
  }
  const anySupports = registrations.some((registration) =>
    registration.supportedOutboundClasses.includes(requestClass),
  );
  return anySupports ? 'preferred-provider-unregistered' : 'provider-lacks-class';
}
