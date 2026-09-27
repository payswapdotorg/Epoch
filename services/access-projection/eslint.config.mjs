// Service-layer lint: the boundary-check script is the authoritative layer
// gate (a service may depend on any non-pack layer); this config keeps the
// in-package rules identical to the sibling services (W037/W038).
import { defineConfig } from '@epoch/eslint-config';

export default defineConfig({ layer: 'service' });
