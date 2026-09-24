// Contract-sync tests: (1) the implementation's zod-inferred types must be
// structurally IDENTICAL to the hand-maintained published contract surface at
// contracts/constraints/v1; (2) the committed JSON Schema renderings must
// match `z.toJSONSchema` output exactly (regenerate with
// ECL_UPDATE_SCHEMAS=1 pnpm --filter @epoch/constraint-language test).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  authoredConstraintSchema,
  compiledConstraintSchema,
  evaluationContextSchema,
  evaluationResultSchema,
  inputDeclarationSchema,
  evaluationOutcomeSchema,
} from '../src';
import type {
  AuthoredConstraint,
  CompiledConstraint,
  CompiledPayload,
  ConstraintEffect,
  ConstraintOutcome,
  EvaluationContext,
  EvaluationOutcome,
  EvaluationRejectionKind,
  InputDeclaration,
  ResultDetails,
  ValidationIssue,
} from '../src';
import type * as Contracts from '@epoch/contracts-constraints';

/** Strict type equality probe: compiles only when A and B are identical types. */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

// Compile-time assertions. If a zod-inferred type drifts from the published
// contract surface, `true as Equals<...>` stops compiling.
const contractSyncChecks = {
  inputDeclaration: true as Equals<InputDeclaration, Contracts.InputDeclaration>,
  authoredConstraint: true as Equals<AuthoredConstraint, Contracts.AuthoredConstraint>,
  compiledConstraint: true as Equals<CompiledConstraint, Contracts.CompiledConstraint>,
  compiledPayload: true as Equals<CompiledPayload, Contracts.CompiledPayload>,
  evaluationContext: true as Equals<EvaluationContext, Contracts.EvaluationContext>,
  constraintOutcome: true as Equals<ConstraintOutcome, Contracts.ConstraintOutcome>,
  constraintEffect: true as Equals<ConstraintEffect, Contracts.ConstraintEffect>,
  resultDetails: true as Equals<ResultDetails, Contracts.ResultDetails>,
  evaluationOutcome: true as Equals<EvaluationOutcome, Contracts.EvaluationOutcome>,
  evaluationRejectionKind: true as Equals<
    EvaluationRejectionKind,
    Contracts.EvaluationRejectionKind
  >,
  validationIssue: true as Equals<ValidationIssue, Contracts.ValidationIssue>,
} as const;

describe('published contract surface stays in sync with the implementation', () => {
  it('zod-inferred types equal the contracts/constraints/v1 declarations', () => {
    const results = Object.entries(contractSyncChecks);
    const drifted = results.filter(([, ok]) => ok !== true).map(([name]) => name);
    expect(drifted).toEqual([]);
    expect(results.length).toBeGreaterThanOrEqual(11);
  });

  it('the contract file declares the ECL language version literal', () => {
    const version: Contracts.EclLanguageVersion = '1.0.0';
    expect(version).toBe('1.0.0');
  });
});

// ---------------------------------------------------------------------------
// JSON Schema snapshot sync
// ---------------------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = path.resolve(here, '../../../contracts/constraints/v1/schemas');

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortKeysDeep(record[key]);
    }
    return sorted;
  }
  return value;
}

function render(schema: z.ZodType): string {
  return `${JSON.stringify(sortKeysDeep(z.toJSONSchema(schema as never)), null, 2)}\n`;
}

const expectedSchemas: Record<string, string> = {
  'authored.json': render(authoredConstraintSchema),
  'compiled.json': render(compiledConstraintSchema),
  'result.json': render(evaluationResultSchema),
  'context.json': render(evaluationContextSchema),
  'outcome.json': render(evaluationOutcomeSchema),
  'input-declaration.json': render(inputDeclarationSchema),
};

describe('committed JSON Schemas match the zod schemas', () => {
  const update = process.env.ECL_UPDATE_SCHEMAS === '1';

  if (update) {
    it('regenerates the committed schema files', () => {
      for (const [name, content] of Object.entries(expectedSchemas)) {
        writeFileSync(path.join(SCHEMAS_DIR, name), content, 'utf8');
      }
      expect(true).toBe(true);
    });
  } else {
    it.each(Object.keys(expectedSchemas))('%s is in sync (run ECL_UPDATE_SCHEMAS=1 to refresh)', (name) => {
      const committed = readFileSync(path.join(SCHEMAS_DIR, name), 'utf8');
      expect(committed).toBe(expectedSchemas[name]);
    });
  }
});
