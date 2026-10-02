/**
 * W054 (ACR-006) — the PRODUCTION ecosystem-discovery trigger.
 *
 * The documented, authorized invocation path that makes the ACR-004
 * ecosystem-discovery capability usable in production: it composes the
 * quota-guarded Apify acquisition adapter (fetch-ahead) with the fixture
 * reference adapter and invokes the FROZEN service contract
 * (`CapabilityDiscoveryService.runEcosystemScan` — which drives the
 * kernel's `runEcosystemDiscovery` with trigger `scheduled`) at a
 * CALLER-SUPPLIED instant.
 *
 * This module is production WIRING ONLY:
 * - the frozen scheduler CONTRACT (packages/capability-discovery/src/
 *   scheduler.ts) and the discovery semantics are untouched — the
 *   adapter is NOT the scheduler and this trigger is NOT a timer (no
 *   cron, no intervals, no wall-clock: the deployment's authorized
 *   scheduler — a platform job, a gateway operation or a documented ops
 *   entrypoint — calls this function at an instant IT supplies);
 * - every Apify failure DEGRADES the acquisition leg (typed +
 *   surfaced), never the product: the scan always runs over at least
 *   the fixture reference adapter;
 * - the per-day quota guard (EPOCH_APIFY_MAX_RUNS_PER_DAY, default 1)
 *   is enforced by the adapter instance across every invocation that
 *   shares it — hold ONE adapter per process (see the README +
 *   docs/operations/acquisition.md);
 * - acquisition artifacts remain UNTRUSTED candidate observations: the
 *   run history records provenance and the normal evaluation path is
 *   the ONLY route to consequential state (negative battery in
 *   adapters/apify/test/untrusted-input.test.ts).
 *
 * Environment mapping (the W051 production environment contract,
 * spec/production-environment.md): this package performs NO environment
 * reads. The deployment binding seam (apps/web production-env /
 * the ops entrypoint) parses EPOCH_APIFY_TOKEN, EPOCH_APIFY_ACTOR_ID
 * and EPOCH_APIFY_MAX_RUNS_PER_DAY and hands the result to
 * {@link acquisitionConfigFromEnv} / {@link ProductionAcquisitionConfig}.
 */
import type {
  DiscoverySourceAdapter,
  DiscoveryTenantId,
  Timestamp,
} from '@epoch/capability-discovery';
import { timestampToEpochMs } from '@epoch/capability-discovery';
import {
  ApifySourceAdapter,
  DEFAULT_APIFY_MAX_RUNS_PER_DAY,
  type ApifyAcquisitionError,
  type ApifyAcquisitionProvenance,
  type ApifyQuotaStatus,
  type FetchLike,
} from '@epoch/adapter-apify';
import type { CapabilityDiscoveryService } from './runtime';
import type {
  AuthorizationDecision,
  ServicePrincipal,
  ServiceResult,
} from './types';

// ---------------------------------------------------------------------------
// The acquisition configuration (caller-supplied; no env reads here).
// ---------------------------------------------------------------------------

/** The acquisition leg configuration (mirrors the EPOCH_APIFY_* contract). */
export interface ProductionAcquisitionConfig {
  /** EPOCH_APIFY_TOKEN ('' when unconfigured). */
  readonly token: string;
  /** EPOCH_APIFY_ACTOR_ID ('' when unconfigured). */
  readonly actorId: string;
  /** EPOCH_APIFY_MAX_RUNS_PER_DAY (default 1; integer >= 1). */
  readonly maxRunsPerDay: number;
}

/**
 * Parse the acquisition configuration from an environment-like record
 * (the caller supplies the source — typically `process.env`; this module
 * never reads the environment itself). Invalid values fail safe to the
 * documented defaults (the least-cost posture).
 */
export function acquisitionConfigFromEnv(
  source: Readonly<Record<string, string | undefined>>,
): ProductionAcquisitionConfig {
  const token = source['EPOCH_APIFY_TOKEN'] ?? '';
  const actorId = source['EPOCH_APIFY_ACTOR_ID'] ?? '';
  const rawCap = Number(source['EPOCH_APIFY_MAX_RUNS_PER_DAY']);
  const maxRunsPerDay =
    Number.isInteger(rawCap) && rawCap >= 1 ? rawCap : DEFAULT_APIFY_MAX_RUNS_PER_DAY;
  return { token, actorId, maxRunsPerDay };
}

/** Whether the acquisition leg is configured (token + pinned actor). */
export function acquisitionConfigured(config: ProductionAcquisitionConfig): boolean {
  return config.token !== '' && config.actorId !== '';
}

// ---------------------------------------------------------------------------
// The trigger input + the typed outcome.
// ---------------------------------------------------------------------------

/** The acquisition binding: a held adapter (quota shared) or per-call config. */
export interface ProductionAcquisitionInput {
  /**
   * A pre-built adapter — RECOMMENDED for long-lived processes: the
   * per-day quota counter lives on the instance, so every invocation
   * sharing the adapter shares the cap.
   */
  readonly adapter?: ApifySourceAdapter | undefined;
  /**
   * Configuration used when `adapter` is absent. A FRESH adapter is
   * built per invocation (the quota counter is then per-invocation —
   * acceptable for single-shot ops entrypoints; the scheduled
   * deployment path holds one adapter).
   */
  readonly config?: ProductionAcquisitionConfig | undefined;
  /** Injectable fetch (tests); defaults to the platform fetch. */
  readonly fetchImpl?: FetchLike | undefined;
}

/** The acquisition leg state of one production run. */
export type ProductionAcquisitionState =
  | {
      readonly mode: 'enabled';
      readonly provenance: ApifyAcquisitionProvenance;
      readonly quota: ApifyQuotaStatus;
    }
  | {
      readonly mode: 'degraded';
      readonly reason: 'provider-failure' | 'quota-exceeded';
      readonly failure: ApifyAcquisitionError;
      readonly quota: ApifyQuotaStatus;
    }
  | {
      readonly mode: 'disabled';
      readonly reason: 'token-or-actor-absent';
    };

/** The typed outcome of one production ecosystem-discovery run. */
export interface ProductionEcosystemDiscoveryOutcome {
  /** The frozen contract trigger (always `scheduled` here). */
  readonly trigger: 'scheduled';
  /** The invoking schedule/entrypoint id (recorded on the run). */
  readonly invokedBy: string;
  /** The caller-supplied instant of the run (never wall-clock). */
  readonly at: Timestamp;
  /** The acquisition leg state (enabled / degraded / disabled + typed detail). */
  readonly acquisition: ProductionAcquisitionState;
  /** True when the acquisition leg is not enabled for this run. */
  readonly degraded: boolean;
  /** The content-addressed ecosystem run id (the run-history record). */
  readonly runId: string;
  /** Candidates ingested by the run (candidate observations only). */
  readonly ingestedCandidateIds: readonly string[];
  /** Gaps transitioned by the run (enrichment: CANDIDATE_FOUND). */
  readonly updatedGapIds: readonly string[];
}

/** The trigger input (the authorized caller supplies every instant + gate). */
export interface ProductionEcosystemDiscoveryInput {
  /** The caller-supplied instant of this run (zero wall-clock). */
  readonly now: Timestamp;
  /** The service facade (authorization + tenancy gates stay fail-closed). */
  readonly service: CapabilityDiscoveryService;
  readonly principal: ServicePrincipal;
  readonly authorization: AuthorizationDecision;
  readonly tenantId: DiscoveryTenantId;
  /** The fixture reference adapter — the always-present degraded-mode source. */
  readonly fixtureAdapter: DiscoverySourceAdapter;
  /** The acquisition leg (absent/absent-token => graceful degradation). */
  readonly acquisition?: ProductionAcquisitionInput | undefined;
  /** The invoking schedule/entrypoint id (default 'production-ops-trigger'). */
  readonly invokedBy?: string | undefined;
  readonly scanLimit?: number | undefined;
}

const DEFAULT_INVOKED_BY = 'production-ops-trigger';

/**
 * Run ONE production ecosystem discovery:
 *
 * 1. resolve the acquisition leg (held adapter / config / absent) and,
 *    when configured, refresh it WITHIN the per-day quota;
 * 2. compose the adapters (Apify + fixture when enabled; fixture only
 *    when degraded/disabled — the product never depends on the
 *    acquisition leg);
 * 3. invoke the FROZEN service contract with trigger `scheduled` at the
 *    caller-supplied instant (run history + candidate provenance are
 *    recorded through the existing store contract);
 * 4. return the typed outcome (acquisition state + run record summary).
 *
 * Fail-closed semantics: authorization/tenant/kernel failures from the
 * service contract are returned as the typed service failure (the
 * product's gates never fail open). Acquisition failures are ALWAYS
 * degraded legs inside a successful run — never a product failure.
 */
export async function runProductionEcosystemDiscovery(
  input: ProductionEcosystemDiscoveryInput,
): Promise<ServiceResult<ProductionEcosystemDiscoveryOutcome>> {
  const invokedBy = input.invokedBy ?? DEFAULT_INVOKED_BY;
  const nowEpochMs = timestampToEpochMs(input.now);

  // --- 1) the acquisition leg -------------------------------------------------
  const adapters: DiscoverySourceAdapter[] = [input.fixtureAdapter];
  let acquisition: ProductionAcquisitionState;

  const heldAdapter = input.acquisition?.adapter;
  const config = input.acquisition?.config;
  const configured =
    heldAdapter !== undefined || (config !== undefined && acquisitionConfigured(config));

  if (!configured) {
    // Graceful degradation (spec/production-environment.md rule 4): the
    // optional capability is disabled + surfaced; the product is healthy.
    acquisition = { mode: 'disabled', reason: 'token-or-actor-absent' };
  } else {
    const adapter =
      heldAdapter ??
      new ApifySourceAdapter({
        token: config!.token,
        actorId: config!.actorId,
        maxRunsPerDay: config!.maxRunsPerDay,
        fetchImpl: input.acquisition?.fetchImpl,
      });
    const refreshed = await adapter.refresh(input.now);
    const quota = adapter.quotaStatus(nowEpochMs);
    if (refreshed.ok) {
      acquisition = { mode: 'enabled', provenance: refreshed.value.provenance, quota };
      adapters.push(adapter);
    } else {
      // Typed degradation: provider failure or quota exhaustion degrades
      // THIS run's acquisition leg; the scan proceeds on the fixture
      // source (degrade the run, never the product).
      acquisition = {
        mode: 'degraded',
        reason: refreshed.error.code === 'quota-exceeded' ? 'quota-exceeded' : 'provider-failure',
        failure: refreshed.error,
        quota,
      };
    }
  }

  // --- 2) the frozen service contract (trigger 'scheduled') ------------------
  const scan = input.service.runEcosystemScan({
    principal: input.principal,
    authorization: input.authorization,
    tenantId: input.tenantId,
    trigger: 'scheduled',
    invokedBy,
    adapters,
    at: input.now,
    scanLimit: input.scanLimit,
  });
  if (!scan.ok) return scan;

  // --- 3) the typed outcome (run history + provenance) ------------------------
  return {
    ok: true,
    value: {
      trigger: 'scheduled',
      invokedBy,
      at: input.now,
      acquisition,
      degraded: acquisition.mode !== 'enabled',
      runId: scan.value.runId,
      ingestedCandidateIds: scan.value.ingestedCandidates.map((candidate) => candidate.candidateId),
      updatedGapIds: scan.value.updatedGaps.map((gap) => gap.gapId),
    },
  };
}
