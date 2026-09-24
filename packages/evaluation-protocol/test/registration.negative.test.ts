// Evaluator registration — negative cases: an evaluator that cannot
// declare its judgment basis or assumptions is NOT registrable; malformed
// declarations and smuggled vendor vocabulary are rejected as typed
// protocol errors.
import { describe, expect, it } from 'vitest';
import { parseEvaluatorRegistration } from '../src/registration';
import type { EvaluatorRegistration } from '../src/registration';
import { validRegistration } from './fixtures';

type Mutation = (registration: EvaluatorRegistration) => void;

function rejectMutation(name: string, mutate: Mutation, match?: RegExp): void {
  it(`rejects ${name}`, () => {
    const registration = validRegistration();
    mutate(registration);
    const outcome = parseEvaluatorRegistration(registration);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.kind).toBe('schema-violation');
    if (match && outcome.error.kind === 'schema-violation') {
      const text = outcome.error.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(' | ');
      expect(text).toMatch(match);
    }
  });
}

describe('parseEvaluatorRegistration (negative: undeclarable contracts)', () => {
  rejectMutation(
    'a registration missing its judgment basis',
    (r) => delete (r as Partial<EvaluatorRegistration>).judgmentBasis,
    /judgmentBasis/i,
  );

  rejectMutation(
    'a judgment basis with an empty assumptions list',
    (r) => {
      r.judgmentBasis.assumptions = [];
    },
    /assumptions|too_small/i,
  );

  rejectMutation(
    'a judgment basis with an empty summary',
    (r) => {
      r.judgmentBasis.summary = '';
    },
    /summary|too_small/i,
  );

  rejectMutation(
    'a registration with zero declared subject kinds',
    (r) => {
      r.subjectKinds = [];
    },
    /subjectKinds|too_small/i,
  );

  rejectMutation(
    'a registration with zero declared criteria',
    (r) => {
      r.criteria = [];
    },
    /criteria|too_small/i,
  );

  rejectMutation(
    'a registration with zero declared verdict forms',
    (r) => {
      r.verdictForms = [];
    },
    /verdictForms|too_small/i,
  );

  rejectMutation(
    'a registration missing its determinism claim',
    (r) => delete (r as Partial<EvaluatorRegistration>).deterministic,
    /deterministic/i,
  );
});

describe('parseEvaluatorRegistration (negative: malformed declarations)', () => {
  rejectMutation(
    'registrations with duplicate criterion names',
    (r) => {
      r.criteria = [r.criteria[0]!, { ...r.criteria[0]! }];
    },
    /unique/i,
  );

  rejectMutation(
    'registrations with duplicate subject kinds',
    (r) => {
      r.subjectKinds = ['simulation-result', 'simulation-result'];
    },
    /unique/i,
  );

  rejectMutation(
    'registrations with duplicate verdict forms',
    (r) => {
      r.verdictForms = ['pass-fail', 'pass-fail'];
    },
    /unique/i,
  );

  rejectMutation(
    'latency profiles with p95 < p50',
    (r) => {
      r.latencyProfile = { p50Milliseconds: 500, p95Milliseconds: 400 };
    },
    /p95/i,
  );

  it('rejects malformed evaluator ids', () => {
    for (const evaluatorId of ['thermal-margin', 'Evaluator:Foo', 'evaluator:', 'eval']) {
      const registration = validRegistration({ evaluatorId });
      const outcome = parseEvaluatorRegistration(registration);
      expect(outcome.ok, `evaluatorId=${evaluatorId}`).toBe(false);
    }
  });

  it('rejects non-object inputs with a typed error', () => {
    for (const input of [null, 42, 'x', [], true]) {
      const outcome = parseEvaluatorRegistration(input);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});

describe('parseEvaluatorRegistration (negative: vendor-vocabulary smuggling)', () => {
  it('rejects vendor/framework/model-specific fields via unknown-field discipline', () => {
    for (const smuggled of [
      { judge: 'gpt-4o' },
      { model: 'claude-3' },
      { vendor: 'openai' },
      { apiEndpoint: 'https://vendor.example' },
      { apiKey: 'secret' },
    ]) {
      const registration = { ...validRegistration(), ...smuggled };
      const outcome = parseEvaluatorRegistration(registration);
      expect(outcome.ok, `smuggled=${JSON.stringify(smuggled)}`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});

describe('parseEvaluatorRegistration (negative: version and kind gates)', () => {
  it('reports version-mismatch with expected and encountered versions', () => {
    for (const encountered of ['0.9.0', '2.0.0', '1.0', '']) {
      const registration = { ...validRegistration(), protocolVersion: encountered };
      const outcome = parseEvaluatorRegistration(registration);
      expect(outcome.ok, `protocolVersion=${encountered}`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('version-mismatch');
      if (outcome.error.kind === 'version-mismatch') {
        expect(outcome.error.expected).toBe('1.0.0');
        expect(outcome.error.encountered).toBe(encountered);
      }
    }
  });

  it('reports kind-mismatch with expected and encountered kinds', () => {
    const registration = { ...validRegistration(), messageKind: 'evaluation.verdict' };
    const outcome = parseEvaluatorRegistration(registration);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('kind-mismatch');
      if (outcome.error.kind === 'kind-mismatch') {
        expect(outcome.error.expected).toBe('evaluation.registration');
        expect(outcome.error.encountered).toBe('evaluation.verdict');
      }
    }
  });

  it('gives version-mismatch precedence over kind-mismatch', () => {
    const registration = {
      ...validRegistration(),
      protocolVersion: '0.9.0',
      messageKind: 'evaluation.verdict',
    };
    const outcome = parseEvaluatorRegistration(registration);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('version-mismatch');
  });
});
