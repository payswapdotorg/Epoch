/**
 * @epoch/authentication — digest discipline (canonical SHA-256 content
 * addressing + tamper detection) and deterministic session-id derivation.
 */
import {
  canonicalDigest,
  canonicalJsonStringify,
  sha256Hex,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import type { SessionResult } from './version';
import type { SessionContent, SessionRecord, SessionRegistration } from './types';
import { SessionContentSchema } from './schema';
import { zodIssues } from './issues';


/** Compute the content digest of a validated session content. */
export function computeSessionDigest(content: SessionContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Build the published record for a validated content. */
export function sessionRecordFor(content: SessionContent): SessionRecord {
  return {
    schemaVersion: 1,
    session: content,
    lifecycle: 'active',
    sessionDigest: computeSessionDigest(content),
    lifecycleChangedAt: null,
  };
}

/**
 * Seal unvalidated content into a registration envelope (validates
 * strictly; computes the digest). The total, never-throwing form.
 */
export function sealSession(content: unknown): SessionResult<SessionRegistration> {
  const parsed = SessionContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'the session content failed schema validation', issues: zodIssues(parsed.error) } };
  }
  return { ok: true, value: { session: parsed.data, digest: computeSessionDigest(parsed.data) } };
}

/** Verify a registration envelope (recompute + compare the digest). */
export function verifySessionDigest(registration: SessionRegistration): SessionResult<SessionContent> {
  const parsed = SessionContentSchema.safeParse(registration.session);
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'the session content failed schema validation', issues: zodIssues(parsed.error) } };
  }
  const recomputed = computeSessionDigest(parsed.data);
  if (recomputed !== registration.digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'the claimed session digest does not match the content (tamper detection)',
        sessionId: parsed.data.sessionId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** Verify a published record (recompute the content digest). */
export function verifySessionRecord(record: SessionRecord): SessionResult<SessionRecord> {
  const recomputed = computeSessionDigest(record.session);
  if (recomputed !== record.sessionDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'the record digest does not match its content (tamper detection)',
        sessionId: record.session.sessionId,
      },
    };
  }
  return { ok: true, value: record };
}

/** Deterministic canonical-JSON form (byte-stable serialization). */
export function canonicalSessionJson(content: SessionContent): string {
  return canonicalJsonStringify(content as unknown as JsonValue);
}

/**
 * Derive a content-addressed session id from caller-supplied seed
 * material: `session:` + the first 16 hex chars of the seed digest.
 * Deterministic: identical seeds derive identical ids; the kernel
 * contributes zero randomness (the CALLER supplies entropy via the seed).
 */
export function deriveSessionId(seed: {
  readonly principalId: string;
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
  readonly authenticationResultId: string;
  readonly issuedAt: string;
  readonly nonce: string;
}): string {
  const material: JsonValue = {
    principalId: seed.principalId,
    tenantId: seed.tenantId,
    ...(seed.workspaceId !== undefined ? { workspaceId: seed.workspaceId } : {}),
    authenticationResultId: seed.authenticationResultId,
    issuedAt: seed.issuedAt,
    nonce: seed.nonce,
  };
  return `session:${sha256Hex(canonicalJsonStringify(material)).slice(0, 16)}`;
}

