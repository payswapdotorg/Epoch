/**
 * @epoch/application-gateway — the reset/seed production-refusal guard
 * (W053, ACR-006).
 *
 * THE script-layer enforcement of spec/production-environment.md
 * ("Production protection rules"):
 *
 *  - Reset/seed/bootstrap scripts MUST refuse to run against production
 *    targets. A refusal is decided by TWO independent rules:
 *      1. the profile guard — `EPOCH_DEPLOYMENT_PROFILE=production` =>
 *         refuse (the deployment self-declares production);
 *      2. the connection-string denylist — a target whose host matches
 *         the production database host (derived from
 *         `EPOCH_DATABASE_URL`, the production durable binding) =>
 *         refuse (protects even when the profile is unset/wrong).
 *
 *  - Production data is never silently treated as disposable test data;
 *    a refusal carries the typed reasons so scripts can fail loudly.
 *
 * Pure + total: no environment reads, no network, no throws — the caller
 * (a reset/seed/bootstrap script) supplies the values and acts on the
 * typed verdict. The guard NEVER mutates anything itself.
 */

/** The refusal verdict of a reset/seed target evaluation. */
export interface ProductionTargetRefusal {
  readonly refused: boolean;
  /** Human-readable refusal reasons (empty when not refused). */
  readonly reasons: readonly string[];
}

/** The inputs of a reset/seed target evaluation. */
export interface ProductionTargetInput {
  /** The deployment profile as declared (e.g. `EPOCH_DEPLOYMENT_PROFILE`). */
  readonly profile: string | undefined;
  /** The connection string the script would target (the DB to reset/seed). */
  readonly connectionString: string | undefined;
  /**
   * The PRODUCTION database host (the denylist anchor — typically
   * `productionHostOf(EPOCH_DATABASE_URL)` from the operator's
   * environment; absent disables the host rule).
   */
  readonly productionHost: string | undefined;
}

/**
 * Extract the host of a PostgreSQL connection string
 * (`postgres://` / `postgresql://`, with or without credentials, port,
 * database and query — Neon URLs carry `?sslmode=require`). Returns
 * null for absent/unparseable strings (fail-safe: no host, no match).
 */
export function productionHostOf(connectionString: string | undefined): string | null {
  if (typeof connectionString !== 'string' || connectionString === '') return null;
  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname;
    return host === '' ? null : host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Decide whether a reset/seed/bootstrap target MUST be refused.
 *
 * Rules (either one refuses — spec/production-environment.md):
 *  1. `profile === 'production'` (the deployment self-declares production);
 *  2. the target host equals the production database host (case-insensitive)
 *     when a production host anchor is supplied.
 *
 * Fail-safe ordering: an UNPARSEABLE connection string never matches the
 * denylist (rule 2 is an exact-host anchor, not a guess) — scripts that
 * need strictness on top of this guard validate their inputs themselves.
 */
export function refusesProductionTarget(input: ProductionTargetInput): ProductionTargetRefusal {
  const reasons: string[] = [];
  if (input.profile === 'production') {
    reasons.push(
      'EPOCH_DEPLOYMENT_PROFILE is "production" — reset/seed/bootstrap scripts refuse production targets (spec/production-environment.md)',
    );
  }
  if (input.productionHost !== undefined && input.productionHost !== '') {
    const targetHost = productionHostOf(input.connectionString);
    if (targetHost !== null && targetHost === input.productionHost.toLowerCase()) {
      reasons.push(
        `the target connection string host "${targetHost}" matches the production database host — refusing (connection-string denylist)`,
      );
    }
  }
  return { refused: reasons.length > 0, reasons };
}
