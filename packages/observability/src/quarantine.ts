/**
 * The QUARANTINE fact model (the W030 deny-by-default discipline):
 * append-only, SEALED, content-addressed FACTS about subjects
 * (extensions, agent sessions, simulation runs, actions, principals).
 *
 * - `quarantine-imposed` — from its instant on, the subject is
 *   DENY-BY-DEFAULT at every admission the enforcement host guards
 *   (sandbox admission, invocation, execution-surface intake).
 * - `quarantine-released` — an EXPLICIT, authorization-gated release
 *   (carrying the releasing principal + reason); never a silent
 *   no-op, never a mutation of the impose fact.
 *
 * The derived quarantine state is a pure fold over the facts (the
 * LAST fact by instant wins; impose breaks release-ties
 * deterministically). Imposing on an already-quarantined subject is
 * the typed `quarantine-conflict`; releasing a non-quarantined
 * subject is the typed `quarantine-release-rejected`.
 */
import { z } from 'zod';
import { canonicalDigest } from '@epoch/agent-protocol';
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import { fail, hasUnrecognizedKeys, validationError } from './issues';
import type { ObservabilityError, ObservabilityResult } from './errors';
import {
  PrincipalIdSchema,
  QuarantineIdSchema,
  SubjectIdSchema,
  TenantIdSchema,
  TimestampSchema,
} from './primitives';

import {
  OBSERVABILITY_RECORD_VERSION,
  QUARANTINE_FACT_KINDS,
  QUARANTINE_SCHEMA_NAME,
} from './version';


/** The quarantine fact-kind validator. */
export const QuarantineFactKindSchema = z.enum(QUARANTINE_FACT_KINDS).meta({
  id: 'QuarantineFactKind',
  title: 'QuarantineFactKind',
  description: 'The quarantine fact kind: quarantine-imposed (deny-by-default) or quarantine-released (explicit, gated).',
});

/**
 * The immutable content of one quarantine fact. `reason` is REQUIRED
 * on both kinds (an unexplained quarantine is a typed validation
 * failure — security actions must be auditable).
 *
 * The OBJECT schema carries the fields; the published content schema
 * is its readonly projection; the sealed envelope spreads the SAME
 * object shape plus the digest (the W024 entitlements convention).
 */
const QuarantineFactObjectSchema = z.strictObject({
  schema: z.literal(QUARANTINE_SCHEMA_NAME),
  schemaVersion: z.literal(OBSERVABILITY_RECORD_VERSION),
  quarantineId: QuarantineIdSchema,
  tenantId: TenantIdSchema,
  factKind: QuarantineFactKindSchema,
  subjectId: SubjectIdSchema,
  reason: z.string().min(1).max(2000),
  actedAt: TimestampSchema,
  actedBy: PrincipalIdSchema,
});

/** The published quarantine-fact content schema (readonly). */
export const QuarantineFactContentSchema = QuarantineFactObjectSchema.readonly().meta({
  id: 'QuarantineFactContent',
  title: 'QuarantineFactContent',
  description:
    'Immutable content of one quarantine fact: tenant-scoped, subject-typed, reasoned, principal-acted, caller-instanted.',
});

/** One quarantine-fact content. */
export type QuarantineFactContent = z.infer<typeof QuarantineFactContentSchema>;

/** The SEALED quarantine fact: content plus its SHA-256 digest (the exact-revision address). */
export const SealedQuarantineFactSchema = z
  .strictObject({
    ...QuarantineFactObjectSchema.shape,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedQuarantineFact',
    title: 'SealedQuarantineFact',
    description:
      'Published quarantine-fact record: immutable content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed quarantine fact. */
export type SealedQuarantineFact = z.infer<typeof SealedQuarantineFactSchema>;

/** Compute the content digest of one quarantine fact (canonical SHA-256). */
export function computeQuarantineDigest(content: QuarantineFactContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid quarantine-fact content into its published record. Total. */
export function sealQuarantineFact(content: unknown): ObservabilityResult<SealedQuarantineFact> {
  const parsed = QuarantineFactContentSchema.safeParse(content);
  if (!parsed.success) {
    return fail(quarantineParseError(parsed.error));
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
 * Verify a sealed quarantine fact: schema validation plus digest
 * recomputation (tamper detection). Total.
 */
export function verifySealedQuarantineFact(sealed: unknown): ObservabilityResult<SealedQuarantineFact> {
  const parsed = SealedQuarantineFactSchema.safeParse(sealed);
  if (!parsed.success) {
    return fail(quarantineParseError(parsed.error));
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return fail({
      code: 'digest-mismatch',
      message: 'sealed quarantine-fact digest does not match its content (tampered or mismatched envelope)',
      expected,
      encountered: contentDigest,
      subject: parsed.data.quarantineId,
    });
  }
  return sealQuarantineFact(content);
}

/**
 * The derived quarantine state of one subject: the LAST fact by
 * instant wins (impose breaks release-ties — deny-by-default under
 * ambiguity). Pure and deterministic.
 */
export function isSubjectQuarantined(
  subjectId: string,
  facts: readonly SealedQuarantineFact[],
): boolean {
  let decidedAt: string | null = null;
  let quarantined = false;
  for (const fact of facts) {
    if (fact.subjectId !== subjectId) continue;
    if (
      decidedAt === null ||
      fact.actedAt > decidedAt ||
      (fact.actedAt === decidedAt && fact.factKind === 'quarantine-imposed')
    ) {
      decidedAt = fact.actedAt;
      quarantined = fact.factKind === 'quarantine-imposed';
    }
  }
  return quarantined;
}

/** The set of quarantined subjects among `subjectIds` (deterministic, sorted). */
export function quarantinedSubjectsOf(
  facts: readonly SealedQuarantineFact[],
  subjectIds: readonly string[],
): readonly string[] {
  const quarantined = new Set<string>();
  for (const subjectId of subjectIds) {
    if (isSubjectQuarantined(subjectId, facts)) {
      quarantined.add(subjectId);
    }
  }
  return [...quarantined].sort();
}

/** Map a zod failure of the quarantine schemas onto the typed taxonomy. */
function quarantineParseError(error: z.ZodError): ObservabilityError {
  if (hasUnrecognizedKeys(error)) {
    return {
      code: 'vendor-fields-rejected',
      message:
        'the quarantine fact carries unrecognized keys — quarantine facts are strict; vendor/provider fields are rejected (lock rule 13)',
      issues: error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || '$',
        message: issue.message,
      })),
    };
  }
  return validationError(error);
}
