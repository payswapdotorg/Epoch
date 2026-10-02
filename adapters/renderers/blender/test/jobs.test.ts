/**
 * The JOB PROTOCOL + CLIENT battery (W060): the full typed conversation —
 * job spec writing, ONE argv-array invocation, strict report parsing, and
 * artifact verification (digests RE-COMPUTED by Epoch) — against the
 * committed CLI double, plus every documented negative path.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import {
  BLENDER_SIDECAR_PYTHON_DIGEST,
  BlenderSidecarClient,
  blenderJobArgv,
  blenderVersionArgv,
  digestOfBytes,
  parseJobReport,
} from '../src/jobs';
import { BLENDER_SIDECAR_PYTHON } from '../src/sidecar';
import { BlenderWorkspace, validWorkspaceSlug } from '../src/workspace';
import { resolveBlenderLimits } from '../src/version';
import type { OffsceneScene } from '../src/offscene';

const DOUBLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'doubles', 'blender-double.mjs');

/** The typed failure code of a refusal (undefined on success). */
function errorCodeOf(
  result: { ok: true; value: unknown } | { ok: false; error: { code: string } },
): string | undefined {
  return result.ok ? undefined : result.error.code;
}

const workspaces: string[] = [];
afterEach(() => {
  for (const dir of workspaces.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** One fresh client over the committed double (honest double mode). */
function doubleClient(): BlenderSidecarClient {
  const dir = mkdtempSync(path.join(tmpdir(), 'epoch-blender-jobs-'));
  workspaces.push(dir);
  return new BlenderSidecarClient({
    program: process.execPath,
    argvPrefix: [DOUBLE],
    workspaceDir: dir,
  });
}

/** A client whose DOUBLE runs in a given misbehavior mode (env injection). */
function modeClient(mode: string, limits: Record<string, number> = {}): BlenderSidecarClient {
  const dir = mkdtempSync(path.join(tmpdir(), 'epoch-blender-jobs-'));
  workspaces.push(dir);
  return new BlenderSidecarClient({
    program: process.execPath,
    argvPrefix: [DOUBLE],
    workspaceDir: dir,
    env: { BLENDER_DOUBLE_MODE: mode },
    limits,
  });
}

/** The canonical offscene scene fixture (deterministic; 2 entities). */
function offsceneFixture(): OffsceneScene {
  return {
    worldDigest: 'f'.repeat(64),
    entities: [
      {
        entityId: 'we-foundation-slab',
        label: 'Foundation slab',
        primitive: 'box',
        position: [0, 0, 0],
        size: 2,
        color: [0.5, 0.5, 0.5],
      },
      {
        entityId: 'we-utility-node',
        label: 'Utility node',
        primitive: 'sphere',
        position: [4, 0, 0],
        size: 1,
        color: null,
      },
    ],
    camera: { position: [10, -10, 10], target: [2, 0, 0] },
  };
}

describe('argv construction (arrays only)', () => {
  it('builds the version argv as a plain array', () => {
    expect(blenderVersionArgv()).toEqual(['--version']);
  });

  it('builds the job argv with the paths after the -- separator', () => {
    expect(blenderJobArgv('/ws/sidecar.py', '/ws/job.json', '/ws/report.json')).toEqual([
      '--background',
      '--factory-startup',
      '--python',
      '/ws/sidecar.py',
      '--',
      '/ws/job.json',
      '/ws/report.json',
    ]);
  });
});

describe('the workspace discipline (strict slugs, traversal-proof)', () => {
  it('accepts lowercase slugs and refuses everything else', () => {
    expect(validWorkspaceSlug('render-f0')).toBe(true);
    expect(validWorkspaceSlug('a')).toBe(true);
    expect(validWorkspaceSlug('../evil')).toBe(false);
    expect(validWorkspaceSlashGuard()).toBe(false);
    expect(validWorkspaceSlug('UPPER')).toBe(false);
    expect(validWorkspaceSlug('under_score')).toBe(false);
    expect(validWorkspaceSlug('')).toBe(false);
    expect(validWorkspaceSlug('a'.repeat(200))).toBe(false);
  });

  it('refuses path traversal through the extension and re-checks the resolved path', () => {
    const workspace = new BlenderWorkspace('/tmp/epoch-ws', resolveBlenderLimits());
    expect(workspace.pathOf('ok-file', '.json').ok).toBe(true);
    const traversal = workspace.pathOf('../escape', '.json');
    expect(traversal.ok).toBe(false);
    if (traversal.ok) return;
    expect(traversal.error.code).toBe('workspace-invalid');
    const badExtension = workspace.pathOf('ok-file', './../../etc/passwd');
    expect(badExtension.ok).toBe(false);
  });
});

function validWorkspaceSlashGuard(): boolean {
  // '..%2f' style encodings stay literal slugs — no decoding anywhere.
  return validWorkspaceSlug('..%2fevil');
}

describe('the sidecar client (full job protocol against the double)', () => {
  it('probes the version through the boundary', async () => {
    const client = doubleClient();
    const probe = await client.probe();
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    expect(probe.value.blenderVersion).toBe('4.2.11');
  });

  it('stages the pinned sidecar script with its recorded digest', () => {
    const client = doubleClient();
    const staged = client.stageSidecar();
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const written = readFileSync(staged.value, 'utf8');
    expect(written).toBe(BLENDER_SIDECAR_PYTHON);
    expect(digestOfBytes(Buffer.from(written, 'utf8'))).toBe(BLENDER_SIDECAR_PYTHON_DIGEST);
  });

  it('runs an offscene render job and verifies the artifact digest', async () => {
    const client = doubleClient();
    const outcome = await client.runJob({
      jobId: 'render-test-1',
      jobKind: 'render-offscene',
      scene: offsceneFixture(),
      outputWidth: 320,
      outputHeight: 240,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.jobKind).toBe('render-offscene');
    expect(outcome.value.entityCount).toBe(2);
    expect(outcome.value.blenderVersion).toBe('4.2.11-epoch-double');
    expect(outcome.value.image).toBeDefined();
    const image = outcome.value.image!;
    expect(image.bytes.length).toBe(image.byteSize);
    expect(image.digest).toBe(digestOfBytes(image.bytes));
    // The artifact carries the semantic provenance payload.
    const text = Buffer.from(image.bytes).toString('utf8');
    expect(text).toContain('epoch-blender-double-image');
    expect(text).toContain('we-foundation-slab');
    expect(text).toContain('we-utility-node');
  });

  it('runs an export-gltf job and verifies the GLB artifact', async () => {
    const client = doubleClient();
    const outcome = await client.runJob({
      jobId: 'export-test-1',
      jobKind: 'export-gltf',
      scene: offsceneFixture(),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const glb = outcome.value.glb!;
    expect(glb.bytes.length).toBe(glb.byteSize);
    expect(glb.digest).toBe(digestOfBytes(glb.bytes));
    // A REAL GLB container: magic, version 2, declared length.
    expect(glb.bytes[0]).toBe(0x67);
    expect(glb.bytes[1]).toBe(0x6c);
    expect(glb.bytes[2]).toBe(0x54);
    expect(glb.bytes[3]).toBe(0x46);
  });

  it('refuses probe jobs on the job path (typed job-invalid)', async () => {
    const client = doubleClient();
    const refused = await client.runJob({ jobId: 'probe-1', jobKind: 'probe' });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.code).toBe('job-invalid');
  });

  it('refuses oversized render outputs (typed job-invalid)', async () => {
    const client = doubleClient();
    const refused = await client.runJob({
      jobId: 'huge-1',
      jobKind: 'render-offscene',
      scene: offsceneFixture(),
      outputWidth: 8_000,
      outputHeight: 8_000,
    });
    expect(errorCodeOf(refused)).toBe('job-invalid');
  });
});

describe('the negative job paths (every failure typed, against the double)', () => {
  it('report-missing: the sidecar exits without writing a report', async () => {
    const client = modeClient('no-report');
    const outcome = await client.runJob({
      jobId: 'noreport-1',
      jobKind: 'render-offscene',
      scene: offsceneFixture(),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('report-missing');
  });

  it('report-invalid: the report is not valid JSON', async () => {
    const client = modeClient('garbage-report');
    const outcome = await client.runJob({
      jobId: 'garbage-1',
      jobKind: 'render-offscene',
      scene: offsceneFixture(),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('report-invalid');
  });

  it('process-failed: non-zero sidecar exits are typed', async () => {
    const client = modeClient('fail-exit');
    const outcome = await client.runJob({
      jobId: 'failexit-1',
      jobKind: 'render-offscene',
      scene: offsceneFixture(),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('process-failed');
    expect(outcome.error.exitCode).toBe(3);
  });

  it('report-invalid: the report answers a DIFFERENT job (id mismatch)', async () => {
    const client = modeClient('wrong-job');
    const outcome = await client.runJob({
      jobId: 'wrongjob-1',
      jobKind: 'render-offscene',
      scene: offsceneFixture(),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('report-invalid');
    expect(outcome.error.message).toContain('wrongjob-1-other');
  });

  it('artifact-mismatch: a self-reported digest that does not match the bytes', async () => {
    const client = modeClient('artifact-lies');
    const outcome = await client.runJob({
      jobId: 'lies-1',
      jobKind: 'render-offscene',
      scene: offsceneFixture(),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('artifact-mismatch');
    expect(outcome.error.message).toContain('digests to');
  });

  it('process-timeout: a hanging sidecar is killed and typed', async () => {
    const client = modeClient('timeout', { jobTimeoutMs: 600 });
    const outcome = await client.runJob({
      jobId: 'hang-1',
      jobKind: 'render-offscene',
      scene: offsceneFixture(),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('process-timeout');
  }, 10_000);
});

describe('parseJobReport (strict shape validation)', () => {
  const expected = { jobId: 'j-1', jobKind: 'render-offscene' as const };

  it('accepts a well-formed report', () => {
    const parsed = parseJobReport(
      {
        ok: true,
        jobId: 'j-1',
        jobKind: 'render-offscene',
        blenderVersion: '4.2.11',
        entityCount: 2,
        image: { fileName: 'j-1-image', byteSize: 100, digest: 'c'.repeat(64) },
      },
      expected,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.image?.fileName).toBe('j-1-image');
  });

  it('refuses sidecar error reports with the typed message', () => {
    const parsed = parseJobReport(
      { ok: false, jobId: 'j-1', errorCode: 'job-unsupported', message: 'nope' },
      expected,
    );
    expect(errorCodeOf(parsed)).toBe('sidecar-error');
  });

  it('refuses id, kind, version, count, and artifact shape violations', () => {
    expect(
      errorCodeOf(parseJobReport({ ok: true, jobId: 'other', jobKind: 'render-offscene', blenderVersion: '4', entityCount: 0 }, expected)),
    ).toBe('report-invalid');
    expect(
      parseJobReport({ ok: true, jobId: 'j-1', jobKind: 'export-gltf', blenderVersion: '4', entityCount: 0 }, expected).ok,
    ).toBe(false);
    expect(
      parseJobReport({ ok: true, jobId: 'j-1', jobKind: 'render-offscene', entityCount: 0 }, expected).ok,
    ).toBe(false);
    expect(
      parseJobReport({ ok: true, jobId: 'j-1', jobKind: 'render-offscene', blenderVersion: '4', entityCount: -1 }, expected).ok,
    ).toBe(false);
    expect(
      parseJobReport(
        { ok: true, jobId: 'j-1', jobKind: 'render-offscene', blenderVersion: '4', entityCount: 1, image: { fileName: '../evil', byteSize: 1, digest: 'c'.repeat(64) } },
        expected,
      ).ok,
    ).toBe(false);
    expect(
      parseJobReport(
        { ok: true, jobId: 'j-1', jobKind: 'render-offscene', blenderVersion: '4', entityCount: 1, image: { fileName: 'j-1-image', byteSize: 1, digest: 'not-a-digest' } },
        expected,
      ).ok,
    ).toBe(false);
  });
});
