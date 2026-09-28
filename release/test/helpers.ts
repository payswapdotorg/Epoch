// Shared fixtures for the release-kit tests. Builders return loose JSON
// objects so negative tests can corrupt single fields precisely (the
// W006/W007/W033 helpers pattern). ZERO clock reads: every instant is a
// fixed constant (caller-supplied producer data).
import {
  completeChecklistItem,
  sealScope,
  type SealedReleaseChecklist,
  type SealedReleaseScope,
} from '../src/index';

/** The fixed instant series (caller-supplied, never clock-read). */
export const T = [
  '2026-02-10T09:00:00.000Z',
  '2026-02-10T09:00:01.000Z',
  '2026-02-10T09:00:02.000Z',
  '2026-02-10T09:00:03.000Z',
  '2026-02-10T09:00:04.000Z',
  '2026-02-10T09:00:05.000Z',
  '2026-02-10T09:00:06.000Z',
  '2026-02-10T09:00:07.000Z',
  '2026-02-10T09:00:08.000Z',
  '2026-02-10T09:00:09.000Z',
] as const;

/** The release engineer (the W033 actor grammar). */
export const ACTOR = 'actor:release-engineer';

/** The typed actor reference of the fixtures (the W033 actor grammar). */
export const ACTOR_REF = { actorId: ACTOR, role: 'release-manager' } as const;

/** The vendor tenant of the reference scope. */
export const VENDOR = 'tenant:acme-tools';

/** The buyer tenant of the marketplace readiness subject. */
export const BUYER = 'tenant:globex';

/** A deterministic 64-hex digest constant (content-independent fixtures). */
export const DIGEST_A = 'a'.repeat(64);
export const DIGEST_B = 'b'.repeat(64);
export const DIGEST_C = 'c'.repeat(64);
export const DIGEST_D = 'd'.repeat(64);
export const DIGEST_E = 'e'.repeat(64);
export const DIGEST_F = 'f'.repeat(64);

/** The fixed source revision of the reference scope (data, never read). */
export const REVISION = '39ce5b6c1258d9f755dc8a37ddb1c37304bb02fa';

/** The verification battery of record (mirrors the W033 reference battery). */
export const REFERENCE_BATTERY = [
  { command: 'pnpm install', expectExitCode: 0, timeoutMs: 600_000 },
  { command: 'pnpm check', expectExitCode: 0, timeoutMs: 600_000 },
  { command: 'pnpm exec turbo run typecheck lint test build --concurrency=1 --force', expectExitCode: 0, timeoutMs: 3_600_000 },
] as const;

/** The reference release scope as loose JSON. */
export function referenceScope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    recordVersion: 1,
    releaseId: 'release:e1-program-1',
    label: 'E1.0/X1.0 Program Release 1',
    revision: REVISION,
    domains: ['release', 'sdk-docs', 'marketplace'],
    components: [
      { surface: 'packages/adapter-sdk', kind: 'package', description: 'The capability adapter SDK contracts (W007).' },
      { surface: 'packages/capability-registry', kind: 'package', description: 'The capability registry kernel (W007).' },
      { surface: 'packages/extension-sdk', kind: 'package', description: 'The extension authoring SDK (W008).' },
      { surface: 'packages/marketplace', kind: 'package', description: 'The marketplace domain kernel (W023).' },
      { surface: 'services/marketplace', kind: 'service', description: 'The marketplace host service (W023).' },
      { surface: 'packs/construction', kind: 'pack', description: 'The construction domain pack (W026).' },
    ],
    battery: REFERENCE_BATTERY,
    benchmarks: [
      {
        budgetId: 'budget:solution-admission',
        subject: 'solution-admission',
        inputUnit: 'planLines',
        inputSize: 64,
        overall: 'within-budget',
        budgetDigest: DIGEST_A,
        verdictDigest: DIGEST_B,
      },
      {
        budgetId: 'budget:program-fold',
        subject: 'program-fold',
        inputUnit: 'planLines',
        inputSize: 64,
        overall: 'within-budget',
        budgetDigest: DIGEST_C,
        verdictDigest: DIGEST_D,
      },
    ],
    sdkSurfaces: [
      { surfaceId: 'adapter-sdk', docPath: 'docs/sdk/adapter-sdk-guide.md' },
      { surfaceId: 'capability-registry', docPath: 'docs/sdk/capability-registry-guide.md' },
      { surfaceId: 'extension-sdk', docPath: 'docs/sdk/extension-sdk-guide.md' },
      { surfaceId: 'marketplace', docPath: 'docs/sdk/marketplace-listing-guide.md' },
    ],
    marketplace: { listingId: 'listing:stress-suite', entitlementId: 'entitlement:grant-001' },
    provenance: { actor: ACTOR_REF, method: 'declare-release-scope', instant: T[0], derivedFrom: [] },
    ...overrides,
  };
}

/** Seal the reference scope; throws on invalid (fixture invariant). */
export function sealedReferenceScope(overrides: Record<string, unknown> = {}): SealedReleaseScope {
  const sealed = sealScope(referenceScope(overrides));
  if (!sealed.ok) {
    throw new Error(`fixture scope must seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

/** The reference release notes as loose JSON. */
export function referenceNotes(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    recordVersion: 1,
    notesId: 'notes:e1-program-1',
    releaseId: 'release:e1-program-1',
    title: 'E1.0/X1.0 Program Release 1 — Release Notes',
    highlights: ['Deterministic typed release readiness.'],
    sections: [
      {
        heading: 'Release model',
        body: 'Release readiness is typed data: scope, checklist, evidence, manifest, replayable events.',
        citations: [
          { kind: 'surface', ref: 'release/src/index.ts' },
          { kind: 'work-order', ref: 'W035' },
          { kind: 'pull-request', ref: 'PR #88' },
          { kind: 'budget', ref: 'budget:solution-admission' },
          { kind: 'test', ref: 'release/test/readiness.positive.test.ts' },
          { kind: 'document', ref: 'docs/release/release-process.md' },
        ],
      },
    ],
    provenance: { actor: ACTOR_REF, method: 'author-release-notes', instant: T[0], derivedFrom: [] },
    ...overrides,
  };
}

/**
 * The typed completion evidence of a checklist item, per check kind and
 * subject (the reference POSITIVE evidence — negative variants are built
 * inline by the negative tests).
 */
export function referenceEvidence(checkKind: string, subject: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  switch (checkKind) {
    case 'battery-command-green':
      return { kind: checkKind, command: subject, expectExitCode: 0, exitCode: 0, ...extra };
    case 'benchmark-budget-within': {
      const digests: Record<string, [string, string]> = {
        'budget:solution-admission': [DIGEST_A, DIGEST_B],
        'budget:program-fold': [DIGEST_C, DIGEST_D],
      };
      const [budgetDigest, verdictDigest] = digests[subject] ?? [DIGEST_A, DIGEST_B];
      return { kind: checkKind, budgetId: subject, overall: 'within-budget', budgetDigest, verdictDigest, ...extra };
    }
    case 'notes-published':
      return { kind: checkKind, notesId: 'notes:e1-program-1', notesDigest: DIGEST_E, ...extra };
    case 'sdk-contract-synced':
      return { kind: checkKind, surfaceId: subject, documentedVersion: '1.0.0', actualVersion: '1.0.0', ...extra };
    case 'sdk-examples-green':
      return {
        kind: checkKind,
        command: 'pnpm --filter @epoch/test-harness exec vitest run --root ../../release',
        expectExitCode: 0,
        exitCode: 0,
        examplesRun: 5,
        ...extra,
      };
    case 'listing-chain-verified':
      return { kind: checkKind, listingId: 'listing:stress-suite', versions: 2, headDigest: DIGEST_F, chainVerified: true, ...extra };
    case 'entitlement-flip-verified':
      return {
        kind: checkKind,
        listingId: 'listing:stress-suite',
        entitlementId: 'entitlement:grant-001',
        grants: 1,
        revocations: 1,
        grantedThenDenied: true,
        ...extra,
      };
    case 'usage-fold-verified':
      return { kind: checkKind, entitlementId: 'entitlement:grant-001', events: 2, totalUnits: '6.75', foldsAgree: true, ...extra };
    case 'revenue-provenance-complete':
      return { kind: checkKind, listingId: 'listing:stress-suite', records: 1, complete: true, lastDigest: DIGEST_E, ...extra };
    default:
      throw new Error(`no reference evidence for check kind "${checkKind}"`);
  }
}

/** Complete every item of a derived checklist with reference evidence. */
export function completeAllItems(checklist: SealedReleaseChecklist): SealedReleaseChecklist {
  let current = checklist;
  let index = 1;
  for (const item of checklist.items) {
    const evidence = referenceEvidence(item.checkKind, item.subject);
    const completed = completeChecklistItem(
      current,
      item.itemId,
      evidence,
      T[Math.min(index, T.length - 1)]!,
      ACTOR_REF,
    );
    if (!completed.ok) {
      throw new Error(`fixture completion of "${item.itemId}" must succeed: ${JSON.stringify(completed.error)}`);
    }
    current = completed.value;
    index += 1;
  }
  return current;
}
