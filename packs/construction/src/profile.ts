/**
 * The DP1.0 construction pack profile: the W036 `SolutionPackProfile`
 * shape INSTANTIATED as typed data. The profile is admitted through the
 * W036 `admitPackProfile` path (the machine-readable acceptance gate) — a
 * profile carrying authority-claim fields or non-universal stage bindings
 * is pre-classified `authority-violation-rejected` by the kernel itself.
 *
 * The profile is BUILT per tenant (the W036 profile schema is
 * tenant-scoped); the stage vocabulary, projection rules, capability
 * dependencies and notes are pack-owned constants. Deterministic: the same
 * tenant id yields a byte-identical profile.
 */
import { z } from 'zod';
import { type Sha256Hex } from '@epoch/agent-protocol';
import {
  admitPackProfile,
  SemverCoreSchema,
  Sha256HexSchema,
  TenantIdSchema,
  type DeliveryResult,
  type NavigatorProjectionKind,
  type SolutionPackProfile,
  type UniversalLifecycleStage,
} from '@epoch/solution-delivery';
import {
  CONSTRUCTION_PACK_ID,
  CONSTRUCTION_PACK_RECORD_VERSION,
  CONSTRUCTION_PACK_VERSION,
  CONSTRUCTION_SUPPORTED_LIFECYCLE_VERSION,
} from './version';
import { digestOf } from './util';

// --------------------------------------------------------------------------------
// The pack-owned profile constants (typed data, provider-neutral).
// --------------------------------------------------------------------------------

/**
 * The construction display vocabulary for the eleven universal lifecycle
 * stages (USL1.0): the pack binds display terms onto the universal stages —
 * e.g. realize -> "Construction" — it never invents stages. The key set is
 * pinned to `UNIVERSAL_LIFECYCLE_STAGES` by the runtime parity test and by
 * the W036 admit path (a non-universal key is `authority-violation-rejected`).
 */
export const CONSTRUCTION_STAGE_VOCABULARY: Readonly<Record<UniversalLifecycleStage, string>> = {
  understand: 'Survey & investigation',
  decide: 'Design development',
  plan: 'Construction programming',
  acquire: 'Procurement',
  realize: 'Construction',
  observe: 'Field observation',
  actualize: 'Progress actualization',
  verify: 'Inspection & testing',
  forecast: 'Programme forecast',
  close: 'Handover',
  learn: 'Lessons learned',
};

/**
 * The pack projection rules over the eleven Navigator projection kinds
 * (SN1.0), sorted by projection ascending and duplicate-free (the W036
 * profile schema refinement). The BOQ presentation binds onto the
 * `schedule` projection; the construction programme onto
 * `program-of-work` — synchronized projections, never new authorities.
 */
export const CONSTRUCTION_PROJECTION_RULES: readonly {
  readonly projection: NavigatorProjectionKind;
  readonly presentation: string;
}[] = [
  { projection: 'acquisition', presentation: 'Procurement register' },
  { projection: 'decision', presentation: 'Design decision register' },
  { projection: 'forecast', presentation: 'Cost & programme forecast' },
  { projection: 'learning', presentation: 'Post-completion review' },
  { projection: 'outcomes', presentation: 'Practical completion & handover' },
  { projection: 'program-of-work', presentation: 'Construction programme' },
  { projection: 'realization', presentation: 'Site execution record' },
  { projection: 'schedule', presentation: 'Bill of quantities (BOQ)' },
  { projection: 'solution', presentation: 'Building solution & element schedule' },
  { projection: 'verification', presentation: 'Inspection & commissioning' },
  { projection: 'world-view', presentation: 'Site & building model view' },
];

/**
 * The specialized capabilities this pack may request (W007 capability
 * classes, provider-neutral qualified names; sorted ascending). A pack may
 * REQUEST capabilities — provider-specific behavior stays behind adapters.
 */
export const CONSTRUCTION_CAPABILITY_DEPENDENCIES: readonly string[] = [
  'epoch.capability.scene-processing',
  'epoch.capability.spatial-visualization',
];

/** The measurement note carried on the profile (DP1.0 measurement methods). */
export const CONSTRUCTION_MEASUREMENT_NOTE =
  'Quantities follow BOQ measurement conventions (net/gross rules with explicit waste allowances); ' +
  'rates are trade rate-library unit costs over the plan quantity schedule; all derivations are exact ' +
  'decimal folds, deterministic and recomputed per projection.';

/** The migration/compatibility note carried on the profile. */
export const CONSTRUCTION_MIGRATION_NOTE =
  'Construction pack 1.0.0 targets the USL1.0 universal lifecycle taught by solution-delivery 1.0.0; ' +
  'future pack versions add vocabulary additively (new measurement methods, classifications, templates) ' +
  'and re-pin supportedLifecycleVersion on kernel lifecycle bumps — never in-place record mutation.';

// --------------------------------------------------------------------------------
// Profile construction and admission.
// --------------------------------------------------------------------------------

/**
 * Build the construction pack profile for one tenant: the W036
 * `SolutionPackProfile` shape instantiated with the pack-owned constants.
 * Pure and deterministic — the same tenant id yields a byte-identical
 * profile (digest-stable).
 */
export function constructionPackProfile(tenantId: string): SolutionPackProfile {
  return {
    schema: 'epoch.solution-delivery.pack-profile',
    schemaVersion: CONSTRUCTION_PACK_RECORD_VERSION,
    packId: CONSTRUCTION_PACK_ID,
    packVersion: CONSTRUCTION_PACK_VERSION,
    tenantId,
    supportedLifecycleVersion: CONSTRUCTION_SUPPORTED_LIFECYCLE_VERSION,
    stageVocabulary: { ...CONSTRUCTION_STAGE_VOCABULARY },
    projectionRules: CONSTRUCTION_PROJECTION_RULES.map((rule) => ({ ...rule })),
    measurementNote: CONSTRUCTION_MEASUREMENT_NOTE,
    capabilityDependencies: [...CONSTRUCTION_CAPABILITY_DEPENDENCIES],
    migrationNote: CONSTRUCTION_MIGRATION_NOTE,
  };
}

/**
 * Admit a construction-pack profile through the W036 kernel path
 * (`admitPackProfile` — the DP1.0 acceptance gate). The kernel
 * pre-classifies authority-claim fields and non-universal stage bindings
 * as `authority-violation-rejected`, enforces the exact universal
 * lifecycle version, and rejects vendor fields — this pack owns NO
 * admission authority of its own.
 */
export function admitConstructionPackProfile(profile: unknown): DeliveryResult<SolutionPackProfile> {
  return admitPackProfile(profile);
}

/** The canonical SHA-256 digest of a pack profile (round-trip evidence). */
export function digestPackProfile(profile: SolutionPackProfile): Sha256Hex {
  return digestOf(profile);
}

// --------------------------------------------------------------------------------
// The serialized profile envelope (round-trip serialization evidence): the
// W036 profile content plus its pack-computed content digest.
// --------------------------------------------------------------------------------

/** The sealed construction pack profile: content plus its content digest. */
export const SealedConstructionProfileSchema = z
  .strictObject({
    schema: z.literal('epoch.solution-delivery.pack-profile'),
    schemaVersion: z.literal(CONSTRUCTION_PACK_RECORD_VERSION),
    packId: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
    packVersion: SemverCoreSchema,
    tenantId: TenantIdSchema,
    supportedLifecycleVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    stageVocabulary: z.record(z.string().min(1).max(64), z.string().min(1).max(64)),
    projectionRules: z
      .array(
        z
          .strictObject({
            projection: z.string().min(1).max(64),
            presentation: z.string().min(1).max(256),
          })
          .readonly(),
      )
      .max(32),
    measurementNote: z.string().max(2048).optional(),
    capabilityDependencies: z.array(z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/)).max(64).optional(),
    migrationNote: z.string().max(2048).optional(),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedConstructionProfile',
    title: 'SealedConstructionProfile',
    description:
      'The sealed construction pack profile: the W036 SolutionPackProfile content plus its pack-computed SHA-256 content digest (round-trip serialization evidence).',
  });

/** One sealed construction pack profile. */
export type SealedConstructionProfile = z.infer<typeof SealedConstructionProfileSchema>;

/**
 * Seal a construction pack profile (already admitted through the W036
 * path) with its content digest.
 */
export function sealConstructionProfile(
  profile: SolutionPackProfile,
): SealedConstructionProfile {
  return { ...profile, contentDigest: digestPackProfile(profile) };
}

/**
 * Verify a sealed construction pack profile: schema validation + digest
 * recomputation (`digest-mismatch` on tamper) + the W036 admission gate
 * (authority/vendor/lifecycle-version checks re-run by the kernel).
 */
export function verifyConstructionProfile(sealed: unknown): DeliveryResult<SealedConstructionProfile> {
  const parsed = SealedConstructionProfileSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'sealed construction profile failed schema validation',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = digestOf(content);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed construction profile digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}