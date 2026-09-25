/**
 * @epoch/web shell mounting points + feature descriptors (W014).
 *
 * THE FEATURE-HOSTING SEAM. Feature libraries mount at
 * `apps/web/src/features/<feature>` (W023's marketplace is the first
 * occupant, landing concurrently). This module defines the seam — typed
 * feature-descriptor contracts + typed mounting points — WITHOUT importing,
 * referencing, or depending on ANY concrete feature. The app must compile,
 * lint, test, and build with the features directory entirely ABSENT
 * (pinned by `src/shell/isolation.test.ts`).
 *
 * - Features enter the shell ONLY through explicit registration of a typed
 *   descriptor — never through directory discovery, dynamic import, or any
 *   other implicit coupling.
 * - Mounting points are shell-owned: four frame regions (header,
 *   navigation, content, status) plus the three Experience slots from
 *   spec/experience-architecture.md (scene surface, narrative/status
 *   surface, candidate/action controls). The Experience slots are
 *   placeholders that later waves fill (W013 renderer wiring, W016
 *   interactive UX): the shell HOSTS projections, it never RUNS them
 *   (lock rule 8).
 * - Tenant isolation (R12): a tenant-scoped feature is admissible only
 *   inside its own tenant — a cross-tenant admission is the typed
 *   `cross-tenant-denied` rejection.
 * - Determinism: feature iteration is sorted by feature id, never by
 *   registration order.
 */
import {
  crossTenantDeniedError,
  duplicateFeatureError,
  duplicateMountError,
  shellOk,
  unknownMountError,
  validationError,
  type ShellResult,
} from './errors';
import type { TenantContextValue } from './tenancy';
import {
  EXPERIENCE_GRAPH_KINDS,
  EXPERIENCE_SLOT_GRAPH_KINDS,
  EXPERIENCE_SLOT_IDS,
  FEATURE_ID_PATTERN,
  MOUNT_ID_PATTERN,
  SEMVER_CORE_PATTERN,
  SHELL_MOUNT_KINDS,
  SHELL_RECORD_VERSION,
  TENANT_ID_PATTERN,
  type ExperienceGraphKind,
  type ExperienceSlotId,
  type ShellMountKind,
  type ShellRegionId,
  type TenantId,
} from './version';

/** One mounting point the shell exposes. */
export interface MountingPoint {
  readonly schemaVersion: typeof SHELL_RECORD_VERSION;
  readonly mountId: string;
  readonly kind: ShellMountKind;
  /** Present exactly when kind is 'region'. */
  readonly region?: ShellRegionId | undefined;
  /** Present exactly when kind is 'experience'. */
  readonly slot?: ExperienceSlotId | undefined;
  /** The Experience Graph kinds this mount hosts (experience mounts only). */
  readonly acceptedGraphKinds: readonly ExperienceGraphKind[];
  readonly description: string;
}

/** Validate one mounting point (total, typed). */
export function validateMountingPoint(input: unknown): ShellResult<MountingPoint> {
  const issues: { path: string; message: string }[] = [];
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      ok: false,
      error: validationError('Mounting point must be a plain object.', [
        { path: '', message: 'expected a plain object' },
      ]),
    };
  }
  const record = input as Record<string, unknown>;
  if (record.schemaVersion !== SHELL_RECORD_VERSION) {
    issues.push({ path: 'schemaVersion', message: `expected ${SHELL_RECORD_VERSION}` });
  }
  if (typeof record.mountId !== 'string' || !MOUNT_ID_PATTERN.test(record.mountId)) {
    issues.push({ path: 'mountId', message: 'expected an opaque mount id (mount:<slug>)' });
  }
  if (
    typeof record.kind !== 'string' ||
    !SHELL_MOUNT_KINDS.includes(record.kind as ShellMountKind)
  ) {
    issues.push({
      path: 'kind',
      message: `expected one of the mount kinds (${SHELL_MOUNT_KINDS.join(', ')})`,
    });
  }
  const kind = record.kind as ShellMountKind | undefined;
  if (kind === 'region') {
    if (
      typeof record.region !== 'string' ||
      !['header', 'navigation', 'content', 'status'].includes(record.region)
    ) {
      issues.push({
        path: 'region',
        message: 'region mounts must name a shell frame region (header|navigation|content|status)',
      });
    }
    if (record.slot !== undefined) {
      issues.push({ path: 'slot', message: 'must be absent on a region mount' });
    }
  } else if (kind === 'experience') {
    if (
      typeof record.slot !== 'string' ||
      !EXPERIENCE_SLOT_IDS.includes(record.slot as ExperienceSlotId)
    ) {
      issues.push({
        path: 'slot',
        message: 'experience mounts must name an Experience slot (scene|narrative|controls)',
      });
    }
    if (record.region !== undefined) {
      issues.push({ path: 'region', message: 'must be absent on an experience mount' });
    }
  }
  if (typeof record.description !== 'string' || record.description.trim().length === 0) {
    issues.push({ path: 'description', message: 'expected a non-empty description' });
  }
  if (issues.length > 0) {
    return { ok: false, error: validationError('Malformed mounting point.', issues) };
  }
  const accepted =
    kind === 'experience' && typeof record.slot === 'string'
      ? EXPERIENCE_SLOT_GRAPH_KINDS[record.slot as ExperienceSlotId]
      : [];
  return shellOk({
    schemaVersion: SHELL_RECORD_VERSION as typeof SHELL_RECORD_VERSION,
    mountId: record.mountId as string,
    kind: kind as ShellMountKind,
    region: kind === 'region' ? (record.region as ShellRegionId) : undefined,
    slot: kind === 'experience' ? (record.slot as ExperienceSlotId) : undefined,
    acceptedGraphKinds: accepted,
    description: record.description as string,
  });
}

/** The mounting-point registry: a total index over the shell's mount surface. */
export interface MountRegistry {
  /** All mounts, sorted by mount id (deterministic). */
  listMounts(): readonly MountingPoint[];
  /** Resolve by opaque mount id (typed `unknown-mount` rejection). */
  resolve(mountId: string): ShellResult<MountingPoint>;
  /** The Experience mount of one slot, if exposed. */
  experienceSlot(slot: ExperienceSlotId): ShellResult<MountingPoint>;
}

/** Build a mounting-point registry (validation + duplicate checks). */
export function createMountRegistry(points: readonly unknown[]): ShellResult<MountRegistry> {
  const validated: MountingPoint[] = [];
  for (const candidate of points) {
    const result = validateMountingPoint(candidate);
    if (!result.ok) {
      return result;
    }
    validated.push(result.value);
  }
  const byId = new Map<string, MountingPoint>();
  const bySlot = new Map<ExperienceSlotId, MountingPoint>();
  for (const point of validated) {
    if (byId.has(point.mountId)) {
      return { ok: false, error: duplicateMountError(point.mountId) };
    }
    if (point.kind === 'experience' && point.slot !== undefined) {
      const owner = bySlot.get(point.slot);
      if (owner !== undefined) {
        return {
          ok: false,
          error: validationError(
            `Experience slot '${point.slot}' is already exposed by '${owner.mountId}'.`,
            [{ path: 'slot', message: `duplicate slot exposure (already owned by '${owner.mountId}')` }],
          ),
        };
      }
      bySlot.set(point.slot, point);
    }
    byId.set(point.mountId, point);
  }
  const ordered: readonly MountingPoint[] = [...validated].sort((a, b) =>
    a.mountId < b.mountId ? -1 : a.mountId > b.mountId ? 1 : 0,
  );
  return shellOk({
    listMounts: () => ordered,
    resolve: (mountId: string) => {
      const point = byId.get(mountId);
      return point === undefined
        ? { ok: false, error: unknownMountError(mountId) }
        : shellOk(point);
    },
    experienceSlot: (slot: ExperienceSlotId) => {
      const point = bySlot.get(slot);
      return point === undefined
        ? { ok: false, error: unknownMountError(`experience-slot:${slot}`) }
        : shellOk(point);
    },
  });
}

/** One mount declaration inside a feature descriptor. */
export interface FeatureMountDeclaration {
  /** The mounting point this feature occupies. */
  readonly mountId: string;
  /** Whether the feature cannot function without this mount. */
  readonly required: boolean;
  /**
   * For experience mounts: the Experience Graph kinds the feature projects
   * into the slot (must be a subset of the slot's accepted kinds).
   */
  readonly experienceGraphKinds?: readonly ExperienceGraphKind[] | undefined;
}

/** A typed feature descriptor: what a feature is and where it mounts. */
export interface FeatureDescriptor {
  readonly schemaVersion: typeof SHELL_RECORD_VERSION;
  readonly featureId: string;
  readonly displayName: string;
  /** Semantic version core (x.y.z) of the feature's contract. */
  readonly version: string;
  /** Owning tenant; absent = tenant-generic (admissible in every tenant). */
  readonly tenantId?: TenantId | undefined;
  readonly mounts: readonly FeatureMountDeclaration[];
}

/**
 * Validate a feature descriptor against a mount registry (total, typed):
 * every declared mount must be a mounting point the shell actually exposes
 * (`unknown-mount` for missing mounts), experience declarations must stay
 * within the slot's accepted graph kinds, and ids/versions must be
 * well-formed.
 */
export function validateFeatureDescriptor(
  input: unknown,
  mounts: MountRegistry,
): ShellResult<FeatureDescriptor> {
  const issues: { path: string; message: string }[] = [];
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      ok: false,
      error: validationError('Feature descriptor must be a plain object.', [
        { path: '', message: 'expected a plain object' },
      ]),
    };
  }
  const record = input as Record<string, unknown>;
  if (record.schemaVersion !== SHELL_RECORD_VERSION) {
    issues.push({ path: 'schemaVersion', message: `expected ${SHELL_RECORD_VERSION}` });
  }
  if (typeof record.featureId !== 'string' || !FEATURE_ID_PATTERN.test(record.featureId)) {
    issues.push({ path: 'featureId', message: 'expected an opaque feature id (feature:<slug>)' });
  }
  if (typeof record.displayName !== 'string' || record.displayName.trim().length === 0) {
    issues.push({ path: 'displayName', message: 'expected a non-empty display name' });
  }
  if (typeof record.version !== 'string' || !SEMVER_CORE_PATTERN.test(record.version)) {
    issues.push({ path: 'version', message: 'expected a semantic version core (x.y.z)' });
  }
  if (record.tenantId !== undefined) {
    if (typeof record.tenantId !== 'string' || !TENANT_ID_PATTERN.test(record.tenantId)) {
      issues.push({
        path: 'tenantId',
        message: 'expected an opaque tenant id (tenant:<slug>) when present',
      });
    }
  }
  if (!Array.isArray(record.mounts) || record.mounts.length === 0) {
    issues.push({
      path: 'mounts',
      message: 'expected a non-empty array of mount declarations',
    });
  } else {
    const seen = new Set<string>();
    record.mounts.forEach((raw, index) => {
      const mount = raw as Record<string, unknown>;
      if (
        typeof mount !== 'object' ||
        mount === null ||
        typeof mount.mountId !== 'string' ||
        !MOUNT_ID_PATTERN.test(mount.mountId)
      ) {
        issues.push({
          path: `mounts[${index}].mountId`,
          message: 'expected an opaque mount id (mount:<slug>)',
        });
        return;
      }
      if (seen.has(mount.mountId)) {
        issues.push({
          path: `mounts[${index}].mountId`,
          message: `duplicate mount declaration ('${mount.mountId}')`,
        });
        return;
      }
      seen.add(mount.mountId);
      if (typeof mount.required !== 'boolean') {
        issues.push({
          path: `mounts[${index}].required`,
          message: 'expected a boolean',
        });
      }
      const point = mounts.resolve(mount.mountId);
      if (!point.ok) {
        issues.push({
          path: `mounts[${index}].mountId`,
          message: `unknown mounting point '${String(mount.mountId)}' — the shell does not expose it`,
        });
        return;
      }
      if (point.value.kind === 'experience') {
        const kinds = mount.experienceGraphKinds;
        if (!Array.isArray(kinds) || kinds.length === 0) {
          issues.push({
            path: `mounts[${index}].experienceGraphKinds`,
            message: 'experience mounts must declare at least one Experience Graph kind',
          });
        } else {
          for (const kind of kinds) {
            if (
              typeof kind !== 'string' ||
              !EXPERIENCE_GRAPH_KINDS.includes(kind as ExperienceGraphKind)
            ) {
              issues.push({
                path: `mounts[${index}].experienceGraphKinds`,
                message: `unknown Experience Graph kind '${String(kind)}'`,
              });
            } else if (!point.value.acceptedGraphKinds.includes(kind as ExperienceGraphKind)) {
              issues.push({
                path: `mounts[${index}].experienceGraphKinds`,
                message: `graph kind '${kind}' is not accepted by mount '${point.value.mountId}' (accepted: ${point.value.acceptedGraphKinds.join(', ')})`,
              });
            }
          }
        }
      } else if (mount.experienceGraphKinds !== undefined) {
        issues.push({
          path: `mounts[${index}].experienceGraphKinds`,
          message: 'must be absent on a region mount',
        });
      }
    });
  }
  if (issues.length > 0) {
    return {
      ok: false,
      error: validationError('Malformed feature descriptor.', issues),
    };
  }
  return shellOk({
    schemaVersion: SHELL_RECORD_VERSION as typeof SHELL_RECORD_VERSION,
    featureId: record.featureId as string,
    displayName: record.displayName as string,
    version: record.version as string,
    tenantId: record.tenantId as TenantId | undefined,
    mounts: (record.mounts as Record<string, unknown>[]).map((mount) => ({
      mountId: mount.mountId as string,
      required: mount.required as boolean,
      experienceGraphKinds: mount.experienceGraphKinds as readonly ExperienceGraphKind[] | undefined,
    })),
  });
}

/**
 * Admit one feature descriptor into an active tenant context: a
 * tenant-scoped feature from ANOTHER tenant is the typed
 * `cross-tenant-denied` rejection (R12); tenant-generic features are
 * admissible everywhere.
 */
export function admitFeature(
  feature: FeatureDescriptor,
  tenant: TenantContextValue,
): ShellResult<FeatureDescriptor> {
  if (feature.tenantId !== undefined && feature.tenantId !== tenant.tenantId) {
    return {
      ok: false,
      error: crossTenantDeniedError(tenant.tenantId, feature.tenantId),
    };
  }
  return shellOk(feature);
}

/**
 * The registered feature set of a tenant context: features admissible for
 * the context (tenant-generic or same-tenant), sorted by feature id —
 * isolation by omission (features of other tenants are simply absent).
 */
export interface FeatureSet {
  /** Sorted feature ids (deterministic). */
  listFeatureIds(): readonly string[];
  /** Resolve a registered, tenant-visible feature (typed rejections). */
  resolve(featureId: string): ShellResult<FeatureDescriptor>;
  /** All descriptors, sorted by feature id. */
  listFeatures(): readonly FeatureDescriptor[];
}

/** Build the feature set of a context from explicitly registered descriptors. */
export function createFeatureSet(
  descriptors: readonly unknown[],
  mounts: MountRegistry,
  tenant: TenantContextValue,
): ShellResult<FeatureSet> {
  const admitted: FeatureDescriptor[] = [];
  const byId = new Map<string, FeatureDescriptor>();
  for (const candidate of descriptors) {
    const validated = validateFeatureDescriptor(candidate, mounts);
    if (!validated.ok) {
      return validated;
    }
    const admittedResult = admitFeature(validated.value, tenant);
    if (!admittedResult.ok) {
      return admittedResult;
    }
    const feature = admittedResult.value;
    if (byId.has(feature.featureId)) {
      return { ok: false, error: duplicateFeatureError(feature.featureId) };
    }
    byId.set(feature.featureId, feature);
    admitted.push(feature);
  }
  const ordered: readonly FeatureDescriptor[] = [...admitted].sort((a, b) =>
    a.featureId < b.featureId ? -1 : a.featureId > b.featureId ? 1 : 0,
  );
  return shellOk({
    listFeatureIds: () => ordered.map((feature) => feature.featureId),
    resolve: (featureId: string) => {
      const feature = byId.get(featureId);
      if (feature === undefined) {
        return {
          ok: false,
          error: validationError(
            `Feature '${featureId}' is not registered for tenant '${tenant.tenantId}'.`,
            [{ path: 'featureId', message: 'unknown or not tenant-visible in this context' }],
          ),
        };
      }
      return shellOk(feature);
    },
    listFeatures: () => ordered,
  });
}

/** The features mounted at one mounting point, sorted by feature id. */
export function featuresAtMount(
  features: FeatureSet,
  mountId: string,
): readonly FeatureDescriptor[] {
  return features
    .listFeatures()
    .filter((feature) => feature.mounts.some((mount) => mount.mountId === mountId));
}
