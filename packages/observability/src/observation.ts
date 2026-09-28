/**
 * The SECURITY OBSERVATION — the atomic audit fact of the W030
 * observability model: one security-relevant event reported by (or
 * about) an execution surface, SEALED and content-addressed (the
 * W006 exact-revision convention: every observation carries the
 * SHA-256 digest of its canonical JSON and an exact-revision
 * provenance reference to the SOURCE record it was derived from).
 *
 * - Observations are FACTS: admission is append-only; corrections are
 *   new observations, never mutations.
 * - Every observation is tenant-scoped (R12) and carries the acting
 *   principal, the subject it concerns, the closed observation class,
 *   the outcome, the severity, and a bounded neutral detail record.
 * - Cross-kernel vocabulary (W008 violation-detail codes, W009 denial
 *   codes, W020/W021/W022 status tokens) rides as BOUNDED NEUTRAL
 *   STRINGS inside `detail` — never re-declared typed vocabularies.
 * - Zero wall-clock: `observedAt` is caller-supplied payload data.
 */
import { z } from 'zod';
import { canonicalDigest, JsonValueSchema } from '@epoch/agent-protocol';
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import { fail, hasUnrecognizedKeys, validationError } from './issues';
import type { ObservabilityError, ObservabilityResult } from './errors';
import {
  ObservationIdSchema,
  PrincipalIdSchema,
  SubjectIdSchema,
  TenantIdSchema,
  TimestampSchema,
} from './primitives';

import {
  OBSERVABILITY_RECORD_VERSION,
  OBSERVATION_CLASSES,
  OBSERVATION_OUTCOMES,
  OBSERVATION_SEVERITIES,
  OBSERVATION_SCHEMA_NAME,
  OBSERVATION_SUBJECT_KINDS,
} from './version';
import type { ObservationSubjectKind } from './version';

// --------------------------------------------------------------------------------
// The observation vocabulary validators.
// --------------------------------------------------------------------------------

/** The observation subject-kind validator (closed vocabulary). */
export const ObservationSubjectKindSchema = z.enum(OBSERVATION_SUBJECT_KINDS).meta({
  id: 'ObservationSubjectKind',
  title: 'ObservationSubjectKind',
  description: 'What a security observation is about: extension, agent-session, simulation-run, action, principal, workspace, tenant, security-policy.',
});

/** The observation class validator (closed vocabulary). */
export const ObservationClassSchema = z.enum(OBSERVATION_CLASSES).meta({
  id: 'ObservationClass',
  title: 'ObservationClass',
  description:
    'The security-relevant fact family: sandbox-admission, sandbox-invocation, sandbox-violation, authorization-decision, tenant-boundary-check, agent-session, simulation-run, action-dispatch, security-audit.',
});

/** The observation outcome validator (closed vocabulary). */
export const ObservationOutcomeSchema = z.enum(OBSERVATION_OUTCOMES).meta({
  id: 'ObservationOutcome',
  title: 'ObservationOutcome',
  description: 'The observation outcome: observed (neutral fact), allowed, denied, violated.',
});

/** The observation severity validator (closed vocabulary). */
export const ObservationSeveritySchema = z.enum(OBSERVATION_SEVERITIES).meta({
  id: 'ObservationSeverity',
  title: 'ObservationSeverity',
  description: 'The observation severity: info, notice, warning, critical.',
});

// --------------------------------------------------------------------------------
// The provenance + content + sealed record.
// --------------------------------------------------------------------------------

/**
 * The exact-revision provenance reference: the digest of the SOURCE
 * record the observation was derived from (a W008 surface, a W009
 * decision, a W020 session snapshot, a W021 run, a W022 action, a
 * W041 projection). The referenced record need not be locally
 * present — this package owns observations, not the source records.
 */
export const ObservationProvenanceSchema = z
  .strictObject({
    sourceDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'ObservationProvenance',
    title: 'ObservationProvenance',
    description:
      'Exact-revision provenance of an observation: the canonical SHA-256 digest of the source record it was derived from (the W006 convention).',
  });

/** One observation provenance reference. */
export type ObservationProvenance = z.infer<typeof ObservationProvenanceSchema>;

/**
 * The immutable content of one observation — everything except the
 * content digest.
 *
 * The OBJECT schema carries the fields + the subject-kind agreement
 * refinement; the published content schema is its readonly
 * projection; the sealed envelope spreads the SAME object shape plus
 * the digest (the W024 entitlements convention).
 */
const ObservationObjectSchema = z
  .strictObject({
    schema: z.literal(OBSERVATION_SCHEMA_NAME),
    schemaVersion: z.literal(OBSERVABILITY_RECORD_VERSION),
    observationId: ObservationIdSchema,
    tenantId: TenantIdSchema,
    subjectKind: ObservationSubjectKindSchema,
    subjectId: SubjectIdSchema,
    observationClass: ObservationClassSchema,
    outcome: ObservationOutcomeSchema,
    severity: ObservationSeveritySchema,
    actor: PrincipalIdSchema,
    provenance: ObservationProvenanceSchema,
    observedAt: TimestampSchema,
    /** Bounded neutral detail (cross-kernel vocabulary rides as strings; strict record of JSON values). */
    detail: z.record(z.string().min(1).max(64), JsonValueSchema).optional(),
  })
  .superRefine((value, ctx) => {
    // The subject-kind/family agreement: the subject id's kind prefix
    // must be consistent with the closed subject kind (the family
    // grammar is permissive; this check catches drift early).
    const prefix = value.subjectId.slice(0, value.subjectId.indexOf(':'));
    const expected = SUBJECT_KIND_PREFIXES[value.subjectKind];
    if (prefix !== expected) {
      ctx.addIssue({
        code: 'custom',
        message: `subject id "${value.subjectId}" does not carry the "${expected}" kind prefix required by subject kind "${value.subjectKind}"`,
        path: ['subjectId'],
      });
    }
  });

/** The published observation content schema (readonly). */
export const ObservationContentSchema = ObservationObjectSchema.readonly().meta({
  id: 'ObservationContent',
  title: 'ObservationContent',
  description:
    'Immutable content of one security observation: tenant-scoped, subject-typed, class/outcome/severity-tagged, principal-acted, exact-revision-provenanced, caller-instanted.',
});

/** One observation content. */
export type ObservationContent = z.infer<typeof ObservationContentSchema>;

/** The SEALED observation: content plus its SHA-256 digest (the exact-revision address). */
export const SealedObservationSchema = z
  .strictObject({
    ...ObservationObjectSchema.shape,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedObservation',
    title: 'SealedObservation',
    description:
      'Published security-observation record: immutable content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed observation. */
export type SealedObservation = z.infer<typeof SealedObservationSchema>;

/** The subject-kind -> id kind-prefix agreement table. */
const SUBJECT_KIND_PREFIXES: Readonly<Record<ObservationSubjectKind, string>> = {
  extension: 'extension',
  'agent-session': 'session',
  'simulation-run': 'simrun',
  action: 'action',
  principal: 'principal',
  workspace: 'workspace',
  tenant: 'tenant',
  'security-policy': 'security-policy',
};

/** Compute the content digest of one observation (canonical SHA-256). */
export function computeObservationDigest(content: ObservationContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/**
 * Canonicalize observation content for digesting: `detail` keys are
 * sorted (two semantically equal observations with different detail
 * key order digest byte-identically — no insertion-order leaks). The
 * returned content is serialization-stable.
 */
function canonicalObservation(content: ObservationContent): ObservationContent {
  if (content.detail === undefined) return content;
  const sortedDetail: Record<string, JsonValue> = {};
  for (const key of Object.keys(content.detail).sort()) {
    sortedDetail[key] = content.detail[key]!;
  }
  return { ...content, detail: sortedDetail };
}

/** Seal valid observation content into its published record. Total. */
export function sealObservation(content: unknown): ObservabilityResult<SealedObservation> {
  const parsed = ObservationContentSchema.safeParse(content);
  if (!parsed.success) {
    return fail(observationParseError(parsed.error));
  }
  const value = canonicalObservation(parsed.data);
  return {
    ok: true,
    value: {
      ...value,
      contentDigest: canonicalDigest(value as unknown as JsonValue),
    },
  };
}

/**
 * Verify a sealed observation: schema validation plus digest
 * recomputation (tamper detection). Total.
 */
export function verifySealedObservation(sealed: unknown): ObservabilityResult<SealedObservation> {
  const parsed = SealedObservationSchema.safeParse(sealed);
  if (!parsed.success) {
    return fail(observationParseError(parsed.error));
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return fail({
      code: 'digest-mismatch',
      message: 'sealed observation digest does not match its content (tampered or mismatched envelope)',
      expected,
      encountered: contentDigest,
      subject: parsed.data.observationId,
    });
  }
  return sealObservation(content);
}

/** Map a zod failure of the observation schemas onto the typed taxonomy. */
function observationParseError(error: z.ZodError): ObservabilityError {
  if (hasUnrecognizedKeys(error)) {
    return {
      code: 'vendor-fields-rejected',
      message:
        'the observation carries unrecognized keys — observations are strict; vendor/provider fields are rejected (lock rule 13)',
      issues: error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || '$',
        message: issue.message,
      })),
    };
  }
  return validationError(error);
}
