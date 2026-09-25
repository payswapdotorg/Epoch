// Provider-neutrality + determinism discipline for the host: no vendor
// document-service vocabulary in the src, no wall-clock reads, no
// randomness — the host is a pure in-memory typed-state machine whose
// timestamps arrive as typed host inputs.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));

const BLOCKLIST = [
  'dropbox',
  'sharepoint',
  'onedrive',
  'google-drive',
  'googledrive',
  'gsuite',
  'office365',
  'confluence',
  'notion',
  'evernote',
  'box-com',
  'egnyte',
  'docuware',
  'm-files',
  'mongodb',
  'firebase',
  'aws',
  'azure',
  'dynamodb',
  'openai',
  'anthropic',
  'chatgpt',
  'claude',
  'gemini',
  'bedrock',
  'tesseract',
  'abbyy',
  'pdfium',
  'adobe',
  'apache-tika',
];

const SRC_FILES = ['errors.ts', 'host.ts', 'index.ts', 'types.ts', 'version.ts'];

describe('provider neutrality (blocklist over the host sources)', () => {
  it('no executable source references vendor document services', () => {
    for (const file of SRC_FILES) {
      const raw = readFileSync(path.resolve(here, '..', 'src', file), 'utf8');
      const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const lower = stripped.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${file} (code) contains "${token}"`).toBe(false);
      }
    }
  });
});

describe('determinism discipline (the host never reads the wall clock)', () => {
  it('the src contains zero wall-clock reads and zero randomness', () => {
    const forbidden = [
      /Date\.now\s*\(/,
      /new\s+Date\s*\(/,
      /Math\.random\s*\(/,
      /crypto\.randomUUID\s*\(/,
      /performance\.now\s*\(/,
    ];
    for (const file of SRC_FILES) {
      const source = readFileSync(path.resolve(here, '..', 'src', file), 'utf8');
      const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const pattern of forbidden) {
        expect(stripped.match(pattern), `${file}: ${pattern}`).toBeNull();
      }
    }
  });

  it('no network or process APIs in the src (in-memory reference behavior)', () => {
    const forbidden = [
      /\bfetch\s*\(/,
      /\bhttp\.request\s*\(/,
      /\bhttps\.request\s*\(/,
      /\bnet\.connect\s*\(/,
      /\bchild_process\b/,
      /\bspawn\s*\(/,
      /\bexecFile\s*\(/,
      /\bfs\.writeFile\s*\(/,
      /\bfs\.open\s*\(/,
    ];
    for (const file of SRC_FILES) {
      const source = readFileSync(path.resolve(here, '..', 'src', file), 'utf8');
      const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const pattern of forbidden) {
        expect(stripped.match(pattern), `${file}: ${pattern}`).toBeNull();
      }
    }
  });
});
