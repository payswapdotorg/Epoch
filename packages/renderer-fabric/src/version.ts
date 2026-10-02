/**
 * @epoch/renderer-fabric — versions and constants (W056).
 *
 * The fabric CONSUMES the frozen renderer contract
 * (`@epoch/renderer-runtime`, published at `contracts/renderers` v1.1.0)
 * and the canonical world experience projection
 * (`@epoch/world-experience`, W016). This package adds ORCHESTRATION, not
 * a second contract: every serialized fabric document is a contract
 * document (session, snapshot, switch, envelopes, receipts, bindings).
 */

/** The fabric's own package contract version (orchestration surface). */
export const RENDERER_FABRIC_CONTRACT_VERSION = '1.0.0' as const;

/**
 * The versioned renderer contract adapters must honor to register with
 * the fabric: the `epoch.renderers` contract reference carried by every
 * renderer capability manifest (category `visualization`), matching the
 * published contract tree at `contracts/renderers` (v1.1.0).
 */
export const RENDERER_CAPABILITY_CONTRACT_ID = 'epoch.renderers' as const;

/** The capability category renderer adapters register under. */
export const RENDERER_CAPABILITY_CATEGORY = 'visualization' as const;

/** Default semver constraint used when resolving renderer capabilities. */
export const DEFAULT_RENDERER_CONSTRAINT = { kind: 'caret', version: '1.0.0' } as const;
