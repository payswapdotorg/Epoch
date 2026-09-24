import { z } from 'zod';
import { WORLD_CONTRACTS_VERSION } from '../version';

/**
 * Runtime validator for world statistics
 * (contracts/world/src/statistics.ts).
 */

export const WorldStatisticsSchema = z
  .strictObject({
    sequence: z.number().int().nonnegative(),
    entityCount: z.number().int().nonnegative(),
    relationCount: z.number().int().nonnegative(),
    assertionCount: z.number().int().nonnegative(),
    liveAssertionCount: z.number().int().nonnegative(),
    supersededAssertionCount: z.number().int().nonnegative(),
    retractedAssertionCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    entityTypeCount: z.number().int().nonnegative(),
    relationTypeCount: z.number().int().nonnegative(),
    externalMappingCount: z.number().int().nonnegative(),
    contractsVersion: z.literal(WORLD_CONTRACTS_VERSION),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:world-statistics',
    title: 'WorldStatistics',
  });
