/**
 * The SIDECAAR JOB PROTOCOL + CLIENT (W060) — the typed conversation between
 * the adapter and the Blender sidecar process:
 *
 *   1. the adapter writes ONE job spec (strict slug id) into the scoped
 *      workspace: {jobId, jobKind, scene?, output: {path, width, height}};
 *   2. the boundary invokes Blender ONCE (argv array: --background
 *      --factory-startup --python <sidecar.py> -- <job.json> <report.json>);
 *   3. the sidecar executes exactly the declared job kind and writes ONE
 *      typed JSON report + (for render/export) ONE artifact file;
 *   4. the client strictly parses the report and VERIFIES the artifact
 *      (size + digest RE-COMPUTED by Epoch — provider self-reports are
 *      never trusted; any mismatch is a typed `artifact-mismatch`).
 *
 * Every failure mode is typed (see version.ts): timeouts, output caps,
 * non-zero exits, missing/invalid reports, artifact mismatches, unsupported
 * jobs. Nothing here ever shells out: the boundary builds argv arrays only.
 */
import { createHash } from 'node:crypto';
import type { BlenderProcessReport, BlenderProcessRunner } from './process';
import { REAL_SPAWN_RUNNER } from './process';
import {
  BLENDER_SIDECAR_PYTHON,
  BLENDER_SIDECAR_PYTHON_DIGEST,
  SIDECAR_FILE_ID,
} from './sidecar';
import { BlenderWorkspace } from './workspace';
import type { OffsceneScene } from './offscene';
import type { BlenderBoundaryLimits, BlenderBoundaryResult } from './version';
import { blenderFailure, resolveBlenderLimits } from './version';

/** The supported job kinds (the sidecar refuses everything else). */
export type BlenderJobKind = 'probe' | 'render-offscene' | 'export-gltf';

/** One typed job spec (serialized into the workspace). */
export type BlenderJobSpec = {
  readonly jobId: string;
  readonly jobKind: BlenderJobKind;
  readonly scene?: OffsceneScene;
  readonly output?: { readonly path: string; readonly width: number; readonly height: number };
};

/** One verified artifact of a completed job. */
export type BlenderJobArtifact = {
  readonly fileName: string;
  readonly byteSize: number;
  /** The digest Epoch re-computed (never the provider's self-report). */
  readonly digest: string;
  /** The verified artifact bytes. */
  readonly bytes: Uint8Array;
};

/** One completed, strictly-parsed, artifact-verified job. */
export type BlenderJobOutcome = {
  readonly jobId: string;
  readonly jobKind: BlenderJobKind;
  readonly blenderVersion: string;
  readonly entityCount: number;
  readonly image?: BlenderJobArtifact;
  readonly glb?: BlenderJobArtifact;
  /** Boundary evidence: exit code and wall-clock duration of the invocation. */
  readonly exitCode: number | null;
  readonly durationMs: number;
};

/** The argv of a version probe (argv array ONLY). */
export function blenderVersionArgv(): readonly string[] {
  return ['--version'];
}

/** The argv of one sidecar job (argv array ONLY; the paths are workspace files). */
export function blenderJobArgv(
  sidecarPath: string,
  jobSpecPath: string,
  reportPath: string,
): readonly string[] {
  return ['--background', '--factory-startup', '--python', sidecarPath, '--', jobSpecPath, reportPath];
}

/**
 * Parse the Blender version from `--version` stdout (the first
 * "Blender x.y.z" occurrence; neutral evidence for the probe report).
 */
export function parseBlenderVersion(stdout: string): string | null {
  const match = /Blender (\d+\.\d+\.\d+)/.exec(stdout);
  return match === null ? null : match[1]!;
}

/** Strictly validate one parsed report object against the job protocol. */
export function parseJobReport(
  raw: Record<string, unknown>,
  expected: { jobId: string; jobKind: BlenderJobKind },
): BlenderBoundaryResult<{
  blenderVersion: string;
  entityCount: number;
  image?: { fileName: string; byteSize: number; digest: string };
  glb?: { fileName: string; byteSize: number; digest: string };
}> {
  if (raw.ok !== true) {
    const errorCode = typeof raw.errorCode === 'string' ? raw.errorCode : 'unknown';
    const message = typeof raw.message === 'string' ? raw.message : 'the sidecar reported a failure without a message';
    return blenderFailure('sidecar-error', `the sidecar refused the job (${errorCode}): ${message}`, {
      jobId: expected.jobId,
    });
  }
  if (raw.jobId !== expected.jobId) {
    return blenderFailure(
      'report-invalid',
      `the report answers job "${JSON.stringify(raw.jobId)}" but the adapter asked for "${expected.jobId}"`,
      { jobId: expected.jobId },
    );
  }
  if (raw.jobKind !== expected.jobKind) {
    return blenderFailure(
      'report-invalid',
      `the report answers a "${JSON.stringify(raw.jobKind)}" job but the adapter asked for "${expected.jobKind}"`,
      { jobId: expected.jobId },
    );
  }
  if (typeof raw.blenderVersion !== 'string' || raw.blenderVersion.length === 0) {
    return blenderFailure('report-invalid', 'the report carries no Blender version', {
      jobId: expected.jobId,
    });
  }
  const entityCount = raw.entityCount;
  if (typeof entityCount !== 'number' || !Number.isInteger(entityCount) || entityCount < 0) {
    return blenderFailure('report-invalid', 'the report carries no valid entity count', {
      jobId: expected.jobId,
    });
  }
  const artifactOf = (value: unknown, kind: 'image' | 'glb'): { fileName: string; byteSize: number; digest: string } | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== 'object' || value === null) {
      throw new Error(`invalid ${kind}`);
    }
    const record = value as Record<string, unknown>;
    if (typeof record.fileName !== 'string' || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(record.fileName)) {
      throw new Error(`invalid ${kind} file name`);
    }
    if (typeof record.byteSize !== 'number' || !Number.isInteger(record.byteSize) || record.byteSize < 0) {
      throw new Error(`invalid ${kind} byte size`);
    }
    if (typeof record.digest !== 'string' || !/^[0-9a-f]{64}$/.test(record.digest)) {
      throw new Error(`invalid ${kind} digest`);
    }
    return { fileName: record.fileName, byteSize: record.byteSize, digest: record.digest };
  };
  try {
    return {
      ok: true,
      value: {
        blenderVersion: raw.blenderVersion,
        entityCount,
        ...(artifactOf(raw.image, 'image') !== undefined
          ? { image: artifactOf(raw.image, 'image')! }
          : {}),
        ...(artifactOf(raw.glb, 'glb') !== undefined ? { glb: artifactOf(raw.glb, 'glb')! } : {}),
      },
    };
  } catch (err) {
    return blenderFailure('report-invalid', (err as Error).message, { jobId: expected.jobId });
  }
}

/** The construction options of the sidecar client. */
export type BlenderSidecarClientOptions = {
  /** The program to invoke (the Blender binary; `node` for the CI double). */
  readonly program: string;
  /** Arguments before the Blender flags (the CI double's script path). */
  readonly argvPrefix?: readonly string[];
  /** The injected process runner (the REAL spawn boundary by default). */
  readonly runner?: BlenderProcessRunner;
  /** The scoped workspace directory. */
  readonly workspaceDir: string;
  /** Boundary limits. */
  readonly limits?: Partial<BlenderBoundaryLimits>;
  /** Environment additions for the child (test-double modes; never secrets). */
  readonly env?: Readonly<Record<string, string>>;
};

/**
 * The sidecar client: probe + job execution over the typed boundary. ONE
 * instance owns ONE workspace; the adapter constructs it from its options.
 */
export class BlenderSidecarClient {
  private readonly runner: BlenderProcessRunner;
  private readonly program: string;
  private readonly argvPrefix: readonly string[];
  private readonly workspace: BlenderWorkspace;
  private readonly limits: BlenderBoundaryLimits;
  private readonly env: Readonly<Record<string, string>> | undefined;
  private sidecarStaged = false;

  constructor(options: BlenderSidecarClientOptions) {
    this.runner = options.runner ?? REAL_SPAWN_RUNNER;
    this.program = options.program;
    this.argvPrefix = options.argvPrefix ?? [];
    this.workspace = new BlenderWorkspace(options.workspaceDir, resolveBlenderLimits(options.limits));
    this.limits = resolveBlenderLimits(options.limits);
    this.env = options.env;
  }

  /** The scoped workspace (the adapter reads verified artifacts through it). */
  workspaceOf(): BlenderWorkspace {
    return this.workspace;
  }

  /** Stage the pinned sidecar script into the workspace (idempotent). */
  stageSidecar(): BlenderBoundaryResult<string> {
    if (this.sidecarStaged) {
      const staged = this.workspace.pathOf(SIDECAR_FILE_ID, '.py');
      if (staged.ok) return staged;
    }
    const ensured = this.workspace.ensure();
    if (!ensured.ok) return ensured;
    const target = this.workspace.pathOf(SIDECAR_FILE_ID, '.py');
    if (!target.ok) return target;
    const written = this.workspace.writeArtifact(SIDECAR_FILE_ID, '.py', new TextEncoder().encode(BLENDER_SIDECAR_PYTHON));
    if (!written.ok) return written;
    this.sidecarStaged = true;
    return target;
  }

  /** Run the version probe: `--version` through the typed boundary. */
  async probe(): Promise<BlenderBoundaryResult<{ blenderVersion: string; report: BlenderProcessReport }>> {
    const run = await this.runner.run({
      program: this.program,
      argvPrefix: this.argvPrefix,
      argv: blenderVersionArgv(),
      timeoutMs: this.limits.probeTimeoutMs,
      maxStdoutBytes: this.limits.maxStdoutBytes,
      maxStderrBytes: this.limits.maxStderrBytes,
      ...(this.env === undefined ? {} : { env: this.env }),
    });
    if (!run.ok) return run;
    if (run.value.exitCode !== 0) {
      return blenderFailure(
        'process-failed',
        `the version probe exited with code ${run.value.exitCode}: ${run.value.stderr.slice(0, 200)}`,
        { exitCode: run.value.exitCode ?? undefined },
      );
    }
    const version = parseBlenderVersion(run.value.stdout);
    if (version === null) {
      return blenderFailure(
        'report-invalid',
        `the version probe printed no parsable Blender version (stdout: ${run.value.stdout.slice(0, 120)})`,
      );
    }
    return { ok: true, value: { blenderVersion: version, report: run.value } };
  }

  /** Run ONE sidecar job end-to-end (spec → invoke → report → verify). */
  async runJob(job: {
    jobId: string;
    jobKind: BlenderJobKind;
    scene?: OffsceneScene;
    outputFileName?: string;
    outputWidth?: number;
    outputHeight?: number;
  }): Promise<BlenderBoundaryResult<BlenderJobOutcome>> {
    const ensured = this.workspace.ensure();
    if (!ensured.ok) return ensured;
    if (job.jobKind === 'probe') {
      return blenderFailure('job-invalid', 'probe jobs run through probe(), not the job path');
    }
    const staged = this.stageSidecar();
    if (!staged.ok) return staged;
    const sidecarPath = staged.value;

    // The artifact path (workspace-scoped; the spec carries it for the sidecar).
    const extension = job.jobKind === 'render-offscene' ? '.png' : '.glb';
    const artifactId = job.jobKind === 'render-offscene' ? `${job.jobId}-image` : `${job.jobId}-glb`;
    const artifactPath = this.workspace.pathOf(artifactId, extension);
    if (!artifactPath.ok) return artifactPath;
    const width = job.outputWidth ?? 640;
    const height = job.outputHeight ?? 480;
    if (width * height > this.limits.maxImagePixels) {
      return blenderFailure(
        'job-invalid',
        `the render output is ${width}x${height} pixels (max ${this.limits.maxImagePixels})`,
        { jobId: job.jobId },
      );
    }

    // 1. the job spec.
    const spec: BlenderJobSpec = {
      jobId: job.jobId,
      jobKind: job.jobKind,
      ...(job.scene !== undefined ? { scene: job.scene } : {}),
      output: { path: artifactPath.value, width, height },
    };
    const specPath = this.workspace.writeJson(job.jobId, '.job.json', spec);
    if (!specPath.ok) return specPath;

    // 2. ONE boundary invocation (argv array; timeouts + caps inside).
    const reportId = `${job.jobId}-report`;
    const reportPath = this.workspace.pathOf(reportId, '.json');
    if (!reportPath.ok) return reportPath;
    const run = await this.runner.run({
      program: this.program,
      argvPrefix: this.argvPrefix,
      argv: blenderJobArgv(sidecarPath, specPath.value, reportPath.value),
      timeoutMs: this.limits.jobTimeoutMs,
      maxStdoutBytes: this.limits.maxStdoutBytes,
      maxStderrBytes: this.limits.maxStderrBytes,
      ...(this.env === undefined ? {} : { env: this.env }),
    });
    if (!run.ok) {
      return { ok: false, error: { ...run.error, jobId: job.jobId } };
    }
    if (run.value.exitCode !== 0) {
      return blenderFailure(
        'process-failed',
        `the sidecar exited with code ${run.value.exitCode}: ${run.value.stderr.slice(0, 200)}`,
        { jobId: job.jobId, exitCode: run.value.exitCode ?? undefined },
      );
    }

    // 3. the report (strict parse).
    const rawReport = this.workspace.readJson(reportId, '.json');
    if (!rawReport.ok) return rawReport;
    const parsed = parseJobReport(rawReport.value, { jobId: job.jobId, jobKind: job.jobKind });
    if (!parsed.ok) return parsed;

    // 4. the artifact (size + digest RE-COMPUTED by Epoch).
    const claimed =
      job.jobKind === 'render-offscene' ? parsed.value.image : parsed.value.glb;
    if (claimed === undefined) {
      return blenderFailure('report-invalid', `the ${job.jobKind} report carries no artifact record`, {
        jobId: job.jobId,
      });
    }
    const verified = this.workspace.readVerifiedArtifact(claimed.fileName, extension, claimed, digestOfBytes);
    if (!verified.ok) return verified;
    // The artifact's own digest was verified against the re-computed one;
    // carry the re-computed digest forward (never the self-report).
    const artifact: BlenderJobArtifact = {
      fileName: claimed.fileName,
      byteSize: verified.value.length,
      digest: digestOfBytes(verified.value),
      bytes: verified.value,
    };

    return {
      ok: true,
      value: {
        jobId: job.jobId,
        jobKind: job.jobKind,
        blenderVersion: parsed.value.blenderVersion,
        entityCount: parsed.value.entityCount,
        ...(job.jobKind === 'render-offscene' ? { image: artifact } : { glb: artifact }),
        exitCode: run.value.exitCode,
        durationMs: run.value.durationMs,
      },
    };
  }
}

/** SHA-256 over raw bytes (Node's own crypto — this adapter is Node-only by construction: it drives an external PROCESS). */
export function digestOfBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** The pinned sidecar digest re-export (provenance for docs/batteries). */
export { BLENDER_SIDECAR_PYTHON_DIGEST };
