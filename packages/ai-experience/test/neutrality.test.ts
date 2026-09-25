// Neutrality and determinism discipline: zero provider/vendor PRODUCT
// references in the src corpus (outside comments and the blocklist
// definitions themselves) and in the emitted contract artifacts; the
// blocklists reject their vocabularies; the scans are deterministic.
// (W012 precedent: the neutral role words "provider"/"vendor" name the
// enforcement surface and are allowed in descriptive text; PRODUCT
// tokens are never allowed.)
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderAiExperienceContractFiles,
  scanExecutableUiViolations,
  scanVendorFieldViolations,
  VENDOR_FIELD_BLOCKLIST,
  EXECUTABLE_FIELD_BLOCKLIST,
} from '../src/index';
import type { JsonValue } from '@epoch/agent-protocol';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Product tokens that may never appear in src or emitted artifacts. */
const PRODUCT_TOKENS = [
  'anthropic',
  'aws',
  'azure',
  'bedrock',
  'chatgpt',
  'claude',
  'copilot',
  'gemini',
  'gpt',
  'grok',
  'huggingface',
  'llama',
  'midjourney',
  'mistral',
  'openai',
  'vertex',
];

/**
 * Every non-comment, non-blocklist-entry line of every src file (the
 * neutrality corpus). Pure string-literal array entries are the
 * blocklist definitions themselves — the enforcement mechanism, not a
 * violation.
 */
function srcCorpus(): string[] {
  const lines: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.ts$/.test(name)) continue;
      const content = readFileSync(full, 'utf8');
      let inBlockComment = false;
      for (const raw of content.split('\n')) {
        const line = raw.trim();
        if (inBlockComment) {
          if (line.includes('*/')) inBlockComment = false;
          continue;
        }
        if (line.startsWith('/*')) {
          if (!line.includes('*/')) inBlockComment = true;
          continue;
        }
        if (line.startsWith('//') || line.startsWith('*')) continue;
        if (/^['"][A-Za-z0-9_.-]+['"],?$/.test(line)) continue; // blocklist entries
        lines.push(raw);
      }
    }
  };
  walk(path.resolve(here, '..', 'src'));
  return lines;
}

describe('provider neutrality (lock rule 13)', () => {
  it('src carries zero vendor-product references outside comments and blocklist definitions', () => {
    const corpus = srcCorpus().join('\n').toLowerCase();
    const offenders = PRODUCT_TOKENS.filter((token) => corpus.includes(token));
    expect(offenders, `vendor product tokens in src: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the emitted contract artifacts carry zero vendor-product tokens', () => {
    const rendered = renderAiExperienceContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of PRODUCT_TOKENS) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('the vendor scan rejects provider keys at any depth', () => {
    const payload: JsonValue = {
      discipline: 'structural',
      nested: { service: { provider: 'openai' } },
    };
    const violations = scanVendorFieldViolations(payload);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.key).toBe('provider');
    expect(violations[0]?.path).toBe('nested.service.provider');
  });

  it('the vendor scan accepts clean payloads', () => {
    expect(scanVendorFieldViolations({ discipline: 'structural', severity: 2 })).toEqual([]);
  });
});

describe('the Dynamic UI law', () => {
  it('the executable scan rejects code keys at any depth', () => {
    const payload: JsonValue = { ui: { script: 'alert(1)' } };
    const violations = scanExecutableUiViolations(payload);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.key).toBe('script');
  });

  it('the executable scan rejects script-prefixed string values', () => {
    expect(scanExecutableUiViolations({ note: '<script>x</script>' }).length).toBeGreaterThan(0);
    expect(scanExecutableUiViolations({ note: 'javascript:boom()' }).length).toBeGreaterThan(0);
    expect(scanExecutableUiViolations({ note: 'eval(1)' }).length).toBeGreaterThan(0);
  });

  it('the executable scan accepts clean payloads', () => {
    expect(scanExecutableUiViolations({ note: 'check the cover width', severity: 2 })).toEqual([]);
    expect(scanExecutableUiViolations(['plain', 'values'])).toEqual([]);
  });

  it('the scans are case-insensitive on executable value prefixes', () => {
    expect(scanExecutableUiViolations({ note: '<SCRIPT>x' }).length).toBeGreaterThan(0);
  });
});

describe('determinism discipline', () => {
  it('the blocklists are sorted and duplicate-free (stable contracts)', () => {
    for (const list of [VENDOR_FIELD_BLOCKLIST, EXECUTABLE_FIELD_BLOCKLIST]) {
      expect([...list]).toEqual([...list].sort());
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('the scans are deterministic across key insertion orders', () => {
    const first: JsonValue = { a: { x: 1 }, b: { provider: 'x' } };
    const second: JsonValue = { b: { provider: 'x' }, a: { x: 1 } };
    expect(scanVendorFieldViolations(first)).toEqual(scanVendorFieldViolations(second));
  });
});
