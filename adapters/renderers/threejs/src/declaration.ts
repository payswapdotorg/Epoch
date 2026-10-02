/**
 * The adapter's frozen declarations (W058): the neutral identity, the W013
 * hosting descriptor, and the W056 fabric capability set.
 *
 * Provider neutrality (lock rule 13): the identity names the ROLE this
 * adapter serves, never a vendor product claim; the descriptor declares
 * hosting kinds/modalities/output/budgets as typed data; the capability
 * set declares the fabric operations. Three.js is the replaceable engine
 * behind them.
 */
import { REVISION as THREE_REVISION } from 'three';
import type { RendererCapabilitySet, RendererDescriptor } from '@epoch/renderer-runtime';
import type { RendererAdapterIdentity } from '@epoch/renderer-fabric';
import {
  THREE_CAPABILITY_ID,
  THREE_RENDERER_DESCRIPTION,
  THREE_RENDERER_DISPLAY_NAME,
  THREE_RENDERER_ID,
} from './version';

/** The neutral identity of this adapter (the capability + descriptor ids). */
export const IDENTITY_THREE: RendererAdapterIdentity = {
  capabilityId: THREE_CAPABILITY_ID,
  rendererId: THREE_RENDERER_ID,
  displayName: THREE_RENDERER_DISPLAY_NAME,
  description: `${THREE_RENDERER_DESCRIPTION} (engine revision r${THREE_REVISION}; the exact version pin is the catalog entry — see docs/rendering/threejs.md).`,
};

/**
 * The W013 hosting descriptor: what this renderer HOSTS. Graph kinds cover
 * the compiled presentations this adapter mounts (3d spatial, animation
 * clips, timeline replay, presence); narrative/controls graphs are the
 * host-chrome surface (W057) — mounting one here is a typed
 * `capability-denied` refusal at the W013 boundary, never silent.
 */
export const DESCRIPTOR_THREE: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: THREE_RENDERER_ID,
  graphKinds: ['3d', 'animation', 'presence', 'timeline-replay'],
  interaction: ['keyboard', 'pointer'],
  output: {
    stereoscopic: false,
    maxPixels: 2_073_600,
    refreshHz: 60,
    colorDepthBits: 24,
  },
  budgets: {
    maxGraphNodes: 4_096,
    maxGraphEdges: 8_192,
    maxTriangles: 1_000_000,
    maxTextureBytes: 268_435_456,
  },
};

/** The W056 fabric capability set: what this adapter DOES. */
export const CAPABILITIES_THREE: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: THREE_RENDERER_ID,
  hitTesting: true,
  measurement: true,
  annotation: true,
  frameCapture: true,
  sessionSwitching: true,
  snapshotCapture: true,
  degradation: ['none', 'reduced-fidelity', 'static-frame', 'wireframe'],
  portableViewState: ['camera', 'focused-entities', 'layer-visibility', 'timeline-position'],
  assetKinds: ['material', 'mesh', 'texture'],
};
