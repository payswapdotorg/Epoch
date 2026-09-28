/**
 * @epoch/release-kit — the release scope (Work Order W035).
 *
 * The SCOPE is the release candidate's declaration of WHAT SHIPS and WHAT
 * PROVES IT READY, as typed, content-addressed data:
 *
 * - the exact release identity + label + source revision (a caller-supplied
 *   40-hex git SHA — the release tree never READS the repository, the
 *   revision is data);
 * - the readiness DOMAINS in play (the three W035 domains, subset);
 * - the component INVENTORY (the deployable surfaces shipping, kinds
 *   mirroring the W033 component-kind vocabulary);
 * - the verification BATTERY (command + expected exit code + declared
 *   timeout — the W033 GateCommand grammar, mirrored);
 * - the BENCHMARK CITATIONS (W034 budget records the release notes cite,
 *   with their verdicts — the W034 vocabulary, mirrored);
 * - the SDK SURFACE PINS (which documented SDK surfaces this release
 *   publishes, and where their docs live);
 * - the MARKETPLACE READINESS SUBJECT (the reference listing/entitlement
 *   the W023 readiness evidence is gathered against).
 *
 * `deriveReleaseChecklist` (checklist.ts) is a pure function of a sealed
 * scope: same scope -> same checklist items, same digests, every time.
 */
import { z } from 'zod';
import { canonicalJsonStringify, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  BENCHMARK_INPUT_UNITS,
  BUDGET_OUTCOMES,
  COMPONENT_SURFACE_PREFIXES,
  READINESS_DOMAINS,
  RELEASE_COMPONENT_KINDS,
  RELEASE_KIT_RECORD_VERSION,
  SDK_SURFACE_IDS,
} from './version';
import {
  PositiveIntSchema,
  ReleaseIdSchema,
  RevisionSchema,
  digestOfJson,
  firstIssueText,
  releaseFail,
  type ReleaseResult,
} from './primitives';
import { ReleaseProvenanceSchema, Sha256DigestSchema } from './provenance';

// --------------------------------------------------------------------------------
// Components (the deployable inventory).
// --------------------------------------------------------------------------------

/**
 * One deployable component of the release inventory. The `surface` is a
 * repository tree path whose prefix must MATCH the declared `kind` (the
 * W033 component-kind vocabulary: packages/ services/ apps/ adapters/
 * packs/).
 */
export const ReleaseComponentSchema = z
  .strictObject({
    surface: z.string().min(1).max(128),
    kind: z.enum(RELEASE_COMPONENT_KINDS),
    description: z.string().min(1).max(256),
  })
  .readonly()
  .superRefine((component, ctx) => {
    const prefix = COMPONENT_SURFACE_PREFIXES[component.kind];
    if (!component.surface.startsWith(prefix)) {
      ctx.addIssue({
        code: 'custom',
        message: `component of kind "${component.kind}" must reference a surface under "${prefix}" (got "${component.surface}")`,
      });
    }
  });
export type ReleaseComponent = z.infer<typeof ReleaseComponentSchema>;

// --------------------------------------------------------------------------------
// The verification battery (the W033 GateCommand grammar, mirrored).
// --------------------------------------------------------------------------------

/**
 * One verification-battery command — a STRUCTURAL MIRROR of the W033
 * deploy-model `GateCommand` (command + expected exit code + declared
 * timeout in milliseconds; commands are DATA, never executed in-model).
 * Parity is pinned by `test/parity.test.ts` against the real
 * @epoch/deploy-model schema.
 */
export const BatteryCommandSchema = z
  .strictObject({
    command: z.string().min(1).max(256),
    expectExitCode: z.number().int().min(0).max(255),
    /** Budget for the command, in milliseconds (declaration, not call). */
    timeoutMs: z.number().int().min(1).max(3_600_000),
  })
  .readonly();
export type BatteryCommand = z.infer<typeof BatteryCommandSchema>;

// --------------------------------------------------------------------------------
// Benchmark citations (the W034 budget-verdict facts, mirrored).
// --------------------------------------------------------------------------------

/**
 * One cited W034 performance budget record: the budget id, the measured
 * subject, the input unit + size the verdict was rendered at, the overall
 * verdict, and the content digests of the cited budget + sealed verdict
 * records. The vocabulary mirrors @epoch/performance (W034); parity is
 * pinned by `test/parity.test.ts`.
 */
export const BenchmarkCitationSchema = z
  .strictObject({
    budgetId: z.string().regex(/^budget:[a-z0-9][a-z0-9-]{0,62}$/),
    subject: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
    inputUnit: z.enum(BENCHMARK_INPUT_UNITS),
    inputSize: PositiveIntSchema,
    overall: z.enum(BUDGET_OUTCOMES),
    budgetDigest: Sha256DigestSchema,
    verdictDigest: Sha256DigestSchema,
  })
  .readonly();
export type BenchmarkCitation = z.infer<typeof BenchmarkCitationSchema>;

// --------------------------------------------------------------------------------
// SDK surface pins + the marketplace readiness subject.
// --------------------------------------------------------------------------------

/**
 * One documented SDK surface this release publishes: the surface id (the
 * closed SDK vocabulary) plus the documentation file that carries its
 * contract-version pin (docs/sdk/*).
 */
export const SdkSurfacePinSchema = z
  .strictObject({
    surfaceId: z.enum(SDK_SURFACE_IDS),
    docPath: z.string().regex(/^docs\/sdk\/[a-z0-9-]+\.md$/),
  })
  .readonly();
export type SdkSurfacePin = z.infer<typeof SdkSurfacePinSchema>;

/**
 * The marketplace readiness subject: the reference listing and entitlement
 * the W023 readiness evidence is gathered against (the id grammars mirror
 * @epoch/marketplace's LISTING_ID_PATTERN / ENTITLEMENT_ID_PATTERN —
 * parity-pinned by test).
 */
export const MarketplaceReadinessSubjectSchema = z
  .strictObject({
    listingId: z.string().regex(/^listing:[a-z0-9][a-z0-9-]{0,62}$/),
    entitlementId: z.string().regex(/^entitlement:[a-z0-9][a-z0-9-]{0,62}$/),
  })
  .readonly();
export type MarketplaceReadinessSubject = z.infer<typeof MarketplaceReadinessSubjectSchema>;

// --------------------------------------------------------------------------------
// The scope record.
// --------------------------------------------------------------------------------

const scopeShape = z
  .strictObject({
    recordVersion: z.literal(RELEASE_KIT_RECORD_VERSION),
    releaseId: ReleaseIdSchema,
    /** Human-readable release label (e.g. "E1.0/X1.0 Program Release 1"). */
    label: z.string().min(1).max(128),
    /** The exact source revision being released (40-hex git SHA, data). */
    revision: RevisionSchema,
    /** The readiness domains in play (subset of the three W035 domains). */
    domains: z.array(z.enum(READINESS_DOMAINS)).min(1),
    /** The deployable component inventory shipping in this release. */
    components: z.array(ReleaseComponentSchema).min(1),
    /** The verification battery (W033 gate grammar, mirrored). */
    battery: z.array(BatteryCommandSchema).min(1),
    /** The W034 budget records the release notes cite. */
    benchmarks: z.array(BenchmarkCitationSchema).min(1),
    /** The documented SDK surfaces this release publishes. */
    sdkSurfaces: z.array(SdkSurfacePinSchema).min(1),
    /** The W023 marketplace readiness subject. */
    marketplace: MarketplaceReadinessSubjectSchema,
    provenance: ReleaseProvenanceSchema,
  });

/** A release scope (content half). */
export const ReleaseScopeSchema = scopeShape.readonly();
export type ReleaseScope = z.infer<typeof ReleaseScopeSchema>;

/** A sealed release scope (content-addressed). */
export const SealedReleaseScopeSchema = scopeShape
  .extend({ digest: z.string().regex(/^[0-9a-f]{64}$/) })
  .readonly();
export type SealedReleaseScope = z.infer<typeof SealedReleaseScopeSchema>;

/** The content half of a sealed scope (digest excluded). */
export function scopeContent(scope: SealedReleaseScope): Omit<SealedReleaseScope, 'digest'> {
  const { digest: _digest, ...rest } = scope;
  void _digest;
  return rest;
}

/** Compute the canonical digest of scope content. */
export function computeScopeDigest(content: ReleaseScope): Sha256Hex {
  return digestOfJson(content as unknown as JsonValue);
}

/** Parse + validate scope-shaped input (the total admission path). */
export function parseReleaseScope(input: unknown): ReleaseResult<ReleaseScope> {
  const parsed = ReleaseScopeSchema.safeParse(input);
  if (!parsed.success) {
    return releaseFail('validation', `release scope failed validation: ${firstIssueText(parsed.error)}`, {
      subject: 'scope',
    });
  }
  return { ok: true, value: parsed.data };
}

/** Seal valid scope content (adds the content address). */
export function sealScope(input: unknown): ReleaseResult<SealedReleaseScope> {
  const admitted = parseReleaseScope(input);
  if (!admitted.ok) return admitted;
  return { ok: true, value: { ...admitted.value, digest: computeScopeDigest(admitted.value) } };
}

/** Verify a sealed scope's digest (tamper detection). */
export function verifyScopeDigest(scope: SealedReleaseScope): ReleaseResult<SealedReleaseScope> {
  const revalidated = ReleaseScopeSchema.safeParse(scopeContent(scope));
  if (!revalidated.success) {
    return releaseFail('validation', `scope "${scope.releaseId}" failed validation: ${firstIssueText(revalidated.error)}`, {
      subject: scope.releaseId,
    });
  }
  const expected = computeScopeDigest(revalidated.data);
  return expected === scope.digest
    ? { ok: true, value: scope }
    : releaseFail('digest-mismatch', `scope "${scope.releaseId}": digest does not match content (tampered scope)`, {
        subject: scope.releaseId,
      });
}

// --------------------------------------------------------------------------------
// Deterministic derived ids.
// --------------------------------------------------------------------------------

/** The checklist id of a release candidate (deterministic: `rc:<release slug>`). */
export function checklistIdOf(releaseId: string): string {
  return `rc:${releaseId.slice('release:'.length)}`;
}

/** The notes id of a release candidate (deterministic: `notes:<release slug>`). */
export function notesIdOf(releaseId: string): string {
  return `notes:${releaseId.slice('release:'.length)}`;
}

/** Canonical JSON of a scope (the exact serialization the digest covers). */
export function serializeScope(scope: SealedReleaseScope): string {
  return canonicalJsonStringify(scope as unknown as JsonValue);
}
