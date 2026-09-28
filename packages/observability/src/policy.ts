/**
 * Security policy IS DATA (the W030 pin, the W041/W043 policy-as-data
 * convention): typed, versioned, SEALED records binding a tenant's
 * ISOLATION PROFILE (the maximum admitted sandbox trust class, the
 * admitted extension flavors, the admitted data-handling
 * classifications, whether a marketplace listing reference is
 * required, whether violations impose quarantine) and its
 * OBSERVABILITY THRESHOLDS (the critical-violation counts at which
 * the derived security-health projection flips to `degraded` /
 * `critical`).
 *
 * Swapping the ACTIVE policy revision changes enforcement with ZERO
 * code change. Policies are tenant-scoped; the in-store lookup is by
 * (tenantId, policyId); the active policy of a tenant is the LATEST
 * activated revision (retirement removes it from enforcement without
 * deleting history — facts stay admitted).
 */
import { z } from 'zod';
import { canonicalDigest } from '@epoch/agent-protocol';
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import { fail, hasUnrecognizedKeys, validationError } from './issues';
import type { ObservabilityError, ObservabilityResult } from './errors';
import {
  PrincipalIdSchema,
  SecurityPolicyIdSchema,
  SemverCoreSchema,
  TenantIdSchema,
  TimestampSchema,
} from './primitives';

import {
  OBSERVABILITY_RECORD_VERSION,
  SANDBOX_DATA_HANDLING,
  SANDBOX_FLAVORS,
  SECURITY_POLICY_SCHEMA_NAME,
} from './version';


// --------------------------------------------------------------------------------
// The isolation profile.
// --------------------------------------------------------------------------------

/** One admitted sandbox flavor of the isolation profile (the W008 vocabulary). */
const SandboxFlavorSchema = z.enum(SANDBOX_FLAVORS);

/** One admitted data-handling classification of the isolation profile (the W008 vocabulary). */
const SandboxDataHandlingSchema = z.enum(SANDBOX_DATA_HANDLING);

/**
 * The isolation profile (the sandbox-admission half of a security
 * policy): every field is data; enforcement consumes it, never
 * hard-codes it.
 */
export const IsolationProfileSchema = z
  .strictObject({
    /** The MAXIMUM trust class admitted (a subject ABOVE it is a typed violation). */
    maxTrustClass: z.string().regex(/^t[0-4]$/),
    /** The admitted extension flavors (the W008 vocabulary, non-empty subset, canonically unique). */
    allowedFlavors: z.array(SandboxFlavorSchema).min(1).max(4),
    /** The admitted data-handling classifications (the W008 vocabulary, non-empty subset, canonically unique). */
    allowedDataHandling: z.array(SandboxDataHandlingSchema).min(1).max(3),
    /** Whether sandbox admission REQUIRES a marketplace listing reference (W023 provenance). */
    requireMarketplaceListing: z.boolean(),
    /** Whether an isolation violation AUTOMATICALLY imposes quarantine (deny-by-default). */
    quarantineOnViolation: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const flavorSeen = new Set<string>();
    for (const flavor of value.allowedFlavors) {
      if (flavorSeen.has(flavor)) {
        ctx.addIssue({
          code: 'custom',
          message: 'allowedFlavors carries a duplicate entry',
          path: ['allowedFlavors'],
        });
        return;
      }
      flavorSeen.add(flavor);
    }
    const handlingSeen = new Set<string>();
    for (const handling of value.allowedDataHandling) {
      if (handlingSeen.has(handling)) {
        ctx.addIssue({
          code: 'custom',
          message: 'allowedDataHandling carries a duplicate entry',
          path: ['allowedDataHandling'],
        });
        return;
      }
      handlingSeen.add(handling);
    }
  })
  .readonly()
  .meta({
    id: 'IsolationProfile',
    title: 'IsolationProfile',
    description:
      'The sandbox-admission half of a security policy: maximum admitted trust class, admitted flavors, admitted data-handling classifications, listing requirement, quarantine-on-violation.',
  });

/** The isolation profile of one security policy. */
export type IsolationProfile = z.infer<typeof IsolationProfileSchema>;

// --------------------------------------------------------------------------------
// The observability thresholds.
// --------------------------------------------------------------------------------

/**
 * The observability thresholds (the health-projection half of a
 * security policy): the critical-violation counts at which the
 * derived health projection flips.
 */
export const SecurityThresholdsSchema = z
  .strictObject({
    /** Critical violations at or above this count flip health to `degraded`. */
    degradedAtCriticalViolations: z.number().int().min(1),
    /** Critical violations at or above this count flip health to `critical` (must exceed the degraded threshold). */
    criticalAtCriticalViolations: z.number().int().min(2),
  })
  .superRefine((value, ctx) => {
    if (value.criticalAtCriticalViolations <= value.degradedAtCriticalViolations) {
      ctx.addIssue({
        code: 'custom',
        message: 'criticalAtCriticalViolations must exceed degradedAtCriticalViolations',
        path: ['criticalAtCriticalViolations'],
      });
    }
  })
  .readonly()
  .meta({
    id: 'SecurityThresholds',
    title: 'SecurityThresholds',
    description:
      'The health-projection thresholds of a security policy: critical-violation counts flipping health to degraded then critical.',
  });

/** The observability thresholds of one security policy. */
export type SecurityThresholds = z.infer<typeof SecurityThresholdsSchema>;

// --------------------------------------------------------------------------------
// The policy lifecycle + content + sealed record.
// --------------------------------------------------------------------------------

/** The policy lifecycle vocabulary. */
export const POLICY_STATUSES = ['active', 'retired'] as const;

/** One policy status. */
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

/** The policy status validator. */
export const PolicyStatusSchema = z.enum(POLICY_STATUSES).meta({
  id: 'PolicyStatus',
  title: 'PolicyStatus',
  description: 'The security-policy lifecycle status: active (enforced) or retired (history only).',
});

/**
 * The immutable content of one security policy — everything except
 * the content digest. `activatedAt` is caller-supplied (zero
 * wall-clock); the ACTIVE policy of a tenant is the LATEST
 * `activatedAt` among active revisions (revision breaks ties).
 *
 * The OBJECT schema carries the fields; the published content schema
 * is its readonly projection; the sealed envelope spreads the SAME
 * object shape plus the digest (the W024 entitlements convention —
 * refinements live on the object schema and re-run on every seal).
 */
const SecurityPolicyObjectSchema = z.strictObject({
  schema: z.literal(SECURITY_POLICY_SCHEMA_NAME),
  schemaVersion: z.literal(OBSERVABILITY_RECORD_VERSION),
  policyId: SecurityPolicyIdSchema,
  tenantId: TenantIdSchema,
  revision: SemverCoreSchema,
  displayName: z.string().min(1).max(128),
  isolation: IsolationProfileSchema,
  thresholds: SecurityThresholdsSchema,
  status: PolicyStatusSchema,
  activatedAt: TimestampSchema,
  activatedBy: PrincipalIdSchema,
  notes: z.string().max(2000).optional(),
});

/** The published security-policy content schema (readonly). */
export const SecurityPolicyContentSchema = SecurityPolicyObjectSchema.readonly().meta({
  id: 'SecurityPolicyContent',
  title: 'SecurityPolicyContent',
  description:
    'Immutable content of one security policy: tenant-scoped isolation profile + observability thresholds + lifecycle status (policy is data).',
});

/** One security-policy content. */
export type SecurityPolicyContent = z.infer<typeof SecurityPolicyContentSchema>;

/** The SEALED security policy: content plus its SHA-256 digest (the exact-revision address). */
export const SealedSecurityPolicySchema = z
  .strictObject({
    ...SecurityPolicyObjectSchema.shape,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedSecurityPolicy',
    title: 'SealedSecurityPolicy',
    description:
      'Published security-policy record: immutable content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed security policy. */
export type SealedSecurityPolicy = z.infer<typeof SealedSecurityPolicySchema>;

/** Compute the content digest of one policy (canonical SHA-256). */
export function computeSecurityPolicyDigest(content: SecurityPolicyContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid policy content into its published record. Total. */
export function sealSecurityPolicy(content: unknown): ObservabilityResult<SealedSecurityPolicy> {
  const parsed = SecurityPolicyContentSchema.safeParse(content);
  if (!parsed.success) {
    return fail(policyParseError(parsed.error));
  }
  const value = parsed.data;
  return {
    ok: true,
    value: {
      ...value,
      contentDigest: canonicalDigest(value as unknown as JsonValue),
    },
  };
}

/**
 * Verify a sealed security policy: schema validation plus digest
 * recomputation (tamper detection). Total.
 */
export function verifySealedSecurityPolicy(sealed: unknown): ObservabilityResult<SealedSecurityPolicy> {
  const parsed = SealedSecurityPolicySchema.safeParse(sealed);
  if (!parsed.success) {
    return fail(policyParseError(parsed.error));
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return fail({
      code: 'digest-mismatch',
      message: 'sealed security-policy digest does not match its content (tampered or mismatched envelope)',
      expected,
      encountered: contentDigest,
      subject: parsed.data.policyId,
    });
  }
  return sealSecurityPolicy(content);
}

/** Map a zod failure of the policy schemas onto the typed taxonomy. */
function policyParseError(error: z.ZodError): ObservabilityError {
  if (hasUnrecognizedKeys(error)) {
    return {
      code: 'vendor-fields-rejected',
      message:
        'the policy carries unrecognized keys — security policies are strict; vendor/provider fields are rejected (lock rule 13)',
      issues: error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || '$',
        message: issue.message,
      })),
    };
  }
  return validationError(error);
}

/** Select the ACTIVE policy of one tenant from a revision set (latest activation; revision breaks ties). */
export function selectActivePolicy(
  policies: readonly SealedSecurityPolicy[],
): SealedSecurityPolicy | null {
  let selected: SealedSecurityPolicy | null = null;
  for (const policy of policies) {
    if (policy.status !== 'active') continue;
    if (
      selected === null ||
      policy.activatedAt > selected.activatedAt ||
      (policy.activatedAt === selected.activatedAt && policy.revision > selected.revision)
    ) {
      selected = policy;
    }
  }
  return selected;
}
