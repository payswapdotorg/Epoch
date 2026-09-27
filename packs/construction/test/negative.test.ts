// NAMED NEGATIVE battery: boq-direct-write-rejected,
// parallel-ledger-rejected, tenant-isolation-rejected, tampered digests
// for every sealed view, and malformed projection inputs.
import { describe, expect, it } from 'vitest';
import { sealSolutionVersion } from '@epoch/solution-delivery';
import {
  constructionVocabularyBundle,
  constructionWorkTemplates,
  foldDeliveryLinks,
  projectBoq,
  projectConstructionProgramme,
  sealWorkTemplate,
  sealVocabularyBundle,
  verifyBoqView,
  verifyConstructionProgrammeView,
  verifyVocabularyBundle,
  verifyWorkTemplate,
} from '../src/index';
import {
  OTHER_TENANT,
  sealedProgram,
  sealedSolution,
  sealedDelivery,
  solutionContent,
  acquisitions,
  TENANT,
  warehouseChain,
} from './fixtures';

describe('NAMED NEGATIVE: boq-direct-write-rejected (no stored BOQ, no write path)', () => {
  it('a vocabulary bundle carrying a boqLedger field is rejected', () => {
    const bundle = constructionVocabularyBundle() as unknown as Record<string, unknown>;
    const withLedger = { ...bundle, boqLedger: { lines: [] } };
    const sealed = sealVocabularyBundle(withLedger);
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('boq-direct-write-rejected');
      if (sealed.error.code === 'boq-direct-write-rejected') {
        expect(sealed.error.field).toBe('boqLedger');
      }
    }
  });

  it('a work template carrying a storedBoq field is rejected', () => {
    const template = constructionWorkTemplates()[0] as unknown as Record<string, unknown>;
    delete template['contentDigest'];
    const withStored = { ...template, storedBoq: true };
    const sealed = sealWorkTemplate(withStored);
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('boq-direct-write-rejected');
    }
  });

  it('a BOQ view envelope carrying a writeBoq field is rejected', () => {
    const chain = warehouseChain();
    const boq = projectBoq({ solution: chain.solution });
    if (!boq.ok) {
      throw new Error('fixture BOQ failed to project');
    }
    const withWrite = { ...(boq.value as unknown as Record<string, unknown>), writeBoq: true };
    const verified = verifyBoqView(withWrite);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('boq-direct-write-rejected');
    }
  });

  it('a programme view envelope carrying an appendBoqLine field is rejected', () => {
    const chain = warehouseChain();
    const programme = projectConstructionProgramme(chain.program);
    if (!programme.ok) {
      throw new Error('fixture programme failed to project');
    }
    const withAppend = {
      ...(programme.value as unknown as Record<string, unknown>),
      appendBoqLine: 'line:new',
    };
    const verified = verifyConstructionProgrammeView(withAppend);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('boq-direct-write-rejected');
    }
  });
});

describe('NAMED NEGATIVE: parallel-ledger-rejected (no second quantity/cost/delivery ledger)', () => {
  it('a vocabulary bundle carrying a costLedger field is rejected', () => {
    const bundle = constructionVocabularyBundle() as unknown as Record<string, unknown>;
    const withLedger = { ...bundle, costLedger: { entries: [] } };
    const sealed = sealVocabularyBundle(withLedger);
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('parallel-ledger-rejected');
      if (sealed.error.code === 'parallel-ledger-rejected') {
        expect(sealed.error.field).toBe('costLedger');
      }
    }
  });

  it('a work template carrying a parallelLedger field is rejected', () => {
    const template = constructionWorkTemplates()[0] as unknown as Record<string, unknown>;
    delete template['contentDigest'];
    const withParallel = { ...template, parallelLedger: true };
    const sealed = sealWorkTemplate(withParallel);
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('parallel-ledger-rejected');
    }
  });

  it('a BOQ view envelope carrying a quantityLedger field is rejected', () => {
    const chain = warehouseChain();
    const boq = projectBoq({ solution: chain.solution });
    if (!boq.ok) {
      throw new Error('fixture BOQ failed to project');
    }
    const withLedger = { ...(boq.value as unknown as Record<string, unknown>), quantityLedger: [] };
    const verified = verifyBoqView(withLedger);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('parallel-ledger-rejected');
    }
  });
});

describe('NAMED NEGATIVE: tenant-isolation-rejected (cross-tenant-denied on every fold)', () => {
  it('a cross-tenant program is rejected by the BOQ projection', () => {
    const solution = sealedSolution();
    const program = sealedProgram({ ...solution, tenantId: OTHER_TENANT });
    const boq = projectBoq({ solution, program });
    expect(boq.ok).toBe(false);
    if (!boq.ok) {
      expect(boq.error.code).toBe('cross-tenant-denied');
    }
  });

  it('a cross-tenant program is rejected by the delivery-link fold', () => {
    const solution = sealedSolution();
    const program = sealedProgram({ ...solution, tenantId: OTHER_TENANT });
    const links = foldDeliveryLinks({ solution, program });
    expect(links.ok).toBe(false);
    if (!links.ok) {
      expect(links.error.code).toBe('cross-tenant-denied');
    }
  });

  it('a cross-tenant acquisition is rejected by the delivery-link fold', () => {
    const solution = sealedSolution();
    const [first] = acquisitions(solution);
    const foreign = { ...first, tenantId: OTHER_TENANT };
    const links = foldDeliveryLinks({ solution, acquisitions: [foreign] });
    expect(links.ok).toBe(false);
    if (!links.ok) {
      expect(links.error.code).toBe('cross-tenant-denied');
    }
  });

  it('a cross-tenant delivery record is rejected by the delivery-link fold', () => {
    const solution = sealedSolution();
    const foreignDelivery = sealedDelivery(solution, OTHER_TENANT);
    const links = foldDeliveryLinks({ solution, delivery: foreignDelivery });
    expect(links.ok).toBe(false);
    if (!links.ok) {
      expect(links.error.code).toBe('cross-tenant-denied');
    }
  });

  it('a delivery for a DIFFERENT solution is rejected', () => {
    const solution = sealedSolution();
    const other = sealSolutionVersion({
      ...solutionContent(),
      solutionId: 'solution:other-project',
    });
    if (!other.ok) {
      throw new Error('fixture other solution failed to seal');
    }
    const delivery = sealedDelivery(other.value);
    const links = foldDeliveryLinks({ solution, delivery });
    expect(links.ok).toBe(false);
  });

  it('views carry the tenant id of their inputs — never a foreign tenant', () => {
    const chain = warehouseChain();
    const boq = projectBoq({ solution: chain.solution, program: chain.program });
    if (!boq.ok) {
      throw new Error('fixture BOQ failed to project');
    }
    expect(boq.value.tenantId).toBe(TENANT);
    expect(boq.value.tenantId).not.toBe(OTHER_TENANT);
  });
});

describe('NAMED NEGATIVE: tampered digests (digest-mismatch on every sealed view)', () => {
  it('a tampered BOQ view fails verification', () => {
    const chain = warehouseChain();
    const boq = projectBoq({ solution: chain.solution });
    if (!boq.ok) {
      throw new Error('fixture BOQ failed to project');
    }
    const tampered = {
      ...boq.value,
      totals: [{ currency: 'EUR', totalAmount: '1' }],
    };
    const verified = verifyBoqView(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('a tampered programme view fails verification', () => {
    const chain = warehouseChain();
    const programme = projectConstructionProgramme(chain.program);
    if (!programme.ok) {
      throw new Error('fixture programme failed to project');
    }
    const tampered = { ...programme.value, title: 'Tampered programme' };
    const verified = verifyConstructionProgrammeView(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('a tampered vocabulary bundle fails verification (digest-mismatch)', () => {
    const bundle = constructionVocabularyBundle();
    const tampered = {
      ...bundle,
      measurementMethods: bundle.measurementMethods.map((method) =>
        method.methodId === 'construction.measure.area'
          ? { ...method, description: 'Tampered description' }
          : method,
      ),
    };
    const verified = verifyVocabularyBundle(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('a tampered work template fails verification', () => {
    const template = constructionWorkTemplates()[0]!;
    const tampered = { ...template, templateVersion: '9.9.9' };
    const verified = verifyWorkTemplate(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });
});

describe('NAMED NEGATIVE: malformed projection inputs', () => {
  it('a tampered solution seal is rejected by the BOQ projection (digest-mismatch)', () => {
    const solution = sealedSolution();
    const tampered = { ...solution, title: 'Tampered solution' };
    const boq = projectBoq({ solution: tampered });
    expect(boq.ok).toBe(false);
    if (!boq.ok) {
      expect(boq.error.code).toBe('digest-mismatch');
    }
  });

  it('a tampered program seal is rejected by the programme projection', () => {
    const solution = sealedSolution();
    const program = sealedProgram(solution);
    const tampered = { ...program, title: 'Tampered programme' };
    const programme = projectConstructionProgramme(tampered);
    expect(programme.ok).toBe(false);
    if (!programme.ok) {
      expect(programme.error.code).toBe('digest-mismatch');
    }
  });

  it('a program from ANOTHER solution is rejected by the BOQ projection', () => {
    const solution = sealedSolution();
    const otherSolution = sealedSolution({ solutionId: 'solution:other-project' });
    const program = sealedProgram(otherSolution);
    const boq = projectBoq({ solution, program });
    expect(boq.ok).toBe(false);
    if (!boq.ok) {
      expect(boq.error.code).toBe('cross-tenant-denied');
    }
  });

  it('a non-object input is a validation error, never a crash', () => {
    const boq = projectBoq({ solution: 'not-a-solution' as never });
    expect(boq.ok).toBe(false);
    if (!boq.ok) {
      expect(['validation', 'digest-mismatch']).toContain(boq.error.code);
    }
  });
});
