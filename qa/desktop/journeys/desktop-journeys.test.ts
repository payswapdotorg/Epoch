// W048 acceptance: the desktop journey suite — J01-J09, J11, J12 executed
// against the REAL product logic (the DesktopProduct composition root)
// over the embedded fixture-backed Application Gateway (the W046
// single-process composition) with the REAL deterministic fixtures,
// for BOTH fixture domains. CI-green = every journey passes its
// step-level assertions; with EPOCH_EMIT_JOURNEY_RECORDS=1 the run also
// emits the committed evidence records (qa/desktop/journeys/records/).
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitJourneyRecords, runJourneySet, type JourneyRecord } from '../../../qa/desktop/journeys/runner';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');

/** The current git head SHA (recorded in every journey record). */
function gitHead(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const SOURCE_COMMIT = gitHead();
const DOMAINS = ['construction', 'software'] as const;

const ALL_RECORDS: JourneyRecord[] = [];

describe.each(DOMAINS)('the desktop journey set over the %s fixtures (W048)', (domain) => {
  it('executes J01-J09, J11, J12 with every step passing', async () => {
    const records = await runJourneySet({
      domain,
      platform: 'linux',
      environment:
        'Node/vitest headless product-logic run: embedded fixture-backed Application Gateway (W046 single-process composition) + memory host (durable store semantics) + frozen journey clock; native Tauri shell covered by config validation (no cargo/webkit2gtk in this environment)',
      evidencePointer: 'qa/desktop/journeys/records/journey-records.json',
      sourceCommit: SOURCE_COMMIT,
    });
    ALL_RECORDS.push(...records);

    // The complete required desktop journey set is present.
    const journeyIds = records.map((record) => record.journeyId);
    expect(journeyIds.sort()).toEqual(
      ['J01', 'J02', 'J03', 'J04', 'J05', 'J06', 'J07', 'J08', 'J09', 'J11', 'J12'].sort(),
    );

    // Every journey passed overall.
    for (const record of records) {
      expect(`${record.journeyId}: ${record.overall} — ${record.disposition}`).toBe(
        `${record.journeyId}: pass — ${record.disposition}`,
      );
      // And every step within it.
      const failedSteps = record.steps.filter((step) => step.result !== 'pass');
      expect(failedSteps.map((step) => `${step.stepId}: ${step.observed}`)).toEqual([]);
    }

    // The journey-record field contract (spec/journey-validation.md).
    for (const record of records) {
      expect(record.platform).toBe('linux');
      expect(record.persona).toMatch(/delivery lead/);
      expect(record.productVersion).toBe('1.0.0');
      expect(record.fixtureId).toBe(`epoch-fixture-${domain}-v1.0.0`);
      expect(record.actions.length).toBeGreaterThan(0);
      expect(record.expectedOutcome.length).toBeGreaterThan(0);
      expect(record.evidence.length).toBeGreaterThan(0);
      expect(record.regressionTest).toContain('desktop-journeys.test.ts');
    }
  });
});

describe('the journey record emission (W048 evidence)', () => {
  it('emits the committed records when EPOCH_EMIT_JOURNEY_RECORDS is set', () => {
    if (process.env['EPOCH_EMIT_JOURNEY_RECORDS'] === undefined) {
      return; // CI mode: assertions only, no file writes.
    }
    expect(ALL_RECORDS.length).toBe(22); // 11 journeys x 2 domains
    emitJourneyRecords(ALL_RECORDS);
  });
});
