/**
 * @epoch/web — the production journey harness (W052, ACR-006).
 *
 * The reusable HTTP client + envelope builders for the P01-P18 production
 * journeys (spec/journey-validation.md) against a DEPLOYED Epoch web
 * application: every mutation/read flows through the public `/api/gateway`
 * envelope API, and sign-in flows through the product's identity boundary
 * (`/api/product/authenticate`) — exactly the calls the visible client
 * makes. The harness is a browser-equivalent caller over the public
 * surface, never a privileged probe: no kernel imports execute here, the
 * payload derivations are the SAME pure functions the client renders with
 * (`src/product/derivation.ts`), and the envelope builder is the client's
 * own (`src/client/envelopes.ts`).
 *
 * Configuration (environment):
 *  - `EPOCH_PRODUCTION_BASE_URL` (or `BASE_URL`): the deployment origin
 *    every journey targets (e.g. `https://<project>.vercel.app` or
 *    `http://127.0.0.1:3100` for a local production build). The suite
 *    skips itself when absent (the standard battery stays hermetic).
 *  - `EPOCH_HARNESS_IP_BUDGET`: when set, P17 (rate-limit behavior) runs
 *    and expects the deployment's IP budget to equal this value (start the
 *    target with `EPOCH_RATE_LIMIT_IP_REQUESTS_PER_WINDOW` set to the same
 *    tiny budget).
 *  - `EPOCH_HARNESS_TRACE`: when set, the machine-readable request journal
 *    is written to this path after the run (journey evidence).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GatewayOutcomeSchema } from '@epoch/client-runtime';
import type { GatewayError, GatewayOutcome, GatewayRequestEnvelope, JsonValue } from '@epoch/client-runtime';
import { envelope as clientEnvelope } from '../../src/client/envelopes';
import type { ProductConfiguration, ProductDomain, ProductSession } from '../../src/product/types';

/** The fixture domains of the public deployment (spec: ACR-006 product scope). */
export type HarnessDomain = ProductDomain;

/** The committed demo tenants (fixture identity → tenancy mapping). */
export const DOMAIN_TENANTS: Readonly<Record<HarnessDomain, string>> = {
  construction: 'tenant:nordstrand',
  software: 'tenant:lightspeed',
};

/** The lead principal of one domain (the fixture-committed authentication). */
export function leadPrincipalOf(domain: HarnessDomain): string {
  return domain === 'construction' ? 'principal:delivery-lead' : 'principal:tech-lead';
}

/** Resolve the deployment origin every journey targets (empty = skipped). */
export function harnessBaseUrl(): string {
  const explicit = process.env['EPOCH_PRODUCTION_BASE_URL'] ?? process.env['BASE_URL'] ?? '';
  return explicit.replace(/\/+$/, '');
}

/** The P17 gate: the deliberately-configured tiny IP budget (0 = disabled). */
export function harnessIpBudget(): number {
  const raw = process.env['EPOCH_HARNESS_IP_BUDGET'] ?? '';
  if (raw === '') return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 0;
}

/** Where the machine-readable trace is written (empty = nowhere). */
export function harnessTracePath(): string {
  return process.env['EPOCH_HARNESS_TRACE'] ?? '';
}

// ---------------------------------------------------------------------------
// The request journal (machine-readable journey evidence).
// ---------------------------------------------------------------------------

/** One recorded public-surface request. */
export interface JournalEntry {
  readonly at: string;
  readonly journey: string;
  readonly surface: string;
  readonly status: number;
  readonly ok: boolean;
  readonly correlationId: string;
  readonly replayed: boolean | null;
  readonly errorCode: string | null;
}

/** The shared journal (one entry per public-surface call). */
class RequestJournal {
  private readonly entries: JournalEntry[] = [];
  private journey = 'setup';

  enter(journey: string): void {
    this.journey = journey;
  }

  record(entry: Omit<JournalEntry, 'at' | 'journey'>): void {
    this.entries.push({ at: new Date().toISOString(), journey: this.journey, ...entry });
  }

  render(): { readonly baseUrl: string; readonly generatedAt: string; readonly entries: readonly JournalEntry[] } {
    return { baseUrl: harnessBaseUrl(), generatedAt: new Date().toISOString(), entries: [...this.entries] };
  }

  count(): number {
    return this.entries.length;
  }
}

export const journal = new RequestJournal();

// ---------------------------------------------------------------------------
// The committed registry anchors (digest expectations — the same evidence
// anchors the W047-W050 browser journeys assert against).
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/** The committed registry anchors of one fixture domain. */
export interface RegistryAnchors {
  readonly domain: HarnessDomain;
  readonly fixtureId: string;
  readonly worldDigest: string;
  readonly solutionContentDigest: string;
  readonly programContentDigest: string;
  readonly deliveryContentDigest: string;
  readonly evidenceDigest: string;
  readonly objectBytesDigest: string;
}

/** Load one domain's anchors from the committed fixture registry. */
export function anchorsOf(domain: HarnessDomain): RegistryAnchors {
  const registry = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'qa', 'fixtures', 'registry.json'), 'utf8'),
  ) as { domains: RegistryAnchors[] };
  const entry = registry.domains.find((candidate) => candidate.domain === domain);
  if (entry === undefined) throw new Error(`no registry anchors for ${domain}`);
  return entry;
}

// ---------------------------------------------------------------------------
// The public surface client (identity boundary + gateway transport).
// ---------------------------------------------------------------------------

/** One raw public-surface response (status + headers + parsed body). */
export interface RawResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly body: unknown;
}

async function postJson(url: string, payload: unknown, init?: { readonly rawBody?: string }): Promise<RawResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: init?.rawBody ?? JSON.stringify(payload),
    cache: 'no-store',
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    body = text;
  }
  return { status: response.status, headers: response.headers, body };
}

async function getJson(url: string): Promise<RawResponse> {
  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    body = text;
  }
  return { status: response.status, headers: response.headers, body };
}

function asErrorRecord(value: unknown): GatewayError | null {
  if (typeof value === 'object' && value !== null && 'error' in value) {
    const error = (value as { error: unknown }).error;
    if (typeof error === 'object' && error !== null && 'class' in error && 'code' in error) {
      return error as GatewayError;
    }
  }
  return null;
}

/** GET one public endpoint (raw; health/readiness probes). */
export async function getEndpoint(base: string, pathname: string): Promise<RawResponse> {
  const response = await getJson(`${base}${pathname}`);
  journal.record({
    surface: `GET ${pathname}`,
    status: response.status,
    ok: response.status < 400,
    correlationId: '—',
    replayed: null,
    errorCode: response.status >= 400 ? 'http-error' : null,
  });
  return response;
}

/**
 * POST one gateway envelope (raw): the transport-level view — HTTP status,
 * headers and the typed error envelope — for the journeys that assert on
 * transport behavior (P12 malformed input, P17 rate limit, P18 isolation).
 */
export async function postGatewayRaw(
  base: string,
  payload: unknown,
  meta?: { readonly surface?: string; readonly rawBody?: string },
): Promise<RawResponse> {
  // The typed view the journeys that assert on transport behavior need
  // (P12 malformed input, P17 rate limit, P18 isolation).
  const response = await postJson(`${base}/api/gateway`, payload, { rawBody: meta?.rawBody });
  const error = asErrorRecord(response.body);
  const okBody =
    typeof response.body === 'object' && response.body !== null ? (response.body as { ok?: boolean; value?: { replayed?: boolean } }) : null;
  journal.record({
    surface: meta?.surface ?? 'POST /api/gateway',
    status: response.status,
    ok: okBody !== null && okBody.ok === true,
    correlationId:
      typeof payload === 'object' && payload !== null && 'correlation' in payload
        ? String(((payload as { correlation?: { correlationId?: unknown } }).correlation ?? {}).correlationId ?? '—')
        : '—',
    replayed: okBody !== null && typeof okBody.value?.replayed === 'boolean' ? okBody.value.replayed : null,
    errorCode: error === null ? null : error.code,
  });
  return response;
}

/** The typed gateway call result (mirrors the client transport's parse). */
export type HarnessCallResult =
  | { readonly ok: true; readonly value: GatewayOutcome }
  | { readonly ok: false; readonly error: GatewayError };

function typedNetworkError(operation: string, correlationId: string): GatewayError {
  return {
    schemaVersion: 1,
    class: 'transient',
    code: 'network-unavailable',
    message: 'the gateway could not be reached (network unavailable)',
    operation,
    correlationId,
    retryable: true,
  } as GatewayError;
}

function typedMalformedError(operation: string, correlationId: string): GatewayError {
  return {
    schemaVersion: 1,
    class: 'unrecoverable',
    code: 'response-malformed',
    message: 'the gateway outcome failed schema validation',
    operation,
    correlationId,
    retryable: false,
  } as GatewayError;
}

/**
 * POST one gateway envelope and parse the result EXACTLY as the client
 * transport does: endpoint-level typed errors pass through; successful
 * outcomes must validate against the frozen `GatewayOutcomeSchema`
 * (schemaVersion, correlationId, 64-hex outcomeDigest, result, replayed).
 */
export async function callGateway(
  base: string,
  request: GatewayRequestEnvelope,
): Promise<HarnessCallResult> {
  let response: RawResponse;
  try {
    response = await postGatewayRaw(base, request, { surface: `POST /api/gateway (${request.operation})` });
  } catch {
    return { ok: false, error: typedNetworkError(request.operation, request.correlation.correlationId) };
  }
  if (response.status >= 400) {
    const error = asErrorRecord(response.body);
    if (error !== null) return { ok: false, error };
  }
  const body = typeof response.body === 'object' && response.body !== null
    ? (response.body as { ok?: boolean; value?: unknown })
    : null;
  if (body !== null && body.ok === true) {
    const parsed = GatewayOutcomeSchema.safeParse(body.value);
    if (parsed.success) return { ok: true, value: parsed.data as GatewayOutcome };
    return { ok: false, error: typedMalformedError(request.operation, request.correlation.correlationId) };
  }
  const error = asErrorRecord(response.body);
  if (error !== null) return { ok: false, error };
  return { ok: false, error: typedMalformedError(request.operation, request.correlation.correlationId) };
}

/** The harness envelope builder: the client's own builder, verbatim. */
export function envelopeOf(
  operation: GatewayRequestEnvelope['operation'],
  session: Pick<ProductSession, 'sessionId' | 'tenantId'>,
  payload: JsonValue,
  options?: { readonly correlation?: string | undefined; readonly idempotencyKey?: string | undefined },
): GatewayRequestEnvelope {
  return clientEnvelope(operation, session, payload, options);
}

// ---------------------------------------------------------------------------
// The identity boundary + session lifecycle (the sign-in the client does).
// ---------------------------------------------------------------------------

/** One signed-in session (a reference, never authority). */
export interface HarnessSession {
  readonly domain: HarnessDomain;
  readonly tenantId: string;
  readonly principalId: string;
  readonly sessionId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

/** The identity boundary: POST /api/product/authenticate (fixture IdP). */
export async function authenticate(
  base: string,
  domain: HarnessDomain,
  principalId: string,
): Promise<{
  readonly ok: boolean;
  readonly status: number;
  readonly tenantId?: string;
  readonly authentication?: Record<string, unknown>;
  readonly error?: string;
}> {
  const response = await postJson(`${base}/api/product/authenticate`, { domain, principalId });
  journal.record({
    surface: 'POST /api/product/authenticate',
    status: response.status,
    ok: typeof response.body === 'object' && response.body !== null && (response.body as { ok?: boolean }).ok === true,
    correlationId: '—',
    replayed: null,
    errorCode: null,
  });
  const body = (response.body ?? {}) as {
    ok?: boolean;
    tenantId?: string;
    authentication?: Record<string, unknown>;
    error?: string;
  };
  return {
    ok: body.ok === true,
    status: response.status,
    tenantId: body.tenantId,
    authentication: body.authentication,
    error: body.error,
  };
}

/**
 * Sign in through the public surface exactly as the visible client does:
 * the identity boundary mints the verified authentication result, then the
 * session is issued through the gateway (`session.issue`).
 */
export async function signIn(
  base: string,
  domain: HarnessDomain,
  principalId: string,
  options?: { readonly ttlMs?: number },
): Promise<HarnessSession> {
  const identity = await authenticate(base, domain, principalId);
  if (!identity.ok || identity.tenantId === undefined || identity.authentication === undefined) {
    throw new Error(`authenticate failed for ${domain}/${principalId}: ${identity.error ?? identity.status}`);
  }
  const result = await callGateway(
    base,
    envelopeOf('session.issue', { sessionId: 'session:bootstrap', tenantId: identity.tenantId }, {
      authentication: identity.authentication as never,
      principalId,
      tenantId: identity.tenantId,
      ttlMs: options?.ttlMs ?? 3_600_000,
      nonce: `nonce-harness-${domain}-${Date.now().toString(36)}`,
    }),
  );
  if (!result.ok) throw new Error(`session.issue failed: ${JSON.stringify(result.error)}`);
  const issued = result.value.result as {
    sessionId: string;
    principalId: string;
    tenantId: string;
    issuedAt: string;
    expiresAt: string;
  };
  return {
    domain,
    tenantId: issued.tenantId,
    principalId: issued.principalId,
    sessionId: issued.sessionId,
    issuedAt: issued.issuedAt,
    expiresAt: issued.expiresAt,
  };
}

/** The project bootstrap: POST /api/product/bootstrap (session-gated config). */
export async function bootstrap(
  base: string,
  session: HarnessSession,
): Promise<ProductConfiguration> {
  const response = await postJson(`${base}/api/product/bootstrap`, {
    domain: session.domain,
    sessionId: session.sessionId,
  });
  journal.record({
    surface: 'POST /api/product/bootstrap',
    status: response.status,
    ok: typeof response.body === 'object' && response.body !== null && (response.body as { ok?: boolean }).ok === true,
    correlationId: '—',
    replayed: null,
    errorCode: response.status === 401 ? 'auth-session-expired' : null,
  });
  const body = (response.body ?? {}) as { ok?: boolean; configuration?: ProductConfiguration; error?: string };
  if (body.ok !== true || body.configuration === undefined) {
    throw new Error(`bootstrap failed (${response.status}): ${body.error ?? 'unknown'}`);
  }
  return body.configuration;
}

/** A helper for projecting a gateway result as a record. */
export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error('expected a JSON object');
}
