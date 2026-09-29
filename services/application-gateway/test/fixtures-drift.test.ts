// Deterministic fixtures: the committed qa/fixtures + spec/journeys/fixtures
// artifacts are byte-identical to the generator's emission; digests are
// rerun-stable (W046 acceptance 9). Update mode:
// EPOCH_UPDATE_FIXTURES=1 pnpm --filter @epoch/application-gateway test fixtures-drift
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderProductFixtureFiles, scenarioScriptOf } from '../src/fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');
const UPDATE_MODE = process.env.EPOCH_UPDATE_FIXTURES === '1';

describe('the deterministic product fixtures (W046 acceptance 9)', () => {
  const rendered = renderProductFixtureFiles();

  it('renders both domains with the complete record families + all three scenario scripts + the registry + the journey contract', () => {
    const paths = Object.keys(rendered).sort();
    for (const domain of ['construction', 'software']) {
      for (const file of ['tenancy.json', 'identity.json', 'world.json', 'solution.json', 'program-of-work.json', 'delivery.json', 'evidence.json', 'scenario-j07.json', 'scenario-j08.json', 'scenario-j11.json']) {
        expect(paths, `missing qa/fixtures/${domain}/${file}`).toContain(`qa/fixtures/${domain}/${file}`);
      }
    }
    expect(paths).toContain('qa/fixtures/registry.json');
    expect(paths).toContain('spec/journeys/fixtures/journey-fixtures.json');
    expect(paths.length).toBe(22);
  });

  it.each(Object.keys(rendered).sort())('committed fixture %s matches the emission byte-for-byte', (rel) => {
    const target = path.join(REPO_ROOT, rel);
    if (UPDATE_MODE) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, rendered[rel]!);
      return;
    }
    expect(existsSync(target), `missing committed fixture: ${rel}`).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe(rendered[rel]!);
  });

  it('emission is deterministic (two renders in one process are byte-identical)', () => {
    expect(renderProductFixtureFiles()).toEqual(rendered);
  });

  it('rerun-stable digests: the registry digests match the rendered files exactly', () => {
    const registry = JSON.parse(rendered['qa/fixtures/registry.json']!) as {
      readonly domains: readonly {
        readonly domain: string;
        readonly files: readonly { readonly file: string; readonly sha256: string }[];
      }[];
    };
    for (const domain of registry.domains) {
      for (const file of domain.files) {
        const content = rendered[`qa/fixtures/${domain.domain}/${file.file}`];
        expect(content, `registry references missing file ${file.file}`).toBeDefined();
      }
    }
  });

  it('the fixture records carry kernel-verified content digests (real seals, not fabricated)', () => {
    const registry = JSON.parse(rendered['qa/fixtures/registry.json']!) as {
      readonly domains: readonly {
        readonly domain: string;
        readonly worldDigest: string;
        readonly solutionContentDigest: string;
        readonly programContentDigest: string;
        readonly deliveryContentDigest: string;
      }[];
    };
    for (const domain of registry.domains) {
      expect(domain.worldDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(domain.solutionContentDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(domain.programContentDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(domain.deliveryContentDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('the journey-fixture contract references J07/J08/J11 scripts for BOTH domains with expected outcome digests', () => {
    const contract = JSON.parse(rendered['spec/journeys/fixtures/journey-fixtures.json']!) as {
      readonly journeys: readonly {
        readonly journeyId: string;
        readonly domain: string;
        readonly fixtureId: string;
        readonly scenarioScript: string;
        readonly expectedOutcomeDigests: Record<string, string>;
      }[];
    };
    expect(contract.journeys).toHaveLength(6);
    for (const journey of contract.journeys) {
      expect(['J07', 'J08', 'J11']).toContain(journey.journeyId);
      expect(['construction', 'software']).toContain(journey.domain);
      expect(rendered[journey.scenarioScript], `script ${journey.scenarioScript} must exist`).toBeDefined();
      expect(Object.keys(journey.expectedOutcomeDigests).length).toBeGreaterThan(0);
    }
  });

  it('the scenario scripts expose typed programmatic access (J07 steps reference idempotency keys)', () => {
    for (const domain of ['construction', 'software'] as const) {
      const j07 = scenarioScriptOf('J07', domain);
      expect(j07?.journeyId).toBe('J07');
      expect(j07?.steps).toHaveLength(4);
      expect(JSON.stringify(j07)).toContain('idem:');
      const j08 = scenarioScriptOf('J08', domain);
      expect(j08?.steps).toHaveLength(4);
      const j11 = scenarioScriptOf('J11', domain);
      expect(j11?.steps).toHaveLength(5);
    }
  });

  it('the frozen clock discipline: every instant in the fixtures is from the frozen series', () => {
    const all = Object.values(rendered).join('');
    const dates = all.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g) ?? [];
    expect(dates.length).toBeGreaterThan(10);
    for (const instant of dates) {
      expect(instant.startsWith('2026-03-02T'), `wall-clock leak: ${instant}`).toBe(true);
    }
  });
});
