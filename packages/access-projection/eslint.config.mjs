// Kernel-layer lint: the boundary-check script is the authoritative layer
// gate; this config keeps the in-package rules identical to the sibling
// kernels (W037/W038).
import { defineConfig } from '@epoch/eslint-config';

export default defineConfig({ layer: 'kernel' });
