/**
 * Provider-neutral zod primitives shared by the Epoch agent and action
 * protocols. Every schema here is a JSON-representable data shape; no field
 * encodes a specific vendor, framework, or model.
 */
import { z } from 'zod';
import type { JsonValue } from './canonical';

/**
 * UTC instant in the single canonical wire form `YYYY-MM-DDTHH:MM:SS.mmmZ`
 * (exactly three fractional digits, `Z` suffix). One canonical form keeps
 * digests stable; a semantic refinement rejects impossible calendar instants.
 */
export const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isRealCalendarInstant(value: string): boolean {
  // `Date.parse` is lenient about day-of-month overflow in ECMAScript
  // implementations (Feb 30 rolls over), so validate the calendar directly.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d{3}Z$/.exec(value);
  if (match === null) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]!) return false;
  return hour <= 23 && minute <= 59 && second <= 59;
}

export const TimestampSchema = z
  .string()
  .regex(TIMESTAMP_PATTERN)
  .refine(
    isRealCalendarInstant,
    'must denote a real UTC calendar instant (YYYY-MM-DDTHH:MM:SS.mmmZ)',
  )
  .meta({
    id: 'Timestamp',
    title: 'Timestamp',
    description:
      'UTC instant in canonical form YYYY-MM-DDTHH:MM:SS.mmmZ (exactly three fractional digits, Z suffix).',
  });

export type Timestamp = z.infer<typeof TimestampSchema>;

/** Opaque message identifier (for evidence addressing); UUIDs fit. */
export const MESSAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export const MessageIdSchema = z.string().regex(MESSAGE_ID_PATTERN).meta({
  id: 'MessageId',
  title: 'MessageId',
  description: 'Opaque message identifier, unique within the emitting scope.',
});

export type MessageId = z.infer<typeof MessageIdSchema>;

/** Registered agent identifier: `agent:` + lowercase kebab slug. */
export const AGENT_ID_PATTERN = /^agent:[a-z0-9][a-z0-9-]{0,62}$/;
export const AgentIdSchema = z.string().regex(AGENT_ID_PATTERN).meta({
  id: 'AgentId',
  title: 'AgentId',
  description: 'Registered agent identifier: "agent:" followed by a lowercase slug.',
});

export type AgentId = z.infer<typeof AgentIdSchema>;

/** Lowercase kebab slug (domains, artifact kinds). */
export const SLUG_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

/**
 * Dot-namespaced qualified name for protocol-defined types (capability ids,
 * action type ids): at least two segments, e.g. `engineering.stress-analysis`
 * or `world.entity.update`.
 */
export const QUALIFIED_NAME_PATTERN = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

/** Semantic-version core (no prerelease/build suffixes) as a string. */
export const SEMVER_CORE_PATTERN = /^\d+\.\d+\.\d+$/;

/** Parameter name (capability inputs/outputs, action parameters). */
export const PARAMETER_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;

/** ISO 4217 currency code. */
export const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;

/** Non-negative decimal amount as a string (no exponent; canonical-friendly). */
export const NON_NEGATIVE_DECIMAL_PATTERN = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;

/**
 * Reference to a protocol-defined, versioned type (a capability an agent
 * offers, or an action type an agent proposes). Provider-neutral: the id
 * names a protocol-registered type, never a vendor product.
 */
export const QualifiedTypeReferenceSchema = z
  .strictObject({
    id: z.string().regex(QUALIFIED_NAME_PATTERN),
    version: z.string().regex(SEMVER_CORE_PATTERN),
  })
  .meta({
    id: 'QualifiedTypeReference',
    title: 'QualifiedTypeReference',
    description:
      'Reference to a versioned, protocol-defined type: dot-namespaced id plus semver core version.',
  });

export type QualifiedTypeReference = z.infer<typeof QualifiedTypeReferenceSchema>;

/**
 * Arbitrary JSON value admitted inside protocol payloads (e.g. action
 * parameters). Recursive; finite numbers only. The canonical serializer
 * makes record key order irrelevant to the digest.
 */
export const JsonValueSchema: z.ZodType<JsonValue> = z
  .lazy(() =>
    z.union([
      z.null(),
      z.boolean(),
      z.number(),
      z.string(),
      z.array(JsonValueSchema),
      z.record(z.string(), JsonValueSchema),
    ]),
  )
  .meta({
    id: 'JsonValue',
    title: 'JsonValue',
    description: 'JSON-representable value (finite numbers only).',
  });
