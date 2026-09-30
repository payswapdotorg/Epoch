// The detox jest wiring (qa/mobile). Runs FROM apps/mobile (detox is a
// devDependency there — the catalog pin); this config self-locates and
// extends the module resolution to apps/mobile/node_modules so the specs
// can require('detox').
const path = require('node:path');

const HERE = __dirname;
const APPS_MOBILE = path.resolve(HERE, '..', '..', 'apps', 'mobile');

module.exports = {
  rootDir: HERE,
  testMatch: ['<rootDir>/**/*.e2e.js'],
  transform: {},
  moduleDirectories: [path.join(APPS_MOBILE, 'node_modules'), 'node_modules'],
  testTimeout: 120000,
  reporters: ['default'],
  verbose: false,
};
