// The neutrality battery (W045 pin 4): zero provider names in the kernel
// src — a blocklist fixture naming common model providers, model
// registries and code hosts must appear NOWHERE in
// packages/capability-discovery/src (types, schemas, comments included).
// Also: no wall-clock, no randomness (acceptance 8's determinism floor).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

/**
 * The provider blocklist fixture (W045 pin 4): common model providers,
 * model families, registries and code hosts. None of these may appear
 * anywhere in the kernel source — roles are task specializations, never
 * model names (ARCD1.0).
 */
const PROVIDER_BLOCKLIST = [
  'openai',
  'anthropic',
  'claude',
  'gpt',
  'chatgpt',
  'gemini',
  'deepmind',
  'llama',
  'meta-llama',
  'mistral',
  'mixtral',
  'cohere',
  'command-r',
  'qwen',
  'deepseek',
  'huggingface',
  'hugging-face',
  'modelhub',
  'replicate',
  'together.ai',
  'groq',
  'perplexity',
  'bedrock',
  'azure-openai',
  'vertex',
  'palm',
  'bard',
  'midjourney',
  'stablediffusion',
  'stable-diffusion',
  'runway',
  'github',
  'gitlab',
  'bitbucket',
  'sourceforge',
  'temporal',
  'airflow',
  'kubernetes',
  'docker',
];

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

describe('provider neutrality (W045 pin 4: zero provider names in kernel src)', () => {
  it('no src file mentions any blocklisted provider', () => {
    const files = listFiles(SRC_DIR).filter((file) => /\.(ts|mts)$/.test(file));
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const provider of PROVIDER_BLOCKLIST) {
        expect(
          content.includes(provider),
          `${path.relative(SRC_DIR, file)} mentions "${provider}"`,
        ).toBe(false);
      }
    }
  });

  it('no vendor-named module files exist', () => {
    for (const file of listFiles(SRC_DIR)) {
      const base = path.basename(file).toLowerCase();
      for (const provider of PROVIDER_BLOCKLIST) {
        expect(base.includes(provider), `src file ${base} is named after "${provider}"`).toBe(false);
      }
    }
  });
});

describe('determinism floor (zero wall-clock, zero randomness)', () => {
  it('no src file reads the wall clock or uses randomness', () => {
    const forbidden = [
      /Date\.now\s*\(/,
      /new\s+Date\s*\(\s*\)/,
      /Math\.random\s*\(/,
      /crypto\.random/,
      /performance\.now\s*\(/,
      /process\.hrtime/,
      /process\.env/,
    ];
    for (const file of listFiles(SRC_DIR).filter((f) => /\.(ts|mts)$/.test(f))) {
      const content = readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        expect(
          pattern.test(content),
          `${path.relative(SRC_DIR, file)} matches wall-clock/randomness pattern ${pattern}`,
        ).toBe(false);
      }
    }
  });

  it('no scheduler or cron library is imported (the scheduler is a contract)', () => {
    for (const file of listFiles(SRC_DIR).filter((f) => /\.(ts|mts)$/.test(f))) {
      const content = readFileSync(file, 'utf8');
      expect(content, `${file}`).toBeDefined();
      const imports = [...content.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]!);
      for (const specifier of imports) {
        expect(
          /cron|temporal|scheduler-lib|bull|agenda|node-cron/.test(specifier),
          `${file} imports scheduler dependency ${specifier}`,
        ).toBe(false);
      }
    }
  });

  it('the only imports are zod, @epoch/agent-protocol, @epoch/capability-registry and relative paths', () => {
    const allowed = new Set(['zod', '@epoch/agent-protocol', '@epoch/capability-registry']);
    for (const file of listFiles(SRC_DIR).filter((f) => /\.(ts|mts)$/.test(f))) {
      const content = readFileSync(file, 'utf8');
      const imports = [
        ...content.matchAll(/from\s+'([^']+)'/g),
        ...content.matchAll(/import\s+'([^']+)'/g),
      ].map((match) => match[1]!);
      for (const specifier of imports) {
        if (specifier.startsWith('.') || specifier.startsWith('node:')) continue;
        const base = specifier.startsWith('@') ? specifier : specifier.split('/')[0]!;
        expect(allowed.has(base), `${file} imports unexpected dependency "${specifier}"`).toBe(true);
      }
    }
  });
});
