/**
 * The desktop device descriptor — the FULL-FIDELITY rung of the device
 * adaptation ladder (spec/experience-architecture.md "Device adaptation":
 * "desktop = full"), expressed in the W011 device-descriptor slot
 * (src/device.ts of @epoch/experience-protocol: the abstract, neutral
 * capability/limit record every projection request and Experience Graph
 * carries).
 *
 * What "full fidelity" means here, precisely and testably:
 *
 * 1. `deviceClass: 'desktop'` — the neutral ladder rung itself;
 * 2. the interaction set covers EVERY modality a desktop-class surface can
 *    service (gamepad, keyboard, pointer, touch, voice — sorted ascending,
 *    duplicate-free). Gaze and gesture are pose-tracked classes; a
 *    screen-bound desktop declares `poseTracking: 'none'`, so those
 *    modalities are foreign to the class, not missing fidelity;
 * 3. the spatial budgets sit at the renderer-runtime ceilings, so the
 *    desktop descriptor NEVER downgrades the negotiated envelope of any
 *    lawful W013 renderer (effective triangle/texture limits are the
 *    minimum of renderer and device — a ceiling-valued device never
 *    constrains);
 * 4. all seven Experience Graph kinds remain hostable: kinds are declared
 *    by the renderer descriptor, and the desktop's modality/display
 *    envelope does not intersect them away.
 *
 * The descriptor is typed data in the W011 slot — it is NOT a measurement
 * of any physical GPU, and it imports no engine, no graphics API, and no
 * native toolkit (lock rule 13). Concrete adaptation (real display
 * enumeration, refresh negotiation) is the W019 surface, never this
 * package's.
 */
import {
  validateDeviceDescriptor,
  type DeviceDescriptor,
  type ExperienceGraphKind,
} from '@epoch/experience-protocol';
import {
  MAX_RENDERER_TEXTURE_BYTES,
  MAX_RENDERER_TRIANGLES,
  computeEffectiveLimits,
  type RendererDescriptor,
  type DeviceSessionSnapshot,
} from '@epoch/renderer-runtime';
import { desktopOk, type DesktopResult } from './errors';

// The renderer-runtime ceilings the full-fidelity budgets pin against
// (re-exported: the fidelity claim is defined in terms of them).
export { MAX_RENDERER_TEXTURE_BYTES, MAX_RENDERER_TRIANGLES };

/** The canonical full-fidelity desktop device descriptor (W011 slot). */
export const DESKTOP_DEVICE: DeviceDescriptor = {
  descriptorVersion: 1,
  deviceClass: 'desktop',
  interaction: ['gamepad', 'keyboard', 'pointer', 'touch', 'voice'],
  display: {
    stereoscopic: false,
    maxPixels: 8_294_400,
    refreshHz: 144,
    colorDepthBits: 24,
  },
  spatial: {
    poseTracking: 'none',
    worldAnchored: false,
    maxTriangles: MAX_RENDERER_TRIANGLES,
    maxTextureBytes: MAX_RENDERER_TEXTURE_BYTES,
  },
  latencyBudgetMs: 20,
};

/** The modalities a desktop-class surface can service (sorted set). */
export const DESKTOP_SERVICEABLE_MODALITIES: readonly ('gamepad' | 'keyboard' | 'pointer' | 'touch' | 'voice')[] =
  ['gamepad', 'keyboard', 'pointer', 'touch', 'voice'];

/**
 * Every Experience Graph kind (all seven), in the lexicographic order the
 * deterministic set semantics of the renderer vocabulary require — the
 * kinds a full-fidelity desktop hosts through a kind-complete renderer.
 */
export const FULL_FIDELITY_GRAPH_KINDS: readonly ExperienceGraphKind[] = [
  '2d',
  '3d',
  'animation',
  'controls',
  'narrative',
  'presence',
  'timeline-replay',
];

/** A maximal renderer descriptor (hosts every kind, every desktop modality). */
export const KIND_COMPLETE_RENDERER: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: 'rr-desktop-reference',
  graphKinds: [...FULL_FIDELITY_GRAPH_KINDS],
  interaction: [...DESKTOP_SERVICEABLE_MODALITIES],
  output: {
    stereoscopic: true,
    maxPixels: 8_294_400,
    refreshHz: 144,
    colorDepthBits: 24,
  },
  budgets: {
    maxGraphNodes: 4_096,
    maxGraphEdges: 8_192,
    maxTriangles: MAX_RENDERER_TRIANGLES,
    maxTextureBytes: MAX_RENDERER_TEXTURE_BYTES,
  },
};

/** The typed full-fidelity assessment of one device descriptor. */
export interface FidelityAssessment {
  /** The assessed device class (neutral vocabulary). */
  readonly deviceClass: string;
  /** True when the descriptor sits in the desktop class. */
  readonly isDesktopClass: boolean;
  /** True when every desktop-serviceable modality is declared (sorted set). */
  readonly declaresServiceableModalities: boolean;
  /** True when the interaction set includes the primary pair (keyboard, pointer). */
  readonly declaresPrimaryModalities: boolean;
  /** True when spatial budgets sit at the renderer ceilings (never downgrade). */
  readonly neverDowngradesSpatialBudgets: boolean;
  /** True when a kind-complete renderer keeps all seven graph kinds hostable. */
  readonly hostsAllGraphKinds: boolean;
  /** True when the effective interaction set still services the primary pair. */
  readonly effectivePrimaryModalities: boolean;
  /** True iff every claim above holds — the full-fidelity ladder rung. */
  readonly isFullFidelity: boolean;
}

/**
 * Assess a device descriptor against the full-fidelity desktop rung of the
 * adaptation ladder. Pure, total, deterministic: the assessment is typed
 * data (never a throw, never a wall clock).
 */
export function assessDesktopFidelity(device: DeviceDescriptor): FidelityAssessment {
  const isDesktopClass = device.deviceClass === 'desktop';
  const serviceable = DESKTOP_SERVICEABLE_MODALITIES.every((modality) =>
    device.interaction.includes(modality),
  );
  const primary =
    device.interaction.includes('keyboard') && device.interaction.includes('pointer');
  const ceilings =
    device.spatial.maxTriangles === MAX_RENDERER_TRIANGLES &&
    device.spatial.maxTextureBytes === MAX_RENDERER_TEXTURE_BYTES;

  // The kind-complete negotiation: a maximal renderer bound to this device.
  const snapshot: DeviceSessionSnapshot = {
    deviceSessionId: 'ds-fidelity-assessment',
    tenantScope: { tenantId: 'tenant-fidelity-assessment' },
    device,
  };
  const effective = computeEffectiveLimits(KIND_COMPLETE_RENDERER, snapshot);
  const allKinds = FULL_FIDELITY_GRAPH_KINDS.every((kind) => effective.graphKinds.includes(kind));
  const effectivePrimary =
    effective.interaction.includes('keyboard') && effective.interaction.includes('pointer');

  const isFullFidelity = isDesktopClass && serviceable && primary && ceilings && allKinds && effectivePrimary;
  return {
    deviceClass: device.deviceClass,
    isDesktopClass,
    declaresServiceableModalities: serviceable,
    declaresPrimaryModalities: primary,
    neverDowngradesSpatialBudgets: ceilings,
    hostsAllGraphKinds: allKinds,
    effectivePrimaryModalities: effectivePrimary,
    isFullFidelity,
  };
}

/** The pinned assessment of the canonical desktop descriptor. */
export const DESKTOP_FIDELITY: FidelityAssessment = assessDesktopFidelity(DESKTOP_DEVICE);

/**
 * Admit a device descriptor for a desktop shell surface: the full W011
 * device-descriptor admission (version gate first, then the deep schema),
 * plus the desktop-class gate. A non-desktop descriptor is a typed
 * `device-mismatch` (the ladder rung is part of this shell's contract),
 * never a silent adaptation.
 */
export function admitDeviceDescriptor(input: unknown): DesktopResult<DeviceDescriptor> {
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    const encountered = (input as Record<string, unknown>).descriptorVersion;
    if (typeof encountered === 'number' && encountered !== 1) {
      return {
        ok: false,
        error: {
          code: 'version-unsupported',
          message: `device descriptor version mismatch: expected 1, encountered ${encountered}`,
          expected: '1',
          encountered: String(encountered),
        },
      };
    }
    if (encountered !== undefined && typeof encountered !== 'number') {
      return {
        ok: false,
        error: {
          code: 'malformed-record',
          message: 'device descriptor version must be the number 1',
          issues: [{ path: 'descriptorVersion', message: 'expected the number 1' }],
        },
      };
    }
  }
  const admitted = validateDeviceDescriptor(input);
  if (!admitted.ok) {
    // Reuse the W011 typed error verbatim, flattened into the shell taxonomy.
    if (admitted.error.code === 'version-unsupported') {
      return {
        ok: false,
        error: {
          code: 'version-unsupported',
          message: admitted.error.message,
          expected: admitted.error.expected,
          encountered: admitted.error.encountered,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: `device descriptor failed W011 admission (${admitted.error.code})`,
        issues: [{ path: 'device', message: admitted.error.message }],
      },
    };
  }
  if (admitted.value.deviceClass !== 'desktop') {
    return {
      ok: false,
      error: {
        code: 'device-mismatch',
        message:
          `experience surface targets a "${admitted.value.deviceClass}" device; ` +
          'this shell hosts "desktop" surfaces',
        expected: 'desktop',
        encountered: admitted.value.deviceClass,
      },
    };
  }
  return desktopOk(admitted.value);
}
