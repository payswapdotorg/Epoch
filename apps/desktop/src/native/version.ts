/**
 * @epoch/desktop — the native product versions (W048).
 *
 * The native adapter zone (src/native/**) is the Tauri 2 embedding of the
 * W017 experience surface: platform toolchains are ADAPTERS, never
 * semantic authorities (architecture lock rule 13). Everything semantic
 * flows through the frozen Application Gateway vocabulary
 * (@epoch/client-runtime) — the versions below pin the compatibility
 * envelopes the native product refuses to cross (the W048 protocol gate).
 */

/** Version of the desktop native product itself. */
export const DESKTOP_PRODUCT_VERSION = '1.0.0' as const;

/**
 * Version of the native host <-> webview protocol (the custom IPC command
 * surface declared in src-tauri + consumed through @tauri-apps/api).
 */
export const DESKTOP_HOST_PROTOCOL_VERSION = '1.0.0' as const;

/**
 * The Application Gateway contract version this product build speaks (must
 * equal APPLICATION_GATEWAY_CONTRACT_VERSION — pinned by test, refusing to
 * open incompatible protocol envelope versions).
 */
export const DESKTOP_GATEWAY_CONTRACT_VERSION = '1.0.0' as const;

/** The client-runtime record schema version this build understands. */
export const DESKTOP_RECORD_SCHEMA_VERSION = 1 as const;

/** The gateway binding modes of the native product. */
export const DESKTOP_GATEWAY_MODES = ['embedded', 'remote'] as const;

/** One gateway binding mode. */
export type DesktopGatewayMode = (typeof DESKTOP_GATEWAY_MODES)[number];

/** The platform families the product packages for. */
export const DESKTOP_PLATFORMS = ['linux', 'windows', 'macos'] as const;

/** One packaged platform family. */
export type DesktopPlatform = (typeof DESKTOP_PLATFORMS)[number];

/**
 * The protocol compatibility envelope: the exact triple an update
 * candidate, persisted record, or host handshake must carry for the
 * product to OPEN it. Anything else is the typed
 * `contract-version-unsupported` refusal (never opened, never partially
 * applied) — see src/native/runtime/protocol-gate.ts.
 */
export interface DesktopProtocolEnvelope {
  readonly schemaVersion: number;
  readonly productVersion: string;
  readonly protocol: {
    readonly gatewayContract: string;
    readonly hostProtocol: string;
    readonly recordSchema: number;
  };
}

/** The protocol envelope of THIS build. */
export const DESKTOP_PROTOCOL_ENVELOPE: DesktopProtocolEnvelope = {
  schemaVersion: 1,
  productVersion: DESKTOP_PRODUCT_VERSION,
  protocol: {
    gatewayContract: DESKTOP_GATEWAY_CONTRACT_VERSION,
    hostProtocol: DESKTOP_HOST_PROTOCOL_VERSION,
    recordSchema: DESKTOP_RECORD_SCHEMA_VERSION,
  },
} as const;
