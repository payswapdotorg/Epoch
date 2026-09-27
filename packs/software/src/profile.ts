/**
 * The DP1.0 software pack profile: the W036 `SolutionPackProfile`
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
  SOFTWARE_PACK_ID,
  SOFTWARE_PACK_RECORD_VERSION,
  SOFTWARE_PACK_VERSION,
  SOFTWARE_SUPPORTED_LIFECYCLE_VERSION,
} from './version';
import { classifyPackRecord, digestOf } from './util';
import type { PackResult } from './errors';

// --------------------------------------------------------------------------------
// The pack-owned profile constants (typed data, provider-neutral).
// --------------------------------------------------------------------------------

/**
 * The software display vocabulary for the eleven universal lifecycle
 * stages (USL1.0): the pack binds display terms onto the universal stages —
 * e.g. realize -> "Build & Deploy" (the Work Order pin) — it never invents
 * stages. The key set is pinned to `UNIVERSAL_LIFECYCLE_STAGES` by the
 * runtime parity test and by the W036 admit path (a non-universal key is
 * `authority-violation-rejected`).
 */
export const SOFTWARE_STAGE_VOCABULARY: Readonly<Record<UniversalLifecycleStage, string>> = {
  understand: 'Discovery & requirements',
  decide: 'Solution design',
  plan: 'Release planning',
  acquire: 'Provisioning & licensing',
  realize: 'Build & Deploy',
  observe: 'Telemetry & monitoring',
  actualize: 'Progress actualization',
  verify: 'Testing & review',
  forecast: 'Delivery forecast',
  close: 'Release & handover',
  learn: 'Retrospective & learning',
};

/**
 * The pack projection rules over the eleven Navigator projection kinds
 * (SN1.0), sorted by projection ascending and duplicate-free (the W036
 * profile schema refinement). The roadmap presentation binds onto the
 * `program-of-work` projection; the issue tracker onto `schedule`; the
 * deployment plan onto `realization` — synchronized projections, never new
 * authorities.
 */
export const SOFTWARE_PROJECTION_RULES: readonly {
  readonly projection: NavigatorProjectionKind;
  readonly presentation: string;
}[] = [
  { projection: 'acquisition', presentation: 'Provisioning & license register' },
  { projection: 'decision', presentation: 'Architecture decision log' },
  { projection: 'forecast', presentation: 'Delivery & reliability forecast' },
  { projection: 'learning', presentation: 'Post-incident review' },
  { projection: 'outcomes', presentation: 'Release outcomes & SLO attainment' },
  { projection: 'program-of-work', presentation: 'Roadmap & dependency schedule' },
  { projection: 'realization', presentation: 'Build & deployment plan' },
  { projection: 'schedule', presentation: 'Backlog & effort schedule' },
  { projection: 'solution', presentation: 'Architecture & service model' },
  { projection: 'verification', presentation: 'Test, review & deploy gates' },
  { projection: 'world-view', presentation: 'System & service topology view' },
];

/**
 * The specialized capabilities this pack may request (W007 capability
 * classes, provider-neutral qualified names; sorted ascending). A pack may
 * REQUEST capabilities — provider-specific behavior stays behind adapters.
 */
export const SOFTWARE_CAPABILITY_DEPENDENCIES: readonly string[] = [
  'epoch.capability.software-engineering-workspaces',
];

/** The measurement note carried on the profile (DP1.0 measurement methods). */
export const SOFTWARE_MEASUREMENT_NOTE =
  'Effort quantities follow net/contingency conventions (net planned hours with an explicit contingency factor ' +
  'for reviews, rework and coordination); counts are net plan-line counts over the plan quantity schedule; all ' +
  'derivations are exact decimal folds, deterministic and recomputed per projection.';

/** The migration/compatibility note carried on the profile. */
export const SOFTWARE_MIGRATION_NOTE =
  'Software pack 1.0.0 targets the USL1.0 universal lifecycle taught by solution-delivery 1.0.0; future pack ' +
  'versions add vocabulary additively (new measurement methods, classifications, templates, environment tiers) ' +
  'and re-pin supportedLifecycleVersion on kernel lifecycle bumps — never in-place record mutation.';

// --------------------------------------------------------------------------------
// Profile construction and admission.
// --------------------------------------------------------------------------------

/**
 * Build the software pack profile for one tenant: the W036
 * `SolutionPackProfile` shape instantiated with the pack-owned constants.
 * Pure and deterministic — the same tenant id yields a byte-identical
 * profile (digest-stable).
 */
export function softwarePackProfile(tenantId: string): SolutionPackProfile {
  return {
    schema: 'epoch.solution-delivery.pack-profile',
    schemaVersion: SOFTWARE_PACK_RECORD_VERSION,
    packId: SOFTWARE_PACK_ID,
    packVersion: SOFTWARE_PACK_VERSION,
    tenantId,
    supportedLifecycleVersion: SOFTWARE_SUPPORTED_LIFECYCLE_VERSION,
    stageVocabulary: { ...SOFTWARE_STAGE_VOCABULARY },
    projectionRules: SOFTWARE_PROJECTION_RULES.map((rule) => ({ ...rule })),
    measurementNote: SOFTWARE_MEASUREMENT_NOTE,
    capabilityDependencies: [...SOFTWARE_CAPABILITY_DEPENDENCIES],
    migrationNote: SOFTWARE_MIGRATION_NOTE,
  };
}

/**
 * Admit a software-pack profile through the W036 kernel path
 * (`admitPackProfile` — the DP1.0 acceptance gate). The kernel
 * pre-classifies authority-claim fields and non-universal stage bindings
 * as `authority-violation-rejected`, enforces the exact universal
 * lifecycle version, and rejects vendor fields — this pack owns NO
 * admission authority of its own.
 */
export function admitSoftwarePackProfile(profile: unknown): DeliveryResult<SolutionPackProfile> {
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

/** The sealed software pack profile: content plus its content digest. */
export const SealedSoftwareProfileSchema = z
  .strictObject({
    schema: z.literal('epoch.solution-delivery.pack-profile'),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
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
    id: 'SealedSoftwareProfile',
    title: 'SealedSoftwareProfile',
    description:
      'The sealed software pack profile: the W036 SolutionPackProfile content plus its pack-computed SHA-256 content digest (round-trip serialization evidence).',
  });

/** One sealed software pack profile. */
export type SealedSoftwareProfile = z.infer<typeof SealedSoftwareProfileSchema>;

/**
 * Seal a software pack profile (already admitted through the W036 path)
 * with its content digest.
 */
export function sealSoftwareProfile(profile: SolutionPackProfile): SealedSoftwareProfile {
  return { ...profile, contentDigest: digestPackProfile(profile) };
}

/**
 * Verify a sealed software pack profile: schema validation + digest
 * recomputation (`digest-mismatch` on tamper) + the W036 admission gate
 * (authority/vendor/lifecycle-version checks re-run by the kernel).
 */
export function verifySoftwareProfile(sealed: unknown): PackResult<SealedSoftwareProfile> {
  const writeIntent = classifyPackRecord(sealed);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = SealedSoftwareProfileSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'sealed software profile failed schema validation',
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
          'sealed software profile digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
