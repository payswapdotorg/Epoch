/**
 * The provider-neutral source-adapter interface (W045 pin 8, ARCD1.0
 * stream B).
 *
 * A source adapter is the ONLY seam through which external catalogs
 * (public model registries, code repositories, engineering software
 * catalogs, tenant-authorized private catalogs) enter the discovery
 * plane — as provider-neutral {@link SourceArtifact} records carrying
 * capability CLAIMS, never executable artifacts, never provider
 * semantics in kernel types (lock rule 13). Named providers are
 * adapters, NEVER kernel dependencies; the reference adapter here is a
 * static fixture catalog (no real external registry is integrated).
 *
 * The adapter is NOT the scheduler (W045 scheduling note): a scheduler
 * invokes the ecosystem-discovery service contract; adapters only answer
 * scans.
 */
import type {
  DiscoverySourceKind,
  OperationRef,
  SourceArtifact,
  SourceScanQuery,
  SourceScanResult,
} from './types';
import { SourceScanQuerySchema } from './schema';
import { operationKey } from './canonical';
import type { DiscoveryResult } from './types';
import { validationError } from './errors';
import { zodIssuesToDiscoveryIssues } from './errors';

/** The provider-neutral source-adapter contract (one method + metadata). */
export interface DiscoverySourceAdapter {
  readonly adapterId: string;
  readonly description: string;
  readonly sourceKind: DiscoverySourceKind;
  /**
   * Scan the source for artifacts that MIGHT satisfy the queried gap
   * operations. Deterministic: the same catalog + query always yields the
   * same artifacts in the same order.
   */
  scan(query: SourceScanQuery): SourceScanResult;
}

/**
 * The ONE reference adapter: a static catalog fixture. Constructed from
 * fixed records; scans match artifact capability claims against the
 * queried operations (id equality; `*` queries admit any version) and
 * return matches in canonical order, capped by the query limit.
 */
export class StaticCatalogSourceAdapter implements DiscoverySourceAdapter {
  readonly adapterId: string;
  readonly description: string;
  readonly sourceKind: DiscoverySourceKind = 'fixture';
  private readonly catalog: readonly SourceArtifact[];

  constructor(input: {
    readonly adapterId: string;
    readonly description: string;
    readonly catalog: readonly SourceArtifact[];
  }) {
    this.adapterId = input.adapterId;
    this.description = input.description;
    this.catalog = [...input.catalog].sort((a, b) => (a.artifactId < b.artifactId ? -1 : 1));
  }

  scan(query: SourceScanQuery): SourceScanResult {
    const matched = this.catalog.filter((artifact) =>
      artifact.claimedCapabilities.some((claim) =>
        query.operations.some((operation) => this.matches(claim.operation, operation)),
      ),
    );
    const limited = matched.slice(0, query.limit);
    return {
      adapterId: this.adapterId,
      artifacts: limited.sort((a, b) => (a.artifactId < b.artifactId ? -1 : 1)),
    };
  }

  private matches(claim: OperationRef, query: OperationRef): boolean {
    if (claim.id !== query.id) return false;
    return query.versionConstraint === '*' || claim.versionConstraint === query.versionConstraint;
  }
}

/** Validate a scan query (total surface). */
export function validateScanQuery(query: SourceScanQuery): DiscoveryResult<SourceScanQuery> {
  const parsed = SourceScanQuerySchema.safeParse(query);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('invalid scan query', zodIssuesToDiscoveryIssues(parsed.error)),
    };
  }
  return { ok: true, value: parsed.data };
}

/** Canonical scan key of an operation (dedupe across adapters). */
export function scanOperationKey(operation: OperationRef): string {
  return operationKey(operation);
}
