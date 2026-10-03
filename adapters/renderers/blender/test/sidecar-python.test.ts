/**
 * The SIDECAR-PYTHON EXECUTION GUARD (W068, ACR-011) — the battery that
 * closes the W064 evidence gap inside the STANDARD CI run.
 *
 * The committed Node CLI double re-implements the sidecar job protocol in
 * JavaScript and NEVER executes the emitted sidecar Python, so the W064
 * live run was the first real execution of the pinned script — and it
 * found the defect CI structurally could not see: the argv-validation
 * prologue's `require()` call sites passed 4 of 5 positional arguments,
 * and EVERY real-Blender job died with
 * `TypeError: require() missing 1 required positional argument: 'message'`
 * before reading the job spec or writing any report (Blender 4.2.11
 * printed the traceback but exited 0, so the boundary surfaced the typed
 * `report-missing` failure instead).
 *
 * This battery EXECUTES the exact staged sidecar Python — the bytes the
 * adapter stages for every real Blender invocation, staged through the
 * PRODUCTION client and pinned by `BLENDER_SIDECAR_PYTHON_DIGEST` — under
 * the CI-available python3 runtime (no Blender binary, no new
 * dependencies; python3 is the only allowed runtime):
 *
 *   python3 blender-sidecar.py -- <job-spec.json> <report.json>
 *
 * Everything before the Blender-only engine import is pure stdlib, so
 * under python3 the argv-validation prologue, the job-spec read, the
 * job-kind dispatch, and the typed report write all really execute —
 * only `import bpy` / `import mathutils` need a real Blender, and their
 * absence is itself a TYPED report. A defect of the W064 class (an
 * arity/shape error at ANY `require()` call site this battery drives)
 * can therefore never return silently: a report file exists ONLY if the
 * prologue executed with all five positional arguments passed at every
 * call site, and the malformed-argv runs pin the exact W064 failure
 * signature ABSENT.
 *
 * This is CI evidence about the SIDEcar script only — never a claim about
 * Blender itself (the env-gated live battery remains the sole
 * real-Blender evidence surface; live evidence is never CI evidence).
 *
 * The final test additionally pins the SUCCESS-report fields statically
 * (blenderVersion + the artifact fileName) — the fields the adapter's
 * strict parser enforces and the committed double implements, which the
 * W068 live rerun found missing from the real sidecar after the arity
 * fix unmasked them; their producing paths are Blender-only, so the
 * emitted source is the CI-executable pin and the live battery is the
 * behavioral one.
 *
 * THE STUB BLOCK (the W068 re-dispatch strengthening): the ok render/export
 * paths are ALSO executed behaviorally in CI against the minimal honest
 * bpy/mathutils PYTHON STUB (test/doubles/python-stub/ — the committed Node
 * CLI double's pattern applied one level deeper: real python3 process, real
 * workspace files, real digests; the stub identifies itself as
 * "4.2.11-epoch-python-stub" and renders deterministic labeled byte
 * artifacts, never pixels). The stub legs drive the FULL success paths
 * (prologue → job read → build_scene → render/export → report write) and
 * validate the reports through the adapter's OWN strict parser
 * (parseJobReport) with the artifact digests RE-COMPUTED
 * (readVerifiedArtifact) — closing the static-only gap disclosed above:
 * a shape regression in the success reports now fails the STANDARD
 * battery, not just the env-gated live run. Injected ONLY via PYTHONPATH
 * by these legs (the unstubbed legs run with PYTHONPATH scrubbed, so no
 * ambient bpy can satisfy them).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { BLENDER_SIDECAR_PYTHON_DIGEST, BlenderSidecarClient, digestOfBytes, parseJobReport } from '../src/jobs';
import { BLENDER_SIDECAR_PYTHON } from '../src/sidecar';
import { BlenderWorkspace } from '../src/workspace';
import { resolveBlenderLimits } from '../src/version';

/**
 * The python3 program this battery executes (the only allowed runtime —
 * preinstalled on the CI image exactly like the governance check's python3).
 */
const PYTHON3 = 'python3';

/** The bpy/mathutils stub directory (PYTHONPATH-injected by the stub legs only). */
const STUB_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'doubles',
  'python-stub',
);

const workspaces: string[] = [];
afterEach(() => {
  for (const dir of workspaces.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** One fresh workspace with the PINNED sidecar staged through the production client. */
function stagedSidecar(): { dir: string; script: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'epoch-blender-sidecar-guard-'));
  workspaces.push(dir);
  const client = new BlenderSidecarClient({ program: PYTHON3, argvPrefix: [], workspaceDir: dir });
  const staged = client.stageSidecar();
  expect(staged.ok).toBe(true);
  if (!staged.ok) throw new Error(staged.error.message);
  return { dir, script: staged.value };
}

/** One completed python3 run of the sidecar (argv array ONLY — never a shell). */
type SidecarRun = { status: number | null; stdout: string; stderr: string };

function runSidecar(
  script: string,
  args: readonly string[],
  options: { pythonPath?: string } = {},
): SidecarRun {
  // Hermetic by construction: the unstubbed legs run with PYTHONPATH
  // scrubbed (no ambient bpy can satisfy them); the stub legs set it to
  // the committed stub directory exactly.
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (options.pythonPath === undefined) {
    delete env.PYTHONPATH;
  } else {
    env.PYTHONPATH = options.pythonPath;
  }
  const run = spawnSync(PYTHON3, [script, ...args], {
    encoding: 'utf8',
    timeout: 30_000,
    shell: false,
    env,
  });
  if (run.error !== undefined) {
    throw new Error(`the guard runtime "${PYTHON3}" could not execute the staged sidecar: ${run.error.message}`);
  }
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

/** Write one job spec into the workspace; returns its path. */
function writeJob(dir: string, fileName: string, spec: Record<string, unknown>): string {
  const jobPath = path.join(dir, fileName);
  writeFileSync(jobPath, JSON.stringify(spec), 'utf8');
  return jobPath;
}

/** Read + parse the typed report the sidecar wrote (asserting it exists). */
function readReport(reportPath: string): Record<string, unknown> {
  const raw = readFileSync(reportPath, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

/** A minimal well-formed offscene scene (the job protocol's own shape). */
function guardScene(): Record<string, unknown> {
  return {
    worldDigest: 'a'.repeat(64),
    entities: [
      {
        entityId: 'we-guard-slab',
        label: 'Guard slab',
        primitive: 'box',
        position: [0, 0, 0],
        size: 2,
        color: [0.5, 0.5, 0.5],
      },
    ],
    camera: { position: [10, -10, 10], target: [0, 0, 0] },
  };
}

describe('the sidecar-python execution guard (python3; the W064 failure class pinned)', () => {
  it('executes the staged sidecar through the argv-validation prologue under python3 — a typed report exists ONLY if every require() call site passed all five positional arguments', () => {
    const { dir, script } = stagedSidecar();
    // The EXECUTED bytes are the pinned bytes (the production staging path).
    const staged = readFileSync(script);
    expect(digestOfBytes(staged)).toBe(BLENDER_SIDECAR_PYTHON_DIGEST);
    console.log('[sidecar-python guard] executed staged digest:', digestOfBytes(staged));

    const jobPath = writeJob(dir, 'guard-probe-1.job.json', { jobId: 'guard-probe-1', jobKind: 'probe' });
    const reportPath = path.join(dir, 'guard-probe-1-report.json');
    const run = runSidecar(script, ['--', jobPath, reportPath]);

    // Pre-fix (the W064 defect), this run died inside the prologue with
    // `TypeError: require() missing 1 required positional argument` BEFORE
    // reading the job or writing any report. Post-fix the prologue passes,
    // the probe branch dispatches, and the Blender-only engine import
    // becomes the typed refusal it is designed to be under a python3 runtime.
    expect(run.status).toBe(0);
    const report = readReport(reportPath);
    expect(report.ok).toBe(false);
    expect(report.jobId).toBe('guard-probe-1');
    expect(report.errorCode).toBe('sidecar-error');
    expect(String(report.message)).toContain('bpy');
  });

  it('types the unknown-job-kind refusal through the job/report protocol', () => {
    const { dir, script } = stagedSidecar();
    const jobPath = writeJob(dir, 'guard-bogus-1.job.json', { jobId: 'guard-bogus-1', jobKind: 'bogus' });
    const reportPath = path.join(dir, 'guard-bogus-1-report.json');
    const run = runSidecar(script, ['--', jobPath, reportPath]);

    expect(run.status).toBe(0);
    const report = readReport(reportPath);
    expect(report.ok).toBe(false);
    expect(report.jobId).toBe('guard-bogus-1');
    expect(report.errorCode).toBe('job-unsupported');
    expect(String(report.message)).toContain('unknown job kind: bogus');
  });

  it('types the render job no-scene refusal through the five-argument require failure path', () => {
    const { dir, script } = stagedSidecar();
    const jobPath = writeJob(dir, 'guard-noscene-1.job.json', {
      jobId: 'guard-noscene-1',
      jobKind: 'render-offscene',
    });
    const reportPath = path.join(dir, 'guard-noscene-1-report.json');
    const run = runSidecar(script, ['--', jobPath, reportPath]);

    expect(run.status).toBe(0);
    const report = readReport(reportPath);
    expect(report.ok).toBe(false);
    expect(report.jobId).toBe('guard-noscene-1');
    expect(report.errorCode).toBe('job-invalid');
    expect(String(report.message)).toBe('the render job carries no scene');
  });

  it('types the export job no-output refusal through the five-argument require failure path', () => {
    const { dir, script } = stagedSidecar();
    // Scene present (its require passes), output absent (its require fails).
    const jobPath = writeJob(dir, 'guard-nooutput-1.job.json', {
      jobId: 'guard-nooutput-1',
      jobKind: 'export-gltf',
      scene: guardScene(),
    });
    const reportPath = path.join(dir, 'guard-nooutput-1-report.json');
    const run = runSidecar(script, ['--', jobPath, reportPath]);

    expect(run.status).toBe(0);
    const report = readReport(reportPath);
    expect(report.ok).toBe(false);
    expect(report.jobId).toBe('guard-nooutput-1');
    expect(report.errorCode).toBe('job-invalid');
    expect(String(report.message)).toBe('the export job carries no output');
  });

  it('executes the render dispatch all the way to the Blender-only engine import — a typed sidecar-error report under python3', () => {
    const { dir, script } = stagedSidecar();
    const artifactPath = path.join(dir, 'guard-deep-1.png');
    const jobPath = writeJob(dir, 'guard-deep-1.job.json', {
      jobId: 'guard-deep-1',
      jobKind: 'render-offscene',
      scene: guardScene(),
      output: { path: artifactPath, width: 320, height: 240 },
    });
    const reportPath = path.join(dir, 'guard-deep-1-report.json');
    const run = runSidecar(script, ['--', jobPath, reportPath]);

    // The full happy-path dispatch: prologue → job read → scene/output
    // requires PASS → build_scene reached → the engine import (Blender-only)
    // typed out as a sidecar-error report. No Blender binary, no fabrication.
    expect(run.status).toBe(0);
    const report = readReport(reportPath);
    expect(report.ok).toBe(false);
    expect(report.jobId).toBe('guard-deep-1');
    expect(report.errorCode).toBe('sidecar-error');
    expect(String(report.message)).toContain('bpy');
  });

  it('types the unreadable-job-spec refusal', () => {
    const { dir, script } = stagedSidecar();
    const jobPath = path.join(dir, 'guard-badjson-1.job.json');
    writeFileSync(jobPath, '{"jobId": "guard-badjson-1", "jobKind": ', 'utf8');
    const reportPath = path.join(dir, 'guard-badjson-1-report.json');
    const run = runSidecar(script, ['--', jobPath, reportPath]);

    expect(run.status).toBe(0);
    const report = readReport(reportPath);
    expect(report.ok).toBe(false);
    expect(report.errorCode).toBe('job-invalid');
    expect(String(report.message)).toContain('not readable JSON');
  });

  it('refuses malformed argv through the prologue validation — with the exact W064 arity signature ABSENT', () => {
    const { dir, script } = stagedSidecar();
    const jobPath = writeJob(dir, 'guard-argv-1.job.json', { jobId: 'guard-argv-1', jobKind: 'probe' });

    // (a) NO `--` separator: the first prologue require fails.
    const noSeparator = runSidecar(script, []);
    // (b) ONE path after `--` (not the required two): the second prologue
    // require fails.
    const wrongCount = runSidecar(script, ['--', jobPath]);

    for (const run of [noSeparator, wrongCount]) {
      // Under python3 an uncaught traceback exits 1 (Blender 4.2.11 exits 0
      // on uncaught `--python` script exceptions — the W064 observation;
      // the adapter's typed `report-missing` path covers that shape live).
      expect(run.status).toBe(1);
      // THE REGRESSION PIN: the W064 defect class (an arity error at a
      // prologue call site) produced EXACTLY this signature on stderr; it
      // must never appear again.
      expect(run.stderr).not.toContain('require() missing');
      // The honest unchanged shape of the prologue refusal: a malformed
      // argv carries NO report path (the empty sentinel), so the typed
      // failure surfaces at the empty-path report write — the pre-existing
      // design, untouched by the W068 change set (the arity call sites +
      // the success-report fields); the typed-report protocol itself is
      // pinned by the well-formed runs above.
      expect(run.stderr).toContain('FileNotFoundError');
    }
  });

  it('pins the emitted success-report fields the adapter strict parser enforces (the W068 second finding, masked by the arity crash)', () => {
    // The specified SUCCESS-report shape is defined by the adapter's strict
    // parser (parseJobReport) and implemented by the committed double: every
    // success report carries `blenderVersion`, and the render/export
    // artifact records carry the workspace-slug `fileName` the adapter's
    // readVerifiedArtifact resolves. The real sidecar omitted all of them —
    // a divergence the W064 arity crash masked (every job died before any
    // report was written) and the W068 live rerun unmasked as the typed
    // `report-invalid` / "the report carries no Blender version" failure.
    // Those fields are produced on Blender-only paths (`import bpy`), so the
    // CI-executable pin is the emitted source itself; the behavioral pin is
    // the env-gated live battery (live evidence, never claimed as CI).
    const versionFields = BLENDER_SIDECAR_PYTHON.match(
      /"blenderVersion": bpy\.app\.version_string/g,
    );
    expect(versionFields).not.toBeNull();
    // probe + render-offscene + export-gltf: all three success reports carry it.
    expect(versionFields!).toHaveLength(3);
    expect(BLENDER_SIDECAR_PYTHON).toContain('"fileName": job_id + "-image"');
    expect(BLENDER_SIDECAR_PYTHON).toContain('"fileName": job_id + "-glb"');
  });
});

describe('the ok render/export paths executed against the bpy python stub (the behavioral success-shape pin)', () => {
  // The minimal honest bpy/mathutils doubles (test/doubles/python-stub/)
  // let the STANDARD battery EXECUTE the success paths the static pin above
  // can only read: prologue → job read → build_scene (the epochEntityId
  // provenance stamping included) → the render/export → the success report
  // write — and then validate that report through the ADAPTER'S OWN strict
  // parser with the artifact digest RE-COMPUTED, exactly as runJob does
  // live. The stub identifies itself ("4.2.11-epoch-python-stub") and
  // writes deterministic labeled byte artifacts, never pixels — the same
  // honesty rules as the committed Node CLI double.

  it('renders the ok report end-to-end and it passes the adapter\'s own strict parser with the artifact digest re-computed', () => {
    const { dir, script } = stagedSidecar();
    const jobId = 'guard-stub-render-1';
    // The artifact path follows the adapter's own derivation so the
    // workspace verification below resolves it exactly as runJob would.
    const artifactPath = path.join(dir, `${jobId}-image.png`);
    const jobPath = writeJob(dir, `${jobId}.job.json`, {
      jobId,
      jobKind: 'render-offscene',
      scene: guardScene(),
      output: { path: artifactPath, width: 320, height: 240 },
    });
    const reportPath = path.join(dir, `${jobId}-report.json`);
    const run = runSidecar(script, ['--', jobPath, reportPath], { pythonPath: STUB_DIR });

    expect(run.status).toBe(0);
    expect(run.stderr).not.toContain('Traceback');
    const parsed = parseJobReport(readReport(reportPath), { jobId, jobKind: 'render-offscene' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.blenderVersion).toBe('4.2.11-epoch-python-stub');
    expect(parsed.value.entityCount).toBe(1);
    expect(parsed.value.image?.fileName).toBe(`${jobId}-image`);
    // The adapter's own verification discipline: the artifact is re-read
    // through the scoped workspace and its digest RE-COMPUTED (the
    // sidecar's self-report is never trusted).
    const workspace = new BlenderWorkspace(dir, resolveBlenderLimits());
    const verified = workspace.readVerifiedArtifact(
      parsed.value.image!.fileName,
      '.png',
      parsed.value.image!,
      digestOfBytes,
    );
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    // The stub's honest labeled artifact (never pixels) — and the semantic
    // provenance stamping (epochEntityId) actually ran through build_scene.
    const text = Buffer.from(verified.value).toString('utf8');
    expect(text).toContain('epoch-python-stub-image');
    expect(text).toContain('we-guard-slab');
  });

  it('exports the ok report end-to-end and it passes the adapter\'s own strict parser with the artifact digest re-computed', () => {
    const { dir, script } = stagedSidecar();
    const jobId = 'guard-stub-export-1';
    const artifactPath = path.join(dir, `${jobId}-glb.glb`);
    const jobPath = writeJob(dir, `${jobId}.job.json`, {
      jobId,
      jobKind: 'export-gltf',
      scene: guardScene(),
      output: { path: artifactPath, width: 320, height: 240 },
    });
    const reportPath = path.join(dir, `${jobId}-report.json`);
    const run = runSidecar(script, ['--', jobPath, reportPath], { pythonPath: STUB_DIR });

    expect(run.status).toBe(0);
    expect(run.stderr).not.toContain('Traceback');
    const parsed = parseJobReport(readReport(reportPath), { jobId, jobKind: 'export-gltf' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.blenderVersion).toBe('4.2.11-epoch-python-stub');
    expect(parsed.value.entityCount).toBe(1);
    expect(parsed.value.glb?.fileName).toBe(`${jobId}-glb`);
    const workspace = new BlenderWorkspace(dir, resolveBlenderLimits());
    const verified = workspace.readVerifiedArtifact(
      parsed.value.glb!.fileName,
      '.glb',
      parsed.value.glb!,
      digestOfBytes,
    );
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    // GLB magic + the stub's honest label.
    expect(verified.value[0]).toBe(0x67);
    expect(Buffer.from(verified.value).toString('utf8')).toContain('epoch-python-stub-glb');
  });

  it('leaves exactly the declared files behind (the two-path workspace discipline)', () => {
    // The sidecar touches ONLY the two paths it was given plus the declared
    // artifact: after the ok stub render the workspace holds exactly the
    // staged sidecar, the job spec, the report, and the artifact.
    const { dir, script } = stagedSidecar();
    const jobId = 'guard-stub-render-2';
    const artifactPath = path.join(dir, `${jobId}-image.png`);
    const jobPath = writeJob(dir, `${jobId}.job.json`, {
      jobId,
      jobKind: 'render-offscene',
      scene: guardScene(),
      output: { path: artifactPath, width: 320, height: 240 },
    });
    const reportPath = path.join(dir, `${jobId}-report.json`);
    const run = runSidecar(script, ['--', jobPath, reportPath], { pythonPath: STUB_DIR });

    expect(run.status).toBe(0);
    expect(readdirSync(dir).sort()).toEqual([
      'blender-sidecar.py',
      `${jobId}-image.png`,
      `${jobId}-report.json`,
      `${jobId}.job.json`,
    ]);
  });
});
