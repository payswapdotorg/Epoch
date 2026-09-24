// Provider-neutrality evidence: no solver-, engine-, vendor-, or
// framework-specific vocabulary may leak into the published contract
// surface — neither into the emitted JSON Schemas nor into the TypeScript
// declarations. The simulation protocol must represent any external
// simulator behind adapters (lock rules 5/13) without protocol changes.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderSimulationContractFiles } from '../src/contract-emission';
import { SEED_POLICIES, SIMULATION_FAILURE_CODES } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', 'contracts');

/**
 * Solver/engine/vendor/framework blocklist — none of these tokens may
 * appear anywhere in the published contract artifacts. Concrete solver
 * adapters (including open-source engines, co-simulation standards, and
 * commercial solvers) are W029 concerns behind adapters.
 */
const BLOCKLIST = [
  // LLM/framework vendors (mirrored from the agent contract's blocklist).
  'openai',
  'anthropic',
  'chatgpt',
  'gpt-',
  'claude',
  'gemini',
  'mistral',
  'llama',
  'azure',
  'bedrock',
  'vertex',
  'langchain',
  'langgraph',
  'autogen',
  'crewai',
  // Simulation engines / solver vendors / co-simulation standards.
  'openfoam',
  'projectchrono',
  'chrono',
  'drake',
  'fmi',
  'fmpy',
  'functional-mockup',
  'ansys',
  'comsol',
  'matlab',
  'simulink',
  'abaqus',
  'simulia',
  'star-ccm',
  'ls-dyna',
  'dymola',
  'modelica',
  'autodesk',
  'solidworks',
  'dassault',
  'synopsys',
  'cadence',
  'simulink',
  // Tooling names are equally forbidden in the contract.
  'typescript-eslint',
];

describe('simulation contract provider neutrality', () => {
  it('contains no solver/vendor/framework tokens in any emitted schema or manifest', () => {
    const rendered = renderSimulationContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('contains no solver/vendor/framework tokens in the TypeScript declarations', () => {
    const source = readFileSync(path.join(CONTRACTS_DIR, 'index.d.ts'), 'utf8').toLowerCase();
    for (const token of BLOCKLIST) {
      expect(source.includes(token), `index.d.ts contains "${token}"`).toBe(false);
    }
  });

  it('no schema property key names a vendor, engine, model, or API surface', () => {
    const rendered = renderSimulationContractFiles();
    const forbiddenKeys =
      /^(provider|vendor|engine|solver|framework|model|modelName|apiUrl|apiKey|endpoint|deployment|licenseKey|backend|toolchain)$/i;
    for (const [rel, content] of Object.entries(rendered)) {
      const schema = JSON.parse(content) as unknown;
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) {
          for (const child of node) visit(child);
          return;
        }
        if (node !== null && typeof node === 'object') {
          const record = node as Record<string, unknown>;
          if (
            'properties' in record &&
            record.properties !== null &&
            typeof record.properties === 'object'
          ) {
            for (const key of Object.keys(record.properties as Record<string, unknown>)) {
              expect(forbiddenKeys.test(key), `${rel} declares property "${key}"`).toBe(false);
            }
          }
          for (const child of Object.values(record)) visit(child);
        }
      };
      visit(schema);
    }
  });

  it('seed policies are exactly the neutral set', () => {
    const rendered = renderSimulationContractFiles();
    const seedPolicy = JSON.parse(rendered['schemas/seed-policy.schema.json']!) as {
      $defs: { SeedPolicy: { enum: string[] } };
    };
    expect([...seedPolicy.$defs.SeedPolicy!.enum].sort()).toEqual([...SEED_POLICIES].sort());
  });

  it('failure codes are exactly the neutral protocol set', () => {
    const rendered = renderSimulationContractFiles();
    const failureCode = JSON.parse(
      rendered['schemas/simulation-failure-code.schema.json']!,
    ) as { $defs: { SimulationFailureCode: { enum: string[] } } };
    expect([...failureCode.$defs.SimulationFailureCode!.enum].sort()).toEqual(
      [...SIMULATION_FAILURE_CODES].sort(),
    );
  });

  it('registration schema marks the contract-relevant declarations required', () => {
    const rendered = renderSimulationContractFiles();
    const registration = JSON.parse(
      rendered['schemas/simulator-registration.schema.json']!,
    ) as { $defs: { SimulatorRegistration: { required: string[] } } };
    const required = registration.$defs.SimulatorRegistration!.required;
    for (const field of [
      'protocolVersion',
      'messageKind',
      'messageId',
      'createdAt',
      'simulatorId',
      'inputs',
      'outputs',
      'fidelity',
      'validityDomain',
      'assumptions',
      'reproducibility',
      'costProfile',
      'latencyProfile',
    ]) {
      expect(required, `SimulatorRegistration must require ${field}`).toContain(field);
    }
  });

  it('result schema carries no wall-clock or measurement property', () => {
    const rendered = renderSimulationContractFiles();
    const result = JSON.parse(rendered['schemas/simulation-result.schema.json']!) as {
      $defs: { SimulationResult: { properties: Record<string, unknown> } };
    };
    const keys = Object.keys(result.$defs.SimulationResult!.properties);
    for (const forbidden of [
      'createdAt',
      'completedAt',
      'startedAt',
      'durationMilliseconds',
      'wallClock',
      'measuredLatencyMilliseconds',
    ]) {
      expect(keys, `SimulationResult must not declare ${forbidden}`).not.toContain(forbidden);
    }
  });
});
