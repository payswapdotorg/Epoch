/**
 * @epoch/capability-discovery-runtime — public API (service layer, W045).
 *
 * The typed host facade composing the @epoch/capability-discovery kernel:
 * problem-driven discovery, ecosystem scans, external-candidate
 * promotion, ecosystem proposals and the deployment-neutral scheduler
 * invocation — every operation behind a fail-closed caller-supplied
 * authorization gate and a REAL @epoch/tenancy tenant validation.
 * Discovery never grants execution authority and never mutates
 * authoritative world/solution/delivery state.
 */
export {
  CAPABILITY_DISCOVERY_SERVICE_NAME,
  CAPABILITY_DISCOVERY_SERVICE_VERSION,
} from './version';

export { CapabilityDiscoveryService } from './runtime';
export type { CapabilityDiscoveryServiceOptions } from './runtime';

export type {
  AuthorizationDecision,
  EcosystemProposalRequest,
  EcosystemScanRequest,
  ProblemDiscoveryRequest,
  PromotionRequest,
  ScheduledScanOutcome,
  ServiceError,
  ServiceErrorCode,
  ServicePrincipal,
  ServiceResult,
} from './types';

// Record shapes re-exported for callers (from the kernel contract).
export type {
  CandidateProfile,
  CapabilityGap,
  DiscoveryRunArtifact,
  DiscoverySchedule,
  EcosystemProposal,
  PromotionRecord,
} from './types';
