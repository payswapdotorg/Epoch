// One-shot fixture generation (NOT a test): writes the shared committed
// fixture runtimes/wasm/test/fixtures/component-descriptor.fixture.json
// from the canonical builder in test/helpers.ts, with REAL SHA-256
// section digests over the documented synthetic byte content. Run:
//
//   bun run test/generate-fixture.ts   (from runtimes/wasm)
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { descriptor, FIXTURE_SECTION_CONTENT } from './helpers';
import { computeLayoutDigest, sha256BytesHex } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, 'fixtures/component-descriptor.fixture.json');
const document = descriptor();
const digest = computeLayoutDigest(document);
if (!digest.ok) {
  throw new Error(`fixture generation failed: ${JSON.stringify(digest.error)}`);
}
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
console.log('fixture written:', target);
console.log('layout digest:', digest.value);
for (const [name, bytes] of Object.entries(FIXTURE_SECTION_CONTENT)) {
  console.log(`section ${name}: bytes=${bytes.length} sha256=${sha256BytesHex(bytes)}`);
}
