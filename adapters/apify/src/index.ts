/**
 * @epoch/adapter-apify — the Apify acquisition adapter (W054, ACR-006).
 *
 * The EXTERNAL-SOURCE implementation of the FROZEN W045
 * `DiscoverySourceAdapter` contract (packages/capability-discovery/src/
 * adapters.ts — the only external-acquisition seam, architecture lock
 * rule 13: Apify is one adapter, never a kernel dependency).
 *
 * Fetch-ahead pattern (the contract's `scan()` is SYNCHRONOUS):
 * an EXPLICIT, caller-invoked `refresh(now)` runs the PINNED actor
 * (EPOCH_APIFY_ACTOR_ID) over the Apify REST API
 * `POST /v2/acts/{actorId}/run-sync-get-dataset-items?token=…&timeout=30`,
 * maps the dataset items to provider-neutral {@link SourceArtifact}
 * records and caches them; `scan(query)` then filters/matches the cache
 * synchronously with the StaticCatalogSourceAdapter reference semantics.
 * NO timers, NO cron, NO wall-clock — every instant is caller-supplied;
 * the platform `setTimeout` appears ONLY as the per-request abort
 * deadline (the W051 adapter convention).
 *
 * Untrusted-input discipline (ACR-006): Apify output is UNTRUSTED adapter
 * input. Dataset items are mapped through a strict whitelist (only
 * summary / claimedCapabilities / licenseNote / environmentNotes are
 * read); digests are COMPUTED HERE over the raw item (never trusted from
 * the payload); artifact ids are derived from the item digest; every
 * artifact carries FULL run provenance. Artifacts are CANDIDATE
 * OBSERVATIONS ONLY — they enter the discovery plane through the kernel
 * ingestion boundary (`ingestExternalCandidate`), which forces state
 * `discovered`, trust domain `external` and claim basis `declared`.
 * There is structurally NO path from this adapter to authoritative
 * registry/semantic state (verified by negative test).
 *
 * Quota guard (spec/free-tier-infrastructure.md): a deterministic
 * per-day run counter (EPOCH_APIFY_MAX_RUNS_PER_DAY, default 1) over the
 * epoch-day window (dayIndex = floor(nowEpochMs / 86_400_000) — the W051
 * fixed-window pattern). In-memory PER INSTANCE by design: it is a COST
 * GUARD, not a security boundary (documented in README + the acquisition
 * ops guide). A refresh ATTEMPT consumes quota even when the provider
 * fails — deliberately conservative: a timed-out request may still have
 * consumed provider compute, and no retry can ever exceed the daily cap.
 *
 * Failure semantics (spec/production-environment.md): 401/402/404/429,
 * timeouts, network errors and malformed payloads are TYPED values
 * (`ApifyAcquisitionError`) — never raw provider errors, never thrown.
 * A failed refresh degrades THIS RUN (the cache is left untouched — no
 * partial mutation); the product never depends on it (graceful
 * degradation is composed by the production trigger,
 * services/capability-discovery/src/production.ts).
 *
 * ZERO new dependencies: the platform fetch (injectable for test
 * doubles) + the frozen kernel contract types/validators.
 */
import {
  contentDigest,
  digestSuffix16,
  schemas,
  timestampToEpochMs,
  type ClaimBasis,
  type DiscoverySourceAdapter,
  type DiscoverySourceKind,
  type OperationRef,
  type QualityTarget,
  type RepresentationKind,
  type SourceArtifact,
  type SourceScanQuery,
  type SourceScanResult,
  type Timestamp,
} from '@epoch/capability-discovery';

/** The adapter contract version (the frozen W045 seam it implements). */
export const APIFY_ADAPTER_VERSION = '1.0.0' as const;

/** Default per-day acquisition run cap (spec/production-environment.md). */
export const DEFAULT_APIFY_MAX_RUNS_PER_DAY = 1;

/** Default provider-side run-sync cap (seconds, the pinned URL param). */
export const DEFAULT_APIFY_RUN_SYNC_TIMEOUT_SECONDS = 30;

/** Default client-side abort deadline (run-sync cap + transport margin). */
export const DEFAULT_APIFY_TIMEOUT_MS = 35_000;

/** The Apify REST API base (overridable for doubles; the production pin). */
export const APIFY_API_BASE_URL = 'https://api.apify.com/v2';

/** The injectable fetch port (the driver seam — tests substitute doubles). */
export type FetchLike = typeof fetch;

// ---------------------------------------------------------------------------
// Typed failure semantics (errors are values, never exceptions).
// ---------------------------------------------------------------------------

/** The closed acquisition failure vocabulary (the adapter's own seam). */
export const APIFY_ACQUISITION_ERROR_CODES = [
  'validation',
  'unauthorized',
  'payment-required',
  'not-found',
  'rate-limited',
  'timeout',
  'malformed-response',
  'unavailable',
  'quota-exceeded',
] as const;
export type ApifyAcquisitionErrorCode = (typeof APIFY_ACQUISITION_ERROR_CODES)[number];

/** One typed acquisition failure (never a raw provider error). */
export interface ApifyAcquisitionError {
  readonly code: ApifyAcquisitionErrorCode;
  readonly message: string;
}

/** The total result shape every adapter operation returns. */
export type ApifyResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApifyAcquisitionError };

function apifyFail<T>(code: ApifyAcquisitionErrorCode, message: string): ApifyResult<T> {
  return { ok: false, error: { code, message } };
}

// ---------------------------------------------------------------------------
// The deterministic per-day quota guard (the cost guardrail).
// ---------------------------------------------------------------------------

/** Milliseconds in one day (the epoch-day window width). */
const DAY_MS = 86_400_000;

/** The per-day quota view (deterministic; derived from caller-supplied instants). */
export interface ApifyQuotaStatus {
  readonly maxRunsPerDay: number;
  readonly dayIndex: number;
  readonly runsUsed: number;
  readonly runsRemaining: number;
  /** Inclusive window start (epoch ms). */
  readonly windowStartEpochMs: number;
  /** The instant the counter resets (exclusive window end, epoch ms). */
  readonly resetsAtEpochMs: number;
}

/**
 * The per-day run counter (epoch-day window, the W051 fixed-window
 * pattern). IN-MEMORY PER INSTANCE by design: a COST GUARD, not a
 * security boundary — see README (acquisition ops guide,
 * docs/operations/acquisition.md). Deterministic: identical instants
 * derive identical statuses; zero wall-clock (instants are supplied by
 * the caller).
 */
export class ApifyDailyRunQuota {
  private dayIndex: number | null = null;
  private runsUsed = 0;

  constructor(readonly maxRunsPerDay: number) {
    if (!Number.isInteger(maxRunsPerDay) || maxRunsPerDay < 1) {
      throw new Error(`ApifyDailyRunQuota: maxRunsPerDay must be an integer >= 1 (got ${maxRunsPerDay})`);
    }
  }

  /** The current quota view at `nowEpochMs` (pure — never mutates). */
  status(nowEpochMs: number): ApifyQuotaStatus {
    const dayIndex = Math.floor(nowEpochMs / DAY_MS);
    const currentDay = this.dayIndex === dayIndex ? this.runsUsed : 0;
    return {
      maxRunsPerDay: this.maxRunsPerDay,
      dayIndex,
      runsUsed: currentDay,
      runsRemaining: Math.max(0, this.maxRunsPerDay - currentDay),
      windowStartEpochMs: dayIndex * DAY_MS,
      resetsAtEpochMs: (dayIndex + 1) * DAY_MS,
    };
  }

  /**
   * Consume one run slot for the epoch-day of `nowEpochMs`. Beyond the
   * cap this is the typed `quota-exceeded` failure and NO slot is taken
   * (the guard refuses before any provider request is issued).
   */
  consume(nowEpochMs: number): ApifyResult<ApifyQuotaStatus> {
    const dayIndex = Math.floor(nowEpochMs / DAY_MS);
    if (this.dayIndex !== dayIndex) {
      // A new epoch-day window: the counter resets deterministically.
      this.dayIndex = dayIndex;
      this.runsUsed = 0;
    }
    if (this.runsUsed >= this.maxRunsPerDay) {
      const status = this.status(nowEpochMs);
      return apifyFail(
        'quota-exceeded',
        `acquisition run cap for epoch-day ${dayIndex} reached (${this.runsUsed}/${this.maxRunsPerDay}); ` +
          `the counter resets at epoch-ms ${status.resetsAtEpochMs}`,
      );
    }
    this.runsUsed += 1;
    return { ok: true, value: this.status(nowEpochMs) };
  }
}

// ---------------------------------------------------------------------------
// The pinned dataset-item contract (untrusted input, whitelisted).
// ---------------------------------------------------------------------------

/** One capability claim as it may appear in a pinned dataset item. */
export interface ApifyItemClaim {
  readonly operation: OperationRef;
  readonly inputKinds: readonly RepresentationKind[];
  readonly outputKinds: readonly RepresentationKind[];
  readonly quality?: QualityTarget | undefined;
  readonly claimBasis: ClaimBasis;
}

/**
 * The whitelisted dataset-item shape the PINNED actor is expected to
 * emit (documented in README + docs/operations/acquisition.md): a
 * provider-neutral capability observation. Everything else in a raw
 * dataset item is IGNORED at the mapping boundary — an untrusted payload
 * cannot smuggle state, approvals or trust through unknown fields.
 */
export interface ApifyAcquisitionItem {
  readonly summary: string;
  readonly claimedCapabilities: readonly ApifyItemClaim[];
  readonly licenseNote?: string | undefined;
  readonly environmentNotes?: readonly string[] | undefined;
}

/** The full provenance record of one acquisition run. */
export interface ApifyAcquisitionProvenance {
  readonly adapterId: string;
  readonly sourceKind: DiscoverySourceKind;
  readonly actorId: string;
  /** Content-addressed acquisition-run id: `apifyrun:` + 16 hex chars. */
  readonly acquisitionRunId: string;
  /** The provider's run id when the response carries it; null otherwise (never fabricated). */
  readonly providerRunId: string | null;
  /** Caller-supplied instant of the refresh (never wall-clock). */
  readonly fetchedAt: Timestamp;
  /** SHA-256 over the canonical JSON of the raw dataset payload. */
  readonly rawResultDigest: string;
  readonly itemCount: number;
  readonly mappedArtifactCount: number;
  /** Items dropped at the mapping boundary (malformed/untrusted input). */
  readonly droppedItemCount: number;
}

/** The outcome of one successful refresh. */
export interface ApifyAcquisitionRefresh {
  readonly provenance: ApifyAcquisitionProvenance;
  readonly artifacts: readonly SourceArtifact[];
}

/** Adapter construction options. */
export interface ApifySourceAdapterOptions {
  /** The Apify API token (server-side secret; never committed). */
  readonly token: string;
  /** The PINNED actor id (EPOCH_APIFY_ACTOR_ID) — the acquisition source. */
  readonly actorId: string;
  readonly maxRunsPerDay?: number | undefined;
  /** Client-side abort deadline ms (default 35_000). */
  readonly timeoutMs?: number | undefined;
  /** Provider-side run-sync cap seconds (the pinned URL param; default 30). */
  readonly runSyncTimeoutSeconds?: number | undefined;
  readonly apiBaseUrl?: string | undefined;
  /** The actor run input (operator-controlled configuration), sent as the request body when provided. */
  readonly runInput?: unknown | undefined;
  readonly adapterId?: string | undefined;
  readonly description?: string | undefined;
  readonly fetchImpl?: FetchLike | undefined;
}

const DEFAULT_ADAPTER_ID = 'apify-acquisition';
const DEFAULT_DESCRIPTION =
  'External acquisition over the pinned actor dataset (untrusted candidate observations with full provenance)';

/**
 * The Apify acquisition adapter. Safe for concurrent use; the only state
 * is the cached dataset (replaced atomically per successful refresh) and
 * the per-instance quota counter.
 */
export class ApifySourceAdapter implements DiscoverySourceAdapter {
  readonly adapterId: string;
  readonly description: string;
  readonly sourceKind: DiscoverySourceKind = 'public-catalog';

  private readonly token: string;
  private readonly actorId: string;
  private readonly timeoutMs: number;
  private readonly runSyncTimeoutSeconds: number;
  private readonly baseUrl: string;
  private readonly runInput: unknown | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly quota: ApifyDailyRunQuota;

  private cache: readonly SourceArtifact[] = [];
  private lastProvenance: ApifyAcquisitionProvenance | null = null;

  constructor(options: ApifySourceAdapterOptions) {
    if (options.token === '') throw new Error('ApifySourceAdapter: token must be non-empty');
    if (options.actorId === '') throw new Error('ApifySourceAdapter: actorId must be non-empty');
    const baseUrl = (options.apiBaseUrl ?? APIFY_API_BASE_URL).replace(/\/+$/, '');
    if (!/^https?:\/\//.test(baseUrl)) {
      throw new Error('ApifySourceAdapter: apiBaseUrl must be an http(s) URL');
    }
    this.adapterId = options.adapterId ?? DEFAULT_ADAPTER_ID;
    this.description = options.description ?? DEFAULT_DESCRIPTION;
    this.token = options.token;
    this.actorId = options.actorId;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_APIFY_TIMEOUT_MS;
    this.runSyncTimeoutSeconds =
      options.runSyncTimeoutSeconds ?? DEFAULT_APIFY_RUN_SYNC_TIMEOUT_SECONDS;
    this.baseUrl = baseUrl;
    this.runInput = options.runInput;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.quota = new ApifyDailyRunQuota(options.maxRunsPerDay ?? DEFAULT_APIFY_MAX_RUNS_PER_DAY);
  }

  /**
   * The EXPLICIT fetch-ahead refresh (never a timer, never automatic):
   * runs the pinned actor within the per-day quota, maps the dataset to
   * artifacts and replaces the cache ATOMICALLY. A failure leaves the
   * previous cache untouched (no partial mutation) and consumes quota
   * (the conservative cost posture documented above).
   */
  async refresh(now: Timestamp): Promise<ApifyResult<ApifyAcquisitionRefresh>> {
    const nowEpochMs = timestampToEpochMs(now);
    const quotaOk = this.quota.consume(nowEpochMs);
    if (!quotaOk.ok) return quotaOk;

    const fetched = await this.fetchDataset();
    if (!fetched.ok) return fetched;

    const rawPayload: readonly unknown[] = fetched.value.items;
    const rawResultDigest = contentDigest(rawPayload);
    const artifacts: SourceArtifact[] = [];
    let dropped = 0;
    for (const rawItem of rawPayload) {
      const mapped = mapDatasetItem(rawItem);
      if (mapped === null) {
        dropped += 1;
        continue;
      }
      artifacts.push(mapped);
    }
    artifacts.sort((a, b) => (a.artifactId < b.artifactId ? -1 : 1));

    const provenance: ApifyAcquisitionProvenance = {
      adapterId: this.adapterId,
      sourceKind: this.sourceKind,
      actorId: this.actorId,
      acquisitionRunId: `apifyrun:${digestSuffix16(
        contentDigest({ actorId: this.actorId, fetchedAt: now, rawResultDigest }),
      )}`,
      providerRunId: fetched.value.providerRunId,
      fetchedAt: now,
      rawResultDigest,
      itemCount: rawPayload.length,
      mappedArtifactCount: artifacts.length,
      droppedItemCount: dropped,
    };

    // Atomic replacement only after the full payload was mapped.
    this.cache = artifacts;
    this.lastProvenance = provenance;
    return { ok: true, value: { provenance, artifacts } };
  }

  /** The last successful refresh's provenance (null before the first). */
  lastRefreshProvenance(): ApifyAcquisitionProvenance | null {
    return this.lastProvenance;
  }

  /** The current quota view (pure; caller supplies the instant). */
  quotaStatus(nowEpochMs: number): ApifyQuotaStatus {
    return this.quota.status(nowEpochMs);
  }

  /**
   * The frozen contract method: SYNCHRONOUS scan over the cached
   * dataset. Deterministic: the same cache + query always yield the
   * same artifacts in the same order (the StaticCatalogSourceAdapter
   * reference semantics). Never throws; an unrefreshed adapter scans
   * empty.
   */
  scan(query: SourceScanQuery): SourceScanResult {
    const matched = this.cache.filter((artifact) =>
      artifact.claimedCapabilities.some((claim) =>
        query.operations.some((operation) => this.matches(claim.operation, operation)),
      ),
    );
    const limited = matched.slice(0, query.limit);
    return {
      adapterId: this.adapterId,
      artifacts: [...limited].sort((a, b) => (a.artifactId < b.artifactId ? -1 : 1)),
    };
  }

  private matches(claim: OperationRef, query: OperationRef): boolean {
    if (claim.id !== query.id) return false;
    return query.versionConstraint === '*' || claim.versionConstraint === query.versionConstraint;
  }

  private async fetchDataset(): Promise<
    ApifyResult<{ readonly items: readonly unknown[]; readonly providerRunId: string | null }>
  > {
    const url =
      `${this.baseUrl}/acts/${encodeURIComponent(this.actorId)}` +
      `/run-sync-get-dataset-items?token=${encodeURIComponent(this.token)}` +
      `&timeout=${this.runSyncTimeoutSeconds}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: 'POST',
          headers: this.runInput === undefined ? undefined : { 'Content-Type': 'application/json' },
          body: this.runInput === undefined ? undefined : JSON.stringify(this.runInput),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
          return apifyFail(
            'timeout',
            `acquisition request aborted after ${this.timeoutMs}ms (provider run-sync cap ${this.runSyncTimeoutSeconds}s)`,
          );
        }
        return apifyFail(
          'unavailable',
          `acquisition request failed: ${error instanceof Error ? error.message : 'network error'}`,
        );
      }
      if (response.status === 401) {
        return apifyFail('unauthorized', 'the acquisition provider rejected the token (401)');
      }
      if (response.status === 402) {
        return apifyFail(
          'payment-required',
          'the acquisition provider reports exhausted platform credit (402)',
        );
      }
      if (response.status === 404) {
        return apifyFail('not-found', `the pinned actor ${this.actorId} was not found (404)`);
      }
      if (response.status === 429) {
        return apifyFail('rate-limited', 'the acquisition provider rate-limited the request (429)');
      }
      if (!response.ok) {
        return apifyFail(
          'unavailable',
          `the acquisition provider returned HTTP ${response.status}`,
        );
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return apifyFail('malformed-response', 'the dataset payload is not valid JSON');
      }
      if (!Array.isArray(body)) {
        return apifyFail(
          'malformed-response',
          'the dataset payload is not a JSON array of items (run-sync-get-dataset-items contract)',
        );
      }
      const providerRunId =
        response.headers.get('apify-run-id') ?? response.headers.get('x-apify-run-id');
      return { ok: true, value: { items: body, providerRunId: providerRunId === null ? null : providerRunId } };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Map ONE untrusted dataset item to a SourceArtifact through the strict
 * whitelist. Returns null for malformed items (the caller counts them).
 * The item digest is COMPUTED HERE (never read from the payload); the
 * artifact id is DERIVED from it; the mapped artifact is validated with
 * the kernel's own frozen SourceArtifactSchema.
 */
function mapDatasetItem(rawItem: unknown): SourceArtifact | null {
  if (rawItem === null || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    return null;
  }
  const record = rawItem as Record<string, unknown>;
  const itemDigest = contentDigest(rawItem);
  const claims = Array.isArray(record.claimedCapabilities)
    ? (record.claimedCapabilities as readonly ApifyItemClaim[])
    : [];
  // An acquisition item must carry at least one capability claim — a
  // claim-less "observation" is malformed for this contract and dropped.
  if (claims.length === 0) return null;
  const candidate: SourceArtifact = {
    artifactId: `apify-${digestSuffix16(itemDigest)}`,
    // The raw-item digest is the per-artifact raw-result provenance:
    // computed here, never trusted from the payload.
    contentDigest: itemDigest,
    summary: typeof record.summary === 'string' ? record.summary : '',
    claimedCapabilities: claims,
    licenseNote: typeof record.licenseNote === 'string' ? record.licenseNote : undefined,
    environmentNotes: Array.isArray(record.environmentNotes)
      ? (record.environmentNotes as readonly string[])
      : [],
  };
  const parsed = schemas.SourceArtifactSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
