/**
 * @epoch/desktop — the product view-models (W048).
 *
 * The typed UI state the React components render AND the headless
 * journey runner drives — the SAME code path (the visible product logic).
 * Every field the journeys assert is a view-model field; every semantic
 * value arrives through the IPC bridge (a gateway outcome), never from a
 * local semantic computation (no second store).
 */
import type { GatewayError, GatewayOutcome, JsonValue } from '@epoch/client-runtime';
import type { HostAppMeta } from '../ipc/host';
import type { DesktopGatewayMode, DesktopPlatform } from '../version';

/** The product session bar (J01/J12): who/where/how. */
export interface SessionBarViewModel {
  readonly state: 'unauthenticated' | 'active' | 'expired' | 'revoked';
  readonly principalId: string | null;
  readonly tenantId: string | null;
  readonly sessionId: string | null;
  readonly gatewayMode: DesktopGatewayMode | null;
  readonly protocol: { readonly gatewayContract: string; readonly hostProtocol: string } | null;
}

/** The project entry view (J01): tenancy context + world digest + entity counts. */
export interface ProjectEntryViewModel {
  readonly nodeId: string;
  readonly nodeKind: string;
  readonly parentId: string | null;
  readonly worldDigest: string | null;
  readonly entityCount: number | null;
  readonly relationCount: number | null;
  readonly outcome: GatewayOutcome | null;
}

/** One world entity row (J02). */
export interface WorldEntityRow {
  readonly entityId: string;
  readonly entityType: string;
  readonly title: string;
}

/** The understand/reconstruct view (J02): entities + evidence + intake results. */
export interface UnderstandViewModel {
  readonly entities: readonly WorldEntityRow[];
  readonly worldDigest: string | null;
  readonly evidenceDigest: string | null;
  readonly evidenceRecord: JsonValue | null;
  readonly intakeDigest: string | null;
  readonly unknowns: readonly { readonly entityId: string; readonly note: string }[];
}

/** The discovery view (J03): capability/role discovery run record. */
export interface DiscoveryViewModel {
  readonly runId: string | null;
  readonly roles: readonly { readonly roleId: string; readonly summary: string }[];
  readonly capabilityGaps: readonly { readonly gapId: string; readonly summary: string }[];
  readonly outcome: GatewayOutcome | null;
  readonly authorityError: GatewayError | null;
}

/** One action-lifecycle step (J04). */
export interface ActionStepRecord {
  readonly actionId: string;
  readonly step: 'submitted' | 'approved' | 'executed';
  readonly at: string;
  readonly detail: string;
}

/** The action approval view (J04): submit -> approve -> execute -> status. */
export interface ActionApprovalViewModel {
  readonly actionId: string | null;
  readonly steps: readonly ActionStepRecord[];
  readonly status: string | null;
  readonly constraintOutcome: JsonValue | null;
  readonly verificationOutcome: JsonValue | null;
}

/** One BOQ/schedule fold row (J05). */
export interface ScheduleRow {
  readonly key: string;
  readonly quantity: string;
  readonly cost: string;
}

/** The program of work view (J05): solution + program + BOQ folds + procurement. */
export interface ProgramOfWorkViewModel {
  readonly solutionVersionDigest: string | null;
  readonly programContentDigest: string | null;
  readonly quantitySchedule: readonly ScheduleRow[];
  readonly costSchedule: readonly ScheduleRow[];
  readonly milestones: readonly { readonly milestoneId: string; readonly title: string; readonly status: string }[];
  readonly quoteId: string | null;
  readonly outcome: GatewayOutcome | null;
}

/** One field observation row (J06). */
export interface ObservationRow {
  readonly observationId: string;
  readonly subject: string;
  readonly measure: string;
  readonly at: string;
}

/** The realize/observe view (J06): delivery + observations + forecast + verification. */
export interface RealizeViewModel {
  readonly deliveryId: string | null;
  readonly observations: readonly ObservationRow[];
  readonly forecast: JsonValue | null;
  readonly verification: JsonValue | null;
  readonly closed: boolean;
}

/** The offline queue view (J07): pending projections + drain outcomes. */
export interface OfflineQueueViewModel {
  readonly pending: readonly { readonly queueId: string; readonly operation: string; readonly state: string }[];
  readonly drained: readonly { readonly queueId: string; readonly outcomeDigest: string; readonly replayed: boolean }[];
  readonly lastDrainAt: string | null;
  readonly stillPendingCount: number;
}

/** The cross-device handoff view (J08): digest equality + session scope + cached projection. */
export interface HandoffViewModel {
  readonly worldDigest: string | null;
  readonly registryWorldDigest: string | null;
  readonly digestsMatch: boolean | null;
  readonly sessionScope: { readonly principalId: string; readonly tenantId: string } | null;
  readonly cachedProjectionDigest: string | null;
  readonly note: string;
}

/** The supervision view (J09): supervision pass + raised alert. */
export interface SupervisionViewModel {
  readonly checkOutcome: JsonValue | null;
  readonly alertId: string | null;
  readonly authorityError: GatewayError | null;
}

/** One recovery event (J11). */
export interface RecoveryEvent {
  readonly at: string;
  readonly kind: 'session-expired' | 're-authenticated' | 'connector-failure' | 'retry-succeeded' | 'authority-rejection';
  readonly detail: string;
}

/** The recovery view (J11): the failure/recovery chain. */
export interface RecoveryViewModel {
  readonly events: readonly RecoveryEvent[];
}

/** The relaunch/update view (J12): persisted-state restore + protocol check. */
export interface RelaunchViewModel {
  readonly sessionRestored: boolean;
  readonly queueRestoredCount: number;
  readonly projectionsRestoredCount: number;
  readonly updateCheck: 'compatible' | 'refused' | 'none';
  readonly updateRefusalReason: string | null;
  readonly appMeta: HostAppMeta | null;
}

/** The full product state (the screen registry the UI navigates). */
export interface ProductScreens {
  readonly session: SessionBarViewModel;
  readonly project: ProjectEntryViewModel | null;
  readonly understand: UnderstandViewModel | null;
  readonly discovery: DiscoveryViewModel | null;
  readonly actions: ActionApprovalViewModel | null;
  readonly program: ProgramOfWorkViewModel | null;
  readonly realize: RealizeViewModel | null;
  readonly offline: OfflineQueueViewModel | null;
  readonly handoff: HandoffViewModel | null;
  readonly supervision: SupervisionViewModel | null;
  readonly recovery: RecoveryViewModel | null;
  readonly relaunch: RelaunchViewModel | null;
}

/** The empty product state (pre-onboarding). */
export function emptyScreens(session: SessionBarViewModel): ProductScreens {
  return {
    session,
    project: null,
    understand: null,
    discovery: null,
    actions: null,
    program: null,
    realize: null,
    offline: null,
    handoff: null,
    supervision: null,
    recovery: null,
    relaunch: null,
  };
}

/** The platform label of a product run (journey records). */
export type PlatformLabel = DesktopPlatform | 'unknown';
