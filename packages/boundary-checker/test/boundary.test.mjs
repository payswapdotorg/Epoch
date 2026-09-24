// @epoch/boundary-checker — fixtures for scripts/boundary-check.mjs.
//
// Proves (W001 acceptance 5 + battery item 5): the checker passes a fully
// valid synthetic workspace exercising every ALLOWED import direction, and
// fails each violation class with a message naming both packages and layers.
import { afterAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');
const CHECKER = path.join(REPO_ROOT, 'scripts', 'boundary-check.mjs');
const scratch = [];

afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

function buildWorkspace(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'epoch-boundary-'));
  scratch.push(root);
  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(root, relPath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
  }
  return root;
}

async function check(root) {
  try {
    const { stdout, stderr } = await run('node', [CHECKER, '--root', root], { cwd: REPO_ROOT });
    return { code: 0, out: `${stdout}${stderr}` };
  } catch (err) {
    return { code: err.code ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const manifest = (name, layer, extra = {}) => ({
  name,
  version: '0.0.0',
  private: true,
  ...(layer === null ? {} : { epoch: { layer } }),
  ...extra,
});
const deps = (names) => Object.fromEntries(names.map((n) => [n, 'workspace:*']));

// A fully valid synthetic workspace covering every ALLOWED direction:
// kernel->contracts/tooling/kernel, contracts->tooling,
// experience->experience/kernel/contracts, pack->contracts/kernel (capability
// APIs), service->experience/kernel/pack(entry), app->experience/kernel/
// pack(entry)/service.
function validWorkspace() {
  return {
    'pnpm-workspace.yaml': 'packages:\n  - "pkgs/*"\n',
    'pkgs/tooling/package.json': manifest('@t/tooling', 'tooling'),
    'pkgs/tooling/src/index.ts': 'export const tooling = 1;\n',
    'pkgs/contracts/package.json': manifest('@t/contracts', 'contracts', {
      dependencies: deps(['@t/tooling']),
    }),
    'pkgs/contracts/src/index.ts': "import '@t/tooling';\nexport const contracts = 1;\n",
    'pkgs/kernel/package.json': manifest('@t/kernel', 'kernel', {
      dependencies: deps(['@t/contracts', '@t/tooling']),
    }),
    'pkgs/kernel/src/index.ts': "import '@t/contracts';\nimport '@t/tooling';\nexport const kernel = 1;\n",
    'pkgs/kernel2/package.json': manifest('@t/kernel2', 'kernel', {
      dependencies: deps(['@t/kernel']),
    }),
    'pkgs/kernel2/src/index.ts': "import '@t/kernel';\nexport const kernel2 = 1;\n",
    'pkgs/ui-lib/package.json': manifest('@t/ui-lib', 'experience', {
      dependencies: deps(['@t/kernel', '@t/contracts', '@t/tooling']),
    }),
    'pkgs/ui-lib/src/index.ts': "import '@t/kernel';\nimport '@t/contracts';\nexport const ui = 1;\n",
    'pkgs/ui-kit/package.json': manifest('@t/ui-kit', 'experience', {
      dependencies: deps(['@t/ui-lib']),
    }),
    'pkgs/ui-kit/src/index.ts': "import '@t/ui-lib';\nexport const kit = 1;\n",
    'pkgs/pack-one/package.json': manifest('@t/pack-one', 'pack', {
      dependencies: deps(['@t/contracts', '@t/kernel']),
    }),
    'pkgs/pack-one/src/index.ts': "import '@t/contracts';\nimport '@t/kernel';\nexport const pack = 1;\n",
    'pkgs/svc/package.json': manifest('@t/svc', 'service', {
      dependencies: deps(['@t/ui-lib', '@t/kernel', '@t/pack-one']),
    }),
    'pkgs/svc/src/index.ts':
      "import '@t/ui-lib';\nimport '@t/kernel';\nimport '@t/pack-one';\nexport const svc = 1;\n",
    'pkgs/app/package.json': manifest('@t/app', 'app', {
      dependencies: deps(['@t/ui-lib', '@t/kernel', '@t/pack-one', '@t/svc']),
    }),
    'pkgs/app/src/main.ts':
      "import '@t/ui-lib';\nimport '@t/kernel';\nimport '@t/pack-one';\nimport '@t/svc';\nexport const app = 1;\n",
  };
}

function violatingWorkspace(mutate) {
  const files = validWorkspace();
  mutate(files);
  return files;
}

describe('boundary checker — valid workspace', () => {
  it('passes a workspace that uses only allowed import directions', async () => {
    const root = buildWorkspace(validWorkspace());
    const result = await check(root);
    expect(result.code).toBe(0);
    expect(result.out).toContain('boundary-check: PASS');
  });
});

describe('boundary checker — violations are detected', () => {
  const cases = [
    {
      name: 'kernel -> app source import',
      mutate: (files) => {
        files['pkgs/kernel/src/bad.ts'] = "import '@t/app';\n";
      },
      expect: ['@t/kernel', '@t/app', 'layer kernel'],
    },
    {
      name: 'kernel -> experience source import',
      mutate: (files) => {
        files['pkgs/kernel/src/bad.ts'] = "import '@t/ui-lib';\n";
      },
      expect: ['@t/kernel', '@t/ui-lib', 'experience'],
    },
    {
      name: 'kernel -> experience via package.json dependency',
      mutate: (files) => {
        files['pkgs/kernel/package.json'] = manifest('@t/kernel', 'kernel', {
          dependencies: deps(['@t/contracts', '@t/tooling', '@t/ui-lib']),
        });
      },
      expect: ['dependencies', '@t/ui-lib'],
    },
    {
      name: 'contracts -> kernel source import',
      mutate: (files) => {
        files['pkgs/contracts/src/bad.ts'] = "import '@t/kernel';\n";
      },
      expect: ['@t/contracts', '@t/kernel'],
    },
    {
      name: 'experience -> app source import (app is not importable from experience)',
      mutate: (files) => {
        files['pkgs/ui-lib/src/bad.ts'] = "import '@t/app';\n";
      },
      expect: ['@t/ui-lib', '@t/app'],
    },
    {
      name: 'pack -> experience source import',
      mutate: (files) => {
        files['pkgs/pack-one/src/bad.ts'] = "import '@t/ui-lib';\n";
      },
      expect: ['@t/pack-one', '@t/ui-lib'],
    },
    {
      name: 'app deep-import into pack internals',
      mutate: (files) => {
        files['pkgs/app/src/bad.ts'] = "import '@t/pack-one/src/internal/engine';\n";
      },
      expect: ['pack internals'],
    },
    {
      name: 'missing epoch.layer declaration',
      mutate: (files) => {
        files['pkgs/kernel/package.json'] = manifest('@t/kernel', null);
      },
      expect: ['missing "epoch.layer"'],
    },
    {
      name: 'unknown epoch.layer value',
      mutate: (files) => {
        files['pkgs/kernel/package.json'] = manifest('@t/kernel', 'ui');
      },
      expect: ['unknown epoch.layer'],
    },
    {
      // The specifier is assembled via join() so the test kit's own source
      // does not contain a literal relative-import specifier for the static
      // scanner to pick up.
      name: 'cross-package relative import escape',
      mutate: (files) => {
        const spec = ['..', '..', 'kernel2', 'src', 'index.js'].join('/');
        files['pkgs/app/src/bad.ts'] = `import '${spec}';\n`;
      },
      expect: ['cross-package relative import'],
    },
  ];

  for (const testCase of cases) {
    it(`fails: ${testCase.name}`, async () => {
      const root = buildWorkspace(violatingWorkspace(testCase.mutate));
      const result = await check(root);
      expect(result.code).toBe(1);
      expect(result.out).toContain('boundary-check: FAIL');
      for (const fragment of testCase.expect) {
        expect(result.out).toContain(fragment);
      }
    });
  }
});
