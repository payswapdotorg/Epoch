// Provider-neutrality evidence: no vendor-, framework-, or model-specific
// vocabulary may leak into the published contract surface — neither into
// the emitted JSON Schemas nor into the TypeScript declarations. The
// evaluation protocol must represent any judgment capability behind
// adapters (lock rule 13) without protocol changes; an evaluator is never
// a vendor product.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderEvaluationContractFiles } from '../src/contract-emission';
import { EVALUATION_SUBJECT_KINDS, JUSTIFICATION_KINDS, VERDICT_FORMS } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', 'contracts');

/**
 * Vendor/framework/model blocklist — none of these tokens may appear
 * anywhere in the published contract artifacts. Model-backed judges and
 * vendor quality gates are adapter concerns, not protocol vocabulary.
 */
const BLOCKLIST = [
  // LLM/framework vendors.
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
  'llamaindex',
  // Simulation/solver vendors (an evaluator must not name them either).
  'openfoam',
  'chrono',
  'drake',
  'ansys',
  'comsol',
  'matlab',
  'simulink',
  'abaqus',
  // Tooling names are equally forbidden in the contract.
  'typescript-eslint',
];

describe('evaluation contract provider neutrality', () => {
  it('contains no vendor/framework tokens in any emitted schema or manifest', () => {
    const rendered = renderEvaluationContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('contains no vendor/framework tokens in the TypeScript declarations', () => {
    const source = readFileSync(path.join(CONTRACTS_DIR, 'index.d.ts'), 'utf8').toLowerCase();
    for (const token of BLOCKLIST) {
      expect(source.includes(token), `index.d.ts contains "${token}"`).toBe(false);
    }
  });

  it('no schema property key names a vendor, model, judge, or API surface', () => {
    const rendered = renderEvaluationContractFiles();
    const forbiddenKeys =
      /^(provider|vendor|judge|llm|framework|model|modelName|apiUrl|apiKey|endpoint|deployment|licenseKey|backend)$/i;
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

  it('subject kinds are exactly the neutral set', () => {
    const rendered = renderEvaluationContractFiles();
    const subjectKind = JSON.parse(rendered['schemas/evaluation-subject-kind.schema.json']!) as {
      $defs: { EvaluationSubjectKind: { enum: string[] } };
    };
    expect([...subjectKind.$defs.EvaluationSubjectKind!.enum].sort()).toEqual([
      ...EVALUATION_SUBJECT_KINDS,
    ]);
  });

  it('verdict forms are exactly the neutral set', () => {
    const rendered = renderEvaluationContractFiles();
    const verdictForm = JSON.parse(rendered['schemas/verdict-form.schema.json']!) as {
      $defs: { VerdictForm: { enum: string[] } };
    };
    expect([...verdictForm.$defs.VerdictForm!.enum].sort()).toEqual([...VERDICT_FORMS]);
  });

  it('justification kinds are exactly the neutral set', () => {
    const rendered = renderEvaluationContractFiles();
    const justificationKind = JSON.parse(
      rendered['schemas/justification-kind.schema.json']!,
    ) as { $defs: { JustificationKind: { enum: string[] } } };
    expect([...justificationKind.$defs.JustificationKind!.enum].sort()).toEqual(
      [...JUSTIFICATION_KINDS].sort(),
    );
  });

  it('registration schema marks the contract-relevant declarations required', () => {
    const rendered = renderEvaluationContractFiles();
    const registration = JSON.parse(
      rendered['schemas/evaluator-registration.schema.json']!,
    ) as { $defs: { EvaluatorRegistration: { required: string[] } } };
    const required = registration.$defs.EvaluatorRegistration!.required;
    for (const field of [
      'protocolVersion',
      'messageKind',
      'messageId',
      'createdAt',
      'evaluatorId',
      'subjectKinds',
      'criteria',
      'verdictForms',
      'judgmentBasis',
      'deterministic',
      'costProfile',
      'latencyProfile',
    ]) {
      expect(required, `EvaluatorRegistration must require ${field}`).toContain(field);
    }
  });

  it('verdict schema marks justification required and carries no wall-clock property', () => {
    const rendered = renderEvaluationContractFiles();
    const verdict = JSON.parse(rendered['schemas/evaluation-verdict.schema.json']!) as {
      $defs: { EvaluationVerdict: { required: string[]; properties: Record<string, unknown> } };
    };
    expect(verdict.$defs.EvaluationVerdict!.required).toContain('justification');
    const keys = Object.keys(verdict.$defs.EvaluationVerdict!.properties);
    for (const forbidden of ['createdAt', 'decidedAt', 'judgedAt', 'durationMilliseconds']) {
      expect(keys, `EvaluationVerdict must not declare ${forbidden}`).not.toContain(forbidden);
    }
  });
});
