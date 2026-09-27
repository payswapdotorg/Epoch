/**
 * Neutral zod primitives of the desktop shell.
 *
 * Every schema here is a JSON-representable data shape; no field encodes a
 * vendor, engine, renderer, framework, or native-toolkit surface
 * (architecture lock rule 13). Digest machinery (SHA-256, canonical JSON)
 * and shared protocol primitives (message ids, qualified names, semver
 * cores) are REUSED from @epoch/agent-protocol — the pinned runtime
 * dependency — never re-implemented. Renderer/device-session id grammars
 * are REUSED from @epoch/renderer-runtime (the W013 vocabulary the shell
 * drives), so derived ids are always lawful W013 identifiers.
 */
import { z } from 'zod';
import { MessageIdSchema, JsonValueSchema } from '@epoch/agent-protocol';
import {
  DeviceSessionIdSchema,
  RendererSessionIdSchema,
} from '@epoch/renderer-runtime';
import { OpaqueScopeIdSchema, Sha256HexSchema, TenantScopeSchema } from '@epoch/experience-protocol';
import { DesktopProtocolVersionSchema, DesktopRecordVersionSchema, PRINCIPAL_ID_PATTERN } from './version';

/** Re-exported shared primitives (canonical homes: agent/experience protocol). */
export { JsonValueSchema, MessageIdSchema, Sha256HexSchema, TenantScopeSchema, OpaqueScopeIdSchema };

/** Re-exported W013 session-id schemas (derived ids must be lawful W013 identifiers). */
export { DeviceSessionIdSchema, RendererSessionIdSchema };

/** The canonical form of a SHA-256 digest (lowercase hex, 64 chars). */
export type Sha256Hex = string;

/** The canonical tenant-scope record (W011 vocabulary, reused verbatim). */
export type TenantScope = {
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
};

/** JSON-representable value space (reused from the agent protocol). */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * Desktop-window identifier: `win-` + lowercase kebab slug. Window-local
 * identity within one shell session.
 */
export const WINDOW_ID_PATTERN = /^win-[a-z0-9][a-z0-9-]{0,62}$/;

export const WindowIdSchema = z.string().regex(WINDOW_ID_PATTERN).meta({
  id: 'DesktopWindowId',
  title: 'DesktopWindowId',
  description: 'Desktop-window identifier: "win-" followed by a lowercase slug.',
});

/** One desktop-window identifier. */
export type WindowId = z.infer<typeof WindowIdSchema>;

/**
 * Desktop-shell-session identifier: `dss-` + lowercase kebab slug
 * (distinct from the W013 device-session `ds-` grammar).
 */
export const DESKTOP_SESSION_ID_PATTERN = /^dss-[a-z0-9][a-z0-9-]{0,62}$/;

export const DesktopSessionIdSchema = z.string().regex(DESKTOP_SESSION_ID_PATTERN).meta({
  id: 'DesktopSessionId',
  title: 'DesktopSessionId',
  description: 'Desktop-shell-session identifier: "dss-" followed by a lowercase slug.',
});

/** One desktop-shell-session identifier. */
export type DesktopSessionId = z.infer<typeof DesktopSessionIdSchema>;

/**
 * Host↔shell envelope identifier: `env-` + lowercase kebab slug. Envelope
 * identity is caller-supplied and unique per channel.
 */
export const ENVELOPE_ID_PATTERN = /^env-[a-z0-9][a-z0-9-]{0,62}$/;

export const EnvelopeIdSchema = z.string().regex(ENVELOPE_ID_PATTERN).meta({
  id: 'DesktopEnvelopeId',
  title: 'DesktopEnvelopeId',
  description: 'Host↔shell envelope identifier: "env-" followed by a lowercase slug.',
});

/** One envelope identifier. */
export type EnvelopeId = z.infer<typeof EnvelopeIdSchema>;

/** Opaque operator/principal identity `principal:<slug>` (identity mirror). */
export const PrincipalIdSchema = z.string().regex(PRINCIPAL_ID_PATTERN).meta({
  id: 'DesktopPrincipalId',
  title: 'DesktopPrincipalId',
  description: 'Opaque principal identity "principal:<slug>" (mirrors the identity vocabulary).',
});

/** One principal identifier (mirror). */
export type PrincipalId = z.infer<typeof PrincipalIdSchema>;

/** Virtual time: non-negative integer milliseconds (zero wall-clock in src). */
export const VirtualTimeMsSchema = z.number().int().nonnegative().meta({
  id: 'DesktopVirtualTimeMs',
  title: 'DesktopVirtualTimeMs',
  description: 'Virtual time in non-negative integer milliseconds (caller-supplied; never a wall clock).',
});

/** One virtual timestamp. */
export type VirtualTimeMs = z.infer<typeof VirtualTimeMsSchema>;

/** Envelope sequence number: positive integer, monotonic per channel. */
export const SequenceNumberSchema = z.number().int().positive().meta({
  id: 'DesktopSequenceNumber',
  title: 'DesktopSequenceNumber',
  description: 'Monotonic positive-integer sequence number of one seam channel.',
});

/** One sequence number. */
export type SequenceNumber = z.infer<typeof SequenceNumberSchema>;

/** Typed window bounds (presentation data; neutral, bounded). */
export const WindowBoundsSchema = z
  .strictObject({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive().max(32768),
    height: z.number().int().positive().max(32768),
  })
  .meta({
    id: 'DesktopWindowBounds',
    title: 'DesktopWindowBounds',
    description: 'Typed window bounds: non-negative origin and bounded positive extents (presentation data only).',
  });

/** One window-bounds record. */
export type WindowBounds = z.infer<typeof WindowBoundsSchema>;

/** Typed provenance record (carried by every projected artifact). */
export const ProvenanceSchema = z
  .strictObject({
    origin: z.enum([
      'host-envelope',
      'shell-surface',
      'desktop-authoring-surface',
      'desktop-shell',
      'reference-host',
    ]),
    /** The envelope that produced this artifact, when applicable. */
    envelopeId: EnvelopeIdSchema.optional(),
    /** A free-form-but-bounded note (never authority). */
    note: z.string().max(512).optional(),
  })
  .meta({
    id: 'DesktopProvenance',
    title: 'DesktopProvenance',
    description: 'Typed provenance of a desktop-shell artifact: origin, originating envelope, optional note.',
  });

/** One provenance record. */
export type Provenance = z.infer<typeof ProvenanceSchema>;

/** Protocol-version + record-version check helpers shared by admissions. */
export const ProtocolVersionField = DesktopProtocolVersionSchema;
export const RecordVersionField = DesktopRecordVersionSchema;

/**
 * The action-type reference shape — REUSED verbatim from the W011
 * control-intent vocabulary (R30: shape-identical to the action-protocol
 * `ActionTypeReference`, so proposal wiring through the Action Gateway
 * needs no translation layer). Pinned structurally by the parity test.
 */
export { ControlIntentSchema as ActionTypeReferenceSchema } from '@epoch/experience-protocol';
export type { ControlIntent as ActionTypeReference } from '@epoch/experience-protocol';
