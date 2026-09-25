/**
 * Digest discipline + neutrality scans for AI-collaboration records.
 *
 * A record's identity at a revision is the SHA-256 of its content's
 * canonical JSON serialization (content addressing over the
 * runtime-neutral canonical machinery from @epoch/agent-protocol —
 * reused, never mirrored). Admission REJECTS a sealed envelope whose
 * claimed digest does not match the recomputed one (tamper detection).
 *
 * The neutrality scans enforce the two W015 laws over OPEN JSON payload
 * records (annotation data, filter criteria) where keys are
 * caller-chosen:
 * - the Dynamic UI law — executable UI code is rejected with a typed
 *   `executable-ui-rejected` error (agents emit typed intents, never
 *   arbitrary executable UI code);
 * - provider neutrality (lock rule 13) — vendor/provider fields are
 *   rejected with a typed `vendor-fields-rejected` error.
 */
import { canonicalDigest, canonicalJsonStringify, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  EXECUTABLE_FIELD_BLOCKLIST,
  EXECUTABLE_VALUE_PREFIXES,
  VENDOR_FIELD_BLOCKLIST,
} from './version';
import { AiCollaborationEventSchema, EngineeringMomentContentSchema } from './schema';
import { flattenZodIssues, validationError } from './issues';
import type {
  AiCollaborationEvent,
  AiCollaborationEventRecord,
  AiCollaborationEventRegistration,
  AiExperienceError,
  AiResult,
  EngineeringMomentContent,
  EngineeringMomentRecord,
} from './types';

/** One neutrality violation (dotted path + offending key). */
export interface NeutralityViolation {
  readonly path: string;
  readonly key: string;
}

const VENDOR_KEYS: ReadonlySet<string> = new Set(VENDOR_FIELD_BLOCKLIST);
const EXECUTABLE_KEYS: ReadonlySet<string> = new Set(EXECUTABLE_FIELD_BLOCKLIST);

function firstIssueMessage(issues: readonly { path: string; message: string }[]): string {
  const first = issues[0];
  return first ? `${first.path}: ${first.message}` : 'invalid';
}

// ---------------------------------------------------------------------------
// Neutrality scans (recursive over open JSON payloads).
// ---------------------------------------------------------------------------

function scanKeys(
  value: JsonValue,
  path: string,
  keyTest: (key: string) => boolean,
  violations: NeutralityViolation[],
): void {
  if (Array.isArray(value)) {
    value.forEach((element, index) =>
      scanKeys(element, `${path}[${index}]`, keyTest, violations),
    );
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value).sort()) {
      if (keyTest(key)) {
        violations.push({ path: path === '' ? key : `${path}.${key}`, key });
      }
      scanKeys(
        (value as Record<string, JsonValue>)[key] as JsonValue,
        path === '' ? key : `${path}.${key}`,
        keyTest,
        violations,
      );
    }
  }
}

function scanExecutableValues(value: JsonValue, path: string, violations: NeutralityViolation[]): void {
  if (typeof value === 'string') {
    const lowered = value.trimLeft().toLowerCase();
    for (const prefix of EXECUTABLE_VALUE_PREFIXES) {
      if (lowered.startsWith(prefix.toLowerCase())) {
        violations.push({ path, key: prefix });
        return;
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((element, index) =>
      scanExecutableValues(element, `${path}[${index}]`, violations),
    );
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value).sort()) {
      scanExecutableValues(
        (value as Record<string, JsonValue>)[key] as JsonValue,
        path === '' ? key : `${path}.${key}`,
        violations,
      );
    }
  }
}

/**
 * Scan an open JSON payload for EXECUTABLE UI code (the Dynamic UI law).
 * Returns every violation (dotted path + offending key/prefix). Pure and
 * total.
 */
export function scanExecutableUiViolations(payload: JsonValue): NeutralityViolation[] {
  const keyViolations: NeutralityViolation[] = [];
  scanKeys(payload, '', (key) => EXECUTABLE_KEYS.has(key), keyViolations);
  const valueViolations: NeutralityViolation[] = [];
  scanExecutableValues(payload, '', valueViolations);
  return [...keyViolations, ...valueViolations];
}

/**
 * Scan an open JSON payload for VENDOR/PROVIDER fields (lock rule 13).
 * Returns every violation (dotted path + offending key). Pure and total.
 */
export function scanVendorFieldViolations(payload: JsonValue): NeutralityViolation[] {
  const violations: NeutralityViolation[] = [];
  scanKeys(payload, '', (key) => VENDOR_KEYS.has(key), violations);
  return violations;
}

// ---------------------------------------------------------------------------
// Typed-event digest discipline.
// ---------------------------------------------------------------------------

/**
 * Content-addressed identity of a typed AI-collaboration event. Throws on
 * an invalid event — producers validate first ({@link sealAiEvent} is the
 * total form).
 */
export function computeAiEventDigest(event: AiCollaborationEvent): Sha256Hex {
  const parsed = AiCollaborationEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new Error(
      `cannot digest an invalid AI-collaboration event (${firstIssueMessage(flattenZodIssues(parsed.error))})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/** Seal a valid typed event into a creation envelope. Total. */
export function sealAiEvent(event: unknown): AiResult<AiCollaborationEventRegistration> {
  const parsed = AiCollaborationEventSchema.safeParse(event);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const intentFailure = intentNeutralityFailure(parsed.data.intent);
  if (intentFailure !== null) {
    return { ok: false, error: intentFailure };
  }
  return {
    ok: true,
    value: {
      event: parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/** Verify a claimed event digest (tamper detection). Total. */
export function verifyAiEventDigest(
  registration: AiCollaborationEventRegistration,
): AiResult<AiCollaborationEvent> {
  const parsed = AiCollaborationEventSchema.safeParse(registration.event);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const intentFailure = intentNeutralityFailure(parsed.data.intent);
  if (intentFailure !== null) {
    return { ok: false, error: intentFailure };
  }
  const expected = canonicalDigest(parsed.data as unknown as JsonValue);
  if (expected !== registration.digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'AI-collaboration event digest does not match its content (tampered or mismatched envelope) — the record is rejected',
        expected,
        encountered: registration.digest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The published record for a verified event. */
export function aiEventRecordFor(event: AiCollaborationEvent): AiCollaborationEventRecord {
  return {
    event,
    contentDigest: computeAiEventDigest(event),
  };
}

/** Serialize a typed event deterministically (canonical JSON). */
export function serializeAiEvent(event: AiCollaborationEvent): string {
  const parsed = AiCollaborationEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new Error(
      `cannot serialize an invalid AI-collaboration event (${firstIssueMessage(flattenZodIssues(parsed.error))})`,
    );
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

// ---------------------------------------------------------------------------
// Engineering-Moment digest discipline.
// ---------------------------------------------------------------------------

/**
 * Content-addressed identity of an Engineering Moment. Throws on an
 * invalid moment — producers validate first ({@link sealMoment} is the
 * total form).
 */
export function computeMomentDigest(moment: EngineeringMomentContent): Sha256Hex {
  const parsed = EngineeringMomentContentSchema.safeParse(moment);
  if (!parsed.success) {
    throw new Error(
      `cannot digest an invalid engineering moment (${firstIssueMessage(flattenZodIssues(parsed.error))})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/** Seal valid moment content into an Engineering Moment record. Total. */
export function sealMoment(content: unknown): AiResult<EngineeringMomentRecord> {
  const parsed = EngineeringMomentContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      moment: parsed.data,
      momentDigest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/** Verify a claimed moment digest (tamper detection). Total. */
export function verifyMomentDigest(record: EngineeringMomentRecord): AiResult<EngineeringMomentContent> {
  const parsed = EngineeringMomentContentSchema.safeParse(record.moment);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const expected = canonicalDigest(parsed.data as unknown as JsonValue);
  if (expected !== record.momentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'engineering moment digest does not match its content (tampered or mismatched record) — the moment is rejected',
        expected,
        encountered: record.momentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** Serialize an Engineering Moment deterministically (canonical JSON). */
export function serializeMoment(moment: EngineeringMomentContent): string {
  const parsed = EngineeringMomentContentSchema.safeParse(moment);
  if (!parsed.success) {
    throw new Error(
      `cannot serialize an invalid engineering moment (${firstIssueMessage(flattenZodIssues(parsed.error))})`,
    );
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

// ---------------------------------------------------------------------------
// Intent neutrality gate (shared by seal/admission paths).
// ---------------------------------------------------------------------------

/**
 * The Dynamic-UI-law and provider-neutrality gates over an intent's OPEN
 * payload data. Returns a typed error or null. Executable violations are
 * reported FIRST (the Dynamic UI law outranks provider neutrality in the
 * fixed precedence — the more safety-critical law is never masked).
 */
export function intentNeutralityFailure(
  intent: AiCollaborationEvent['intent'],
): AiExperienceError | null {
  if (intent === undefined) {
    return null;
  }
  if (intent.kind !== 'annotate' && intent.kind !== 'filter') {
    return null;
  }
  const payload: JsonValue | undefined =
    intent.kind === 'annotate' ? (intent.data as JsonValue | undefined) : (intent.criteria as JsonValue);
  if (payload === undefined || payload === null) {
    return null;
  }
  const executable = scanExecutableUiViolations(payload);
  if (executable.length > 0) {
    return {
      code: 'executable-ui-rejected',
      message:
        'intent payload carries executable UI code (keys or values) — agents emit typed intents, never arbitrary executable UI code',
      path: executable[0].path,
      key: executable[0].key,
    };
  }
  const vendor = scanVendorFieldViolations(payload);
  if (vendor.length > 0) {
    return {
      code: 'vendor-fields-rejected',
      message:
        'intent payload carries vendor/provider fields — provider semantics are forbidden in kernel-adjacent types (lock rule 13)',
      path: vendor[0].path,
      key: vendor[0].key,
    };
  }
  return null;
}
