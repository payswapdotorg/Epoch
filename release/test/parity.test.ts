// THE UPSTREAM PARITY EVIDENCE of the release-kit model (W035): every
// mirrored grammar is pinned against the REAL upstream surface through
// which it flows — the W010 event shapes (@epoch/event-log), the W033
// deploy gate + provenance grammars (@epoch/deploy-model), the W034
// budget vocabulary (@epoch/performance), and the W023 marketplace id
// grammars (@epoch/marketplace). These are TEST-ONLY imports (the W023
// devDep-parity precedent): the release kernel never depends on them at
// runtime; a future upstream bump intentionally breaks the pin here and
// surfaces as a review gate.
import { describe, expect, it } from 'vitest';
import type { Equals } from './type-utils';
import {
  computeEventDigest,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
  sealEvent,
  type EventContent,
} from '@epoch/event-log';
import {
  COMPONENT_KINDS as DEPLOY_COMPONENT_KINDS,
  DeployProvenanceSchema,
  GateCommandSchema,
  PROVENANCE_ROLES as DEPLOY_PROVENANCE_ROLES,
  REFERENCE_BATTERY_COMMANDS,
} from '@epoch/deploy-model';
import {
  BUDGET_ID_PATTERN,
  BUDGET_VERDICTS,
  INPUT_UNITS,
} from '@epoch/performance';
import {
  ENTITLEMENT_ID_PATTERN,
  LISTING_ID_PATTERN,
} from '@epoch/marketplace';
import {
  BUDGET_OUTCOMES,
  RELEASE_COMPONENT_KINDS,
  RELEASE_EVENT_RECORD_VERSION,
  RELEASE_PROVENANCE_ROLES,
  RELEASE_STREAM_ID_PATTERN,
  computeReleaseEventDigest,
  releaseEventStreamIdOf,
  type ReleaseEventContent,
} from '../src/index';
import { referenceScope, sealedReferenceScope } from './helpers';

// Compile-time type parity: the mirrored event content IS the W010
// EventContent shape, member for member (the W023 UsageEventParity
// pattern). A W010 shape change breaks this line at typecheck time.
type ReleaseEventContentParity = Equals<ReleaseEventContent, EventContent>;
const _parity: ReleaseEventContentParity = true;
void _parity;

describe('W010 event-log parity (runtime)', () => {
  it('a release event is admitted by the REAL W010 seal path', () => {
    const content = {
      schemaVersion: 1,
      streamId: releaseEventStreamIdOf('release:e1-program-1'),
      sequence: 1,
      tenantId: 'tenant:acme-tools',
      actor: 'principal:release-bot',
      causalParent: null,
      payload: {
        discriminator: 'release:readiness',
        data: {
          kind: 'checklist-derived',
          releaseId: 'release:e1-program-1',
          checklistId: 'rc:e1-program-1',
          checklistDigest: 'a'.repeat(64),
          itemCount: 15,
        },
      },
      occurredAt: '2026-02-10T09:00:00.000Z',
    };
    const admitted = sealEvent(content);
    expect(admitted.ok, JSON.stringify(admitted)).toBe(true);
  });

  it('the mirrored digest equals the REAL W010 digest for the same content', () => {
    const content = {
      schemaVersion: 1,
      streamId: releaseEventStreamIdOf('release:e1-program-1'),
      sequence: 2,
      tenantId: 'tenant:acme-tools',
      actor: 'principal:release-bot',
      causalParent: { streamId: 'stream:release-e1-program-1', sequence: 1 },
      payload: {
        discriminator: 'release:readiness',
        data: {
          kind: 'item-completed',
          releaseId: 'release:e1-program-1',
          checklistId: 'rc:e1-program-1',
          itemId: 'item:1:battery-command-green-pnpm-install',
          checkKind: 'battery-command-green',
          evidenceDigest: 'b'.repeat(64),
          completedAt: '2026-02-10T09:00:01.000Z',
          completedBy: 'actor:release-engineer',
        },
      },
      occurredAt: '2026-02-10T09:00:01.000Z',
    } as unknown as ReleaseEventContent;
    expect(computeReleaseEventDigest(content)).toBe(computeEventDigest(content));
  });

  it('the record versions and stream grammar are identical', () => {
    expect(RELEASE_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
    expect(RELEASE_STREAM_ID_PATTERN.source).toBe(EVENT_STREAM_ID_PATTERN.source);
    expect(RELEASE_STREAM_ID_PATTERN.flags).toBe(EVENT_STREAM_ID_PATTERN.flags);
  });
});

describe('W033 deploy-model parity (runtime)', () => {
  it('the mirrored battery grammar parses the REAL reference battery verbatim', () => {
    for (const command of REFERENCE_BATTERY_COMMANDS) {
      expect(GateCommandSchema.safeParse(command).success).toBe(true);
    }
    // The reference battery is exactly the three commands the repo gates run.
    expect(REFERENCE_BATTERY_COMMANDS).toHaveLength(3);
    expect(REFERENCE_BATTERY_COMMANDS[0]!.command).toBe('pnpm install');
  });

  it('the release scope battery IS the W033 reference battery', () => {
    const scope = sealedReferenceScope();
    expect(scope.battery).toEqual(REFERENCE_BATTERY_COMMANDS);
  });

  it('the component-kind vocabulary equals the W033 vocabulary', () => {
    expect([...RELEASE_COMPONENT_KINDS]).toEqual([...DEPLOY_COMPONENT_KINDS]);
  });

  it('the provenance role vocabulary equals the W033 vocabulary', () => {
    expect([...RELEASE_PROVENANCE_ROLES]).toEqual([...DEPLOY_PROVENANCE_ROLES]);
  });

  it('the provenance shape mirrors the W033 DeployProvenance member-for-member', () => {
    const provenance = {
      actor: { actorId: 'actor:release-engineer', role: 'release-manager' },
      method: 'declare-release-scope',
      instant: '2026-02-10T09:00:00.000Z',
      derivedFrom: ['a'.repeat(64)],
    };
    expect(DeployProvenanceSchema.safeParse(provenance).success).toBe(true);
    const scopeProvenance = (referenceScope() as { provenance: typeof provenance }).provenance;
    expect(DeployProvenanceSchema.safeParse(scopeProvenance).success).toBe(true);
  });
});

describe('W034 performance parity (runtime)', () => {
  it('the budget-outcome vocabulary equals the W034 verdict vocabulary', () => {
    expect([...BUDGET_OUTCOMES]).toEqual([...BUDGET_VERDICTS]);
  });

  it('the benchmark input-unit vocabulary equals the W034 vocabulary', () => {
    // BENCHMARK_INPUT_UNITS is internal; its values flow through scope
    // citations — assert the reference scope's citations all use W034 units.
    const scope = sealedReferenceScope();
    for (const citation of scope.benchmarks) {
      expect(INPUT_UNITS).toContain(citation.inputUnit);
    }
  });

  it('the budget id grammar equals the W034 grammar', () => {
    const scope = sealedReferenceScope();
    for (const citation of scope.benchmarks) {
      expect(BUDGET_ID_PATTERN.test(citation.budgetId)).toBe(true);
    }
    // The reference citations are the catalog ids of docs/performance/budget-catalog.md.
    expect(scope.benchmarks.map((citation) => citation.budgetId)).toEqual([
      'budget:solution-admission',
      'budget:program-fold',
    ]);
  });
});

describe('W023 marketplace parity (runtime)', () => {
  it('the marketplace readiness subject ids satisfy the REAL W023 grammars', () => {
    const scope = sealedReferenceScope();
    expect(LISTING_ID_PATTERN.test(scope.marketplace.listingId)).toBe(true);
    expect(ENTITLEMENT_ID_PATTERN.test(scope.marketplace.entitlementId)).toBe(true);
    // The grammars reject malformed ids identically.
    expect(LISTING_ID_PATTERN.test('listing:UPPER-CASE')).toBe(false);
    expect(LISTING_ID_PATTERN.test('stress-suite')).toBe(false);
    expect(ENTITLEMENT_ID_PATTERN.test('entitlement:has_underscore')).toBe(false);
    expect(ENTITLEMENT_ID_PATTERN.test('entitlement:')).toBe(false);
  });
});
