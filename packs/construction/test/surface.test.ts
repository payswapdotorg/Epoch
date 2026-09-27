// Pack-surface evidence: the pack exposes NO write path into BOQ state —
// the BOQ projection is recomputed from sealed state on every call, the
// exported surface carries no BOQ admission/mutation entry points, and
// the pack owns no UI.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as pack from '../src/index';
import { warehouseChain } from './fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full));
    } else if (/\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('NAMED: no BOQ write path (boq-direct-write-rejected surface evidence)', () => {
  it('the exported surface exposes no BOQ admission/mutation/persistence entry point', () => {
    const exported = Object.keys(pack).sort();
    const forbidden = new RegExp(
      '^(admitBoq|appendBoq|saveBoq|storeBoq|persistBoq|writeBoq|updateBoq|' +
        'mutateBoq|amendBoq|reviseBoq|removeBoq|upsertBoq|commitBoq|createBoq|' +
        'admitBoqView|admitBoqLine|recordBoq|setBoq|putBoq|patchBoq|deleteBoq)$',
    );
    for (const name of exported) {
      expect(forbidden.test(name), `exported symbol "${name}" is a BOQ write path`).toBe(false);
    }
  });

  it('the ONLY BOQ-producing exports are the pure projection, its verifier and view schemas', () => {
    const boqExports = Object.keys(pack).filter((name) => /Boq/i.test(name)).sort();
    expect(boqExports).toEqual([
      'BOQ_PRELIMINARIES_SECTION_CODE',
      'BoqCurrencyTotalSchema',
      'BoqLineItemSchema',
      'BoqSectionSchema',
      'BoqViewSchema',
      'FORBIDDEN_BOQ_WRITE_FIELDS',
      'projectBoq',
      'verifyBoqView',
    ]);
  });

  it('projectBoq recomputes from sealed state — mutating a returned view changes nothing', () => {
    const chain = warehouseChain();
    const inputs = {
      solution: chain.solution,
      program: chain.program,
      acquisitions: chain.acquisitions,
      delivery: chain.delivery,
      worldEntities: chain.worldEntities,
    };
    const first = pack.projectBoq(inputs);
    if (!first.ok) {
      throw new Error('fixture BOQ failed to project');
    }
    // Deep-mutate the returned view.
    const mutated = JSON.parse(JSON.stringify(first.value)) as Record<string, unknown>;
    mutated.lineItems = [];
    mutated.totals = [{ currency: 'EUR', totalAmount: '0' }];
    (mutated as { contentDigest?: string }).contentDigest = '0'.repeat(64);
    const second = pack.projectBoq(inputs);
    if (!second.ok) {
      throw new Error('fixture BOQ failed to re-project');
    }
    expect(second.value).toEqual(first.value);
    expect(JSON.stringify(mutated)).not.toBe(JSON.stringify(second.value));
  });

  it('projectBoq is idempotent: two calls over identical inputs deep-equal', () => {
    const chain = warehouseChain();
    const first = pack.projectBoq({ solution: chain.solution });
    const second = pack.projectBoq({ solution: chain.solution });
    if (!first.ok || !second.ok) {
      throw new Error('fixture BOQ failed to project');
    }
    expect(first.value).toEqual(second.value);
  });

  it('a BOQ view is NOT valid canonical input — it cannot re-enter as solution state', () => {
    const chain = warehouseChain();
    const boq = pack.projectBoq({ solution: chain.solution });
    if (!boq.ok) {
      throw new Error('fixture BOQ failed to project');
    }
    // Feeding the view where the sealed solution belongs must fail typed.
    const replayed = pack.projectBoq({ solution: boq.value as never });
    expect(replayed.ok).toBe(false);
    if (!replayed.ok) {
      expect(['validation', 'digest-mismatch', 'vendor-fields-rejected']).toContain(
        replayed.error.code,
      );
    }
  });

  it('no src file performs IO or reads the wall clock (pure projection discipline)', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      const ioImports = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)]
        .map((match) => match[1]!)
        .filter((specifier) => /^(node:)?(fs|net|http|https|os|child_process|dns|tls)/.test(specifier));
      expect(ioImports, `${file} performs IO imports: ${ioImports.join(', ')}`).toEqual([]);
      expect(content.includes('Date.now'), file).toBe(false);
      expect(content.includes('new Date('), file).toBe(false);
      expect(content.includes('Math.random'), file).toBe(false);
    }
  });
});
