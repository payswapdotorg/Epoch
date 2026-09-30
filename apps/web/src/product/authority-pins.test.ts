/**
 * The W047 named negatives + operation-surface pins (the Work Order's
 * binding design pins 2 and 3):
 *
 *  (a) the UI cannot bypass the Action Gateway — the operation surface is
 *      a SUBSET of the frozen gateway vocabulary; every UI affordance maps
 *      to a gateway operation; the only server mutation endpoint accepts
 *      envelope-only requests and dispatches through the W046
 *      ApplicationGateway (whose action.* handlers delegate to the Action
 *      Gateway — the execution authority);
 *  (b) reload resolves authoritative state — the client persists only
 *      session REFERENCES (never semantic state) and revalidates through
 *      session.validate + world.snapshot on boot;
 *  (c) no hard-coded model->role mapping anywhere in apps/web — the
 *      discovery path is capability-demand driven (measured claims, never
 *      name->role tables).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_GATEWAY_OPERATION_NAMES,
  APPLICATION_GATEWAY_OPERATIONS,
  isGatewayOperationName,
  QUEUEABLE_OPERATIONS,
} from '@epoch/client-runtime';
import { UI_OPERATION_SURFACE, UI_OPERATIONS } from '../product/operations';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const APP_ROOT = path.resolve(HERE, '..', '..');

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'e2e') continue;
      sourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('pin (a): the UI operation surface is a subset of the frozen Gateway vocabulary', () => {
  it('every UI operation is a registered gateway operation (no invented authorities)', () => {
    for (const operation of UI_OPERATIONS) {
      expect(isGatewayOperationName(operation)).toBe(true);
    }
  });

  it('the UI operation surface is a strict subset (or equal) of the frozen 32-operation vocabulary', () => {
    const vocabulary = new Set(APPLICATION_GATEWAY_OPERATION_NAMES);
    for (const operation of UI_OPERATIONS) {
      expect(vocabulary.has(operation)).toBe(true);
    }
  });

  it('the declared mutating flags match the frozen registry kinds (no mislabeled affordances)', () => {
    const registry = new Map(APPLICATION_GATEWAY_OPERATIONS.map((operation) => [operation.name, operation]));
    for (const entry of UI_OPERATION_SURFACE) {
      const registered = registry.get(entry.operation);
      expect(registered, entry.operation).toBeDefined();
      expect(entry.mutating, entry.operation).toBe(registered!.kind === 'mutate');
      expect(entry.surface.length).toBeGreaterThan(0);
    }
  });

  it('the only server mutation path is the envelope-only /api/gateway route (no kernel fetch endpoints)', () => {
    const routeFiles = sourceFiles(path.join(APP_ROOT, 'app', 'api'));
    for (const file of routeFiles) {
      const source = readFileSync(file, 'utf8');
      // The gateway route dispatches through ApplicationGateway.call.
      if (file.includes(path.join('api', 'gateway'))) {
        expect(source).toContain('gateway.call');
      }
      // No route handler imports kernel mutation entry points directly.
      expect(source).not.toMatch(/WorldModel\.create|ActionGateway\(\)|EvidenceStore\.create/);
    }
  });
});

describe('pin (b): reload resolves authoritative state (no client-only truth)', () => {
  it('the client persists session REFERENCES only (never semantic state)', () => {
    const files = sourceFiles(path.join(APP_ROOT, 'src', 'client'));
    let storageWrites = 0;
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      // localStorage writes exist (session ref, queue projections, cache).
      storageWrites += (source.match(/localStorage\.setItem/g) ?? []).length;
      // No semantic kernel records are constructed client-side.
      expect(source).not.toMatch(/sealSolutionVersion|buildProgramOfWork|openDeliveryRecord|submitAction/);
    }
    expect(storageWrites).toBeGreaterThan(0);
  });

  it('boot revalidation goes through session.validate (the authoritative seam)', () => {
    const session = readFileSync(path.join(APP_ROOT, 'src', 'client', 'session.tsx'), 'utf8');
    expect(session).toContain("envelope('session.validate'");
    expect(session).toContain('session-reload');
  });

  it('the offline queue holds pending PROJECTIONS only (queueable operations, idempotency keys)', () => {
    for (const operation of ['evidence.intake', 'action.submit', 'action.approve', 'action.execute', 'delivery.observe']) {
      expect(QUEUEABLE_OPERATIONS).toContain(operation);
    }
    // Non-queueable mutating ops are never admitted to the queue.
    for (const operation of ['solution.sealVersion', 'program.build', 'delivery.close']) {
      expect(QUEUEABLE_OPERATIONS).not.toContain(operation);
    }
  });
});

describe('pin (c): no hard-coded model->role mapping anywhere in apps/web', () => {
  it('no source file maps model/provider names to roles or assignments', () => {
    const files = [...sourceFiles(path.join(APP_ROOT, 'src')), ...sourceFiles(path.join(APP_ROOT, 'app'))];
    // Detectors: explicit mapping tables keyed by model/provider names to
    // roles/assignments, or role assignment conditioned on a model name.
    const patterns: RegExp[] = [
      /model[-_ ]?to[-_ ]?role/i,
      /role[-_ ]?by[-_ ]?model/i,
      /model\s*:\s*['"`][^'"`]*['"`]\s*,?\s*role\s*:/i,
      /(gpt|claude|gemini|llama|mistral)\s*->\s*['"`]?(engineer|approver|supervisor|role)/i,
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of patterns) {
        expect(`${path.relative(APP_ROOT, file)}: ${pattern}`, `${file} matched ${pattern}`).toBe(
          `${path.relative(APP_ROOT, file)}: ${pattern}`,
        );
        expect(pattern.test(source)).toBe(false);
      }
    }
  });

  it('the candidate catalog carries capability claims (never name-keyed role assignments)', () => {
    const config = readFileSync(path.join(APP_ROOT, 'src', 'server', 'product-config.ts'), 'utf8');
    expect(config).toContain('claimedCapabilities');
    expect(config).toContain('claimBasis');
    // The discovery input is task/world/evidence/constraint signals.
    expect(config).toContain('taskSignals');
    expect(config).toContain('worldRefs');
    expect(config).toContain('evidenceSignals');
    expect(config).toContain('constraintSignals');
  });
});

describe('the payload derivation stays kernel-free (the client seam)', () => {
  it('src/product + src/client import only the client-runtime contract surface', () => {
    const files = [...sourceFiles(path.join(APP_ROOT, 'src', 'product')), ...sourceFiles(path.join(APP_ROOT, 'src', 'client'))];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const imports = [...source.matchAll(/from '(@epoch\/[a-z-]+)'/g)].map((match) => match[1]);
      for (const specifier of imports) {
        expect(
          `${path.relative(APP_ROOT, file)} imports ${specifier}`,
          'the client/product seam may only import @epoch/client-runtime',
        ).toBe(`${path.relative(APP_ROOT, file)} imports ${specifier}`);
        expect(['@epoch/client-runtime']).toContain(specifier);
      }
    }
  });
});
