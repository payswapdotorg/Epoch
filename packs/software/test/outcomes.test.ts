// NAMED POSITIVE: outcome schemas — release outcomes / SLO attainment as
// projections over the universal W036 outcome kinds.
import { describe, expect, it } from 'vitest';
import {
  digestOutcomeViews,
  projectSoftwareOutcomes,
  SOFTWARE_OUTCOME_TYPES,
  SoftwareOutcomeViewSchema,
  UNIVERSAL_OUTCOME_KINDS,
} from '../src/index';
import { observationRecords, outcomeRecords } from './fixtures';

describe('NAMED POSITIVE: the software outcome types bind universal kinds', () => {
  it('every outcome type binds one of the universal W036 outcome kinds', () => {
    for (const type of SOFTWARE_OUTCOME_TYPES) {
      expect(UNIVERSAL_OUTCOME_KINDS).toContain(type.universalOutcomeKind);
      expect(type.schema).toBe('epoch.pack-software.outcome-type');
    }
  });

  it('release delivery/acceptance, SLO attainment/breach and handover are covered', () => {
    const bindings = new Map(SOFTWARE_OUTCOME_TYPES.map((type) => [type.outcomeTypeId, type.universalOutcomeKind]));
    expect(bindings.get('software.outcome.release-delivered')).toBe('delivered');
    expect(bindings.get('software.outcome.release-accepted')).toBe('accepted');
    expect(bindings.get('software.outcome.slo-attainment')).toBe('accepted');
    expect(bindings.get('software.outcome.slo-breach-residual')).toBe('residual');
    expect(bindings.get('software.outcome.service-handover')).toBe('handover');
  });
});

describe('NAMED POSITIVE: the outcome projection over universal outcome records', () => {
  it('the fixture outcome records project with the matched software vocabulary', () => {
    const views = projectSoftwareOutcomes(outcomeRecords(), SOFTWARE_OUTCOME_TYPES);
    expect(views).toHaveLength(4);
    const byId = new Map(views.map((view) => [view.recordId, view]));
    const staging = byId.get('outcome:staging-release');
    expect(staging?.universalOutcomeKind).toBe('delivered');
    expect(staging?.softwareOutcomeTypeIds).toEqual(['software.outcome.release-delivered']);
    const slo = byId.get('outcome:slo-attainment');
    // An ACCEPTED outcome binds BOTH the release-acceptance and the SLO
    // attainment types (all matches list, sorted by outcomeTypeId).
    expect(slo?.softwareOutcomeTypeIds).toEqual([
      'software.outcome.release-accepted',
      'software.outcome.slo-attainment',
    ]);
    const residual = byId.get('outcome:slo-breach-residual');
    expect(residual?.softwareOutcomeTypeIds).toEqual(['software.outcome.slo-breach-residual']);
    const handover = byId.get('outcome:service-handover');
    expect(handover?.softwareOutcomeTypeIds).toEqual(['software.outcome.service-handover']);
  });

  it('only outcome-kind distinction records project (other kinds are filtered)', () => {
    // Observation-kind distinction records reference the same subjects but
    // are NOT outcome records — the fold must filter them out.
    const observation = observationRecords()[0]!;
    expect(observation.kind).toBe('observation');
    const views = projectSoftwareOutcomes([observation], SOFTWARE_OUTCOME_TYPES);
    expect(views).toEqual([]);
  });

  it('a record with no bound type still projects with empty software terms (SN1.0)', () => {
    const views = projectSoftwareOutcomes(outcomeRecords(), []);
    expect(views).toHaveLength(4);
    for (const view of views) {
      expect(view.softwareOutcomeTypeIds).toEqual([]);
      expect(view.softwareTitles).toEqual([]);
    }
  });

  it('every view round-trips through its schema', () => {
    const views = projectSoftwareOutcomes(outcomeRecords(), SOFTWARE_OUTCOME_TYPES);
    for (const view of views) {
      const parsed = SoftwareOutcomeViewSchema.safeParse(JSON.parse(JSON.stringify(view)));
      expect(parsed.success, view.recordId).toBe(true);
    }
  });

  it('the outcome-view digest is stable (determinism evidence)', () => {
    const first = digestOutcomeViews(projectSoftwareOutcomes(outcomeRecords(), SOFTWARE_OUTCOME_TYPES));
    const second = digestOutcomeViews(projectSoftwareOutcomes(outcomeRecords(), SOFTWARE_OUTCOME_TYPES));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });
});
