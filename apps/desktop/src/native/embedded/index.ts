/** @epoch/desktop — the embedded gateway binding (W048). */
export {
  FIXTURE_FILES,
  loadFixtureBundle,
  refuseFixtureDigestMismatch,
} from './fixture-source';
export type { FixtureBundle, FixtureDomain, FixtureRegistry, FixtureSource } from './fixture-source';
export { NodeFsFixtureSource, loadFixtureBundleSync, repoFixtureRoot } from './node-fixture-source';
export { WebFixtureSource } from './web-fixture-source';
export { buildEmbeddedGateway } from './embedded-gateway';
export type { EmbeddedGatewayBinding, EmbeddedGatewayOptions } from './embedded-gateway';
