/**
 * @epoch/mobile — the Metro configuration (W049).
 *
 * Expo's default Metro config (expo/metro-config): the standard Expo 57
 * resolver/transformer setup. No babel.config.js is needed — the Expo
 * metro transformer applies babel-preset-expo (an expo dependency)
 * automatically; the product code is plain TypeScript consumed verbatim.
 *
 * The app bundle is self-contained: the fixture records live under
 * native/fixtures/ (byte-identical copies of qa/fixtures/construction,
 * pinned by test/product/fixtures.test.ts) so no watchFolders are needed.
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
