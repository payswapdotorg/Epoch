# @epoch/eslint-config

Shared ESLint flat config for the Epoch workspace (layer: `tooling`).

```js
// eslint.config.mjs
import { defineConfig } from '@epoch/eslint-config';

export default defineConfig({ layer: 'app' }); // your package's Epoch layer
```

Includes:

- `@eslint/js` recommended + `typescript-eslint` recommended (flat presets);
- shared ignores (`node_modules`, build outputs, caches);
- `no-restricted-imports` enforcement of the Epoch layer model (see
  `scripts/boundary-check.mjs` for the authoritative rules — the tables are
  intentionally duplicated as an independent second enforcement layer).

Declare devDependencies: `@epoch/eslint-config: "workspace:*"`,
`eslint: "catalog:"`.
