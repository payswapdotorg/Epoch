/**
 * The Blender sidecar adapter's frozen declarations (W060): neutral
 * identity, the W013 hosting descriptor, the W056 capability set, the
 * boundary limits, and the typed process-boundary failure taxonomy.
 *
 * Provider neutrality (lock rule 13): every constant names the ROLE this
 * adapter serves (a batch/offscreen sidecar renderer); Blender is the
 * replaceable foundation behind it. The adapter NEVER names Blender in its
 * renderer id (the `rr-` grammar forbids vendor products) — only the
 * package's capability/descriptor DESCRIPTIONS honestly record the engine,
 * exactly like the W058/W059 precedents.
 */
import type { RendererCapabilitySet, RendererDescriptor } from '@epoch/renderer-runtime';
import type { RendererAdapterIdentity } from '@epoch/renderer-fabric';

/** The neutral renderer id (W013 grammar: "rr-" + lowercase slug). */
export const BLENDER_RENDERER_ID = 'rr-offscreen-sidecar';

/** The neutral capability id (capability-registry identity). */
export const BLENDER_CAPABILITY_ID = 'epoch.renderer.offscreen-sidecar';

/** The neutral display name for the Epoch renderer selector. */
export const BLENDER_RENDERER_DISPLAY_NAME = 'Offscreen Sidecar Renderer (Blender)';

/** The neutral description (the honest engine + class disclosure). */
export const BLENDER_RENDERER_DESCRIPTION =
  'Batch high-fidelity/offscreen renderer: an external Blender sidecar process behind a typed boundary (argv-array invocations, timeouts, output caps, verified reports); offscene rendering and glTF asset preparation only — no interactive input';

/** The neutral identity of this adapter. */
export const IDENTITY_BLENDER: RendererAdapterIdentity = {
  capabilityId: BLENDER_CAPABILITY_ID,
  rendererId: BLENDER_RENDERER_ID,
  displayName: BLENDER_RENDERER_DISPLAY_NAME,
  description: BLENDER_RENDERER_DESCRIPTION,
};

/**
 * The W013 hosting descriptor: what this renderer HOSTS. The canonical W016
 * projection compiles the 3d spatial graph plus its animation, presence,
 * and timeline-replay companions — the binding must declare every kind the
 * mount admits (the W058/W059 precedent), while the offscene build reads
 * the 3d graph (the others ride along as admitted data). It services NO
 * interactive modality (a passive producer — the schema's empty-interaction
 * case).
 */
export const DESCRIPTOR_BLENDER: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: BLENDER_RENDERER_ID,
  graphKinds: ['3d', 'animation', 'presence', 'timeline-replay'],
  interaction: [],
  output: {
    stereoscopic: false,
    maxPixels: 8_294_400, // 4K-grade stills
    colorDepthBits: 24,
    // refreshHz intentionally omitted: a batch sidecar produces stills, not
    // an interactive refresh stream (the schema's positive-integer field).
  },
  budgets: {
    maxGraphNodes: 2_048,
    maxGraphEdges: 4_096,
    maxTriangles: 2_000_000,
    maxTextureBytes: 268_435_456,
  },
};

/**
 * The W056 fabric capability set: what this adapter DOES. Honest batch
 * class: no hit-testing, no measurement, no annotation, no interactive
 * degradation ladder; it DOES capture frames (offscreen renders), survive
 * switches (restoring the semantic portable subset — focused entities and
 * layer visibility — while camera/timeline presentation stays skipped),
 * and bind validated mesh assets (glTF/GLB bindings feed its
 * export/preparation jobs).
 */
export const CAPABILITIES_BLENDER: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: BLENDER_RENDERER_ID,
  hitTesting: false,
  measurement: false,
  annotation: false,
  frameCapture: true,
  sessionSwitching: true,
  snapshotCapture: true,
  degradation: ['none'],
  portableViewState: ['focused-entities', 'layer-visibility'],
  assetKinds: ['mesh'],
};

/** The deterministic limits of the EXTERNAL-PROCESS boundary. */
export type BlenderBoundaryLimits = {
  /** Ceiling of one `--version` probe invocation. */
  readonly probeTimeoutMs: number;
  /** Ceiling of one sidecar job invocation. */
  readonly jobTimeoutMs: number;
  /** Maximum captured stdout bytes before the child is killed (typed failure). */
  readonly maxStdoutBytes: number;
  /** Maximum captured stderr bytes before the child is killed (typed failure). */
  readonly maxStderrBytes: number;
  /** Maximum accepted size of one report JSON file. */
  readonly maxReportBytes: number;
  /** Maximum accepted size of one artifact file (rendered image / exported GLB). */
  readonly maxArtifactBytes: number;
  /** Maximum offscene entities per job. */
  readonly maxEntities: number;
  /** Maximum render pixels per job (width * height). */
  readonly maxImagePixels: number;
};

/** The default boundary limits. */
export const BLENDER_BOUNDARY_DEFAULT_LIMITS: Readonly<BlenderBoundaryLimits> = {
  probeTimeoutMs: 10_000,
  jobTimeoutMs: 120_000,
  maxStdoutBytes: 256 * 1024,
  maxStderrBytes: 256 * 1024,
  maxReportBytes: 1024 * 1024,
  maxArtifactBytes: 64 * 1024 * 1024,
  maxEntities: 10_000,
  maxImagePixels: 8_294_400,
};

/** Merge caller overrides over the defaults. */
export function resolveBlenderLimits(
  overrides?: Partial<BlenderBoundaryLimits>,
): BlenderBoundaryLimits {
  if (overrides === undefined) {
    return { ...BLENDER_BOUNDARY_DEFAULT_LIMITS };
  }
  return { ...BLENDER_BOUNDARY_DEFAULT_LIMITS, ...overrides };
}

/**
 * The typed failure taxonomy of the external-process boundary. Every
 * failure is a value (never a bare throw): the host branches on the code,
 * exactly like the renderer-fabric failure discipline.
 */
export type BlenderBoundaryFailureCode =
  | 'blender-not-configured'
  | 'workspace-invalid'
  | 'job-invalid'
  | 'job-unsupported'
  | 'process-timeout'
  | 'output-limit-exceeded'
  | 'process-failed'
  | 'report-missing'
  | 'report-invalid'
  | 'artifact-mismatch'
  | 'sidecar-error'
  | 'internal-error';

/** One typed process-boundary failure. */
export type BlenderBoundaryFailure = {
  readonly code: BlenderBoundaryFailureCode;
  readonly message: string;
  /** The job id the failure belongs to (when known). */
  readonly jobId?: string;
  /** The process exit code (process failures only). */
  readonly exitCode?: number;
  /** Evidence of a boundary-enforced kill (timeout / output-cap failures only). */
  readonly killed?: BlenderProcessKillEvidence;
};

/** Evidence captured when the boundary killed a runaway invocation. */
export type BlenderProcessKillEvidence = {
  readonly killReason: 'timeout' | 'stdout-limit' | 'stderr-limit';
  /** Wall-clock duration before the kill, in milliseconds. */
  readonly durationMs: number;
  /** The stdout captured before the kill (bounded). */
  readonly stdout: string;
  /** The stderr captured before the kill (bounded). */
  readonly stderr: string;
  /** Total bytes seen on each stream before the kill. */
  readonly bytesSeen: { readonly stdout: number; readonly stderr: number };
};

/** The boundary's uniform result type (mirrors the fabric's FabricResult). */
export type BlenderBoundaryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: BlenderBoundaryFailure };

/** A convenience constructor for typed failures (single construction site). */
export function blenderFailure(
  code: BlenderBoundaryFailureCode,
  message: string,
  extra?: { jobId?: string; exitCode?: number },
): { ok: false; error: BlenderBoundaryFailure } {
  return {
    ok: false,
    error:
      extra === undefined
        ? { code, message }
        : { code, message, ...(extra.jobId !== undefined ? { jobId: extra.jobId } : {}), ...(extra.exitCode !== undefined ? { exitCode: extra.exitCode } : {}) },
  };
}
