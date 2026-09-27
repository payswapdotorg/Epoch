// Provider-neutrality evidence (acceptance criterion: interfaces remain
// provider-neutral). The CONSTRUCTION blocklist pins the architecture-lock
// rule 13 plus the DP1.0 pack discipline: no field, type, vocabulary
// entry, or emitted view may name a vendor, brand, product, marketplace,
// ERP, PM tool, CAD/BIM product or API surface. The pack owns NO UI: no
// view-layer imports exist.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  constructionPackProfile,
  constructionVocabularyBundle,
  constructionWorkTemplates,
} from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

const AURUM_BLOCKLIST = ['aurum', 'aurumchat', 'aurum-chat'];

const VENDOR_BLOCKLIST = [
  // Construction-industry vendors and products.
  'autodesk',
  'revit',
  'navisworks',
  'bentley',
  'trimble',
  'tekla',
  'procore',
  'primavera',
  'p6',
  'autocad',
  'civil3d',
  'advancesteel',
  'solibri',
  'graphisoft',
  'archicad',
  'nemetschek',
  'planswift',
  'cubit',
  'costx',
  'winsig',
  // General software/ERP/payment/AI vendors.
  'sap',
  'oracle',
  'microsoft-project',
  'msproject',
  'stripe',
  'paypal',
  'braintree',
  'adyen',
  'klarna',
  'razorpay',
  'worldpay',
  'mollie',
  'openai',
  'anthropic',
  'gemini',
  'bedrock',
];

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full));
    } else if (/\.(ts|mts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('NAMED: provider-vocabulary-rejected (source scan)', () => {
  it('no src file mentions a provider name', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of VENDOR_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no src file mentions Aurum (the reference adapter is never a prerequisite)', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of AURUM_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no src file imports a view/UI framework (the pack owns NO UI)', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      const imports = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!);
      for (const specifier of imports) {
        expect(
          /^(react|react-dom|next|@epoch\/experience-|@epoch\/renderer-|@epoch\/ai-experience)/.test(
            specifier,
          ),
          `${file} imports UI framework "${specifier}"`,
        ).toBe(false);
      }
    }
  });
});

describe('NAMED: provider-vocabulary-rejected (emitted data scan)', () => {
  it('the profile, vocabulary bundle and templates carry no vendor tokens', () => {
    const rendered = [
      JSON.stringify(constructionPackProfile('tenant:globex')),
      JSON.stringify(constructionVocabularyBundle()),
      JSON.stringify(constructionWorkTemplates()),
    ];
    for (const content of rendered) {
      // Digest fields are opaque 64-char hex; scrub them so coincidental
      // hex substrings cannot fake a vendor hit (scan only semantic text).
      const semantic = content.replace(/"[0-9a-f]{64}"/g, '"digest"').toLowerCase();
      for (const token of [...VENDOR_BLOCKLIST, ...AURUM_BLOCKLIST]) {
        expect(semantic.includes(token), `rendered pack data contains "${token}"`).toBe(false);
      }
    }
  });
});
