/**
 * examples/sdk — release readiness end-to-end over the REAL @epoch/release-kit
 * (W035), composing the REAL upstream surfaces (W007/W008/W023/W034)
 * (W035).
 *
 * The example the release engineer follows to carry a release candidate
 * to READY: declare the SCOPE (components, the verification battery, the
 * benchmark citations, the SDK surface pins, the marketplace readiness
 * subject — all typed data), derive the CHECKLIST deterministically,
 * attach typed EVIDENCE to every item (the SDK contract pins read from
 * the REAL packages; the marketplace facts from the REAL W023 kernel),
 * evaluate READY, seal the MANIFEST, and journal the whole progression
 * as `release:readiness` events whose deterministic fold REPLAYS the
 * readiness state.
 */
import {
  ADAPTER_SDK_CONTRACT_VERSION,
} from '@epoch/adapter-sdk';
import {
  CAPABILITY_REGISTRY_CONTRACT_VERSION,
} from '@epoch/capability-registry';
import {
  EXTENSION_SDK_CONTRACT_VERSION,
} from '@epoch/extension-sdk';
import { MARKETPLACE_CONTRACT_VERSION } from '@epoch/marketplace';
import {
  PERFORMANCE_CONTRACT_VERSION,
  sealBudget,
  sealBudgetVerdict,
  type BudgetContent,
  type BudgetVerdictContent,
} from '@epoch/performance';
import {
  checklistIdOf,
  completeChecklistItem,
  deriveReleaseChecklist,
  evaluateReleaseReadiness,
  evidenceDigestOf,
  foldReleaseEvents,
  manifestIdOf,
  notesIdOf,
  releaseEventStreamIdOf,
  sealReleaseEvent,
  sealReleaseManifest,
  sealReleaseNotes,
  sealScope,
  type CompletionEvidence,
  type ReleaseEventRecord,
  type ReleaseProvenance,
  type SealedReleaseChecklist,
  type SdkSurfaceId,
} from '@epoch/release-kit';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { BUYER_TENANT, EVENT_PRINCIPAL, RELEASE_ACTOR_REF, T, VENDOR_TENANT } from './shared';
import {
  EXAMPLE_ENTITLEMENT_ID,
  EXAMPLE_LISTING_ID,
  runMarketplaceListingExample,
} from './marketplace-listing-example';

/** The release identity of the example. */
export const EXAMPLE_RELEASE_ID = 'release:e1-program-1';

/** The fixed source revision of the example release (data, never read). */
export const EXAMPLE_REVISION = '39ce5b6c1258d9f755dc8a37ddb1c37304bb02fa';

/** The verification battery of record (mirrors the W033 reference battery). */
export const EXAMPLE_BATTERY = [
  { command: 'pnpm install', expectExitCode: 0, timeoutMs: 600_000 },
  { command: 'pnpm check', expectExitCode: 0, timeoutMs: 600_000 },
  { command: 'pnpm exec turbo run typecheck lint test build --concurrency=1 --force', expectExitCode: 0, timeoutMs: 3_600_000 },
] as const;

/** One real budget + verdict pair over the W034 public sealing APIs. */
function referenceBenchmarkPair(): { budgetDigest: string; verdictDigest: string } {
  const budget: BudgetContent = {
    schema: 'epoch.performance.budget',
    schemaVersion: PERFORMANCE_CONTRACT_VERSION,
    tenantId: BUYER_TENANT,
    budgetId: 'budget:release-example-composition',
    name: 'Release example composition budget',
    description: 'The deterministic example budget the release-readiness example cites.',
    subject: 'release-example',
    inputUnit: 'scenarioSteps',
    envelopes: {
      'kernel-fold': { intercept: 8, slopeNumerator: 2, slopeDenominator: 1 },
    },
    policy: { nearThresholdNumerator: 9, nearThresholdDenominator: 10 },
    provenance: { kind: 'derived', sourceRef: 'examples/sdk/release-readiness-example', actor: 'principal:release-bot' },
  };
  const sealedBudget = sealBudget(budget);
  if (!sealedBudget.ok) {
    throw new Error(`budget must seal: ${sealedBudget.error.message}`);
  }
  const verdict: BudgetVerdictContent = {
    schema: 'epoch.performance.budget-verdict',
    schemaVersion: PERFORMANCE_CONTRACT_VERSION,
    tenantId: BUYER_TENANT,
    verdictId: 'verdict:release-example-composition--release-example-run',
    budgetId: 'budget:release-example-composition',
    budgetDigest: sealedBudget.value.contentDigest,
    workloadId: 'workload:release-example-run',
    workloadDigest: 'a'.repeat(64),
    countsId: 'counts:release-example-run',
    countsDigest: 'b'.repeat(64),
    subject: 'release-example',
    inputUnit: 'scenarioSteps',
    inputSize: 16,
    perClass: [
      {
        operationClass: 'kernel-fold',
        measured: 32,
        allowed: 40,
        nearFloor: 36,
        verdict: 'within-budget',
        exceededBy: null,
      },
    ],
    overall: 'within-budget',
    provenance: { kind: 'derived', sourceRef: 'examples/sdk/release-readiness-example', actor: 'principal:release-bot' },
  };
  const sealedVerdict = sealBudgetVerdict(verdict);
  if (!sealedVerdict.ok) {
    throw new Error(`verdict must seal: ${sealedVerdict.error.message}`);
  }
  return { budgetDigest: sealedBudget.value.contentDigest, verdictDigest: sealedVerdict.value.contentDigest };
}

/** The example release scope (loose JSON — the admission path validates). */
export function exampleReleaseScope(): Record<string, unknown> {
  const benchmark = referenceBenchmarkPair();
  return {
    recordVersion: 1,
    releaseId: EXAMPLE_RELEASE_ID,
    label: 'E1.0/X1.0 Program Release 1',
    revision: EXAMPLE_REVISION,
    domains: ['release', 'sdk-docs', 'marketplace'],
    components: [
      { surface: 'packages/adapter-sdk', kind: 'package', description: 'The capability adapter SDK contracts (W007).' },
      { surface: 'packages/capability-registry', kind: 'package', description: 'The capability registry kernel (W007).' },
      { surface: 'packages/extension-sdk', kind: 'package', description: 'The extension authoring SDK (W008).' },
      { surface: 'packages/marketplace', kind: 'package', description: 'The marketplace domain kernel (W023).' },
      { surface: 'services/marketplace', kind: 'service', description: 'The marketplace host service (W023).' },
      { surface: 'adapters/aurum-chat', kind: 'adapter', description: 'The external-event bridge reference adapter (W042).' },
      { surface: 'packs/construction', kind: 'pack', description: 'The construction domain pack (W026).' },
      { surface: 'packs/software', kind: 'pack', description: 'The software/infrastructure domain pack (W027).' },
    ],
    battery: EXAMPLE_BATTERY,
    benchmarks: [
      {
        budgetId: 'budget:release-example-composition',
        subject: 'release-example',
        inputUnit: 'scenarioSteps',
        inputSize: 16,
        overall: 'within-budget',
        budgetDigest: benchmark.budgetDigest,
        verdictDigest: benchmark.verdictDigest,
      },
    ],
    sdkSurfaces: [
      { surfaceId: 'adapter-sdk', docPath: 'docs/sdk/adapter-sdk-guide.md' },
      { surfaceId: 'capability-registry', docPath: 'docs/sdk/capability-registry-guide.md' },
      { surfaceId: 'extension-sdk', docPath: 'docs/sdk/extension-sdk-guide.md' },
      { surfaceId: 'marketplace', docPath: 'docs/sdk/marketplace-listing-guide.md' },
    ],
    marketplace: { listingId: EXAMPLE_LISTING_ID, entitlementId: EXAMPLE_ENTITLEMENT_ID },
    provenance: {
      actor: RELEASE_ACTOR_REF,
      method: 'declare-release-scope',
      instant: T[0],
      derivedFrom: [],
    },
  };
}

/** The example release notes record (loose JSON — the admission path validates). */
export function exampleReleaseNotes(): Record<string, unknown> {
  return {
    recordVersion: 1,
    notesId: notesIdOf(EXAMPLE_RELEASE_ID),
    releaseId: EXAMPLE_RELEASE_ID,
    title: 'E1.0/X1.0 Program Release 1 — Release Notes',
    highlights: [
      'Deterministic typed release readiness: scope, checklist, evidence, manifest, replayable events.',
      'The verification battery and benchmark citations are content-addressed data.',
    ],
    sections: [
      {
        heading: 'Release model',
        body: 'Release readiness is typed data: a scope record derives a checklist deterministically; every item completes with typed evidence; the manifest seals only when ready.',
        citations: [
          { kind: 'surface', ref: 'release/src/index.ts' },
          { kind: 'test', ref: 'release/test/readiness.positive.test.ts' },
        ],
      },
      {
        heading: 'Performance',
        body: 'The release cites the W034 budget discipline: deterministic, wall-clock-free operation-count budgets.',
        citations: [
          { kind: 'budget', ref: 'budget:release-example-composition' },
          { kind: 'document', ref: 'docs/performance/budget-catalog.md' },
        ],
      },
    ],
    provenance: {
      actor: RELEASE_ACTOR_REF,
      method: 'author-release-notes',
      instant: T[0],
      derivedFrom: [],
    },
  };
}

/** The typed outcome of the release-readiness example. */
export interface ReleaseReadinessExample {
  readonly releaseId: string;
  readonly checklistId: string;
  readonly totalItems: number;
  readonly verdict: string;
  readonly manifestId: string;
  readonly manifestDigest: string;
  readonly notesDigest: string;
  readonly eventCount: number;
  readonly replayVerdict: string;
  readonly replayPublishedDigest: string;
}

/** Run the example (pure — same result every run). */
export function runReleaseReadinessExample(): ReleaseReadinessExample {
  // 1. Declare + seal the scope; derive the checklist deterministically.
  const scope = sealScope(exampleReleaseScope());
  if (!scope.ok) {
    throw new Error(`scope must seal: ${scope.error.message}`);
  }
  const derived = deriveReleaseChecklist(scope.value);
  if (!derived.ok) {
    throw new Error(`checklist must derive: ${derived.error.message}`);
  }
  let checklist: SealedReleaseChecklist = derived.value;

  // 2. The typed evidence of every item.
  const notes = sealReleaseNotes(exampleReleaseNotes());
  if (!notes.ok) {
    throw new Error(`notes must seal: ${notes.error.message}`);
  }
  const marketplace = runMarketplaceListingExample();
  const sdkVersions: Record<string, string> = {
    'adapter-sdk': ADAPTER_SDK_CONTRACT_VERSION,
    'capability-registry': CAPABILITY_REGISTRY_CONTRACT_VERSION,
    'extension-sdk': EXTENSION_SDK_CONTRACT_VERSION,
    marketplace: MARKETPLACE_CONTRACT_VERSION,
  };
  const evidenceFor = (checkKind: string, subject: string): CompletionEvidence => {
    switch (checkKind) {
      case 'battery-command-green':
        return { kind: 'battery-command-green', command: subject, expectExitCode: 0, exitCode: 0 };
      case 'benchmark-budget-within': {
        const citation = (scope.value.benchmarks as { budgetId: string; budgetDigest: string; verdictDigest: string }[]).find(
          (entry) => entry.budgetId === subject,
        );
        if (citation === undefined) {
          throw new Error(`no benchmark citation for "${subject}"`);
        }
        return {
          kind: 'benchmark-budget-within',
          budgetId: citation.budgetId,
          overall: 'within-budget',
          budgetDigest: citation.budgetDigest,
          verdictDigest: citation.verdictDigest,
        };
      }
      case 'notes-published':
        return { kind: 'notes-published', notesId: notes.value.notesId, notesDigest: notes.value.digest };
      case 'sdk-contract-synced': {
        const actual = sdkVersions[subject];
        if (actual === undefined) {
          throw new Error(`no SDK version pin for "${subject}"`);
        }
        return {
          kind: 'sdk-contract-synced',
          surfaceId: subject as SdkSurfaceId,
          documentedVersion: actual,
          actualVersion: actual,
        };
      }
      case 'sdk-examples-green':
        return {
          kind: 'sdk-examples-green',
          command: 'pnpm --filter @epoch/test-harness exec vitest run --root ../../release',
          expectExitCode: 0,
          exitCode: 0,
          examplesRun: 5,
        };
      case 'listing-chain-verified':
        return {
          kind: 'listing-chain-verified',
          listingId: marketplace.listingId,
          versions: marketplace.versionCount,
          headDigest: marketplace.headDigest,
          chainVerified: true,
        };
      case 'entitlement-flip-verified':
        return {
          kind: 'entitlement-flip-verified',
          listingId: marketplace.listingId,
          entitlementId: marketplace.entitlementId,
          grants: 1,
          revocations: 1,
          grantedThenDenied: true,
        };
      case 'usage-fold-verified':
        return {
          kind: 'usage-fold-verified',
          entitlementId: marketplace.entitlementId,
          events: marketplace.usageEventCount,
          totalUnits: marketplace.usageTotalUnits,
          foldsAgree: true,
        };
      case 'revenue-provenance-complete':
        return {
          kind: 'revenue-provenance-complete',
          listingId: marketplace.listingId,
          records: marketplace.revenueRecords,
          complete: true,
          lastDigest: marketplace.revenueLastDigest,
        };
      default:
        throw new Error(`unknown check kind "${checkKind}"`);
    }
  };

  // 3. Complete every item (immutable transitions, caller-supplied instants).
  let instantIndex = 1;
  for (const item of checklist.items) {
    const evidence = evidenceFor(item.checkKind, item.subject);
    const completed = completeChecklistItem(
      checklist,
      item.itemId,
      evidence,
      T[Math.min(instantIndex, T.length - 1)]!,
      RELEASE_ACTOR_REF,
    );
    if (!completed.ok) {
      throw new Error(`item "${item.itemId}" must complete: ${completed.error.message}`);
    }
    checklist = completed.value;
    instantIndex += 1;
  }

  // 4. Evaluate readiness (pure re-derivation).
  const evaluation = evaluateReleaseReadiness(checklist);
  if (!evaluation.ok) {
    throw new Error(`evaluation failed: ${evaluation.error.message}`);
  }
  if (evaluation.value.verdict !== 'ready') {
    throw new Error(`the example release must be ready (open: ${evaluation.value.openItems.map((i) => i.itemId).join(', ')})`);
  }

  // 5. Seal the manifest (only sealable when ready).
  const manifest = sealReleaseManifest({
    scope: scope.value,
    checklist,
    notes: notes.value,
    provenance: {
      actor: RELEASE_ACTOR_REF,
      method: 'seal-release-manifest',
      instant: T[9]!,
      derivedFrom: [scope.value.digest],
    } satisfies ReleaseProvenance,
  });
  if (!manifest.ok) {
    throw new Error(`manifest must seal: ${manifest.error.message}`);
  }

  // 6. Journal the readiness progression as W010-shaped events + fold.
  const streamId = releaseEventStreamIdOf(EXAMPLE_RELEASE_ID);
  const events: ReleaseEventRecord[] = [];
  const push = (data: unknown, occurredAt: string): void => {
    const sealed = sealReleaseEvent({
      schemaVersion: 1,
      streamId,
      sequence: events.length + 1,
      tenantId: VENDOR_TENANT,
      actor: EVENT_PRINCIPAL,
      causalParent: events.length > 0 ? { streamId, sequence: events.length } : null,
      payload: { discriminator: 'release:readiness', data },
      occurredAt,
    });
    if (!sealed.ok) {
      throw new Error(`event must seal: ${sealed.error.message}`);
    }
    events.push(sealed.value);
  };
  push(
    {
      kind: 'checklist-derived',
      releaseId: EXAMPLE_RELEASE_ID,
      checklistId: checklistIdOf(EXAMPLE_RELEASE_ID),
      checklistDigest: derived.value.digest,
      itemCount: derived.value.items.length,
    },
    T[0],
  );
  for (const item of checklist.items) {
    push(
      {
        kind: 'item-completed',
        releaseId: EXAMPLE_RELEASE_ID,
        checklistId: checklist.checklistId,
        itemId: item.itemId,
        checkKind: item.checkKind,
        evidenceDigest: evidenceDigestOf(item.evidence as CompletionEvidence),
        completedAt: item.completedAt as string,
        completedBy: item.completedBy as string,
      },
      item.completedAt as string,
    );
  }
  push(
    {
      kind: 'readiness-evaluated',
      releaseId: EXAMPLE_RELEASE_ID,
      checklistId: checklist.checklistId,
      verdict: evaluation.value.verdict,
      completeItems: evaluation.value.completeItems,
      totalItems: evaluation.value.totalItems,
      evaluationDigest: evaluation.value.digest,
    },
    T[9],
  );
  push(
    {
      kind: 'release-published',
      releaseId: EXAMPLE_RELEASE_ID,
      manifestId: manifestIdOf(manifest.value.digest),
      manifestDigest: manifest.value.digest,
      revision: EXAMPLE_REVISION,
      label: manifest.value.label,
    },
    T[9],
  );
  const folded = foldReleaseEvents(events);
  if (!folded.ok) {
    throw new Error(`fold must succeed: ${folded.error.message}`);
  }
  if (folded.value.published?.manifestDigest !== manifest.value.digest) {
    throw new Error('the replayed publication must match the sealed manifest digest');
  }

  return {
    releaseId: EXAMPLE_RELEASE_ID,
    checklistId: checklist.checklistId,
    totalItems: checklist.items.length,
    verdict: evaluation.value.verdict,
    manifestId: manifestIdOf(manifest.value.digest),
    manifestDigest: manifest.value.digest,
    notesDigest: notes.value.digest,
    eventCount: events.length,
    replayVerdict: folded.value.evaluation?.verdict ?? 'unknown',
    replayPublishedDigest: folded.value.published?.manifestDigest ?? 'unknown',
  };
}

/** The canonical digest projection (the determinism gate). */
export function releaseReadinessDigestProjection(): string {
  const outcome = runReleaseReadinessExample();
  return canonicalDigest(outcome as unknown as JsonValue);
}
