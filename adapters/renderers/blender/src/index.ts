/**
 * @epoch/adapter-renderer-blender — public API (experience layer, Work
 * Order W060, ACR-007 / X2.0).
 *
 * The Blender EXTERNAL-PROCESS foundation behind the frozen W056
 * `RendererAdapter` seam: Blender runs as a SEPARATE PROGRAM (GPL
 * separate-executable posture — never linked, never embedded, never
 * bundled; operators supply the binary via EPOCH_BLENDER_PATH) behind a
 * TYPED process boundary.
 *
 * - ARGV-ARRAY ONLY invocations (`spawn`, `shell: false` — no shell, no
 *   string commands, no interpolation) with per-invocation TIMEOUTS and
 *   stdout/stderr BYTE CAPS (typed kills, never unbounded buffers);
 * - the SCOPED WORKSPACE: every file the boundary touches is a strict-slug
 *   path inside one caller-supplied directory (traversal-proof);
 * - TYPED JOB REPORTS: probe / render-offscene / export-gltf, strictly
 *   parsed, with artifact digests RE-COMPUTED by Epoch (provider
 *   self-reports are never trusted — mismatches are typed refusals);
 * - the honest BATCH renderer class: no interactive input (typed
 *   refusals), no portable view state, offscreen frame evidence +
 *   digest-addressed mesh asset bindings only;
 * - the pinned SIDECAR PYTHON SCRIPT (digest-recorded) that runs inside
 *   Blender's background mode.
 *
 * CI verifies the full boundary against the committed Node CLI double
 * (test/doubles/blender-double.mjs): real subprocesses, real timeouts,
 * real byte caps, real report/artifact verification — only Blender itself
 * is doubled. A real Blender binary is exercised ONLY by the env-gated
 * live battery (EPOCH_BLENDER_PATH + EPOCH_BLENDER_LIVE=1; see
 * docs/rendering/blender.md for the exact commands and the honest
 * NOT-VERIFIED-live status).
 */
// The adapter (the seam implementation).
export {
  BlenderSidecarRendererAdapter,
  type BlenderSidecarAdapterOptions,
  type GltfPreparationEvidence,
  type OffscreenRenderEvidence,
} from './adapter';

// The frozen declarations (identity / W013 descriptor / capabilities /
// boundary limits / typed failure taxonomy).
export {
  BLENDER_BOUNDARY_DEFAULT_LIMITS,
  BLENDER_CAPABILITY_ID,
  BLENDER_RENDERER_DESCRIPTION,
  BLENDER_RENDERER_DISPLAY_NAME,
  BLENDER_RENDERER_ID,
  CAPABILITIES_BLENDER,
  DESCRIPTOR_BLENDER,
  IDENTITY_BLENDER,
  blenderFailure,
  resolveBlenderLimits,
  type BlenderBoundaryFailure,
  type BlenderBoundaryFailureCode,
  type BlenderBoundaryLimits,
  type BlenderBoundaryResult,
  type BlenderProcessKillEvidence,
} from './version';

// The typed process boundary (argv-array spawn, timeouts, output caps).
export {
  REAL_SPAWN_RUNNER,
  spawnBlenderProcess,
  type BlenderProcessReport,
  type BlenderProcessRequest,
  type BlenderProcessRunner,
} from './process';

// The scoped workspace (strict slugs, bounded reads/writes, verification).
export { BlenderWorkspace, validWorkspaceSlug } from './workspace';

// The job protocol + client.
export {
  BlenderSidecarClient,
  BLENDER_SIDECAR_PYTHON_DIGEST,
  blenderJobArgv,
  blenderVersionArgv,
  digestOfBytes,
  parseBlenderVersion,
  parseJobReport,
  type BlenderJobArtifact,
  type BlenderJobKind,
  type BlenderJobOutcome,
  type BlenderJobSpec,
} from './jobs';

// The pinned sidecar script (executed inside Blender only).
export { BLENDER_SIDECAR_PYTHON, SIDECAR_FILE_ID } from './sidecar';

// The neutral offscene scene description.
export {
  OFFSCENE_DEFAULT_OUTPUT,
  offsceneSceneOf,
  type OffsceneCamera,
  type OffsceneEntity,
  type OffsceneOutput,
  type OffscenePrimitive,
  type OffsceneScene,
} from './offscene';
