/**
 * @epoch/desktop — the native product configuration (W048).
 *
 * How the product binds the Application Gateway:
 *  - `embedded` — the W046 single-process composition (the gateway +
 *    authorities in-process, seeded from the deterministic product
 *    fixtures for packaged local validation, dev-server mode, E2E and
 *    the journey runs);
 *  - `remote` — a deployed gateway endpoint (the envelope crosses the
 *    Tauri IPC seam; the Rust host forwards over HTTPS).
 *
 * The configuration is typed and validated at startup: an unknown mode
 * or a protocol-incompatible endpoint descriptor is a typed startup
 * refusal, never a silent fallback.
 */
import { DESKTOP_GATEWAY_MODES, type DesktopGatewayMode, type DesktopPlatform } from '../version';

/** The product configuration. */
export interface DesktopProductConfig {
  readonly schemaVersion: 1;
  readonly mode: DesktopGatewayMode;
  /** The deployed endpoint (remote mode only). */
  readonly endpoint?: string | undefined;
  /** The fixture domain the embedded gateway seeds (embedded mode only). */
  readonly fixtureDomain?: 'construction' | 'software' | undefined;
  /** The platform the product runs on (reported in journey records). */
  readonly platform?: DesktopPlatform | 'unknown' | undefined;
}

/** Parse + validate a product configuration (typed refusal on unknown shapes). */
export function parseDesktopProductConfig(value: unknown):
  | { readonly ok: true; readonly config: DesktopProductConfig }
  | { readonly ok: false; readonly message: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, message: 'the product configuration must be an object' };
  }
  const record = value as Record<string, unknown>;
  if (record['schemaVersion'] !== 1) {
    return { ok: false, message: 'the product configuration schemaVersion must be 1' };
  }
  const mode = record['mode'];
  if (typeof mode !== 'string' || !(DESKTOP_GATEWAY_MODES as readonly string[]).includes(mode)) {
    return { ok: false, message: `unknown gateway mode "${String(mode)}" (expected embedded or remote)` };
  }
  if (mode === 'remote' && (typeof record['endpoint'] !== 'string' || record['endpoint'] === '')) {
    return { ok: false, message: 'the remote gateway mode requires an endpoint' };
  }
  const fixtureDomain = record['fixtureDomain'];
  if (fixtureDomain !== undefined && fixtureDomain !== 'construction' && fixtureDomain !== 'software') {
    return { ok: false, message: `unknown fixture domain "${String(fixtureDomain)}"` };
  }
  return {
    ok: true,
    config: {
      schemaVersion: 1,
      mode: mode as DesktopGatewayMode,
      ...(typeof record['endpoint'] === 'string' ? { endpoint: record['endpoint'] } : {}),
      ...(fixtureDomain !== undefined ? { fixtureDomain: fixtureDomain as 'construction' | 'software' } : {}),
      ...(typeof record['platform'] === 'string' ? { platform: record['platform'] as DesktopPlatform | 'unknown' } : {}),
    },
  };
}

/** The default configuration (embedded fixture-backed local deployment). */
export const DEFAULT_PRODUCT_CONFIG: DesktopProductConfig = {
  schemaVersion: 1,
  mode: 'embedded',
  fixtureDomain: 'construction',
} as const;
