/**
 * @epoch/mobile — the deterministic field-session identity (W049).
 *
 * The W018 field session ids follow `field-session:<slug>`. The native
 * product derives a STABLE per-install identity from the correlation
 * prefix (no randomness — the same install derives the same field-session
 * id, so relaunch (J12) reopens the SAME capture channel and captures
 * chain coherently).
 */

/** The deterministic field-device identity of one app install. */
export interface FieldDeviceIdentity {
  /** The W018 field-session id of this install (`field-session:<slug>`). */
  readonly sessionId: string;
  /** A neutral label for the field surface (no vendor/device-product vocabulary). */
  readonly label: string;
}

/**
 * Derive the deterministic field-device identity from the install prefix
 * (the correlation prefix of the host). Same prefix -> same identity ->
 * same capture channel across relaunches.
 */
export function buildFieldDeviceIdentity(prefix: string): FieldDeviceIdentity {
  const slug = prefix.replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '') || 'field';
  return {
    sessionId: `field-session:${slug}-capture`,
    label: `Epoch field capture channel (${slug})`,
  };
}
