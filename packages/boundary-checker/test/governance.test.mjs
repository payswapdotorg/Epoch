// @epoch/boundary-checker — governance checker self-tests (W001 acceptance 4).
//
// Proves the extended scripts/governance-check.py:
//   - passes against the REAL repository governance state (--root);
//   - passes its internal negative-fixture battery (--selftest) which
//     detects: invalid worker counts, missing canonical files, missing
//     dependency-graph-referenced work-order files, and overlapping active
//     Work Order ownership (reporting the exact intersecting paths);
//   - exits non-zero on an invalid state given via --root.
import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');
const CHECKER = path.join(REPO_ROOT, 'scripts', 'governance-check.py');

async function governance(args) {
  try {
    const { stdout, stderr } = await run('python3', [CHECKER, ...args], { cwd: REPO_ROOT });
    return { code: 0, out: `${stdout}${stderr}` };
  } catch (err) {
    return { code: err.code ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('governance checker', () => {
  it(
    'passes against the real repository governance state',
    async () => {
      const result = await governance(['--root', REPO_ROOT]);
      expect(result.code).toBe(0);
      expect(result.out).toContain('governance-check: PASS');
    },
    60000,
  );

  it(
    'negative-fixture selftest detects every mutation class',
    async () => {
      const result = await governance(['--selftest']);
      expect(result.code).toBe(0);
      expect(result.out).toContain('governance selftest: PASS');
      expect(result.out).toContain('valid-baseline-passes');
      expect(result.out).toContain('invalid-max-concurrent-workers-detected');
      expect(result.out).toContain('missing-canonical-file-detected');
      expect(result.out).toContain('overlapping-ownership-detected');
      expect(result.out).toContain('invalid-worker-count-detected');
      expect(result.out).toContain('missing-referenced-work-order-detected');
    },
    60000,
  );

  it(
    'exits non-zero on an invalid state given via --root',
    async () => {
      const bogus = mkdtempSync(path.join(tmpdir(), 'epoch-gov-invalid-'));
      try {
        const result = await governance(['--root', bogus]);
        expect(result.code).toBe(1);
        expect(result.out).toContain('governance-check FAIL');
      } finally {
        rmSync(bogus, { recursive: true, force: true });
      }
    },
    60000,
  );
});
