// Provider-neutrality evidence: no vendor-, document-service-, cloud-, or
// key-specific vocabulary may leak into the published contract surface —
// neither into the emitted JSON Schemas, the manifest, nor the package
// sources. Documents are typed bytes + descriptors (lock rule 13);
// concrete ingestion sources are future adapters behind this seam.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderDocumentAdapterContractFiles } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vendor/document-service blocklist — none of these tokens may appear
 * anywhere in the published contract artifacts or the src. The neutral
 * words "provider" and "adapter" are allowed (they name roles/patterns,
 * not products); "vendor" is allowed in doc comments about the policy
 * itself, so the SRC scan below strips comments before matching.
 */
const BLOCKLIST = [
  // Document SaaS / cloud storage vendors.
  'dropbox',
  'sharepoint',
  'onedrive',
  'google-drive',
  'googledrive',
  'gsuite',
  'workspace-365',
  'office365',
  'confluence',
  'notion',
  'evernote',
  'box-com',
  'egnyte',
  'docuware',
  'm-files',
  // Document/database/cloud platforms.
  'mongodb',
  'firebase',
  'aws',
  's3-bucket',
  'azure-blob',
  'gcs-',
  'dynamodb',
  'couchdb',
  'couchbase',
  // LLM vendors.
  'openai',
  'anthropic',
  'chatgpt',
  'claude',
  'gemini',
  'bedrock',
  // Parser vendors/engines (future adapter work, not kernel surface).
  'tesseract',
  'abbyy',
  'pdfium',
  'adobe',
  'apache-tika',
  'tika',
];

describe('provider neutrality (blocklist over the emitted contract artifacts)', () => {
  const rendered = renderDocumentAdapterContractFiles();

  it('every emitted artifact is free of vendor vocabulary', () => {
    for (const [file, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('the manifest declares the neutral derivation contract', () => {
    const manifest = JSON.parse(rendered['manifest.json']!) as {
      contract: string;
      jsonSchemaFidelity: string;
    };
    expect(manifest.contract).toBe('epoch/document-adapter');
    expect(manifest.jsonSchemaFidelity).toContain('structural-only');
  });
});

describe('provider neutrality (blocklist over the package sources)', () => {
  const SRC_FILES = [
    'canonical.ts',
    'contract-emission.ts',
    'errors.ts',
    'evidence.ts',
    'extract.ts',
    'index.ts',
    'issues.ts',
    'lifecycle.ts',
    'parity.ts',
    'provenance.ts',
    'registration.ts',
    'schema.ts',
    'surface.ts',
    'types.ts',
    'version.ts',
  ];

  it('no executable source references vendor document services', () => {
    for (const file of SRC_FILES) {
      const raw = readFileSync(path.resolve(here, '..', 'src', file), 'utf8');
      // Strip comments: the policy text itself legitimately mentions the
      // vendor/service ban; only executable code is constrained.
      const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const lower = stripped.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${file} (code) contains "${token}"`).toBe(false);
      }
    }
  });
});
