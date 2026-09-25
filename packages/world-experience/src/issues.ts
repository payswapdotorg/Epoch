/**
 * Typed-error construction helpers (the W011/W013 issues precedent):
 * deterministic message strings and flattened zod issue paths so every
 * admission failure is a typed record with precise diagnostics.
 */
import type { z } from 'zod';
import type { WorldIssue, WorldExperienceError } from './errors';

/** Flatten a zod failure into the typed issue list (dotted paths). */
export function flattenZodIssues(error: z.ZodError): WorldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/** The malformed-record error of a zod failure. */
export function malformedRecordError(
  error: z.ZodError,
): Extract<WorldExperienceError, { readonly code: 'malformed-record' }> {
  const issues = flattenZodIssues(error);
  const first = issues[0];
  const detail = first ? ` (${first.path}: ${first.message})` : '';
  return {
    code: 'malformed-record',
    message: `the world document failed schema admission${detail}`,
    issues,
  };
}

/** The malformed-record error of an ad-hoc issue list. */
export function malformedRecord(issues: readonly WorldIssue[]): WorldExperienceError {
  const first = issues[0];
  const detail = first ? ` (${first.path}: ${first.message})` : '';
  return {
    code: 'malformed-record',
    message: `the world document failed schema admission${detail}`,
    issues: [...issues],
  };
}

/** The root-shape malformed-record error. */
export function rootShapeError(): WorldExperienceError {
  return {
    code: 'malformed-record',
    message: 'world document root must be a JSON object',
    issues: [{ path: '$', message: 'expected a JSON object at the document root' }],
  };
}

/** The version-unsupported error. */
export function versionUnsupportedError(expected: string, encountered: string): WorldExperienceError {
  return {
    code: 'version-unsupported',
    message: `protocol version mismatch: expected ${expected}, encountered ${encountered}`,
    expected,
    encountered,
  };
}

/** The cross-tenant-denied error (R12). */
export function crossTenantDeniedError(
  path: readonly (string | number)[],
  expectedTenantId: string,
  encounteredTenantId: string,
): WorldExperienceError {
  return {
    code: 'cross-tenant-denied',
    message: `cross-tenant world operation denied: expected tenant "${expectedTenantId}", encountered "${encounteredTenantId}"`,
    path: [...path],
    expectedTenantId,
    encounteredTenantId,
  };
}

/** The unknown-scene-reference error. */
export function unknownSceneReferenceError(
  path: readonly (string | number)[],
  encountered: string,
): WorldExperienceError {
  return {
    code: 'unknown-scene-reference',
    message: `the referenced scene content "${encountered}" does not resolve within the scene`,
    path: [...path],
    encountered,
  };
}

/** The invalid-intent error of an ad-hoc issue list. */
export function invalidIntentError(issues: readonly WorldIssue[]): WorldExperienceError {
  const first = issues[0];
  const detail = first ? ` (${first.path}: ${first.message})` : '';
  return {
    code: 'invalid-intent',
    message: `the interaction intent failed admission${detail}`,
    issues: [...issues],
  };
}

/** The unknown-overlay-reference error. */
export function unknownOverlayReferenceError(
  overlayId: string,
  path: readonly (string | number)[] = ['overlays'],
): WorldExperienceError {
  return {
    code: 'unknown-overlay-reference',
    message: `the applied overlay "${overlayId}" is not declared in the scene's overlay library`,
    path: [...path],
    overlayId,
  };
}

/** The unknown-ontology-record error (unresolvable id or unknown discriminator). */
export function unknownOntologyRecordError(
  message: string,
  options: {
    readonly path?: readonly (string | number)[];
    readonly recordId?: string;
    readonly discriminator?: string;
  } = {},
): WorldExperienceError {
  return {
    code: 'unknown-ontology-record',
    message,
    path: [...(options.path ?? ['ontology'])],
    ...(options.recordId !== undefined ? { recordId: options.recordId } : {}),
    ...(options.discriminator !== undefined ? { discriminator: options.discriminator } : {}),
  };
}

/** The budget-exceeded error. */
export function budgetExceededError(
  path: readonly (string | number)[],
  resource: 'graph-edges' | 'graph-nodes' | 'texture-bytes' | 'triangles',
  limit: number,
  encountered: number,
): WorldExperienceError {
  return {
    code: 'budget-exceeded',
    message: `usage of ${resource} (${encountered}) exceeds the renderer budget (${limit}) — the compilation is rejected`,
    path: [...path],
    resource,
    limit,
    encountered,
  };
}

/** The executable-ui-rejected error (the Dynamic UI law). */
export function executableUiRejectedError(
  offendingKey: string,
  path: readonly (string | number)[],
): WorldExperienceError {
  return {
    code: 'executable-ui-rejected',
    message:
      `the intent carries executable UI content ("${offendingKey}") — agents emit typed intents, ` +
      'never arbitrary executable UI code',
    path: [...path],
    offendingKey,
  };
}

/** The invalid-replay-position error. */
export function invalidReplayPositionError(
  message: string,
  options: {
    readonly path?: readonly (string | number)[];
    readonly boundMs?: number;
    readonly encounteredMs?: number;
  } = {},
): WorldExperienceError {
  return {
    code: 'invalid-replay-position',
    message,
    path: [...(options.path ?? ['timeline', 'position'])],
    ...(options.boundMs !== undefined ? { boundMs: options.boundMs } : {}),
    ...(options.encounteredMs !== undefined ? { encounteredMs: options.encounteredMs } : {}),
  };
}

/** The unknown-evidence-reference error. */
export function unknownEvidenceReferenceError(
  evidenceDigest: string,
  path: readonly (string | number)[],
): WorldExperienceError {
  return {
    code: 'unknown-evidence-reference',
    message: `the referenced evidence record "${evidenceDigest}" is not declared in the scene's evidence set`,
    path: [...path],
    evidenceDigest,
  };
}

/** The digest-mismatch error (tamper detection). */
export function digestMismatchError(
  path: readonly (string | number)[],
  expected: string,
  encountered: string,
): WorldExperienceError {
  return {
    code: 'digest-mismatch',
    message:
      'the claimed digest does not match the recomputed content digest (tampered or mismatched document) — the document is rejected',
    path: [...path],
    expected,
    encountered,
  };
}
