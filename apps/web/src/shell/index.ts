/**
 * @epoch/web shell (W014) — public API.
 *
 * The shell is COMPOSITION, not authority (architecture lock rules 8/16):
 * navigation, layout, providers, and route wiring live here; all domain and
 * experience semantics arrive through typed contracts owned by upstream
 * packages. The shell adds NO domain model of its own.
 *
 * Versioned contract surface: version constants + vocabularies
 * (`./version`), typed errors (`./errors`), tenant/session context
 * (`./tenancy`, `./session`), route registry + navigation state machine
 * (`./routes`, `./navigation`), the feature mounting seam (`./mounting`),
 * typed boundaries (`./boundaries`), the reference bootstrap
 * (`./bootstrap`), providers (`./providers`), the frame (`./frame`), and
 * the route surfaces (`./route-surfaces`).
 *
 * Upstream parity (@epoch/tenancy, @epoch/identity, @epoch/authorization,
 * @epoch/experience-protocol, @epoch/experience-compiler) is devDependency
 * compile/runtime-pinned by `./parity.test.ts` — never a runtime dependency.
 */
export {
  EXPERIENCE_GRAPH_KINDS,
  EXPERIENCE_SLOT_GRAPH_KINDS,
  EXPERIENCE_SLOT_IDS,
  FEATURE_ID_PATTERN,
  MIRRORED_AUTHORIZATION_DENIAL_CODES,
  MOUNT_ID_PATTERN,
  NAVIGATOR_STAGES,
  NAVIGATION_DENIAL_CODES,
  PRINCIPAL_ID_PATTERN,
  PRINCIPAL_KINDS,
  PRINCIPAL_STATUSES,
  PROJECT_ID_PATTERN,
  ROUTE_ID_PATTERN,
  ROUTE_PATH_PATTERN,
  SEMVER_CORE_PATTERN,
  SESSION_ID_PATTERN,
  SESSION_STATES,
  SHELL_BOUNDARY_STATES,
  SHELL_CONTRACT_VERSION,
  SHELL_MOUNT_KINDS,
  SHELL_PERMISSIONS,
  SHELL_RECORD_VERSION,
  SHELL_REGION_IDS,
  TENANT_ID_PATTERN,
  WORKSPACE_ID_PATTERN,
} from './version';
export type {
  ExperienceGraphKind,
  ExperienceSlotId,
  NavigationDenialCode,
  NavigatorStage,
  PrincipalKind,
  PrincipalStatus,
  SessionState,
  ShellBoundaryStateKind,
  ShellMountKind,
  ShellPermission,
  ShellRegionId,
} from './version';

export {
  crossTenantDeniedError,
  duplicateFeatureError,
  duplicateMountError,
  duplicateRouteError,
  missingTenantContextError,
  shellOk,
  unknownMountError,
  unknownRouteError,
  validationError,
} from './errors';
export type { ShellError, ShellErrorCode, ShellIssue, ShellResult } from './errors';

export {
  assertSameTenantScope,
  isTenantVisible,
  scopeOf,
  switchTenantContext,
  tenantScopeKey,
  validateTenantContext,
} from './tenancy';
export type { ShellTenantScope, TenantContextValue } from './tenancy';
export type { TenantId, WorkspaceId, ProjectId } from './version';

export {
  anonymousSession,
  isActiveSession,
  normalizeGrants,
  validateSessionContext,
  validateSessionPrincipal,
} from './session';
export type {
  PrincipalId,
  SessionContextValue,
  SessionPrincipal,
  SessionPrincipalFact,
} from './session';

export {
  createRouteRegistry,
  routeSortKey,
  sortRoutes,
  STAGE_TITLES,
  validateRouteDescriptor,
} from './routes';
export type { RouteDescriptor, RouteRegistry } from './routes';

export {
  createNavigationStateMachine,
  decideNavigation,
  visibleRoutes,
} from './navigation';
export type {
  NavigationDecision,
  NavigationDenial,
  NavigationState,
  NavigationStateMachine,
} from './navigation';

export {
  admitFeature,
  createFeatureSet,
  createMountRegistry,
  featuresAtMount,
  validateFeatureDescriptor,
  validateMountingPoint,
} from './mounting';
export type {
  FeatureDescriptor,
  FeatureMountDeclaration,
  FeatureSet,
  MountRegistry,
  MountingPoint,
} from './mounting';

export {
  boundarySummary,
  degradedBoundary,
  emptyBoundary,
  failedBoundary,
  loadingBoundary,
} from './boundaries';
export type { ShellBoundaryState } from './boundaries';

export {
  builtInMounts,
  builtInRoutes,
  createReferenceShell,
  HOME_ROUTE,
  REFERENCE_SESSION,
  REFERENCE_TENANT,
  stagePath,
  stageRouteId,
} from './bootstrap';
export type { ReferenceShell } from './bootstrap';

export {
  MissingSessionContextError,
  MissingTenantContextError,
  SessionProvider,
  ShellProviders,
  TenantProvider,
  useSessionContext,
  useTenantContext,
} from './providers';

export {
  AppFrame,
  ExperienceMountPlaceholder,
  ExperienceSurfaces,
  FeatureMountsRegion,
  HeaderRegion,
  NavigationRegion,
  StatusRegion,
} from './frame';
export type { AppFrameProps } from './frame';

export {
  HomeRouteSurface,
  NavigatorStageRoute,
  homeMetadata,
  stageMetadata,
} from './route-surfaces';
