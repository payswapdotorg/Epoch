import type { WorldContractsVersion } from './version';

/**
 * Summary statistics of a world at a point in time. Derived data — never a
 * substitute for the assertion history.
 */
export interface WorldStatistics {
  /** Last consumed global sequence number. */
  readonly sequence: number;
  /** Entities materialized as live at the statistics instant. */
  readonly entityCount: number;
  /** Relations materialized as live at the statistics instant. */
  readonly relationCount: number;
  readonly assertionCount: number;
  readonly liveAssertionCount: number;
  readonly supersededAssertionCount: number;
  readonly retractedAssertionCount: number;
  readonly eventCount: number;
  readonly entityTypeCount: number;
  readonly relationTypeCount: number;
  readonly externalMappingCount: number;
  readonly contractsVersion: WorldContractsVersion;
}
